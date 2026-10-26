import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { handleBotAction, mapTelegramText, telegramApi, telegramWebhookSecret, MAIN_KEYBOARD } from "@/lib/telegram-core";

/* ============================================================
   بهار | وب‌هوک ربات تلگرام (راند ۱۹)
   POST /api/telegram/webhook — تلگرام مستقیم همین مسیر را صدا
   می‌زند؛ دیگر نیازی به اجرای پروسهٔ جدا (bot.js) نیست.
   احراز: هدر x-telegram-bot-api-secret-token (مشتق‌شده از توکن
   ربات و هنگام setWebhook به تلگرام داده شده) — بدون آن هیچ
   پردازشی انجام نمی‌شود.
   ============================================================ */

type TgUpdate = {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
    from?: { username?: string };
  };
};

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();
    if (!settings.telegramBotEnabled || !settings.telegramBotToken) {
      // ربات فعال نیست — 200 برمی‌گردانیم تا تلگرام retry نکند
      return NextResponse.json({ ok: true });
    }

    // ── احراز راز وب‌هوک ──
    const secret = telegramWebhookSecret(settings.telegramBotToken);
    const given = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
    if (given !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const update = (await req.json().catch(() => null)) as TgUpdate | null;
    if (!update?.message?.text) return NextResponse.json({ ok: true });

    const chatId = String(update.message.chat.id);
    const username = update.message.from?.username ?? undefined;
    const mapped = mapTelegramText(update.message.text);

    let reply: string;
    if (!mapped) {
      reply = "دستور را متوجه نشدم. برای دیدن دستورات «راهنما» یا /help را بزنید.";
    } else if (mapped.action === "link") {
      const r = await handleBotAction({ action: "link", chatId, username, code: mapped.code });
      reply = (r.data.message as string) ?? "خطا در پیوند حساب.";
    } else if (mapped.action === "unlink") {
      const r = await handleBotAction({ action: "unlink", chatId });
      reply = (r.data.message as string) ?? "قطع شد.";
    } else {
      const r = await handleBotAction({ action: "data", chatId, cmd: mapped.cmd });
      if (r.status === 401) {
        reply = "ربات هنوز از پنل سوپرادمین فعال نشده است. توکن را در «تنظیمات سامانه ← ربات تلگرام» وارد و فعال کنید.";
      } else {
        reply = (r.data.message as string) ?? "خطا در دریافت داده.";
      }
    }

    // پاسخ از طریق Bot API (پاسخ HTTP فقط وضعیت را می‌رساند)
    await telegramApi(settings.telegramBotToken, "sendMessage", {
      chat_id: chatId,
      text: reply,
      reply_markup: MAIN_KEYBOARD,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // خطای غیرمنتظره — 200 تا تلگرام بی‌پایان retry نکند
    return NextResponse.json({ ok: true });
  }
}

/** GET — بررسی سلامت (بدون افشای اطلاعات) */
export async function GET() {
  const links = await db.telegramLink.count().catch(() => 0);
  return NextResponse.json({ ok: true, service: "bahar-telegram-webhook", linked: links });
}
