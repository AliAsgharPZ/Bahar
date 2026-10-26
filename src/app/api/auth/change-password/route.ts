import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword, signToken, sessionCookie } from "@/lib/auth";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser, rateLimit, failGet, failIncr, failReset } from "@/lib/api";
import { verifyCaptcha } from "@/lib/captcha";

const CAPTCHA_AFTER_FAILS = 2;

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
        if (!rateLimit(`chpwd:${me.id}`, 5, 5 * 60_000)) {
      return apiErr(429, "تلاش‌های بیش از حد؛ پنج دقیقه صبر کنید.", "RATE_LIMITED");
    }
    const body = await readJson<{ currentPassword?: string; newPassword?: string; captchaToken?: string; captchaAnswer?: string }>(req);
    const current = body.currentPassword ?? "";
    const next = body.newPassword ?? "";

    // راند ۱۷ — رفتار مشکوک: رمز فعلی نادرست قبلی → این بار فقط با کپچا
    if (failGet(`chpwdfail:${me.id}`) >= CAPTCHA_AFTER_FAILS) {
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

    if (next.length < 8) {
      return apiErr(400, "رمز جدید باید حداقل ۸ نویسه باشد.", "WEAK_PASSWORD");
    }
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) {
      return apiErr(400, "رمز جدید باید شامل حرف و رقم باشد.", "WEAK_PASSWORD");
    }

    const user = await db.user.findUnique({ where: { id: me.id } });
    if (!user) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
    if (!verifyPassword(current, user.passwordHash)) {
      const fails = failIncr(`chpwdfail:${me.id}`);
      return apiErr(
        400,
        fails >= CAPTCHA_AFTER_FAILS ? "رمز فعلی نادرست است؛ برای تلاش بعدی کد امنیتی لازم است." : "رمز فعلی نادرست است.",
        "WRONG_PASSWORD",
        { captchaRequired: fails >= CAPTCHA_AFTER_FAILS }
      );
    }
    failReset(`chpwdfail:${me.id}`);
    if (current === next) {
      return apiErr(400, "رمز جدید نباید با رمز فعلی یکسان باشد.", "SAME_PASSWORD");
    }

    // افزایش tokenVersion → خروج اجباری همه نشست‌های دیگر (پس از سرقت رمز)
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(next),
        tempPassword: null,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    // نشست جدید با نسخه به‌روزشده صادر می‌شود تا کاربر فعلی خارج نشود
    const res = apiOk({ ok: true });
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    res.headers.append("Set-Cookie", sessionCookie(signToken({ sub: user.id, tv: updated.tokenVersion }, settings.sessionDays)));
    await audit({ user: me, action: "CHANGE_PASSWORD", entityType: "USER", entityId: me.id });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
