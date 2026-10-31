import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/* ============================================================
   بهار | هاب ربات و مینی‌اپ — اتصال مدرسه به پلتفرم‌هایی که API می‌دهند
   پلتفرم‌ها: تلگرام و بله (Bot API سازگار با تلگرام)، روبیکا (Bot API v3)،
   واتس‌اپ (Cloud API متا)، وب‌هوک عمومی (POST JSON) و CUSTOM برای هر
   سرویس سازگار با تلگرام (مثل سرور Bot API محلی یا درگاه‌های مشابه).
   توکن اتصال فقط سمت سرور است؛ هیچ خروجی API آن را برنمی‌گرداند.
   ربات داخلی قدیمی تلگرام (telegram-core) سر جای خودش می‌ماند؛ این هاب
   لایهٔ چندپلتفرمی روی همان مفهوم «پیوند چت ↔ حساب» است.
   ============================================================ */

export type BotPlatformId = "TELEGRAM" | "BALE" | "RUBIKA" | "WHATSAPP" | "WEBHOOK" | "CUSTOM";
export type BotApiStyle = "telegram" | "rubika" | "whatsapp" | "webhook";

export type BotPlatform = {
  id: BotPlatformId;
  nameFa: string;
  style: BotApiStyle;
  /** نشانی پایهٔ API؛ برای سبک تلگرام به‌صورت <base>/bot<token>/<method> صدا زده می‌شود */
  apiBase: string | null;
  /** آیا وب‌هوک ورودی و دستور ‎/start‎ پشتیبانی می‌شود (سبک تلگرام و روبیکا) */
  inbound: boolean;
  /** آیا مینی‌اپ (WebApp) با اعتبارسنجی initData پشتیبانی می‌شود */
  miniApp: boolean;
  hintFa: string;
};

export const BOT_PLATFORMS: BotPlatform[] = [
  {
    id: "TELEGRAM",
    nameFa: "تلگرام",
    style: "telegram",
    apiBase: "https://api.telegram.org",
    inbound: true,
    miniApp: true,
    hintFa: "توکن را از BotFather بگیرید. وب‌هوک و مینی‌اپ کامل پشتیبانی می‌شود.",
  },
  {
    id: "BALE",
    nameFa: "بله",
    style: "telegram",
    apiBase: "https://tapi.bale.ai",
    inbound: true,
    miniApp: true,
    hintFa: "توکن را از ربات پدر بله (@BaleFatherBot) بگیرید؛ API بله با تلگرام سازگار است.",
  },
  {
    id: "RUBIKA",
    nameFa: "روبیکا",
    style: "rubika",
    apiBase: "https://botapi.rubika.ir/v3",
    inbound: true,
    miniApp: false,
    hintFa: "توکن را از ربات مدیریت ربات‌های روبیکا (@BotFather در روبیکا) بگیرید. ارسال پیام و وب‌هوک پشتیبانی می‌شود.",
  },
  {
    id: "WHATSAPP",
    nameFa: "واتس‌اپ (Cloud API)",
    style: "whatsapp",
    apiBase: "https://graph.facebook.com/v21.0",
    inbound: false,
    miniApp: false,
    hintFa: "به‌جای توکن ربات، «شناسهٔ شماره تلفن» (Phone Number ID) را در برچسب و توکن دسترسی متا را اینجا وارد کنید. گیرنده با شمارهٔ موبایل پروفایلش شناخته می‌شود؛ پیام فقط در پنجرهٔ ۲۴ساعتهٔ پاسخ یا با قالب تأییدشده می‌رسد.",
  },
  {
    id: "WEBHOOK",
    nameFa: "وب‌هوک عمومی (JSON)",
    style: "webhook",
    apiBase: null,
    inbound: false,
    miniApp: false,
    hintFa: "نشانی پایه، آدرس سرویس شماست؛ بهار برای هر اعلان یک POST JSON با {chatId, text, title, link} می‌فرستد و توکن را در هدر Authorization می‌گذارد. برای اتصال هر سرویس دیگری (ایتا از راه درگاه، سامانهٔ داخلی مدرسه و…) همین گزینه است.",
  },
  {
    id: "CUSTOM",
    nameFa: "سازگار با تلگرام (نشانی سفارشی)",
    style: "telegram",
    apiBase: null,
    inbound: true,
    miniApp: true,
    hintFa: "نشانی پایهٔ یک API سازگار با تلگرام را وارد کنید (مثل سرور Bot API محلی یا درگاه پیام‌رسان‌های دیگر).",
  },
];

