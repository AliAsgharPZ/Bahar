import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, sessionCookie, signToken } from "@/lib/auth";
import { apiErr, handleApiError, readJson, audit, rateLimit, ipOf, failGet, failIncr, failReset } from "@/lib/api";
import { verifyPendingToken, verifyTotp, consumeBackupCode } from "@/lib/twofactor";
import { verifyCaptcha } from "@/lib/captcha";
import { getSettings } from "@/lib/settings";

// ============================================================
// بهار | API مرحله دوم ورود (2FA) — POST /api/auth/login2fa
// ورود: { pendingToken, code } — کد ۶ رقمی اپ احرازگر یا کد بازیابی
// پس از تأیید، همان نشست اصلی ورود صادر می‌شود.
// راند ۱۷: پس از ۲ کد نادرست، ادامه فقط با حل کپچا (رفتار مشکوک).
// ============================================================

const CAPTCHA_AFTER_FAILS = 2;

export async function POST(req: NextRequest) {
  try {
    const ip = ipOf(req);
    if (!rateLimit(`login2fa:${ip}`, 10, 60_000)) {
      return apiErr(429, "تلاش‌های بیش از حد مجاز؛ یک دقیقه صبر کنید.", "RATE_LIMITED");
    }

    const body = await readJson<{ pendingToken?: string; code?: string; captchaToken?: string; captchaAnswer?: string }>(req);
    const pendingToken = (body.pendingToken ?? "").trim();
    const code = (body.code ?? "").replace(/[\s-]/g, "");
    const userAgent = req.headers.get("user-agent") ?? "";

    if (!pendingToken || !code) {
      return apiErr(400, "توکن مرحله دوم و کد تأیید الزامی است.", "BAD_INPUT");
    }

    // تشدید: کدهای نادرست قبلی از همین IP → قبل از آزمودن کد، کپچا
    if (failGet(`login2fafail:${ip}`) >= CAPTCHA_AFTER_FAILS) {
      const cv = verifyCaptcha(body.captchaToken, body.captchaAnswer);
      if (!cv.ok) {
        return apiErr(
          401,
          cv.reason === "WRONG" ? "پاسخ کد امنیتی نادرست است." : "کد امنیتی منقضی/استفاده‌شده است؛ کد جدید بگیرید.",
          "CAPTCHA_REQUIRED",
          { captchaRequired: true }
        );
      }
    }

    const userId = verifyPendingToken(pendingToken);
    if (!userId) {
      return apiErr(401, "مرحله اول ورود منقضی شده است — دوباره وارد شوید.", "PENDING_EXPIRED");
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return apiErr(401, "حساب برای ورود دو مرحله‌ای فعال نیست.", "2FA_NOT_ENABLED");
    }

    // محدودیت نرخ اختصاصی همین کاربر (ضد Brute-force کد)
    if (!rateLimit(`login2fa:user:${user.id}`, 8, 5 * 60_000)) {
      return apiErr(429, "تلاش کد بیش از حد مجاز؛ پنج دقیقه صبر کنید.", "RATE_LIMITED");
    }

    // ① کد TOTP از اپ احرازگر
    // رمز TOTP رمزنگاری‌شده در DB است — اینجا باز می‌شود
    const { decryptTotpSecret } = await import("@/lib/twofactor");
    const secret = decryptTotpSecret(user.twoFactorSecret);
    let ok = false;
    let usedBackup = false;
    if (secret && verifyTotp(secret, code)) {
      ok = true;
    } else if (user.backupCodes) {
      // ② کد بازیابی یک‌بارمصرف
      const res = consumeBackupCode(user.backupCodes, code);
      if (res.ok) {
        ok = true;
        usedBackup = true;
        await db.user.update({ where: { id: user.id }, data: { backupCodes: res.remaining } });
      }
    }

    if (!ok) {
      const ipFails = failIncr(`login2fafail:${ip}`);
      await db.loginEvent.create({ data: { userId: user.id, nationalId: user.nationalId, ip, userAgent, status: "FAILED", note: "کد دو مرحله‌ای نادرست" } }).catch(() => {});
      return apiErr(
        401,
        ipFails >= CAPTCHA_AFTER_FAILS ? "کد تأیید نادرست است؛ برای تلاش بعدی کد امنیتی لازم است." : "کد تأیید نادرست است.",
        "BAD_CODE",
        { captchaRequired: ipFails >= CAPTCHA_AFTER_FAILS }
      );
    }

    failReset(`login2fafail:${ip}`);

    // موفق — همان جریان پایانی ورود اصلی
    const settings = await getSettings();
    await db.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
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
    await db.loginEvent.create({ data: { userId: user.id, nationalId: user.nationalId, ip, userAgent, status: "SUCCESS", note: usedBackup ? "ورود با کد بازیابی" : "ورود با کد TOTP" } }).catch(() => {});
    await audit({
      user: { id: user.id, role: user.role, permissions: [], firstName: user.firstName, lastName: user.lastName, schoolId: user.schoolId, nationalId: user.nationalId, mustChangePassword: user.mustChangePassword, isActive: user.isActive, shadNumber: user.shadNumber },
      action: "LOGIN_2FA",
      entityType: "USER",
      entityId: user.id,
      meta: { backup: usedBackup },
      ip,
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
