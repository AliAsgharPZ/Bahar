import crypto from "crypto";
import { getCountrySync } from "@/lib/country/cache";
import { getSessionSecret } from "@/lib/secret";
import { enDigits } from "@/lib/persian";

// ============================================================
// بهار | احراز هویت — کد ملی به‌عنوان نام کاربری + رمز تصادفی
// نشست کوکی امضاشده HMAC (بدون وابستگی بیرونی)
// ============================================================

const SESSION_SECRET = getSessionSecret();

const COOKIE_NAME = "bahar_session";
const SESSION_DAYS = 14; // پیش‌فرض — در ورود از تنظیمات سامانه (settings.sessionDays) خوانده می‌شود

// ---------- رمز عبور ----------

/** تولید رمز تصادفی امن — نمونه: B7kQm4Rz92 */
export function generatePassword(length = 10): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  let password = "";
  password += upper[crypto.randomInt(upper.length)];
  password += lower[crypto.randomInt(lower.length)];
  password += digits[crypto.randomInt(digits.length)];
  password += symbols[crypto.randomInt(symbols.length)];
  for (let i = 4; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }
  // Fisher-Yates shuffle
  const arr = password.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const test = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

// ---------- توکن نشست (JWT-HMAC سبک) ----------

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload: Record<string, unknown>, days: number = SESSION_DAYS): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const safeDays = Math.max(1, Math.min(90, Number(days) || SESSION_DAYS));
  const exp = Math.floor(Date.now() / 1000) + safeDays * 24 * 3600;
  const body = b64url(JSON.stringify({ ...payload, exp }));
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expected = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (expected.length !== sig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- کوکی نشست ----------

export function sessionCookie(token: string, days: number = SESSION_DAYS): string {
  const safeDays = Math.max(1, Math.min(90, Number(days) || SESSION_DAYS));
  const expires = new Date(Date.now() + safeDays * 24 * 3600 * 1000).toUTCString();
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${expires}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

// ---------- اعتبارسنجی شناسه ملی و شماره تماس (پروفایل کشور) ----------

/** الگوریتم Luhn — برای کشورهایی که رقم کنترل کارت/شناسه با Luhn است */
function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 2; i >= 0; i -= 1) {
    let d = +digits[i];
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  const check = +digits[digits.length - 1];
  return (10 - (sum % 10)) % 10 === check;
}

/** رقم کنترل کد ملی ایران — mod-11 */
function iranMod11(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const check = +code[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +code[i] * (10 - i);
  const rem = sum % 11;
  return rem < 2 ? check === rem : check === 11 - rem;
}

/**
 * اعتبارسنجی شناسه ملی/کاربری بر اساس پروفایل کشور فعال.
 * دیفالت ایران → دقیقاً همان رفتار قبل (رقم کنترل mod-11).
 */
export function isValidNationalId(input: string): boolean {
  const code = input.trim();
  const nid = getCountrySync().nationalId;
  switch (nid.algorithm) {
    case "iran-mod11":
      return iranMod11(code);
    case "luhn": {
      if (!/^\d{5,20}$/.test(code)) return false;
      return luhnCheck(code);
    }
    case "none": {
      // هر رشته غیرخالی ۴ تا ۳۲ نویسه — الگو اختیاری
      if (code.length < 4 || code.length > 32) return false;
      if (nid.pattern) {
        try {
          if (!new RegExp(nid.pattern).test(code)) return false;
        } catch { /* الگوی خراب → نادیده */ }
      }
      return true;
    }
    case "digits":
    default: {
      if (!/^[0-9]{5,20}$/.test(code)) return false;
      try {
        if (!new RegExp(nid.pattern || "^[0-9]{5,20}$").test(code)) return false;
      } catch { /* الگوی خراب → نادیده */ }
      return true;
    }
  }
}

/**
 * اعتبارسنجی شماره موبایل بر اساس پروفایل کشور فعال.
 * دیفالت ایران → ۰۹… (۱۱ رقم) — همان رفتار قبل.
 */
export function isValidPhone(input: string): boolean {
  const v = enDigits(input.trim());
  const ph = getCountrySync().phone;
  try {
    return new RegExp(ph.pattern || "^09\\d{9}$").test(v);
  } catch {
    return /^0?9\d{9}$/.test(v);
  }
}

/** شماره حساب شاد — فقط ایران؛ وقتی ماژول شاد خاموش است همیشه false */
export function isValidShadNumber(input: string): boolean {
  const v = input.trim();
  const c = getCountrySync();
  if (!c.modules.shad) return false; // خارج از ایران شاد معنا ندارد
  try {
    return new RegExp(c.phone.pattern || "^09\\d{9}$").test(v);
  } catch {
    return /^09\d{9}$/.test(v); // شماره موبایل ایران
  }
}