export function botPlatform(id: string): BotPlatform {
  return BOT_PLATFORMS.find((p) => p.id === id) ?? BOT_PLATFORMS[0];
}

export type BotConnectionRow = {
  id: string;
  schoolId: string;
  platform: string;
  label: string;
  token: string;
  apiBase: string | null;
  botUsername: string | null;
  webhookSecret: string;
  events: string;
  isActive: boolean;
};

const FETCH_TIMEOUT = 10_000;

async function fetchJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, status: 0, json: { description: e instanceof Error ? e.message : "network error" } };
  }
}

/** فراخوانی متد در سبک تلگرام: <base>/bot<token>/<method> */
export async function telegramStyleApi(
  conn: Pick<BotConnectionRow, "platform" | "token" | "apiBase">,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const p = botPlatform(conn.platform);
  const base = (conn.apiBase || p.apiBase || "").replace(/\/$/, "");
  if (!base) return { ok: false, description: "no api base" };
  const r = await fetchJson(`${base}/bot${conn.token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { ok: r.ok && r.json.ok !== false, result: r.json.result, description: typeof r.json.description === "string" ? r.json.description : undefined };
}

/** ارسال یک پیام متنی به یک چت/گیرنده در هر پلتفرم */
export async function sendBotMessage(
  conn: BotConnectionRow,
  chatId: string,
  text: string,
  extra?: { webAppUrl?: string; webAppLabel?: string },
): Promise<{ ok: boolean; description?: string }> {
  const p = botPlatform(conn.platform);
  if (p.style === "telegram") {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (extra?.webAppUrl && p.miniApp) {
      body.reply_markup = {
        inline_keyboard: [[{ text: extra.webAppLabel ?? "🚀 باز کردن مینی‌اپ بهار", web_app: { url: extra.webAppUrl } }]],
      };
    }
    const r = await telegramStyleApi(conn, "sendMessage", body);
    return { ok: r.ok, description: r.description };
  }
  if (p.style === "rubika") {
    const base = (conn.apiBase || p.apiBase || "").replace(/\/$/, "");
    const r = await fetchJson(`${base}/${conn.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return { ok: r.ok && r.json.status !== "ERROR", description: typeof r.json.message === "string" ? r.json.message : undefined };
  }
  if (p.style === "whatsapp") {
    // برچسب اتصال = Phone Number ID متا؛ chatId = شمارهٔ موبایل گیرنده (E.164 بدون +)
    const phoneId = conn.label.trim();
    const to = chatId.replace(/[^0-9]/g, "");
    const r = await fetchJson(`${p.apiBase}/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    const err = r.json.error as { message?: string } | undefined;
    return { ok: r.ok, description: err?.message };
  }
  // webhook عمومی
  const url = (conn.apiBase || "").trim();
  if (!url) return { ok: false, description: "no webhook url" };
  const r = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.token}` },
    body: JSON.stringify({ chatId, text }),
  });
  return { ok: r.ok, description: r.ok ? undefined : `HTTP ${r.status}` };
}

