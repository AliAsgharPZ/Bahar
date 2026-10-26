import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock } from "@/lib/api";

/** GET /api/question-bank — فیلتر: subjectId/difficulty/kind/grade/topic/q */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subjectId");
    const difficulty = url.searchParams.get("difficulty");
    const kind = url.searchParams.get("kind");
    const grade = url.searchParams.get("grade");
    const topic = url.searchParams.get("topic");
    const q = url.searchParams.get("q");

    const where: Record<string, unknown> = { schoolId: me.role === "SUPER_ADMIN" ? undefined : me.schoolId ?? "" };
    if (subjectId) where.subjectId = subjectId;
    if (difficulty && ["EASY", "MEDIUM", "HARD"].includes(difficulty)) where.difficulty = difficulty;
    if (kind && ["MULTI", "SHORT", "ESSAY", "FILL"].includes(kind)) where.kind = kind;
    if (grade) where.grade = grade;
    if (topic) where.topic = { contains: topic };
    if (q) where.OR = [{ body: { contains: q } }, { topic: { contains: q } }];

    const [questions, subjects] = await Promise.all([
      db.question.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          subject: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      db.subject.findMany({
        where: { schoolId: me.role === "SUPER_ADMIN" ? undefined : me.schoolId ?? "" },
        select: { id: true, name: true, grade: true },
      }),
    ]);
    return apiOk({ questions, subjects });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/question-bank — سوال جدید */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      subjectId?: string;
      grade?: string;
      topic: string;
      difficulty: string;
      kind: string;
      body: string;
      options?: string[];
      answer?: string;
      explanation?: string;
      imageUrl?: string;
    }>(req);
    if (!body.body?.trim() || !body.topic?.trim()) {
      return apiErr(400, "متن سوال و مبحث لازم است.", "BAD_REQUEST");
    }
    // FIX (راند ۱۶): نقش خدماتی بدون مدرسه فعال → 400 به‌جای خطای FK دیتابیس
    if (!me.schoolId) {
      return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");
    }
    // درس باید متعلق به همان مدرسه باشد
    if (body.subjectId) {
      const subjOk = await db.subject.findFirst({ where: { id: body.subjectId, schoolId: me.schoolId }, select: { id: true } });
      if (!subjOk) return apiErr(400, "درس انتخاب‌شده معتبر نیست.", "BAD_SUBJECT");
    }
    const question = await db.question.create({
      data: {
        schoolId: me.schoolId,
        subjectId: body.subjectId || null,
        grade: body.grade || null,
        topic: body.topic,
        difficulty: ["EASY", "MEDIUM", "HARD"].includes(body.difficulty) ? body.difficulty : "MEDIUM",
        kind: ["MULTI", "SHORT", "ESSAY", "FILL"].includes(body.kind) ? body.kind : "MULTI",
        body: body.body,
        options: JSON.stringify(body.options ?? []),
        answer: body.answer ?? null,
        explanation: body.explanation ?? null,
        imageUrl: body.imageUrl ?? null,
        createdById: me.id,
      },
    });
    await audit({ user: me, action: "افزودن سوال به بانک", entityType: "Question", entityId: question.id, meta: { topic: body.topic } });
    return apiOk({ question });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/question-bank?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const q = await db.question.findUnique({ where: { id } });
    if (!q) return apiErr(404, "سوال یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && q.schoolId !== me.schoolId) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.question.delete({ where: { id } });
    await audit({ user: me, action: "حذف سوال از بانک", entityType: "Question", entityId: id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
