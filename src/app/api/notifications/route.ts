import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson } from "@/lib/api";

/** GET /api/notifications — اعلان‌های کاربر جاری + شمارش دسته‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const where: Record<string, unknown> = { userId: me.id };
    if (category && ["URGENT", "IMPORTANT", "INFO", "SUCCESS"].includes(category)) {
      where.category = category;
    }
    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      db.notification.groupBy({
        by: ["category"],
        where: { userId: me.id, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = { URGENT: 0, IMPORTANT: 0, INFO: 0, SUCCESS: 0 };
    for (const g of unread) counts[g.category] = g._count._all;
    return apiOk({
      notifications: items,
      counts,
      unreadTotal: Object.values(counts).reduce((s, n) => s + n, 0),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/notifications — علامت‌گذاری خوانده‌شده */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{ id?: string; all?: boolean }>(req);
    if (body.all) {
      await db.notification.updateMany({
        where: { userId: me.id, readAt: null },
        data: { readAt: new Date() },
      });
      return apiOk({ ok: true });
    }
    if (!body.id) return apiErr(400, "شناسه اعلان لازم است.", "BAD_REQUEST");
    await db.notification.updateMany({
      where: { id: body.id, userId: me.id },
      data: { readAt: new Date() },
    });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    await db.notification.deleteMany({ where: { id, userId: me.id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