/** اعتبارسنجی اتصال هنگام ساخت: برای سبک تلگرام getMe؛ بقیه بدون فراخوانی (تست جدا دارد) */
export async function probeConnection(
  conn: Pick<BotConnectionRow, "platform" | "token" | "apiBase">,
): Promise<{ ok: boolean; username?: string; description?: string }> {
  const p = botPlatform(conn.platform);
  if (p.style === "telegram") {
    const r = await telegramStyleApi(conn, "getMe");
    const me = r.result as { username?: string } | undefined;
    return { ok: r.ok, username: me?.username, description: r.description };
  }
  if (p.style === "rubika") {
    const base = (conn.apiBase || p.apiBase || "").replace(/\/$/, "");
    const r = await fetchJson(`${base}/${conn.token}/getMe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = r.json.data as { bot?: { username?: string } } | undefined;
    return { ok: r.ok, username: data?.bot?.username, description: r.ok ? undefined : `HTTP ${r.status}` };
  }
  return { ok: true };
}

/** ثبت وب‌هوک روی پلتفرم (سبک تلگرام: setWebhook با secret_token؛ روبیکا: updateBotEndpoints) */
export async function registerWebhook(conn: BotConnectionRow, webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const p = botPlatform(conn.platform);
  if (p.style === "telegram") {
    const r = await telegramStyleApi(conn, "setWebhook", { url: webhookUrl, secret_token: conn.webhookSecret, allowed_updates: ["message"] });
    return { ok: r.ok, description: r.description };
  }
  if (p.style === "rubika") {
    const base = (conn.apiBase || p.apiBase || "").replace(/\/$/, "");
    const r = await fetchJson(`${base}/${conn.token}/updateBotEndpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${webhookUrl}?s=${conn.webhookSecret}`, type: "GetUpdates" }),
    });
    return { ok: r.ok, description: r.ok ? undefined : `HTTP ${r.status}` };
  }
  return { ok: true };
}

export function newWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/* ---------- کد پیوند چت ----------
   کد ۸کاراکتری از الفبای بدون ابهام؛ ۱۰ دقیقه اعتبار؛ یکبارمصرف. */
const LINK_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newLinkCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => LINK_ALPHABET[b % LINK_ALPHABET.length]).join("");
}
export const LINK_CODE_TTL_MS = 10 * 60_000;

/* ---------- اعتبارسنجی initData مینی‌اپ (پروتکل تلگرام WebApp) ----------
   secret = HMAC_SHA256(key="WebAppData", msg=botToken)
   hash = HMAC_SHA256(key=secret, msg=data_check_string) به هگز */
export function validateWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 24 * 3600,
): { ok: true; userId: string; username?: string } | { ok: false; reason: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no hash" };
  params.delete("hash");
  const pairs: string[] = [];
  params.forEach((v, k) => pairs.push(`${k}=${v}`));
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!safeEqual(computed, hash.toLowerCase())) return { ok: false, reason: "bad hash" };
  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return { ok: false, reason: "expired" };
  let user: { id?: number | string; username?: string } | null = null;
  try {
    user = JSON.parse(params.get("user") ?? "null") as { id?: number | string; username?: string } | null;
  } catch {
    user = null;
  }
  if (!user?.id) return { ok: false, reason: "no user" };
  return { ok: true, userId: String(user.id), username: user.username };
}

/* ---------- پخش اعلان بهار روی ربات‌های پیوندخورده ----------
   از notifyUser صدا زده می‌شود؛ هرگز نباید اعلان اصلی را بشکند. */
export async function dispatchNotificationToBots(args: {
  userId: string;
  category: "URGENT" | "IMPORTANT" | "INFO" | "SUCCESS";
  title: string;
  body: string;
  link?: string;
  origin?: string;
}): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: args.userId }, select: { schoolId: true, phone: true } });
    if (!user?.schoolId) return;
    const links = await db.botLink.findMany({
      where: { userId: args.userId, chatId: { not: null } },
      include: { connection: true },
    });
    if (!links.length) return;
    const text = `${args.title}\n${args.body}`;
    for (const link of links) {
      const conn = link.connection;
      if (!conn.isActive || conn.schoolId !== user.schoolId) continue;
      if (conn.events === "NONE") continue;
      if (conn.events === "IMPORTANT" && args.category !== "URGENT" && args.category !== "IMPORTANT") continue;
      const p = botPlatform(conn.platform);
      const chatId = p.style === "whatsapp" ? (user.phone ?? "") : (link.chatId ?? "");
      if (!chatId) continue;
      const webAppUrl = p.miniApp && args.origin ? `${args.origin}/miniapp?c=${conn.id}` : undefined;
      await sendBotMessage(conn as BotConnectionRow, chatId, text, { webAppUrl }).catch(() => undefined);
    }
  } catch (e) {
    console.error("[BOTS dispatch]", e);
  }
}
