import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiErr, handleApiError, readJson, rateLimit, ipOf, audit, failGet, failIncr, failReset } from "@/lib/api";
import { verifyPassword, hashPassword, sessionCookie, signToken } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { getSettings } from "@/lib/settings";
import { verifyOtpPending, issueOtp, checkOtp } from "@/lib/otp";

/* ============================================================
   بهار | مرحلهٔ OTP ورود (راند ۱۸)
   POST /api/auth/otp  { pendingToken, code }  → تأیید کد و صدور نشست
   POST /api/auth/otp  { pendingToken, resend: true } → ارسال مجدد کد
   بعد از تأیید OTP، اگر 2FA هم فعال باشد → توکن مرحلهٔ بعد برگردانده می‌شود.
   راند ۱۹: تشدید کپچا — پس از ۲ کد اشتباه پیاپی، ادامهٔ تلاش‌ها کپچا می‌خواهد
   (ضد بروت‌فورس شش‌رقمی؛ همان الگوی لاگین).
   ============================================================ */

const DUMMY_HASH = hashPassword("bahar-otp-timing-equalizer");
const CAPTCHA_AFTER_OTP_FAILS = 2;

export async function POST(req: NextRequest) {
  try {
    const ip = ipOf(req);
    if (!rateLimit(`otp:${ip}`, 15, 60_000)) {
      return apiErr(429, "درخواست‌های زیاد — کمی صبر کنید.", "RATE_LIMITED");
    }
    const body = await readJson<{ pendingToken?: string; code?: string; resend?: boolean; captchaToken?: string; captchaAnswer?: string }>(req);
    const userId = verifyOtpPending(body.pendingToken);
    if (!userId) {
      return apiErr(401, "نشست تأیید منقضی شده است؛ دوباره وارد شوید.", "OTP_EXPIRED");
    }
    const settings = await getSettings();
    if (!settings.otpEnabled) {
      return apiErr(400, "ورود دومرحله‌ای با کد یکبارمصرف توسط مدیر سامانه خاموش شده است.", "OTP_DISABLED");
    }
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      verifyPassword("x", DUMMY_HASH); // برابری زمانی
      return apiErr(401, "حساب کاربر غیرفعال یا حذف شده است.", "UNAUTHORIZED");
    }

    /* ── ارسال مجدد ── */
    if (body.resend === true) {
      const r = await issueOtp(
        { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
        settings
      );
      if (!r.ok) return apiErr(400, r.error ?? "ارسال مجدد ناموفق بود.", "OTP_RESEND_FAILED");
      return NextResponse.json({
        ok: true,
        resent: true,
        maskedTo: r.maskedTo,
      });
    }

    /* ── تأیید کد ── */
    const code = String(body.code ?? "").replace(/[^0-9]/g, "");
    if (code.length !== 6) {
      return apiErr(400, "کد ۶ رقمی را وارد کنید.", "BAD_CODE");
    }

    /* راند ۱۹ — رفتار مشکوک: کدهای اشتباه پیاپی → کپچای اجباری پیش از بررسی کد
       تا موتور حدس شش‌رقمی بدون حل کپچا نتواند ادامه دهد. */
    if (failGet(`otpfail:${user.id}`) >= CAPTCHA_AFTER_OTP_FAILS) {
      const cv = verifyCaptcha(body.captchaToken, body.captchaAnswer);
      if (!cv.ok) {
        const why =
          cv.reason === "WRONG"
            ? "پاسخ کد امنیتی نادرست است."
            : cv.reason === "REUSED" || cv.reason === "EXPIRED_OR_INVALID"
              ? "کد امنیتی منقضی یا استفاده‌شده است؛ کد جدید بگیرید."
              : "برای ادامه، کد امنیتی را پاسخ دهید.";
        return apiErr(401, why, "CAPTCHA_REQUIRED", { captchaRequired: true });
      }
    }

    const check = checkOtp(user.id, code);
    if (!check.ok) {
      const otpFails = failIncr(`otpfail:${user.id}`);
      return apiErr(401, check.error ?? "کد نامعتبر است.", "OTP_WRONG", {
        captchaRequired: otpFails >= CAPTCHA_AFTER_OTP_FAILS,
      });
    }
    failReset(`otpfail:${user.id}`);

    // ── OTP تأیید شد؛ اگر 2FA هم فعال است → مرحلهٔ بعد ──
    if (user.twoFactorEnabled) {
      const { signPendingToken } = await import("@/lib/twofactor");
      await db.loginEvent.create({
        data: { userId: user.id, nationalId: user.nationalId, ip, userAgent: req.headers.get("user-agent") ?? "", status: "SUCCESS", note: "OTP تأیید شد — در انتظار کد دو مرحله‌ای" },
      }).catch(() => {});
      return NextResponse.json({ ok: true, requires2fa: true, pendingToken: signPendingToken(user.id) });
    }

    // ── صدور نشست (همان منطق پایان ورود) ──
    const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion }, settings.sessionDays);
    await db.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
        schoolId: user.schoolId,
      },
    });
    res.headers.append("Set-Cookie", sessionCookie(token, settings.sessionDays));
    await db.loginEvent.create({ data: { userId: user.id, nationalId: user.nationalId, ip, userAgent: req.headers.get("user-agent") ?? "", status: "SUCCESS", note: "ورود با OTP" } }).catch(() => {});
    await audit({
      user: { id: user.id, role: user.role, permissions: [], firstName: user.firstName, lastName: user.lastName, schoolId: user.schoolId, nationalId: user.nationalId, mustChangePassword: user.mustChangePassword, isActive: user.isActive, shadNumber: user.shadNumber },
      action: "LOGIN_OTP",
      entityType: "USER",
      entityId: user.id,
      ip,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
