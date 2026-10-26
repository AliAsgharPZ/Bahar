import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | آزمون آنلاین — ساخت از بانک سؤال، انتشار برای کلاس،
   تصحیح خودکار چندگزینه‌ای/جای‌خالی.
   GET    /api/quizzes        فهرست (کادر: همهٔ آزمون‌های مدرسه؛
                              دانش‌آموز: آزمون‌های بازِ کلاسش + تلاشش)
   POST   /api/quizzes        ساخت آزمون (پیش‌نویس)
   PATCH  /api/quizzes        ویرایش/تغییر وضعیت (سازنده یا مدیر)
   DELETE /api/quizzes?id=    حذف (سازنده یا مدیر)
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER"];
const STATUSES = ["DRAFT", "OPEN", "CLOSED"];

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);

    if (me.role === "STUDENT") {
      const student = await db.student.findFirst({ where: { userId: me.id }, select: { id: true, classId: true, schoolId: true } });
      if (!student) return apiOk({ quizzes: [] });
      const quizzes = await db.quiz.findMany({
        where: {
          schoolId: student.schoolId,
          status: "OPEN",
          OR: [{ classId: student.classId }, { classId: null }],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const attempts = await db.quizAttempt.findMany({ where: { studentId: student.id }, select: { quizId: true, score: true, submittedAt: true } });
      const byQuiz = new Map(attempts.map((a) => [a.quizId, a]));
      return apiOk({
        quizzes: quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          durationMin: q.durationMin,
          questionCount: parseIds(q.questionIds).length,
          myScore: byQuiz.get(q.id)?.score ?? null,
          submitted: !!byQuiz.get(q.id)?.submittedAt,
        })),
      });
    }

    if (![...STAFF, "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const quizzes = await db.quiz.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        _count: { select: { attempts: true } },
        attempts: { select: { score: true, submittedAt: true } },
      },
    });
    // نام درس/کلاس/سازنده
    const subjectIds = [...new Set(quizzes.map((q) => q.subjectId).filter(Boolean))] as string[];
    const classIds = [...new Set(quizzes.map((q) => q.classId).filter(Boolean))] as string[];
    const [subjects, classes] = await Promise.all([
      subjectIds.length ? db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }) : ([] as Array<{ id: string; name: string }>),
      classIds.length ? db.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : ([] as Array<{ id: string; name: string }>),
    ]);
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const className = new Map(classes.map((c) => [c.id, c.name]));

    return apiOk({
      quizzes: quizzes.map((q) => {
        const submitted = q.attempts.filter((a) => a.submittedAt);
        const scored = submitted.filter((a) => a.score !== null);
        return {
          id: q.id,
          title: q.title,
          status: q.status,
          durationMin: q.durationMin,
          subjectName: q.subjectId ? subjectName.get(q.subjectId) ?? null : null,
          className: q.classId ? className.get(q.classId) ?? null : null,
          classId: q.classId,
          subjectId: q.subjectId,
          questionCount: parseIds(q.questionIds).length,
          questionIds: parseIds(q.questionIds),
          attempts: q._count.attempts,
          submittedCount: submitted.length,
          avgScore: scored.length ? Math.round((scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length) * 10) / 10 : null,
          createdAt: q.createdAt,
          mine: q.createdById === me.id,
        };
      }),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const body = await readJson<{
      title?: string;
      subjectId?: string | null;
      classId?: string | null;
      questionIds?: string[];
      durationMin?: number;
    }>(req);
    const title = String(body.title ?? "").trim().slice(0, 160);
    if (title.length < 3) return apiErr(400, "عنوان آزمون را وارد کنید.", "BAD_TITLE");
    const questionIds = [...new Set((body.questionIds ?? []).filter((x) => typeof x === "string"))].slice(0, 100);
    if (!questionIds.length) return apiErr(400, "حداقل یک سؤال از بانک سؤال انتخاب کنید.", "NO_QUESTIONS");
    const found = await db.question.count({ where: { id: { in: questionIds }, schoolId } });
    if (found !== questionIds.length) return apiErr(400, "بعضی سؤال‌های انتخاب‌شده یافت نشدند.", "BAD_QUESTIONS");
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } });
      if (!cls) return apiErr(400, "کلاس انتخاب‌شده معتبر نیست.", "BAD_CLASS");
    }

    const quiz = await db.quiz.create({
      data: {
        schoolId,
        title,
        subjectId: body.subjectId ?? null,
        classId: body.classId ?? null,
        questionIds: JSON.stringify(questionIds),
        durationMin: Math.min(180, Math.max(5, Math.floor(Number(body.durationMin) || 20))),
        status: "DRAFT",
        createdById: me.id,
      },
    });
    // شمارش استفادهٔ سؤال‌ها در بانک
    await db.question.updateMany({ where: { id: { in: questionIds } }, data: { usageCount: { increment: 1 } } });
    await audit({ user: me, action: "ساخت آزمون آنلاین", entityType: "Quiz", entityId: quiz.id, meta: { title } });
    return apiOk({ quiz });
  } catch (e) {
    return handleApiError(e);
  }
}

async function loadManageable(req: NextRequest, id: string) {
  const me = await requireUser(req);
  const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
  const quiz = await db.quiz.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) } });
  if (!quiz) return { error: apiErr(404, "آزمون یافت نشد.", "NOT_FOUND") } as const;
  const isManager = me.role === "MANAGER" || me.role === "DEPUTY" || me.role === "SUPER_ADMIN";
  if (quiz.createdById !== me.id && !isManager) {
    return { error: apiErr(403, "فقط سازنده یا مدیر می‌تواند این آزمون را تغییر دهد.", "FORBIDDEN") } as const;
  }
  return { me, quiz } as const;
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await readJson<{ id?: string; status?: string; title?: string; durationMin?: number }>(req);
    const loaded = await loadManageable(req, body.id ?? "");
    if ("error" in loaded) return loaded.error;
    const { me, quiz } = loaded;
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;

    const data: Record<string, unknown> = {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
      data.status = body.status;
    }
    if (body.title !== undefined) {
      const t = String(body.title).trim().slice(0, 160);
      if (t.length >= 3) data.title = t;
    }
    if (body.durationMin !== undefined) data.durationMin = Math.min(180, Math.max(5, Math.floor(Number(body.durationMin) || 20)));
    const updated = await db.quiz.update({ where: { id: quiz.id }, data });
    await audit({ user: me, action: "ویرایش آزمون آنلاین", entityType: "Quiz", entityId: quiz.id, meta: { status: body.status } });
    return apiOk({ quiz: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const loaded = await loadManageable(req, id);
    if ("error" in loaded) return loaded.error;
    const { me, quiz } = loaded;
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    await db.quiz.delete({ where: { id: quiz.id } });
    await audit({ user: me, action: "حذف آزمون آنلاین", entityType: "Quiz", entityId: quiz.id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
