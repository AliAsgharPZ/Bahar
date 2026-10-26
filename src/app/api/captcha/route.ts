import { NextRequest, NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/captcha";
import { apiErr, handleApiError, rateLimit, ipOf } from "@/lib/api";

/**
 * GET /api/captcha — چالش کپچای امن (SVG فارسی اعوجاج‌دار).
 * برای لاگین پس از تلاش‌های ناموفق و نقاط حساس با رفتار مشکوک.
 * محدودیت نرخ دارد تا خودش هدف اسپم نشود.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = ipOf(req);
    if (!rateLimit(`captcha:${ip}`, 30, 60_000)) {
      return apiErr(429, "درخواست کد امنیتی بیش از حد مجاز است؛ کمی صبر کنید.", "RATE_LIMITED");
    }
    const ch = generateCaptcha();
    return NextResponse.json({ ok: true, ...ch });
  } catch (e) {
    return handleApiError(e);
  }
}
