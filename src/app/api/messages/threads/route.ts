import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError } from "@/lib/api";
import { avatarApiFields } from "@/lib/avatar";

/** GET /api/messages/threads — فهرست گفتگوها با آخرین پیام و شمار نخوانده */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);

    const sent = await db.message.findMany({ where: { senderId: me.id }, select: { recipientId: true } });
    const received = await db.message.findMany({ where: { recipientId: me.id }, select: { senderId: true } });
    const partnerIds = [...new Set([...sent.map((m) => m.recipientId), ...received.map((m) => m.senderId)])];

    if (partnerIds.length === 0) return apiOk({ threads: [] });

    const partners = await db.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, firstName: true, lastName: true, role: true, isActive: true, profileImageType: true, photoUrl: true, avatarConfig: true },
    });

    // شمار نخوانده‌ها — تجمیع گروهی به‌جای بارگذاری همه پیام‌ها
    const unreadAgg = await db.message.groupBy({
      by: ["senderId"],
      where: { recipientId: me.id, readAt: null },
      _count: { _all: true },
    });
    const unreadMap = new Map<string, number>(unreadAgg.map((r) => [r.senderId, r._count._all]));

    // آخرین پیام هر گفتگو — یک کوئری کوچک به‌ازای هر شریک (به‌جای بارگذاری کل تاریخچه)
    const lastList = await Promise.all(
      partnerIds.map((pid) =>
        db.message.findFirst({
          where: {
            OR: [
              { senderId: me.id, recipientId: pid },
              { senderId: pid, recipientId: me.id },
            ],
          },
          orderBy: { sentAt: "desc" },
          select: { body: true, sentAt: true, senderId: true },
        })
      )
    );
    const lastByPartner = new Map(partnerIds.map((pid, i) => [pid, lastList[i]]));

    const threads = partnerIds.map((pid) => {
      const partner = partners.find((p) => p.id === pid);
      const last = lastByPartner.get(pid) ?? null;
      return {
        partner: partner
          ? { id: partner.id, firstName: partner.firstName, lastName: partner.lastName, role: partner.role, ...avatarApiFields(partner) }
          : { id: pid, firstName: "کاربر", lastName: "حذف‌شده", role: "?" },
        lastMessage: last ? { body: last.body, sentAt: last.sentAt, mine: last.senderId === me.id } : null,
        unread: unreadMap.get(pid) ?? 0,
      };
    }).sort((a, b) => {
      const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt).getTime() : 0;
      const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt).getTime() : 0;
      return bt - at;
    });

    return apiOk({ threads });
  } catch (e) {
    return handleApiError(e);
  }
}
