import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | برنامهٔ مرور امتحان — زمان‌بندی مرور فاصله‌دار روی دادهٔ واقعی
   برای هر امتحان آینده (۳۰ روز آینده) سه جلسهٔ مرور پیشنهاد می‌شود
   (۷ روز قبل، ۳ روز قبل، ۱ روز قبل) و درس‌های ضعیف‌تر (کمترین
   میانگین نمره) در اولویت‌اند. فقط پیشنهاد است و هیچ داده‌ای را
   تغییر نمی‌دهد.
   ============================================================ */

const DAY = 86400000;

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

    const sessions: { date: string; examTitle: string; examDate: string; subject: string; minutes: number; focusWeak: boolean; step: string }[] = [];
    for (const ex of exams) {
      const examDate = new Date(ex.startsAt);
      const focus = ex.subjectName ?? weakSubjects[0]?.name ?? "مرور عمومی";
      const steps: [number, string][] = [[7, "مرور اول"], [3, "مرور دوم"], [1, "مرور نهایی"]];
      for (const [daysBefore, step] of steps) {
        const d = new Date(examDate.getTime() - daysBefore * DAY);
        if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;
        sessions.push({
          date: d.toISOString().slice(0, 10),
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
    return apiOk({
      student: { id: student.id, name: `${student.user.firstName} ${student.user.lastName}` },
      exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subjectName, startsAt: e.startsAt.toISOString(), durationMin: e.durationMin })),
      weakSubjects,
      sessions,
      note: "جلسه‌های مرور پیشنهاد فاصله‌دارند (۷/۳/۱ روز قبل از امتحان) و ذخیره نمی‌شوند.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
