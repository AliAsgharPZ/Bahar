import crypto from "crypto";
import type { BaharSettings } from "./settings";
import { getSessionSecret } from "@/lib/secret";
import { db } from "@/lib/db";

/* ============================================================
   بهار | OTP ورود (راند ۱۸) — کد یکبارمصرف ایمیل/پیامک
   دیفالت خاموش؛ سوپرادمین از تنظیمات فعالش می‌کند.
   - کد ۶رقمی crypto-random، هش SHA-256 در دیتابیس (Setting)
   - TTL ۵ دقیقه، حداکثر ۵ تلاش، ارسال مجدد هر ۳۰ ثانیه
   - توکنِ «در انتظار OTP» امضای HMAC با SESSION_SECRET
   - ارسال از طریق سرویس ایمیل/پیامکِ سازگار (POST JSON + Bearer)
     یا «حالت تست» که کد را در پاسخ برمی‌گرداند.
   ============================================================ */

const OTP_TTL = 5 * 60_000; // ۵ دقیقه
const OTP_MAX_TRIES = 5;
const OTP_RESEND_COOLDOWN = 30_000; // ۳۰ ثانیه
const PENDING_TTL_S = 5 * 60; // ۵ دقیقه

type OtpEntry = { hash: string; expires: number; tries: number; lastSent: number };
// وضعیت OTP در دیتابیس (جدول Setting، کلید otp:<userId>) نگهداری می‌شود —
// روی استقرار چندایزوله (Workers) سقف تلاش و انقضا باید بین همهٔ ایزوله‌ها
// مشترک باشد؛ Map درون‌پردازشی این تضمین را نمی‌داد.
const otpKey = (userId: string) => `otp:${userId}`;
async function loadEntry(userId: string): Promise<OtpEntry | null> {
  const row = await db.setting.findUnique({ where: { key: otpKey(userId) } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as OtpEntry;
  } catch {
    return null;
  }
}
async function saveEntry(userId: string, entry: OtpEntry): Promise<void> {
  const value = JSON.stringify(entry);
  await db.setting.upsert({
    where: { key: otpKey(userId) },
    create: { key: otpKey(userId), value },
    update: { value },
  });
}
async function dropEntry(userId: string): Promise<void> {
  await db.setting.deleteMany({ where: { key: otpKey(userId) } });
}

/* ── توکن در انتظار (HMAC) ── */
function secret(): string {
  return getSessionSecret();
}

export function signOtpPending(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + PENDING_TTL_S;
  const payload = `${userId}.${exp}`;
  const mac = crypto.createHmac("sha256", secret()).update(`otp:${payload}`).digest("base64url");
  return Buffer.from(payload).toString("base64url") + "." + mac;
}

export function verifyOtpPending(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [payloadB64, mac] = token.split(".");
    const payload = Buffer.from(payloadB64, "base64url").toString();
    const expect = crypto.createHmac("sha256", secret()).update(`otp:${payload}`).digest("base64url");
    const a = Buffer.from(mac);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const [userId, expStr] = payload.split(".");
    const exp = Number(expStr);
    if (!exp || exp * 1000 < Date.now()) return null;
    return userId || null;
  } catch {
    return null;
  }
}

/* ── پوشاندن مقصد (نمایش امن) ── */
function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}
function maskPhone(p: string): string {
  return p.length > 6 ? `${p.slice(0, 4)}***${p.slice(-3)}` : "***";
}

