import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, rateLimit } from "@/lib/api";
import { shadSendCode } from "@/lib/shad";
import { isValidShadNumber } from "@/lib/auth";
import { enDigits } from "@/lib/persian";

/**
 * POST /api/shad/send-code — auth.sendCode (شبیه‌سازی داخلی)
 * ارسال کد تایید ۵ رقمی به شماره شاد مدیر مدرسه؛ کد برای نمایش
 * به خود مدیر برگردانده می‌شود (معادل رسیدن کد به اپ شاد او).
 */
export async function POST(req: NextRequest) {
  try {
    /* FIX (راند ۱۹-a): نقش سرویس (سوپرادمین/ادمین) داخل «پنل مدرسه» هم باید
       بتواند دروازه شاد مدرسهٔ فعال را وصل کند — me.schoolId با کوکی
       bahar_acting_school ادغام شده؛ نقش سرویسِ خارج از پنل مدرسه‌ای ندارد
       و همان مسیر NO_SCHOOL پاسخ می‌گیرد. */
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    if (!me.schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");

    const school = await db.school.findUnique({
      where: { id: me.schoolId },
      select: { shadEnabled: true },
    });
    // راند ۱۸: شاد اختیاری است — مدرسه می‌تواند خاموشش کرده باشد
    if (school && school.shadEnabled === false) {
      return apiErr(403, "قابلیت شاد در این مدرسه غیرفعال شده است.", "SHAD_DISABLED");
    }
    // ضد اسپم: حداکثر ۱۰ کد در هر ۱۰ دقیقه برای هر مدیر
    if (!rateLimit(`shad-code:${me.id}`, 10, 10 * 60_000)) {
      return apiErr(429, "درخواست کد تایید بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.", "RATE_LIMITED");
    }

    const body = await readJson<{ phone?: string }>(req);
    const phone = enDigits(String(body.phone ?? "")).trim();
    if (!isValidShadNumber(phone)) {
      return apiErr(400, "شماره شاد مدیر (موبایل ۰۹…) نامعتبر است.", "BAD_PHONE");
    }

    const res = await shadSendCode(me.schoolId, phone, me.id);
    await audit({
      user: me, action: "SHAD_SEND_CODE", entityType: "SHAD_SESSION",
      meta: { phone }, schoolId: me.schoolId,
    });
    // در نسخهٔ شبیه‌سازی‌شده، کد «به اپ شاد مدیر رسیده» و همین‌جا نمایش داده می‌شود
    return apiOk({ ok: true, phone, code: res.code, expiresAt: res.expiresAt });
  } catch (e) {
    return handleApiError(e);
  }
}
