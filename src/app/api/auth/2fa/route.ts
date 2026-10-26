import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, audit, readJson, rateLimit, ipOf } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import {
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
  encryptTotpSecret,
  decryptTotpSecret,
  generateBackupCodes,
  hashBackupCode,
  backupCodesRemaining,
} from "@/lib/twofactor";
import { qrSvg } from "@/lib/qr";

// ============================================================
// بهار | API مدیریت 2FA — POST /api/auth/2fa
// action:
//   status  → وضعیت فعلی (برای کارت پروفایل)
//   setup   → تولید رمز تازه + URI/QR (غیرفعال — نیازمند تأیید)
//   enable  → تأیید اولین کد → فعال‌سازی + صدور ۸ کد بازیابی
//   disable → غیرفعال‌سازی (رمز + کد الزامی)
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!rateLimit(`2fa:${me.id}`, 12, 60_000)) {
      return apiErr(429, "درخواست‌های بیش از حد؛ یک دقیقه صبر کنید.", "RATE_LIMITED");
    }
    const body = await readJson<{ action?: string; code?: string; password?: string }>(req);
    const action = body.action ?? "status";
    const user = await db.user.findUnique({ where: { id: me.id } });
    if (!user) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");

    /* ---- وضعیت ---- */
    if (action === "status") {
      return apiOk({
        enabled: user.twoFactorEnabled,
        hasSecret: Boolean(user.twoFactorSecret),
        backupRemaining: backupCodesRemaining(user.backupCodes),
      });
    }

    /* ---- شروع راه‌اندازی ---- */
    if (action === "setup") {
      if (user.twoFactorEnabled) {
        return apiErr(409, "دو مرحله‌ای از قبل فعال است — ابتدا غیرفعال کنید.", "ALREADY_ENABLED");
      }
      const secret = generateTotpSecret();
      // رمز موقتاً (رمزنگاری‌شده) ذخیره می‌شود تا enable با اولین کد معتبرش شود
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: encryptTotpSecret(secret), twoFactorEnabled: false, backupCodes: null },
      });
      const uri = otpauthUri(secret, user.nationalId, "Bahar");
      const svg = qrSvg(uri, { scale: 5 });
      await audit({ user: me, action: "2FA_SETUP_START", entityType: "USER", entityId: user.id });
      return apiOk({ secret, uri, qrSvg: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` });
    }

    /* ---- فعال‌سازی با تأیید اولین کد ---- */
    if (action === "enable") {
      if (user.twoFactorEnabled) {
        return apiErr(409, "دو مرحله‌ای از قبل فعال است.", "ALREADY_ENABLED");
      }
      if (!user.twoFactorSecret) {
        return apiErr(400, "ابتدا مرحله راه‌اندازی (setup) را انجام دهید.", "NO_SECRET");
      }
      const secret = decryptTotpSecret(user.twoFactorSecret);
      if (!secret) {
        return apiErr(500, "رمز ذخیره‌شده خراب است — دوباره راه‌اندازی کنید.", "SECRET_CORRUPT");
      }
      const code = (body.code ?? "").replace(/\D/g, "");
      if (!verifyTotp(secret, code)) {
        return apiErr(400, "کد تأیید نادرست است — از کد فعلی اپ احرازگر استفاده کنید.", "BAD_CODE");
      }
      const codes = generateBackupCodes();
      const hashes = codes.map((c) => ({ hash: hashBackupCode(c) }));
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true, backupCodes: JSON.stringify(hashes) },
      });
      await audit({ user: me, action: "2FA_ENABLED", entityType: "USER", entityId: user.id });
      return apiOk({ enabled: true, backupCodes: codes }); // کدها فقط این یک‌بار نمایش داده می‌شوند
    }

    /* ---- غیرفعال‌سازی ---- */
    if (action === "disable") {
      if (!user.twoFactorEnabled) {
        return apiErr(409, "دو مرحله‌ای فعال نیست.", "NOT_ENABLED");
      }
      // رمز فعلی + یک کد معتبر الزامی است (محافظ در برابر نشست ربوده‌شده)
      if (!body.password || !verifyPassword(body.password, user.passwordHash)) {
        return apiErr(401, "رمز عبور نادرست است.", "BAD_PASSWORD");
      }
      const secret = decryptTotpSecret(user.twoFactorSecret ?? "");
      const code = (body.code ?? "").replace(/\D/g, "");
      const totpOk = secret ? verifyTotp(secret, code) : false;
      let backupOk = false;
      if (!totpOk && user.backupCodes) {
        const { consumeBackupCode } = await import("@/lib/twofactor");
        const res = consumeBackupCode(user.backupCodes, code);
        if (res.ok) {
          backupOk = true;
          await db.user.update({ where: { id: user.id }, data: { backupCodes: res.remaining } });
        }
      }
      if (!totpOk && !backupOk) {
        return apiErr(400, "کد تأیید نادرست است.", "BAD_CODE");
      }
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: null },
      });
      await audit({ user: me, action: "2FA_DISABLED", entityType: "USER", entityId: user.id, ip: ipOf(req) });
      return apiOk({ enabled: false });
    }

    return apiErr(400, "action نامعتبر است (status | setup | enable | disable).", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
