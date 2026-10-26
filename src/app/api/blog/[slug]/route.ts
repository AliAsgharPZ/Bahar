import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, ApiError, rateLimit, ipOf } from "@/lib/api";
import { enDigits } from "@/lib/persian";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/blog/[slug] — نمایش پست منتشرشده + کامنت‌های تاییدشده (عمومی) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const post = await db.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post || post.status !== "PUBLISHED") {
      throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");
    }

    await db.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
    const comments = await db.blogComment.findMany({
      where: { postId: post.id, approved: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiOk({
      post: {
        ...post,
        viewCount: post.viewCount + 1,
        tags: JSON.parse(post.tags) as string[],
        comments: comments.map((c) => ({ name: c.name, body: c.body, createdAt: c.createdAt })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/blog/[slug] — ثبت نظر عمومی (در انتظار تایید) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    // محدودیت نرخ نظر: حداکثر ۵ نظر در ۱۰ دقیقه از هر IP
    if (!rateLimit(`comment:${ipOf(req)}`, 5, 10 * 60_000)) {
      return apiErr(429, "نظرات شما بیش از حد مجاز است؛ کمی بعد تلاش کنید.", "RATE_LIMITED");
    }
    const { slug } = await ctx.params;
    const post = await db.blogPost.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!post || post.status !== "PUBLISHED") {
      throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");
    }

    const body = await readJson<{ name?: string; body?: string }>(req);
    const name = String(body.name ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (name.length < 2) throw new ApiError(400, "BAD_NAME", "نام خود را وارد کنید.");
    if (text.length < 3 || text.length > 1000) throw new ApiError(400, "BAD_BODY", "متن نظر ۳ تا ۱۰۰۰ نویسه باشد.");

    // ضد هرزنامه
    const hour = new Date(Date.now() - 3600000);
    const recent = await db.blogComment.count({ where: { name, createdAt: { gte: hour } } });
    if (recent >= 3) throw new ApiError(429, "TOO_MANY", "نظرات زیاد؛ کمی بعد دوباره تلاش کنید.");

    await db.blogComment.create({
      data: { postId: post.id, name: enDigits(name), body: text },
    });
    return apiOk({ ok: true, pending: true });
  } catch (e) {
    return handleApiError(e);
  }
}
