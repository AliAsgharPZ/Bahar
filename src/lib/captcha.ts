import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getSessionSecret } from "@/lib/secret";

// ============================================================
// بهار | کپچای امن سرور-ساید — بدون وابستگی خارجی
//SVG فارسی اعوجاج‌دار + امضای HMAC-SHA256 + یک‌بارمصرف (nonce) +
// عمر کوتاه + مقایسه زمان-ثابت. برای لاگین و نقاط حساس با رفتار مشکوک.
// ============================================================

const CAPTCHA_TTL_MS = 120_000; // عمر چالش: ۲ دقیقه
const MAX_ATTEMPTS_PER_CHALLENGE = 3; // هر چالش حداکثر ۳ بار قابل پاسخ
const CODE_LEN = 5;

/** ارقام فارسی بدون اشتباه‌پذیری (۰/۵ و ۱/۷ حذف) */
const DIGITS = ["۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
/** حروف فارسی کم‌اشتباه برای قدرت بیشتر */
const LETTERS = ["ب", "پ", "ت", "ث", "ج", "چ", "ح", "خ", "س", "ش", "ص", "ط", "ع", "غ", "ق", "ک", "گ", "م", "ن", "و", "ه"];

function secret(): string {
  return getSessionSecret();
}

type Challenge = {
  h: string; // هش کد (sha256)
  exp: number;
  n: string; // nonce یک‌بارمصرف
  a: number; // تلاش‌های مصرف‌شده
};

const store = new Map<string, Challenge>(); // nonce → challenge

setInterval(() => {
  const now = Date.now();
  for (const [k, c] of store) if (c.exp < now) store.delete(k);
}, 60_000).unref?.();

function b64url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function unb64url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}
function hashCode(code: string): string {
  // نمک تصادفی به ازای چالش نیست — کد کوتاه است؛ هش ساده برای مقایسه امن با timing-safe
  return createHmac("sha256", secret()).update(`captcha:${code}`).digest("hex");
}

function randomCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LEN; i += 1) {
    // ۶۰٪ رقم، ۴۰٪ حرف — برای انسان آسان، برای بات سخت
    chars.push(Math.random() < 0.6
      ? DIGITS[Math.floor(Math.random() * DIGITS.length)]
      : LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  return chars.join("");
}

/** نرمال‌سازی پاسخ کاربر: ارقام فارسی→انگلیسی، حذف فاصله/نیم‌فاصله، حروف کوچک */
export function normalizeCaptchaAnswer(input: string): string {
  const faToEn: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return input
    .split("")
    .map((ch) => faToEn[ch] ?? ch)
    .join("")
    .replace(/[\s\u200c\u200f\u200e]/g, "")
    .trim()
    .toLowerCase();
}

/* ─── رندر SVG اعواج‌دار ─── */

const INK = ["#0b3d2e", "#082c22", "#5c1338", "#6b4a00", "#123a5c"];

function renderSvg(code: string): string {
  const W = 190;
  const H = 64;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="کد امنیتی">`;
  // پس‌زمینه با نویز ملایم
  svg += `<rect width="${W}" height="${H}" fill="#f2f6f3"/>`;
  for (let i = 0; i < 3; i += 1) {
    const g = 232 + Math.floor(Math.random() * 18);
    svg += `<rect x="${Math.random() * W}" y="${Math.random() * H}" width="${20 + Math.random() * 60}" height="${8 + Math.random() * 30}" fill="rgb(${g},${g + 4},${g})" opacity="0.6" transform="rotate(${Math.random() * 40 - 20} ${W / 2} ${H / 2})"/>`;
  }
  // خطوط اعوجاج
  for (let i = 0; i < 5; i += 1) {
    const y1 = Math.random() * H;
    const y2 = Math.random() * H;
    svg += `<path d="M0 ${y1.toFixed(1)} C ${W * 0.3} ${(y1 + (Math.random() * 30 - 15)).toFixed(1)}, ${W * 0.7} ${(y2 + (Math.random() * 30 - 15)).toFixed(1)}, ${W} ${y2.toFixed(1)}" fill="none" stroke="${INK[Math.floor(Math.random() * INK.length)]}" stroke-width="${(0.8 + Math.random() * 1.2).toFixed(2)}" opacity="0.35"/>`;
  }
  // نقاط نویز
  for (let i = 0; i < 34; i += 1) {
    svg += `<circle cx="${(Math.random() * W).toFixed(1)}" cy="${(Math.random() * H).toFixed(1)}" r="${(0.8 + Math.random() * 1.6).toFixed(1)}" fill="${INK[Math.floor(Math.random() * INK.length)]}" opacity="0.4"/>`;
  }
  // نویسه‌ها با چرخش/جابجایی/اندازه متفاوت
  const cell = W / CODE_LEN;
  for (let i = 0; i < code.length; i += 1) {
    const cx = cell * i + cell / 2 + (Math.random() * 8 - 4);
    const cy = H / 2 + (Math.random() * 10 - 5);
    const rot = Math.random() * 44 - 22;
    const fs = 26 + Math.random() * 8;
    const col = INK[Math.floor(Math.random() * INK.length)];
    svg += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="Vazirmatn, Tahoma, 'Segoe UI', sans-serif" font-size="${fs.toFixed(1)}" font-weight="700" fill="${col}" text-anchor="middle" dominant-baseline="central" transform="rotate(${rot.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}) skewX(${(Math.random() * 10 - 5).toFixed(1)})">${code[i]}</text>`;
  }
  svg += `</svg>`;
  return svg;
}

