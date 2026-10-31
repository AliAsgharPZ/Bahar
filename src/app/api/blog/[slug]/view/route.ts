import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, ApiError, rateLimit, ipOf } from "@/lib/api";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/blog/[slug]/view — ثبت بازدید پست (تنها مسیر تغییر شمارنده؛ GET فقط می‌خواند) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    // سقف نرخ: حداکثر ۱۰ ثبت بازدید در ۱۰ دقیقه از هر IP برای هر پست
    if (!rateLimit(`blogview:${ipOf(req)}:${slug}`, 10, 10 * 60_000)) {
      return apiErr(429, "ثبت بازدید بیش از حد مجاز است.", "RATE_LIMITED");
    }
    const post = await db.blogPost.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!post || post.status !== "PUBLISHED") {
      throw new ApiError(404, "NOT_FOUND", "پست یافت نشد.");
    }
    const updated = await db.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    return apiOk({ viewCount: updated.viewCount });
  } catch (e) {
    return handleApiError(e);
  }
}
