import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, ApiError, isDemoUser , audit } from "@/lib/api";
import { slugify, enDigits } from "@/lib/persian";
import { requireUser, demoWriteBlock } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

// ============================================================
// بلاگ — GET عمومی پست‌های منتشرشده؛ POST ساخت توسط ادمین
// ============================================================

/** GET /api/blog?tag=&q=&page= — فهرست پست‌های منتشرشده (عمومی) */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const tag = searchParams.get("tag")?.trim();

    const where: Record<string, unknown> = { status: "PUBLISHED" };
    if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];
    // FIX (راند ۱۶): تطابق دقیق تگ — قبلاً «آموزش» با «آموزشگاه» هم مطابق می‌شد
    if (tag) where.tags = { contains: `"${tag.replace(/"/g, "")}"` };

    const posts = await db.blogPost.findMany({
      where,
      select: {
        id: true, title: true, slug: true, excerpt: true, coverUrl: true,
        tags: true, publishedAt: true, viewCount: true, author: { select: { firstName: true, lastName: true } },
        _count: { select: { comments: { where: { approved: true } } } },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    return apiOk({
      posts: posts.map((p) => ({
        ...p,
        tags: JSON.parse(p.tags) as string[],
        commentCount: p._count.comments,
        _count: undefined,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/blog — ساخت پست جدید (ادمین با manage_blog) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !hasPermission(me, "manage_blog")) {
      throw new ApiError(403, "FORBIDDEN", "مدیریت بلاگ برای شما فعال نیست.");
    }
    const body = await readJson<Record<string, string | string[] | boolean>>(req);
    const title = String(body.title ?? "").trim();
    const content = String(body.body ?? "").trim();
    if (title.length < 3) throw new ApiError(400, "BAD_TITLE", "عنوان پست الزامی است.");
    if (content.length < 20) throw new ApiError(400, "BAD_BODY", "متن پست حداقل ۲۰ نویسه باشد.");

    let slug = body.slug ? slugify(String(body.slug)) : slugify(title);
    if (!slug || slug === "school") slug = `post-${Date.now().toString(36)}`;
    const dupe = await db.blogPost.findUnique({ where: { slug } });
    if (dupe) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const tags = Array.isArray(body.tags)
      ? (body.tags as string[]).map((t) => enDigits(String(t)).trim()).filter(Boolean).slice(0, 6)
      : [];

    const post = await db.blogPost.create({
      data: {
        title,
        slug,
        excerpt: body.excerpt ? String(body.excerpt).slice(0, 300) : content.slice(0, 180),
        body: content,
        coverUrl: body.coverUrl ? String(body.coverUrl) : null,
        tags: JSON.stringify(tags),
        status: body.publish === true ? "PUBLISHED" : "DRAFT",
        authorId: me.id,
        publishedAt: body.publish === true ? new Date() : null,
      },
    });
    await audit({ user: me, action: "CREATE_BLOG_POST", entityType: "BLOG_POST", entityId: post.id, meta: { title: post.title } });

    return apiOk({ ok: true, post: { id: post.id, slug: post.slug } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const post = await db.blogPost.findUnique({ where: { id } });
    if (!post) throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");
    // فقط نویسندهٔ پست یا ادمین سرویس می‌تواند حذف کند
    if (post.authorId !== me.id && me.role !== "SUPER_ADMIN") throw new ApiError(403, "FORBIDDEN", "فقط نویسندهٔ پست می‌تواند آن را حذف کند.");
    await db.blogPost.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_BLOG_POST", entityType: "BLOG_POST", entityId: id, meta: { title: post.title } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
