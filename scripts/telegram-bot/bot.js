#!/usr/bin/env node
/* ============================================================
   بهار | ربات تلگرام — Bahar Telegram Bot
   بدون هیچ وابستگی — فقط Node.js 18+ (fetch داخلی)

   راه‌اندازی:
   1. از @BotFather ربات بسازید و توکن را بردارید.
   2. توکن را در «تنظیمات سامانه ← ربات تلگرام» پنل سوپرادمین بهار وارد کنید.
   3. در همین پوشه:  cp config.example.json config.json
      و مقدار api را آدرس سایت بهار خود بگذارید.
   4. اجرا:  node bot.js

   معماری: ربات ← (x-bot-token) → API سایت بهار (/api/telegram)
   ============================================================ */

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "config.json");
let config = { api: "http://localhost:3000", token: "" };
try {
  config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
} catch { /* config.json optional */ }

const TOKEN = process.env.BOT_TOKEN || config.token;
const API = (process.env.BAHAR_API || config.api).replace(/\/$/, "");
const API_PATH = `${API}/api/telegram`;

if (!TOKEN) {
  console.error("✗ توکن ربات یافت نشد. آن را در config.json یا متغیر BOT_TOKEN بگذارید.");
  process.exit(1);
}

const TG = (method, body) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const api = (action, payload) =>
  fetch(API_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bot-token": TOKEN },
    body: JSON.stringify({ action, ...payload }),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

/* ── کیبورد دستورات ── */
const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🌅 خلاصه امروز" }, { text: "👤 پروفایل من" }],
    [{ text: "📚 نمرات" }, { text: "📋 حضور و غیاب" }],
    [{ text: "📅 برنامه امروز" }, { text: "📝 تکالیف" }],
    [{ text: "💳 شهریه" }, { text: "🔔 اعلان‌ها" }],
    [{ text: "👨‍👩‍👧‍👦 فرزندانم" }, { text: "❓ راهنما" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const COMMAND_MAP = {
  "/start": "help",
  "/help": "help",
  "/me": "me",
  "/profile": "me",
  "/grades": "grades",
  "/attendance": "attendance",
  "/schedule": "schedule",
  "/assignments": "assignments",
  "/fees": "fees",
  "/notifications": "notifications",
  "/children": "children",
  "/digest": "digest",
  "راهنما": "help",
  "❓ راهنما": "help",
  "پروفایل من": "me",
  "👤 پروفایل من": "me",
  "نمرات": "grades",
  "📚 نمرات": "grades",
  "حضور و غیاب": "attendance",
  "📋 حضور و غیاب": "attendance",
  "برنامه امروز": "schedule",
  "📅 برنامه امروز": "schedule",
  "تکالیف": "assignments",
  "📝 تکالیف": "assignments",
  "شهریه": "fees",
  "💳 شهریه": "fees",
  "اعلان‌ها": "notifications",
  "🔔 اعلان‌ها": "notifications",
  "فرزندانم": "children",
  "👨‍👩‍👧‍👦 فرزندانم": "children",
  "خلاصه امروز": "digest",
  "🌅 خلاصه امروز": "digest",
};

async function handleUpdate(update) {
  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = String(msg.chat.id);
  const username = msg.from?.username ?? null;
  const text = msg.text.trim();

  /* پیوند حساب: /start ABCD1234 */
  const startMatch = text.match(/^\/start\s+([A-Za-z0-9]{6,10})$/);
  if (startMatch) {
    const res = await api("link", { chatId, username, code: startMatch[1].toUpperCase() });
    const message = res.data?.message ?? "خطا در پیوند حساب.";
    await TG("sendMessage", { chat_id: chatId, text: message, reply_markup: MAIN_KEYBOARD });
    return;
  }

  if (text === "/unlink") {
    const res = await api("unlink", { chatId });
    await TG("sendMessage", { chat_id: chatId, text: res.data?.message ?? "قطع شد." });
    return;
  }

  const cmd = COMMAND_MAP[text] ?? COMMAND_MAP[text.replace(/^\/\w+\s*$/, "").trim()];
  if (!cmd) {
    await TG("sendMessage", {
      chat_id: chatId,
      text: "دستور را متوجه نشدم. برای دیدن دستورات «راهنما» یا /help را بزنید.",
      reply_markup: MAIN_KEYBOARD,
    });
    return;
  }

  const res = await api("data", { chatId, cmd });
  if (res.status === 401) {
    await TG("sendMessage", {
      chat_id: chatId,
      text: "ربات هنوز از پنل سوپرادمین فعال نشده است. توکن را در «تنظیمات سامانه ← ربات تلگرام» وارد و فعال کنید.",
    });
    return;
  }
  const message = res.data?.message ?? "خطا در دریافت داده.";
  await TG("sendMessage", { chat_id: chatId, text: message, reply_markup: MAIN_KEYBOARD });
}

/* ── Poll loop ── */
let offset = 0;
async function poll() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?timeout=30&offset=${offset}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update).catch((e) => console.error("update error:", e.message));
      }
    }
  } catch (e) {
    console.error("poll error:", e.message);
    await new Promise((r) => setTimeout(r, 3000));
  }
  setTimeout(poll, 300);
}

/* ── Push loop: اعلان‌های جدید کاربران پیوندشده ── */
const lastPush = new Map();
async function pushLoop() {
  try {
    // poll API برای همه لینک‌ها: ربات لیست chatId ها را نمی‌داند؛
    // به‌جایش هر پیام دریافتی push خودش را می‌گیرد. برای push فعال:
    // در آینده می‌توان webhook اضافه کرد.
  } catch (e) { /* خالی */ }
  setTimeout(pushLoop, 30000);
}

(async () => {
  const me = await TG("getMe", {});
  if (!me.ok) {
    console.error("✗ توکن تلگرام نامعتبر است:", me.description);
    process.exit(1);
  }
  console.log(`✓ ربات «${me.result.first_name}» فعال شد (@${me.result.username})`);
  console.log(`✓ متصل به API بهار: ${API_PATH}`);
  await TG("setCommands", {
    commands: [
      { command: "start", description: "شروع و پیوند حساب" },
      { command: "digest", description: "خلاصه امروز" },
      { command: "grades", description: "نمرات" },
      { command: "attendance", description: "حضور و غیاب" },
      { command: "schedule", description: "برنامه امروز" },
      { command: "assignments", description: "تکالیف" },
      { command: "fees", description: "شهریه" },
      { command: "notifications", description: "اعلان‌ها" },
      { command: "children", description: "فرزندانم (والد)" },
      { command: "unlink", description: "قطع پیوند حساب" },
    ],
  });
  poll();
})();
