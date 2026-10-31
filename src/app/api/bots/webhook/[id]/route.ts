import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { botPlatform, safeEqual, sendBotMessage, type BotConnectionRow } from "@/lib/bots";

type Ctx = { params: Promise<{ id: string }> };

type Incoming = { chatId: string; username?: string; text: string };

/** استخراج پیام از آپدیت تلگرام/بله یا روبیکا — هر دو شکل رایج */
function extractIncoming(body: Record<string, unknown>): Incoming | null {
  const msg = body.message as { chat?: { id?: number | string; username?: string }; from?: { username?: string }; text?: string } | undefined;
  if (msg?.chat?.id != null && typeof msg.text === "string") {
    return { chatId: String(msg.chat.id), username: msg.from?.username ?? msg.chat?.username, text: msg.text };
  }
  const nm = body.new_message as { chat_id?: string; sender_id?: string; text?: string } | undefined;
  if (nm && typeof nm.text === "string" && (nm.chat_id || nm.sender_id)) {
    return { chatId: String(nm.chat_id ?? nm.sender_id), text: nm.text };
  }
  return null;
}

/**
 * POST /api/bots/webhook/[id] — ورودی وب‌هوک پلتفرم برای یک اتصال.
 * راز در هدر secret_token (تلگرام/بله) یا پارامتر ‎?s=‎ (روبیکا) بررسی می‌شود.
 * دستورها: ‎/start <CODE>‎ پیوند، ‎/unlink‎ قطع پیوند، بقیه: راهنما + دکمهٔ مینی‌اپ.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const conn = await db.botConnection.findUnique({ where: { id } });
  if (!conn || !conn.isActive) return new Response("not found", { status: 404 });
  const given = req.headers.get("x-telegram-bot-api-secret-token") ?? req.nextUrl.searchParams.get("s") ?? "";
  if (!safeEqual(given, conn.webhookSecret)) return new Response("forbidden", { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const incoming = extractIncoming(body);
  if (!incoming) return Response.json({ ok: true });

  const row = conn as BotConnectionRow;
  const p = botPlatform(conn.platform);
  const origin = req.nextUrl.origin;
  const webAppUrl = p.miniApp ? `${origin}/miniapp?c=${conn.id}` : undefined;
  const reply = (text: string) => sendBotMessage(row, incoming.chatId, text, { webAppUrl }).catch(() => undefined);

  const text = incoming.text.trim();
  const startMatch = text.match(/^\/start\s+([A-Za-z0-9]{6,10})$/i);
  if (startMatch) {
    const code = startMatch[1].toUpperCase();
    const pending = await db.botLink.findFirst({ where: { connectionId: conn.id, linkCode: code } });
    if (!pending || (pending.codeExpiresAt && pending.codeExpiresAt.getTime() < Date.now())) {
      await reply("⏰ این کد پیوند معتبر نیست یا مهلتش گذشته است. از پنل بهار یک کد تازه بگیرید و دوباره ‎/start‎ کنید.");
      return Response.json({ ok: true });
    }
    const clash = await db.botLink.findFirst({ where: { connectionId: conn.id, chatId: incoming.chatId, NOT: { id: pending.id } } });
    if (clash) await db.botLink.delete({ where: { id: clash.id } });
    await db.botLink.update({
      where: { id: pending.id },
      data: { chatId: incoming.chatId, username: incoming.username ?? null, linkCode: null, codeExpiresAt: null },
    });
    const user = pending.userId ? await db.user.findUnique({ where: { id: pending.userId }, select: { firstName: true, lastName: true } }) : null;
    await reply(`✅ ${user ? `${user.firstName} ${user.lastName}` : "حساب شما"} به بهار وصل شد.\nاز این به بعد اعلان‌های مدرسه (حضور و غیاب، احضار، شهریه و…) همین‌جا می‌رسد.${webAppUrl ? "\nبا دکمهٔ زیر مینی‌اپ بهار را باز کنید." : ""}`);
    return Response.json({ ok: true });
  }

  if (text === "/unlink") {
    await db.botLink.deleteMany({ where: { connectionId: conn.id, chatId: incoming.chatId } });
    await reply("پیوند این چت با بهار قطع شد. برای اتصال دوباره از پنل بهار کد پیوند بگیرید.");
    return Response.json({ ok: true });
  }

  const linked = await db.botLink.findFirst({ where: { connectionId: conn.id, chatId: incoming.chatId, userId: { not: null } } });
  if (linked) {
    await reply(`این چت به حساب بهار شما وصل است و اعلان‌های مدرسه همین‌جا می‌رسد.${webAppUrl ? "\nبا دکمهٔ زیر مینی‌اپ بهار را باز کنید." : ""}\nبرای قطع پیوند: ‎/unlink‎`);
  } else {
    await reply("برای وصل کردن این چت به حساب بهار: وارد پنل بهار شوید، از بخش «ربات‌ها و مینی‌اپ» کد پیوند بگیرید و اینجا بفرستید:\n‎/start CODE‎");
  }
  return Response.json({ ok: true });
}
