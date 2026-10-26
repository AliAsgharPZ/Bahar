import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser } from "@/lib/api";
import { hasPermission } from "@/lib/roles";
import { slugify } from "@/lib/persian";

// ============================================================
// مدیریت بلاگ — فهرست همه پست‌ها + کامنت‌ها + ویرایش/حذف
// ============================================================

/** GET /api/blog/admin — همه پست‌ها (پیش‌نویس + منتشر) + کامنت‌های در انتظار */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role !== "SUPER_ADMIN" && !hasPermission(me, "manage_blog")) {
      throw new ApiError(403, "FORBIDDEN", "مدیریت بلاگ برای شما فعال نیست.");
    }
    const posts = await db.blogPost.findMany({
      include: {
        author: { select: { firstName: true, lastName: true } },
        comments: { orderBy: { createdAt: "desc" }, take: 50 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return apiOk({
      posts: posts.map((p) => ({
        ...p,
        tags: JSON.parse(p.tags) as string[],
        comments: p.comments,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/blog/admin — ویرایش پست/انتشار/کامنت */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !hasPermission(me, "manage_blog")) {
      throw new ApiError(403, "FORBIDDEN", "مدیریت بلاگ برای شما فعال نیست.");
    }
    const body = await readJson<Record<string, unknown>>(req);

    // تایید/رد کامنت
    if (body.commentId !== undefined) {
      const comment = await db.blogComment.findUnique({ where: { id: String(body.commentId) } });
      if (!comment) throw new ApiError(404, "NOT_FOUND", "کامنت یافت نشد.");
      if (body.commentAction === "delete") {
        await db.blogComment.delete({ where: { id: comment.id } });
      } else {
        await db.blogComment.update({ where: { id: comment.id }, data: { approved: body.commentAction === "approve" } });
      }
      await audit({ user: me, action: "MODERATE_COMMENT", entityType: "BLOG_COMMENT", entityId: comment.id, meta: { action: String(body.commentAction) } });
      return apiOk({ ok: true });
    }

    // ویرایش پست
    const postId = String(body.id ?? "");
    const post = await db.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.excerpt !== undefined) data.excerpt = String(body.excerpt).slice(0, 300);
    if (body.body !== undefined) data.body = String(body.body);
    if (body.coverUrl !== undefined) data.coverUrl = String(body.coverUrl) || null;
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      data.tags = JSON.stringify((body.tags as string[]).slice(0, 6));
    }
    if (body.publish !== undefined) {
      const publish = Boolean(body.publish);
      data.status = publish ? "PUBLISHED" : "DRAFT";
      if (publish && !post.publishedAt) data.publishedAt = new Date();
    }
    if (Object.keys(data).length) {
      await db.blogPost.update({ where: { id: postId }, data });
    }
    await audit({ user: me, action: "UPDATE_BLOG_POST", entityType: "BLOG_POST", entityId: postId, meta: { fields: Object.keys(data) } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/blog/admin?id= — حذف پست */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !hasPermission(me, "manage_blog")) {
      throw new ApiError(403, "FORBIDDEN", "مدیریت بلاگ برای شما فعال نیست.");
    }
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");
    await db.blogPost.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_BLOG_POST", entityType: "BLOG_POST", entityId: id, meta: { title: post.title } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/blog/admin — ویرایش کامل پست (برای ادیتور) */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !hasPermission(me, "manage_blog")) {
      throw new ApiError(403, "FORBIDDEN", "مدیریت بلاگ برای شما فعال نیست.");
    }
    const body = await readJson<Record<string, unknown>>(req);
    const postId = String(body.id ?? "");
    const post = await db.blogPost.findUnique({ where: { id: postId } });
    if (!post) throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (title.length < 3) throw new ApiError(400, "BAD_TITLE", "عنوان کوتاه است.");
      data.title = title;
    }
    if (body.slug !== undefined) {
      const s = slugify(String(body.slug));
      if (s && s !== post.slug) {
        const dupe = await db.blogPost.findUnique({ where: { slug: s } });
        if (dupe) throw new ApiError(409, "DUPLICATE", "این نامک قبلاً استفاده شده است.");
        data.slug = s;
      }
    }
    if (body.excerpt !== undefined) data.excerpt = String(body.excerpt).slice(0, 300);
    if (body.body !== undefined) data.body = String(body.body);
    if (body.coverUrl !== undefined) data.coverUrl = String(body.coverUrl) || null;
    if (Array.isArray(body.tags)) data.tags = JSON.stringify((body.tags as string[]).slice(0, 6));
    if (body.publish !== undefined) {
      const publish = Boolean(body.publish);
      data.status = publish ? "PUBLISHED" : "DRAFT";
      if (publish && !post.publishedAt) data.publishedAt = new Date();
    }
    await db.blogPost.update({ where: { id: postId }, data });
    await audit({ user: me, action: "UPDATE_BLOG_POST", entityType: "BLOG_POST", entityId: postId, meta: { fields: Object.keys(data) } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
