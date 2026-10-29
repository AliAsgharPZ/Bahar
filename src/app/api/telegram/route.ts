import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { randomBytes } from "crypto";
import { handleBotAction, type BotAction } from "@/lib/telegram-core";

/* ============================================================
   بهار | API ربات تلگرام — احراز با توکن ربات از تنظیمات
   دو حالت اجرا (راند ۱۹):
   ۱) ربات standalone (scripts/telegram-bot) با هدر x-bot-token
   ۲) وب‌هوک /api/telegram/webhook — منطق مشترک در lib/telegram-core
   ============================================================ */

async function botAuth(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-bot-token") ?? "";
  if (!token) return false;
  const s = await getSettings();
  // مقایسهٔ زمان-ثابت در برابر حملهٔ زمانی (timing attack)
  if (!s.telegramBotEnabled || !s.telegramBotToken || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(s.telegramBotToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** POST /api/telegram — عملیات ربات (link / unlink / data / poll) */
export async function POST(req: NextRequest) {
  try {
    if (!(await botAuth(req))) return apiErr(401, "توکن ربات نامعتبر است.", "BOT_UNAUTHORIZED");
    const body = await readJson<{
      action: "link" | "unlink" | "data" | "poll";
      chatId: string;
      username?: string;
      code?: string;
      cmd?: string;
      offset?: number;
    }>(req);
    if (!body.chatId) return apiErr(400, "chatId لازم است.", "BAD_REQUEST");

    // منطق مشترک با وب‌هوک — lib/telegram-core
    const r = await handleBotAction({
      action: body.action,
      chatId: body.chatId,
      username: body.username,
      code: body.code,
      cmd: body.cmd,
    } as BotAction);
    return NextResponse.json(r.data as Record<string, unknown>, { status: r.status });
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/telegram — وضعیت ربات (سلامت) */
export async function GET(req: NextRequest) {
  try {
    if (!(await botAuth(req))) return apiErr(401, "توکن ربات نامعتبر است.", "BOT_UNAUTHORIZED");
    const links = await db.telegramLink.count();
    return apiOk({ ok: true, linked: links });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/telegram — تولید کد پیوند جدید (کاربر لاگین‌شده از پروفایل) */
export async function PUT(req: NextRequest) {
  try {
    const { getSessionUser } = await import("@/lib/api");
    const me = await getSessionUser(req);
    if (!me) return apiErr(401, "برای این عملیات باید وارد شوید.", "UNAUTHORIZED");
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const code = randomBytes(4).toString("hex").toUpperCase();
    await db.telegramLink.upsert({
      where: { userId: me.id },
      update: { linkCode: code, chatId: `pending-${code}` },
      create: { userId: me.id, linkCode: code, chatId: `pending-${code}` },
    });
    return apiOk({ code });
  } catch (e) {
    return handleApiError(e);
  }
}