/* ─── API عمومی ─── */

export type CaptchaChallenge = { token: string; image: string; expiresInSeconds: number };

/** ساخت چالش جدید — token امضاشده + تصویر data-URI */
export function generateCaptcha(): CaptchaChallenge {
  const code = randomCode();
  const nonce = randomBytes(12).toString("base64url");
  // هش از نسخهٔ «نرمال‌شده» — همان شکلی که پاسخ کاربر نرمال می‌شود (ارقام فارسی→لاتین)
  const ch: Challenge = { h: hashCode(normalizeCaptchaAnswer(code)), exp: Date.now() + CAPTCHA_TTL_MS, n: nonce, a: 0 };
  store.set(nonce, ch);
  const payload = b64url(JSON.stringify({ h: ch.h, exp: ch.exp, n: nonce }));
  const token = `${payload}.${sign(payload)}`;
  const svg = renderSvg(code);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return { token, image, expiresInSeconds: Math.round(CAPTCHA_TTL_MS / 1000) };
}

export type CaptchaVerifyResult =
  | { ok: true }
  | { ok: false; reason: "MISSING" | "EXPIRED_OR_INVALID" | "WRONG" | "REUSED" };

/** بررسی پاسخ — یک‌بارمصرف با سقف تلاش؛ مقایسه زمان-ثابت */
export function verifyCaptcha(token: string | undefined | null, answer: string | undefined | null): CaptchaVerifyResult {
  if (!token || !answer) return { ok: false, reason: "MISSING" };
  const dot = token.lastIndexOf(".");
  if (dot < 1) return { ok: false, reason: "EXPIRED_OR_INVALID" };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "EXPIRED_OR_INVALID" };
    const parsed = JSON.parse(unb64url(payload)) as { h: string; exp: number; n: string };
    const ch = store.get(parsed.n);
    if (!ch) return { ok: false, reason: "REUSED" };
    if (ch.exp < Date.now() || parsed.exp < Date.now()) {
      store.delete(parsed.n);
      return { ok: false, reason: "EXPIRED_OR_INVALID" };
    }
    if (ch.a >= MAX_ATTEMPTS_PER_CHALLENGE) {
      store.delete(parsed.n);
      return { ok: false, reason: "REUSED" };
    }
    ch.a += 1;
    const given = hashCode(normalizeCaptchaAnswer(answer));
    const ha = Buffer.from(ch.h, "hex");
    const hb = Buffer.from(given, "hex");
    const match = ha.length === hb.length && timingSafeEqual(ha, hb);
    if (match) {
      store.delete(parsed.n); // مصرف شد
      return { ok: true };
    }
    return { ok: false, reason: "WRONG" };
  } catch {
    return { ok: false, reason: "EXPIRED_OR_INVALID" };
  }
}
