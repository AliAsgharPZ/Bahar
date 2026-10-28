import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { enDigits } from "@/lib/persian";

/* ============================================================
   بهار | آزمون آنلاین — جزئیات/شرکت/تحویل
   GET  /api/quizzes/[id]   کادر: سؤال‌ها با پاسخ + فهرست تلاش‌ها
                            دانش‌آموز: سؤال‌ها بدون پاسخ (تا پیش از
                            تحویل) + وضعیت تلاش خودش
   POST /api/quizzes/[id]   action=start | submit (دانش‌آموز)
   ============================================================ */

type Ctx = { params: Promise<{ id: string }> };

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function parseOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}
function parseAnswers(raw: string): Record<string, string> {
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = String(val ?? "");
      return out;
    }
  } catch { /* fallthrough */ }
  return {};
}
/** نرمال‌سازی پاسخ برای مقایسه: ارقام لاتین، فاصلهٔ یکدست، بی‌حروف بزرگ/کوچک */
function norm(s: string | null | undefined): string {
  return enDigits(String(s ?? "")).trim().replace(/\s+/g, " ").toLowerCase();
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const quiz = await db.quiz.findUnique({ where: { id } });
    if (!quiz) return apiErr(404, "آزمون یافت نشد.", "NOT_FOUND");
    const questionIds = parseIds(quiz.questionIds);
    const questions = questionIds.length
      ? await db.question.findMany({ where: { id: { in: questionIds } } })
      : [];
    const byId = new Map<string, any>(questions.map((q) => [q.id, q]));
    const ordered = questionIds.map((qid) => byId.get(qid)).filter(Boolean);

    const isStaff = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (isStaff) {
      if (schoolId && quiz.schoolId !== schoolId && me.role !== "SUPER_ADMIN") {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
      const attempts = await db.quizAttempt.findMany({
        where: { quizId: quiz.id },
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
        take: 500,
        include: { student: { select: { class: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } } },
      });
      return apiOk({
        quiz: { id: quiz.id, title: quiz.title, status: quiz.status, durationMin: quiz.durationMin, classId: quiz.classId, subjectId: quiz.subjectId },
        questions: ordered.map((q) => ({
          id: q!.id, body: q!.body, kind: q!.kind, difficulty: q!.difficulty,
          options: parseOptions(q!.options), answer: q!.answer, explanation: q!.explanation, imageUrl: q!.imageUrl,
        })),
        attempts: attempts.map((a) => ({
          id: a.id,
          studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
          className: a.student.class?.name ?? "—",
          score: a.score,
          submittedAt: a.submittedAt,
          startedAt: a.startedAt,
        })),
      });
    }

    if (me.role !== "STUDENT") return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const student = await db.student.findFirst({ where: { userId: me.id }, select: { id: true, classId: true, schoolId: true } });
    if (!student || student.schoolId !== quiz.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (quiz.classId && quiz.classId !== student.classId) return apiErr(403, "این آزمون برای کلاس شما نیست.", "FORBIDDEN");

    const attempt = await db.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId: student.id } } });
    const submitted = !!attempt?.submittedAt;
    if (quiz.status !== "OPEN" && !attempt) return apiErr(403, "این آزمون باز نیست.", "NOT_OPEN");
    const myAnswers = attempt ? parseAnswers(attempt.answers) : {};

    return apiOk({
      quiz: { id: quiz.id, title: quiz.title, status: quiz.status, durationMin: quiz.durationMin },
      attempt: attempt
        ? { startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, score: attempt.score, answers: submitted ? myAnswers : {} }
        : null,
      questions: ordered.map((q) => {
        const base = {
          id: q!.id, body: q!.body, kind: q!.kind, difficulty: q!.difficulty,
          options: parseOptions(q!.options), imageUrl: q!.imageUrl,
        };
        if (!submitted) return base;
        const gradable = (q!.kind === "MULTI" || q!.kind === "FILL") && !!q!.answer;
        return {
          ...base,
          myAnswer: myAnswers[q!.id] ?? "",
          correctAnswer: q!.answer,
          explanation: q!.explanation,
          correct: gradable ? norm(myAnswers[q!.id]) === norm(q!.answer) : null,
        };
      }),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    if (me.role !== "STUDENT") return apiErr(403, "فقط دانش‌آموز می‌تواند در آزمون شرکت کند.", "FORBIDDEN");
    const { id } = await ctx.params;
    const quiz = await db.quiz.findUnique({ where: { id } });
    if (!quiz) return apiErr(404, "آزمون یافت نشد.", "NOT_FOUND");
    const student = await db.student.findFirst({ where: { userId: me.id }, select: { id: true, classId: true, schoolId: true } });
    if (!student || student.schoolId !== quiz.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (quiz.classId && quiz.classId !== student.classId) return apiErr(403, "این آزمون برای کلاس شما نیست.", "FORBIDDEN");

    const body = await readJson<{ action?: string; answers?: Record<string, string> }>(req);
    const existing = await db.quizAttempt.findUnique({ where: { quizId_studentId: { quizId: quiz.id, studentId: student.id } } });

    if (body.action === "start") {
      if (quiz.status !== "OPEN") return apiErr(400, "این آزمون باز نیست.", "NOT_OPEN");
      if (existing?.submittedAt) return apiErr(400, "این آزمون را قبلاً تحویل داده‌اید.", "ALREADY_SUBMITTED");
      const attempt = existing ?? (await db.quizAttempt.create({ data: { quizId: quiz.id, studentId: student.id } }));
      return apiOk({ attempt: { startedAt: attempt.startedAt, submittedAt: attempt.submittedAt } });
    }

    if (body.action === "submit") {
      if (!existing) return apiErr(400, "ابتدا آزمون را شروع کنید.", "NOT_STARTED");
      if (existing.submittedAt) return apiErr(400, "این آزمون قبلاً تحویل داده شده است.", "ALREADY_SUBMITTED");
      const answersIn = body.answers ?? {};
      const questionIds = parseIds(quiz.questionIds);
      const questions = questionIds.length ? await db.question.findMany({ where: { id: { in: questionIds } } }) : [];
      const answers: Record<string, string> = {};
      let gradable = 0;
      let correct = 0;
      for (const q of questions) {
        const given = String(answersIn[q.id] ?? "").slice(0, 2000);
        answers[q.id] = given;
        if ((q.kind === "MULTI" || q.kind === "FILL") && q.answer) {
          gradable += 1;
          if (norm(given) === norm(q.answer)) correct += 1;
        }
      }
      const score = gradable > 0 ? Math.round((correct / gradable) * 1000) / 10 : null;
      const updated = await db.quizAttempt.update({
        where: { id: existing.id },
        data: { answers: JSON.stringify(answers), score, submittedAt: new Date() },
      });
      await audit({ user: me, action: "تحویل آزمون آنلاین", entityType: "Quiz", entityId: quiz.id, meta: { score } });
      return apiOk({ attempt: { submittedAt: updated.submittedAt, score: updated.score }, gradable, correct });
    }

    return apiErr(400, "action نامعتبر است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
