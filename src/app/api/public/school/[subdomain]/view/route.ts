import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, ApiError, rateLimit, ipOf } from "@/lib/api";

type Ctx = { params: Promise<{ subdomain: string }> };

/** POST /api/public/school/[subdomain]/view — ثبت بازدید سایت مدرسه (تنها مسیر تغییر شمارنده؛ GET فقط می‌خواند) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { subdomain } = await ctx.params;
    // سقف نرخ: حداکثر ۱۰ ثبت بازدید در ۱۰ دقیقه از هر IP برای هر سایت
    if (!rateLimit(`siteview:${ipOf(req)}:${subdomain}`, 10, 10 * 60_000)) {
      return apiErr(429, "ثبت بازدید بیش از حد مجاز است.", "RATE_LIMITED");
    }
    const site = await db.schoolSite.findUnique({
      where: { subdomain },
      select: { id: true, published: true, school: { select: { isActive: true } } },
    });
    if (!site || !site.published) {
      throw new ApiError(404, "NOT_FOUND", "سایت مدرسه یافت نشد یا منتشر نیست.");
    }
    if (!site.school.isActive) {
      throw new ApiError(410, "INACTIVE", "این مدرسه غیرفعال شده است.");
    }
    const updated = await db.schoolSite.update({
      where: { id: site.id },
      data: { views: { increment: 1 } },
      select: { views: true },
    });
    return apiOk({ views: updated.views });
  } catch (e) {
    return handleApiError(e);
  }
}
