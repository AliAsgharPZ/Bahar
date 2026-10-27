import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/tickets/[id] — افزودن پیام به گفتگوی تیکت */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const body = await readJson<{ body?: string }>(req);
    const text = String(body.body ?? "").trim();
    if (text.length < 2) throw new ApiError(400, "BAD_MESSAGE", "متن پیام خالی است.");

    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) throw new ApiError(404, "NOT_FOUND", "تیکت یافت نشد.");

    const isStaff = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && hasPermission(me, "reply_tickets"));
    if (!isStaff && ticket.userId !== me.id) {
      throw new ApiError(403, "FORBIDDEN", "این تیکت متعلق به شما نیست.");
    }
    if (isStaff && !hasPermission(me, "reply_tickets") && me.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "دسترسی پاسخ تیکت ندارید.");
    }

    await db.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: me.id, body: text.slice(0, 3000), fromAdmin: isStaff },
    });
    await db.ticket.update({
      where: { id: ticket.id },
      data: { status: isStaff ? "ANSWERED" : "OPEN", updatedAt: new Date() },
    });

    await audit({ user: me, action: "TICKET_REPLY", entityType: "TICKET", entityId: ticket.id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/tickets/[id] — تغییر وضعیت (بستن/باز کردن) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const body = await readJson<{ status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["OPEN", "ANSWERED", "CLOSED"].includes(status)) {
      throw new ApiError(400, "BAD_STATUS", "وضعیت نامعتبر است.");
    }

    const ticket = await db.ticket.findUnique({ where: { id } });
    if (!ticket) throw new ApiError(404, "NOT_FOUND", "تیکت یافت نشد.");

    const isStaff = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && hasPermission(me, "close_tickets"));
    if (!isStaff && ticket.userId !== me.id) {
      throw new ApiError(403, "FORBIDDEN", "این تیکت متعلق به شما نیست.");
    }
    if (ticket.userId === me.id && status === "ANSWERED") {
      throw new ApiError(400, "BAD_STATUS", "وضعیت «پاسخ داده‌شده» را پشتیبانی تعیین می‌کند.");
    }

    await db.ticket.update({ where: { id }, data: { status, updatedAt: new Date() } });
    await audit({ user: me, action: "TICKET_STATUS", entityType: "TICKET", entityId: ticket.id, meta: { status } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/tickets/[id] — حذف تیکت و گفتگویش (صاحب تیکت یا مدیر) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const ticket = await db.ticket.findUnique({ where: { id }, select: { userId: true, schoolId: true } });
    if (!ticket) return apiErr(404, "تیکت یافت نشد.", "NOT_FOUND");
    const isStaff = ["MANAGER", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    if (!isStaff && ticket.userId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (isStaff && me.schoolId && ticket.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.ticketMessage.deleteMany({ where: { ticketId: id } });
    await db.ticket.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
