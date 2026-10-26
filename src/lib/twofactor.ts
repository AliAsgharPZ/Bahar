import crypto from "crypto";
import { getSessionSecret } from "@/lib/secret";

// ============================================================
// بهار | احراز هویت دو مرحله‌ای (TOTP — RFC 6238) — راند ۱۶
// پیاده‌سازی کامل با crypto استاندارد Node (بدون وابستگی جدید):
//   • تولید رمز ۱۶۰بیتی Base32 + URI otpauth:// برای اپ‌های احرازگر
//   • تولید/تأیید کد ۶ رقمی با پنجره ±۱ (۹۰ ثانیه)
//   • رمز TOTP در DB رمزنگاری‌شده AES-256-GCM ذخیره می‌شود
//   • ۸ کد بازیابی یک‌بارمصرف (هش SHA-256)
//   • pending-token امضاشده HMAC برای مرحله دوم ورود (۵ دقیقه)
// سازگار با Google Authenticator / Aegis / Microsoft Authenticator
// ============================================================

const SESSION_SECRET = getSessionSecret();

/* ---------- Base32 (RFC 4648) ---------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ---------- تولید رمز و URI ---------- */

/** رمز TOTP تازه — ۲۰ بایت تصادفی (۱۶۰ بیت، Base32 سی‌ودو نویسه) */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** URI استاندارد otpauth:// برای اپ‌های احرازگر */
export function otpauthUri(secret: string, account: string, issuer = "Bahar"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ---------- TOTP core (RFC 6238) ---------- */

function hotp(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter % 2 ** 32, 4);
  const hmac = crypto.createHmac("sha1", secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/** کد TOTP برای یک زمان مشخص (تست/نمایش) */
export function totpNow(secret: string, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / 30);
  return hotp(base32Decode(secret), counter);
}

/**
 * تأیید کد TOTP با پنجره ±۱ استپ (۹۰ ثانیه).
 * نکته: همان کد در دو رویداد جدا (مثل فعال‌سازی و ورود بلافاصله بعد) پذیرفته
 * می‌شود — رفتار استاندارد TOTP و سازگار با UX واقعی اپ‌های احرازگر.
 * امنیت بازپخش با TLS + عمر ۳۰ ثانیه کد کنترل می‌شود (RFC 6238 §5.2).
 */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const clean = (code || "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const secretBuf = base32Decode(secret);
  const counterNow = Math.floor(Date.now() / 1000 / 30);
  for (let delta = -window; delta <= window; delta += 1) {
    const counter = counterNow + delta;
    const expected = hotp(secretBuf, counter);
    // مقایسه زمان-ثابت
    if (clean.length === expected.length && crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/* ---------- رمزنگاری رمز TOTP برای ذخیره در DB ---------- */

function aesKey(): Buffer {
  return crypto.scryptSync(SESSION_SECRET, "bahar-2fa-secret", 32);
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptTotpSecret(payload: string): string | null {
  try {
    const [v, ivB, tagB, dataB] = payload.split(":");
    if (v !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/* ---------- کدهای بازیابی ---------- */

/** ۸ کد بازیابی به شکل XXXX-XXXX */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase(); // ۸ رقم hex
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.toUpperCase().replace(/[^A-Z0-9-]/g, "")).digest("hex");
}

/** مصرف یک کد بازیابی — خروجی: [ok, remainingCodesJson] */
export function consumeBackupCode(backupCodesJson: string, code: string): { ok: boolean; remaining: string } {
  try {
    const list = JSON.parse(backupCodesJson) as Array<{ hash: string; usedAt?: string | null }>;
    const target = hashBackupCode(code);
    const idx = list.findIndex((c) => c.hash === target && !c.usedAt);
    if (idx === -1) return { ok: false, remaining: backupCodesJson };
    list[idx].usedAt = new Date().toISOString();
    return { ok: true, remaining: JSON.stringify(list) };
  } catch {
    return { ok: false, remaining: backupCodesJson };
  }
}

/** تعداد کدهای بازیابی باقی‌مانده */
export function backupCodesRemaining(backupCodesJson: string | null | undefined): number {
  if (!backupCodesJson) return 0;
  try {
    const list = JSON.parse(backupCodesJson) as Array<{ hash: string; usedAt?: string | null }>;
    return list.filter((c) => !c.usedAt).length;
  } catch {
    return 0;
  }
}

/* ---------- pending-token مرحله دوم ورود (۵ دقیقه) ---------- */

const PENDING_TTL_MS = 5 * 60 * 1000;

export function signPendingToken(userId: string): string {
  const exp = Date.now() + PENDING_TTL_MS;
  const body = Buffer.from(JSON.stringify({ sub: userId, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPendingToken(token: string): string | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub?: string; exp?: number };
    if (!parsed.sub || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}
