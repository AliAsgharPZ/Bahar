import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { botPlatform, newLinkCode, LINK_CODE_TTL_MS } from "@/lib/bots";

/**
 * POST /api/bots/link — ساخت/تازه‌سازی کد پیوند برای کاربر جاری روی یک اتصال.
 * کاربر کد را در ربات با ‎/start‎ می‌فرستد و چتش به حسابش وصل می‌شود.
 * برای واتس‌اپ پیوند = شمارهٔ موبایل پروفایل (بدون کد).
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ connectionId?: string }>(req);
    const conn = await db.botConnection.findUnique({ where: { id: String(body.connectionId ?? "") } });
    if (!conn || !conn.isActive) return apiErr(404, "اتصال یافت نشد یا فعال نیست.", "NOT_FOUND");
    if (me.schoolId && conn.schoolId !== me.schoolId) return apiErr(403, "این اتصال برای مدرسهٔ شما نیست.", "FORBIDDEN");
    const p = botPlatform(conn.platform);

    const existing = await db.botLink.findFirst({ where: { connectionId: conn.id, userId: me.id } });
    if (existing?.chatId) return apiOk({ linked: true, chatId: existing.chatId });

    if (p.style === "whatsapp") {
      const meRow = await db.user.findUnique({ where: { id: me.id }, select: { phone: true } });
      if (!meRow?.phone) return apiErr(400, "برای واتس‌اپ، اول شمارهٔ موبایل را در پروفایل ثبت کنید.", "NO_PHONE");
      const link = existing
        ? await db.botLink.update({ where: { id: existing.id }, data: { chatId: meRow.phone, linkCode: null, codeExpiresAt: null } })
        : await db.botLink.create({ data: { connectionId: conn.id, userId: me.id, chatId: meRow.phone } });
      return apiOk({ linked: true, chatId: link.chatId });
    }
    if (!p.inbound) return apiErr(400, "این پلتفرم پیوند چت ندارد و فقط برای ارسال یک‌طرفه است.", "NO_LINK");

    const code = newLinkCode();
    const expires = new Date(Date.now() + LINK_CODE_TTL_MS);
    const link = existing
      ? await db.botLink.update({ where: { id: existing.id }, data: { linkCode: code, codeExpiresAt: expires } })
      : await db.botLink.create({ data: { connectionId: conn.id, userId: me.id, linkCode: code, codeExpiresAt: expires } });
    const deepLink = conn.botUsername
      ? p.id === "BALE"
        ? `https://ble.ir/${conn.botUsername}?start=${code}`
        : p.id === "TELEGRAM"
          ? `https://t.me/${conn.botUsername}?start=${code}`
          : null
      : null;
    return apiOk({ linked: false, code, expiresAt: link.codeExpiresAt, deepLink, botUsername: conn.botUsername });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/bots/link?id= — قطع پیوند خود کاربر */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const link = await db.botLink.findFirst({ where: { id, userId: me.id } });
    if (!link) return apiErr(404, "پیوند یافت نشد.", "NOT_FOUND");
    await db.botLink.delete({ where: { id: link.id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
