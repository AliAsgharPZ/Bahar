import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

/** GET /api/meetings — ملاقات‌ها بر اساس نقش */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const where: Record<string, unknown> = {};
    if (me.role === "PARENT") where.requestedById = me.id;
    else if (me.role === "STUDENT") {
      // دانش‌آموز فقط ملاقات‌های مرتبط با خودش را می‌بیند
      const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      where.studentId = profile?.id ?? "__none__";
    }
    else if (me.role === "TEACHER" || me.role === "DEPUTY") where.staffId = me.id;
    else if (me.role === "MANAGER") {
      // مدیر بدون مدرسه → هیچ (نه همه مدارس)
      where.schoolId = me.schoolId ?? "__none__";
    } else {
      // نقش سرویس: اگر وارد پنل مدرسه شده فقط همان؛ وگرنه نمای کل سرویس
      const acting = actingSchoolIdFor(req, me);
      if (acting) where.schoolId = acting;
    }

    const meetings = await db.meeting.findMany({
      where,
      orderBy: { slotStart: "desc" },
      take: 80,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        staff: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    // کارکنان قابل رزرو برای والدین
    const staff = me.schoolId
      ? await db.user.findMany({
          where: { schoolId: me.schoolId, role: { in: ["TEACHER", "DEPUTY", "MANAGER"] }, isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true },
        })
      : [];
    const myKids = me.role === "PARENT"
      ? await db.studentParent.findMany({
          where: { parentUserId: me.id },
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        })
      : [];
    return apiOk({ meetings, staff, myKids });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/meetings — رزرو ملاقات (والد) یا پاسخ (کارمند) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      action: "request" | "respond";
      staffId?: string;
      studentId?: string;
      topic?: string;
      note?: string;
      slotStart?: string;
      slotEnd?: string;
      meetingId?: string;
      status?: string;
      reviewNote?: string;
    }>(req);

    if (body.action === "respond") {
      if (!body.meetingId || !body.status) return apiErr(400, "شناسه ملاقات و وضعیت لازم است.", "BAD_REQUEST");
      const m = await db.meeting.findUnique({ where: { id: body.meetingId } });
      if (!m) return apiErr(404, "ملاقات یافت نشد.", "NOT_FOUND");
      // کارمند مربوطه (هم‌مدرسه)، مدیر همان مدرسه، یا نقش سرویس در پنل همان مدرسه
      const acting = actingSchoolIdFor(req, me);
      const sameSchool = (!!me.schoolId && m.schoolId === me.schoolId) || (!!acting && m.schoolId === acting);
      const canRespondStaff = m.staffId === me.id && !!me.schoolId && m.schoolId === me.schoolId;
      const canRespondManager = (me.role === "MANAGER" || me.role === "SUPER_ADMIN" || me.role === "ADMIN") && sameSchool;
      // درخواست‌کننده می‌تواند درخواست در انتظارِ خودش را لغو کند
      const canCancelOwn = m.requestedById === me.id && body.status === "CANCELED" && m.status === "PENDING";
      if (!canRespondStaff && !canRespondManager && !canCancelOwn) {
        return apiErr(403, "فقط کارمند مربوطه، مدیر مدرسه یا خودِ درخواست‌کننده می‌تواند وضعیت را تغییر دهد.", "FORBIDDEN");
      }
      // FIX (راند ۱۶): وضعیت نامعتبر → 400 (قبلاً بی‌صدا PENDING می‌شد و یادداشت پاک می‌شد)
      if (!["APPROVED", "REJECTED", "DONE", "CANCELED"].includes(body.status)) {
        return apiErr(400, "وضعیت پاسخ نامعتبر است (APPROVED | REJECTED | DONE | CANCELED).", "BAD_STATUS");
      }
      const updated = await db.meeting.update({
        where: { id: body.meetingId },
        data: {
          status: body.status,
          reviewNote: body.reviewNote ?? null,
        },
      });
    await audit({ user: me, action: "پاسخ ملاقات", entityType: "Meeting", entityId: updated.id, schoolId: updated.schoolId, meta: { status: updated.status } });
      const labels: Record<string, string> = { APPROVED: "تأیید شد", REJECTED: "رد شد", DONE: "انجام شد", CANCELED: "لغو شد" };
      await notifyUser(
        m.requestedById,
        body.status === "APPROVED" ? "SUCCESS" : body.status === "REJECTED" ? "IMPORTANT" : "INFO",
        `درخواست ملاقات ${labels[body.status] ?? "بروزرسانی شد"}`,
        m.topic,
        "/app/meetings",
        "MEETING"
      );
      return apiOk({ meeting: updated });
    }

    // request
    if (me.role !== "PARENT") return apiErr(403, "فقط ولی می‌تواند ملاقات رزرو کند.", "FORBIDDEN");
    if (!body.staffId || !body.topic?.trim() || !body.slotStart || !body.slotEnd) {
      return apiErr(400, "کارمند، موضوع و بازه زمانی لازم است.", "BAD_REQUEST");
    }
    // کارمند مقصد باید پرسنل فعال همان مدرسه باشد
    const staff = await db.user.findFirst({
      where: { id: body.staffId, schoolId: me.schoolId ?? "", role: { in: ["TEACHER", "DEPUTY", "MANAGER"] }, isActive: true },
      select: { id: true },
    });
    if (!staff) return apiErr(400, "کارمند انتخاب‌شده معتبر نیست.", "BAD_STAFF");
    // دانش‌آموز مرتبط باید فرزند همین ولی باشد
    if (body.studentId) {
      const link = await db.studentParent.findFirst({
        where: { parentUserId: me.id, studentId: body.studentId },
        select: { id: true },
      });
      if (!link) return apiErr(403, "این دانش‌آموز به شما متصل نیست.", "FORBIDDEN");
    }
    const start = new Date(body.slotStart);
    const end = new Date(body.slotEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return apiErr(400, "بازه زمانی نامعتبر است.", "BAD_SLOT");
    }
    if (start < new Date()) return apiErr(400, "زمان ملاقات نمی‌تواند در گذشته باشد.", "PAST_SLOT");
    // تداخل با ملاقات تأییدشده دیگر همان کارمند
    const conflict = await db.meeting.findFirst({
      where: {
        staffId: body.staffId,
        status: { in: ["PENDING", "APPROVED"] },
        AND: [{ slotStart: { lt: end } }, { slotEnd: { gt: start } }],
      },
    });
    if (conflict) return apiErr(409, "این بازه با ملاقات دیگری تداخل دارد؛ زمان دیگری انتخاب کنید.", "SLOT_TAKEN");
    const meeting = await db.meeting.create({
      data: {
        schoolId: me.schoolId ?? "",
        studentId: body.studentId || null,
        requestedById: me.id,
        staffId: body.staffId,
        topic: body.topic,
        note: body.note ?? null,
        slotStart: start,
        slotEnd: end,
      },
    });
    await notifyUser(
      body.staffId,
      "IMPORTANT",
      "درخواست ملاقات جدید",
      `${me.firstName} ${me.lastName}: ${body.topic}`,
      "/app/meetings",
      "MEETING"
    );
    await audit({ user: me, action: "رزرو ملاقات", entityType: "Meeting", entityId: meeting.id });
    // تریگر اتوماسیون: درخواست ملاقات جدید
    try {
      const { runAutomations } = await import("@/lib/automation");
      await runAutomations({ type: "MEETING_REQUEST", schoolId: meeting.schoolId, requesterName: `${me.firstName} ${me.lastName}`, meetingId: meeting.id });
    } catch { /* اتوماسیون نباید جریان اصلی را بشکند */ }
    return apiOk({ meeting });
  } catch (e) {
    return handleApiError(e);
  }
}
