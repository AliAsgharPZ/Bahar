import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const LEAVE_KINDS: Record<string, string> = {
  PERSONAL: "شخصی",
  SICK: "استعلاجی",
  MISSION: "مأموریت",
  UNPAID: "بدون حقوق",
};

/** GET /api/leaves — درخواست‌های مرخصی */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const isManagerish = me.role === "MANAGER" || me.role === "SUPER_ADMIN" || me.role === "ADMIN" || me.role === "DEPUTY";
    const canReview = me.role === "MANAGER" || me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const where: Record<string, unknown> = {};
    if (!isManagerish) {
      where.userId = me.id;
    } else if (me.schoolId && me.role !== "SUPER_ADMIN") {
      where.schoolId = me.schoolId;
    }
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) where.status = status;
    const leaves = await db.leaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { firstName: true, lastName: true, role: true, nationalId: true } } },
    });
    return apiOk({ leaves, kinds: LEAVE_KINDS, canReview });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/leaves — ثبت درخواست یا پاسخ */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      action: "request" | "respond";
      kind?: string;
      fromDate?: string;
      toDate?: string;
      reason?: string;
      leaveId?: string;
      status?: string;
      reviewNote?: string;
    }>(req);

    if (body.action === "respond") {
      if (!body.leaveId || !body.status) return apiErr(400, "شناسه و وضعیت لازم است.", "BAD_REQUEST");
      const leave = await db.leaveRequest.findUnique({ where: { id: body.leaveId } });
      if (!leave) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
      // پاسخ فقط توسط مدیر همان مدرسه (یا نقش سرویس در پنل همان مدرسه)
      const acting = actingSchoolIdFor(req, me);
      const sameSchool = (!!me.schoolId && leave.schoolId === me.schoolId) || (!!acting && leave.schoolId === acting);
      const isManagerish = me.role === "MANAGER" || me.role === "SUPER_ADMIN" || me.role === "ADMIN";
      if (!isManagerish || !sameSchool) return apiErr(403, "فقط مدیر مدرسه می‌تواند پاسخ دهد.", "FORBIDDEN");
      // FIX (راند ۱۶): وضعیت نامعتبر → 400
      if (!["APPROVED", "REJECTED"].includes(body.status)) {
        return apiErr(400, "وضعیت پاسخ نامعتبر است (APPROVED | REJECTED).", "BAD_STATUS");
      }
      const updated = await db.leaveRequest.update({
        where: { id: body.leaveId },
        data: {
          status: body.status,
          reviewNote: body.reviewNote ?? null,
        },
      });
      await notifyUser(
        leave.userId,
        body.status === "APPROVED" ? "SUCCESS" : "IMPORTANT",
        body.status === "APPROVED" ? "مرخصی تأیید شد" : "مرخصی رد شد",
        `از ${leave.fromDate.toLocaleDateString("fa-IR")} تا ${leave.toDate.toLocaleDateString("fa-IR")}${body.reviewNote ? ` — ${body.reviewNote}` : ""}`,
        "/app/leaves"
      );
      await audit({ user: me, action: "پاسخ درخواست مرخصی", entityType: "LeaveRequest", entityId: leave.id, meta: { status: body.status } });
      return apiOk({ leave: updated });
    }

    // request
    if (!body.fromDate || !body.toDate) return apiErr(400, "بازه تاریخ لازم است.", "BAD_REQUEST");
    const from = new Date(body.fromDate);
    const to = new Date(body.toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return apiErr(400, "بازه تاریخ مرخصی نامعتبر است.", "BAD_DATE");
    }
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
      return apiErr(400, "بازه تاریخ نامعتبر است.", "BAD_RANGE");
    }
    if (!me.schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");
    const leave = await db.leaveRequest.create({
      data: {
        schoolId: me.schoolId,
        userId: me.id,
        kind: LEAVE_KINDS[body.kind ?? ""] ? body.kind! : "PERSONAL",
        fromDate: from,
        toDate: to,
        reason: body.reason ?? null,
      },
    });
    const school = await db.school.findUnique({ where: { id: me.schoolId }, select: { managerId: true, name: true } });
    if (school?.managerId) {
      await notifyUser(school.managerId, "IMPORTANT", "درخواست مرخصی جدید", `${me.firstName} ${me.lastName} — ${LEAVE_KINDS[leave.kind]}`, "/app/leaves");
    }
    await audit({ user: me, action: "ثبت درخواست مرخصی", entityType: "LeaveRequest", entityId: leave.id });
    // تریگر اتوماسیون: درخواست مرخصی جدید
    try {
      const { runAutomations } = await import("@/lib/automation");
      await runAutomations({ type: "LEAVE_REQUEST", schoolId: me.schoolId, requesterName: `${me.firstName} ${me.lastName}`, leaveId: leave.id });
    } catch { /* اتوماسیون نباید جریان اصلی را بشکند */ }
    return apiOk({ leave });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.leaveRequest.findUnique({ where: { id }, select: { schoolId: true, userId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId && row.userId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (!me.schoolId && row.userId !== me.id && !["SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.leaveRequest.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
