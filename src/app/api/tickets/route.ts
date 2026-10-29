import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, uniqueTicketCode, rateLimit, demoWriteBlock} from "@/lib/api";
import { hasPermission } from "@/lib/roles";

// ============================================================
// تیکت پشتیبانی — کاربران به ادمین‌های سرویس تیکت می‌زنند
// ============================================================

export const TICKET_CATEGORIES: Record<string, string> = {
  GENERAL: "عمومی",
  TECHNICAL: "مشکل فنی",
  BILLING: "پرداخت و مالی",
  DEMO: "درخواست دمو",
  SUGGESTION: "پیشنهاد",
};



/** GET /api/tickets?status=&mine=1 — کاربر: تیکت‌های خودش؛ ادمین با view_tickets: همه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!rateLimit(`ticket:${me.id}`, 10, 60000)) {
      return apiErr(429, "ثبت تیکت‌های پی‌درپی؛ کمی صبر کنید.", "RATE_LIMITED");
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const scope = searchParams.get("scope") ?? "mine";

    const isStaff = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && hasPermission(me, "view_tickets"));

    // غیرکارمندان پشتیبانی همیشه فقط تیکت‌های خودشان را می‌بینند (مستقل از مقدار scope)
    const where: Record<string, unknown> = {};
    if (!isStaff || scope === "mine") where.userId = me.id;
    if (status) where.status = status;
    if (category) where.category = category;

    const rows = await db.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true, schoolId: true, school: { select: { name: true } } } },
        messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { firstName: true, lastName: true, role: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return apiOk({
      tickets: rows.map((t) => ({
        id: t.id,
        code: t.code,
        subject: t.subject,
        category: t.category,
        categoryLabel: TICKET_CATEGORIES[t.category] ?? t.category,
        priority: t.priority,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        requester: t.user
          ? {
              name: `${t.user.firstName} ${t.user.lastName}`,
              role: t.user.role,
              schoolName: t.user.school?.name ?? null,
            }
          : null,
        messageCount: t.messages.length,
        lastReply: t.messages.length ? t.messages[t.messages.length - 1] : null,
        messages: t.messages,
      })),
      isStaff,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/tickets — تیکت جدید (همه کاربران لاگین‌شده) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<{ subject?: string; category?: string; priority?: string; message?: string }>(req);
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (subject.length < 3) throw new ApiError(400, "BAD_SUBJECT", "موضوع تیکت را کامل بنویسید.");
    if (message.length < 10) throw new ApiError(400, "BAD_MESSAGE", "شرح مشکل حداقل ۱۰ نویسه باشد.");

    const cat = TICKET_CATEGORIES[body.category ?? ""] ? String(body.category) : "GENERAL";
    const pr = ["LOW", "NORMAL", "HIGH"].includes(String(body.priority)) ? String(body.priority) : "NORMAL";

    const ticket = await db.ticket.create({
      data: {
        code: await uniqueTicketCode(),
        userId: me.id,
        subject,
        category: cat,
        priority: pr,
        status: "OPEN",
        schoolId: me.schoolId,
      },
    });
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: me.id, body: message, fromAdmin: false },
    });

    await audit({ user: me, action: "CREATE_TICKET", entityType: "TICKET", entityId: ticket.id, meta: { code: ticket.code, subject } });
    return apiOk({ ok: true, ticket: { id: ticket.id, code: ticket.code } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.ticket.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.ticket.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
