import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, rateLimit } from "@/lib/api";
import { shadSignIn, ShadApiError } from "@/lib/shad";
import { isValidShadNumber } from "@/lib/auth";
import { enDigits } from "@/lib/persian";

/**
 * POST /api/shad/sign-in — auth.signIn (شبیه‌سازی داخلی)
 * ورود به حساب شاد مدیر مدرسه با کد تایید ۵ رقمی → نشست AUTHORIZED (۳۰ روز).
 */
export async function POST(req: NextRequest) {
  try {
    /* FIX (راند ۱۹-a): مثل send-code — سوپرادمین/ادمین داخل «پنل مدرسه» (me.schoolId
       ادغام‌شده با bahar_acting_school) می‌توانند با کد تایید وارد حساب شاد شوند؛
       نقش سرویسِ خارج از پنل همان مسیر NO_SCHOOL را می‌گیرد. */
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
    // ضد بروت‌فورس کد: سقف تلاش برای هر مدرسه در ۱۰ دقیقه
    if (!rateLimit(`shad-signin:${me.schoolId}`, 20, 10 * 60_000)) {
      return apiErr(429, "تلاش‌های ورود بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید.", "RATE_LIMITED");
    }

    const body = await readJson<{ phone?: string; code?: string }>(req);
    const phone = enDigits(String(body.phone ?? "")).trim();
    const code = enDigits(String(body.code ?? "")).trim();
    if (!isValidShadNumber(phone)) {
      return apiErr(400, "شماره شاد مدیر (موبایل ۰۹…) نامعتبر است.", "BAD_PHONE");
    }
    if (!/^\d{5}$/.test(code)) {
      return apiErr(400, "کد تایید باید ۵ رقم باشد.", "BAD_CODE");
    }

    try {
      const res = await shadSignIn(me.schoolId, phone, code, `${me.firstName} ${me.lastName}`);
      await audit({
        user: me, action: "SHAD_SIGN_IN", entityType: "SHAD_SESSION",
        meta: { phone }, schoolId: me.schoolId,
      });
      return apiOk({ ok: true, apiSessionId: res.apiSessionId });
    } catch (e) {
      if (e instanceof ShadApiError) {
        return apiErr(400, e.message, e.code);
      }
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
