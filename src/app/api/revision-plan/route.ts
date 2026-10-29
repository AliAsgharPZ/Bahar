import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor, readJson, demoWriteBlock, audit } from "@/lib/api";
import { toJalaliKey } from "@/lib/persian";

/* ============================================================
   بهار | برنامهٔ مرور امتحان — زمان‌بندی مرور فاصله‌دار روی دادهٔ واقعی
   برای هر امتحان آینده (۳۰ روز آینده) سه جلسهٔ مرور پیشنهاد می‌شود
   (۷ روز قبل، ۳ روز قبل، ۱ روز قبل) و درس‌های ضعیف‌تر (کمترین
   میانگین نمره) در اولویت‌اند. GET فقط پیشنهاد می‌دهد؛ POST
   جلسه‌های یک امتحان را در فهرست مطالعهٔ دانش‌آموز (StudyTask)
   ذخیره می‌کند، با جلسه‌های بازمحاسبه‌شده سمت سرور و نگه‌دار
   عدم تکرار (عنوان + تاریخ شمسی یکتا).
   ============================================================ */

const DAY = 86400000;

type GradeRow = { maxScore: number; score: number; weight: number | null; subject: { name: string } | null };
type ExamRow = { id: string; title: string; subjectName: string | null; startsAt: Date };

/** محاسبهٔ مشترک GET و POST: ضعیف‌ترین درس‌ها + جلسه‌های ۷/۳/۱ روز قبل. */
function buildPlan(exams: ExamRow[], grades: GradeRow[], now: Date) {
  const perSubject = new Map<string, { sum: number; w: number }>();
  for (const g of grades) {
    const name = g.subject?.name ?? "بدون درس";
    const cur = perSubject.get(name) ?? { sum: 0, w: 0 };
    const max = g.maxScore > 0 ? g.maxScore : 20;
    cur.sum += (g.score / max) * 100 * (g.weight || 1);
    cur.w += g.weight || 1;
    perSubject.set(name, cur);
  }
  const weakSubjects = [...perSubject.entries()]
    .map(([name, a]) => ({ name, avg: Math.round((a.sum / a.w) * 10) / 10 }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);
  const weakNames = new Set(weakSubjects.map((s) => s.name));

  const sessions: { date: string; examId: string; examTitle: string; examDate: string; subject: string; minutes: number; focusWeak: boolean; step: string }[] = [];
  for (const ex of exams) {
    const examDate = new Date(ex.startsAt);
    const focus = ex.subjectName ?? weakSubjects[0]?.name ?? "مرور عمومی";
    const steps: [number, string][] = [[7, "مرور اول"], [3, "مرور دوم"], [1, "مرور نهایی"]];
    for (const [daysBefore, step] of steps) {
      const d = new Date(examDate.getTime() - daysBefore * DAY);
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;
      sessions.push({
        date: d.toISOString().slice(0, 10),
        examId: ex.id,
        examTitle: ex.title,
        examDate: examDate.toISOString().slice(0, 10),
        subject: focus,
        minutes: 45,
        focusWeak: weakNames.has(focus),
        step,
      });
    }
  }
  sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { weakSubjects, sessions };
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const q = new URL(req.url).searchParams;

    let studentId = q.get("studentId") ?? "";
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
      if (!profile) return apiOk({ sessions: [], weakSubjects: [] });
      studentId = profile.id;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, select: { studentId: true } });
      if (!link) return apiOk({ sessions: [], weakSubjects: [] });
      studentId = studentId || link.studentId;
    }
    if (!studentId) return apiErr(400, "studentId لازم است.", "BAD_REQUEST");
    const student = await db.student.findFirst({
      where: { id: studentId, schoolId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * DAY);
    const exams = await db.examSession.findMany({
      where: { schoolId, startsAt: { gte: now, lte: horizon } },
      orderBy: { startsAt: "asc" },
      take: 10,
    });

    const grades = await db.gradeRecord.findMany({
      where: { studentId },
      include: { subject: { select: { name: true } } },
    });
    const { weakSubjects, sessions } = buildPlan(exams, grades, now);
    return apiOk({
      student: { id: student.id, name: `${student.user.firstName} ${student.user.lastName}` },
      exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subjectName, startsAt: e.startsAt.toISOString(), durationMin: e.durationMin })),
      weakSubjects,
      sessions,
      note: "جلسه‌های مرور پیشنهاد فاصله‌دارند (۷/۳/۱ روز قبل از امتحان)؛ با «ذخیره در برنامهٔ مطالعه» به فهرست مطالعهٔ دانش‌آموز اضافه می‌شوند.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** ذخیرهٔ جلسه‌های یک امتحان در فهرست مطالعهٔ دانش‌آموز (StudyTask).
    جلسه‌ها سمت سرور بازمحاسبه می‌شوند (بدنه فقط studentId و examId)؛
    مورد تکراری (همان تاریخ شمسی + عنوان) دوباره ساخته نمی‌شود. */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ studentId?: string; examId?: string }>(req);

    let studentId = String(body.studentId ?? "");
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
      if (!profile) return apiErr(400, "دانش‌آموز مشخص نیست.", "NO_STUDENT");
      studentId = profile.id;
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      if (studentId && !links.some((l) => l.studentId === studentId)) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
      if (!studentId) studentId = links[0]?.studentId ?? "";
      if (!studentId) return apiErr(400, "دانش‌آموز مشخص نیست.", "NO_STUDENT");
    }
    if (!studentId) return apiErr(400, "studentId لازم است.", "BAD_REQUEST");
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    const examId = String(body.examId ?? "");
    if (!examId) return apiErr(400, "examId لازم است.", "BAD_REQUEST");
    const exam = await db.examSession.findFirst({ where: { id: examId, schoolId } });
    if (!exam) return apiErr(404, "امتحان یافت نشد.", "NOT_FOUND");
    const now = new Date();
    if (exam.startsAt < now || exam.startsAt > new Date(now.getTime() + 30 * DAY)) {
      return apiErr(400, "امتحان در بازهٔ ۳۰ روز آینده نیست.", "BAD_REQUEST");
    }

    const grades = await db.gradeRecord.findMany({
      where: { studentId },
      include: { subject: { select: { name: true } } },
    });
    const { sessions } = buildPlan([exam], grades, now);
    if (sessions.length === 0) return apiOk({ created: 0, skipped: 0, total: 0 });

    const toJalali = (greg: string) => {
      const [y, m, d] = greg.split("-").map(Number);
      return toJalaliKey(new Date(y, m - 1, d));
    };
    const existing = await db.studyTask.findMany({ where: { studentId }, select: { date: true, title: true } });
    const have = new Set(existing.map((x) => `${x.date}|${x.title}`));
    const toCreate = sessions
      .map((s) => ({ date: toJalali(s.date), title: `${s.step} — ${s.examTitle} (${s.subject})`, minutes: 45 }))
      .filter((s) => !have.has(`${s.date}|${s.title}`));
    if (toCreate.length > 0) {
      await db.$transaction(
        toCreate.map((s) => db.studyTask.create({ data: { schoolId, studentId, date: s.date, title: s.title, minutes: s.minutes } })),
      );
    }
    await audit({ user: me, action: "APPLY_REVISION_PLAN", entityType: "EXAM", entityId: exam.id, schoolId });
    return apiOk({ created: toCreate.length, skipped: sessions.length - toCreate.length, total: sessions.length });
  } catch (e) {
    return handleApiError(e);
  }
}
