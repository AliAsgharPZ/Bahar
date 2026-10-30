import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, requireSchoolId } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

/* ============================================================
   بهار | مدیریت امکانات مدرسه — یک API با kind های مختلف
   rooms | bookings | assets | maintenance | visitors | lostfound
   ============================================================ */

const ROOM_KINDS: Record<string, string> = { CLASSROOM: "کلاس", LAB: "آزمایشگاه", SPORT: "سالن ورزش", HALL: "سالن", CONFERENCE: "سالن همایش", FIELD: "زمین ورزشی", LIBRARY: "کتابخانه", OFFICE: "اداری", OTHER: "سایر" };
const ASSET_CATS: Record<string, string> = { PROJECTOR: "پروژکتور", LAPTOP: "لپ‌تاپ", COMPUTER: "کامپیوتر", SOUND: "صوتی", LAB: "تجهیز آزمایشگاه", FURNITURE: "مبلمان", OTHER: "سایر" };
const DOC_KINDS: Record<string, string> = {
  BIRTH_CERT: "شناسنامه", NATIONAL_ID: "کارت ملی", PHOTO: "عکس پرسنلی", HEALTH_INSURANCE: "بیمه سلامت",
  PREV_TRANSCRIPT: "کارنامه قبلی", RESIDENCE: "اقامت‌نامه/سند سکونت", GUARDIAN_ID: "مدارک ولی", OTHER: "سایر",
};

