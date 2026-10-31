import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { botPlatform, sendBotMessage, type BotConnectionRow } from "@/lib/bots";

/** POST /api/bots/test — فرستادن پیام آزمایشی به چت پیوندخوردهٔ خودِ کاربر روی یک اتصال */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ id?: string }>(req);
    const conn = await db.botConnection.findUnique({ where: { id: String(body.id ?? "") } });
    if (!conn || !conn.isActive) return apiErr(404, "اتصال یافت نشد یا فعال نیست.", "NOT_FOUND");
    if (me.schoolId && conn.schoolId !== me.schoolId) return apiErr(403, "این اتصال برای مدرسهٔ شما نیست.", "FORBIDDEN");
    const p = botPlatform(conn.platform);
    const link = await db.botLink.findFirst({ where: { connectionId: conn.id, userId: me.id, chatId: { not: null } } });
    let chatId = link?.chatId ?? "";
    if (p.style === "whatsapp") {
      const meRow = await db.user.findUnique({ where: { id: me.id }, select: { phone: true } });
      chatId = meRow?.phone ?? "";
    }
    if (!chatId) return apiErr(400, "اول چت خودتان را به همین اتصال پیوند بزنید.", "NO_LINK");
    const text = "🌱 پیام آزمایشی بهار\nاتصال ربات مدرسه درست کار می‌کند؛ اعلان‌های بهار از این پس همین‌جا می‌رسد.";
    const webAppUrl = p.miniApp ? `${req.nextUrl.origin}/miniapp?c=${conn.id}` : undefined;
    const res = await sendBotMessage(conn as BotConnectionRow, chatId, text, { webAppUrl });
    if (!res.ok) return apiErr(502, `ارسال ناموفق بود${res.description ? `: ${res.description}` : ""}`, "SEND_FAILED");
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
