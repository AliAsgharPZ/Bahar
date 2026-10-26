import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, sessionCookie, signToken, isValidNationalId } from "@/lib/auth";
import { apiErr, handleApiError, readJson, audit, rateLimit, ipOf, isDemoUser, failGet, failIncr, failReset } from "@/lib/api";
import { verifyCaptcha } from "@/lib/captcha";
import { getSettings } from "@/lib/settings";
import { signOtpPending, issueOtp } from "@/lib/otp";

const LOCK_MINUTES = 10;
/** پس از این تعداد شکست روی «همین حساب»، ورود کپچا می‌خواهد (تشدید تدریجی) */
const CAPTCHA_AFTER_FAILS = 2;
/** پس از این تعداد شکست از «همین IP» — آستانهٔ بالاتر برای IP چون NAT/VPN های
 *  مشترکِ اپراتورها IP یکسانی دارند و کاربر بی‌تقصیر نباید قفل شود (FIX راند ۱۸) */
const CAPTCHA_AFTER_IP_FAILS = 3;

// هش الکی برای برابری زمان پاسخ وقتی کاربر وجود ندارد (ضد شناسایی کاربر با سنجش زمان)
const DUMMY_HASH = hashPassword("bahar-timing-equalizer");

export async function POST(req: NextRequest) {
  try {
    // ── محدودیت نرخ بر اساس IP (ضد Brute-force) — سقف بالاتر برای تحمل VPN/NAT مشترک ──
    const ip = ipOf(req);
    if (!rateLimit(`login:${ip}`, 30, 60_000)) {
      return apiErr(429, "تلاش‌های ورود بیش از حد مجاز است؛ یک دقیقه صبر کنید. (اگر وی‌پی‌ان روشن است و IPs مشترک است، کمی صبر کنید)", "RATE_LIMITED");
    }

    const body = await readJson<{ nationalId?: string; password?: string; captchaToken?: string; captchaAnswer?: string }>(req);
    const nationalId = (body.nationalId ?? "").trim();
    const password = body.password ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";

    if (!isValidNationalId(nationalId)) {
      return apiErr(400, "کد ملی معتبر نیست (۱۰ رقم).", "BAD_NATIONAL_ID");
    }
    if (!password) {
      return apiErr(400, "رمز عبور را وارد کنید.", "BAD_PASSWORD");
    }

    const user = await db.user.findUnique({ where: { nationalId } });

    /* ── تشدید امنیتی: رفتار مشکوک (شکست‌های قبلی) → کپچای اجباری ──
       محرک‌ها: ۲+ شکست از همین IP، یا ۲+ شکست روی همین حساب.
       بررسی کپچا «قبل از» آزمودن رمز انجام می‌شود تا موتور حدس رمز
       بدون حل کپچا اصلاً نتواند کار کند. */
    const settings0 = await getSettings();
    const demo0 = settings0.demoEnabled && (nationalId === settings0.demoManagerNationalId || nationalId === settings0.demoStudentNationalId);
    const needCaptcha = ((user ? user.failedAttempts >= CAPTCHA_AFTER_FAILS : false) || failGet(`loginfail:${ip}`) >= CAPTCHA_AFTER_IP_FAILS);
    if (needCaptcha) {
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

    if (!user || !user.isActive) {
      // سنجش زمانی یکسان با مسیر رمز نادرست — بدون افشای وجود/عدم وجود کاربر
      verifyPassword(password, DUMMY_HASH);
      failIncr(`loginfail:${ip}`);
      await db.loginEvent.create({ data: { nationalId, ip, userAgent, status: "FAILED", note: "چنین کاربری نیست" } }).catch(() => {});
      return apiErr(401, "نام کاربری یا رمز عبور نادرست است.", "INVALID_CREDENTIALS", {
        captchaRequired: failGet(`loginfail:${ip}`) >= CAPTCHA_AFTER_IP_FAILS,
      });
    }

    const settings = settings0;
    const maxAttempts = Math.max(3, Number(settings.loginMaxAttempts) || 5);
    const demo = demo0;

    // ── حالت تعمیراتی: فقط سوپرادمین می‌تواند وارد شود ──
    if (settings.maintenanceMode && user.role !== "SUPER_ADMIN") {
      return apiErr(503, settings.maintenanceMessage || "سامانه در حال به‌روزرسانی است؛ لطفاً بعداً تلاش کنید.", "MAINTENANCE");
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return apiErr(423, "حساب شما موقتاً قفل شده است. کمی بعد دوباره تلاش کنید.", "LOCKED");
    }

    if (!verifyPassword(password, user.passwordHash)) {
      {
        const attempts = user.failedAttempts + 1;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: attempts,
            lockedUntil: attempts >= maxAttempts ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
          },
        });
      }
      const ipFails = failIncr(`loginfail:${ip}`);
      await db.loginEvent.create({ data: { userId: user.id, nationalId, ip, userAgent, status: "FAILED", note: "رمز نادرست" } }).catch(() => {});
      return apiErr(
        401,
        ipFails >= CAPTCHA_AFTER_IP_FAILS
          ? "نام کاربری یا رمز عبور نادرست است؛ برای تلاش بعدی کد امنیتی لازم است."
          : "نام کاربری یا رمز عبور نادرست است.",
        "INVALID_CREDENTIALS",
        { captchaRequired: ipFails >= CAPTCHA_AFTER_IP_FAILS || user.failedAttempts + 1 >= CAPTCHA_AFTER_FAILS }
      );
    }

    failReset(`loginfail:${ip}`);
    await db.user.update({
      where: { id: user.id },
      // tempPassword is a one-time delivery secret: once the user has signed in
      // with the real password it must not remain stored in plaintext.
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), tempPassword: null },
    });

    // ── مرحلهٔ دوم (راند ۱۸): کد یکبارمصرف ایمیل/پیامک — قبل از 2FA ──
    if (settings.otpEnabled) {
      const otp = await issueOtp(
        { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone },
        settings
      );
      if (!otp.ok) {
        return apiErr(400, `ورود دومرحله‌ای فعال است اما کد ارسال نشد: ${otp.error}`, "OTP_SEND_FAILED");
      }
      await db.loginEvent.create({ data: { userId: user.id, nationalId, ip, userAgent, status: "SUCCESS", note: "رمز درست — در انتظار کد یکبارمصرف" } }).catch(() => {});
      return NextResponse.json({
        ok: true,
        requiresOtp: true,
        pendingToken: signOtpPending(user.id),
        maskedTo: otp.maskedTo ?? null,
        channel: settings.otpChannel,
      });
    }

    // ── مرحله دوم: اگر 2FA فعال است، نشست صادر نمی‌شود — توکن ۵ دقیقه‌ای ──
    if (user.twoFactorEnabled) {
      const { signPendingToken } = await import("@/lib/twofactor");
      await db.loginEvent.create({ data: { userId: user.id, nationalId, ip, userAgent, status: "SUCCESS", note: "رمز درست — در انتظار کد دو مرحله‌ای" } }).catch(() => {});
      return NextResponse.json({ ok: true, requires2fa: true, pendingToken: signPendingToken(user.id) });
    }

    // طول عمر نشست از تنظیمات سامانه (sessionDays) — به‌جای عدد ثابت
    const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion }, settings.sessionDays);
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
    await db.loginEvent.create({ data: { userId: user.id, nationalId, ip, userAgent, status: "SUCCESS" } }).catch(() => {});
    await audit({
      user: {
        id: user.id, role: user.role, permissions: [],
        firstName: user.firstName, lastName: user.lastName,
        schoolId: user.schoolId, nationalId: user.nationalId,
        mustChangePassword: user.mustChangePassword, isActive: user.isActive, shadNumber: user.shadNumber,
      },
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      meta: demo ? { demo: true } : undefined,
      ip,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
