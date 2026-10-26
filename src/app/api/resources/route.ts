import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock } from "@/lib/api";

/** GET /api/resources — منابع آموزشی (فیلتر: subjectId/kind/grade) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const subjectId = url.searchParams.get("subjectId");
    const kind = url.searchParams.get("kind");
    const grade = url.searchParams.get("grade");
    const where: Record<string, unknown> = {};
    // کاربران غیرسرویسی فقط مدرسه خودش را می‌بینند؛ بدون مدرسه → بدون داده
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    if (!isService) {
      if (!me.schoolId) return apiOk({ resources: [], subjects: [] });
      where.schoolId = me.schoolId;
    }
    if (subjectId) where.subjectId = subjectId;
    if (kind) where.kind = kind;
    if (grade) where.grade = grade;

    const [resources, subjects] = await Promise.all([
      db.resourceLink.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          subject: { select: { name: true } },
          addedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      me.schoolId
        ? db.subject.findMany({ where: { schoolId: me.schoolId }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    return apiOk({ resources, subjects });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/resources — افزودن منبع (معلم/مدیر/ادمین) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      title: string;
      url: string;
      description?: string;
      subjectId?: string;
      grade?: string;
      topic?: string;
      kind: string;
    }>(req);
    if (!body.title?.trim() || !body.url?.trim()) return apiErr(400, "عنوان و لینک لازم است.", "BAD_REQUEST");
    let url: URL;
    try {
      url = new URL(body.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return apiErr(400, "لینک نامعتبر است (باید با http/https شروع شود).", "BAD_URL");
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
    const resource = await db.resourceLink.create({
      data: {
        schoolId: me.schoolId,
        subjectId: body.subjectId || null,
        grade: body.grade || null,
        topic: body.topic || null,
        title: body.title,
        url: url.toString(),
        description: body.description ?? null,
        kind: ["VIDEO", "ARTICLE", "BOOK", "SITE", "PRACTICE"].includes(body.kind) ? body.kind : "ARTICLE",
        addedById: me.id,
      },
    });
    await audit({ user: me, action: "افزودن منبع آموزشی", entityType: "ResourceLink", entityId: resource.id, meta: { title: body.title } });
    return apiOk({ resource });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/resources?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const r = await db.resourceLink.findUnique({ where: { id } });
    if (!r) return apiErr(404, "منبع یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && r.schoolId !== me.schoolId) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.resourceLink.delete({ where: { id } });
    await audit({ user: me, action: "حذف منبع آموزشی", entityType: "ResourceLink", entityId: id, schoolId: r.schoolId, meta: { title: r.title } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