/** GET /api/facilities?kind=... — خواندن */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "rooms";
    const schoolId = me.schoolId;
    if (!schoolId) return apiOk({ kind, rooms: [], assets: [], bookings: [], tickets: [], visitors: [], lostItems: [] });
    // بخش‌های حاوی اطلاعات حساس (مهمان‌ها/دارایی‌ها) فقط برای کارکنان مدرسه
    const isStaff = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    if ((kind === "visitors" || kind === "assets" || kind === "maintenance") && !isStaff) {
      return apiErr(403, "این بخش فقط برای کارکنان مدرسه در دسترس است.", "FORBIDDEN");
    }

    if (kind === "rooms") {
      const [rooms, bookings] = await Promise.all([
        db.room.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
        db.booking.findMany({
          where: { schoolId, roomId: { not: null }, startAt: { gte: new Date(Date.now() - 7 * 86400000) } },
          orderBy: { startAt: "asc" },
          include: { room: { select: { name: true } }, by: { select: { firstName: true, lastName: true } } },
          take: 50,
        }),
      ]);
      return apiOk({ kind, rooms, bookings, roomKinds: ROOM_KINDS });
    }

    if (kind === "assets") {
      const assets = await db.asset.findMany({
        where: { schoolId },
        orderBy: { name: "asc" },
        include: { custodian: { select: { firstName: true, lastName: true } } },
      });
      return apiOk({ kind, assets, assetCats: ASSET_CATS });
    }

    if (kind === "maintenance") {
      const tickets = await db.maintenanceTicket.findMany({
        where: { schoolId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          asset: { select: { name: true, code: true } },
          reportedBy: { select: { firstName: true, lastName: true } },
        },
        take: 100,
      });
      // موارد عقب‌افتاده SLA
      const now = Date.now();
      const overdue = tickets.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED" && now - t.createdAt.getTime() > t.slaHours * 3600000);
      return apiOk({ kind, tickets, overdueCount: overdue.length, assets: await db.asset.findMany({ where: { schoolId }, select: { id: true, name: true, code: true } }) });
    }

    if (kind === "visitors") {
      const date = url.searchParams.get("date");
      const where: Record<string, unknown> = { schoolId };
      if (date) {
        const d0 = new Date(date + "T00:00:00");
        const d1 = new Date(date + "T23:59:59");
        where.expectedDate = { gte: d0, lte: d1 };
      }
      const visitors = await db.visitorLog.findMany({
        where: date ? where : { schoolId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      // مهمانان مورد انتظار امروز
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const today1 = new Date(); today1.setHours(23, 59, 59);
      const expectedToday = await db.visitorLog.count({
        where: { schoolId, expected: true, expectedDate: { gte: today0, lte: today1 }, status: "EXPECTED" },
      });
      return apiOk({ kind, visitors, expectedToday });
    }

    if (kind === "lostfound") {
      const lostItems = await db.lostFoundItem.findMany({ where: { schoolId }, orderBy: { foundAt: "desc" }, take: 100 });
      return apiOk({ kind, lostItems });
    }

    return apiErr(400, "نوع نامعتبر.", "BAD_KIND");
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/facilities — ایجاد رکورد بر اساس kind */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, unknown>>(req);
    const kind = String(body.kind ?? "");
    const isStaff = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(me.role);

    if (kind === "room") {
      if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (!body.name) return apiErr(400, "نام اتاق لازم است.", "BAD_REQUEST");
      const room = await db.room.create({
        data: { schoolId, name: String(body.name), kind: ROOM_KINDS[String(body.roomKind)] ? String(body.roomKind) : "CLASSROOM", capacity: Number(body.capacity) || 30, floor: body.floor ? Number(body.floor) : null, note: (body.note as string) ?? null },
      });
      await audit({ user: me, action: "ایجاد اتاق", entityType: "Room", entityId: room.id, schoolId, meta: { name: body.name } });
      return apiOk({ room });
    }

    if (kind === "booking") {
      if (!body.targetId || !body.startAt || !body.endAt || !body.purpose) {
        return apiErr(400, "هدف، بازه و دلیل رزرو لازم است.", "BAD_REQUEST");
      }
      const start = new Date(String(body.startAt));
      const end = new Date(String(body.endAt));
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return apiErr(400, "بازه نامعتبر است.", "BAD_RANGE");
      const isRoom = String(body.targetType) === "ROOM";
      // ⚠ اعتبارسنجی FK: هدف رزرو باید متعلق به همان مدرسه باشد (ارجاع بین‌مدرسه‌ای = ناسازگاری داده)
      const targetOk = isRoom
        ? await db.room.findFirst({ where: { id: String(body.targetId), schoolId }, select: { id: true } })
        : await db.asset.findFirst({ where: { id: String(body.targetId), schoolId }, select: { id: true } });
      if (!targetOk) return apiErr(404, "اتاق/دارایی رزرو یافت نشد.", "NOT_FOUND");
      // چک همپوشانی
      const overlap = await db.booking.findFirst({
        where: {
          schoolId,
          status: { in: ["PENDING", "APPROVED"] },
          AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
          ...(isRoom ? { roomId: String(body.targetId) } : { assetId: String(body.targetId) }),
        },
      });
      if (overlap) return apiErr(409, "این بازه با رزرو دیگری تداخل دارد.", "SLOT_TAKEN");
      const booking = await db.booking.create({
        data: {
          schoolId,
          roomId: isRoom ? String(body.targetId) : null,
          assetId: isRoom ? null : String(body.targetId),
          byId: me.id,
          purpose: String(body.purpose),
          startAt: start,
          endAt: end,
          note: (body.note as string) ?? null,
          status: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role) ? "APPROVED" : "PENDING",
        },
      });
      // FIX (الگوی خوابگاه): رزروِ هم‌زمانِ همان بازه — اگر رزروِ قدیمی‌تری برای همان هدف و بازه هست، تازه‌ساخته حذف و 409 می‌شود
      const earlierOverlap = await db.booking.findFirst({
        where: {
          schoolId,
          id: { not: booking.id },
          status: { in: ["PENDING", "APPROVED"] },
          AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
          ...(isRoom ? { roomId: String(body.targetId) } : { assetId: String(body.targetId) }),
        },
        orderBy: { createdAt: "asc" },
      });
      if (earlierOverlap) {
        try { await db.booking.delete({ where: { id: booking.id } }); } catch (compErr) { console.error("[FACILITIES] booking compensation failed", compErr); }
        return apiErr(409, "این بازه با رزرو دیگری تداخل دارد.", "SLOT_TAKEN");
      }
      await audit({ user: me, action: "رزرو " + (isRoom ? "اتاق" : "تجهیزات"), entityType: "Booking", entityId: booking.id, schoolId });
      return apiOk({ booking });
    }

    if (kind === "asset") {
      if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (!body.name || !body.code) return apiErr(400, "نام و کد دارایی لازم است.", "BAD_REQUEST");
      if (body.custodianId) {
        const cOk = await db.user.findFirst({ where: { id: String(body.custodianId), schoolId, isActive: true }, select: { id: true } });
        if (!cOk) return apiErr(400, "متصدی انتخاب‌شده در این مدرسه فعال نیست.", "BAD_CUSTODIAN");
      }
      const asset = await db.asset.create({
        data: {
          schoolId,
          name: String(body.name),
          code: String(body.code),
          category: ASSET_CATS[String(body.category)] ? String(body.category) : "OTHER",
          location: (body.location as string) ?? null,
          custodianId: (body.custodianId as string) || null,
          purchaseDate: body.purchaseDate ? new Date(String(body.purchaseDate)) : null,
          value: body.value ? Number(body.value) : null,
          note: (body.note as string) ?? null,
        },
      });
      await audit({ user: me, action: "ثبت دارایی", entityType: "Asset", entityId: asset.id, schoolId, meta: { code: body.code } });
      return apiOk({ asset });
    }

    if (kind === "maintenance") {
      if (!body.title) return apiErr(400, "عنوان خرابی لازم است.", "BAD_REQUEST");
      const slaHours = Number(body.slaHours) || 48;
      const ticket = await db.maintenanceTicket.create({
        data: {
          schoolId,
          assetId: (body.assetId as string) || null,
          roomId: (body.roomId as string) || null,
          location: (body.location as string) ?? null,
          title: String(body.title),
          description: (body.description as string) ?? null,
          priority: ["LOW", "NORMAL", "HIGH"].includes(String(body.priority)) ? String(body.priority) : "NORMAL",
          slaHours,
          reportedById: me.id,
        },
      });
      // اعلان به مدیر مدرسه
      const school = await db.school.findUnique({ where: { id: schoolId }, select: { managerId: true } });
      if (school?.managerId) {
        await notifyUser(school.managerId, "IMPORTANT", "خرابی جدید گزارش شد", String(body.title), "/app/facilities?tab=maintenance");
      }
      await audit({ user: me, action: "ثبت خرابی", entityType: "MaintenanceTicket", entityId: ticket.id, schoolId });
      return apiOk({ ticket });
    }

    if (kind === "visitor") {
      if (!isStaff) return apiErr(403, "ثبت مهمان فقط برای کارکنان مدرسه مجاز است.", "FORBIDDEN");
      if (!body.name || !body.purpose) return apiErr(400, "نام و دلیل مراجعه لازم است.", "BAD_REQUEST");
      const expected = body.expected === true;
      const v = await db.visitorLog.create({
        data: {
          schoolId,
          name: String(body.name),
          nationalId: (body.nationalId as string) || null,
          phone: (body.phone as string) || null,
          purpose: String(body.purpose),
          hostName: (body.hostName as string) ?? null,
          expected,
          expectedDate: body.expectedDate ? new Date(String(body.expectedDate)) : null,
          status: expected ? "EXPECTED" : "CHECKED_IN",
          checkInAt: expected ? null : new Date(),
          createdById: me.id,
        },
      });
      await audit({ user: me, action: "ثبت مهمان", entityType: "VisitorLog", entityId: v.id, schoolId, meta: { name: body.name } });
      return apiOk({ visitor: v });
    }

    if (kind === "lostfound") {
      if (!isStaff) return apiErr(403, "ثبت شیء مفقودی فقط برای کارکنان مدرسه مجاز است.", "FORBIDDEN");
      if (!body.title) return apiErr(400, "عنوان شیء لازم است.", "BAD_REQUEST");
      const item = await db.lostFoundItem.create({
        data: {
          schoolId,
          title: String(body.title),
          description: (body.description as string) ?? null,
          location: (body.location as string) ?? null,
          foundAt: body.foundAt ? new Date(String(body.foundAt)) : new Date(),
        },
      });
      await audit({ user: me, action: "ثبت شیء مفقودی", entityType: "LostFoundItem", entityId: item.id, schoolId, meta: { title: body.title } });
      return apiOk({ item });
    }

    return apiErr(400, "نوع نامعتبر.", "BAD_KIND");
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/facilities — تغییر وضعیت رزرو/تعمیر/مهمان/شیء */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, unknown>>(req);
    const kind = String(body.kind ?? "");
    const id = String(body.id ?? "");
    const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role);

    if (kind === "booking") {
      const b = await db.booking.findUnique({ where: { id } });
      if (!b || b.schoolId !== schoolId) return apiErr(404, "رزرو یافت نشد.", "NOT_FOUND");
      if (!isManager && b.byId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const status = ["PENDING", "APPROVED", "REJECTED", "CANCELED"].includes(String(body.status)) ? String(body.status) : null;
      // FIX (راند ۱۶): سازنده رزرو (معلم) فقط می‌تواند لغو کند — نه تأیید خودش
      if (!isManager && status && status !== "CANCELED") {
        return apiErr(403, "تأیید/رد رزرو فقط توسط مدیر انجام می‌شود؛ خودتان می‌توانید فقط لغو کنید.", "FORBIDDEN");
      }
      const updated = await db.booking.update({ where: { id }, data: status ? { status } : {} });
      await audit({ user: me, action: "تغییر وضعیت رزرو", entityType: "Booking", entityId: id, schoolId, meta: { status } });
      return apiOk({ booking: updated });
    }

    if (kind === "maintenance") {
      const t = await db.maintenanceTicket.findUnique({ where: { id } });
      if (!t || t.schoolId !== schoolId) return apiErr(404, "تیکت یافت نشد.", "NOT_FOUND");
      if (!isManager) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const data: Record<string, unknown> = {};
      if (["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(body.status))) {
        data.status = String(body.status);
        if (String(body.status) === "RESOLVED") data.resolvedAt = new Date();
      }
      if (body.resolutionNote) data.resolutionNote = String(body.resolutionNote);
      if (body.assignedToId !== undefined) data.assignedToId = (body.assignedToId as string) || null;
      if (body.slaHours) data.slaHours = Number(body.slaHours);
      const updated = await db.maintenanceTicket.update({ where: { id }, data });
      if (data.status === "RESOLVED") {
        await notifyUser(t.reportedById, "SUCCESS", "خرابی رفع شد", t.title, "/app/facilities?tab=maintenance");
      }
      await audit({ user: me, action: "به‌روزرسانی تیکت تعمیرات", entityType: "MaintenanceTicket", entityId: id, schoolId, meta: { fields: Object.keys(data) } });
      return apiOk({ ticket: updated });
    }

    if (kind === "visitor") {
      const v = await db.visitorLog.findUnique({ where: { id } });
      if (!v || v.schoolId !== schoolId) return apiErr(404, "مهمان یافت نشد.", "NOT_FOUND");
      if (!isManager) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const action = String(body.action ?? "");
      const data: Record<string, unknown> = {};
      if (action === "checkin") { data.status = "CHECKED_IN"; data.checkInAt = new Date(); }
      else if (action === "checkout") { data.status = "CHECKED_OUT"; data.checkOutAt = new Date(); }
      else if (action === "noshow") { data.status = "NOSHOW"; }
      else if (action === "cancel") { data.status = "CANCELED"; }
      const updated = await db.visitorLog.update({ where: { id }, data });
      await audit({ user: me, action: "به‌روزرسانی وضعیت مهمان", entityType: "VisitorLog", entityId: id, schoolId, meta: { action } });
      return apiOk({ visitor: updated });
    }

    if (kind === "lostfound") {
      const it = await db.lostFoundItem.findUnique({ where: { id } });
      if (!it || it.schoolId !== schoolId) return apiErr(404, "یافت نشد.", "NOT_FOUND");
      if (!isManager) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const data: Record<string, unknown> = {};
      if (String(body.status) === "CLAIMED") {
        data.status = "CLAIMED";
        data.claimedByName = String(body.claimedByName ?? "");
        data.claimedAt = new Date();
      } else if (String(body.status) === "DISPOSED") {
        data.status = "DISPOSED";
      }
      const updated = await db.lostFoundItem.update({ where: { id }, data });
      return apiOk({ item: updated });
    }

    if (kind === "asset") {
      const a = await db.asset.findUnique({ where: { id } });
      if (!a || a.schoolId !== schoolId) return apiErr(404, "دارایی یافت نشد.", "NOT_FOUND");
      if (!isManager) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const data: Record<string, unknown> = {};
      if (["OK", "BROKEN", "REPAIRING", "RETIRED"].includes(String(body.status))) data.status = String(body.status);
      if (body.location !== undefined) data.location = String(body.location);
      if (body.custodianId !== undefined) data.custodianId = (body.custodianId as string) || null;
      const updated = await db.asset.update({ where: { id }, data });
      await audit({ user: me, action: "ویرایش دارایی", entityType: "Asset", entityId: id, schoolId, meta: { status: body.status } });
      return apiOk({ asset: updated });
    }

    return apiErr(400, "نوع نامعتبر.", "BAD_KIND");
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/facilities?kind=&id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "";
    const id = url.searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    if (kind === "room") {
      // FIX: اتاق با رزروِ آینده (در انتظار/تأییدشده) حذف نمی‌شود — cascade قبلاً بی‌صدا پاکشان می‌کرد
      const futureBookings = await db.booking.count({
        where: { roomId: id, schoolId, status: { in: ["PENDING", "APPROVED"] }, endAt: { gte: new Date() } },
      });
      if (futureBookings > 0) return apiErr(409, "این اتاق رزرو آینده دارد و حذف نمی‌شود.", "HAS_FUTURE_BOOKINGS");
      await db.room.deleteMany({ where: { id, schoolId } });
    }
    else if (kind === "asset") await db.asset.deleteMany({ where: { id, schoolId } });
    else if (kind === "booking") await db.booking.deleteMany({ where: { id, schoolId } });
    else if (kind === "maintenance") await db.maintenanceTicket.deleteMany({ where: { id, schoolId } });
    else if (kind === "visitor") await db.visitorLog.deleteMany({ where: { id, schoolId } });
    else if (kind === "lostfound") await db.lostFoundItem.deleteMany({ where: { id, schoolId } });
    else return apiErr(400, "نوع نامعتبر.", "BAD_KIND");
    await audit({ user: me, action: "حذف از امکانات (" + kind + ")", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