/* ── ارسال از طریق سرویس ── */
async function sendCode(
  code: string,
  user: { firstName: string; lastName: string; email: string | null; phone: string | null },
  settings: BaharSettings
): Promise<{ ok: boolean; error?: string }> {
  const text = `کد یکبارمصرف ورود بهار: ${code}\nاعتبار: ۵ دقیقه`;
  if (settings.otpChannel === "email") {
    if (!user.email) return { ok: false, error: "ایمیل کاربر ثبت نشده است" };
    if (settings.otpTestMode) return { ok: true };
    if (!settings.otpEmailApiUrl || !settings.otpEmailApiKey) {
      return { ok: false, error: "تنظیمات سرویس ایمیل (آدرس/کلید) در تنظیمات سامانه تکمیل نشده است" };
    }
    try {
      const res = await fetch(settings.otpEmailApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.otpEmailApiKey}`,
        },
        body: JSON.stringify({
          from: settings.otpEmailFrom || "Bahar <onboarding@resend.dev>",
          to: [user.email],
          subject: "کد یکبارمصرف ورود به سامانه بهار",
          text,
        }),
      });
      if (!res.ok) return { ok: false, error: `سرویس ایمیل پاسخ ${res.status} داد` };
      return { ok: true };
    } catch {
      return { ok: false, error: "ارتباط با سرویس ایمیل برقرار نشد" };
    }
  } else {
    if (!user.phone) return { ok: false, error: "شماره موبایل کاربر ثبت نشده است" };
    if (settings.otpTestMode) return { ok: true };
    if (!settings.otpSmsApiUrl || !settings.otpSmsApiKey) {
      return { ok: false, error: "تنظیمات سرویس پیامک (آدرس/کلید) در تنظیمات سامانه تکمیل نشده است" };
    }
    try {
      const url = settings.otpSmsApiUrl
        .replaceAll("{to}", encodeURIComponent(user.phone))
        .replaceAll("{code}", code);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.otpSmsApiKey ? { Authorization: `Bearer ${settings.otpSmsApiKey}` } : {}),
        },
        body: JSON.stringify({
          to: user.phone,
          from: settings.otpSmsSender || undefined,
          text,
          message: text,
        }),
      });
      if (!res.ok && res.status !== 202 && res.status !== 201) {
        return { ok: false, error: `سرویس پیامک پاسخ ${res.status} داد` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "ارتباط با سرویس پیامک برقرار نشد" };
    }
  }
}

/** صدور و ارسال کد برای کاربر */
export async function issueOtp(
  user: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null },
  settings: BaharSettings
): Promise<{ ok: boolean; error?: string; devCode?: string; maskedTo?: string; resendIn?: number }> {
  const prev = await loadEntry(user.id);
  if (prev && Date.now() - prev.lastSent < OTP_RESEND_COOLDOWN && prev.expires > Date.now()) {
    return { ok: false, error: "کد قبلی هنوز معتبر است؛ کمی بعد دوباره درخواست بدهید", resendIn: Math.ceil((OTP_RESEND_COOLDOWN - (Date.now() - prev.lastSent)) / 1000) };
  }
  const code = String(crypto.randomInt(100000, 999999));
  const send = await sendCode(code, user, settings);
  if (!send.ok) return { ok: false, error: send.error };
  const hash = crypto.createHash("sha256").update(`otp:${user.id}:${code}`).digest("hex");
  await saveEntry(user.id, { hash, expires: Date.now() + OTP_TTL, tries: 0, lastSent: Date.now() });
  const maskedTo =
    settings.otpChannel === "email"
      ? user.email ? maskEmail(user.email) : undefined
      : user.phone ? maskPhone(user.phone) : undefined;
  if (settings.otpTestMode) {
    // Test mode: the code goes to the server log ONLY. It must never be
    // returned in an API response — anyone who can trigger an OTP for a
    // victim's account would otherwise read a live login code.
    console.warn(`[Bahar][OTP test mode] code for user ${user.id}: ${code}`);
  }
  return { ok: true, maskedTo };
}

/** بررسی کد — timing-safe روی هش؛ شمارش تلاش در دیتابیس ذخیره می‌شود
 *  تا بین ایزوله‌های Workers هم سقف تلاش واقعی باشد. */
export async function checkOtp(userId: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const entry = await loadEntry(userId);
  if (!entry) return { ok: false, error: "کدی برای شما صادر نشده است؛ دوباره وارد شوید" };
  if (entry.expires < Date.now()) {
    await dropEntry(userId);
    return { ok: false, error: "کد منقضی شده است — کد جدید بگیرید" };
  }
  if (entry.tries >= OTP_MAX_TRIES) {
    await dropEntry(userId);
    return { ok: false, error: "تلاش‌های نامعتبر زیاد بود — دوباره وارد شوید" };
  }
  entry.tries += 1;
  await saveEntry(userId, entry);
  const hash = crypto.createHash("sha256").update(`otp:${userId}:${code.trim()}`).digest("hex");
  const a = Buffer.from(hash);
  const b = Buffer.from(entry.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: `کد نادرست است (${OTP_MAX_TRIES - entry.tries} تلاش باقی مانده)` };
  }
  await dropEntry(userId); // یکبارمصرف
  return { ok: true };
}
