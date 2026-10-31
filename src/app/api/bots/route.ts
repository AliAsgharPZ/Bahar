import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { BOT_PLATFORMS, botPlatform, probeConnection, registerWebhook, newWebhookSecret, type BotConnectionRow } from "@/lib/bots";

const STAFF = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}••••${token.slice(-3)}`;
}

function publicConnection(c: {
  id: string; platform: string; label: string; token: string; apiBase: string | null;
  botUsername: string | null; events: string; isActive: boolean; createdAt: Date;
  _count?: { links: number };
}) {
  const p = botPlatform(c.platform);
  return {
    id: c.id,
    platform: c.platform,
    platformName: p.nameFa,
    style: p.style,
    inbound: p.inbound,
    miniApp: p.miniApp,
    externalId: !!p.externalId,
    label: c.platform === "WHATSAPP" ? c.label : c.label,
    tokenMasked: maskToken(c.token),
    apiBase: c.apiBase,
    botUsername: c.botUsername,
    events: c.events,
    isActive: c.isActive,
    linksCount: c._count?.links ?? 0,
    createdAt: c.createdAt,
  };
}

/** GET /api/bots — اتصال‌های مدرسه (کارکنان) + پیوندهای خود کاربر + فهرست پلتفرم‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    let connections: ReturnType<typeof publicConnection>[] = [];
    if (isStaff && me.schoolId) {
      const rows = await db.botConnection.findMany({
        where: { schoolId: me.schoolId },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { links: true } } },
      });
      connections = rows.map(publicConnection);
    } else if (isStaff && !me.schoolId) {
      // مدیر سرویس بدون مدرسهٔ فعال: اتصالی نشان داده نمی‌شود (requireSchoolId در POST خطا می‌دهد)
      connections = [];
    }
    // برای کاربران عادی: فهرست عمومی اتصال‌های فعال مدرسه تا بتوانند پیوند بسازند
    let available: { id: string; platform: string; platformName: string; label: string; botUsername: string | null; style: string; inbound: boolean; externalId: boolean }[] = [];
    if (!isStaff && me.schoolId) {
      const rows = await db.botConnection.findMany({
        where: { schoolId: me.schoolId, isActive: true },
        select: { id: true, platform: true, label: true, botUsername: true },
        orderBy: { createdAt: "asc" },
      });
      available = rows.map((r) => {
        const p = botPlatform(r.platform);
        return { id: r.id, platform: r.platform, platformName: p.nameFa, label: r.label, botUsername: r.botUsername, style: p.style, inbound: p.inbound, externalId: !!p.externalId };
      });
    }
    const myLinks = await db.botLink.findMany({
      where: { userId: me.id },
      include: { connection: { select: { id: true, platform: true, label: true, botUsername: true, isActive: true, schoolId: true } } },
      orderBy: { createdAt: "asc" },
    });
    return apiOk({
      isStaff,
      available,
      platforms: BOT_PLATFORMS.map((p) => ({ id: p.id, name: p.nameFa, style: p.style, inbound: p.inbound, miniApp: p.miniApp, externalId: !!p.externalId, hint: p.hintFa, needsApiBase: p.id === "CUSTOM" || p.id === "WEBHOOK" || p.id === "MATRIX" })),
      connections,
      myLinks: myLinks.map((l) => ({
        id: l.id,
        connectionId: l.connectionId,
        platform: l.connection.platform,
        label: l.connection.label,
        botUsername: l.connection.botUsername,
        chatId: l.chatId,
        username: l.username,
        pending: !l.chatId,
        linkCode: l.chatId ? null : l.linkCode,
        codeExpiresAt: l.chatId ? null : l.codeExpiresAt,
        isActive: l.connection.isActive,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/bots — ساخت اتصال تازه (فقط کارکنان مدرسه) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ platform?: string; label?: string; token?: string; apiBase?: string; events?: string }>(req);
    const platform = botPlatform(String(body.platform ?? ""));
    if (!BOT_PLATFORMS.some((p) => p.id === body.platform)) return apiErr(400, "پلتفرم نامعتبر است.", "BAD_PLATFORM");
    const token = String(body.token ?? "").trim();
    if (!token) return apiErr(400, "توکن ربات لازم است.", "NO_TOKEN");
    const label = String(body.label ?? "").trim() || platform.nameFa;
    const apiBase = body.apiBase ? String(body.apiBase).trim() : null;
    if ((platform.id === "CUSTOM" || platform.id === "WEBHOOK" || platform.id === "MATRIX") && !apiBase) {
      return apiErr(400, "برای این پلتفرم، نشانی پایهٔ API لازم است.", "NO_API_BASE");
    }
    const events = ["ALL", "IMPORTANT", "NONE"].includes(String(body.events)) ? String(body.events) : "ALL";

    const probe = await probeConnection({ platform: platform.id, token, apiBase });
    if (!probe.ok) {
      return apiErr(400, `توکن از سوی ${platform.nameFa} پذیرفته نشد${probe.description ? `: ${probe.description}` : ""}`, "BAD_TOKEN");
    }

    const conn = await db.botConnection.create({
      data: {
        schoolId,
        platform: platform.id,
        label,
        token,
        apiBase,
        botUsername: probe.username ?? null,
        webhookSecret: newWebhookSecret(),
        events,
        createdById: me.id,
      },
    });

    // ثبت وب‌هوک برای پلتفرم‌های ورودی‌دار
    let webhookOk: boolean | null = null;
    if (platform.inbound) {
      const url = `${req.nextUrl.origin}/api/bots/webhook/${conn.id}`;
      const reg = await registerWebhook(conn as BotConnectionRow, url);
      webhookOk = reg.ok;
    }
    await audit({ user: me, action: "CREATE_BOT_CONNECTION", entityType: "BOT", entityId: conn.id, meta: { platform: platform.id }, schoolId });
    return apiOk({ connection: publicConnection({ ...conn, _count: { links: 0 } }), webhookOk });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/bots — ویرایش برچسب/رویدادها/فعال‌بودن یا ثبت دوبارهٔ وب‌هوک */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; label?: string; events?: string; isActive?: boolean; rewebhook?: boolean }>(req);
    const conn = await db.botConnection.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!conn) return apiErr(404, "اتصال یافت نشد.", "NOT_FOUND");
    const data: Record<string, unknown> = {};
    if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
    if (["ALL", "IMPORTANT", "NONE"].includes(String(body.events))) data.events = body.events;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    const updated = await db.botConnection.update({ where: { id: conn.id }, data });
    let webhookOk: boolean | null = null;
    if (body.rewebhook && botPlatform(conn.platform).inbound) {
      const url = `${req.nextUrl.origin}/api/bots/webhook/${conn.id}`;
      webhookOk = (await registerWebhook(updated as BotConnectionRow, url)).ok;
    }
    await audit({ user: me, action: "UPDATE_BOT_CONNECTION", entityType: "BOT", entityId: conn.id, schoolId });
    return apiOk({ connection: publicConnection(updated), webhookOk });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/bots?id= — حذف اتصال و پیوندهایش */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const conn = await db.botConnection.findFirst({ where: { id, schoolId } });
    if (!conn) return apiErr(404, "اتصال یافت نشد.", "NOT_FOUND");
    await db.botConnection.delete({ where: { id: conn.id } });
    await audit({ user: me, action: "DELETE_BOT_CONNECTION", entityType: "BOT", entityId: conn.id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
