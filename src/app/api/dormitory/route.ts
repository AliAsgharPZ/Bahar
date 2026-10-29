import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | خوابگاه شبانه‌روزی — ساختمان، اتاق، اسکان، مرخصی
   - کادر: ساخت ساختمان/اتاق، اسکان با کنترل ظرفیت و تک‌اسکانی،
     پایان اسکان، تأیید/رد مرخصی
   - دانش‌آموز/ولی: دیدن اسکان و مرخصی‌های خود، ثبت مرخصی
   - مرخصی خوابگاهی از مرخصی کارکنان جداست (مدل DormLeave).
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

async function myStudentIds(me: { id: string; role: string }): Promise<string[]> {
  if (me.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
    return st ? [st.id] : [];
  }
  if (me.role === "PARENT") {
    return (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
  }
  return [];
}

async function studentNames(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.student.findMany({ where: { id: { in: ids } }, include: { user: { select: { firstName: true, lastName: true } } } });
  return new Map(rows.map((r) => [r.id, `${r.user.firstName} ${r.user.lastName}`]));
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const buildings = await db.dormBuilding.findMany({
      where: { schoolId },
      include: { rooms: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
    const isStaff = STAFF.includes(me.role);
    const mine = isStaff ? [] : await myStudentIds(me);
    const assignments = await db.dormAssignment.findMany({
      where: { schoolId, ...(isStaff ? {} : { studentId: { in: mine } }) },
      include: { room: { include: { building: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const leaves = await db.dormLeave.findMany({
      where: { schoolId, ...(isStaff ? {} : { studentId: { in: mine } }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const names = await studentNames([...new Set([...assignments.map((a) => a.studentId), ...leaves.map((l) => l.studentId)])]);
    return apiOk({
      buildings,
      assignments: assignments.map((a) => ({ ...a, studentName: names.get(a.studentId) ?? "—", buildingName: a.room.building.name })),
      leaves: leaves.map((l) => ({ ...l, studentName: names.get(l.studentId) ?? "—" })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{
      action?: string; id?: string; name?: string; address?: string; buildingId?: string;
      floor?: number; capacity?: number; notes?: string; isActive?: boolean;
      studentId?: string; roomId?: string; bedLabel?: string;
      fromDate?: string; toDate?: string; reason?: string; decision?: string; decisionNote?: string;
    }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const isStaff = STAFF.includes(me.role);

    if (body.action === "createBuilding") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const name = String(body.name ?? "").trim();
      if (!name || name.length > 120) return apiErr(400, "نام ساختمان نامعتبر است.", "BAD_NAME");
      const building = await db.dormBuilding.create({ data: { schoolId, name, address: String(body.address ?? "").trim().slice(0, 200) } });
      return apiOk({ building });
    }

    if (body.action === "createRoom") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const building = await db.dormBuilding.findFirst({ where: { id: String(body.buildingId ?? ""), schoolId } });
      if (!building) return apiErr(404, "ساختمان یافت نشد.", "NOT_FOUND");
      const name = String(body.name ?? "").trim();
      const capacity = Math.round(Number(body.capacity ?? 0));
      if (!name || name.length > 120) return apiErr(400, "نام اتاق نامعتبر است.", "BAD_NAME");
      if (capacity < 1 || capacity > 50) return apiErr(400, "ظرفیت اتاق باید بین ۱ تا ۵۰ باشد.", "BAD_CAPACITY");
      const room = await db.dormRoom.create({
        data: { buildingId: building.id, name, floor: Math.round(Number(body.floor ?? 0)), capacity, notes: String(body.notes ?? "").trim().slice(0, 200) },
      });
      return apiOk({ room });
    }

    if (body.action === "updateRoom") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const room = await db.dormRoom.findFirst({ where: { id: String(body.id ?? "") }, include: { building: true } });
      if (!room || room.building.schoolId !== schoolId) return apiErr(404, "اتاق یافت نشد.", "NOT_FOUND");
      const data: Record<string, unknown> = {};
      if (body.capacity !== undefined) {
        const capacity = Math.round(Number(body.capacity));
        if (capacity < 1 || capacity > 50) return apiErr(400, "ظرفیت اتاق باید بین ۱ تا ۵۰ باشد.", "BAD_CAPACITY");
        const active = await db.dormAssignment.count({ where: { roomId: room.id, status: "ACTIVE" } });
        if (capacity < active) return apiErr(409, "ظرفیت جدید از شمار ساکنان فعلی کمتر است.", "OVER_OCCUPIED");
        data.capacity = capacity;
      }
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
      const updated = await db.dormRoom.update({ where: { id: room.id }, data });
      return apiOk({ room: updated });
    }

    if (body.action === "assign") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const studentId = String(body.studentId ?? "");
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const room = await db.dormRoom.findFirst({ where: { id: String(body.roomId ?? "") }, include: { building: true } });
      if (!room || room.building.schoolId !== schoolId) return apiErr(404, "اتاق یافت نشد.", "NOT_FOUND");
      if (!room.isActive) return apiErr(409, "اتاق غیرفعال است.", "INACTIVE");
      /* اسکان با فرم batch تراکنش (نه callback تعاملی): آداپتور D1
         فرم تعاملی را پشتیبانی نمی‌کند. پس نگه‌دارها اول بیرون از
         تراکنش خوانده می‌شوند، ساخت اسکان + شمارشِ پس از ساخت در
         یک batch انجام می‌شود، و اگر شمارش پس از ساخت نشان داد
         ظرفیت پر شده یا دانش‌آموز اسکان فعال دیگری دارد، اسکانِ
         تازه‌ساخته همان‌جا حذف می‌شود (جبران خوش‌بینانه). */
      const preCount = await db.dormAssignment.count({ where: { roomId: room.id, status: "ACTIVE" } });
      const preExisting = await db.dormAssignment.findFirst({ where: { studentId, status: "ACTIVE" } });
      if (preCount >= room.capacity) return apiErr(409, "ظرفیت اتاق تکمیل است.", "FULL");
      if (preExisting) return apiErr(409, "این دانش‌آموز هم‌اکنون اسکان فعال دارد.", "ALREADY");
      try {
        const [assignment, roomCount, studentCount] = await db.$transaction([
          db.dormAssignment.create({
            data: { schoolId, studentId, roomId: room.id, bedLabel: String(body.bedLabel ?? "").trim().slice(0, 40), createdById: me.id },
          }),
          db.dormAssignment.count({ where: { roomId: room.id, status: "ACTIVE" } }),
          db.dormAssignment.count({ where: { studentId, status: "ACTIVE" } }),
        ]);
        if (roomCount > room.capacity) {
          await db.dormAssignment.delete({ where: { id: assignment.id } });
          return apiErr(409, "ظرفیت اتاق تکمیل است.", "FULL");
        }
        if (studentCount > 1) {
          await db.dormAssignment.delete({ where: { id: assignment.id } });
          return apiErr(409, "این دانش‌آموز هم‌اکنون اسکان فعال دارد.", "ALREADY");
        }
        return apiOk({ assignment });
      } catch (e) {
        throw e;
      }
    }

    if (body.action === "endAssignment") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const assignment = await db.dormAssignment.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
      if (!assignment) return apiErr(404, "اسکان یافت نشد.", "NOT_FOUND");
      if (assignment.status !== "ACTIVE") return apiErr(409, "این اسکان قبلاً پایان یافته است.", "ALREADY_ENDED");
      const updated = await db.dormAssignment.update({ where: { id: assignment.id }, data: { status: "ENDED", endDate: new Date() } });
      return apiOk({ assignment: updated });
    }

    if (body.action === "requestLeave") {
      const studentId = String(body.studentId ?? "");
      const mine = await myStudentIds(me);
      const allowed = isStaff || mine.includes(studentId);
      if (!allowed) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const from = new Date(String(body.fromDate ?? ""));
      const to = new Date(String(body.toDate ?? ""));
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
        return apiErr(400, "بازهٔ مرخصی نامعتبر است.", "BAD_DATES");
      }
      const leave = await db.dormLeave.create({
        data: { schoolId, studentId, fromDate: from, toDate: to, reason: String(body.reason ?? "").trim().slice(0, 300) || null, createdById: me.id },
      });
      return apiOk({ leave });
    }

    if (body.action === "decideLeave") {
      if (!isStaff) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const leave = await db.dormLeave.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
      if (!leave) return apiErr(404, "مرخصی یافت نشد.", "NOT_FOUND");
      if (leave.status !== "PENDING") return apiErr(409, "این مرخصی قبلاً بررسی شده است.", "ALREADY_DECIDED");
      const decision = body.decision === "APPROVED" ? "APPROVED" : body.decision === "REJECTED" ? "REJECTED" : null;
      if (!decision) return apiErr(400, "تصمیم نامعتبر است.", "BAD_DECISION");
      const updated = await db.dormLeave.update({
        where: { id: leave.id },
        data: { status: decision, decidedById: me.id, decisionNote: String(body.decisionNote ?? "").trim().slice(0, 300) || null },
      });
      return apiOk({ leave: updated });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
