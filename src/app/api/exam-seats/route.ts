import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { buildAssignments, totalCapacity, type SeatRoom, type SeatStrategy, type SeatSessionMode } from "@/lib/exam-seats";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"];

/**
 * GET    /api/exam-seats — فهرست طرح‌ها + اتاق‌های مدرسه (از ماژول محل‌ها) برای فرم ساخت
 * GET    /api/exam-seats?id= — جزئیات یک طرح با همه تخصیص‌ها (برای نقشه صندلی و چاپ کارت)
 * POST   /api/exam-seats — ساخت طرح و تولید خودکار شماره صندلی همه نوبت‌ها
 * DELETE /api/exam-seats?id= — حذف طرح و تخصیص‌هایش
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const schoolId = requireSchoolId(me);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      const plan = await db.examSeatPlan.findFirst({ where: { id, schoolId } });
      if (!plan) return apiErr(404, "طرح یافت نشد.", "NOT_FOUND");
      const assignments = await db.examSeatAssignment.findMany({
        where: { planId: id },
        orderBy: [{ sessionNo: "asc" }, { roomName: "asc" }, { seatNo: "asc" }],
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      });
      const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });
      return apiOk({
        plan: { id: plan.id, title: plan.title, date: plan.date, sessions: plan.sessions, config: JSON.parse(plan.config), createdAt: plan.createdAt },
        schoolName: school?.name ?? "",
        assignments: assignments.map((a) => ({
          id: a.id, studentId: a.studentId, sessionNo: a.sessionNo, roomName: a.roomName, seatNo: a.seatNo, rowNo: a.rowNo, colNo: a.colNo,
          studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
          studentNumber: a.student.studentNumber,
          className: a.student.class?.name ?? "",
        })),
      });
    }
    const [plans, rooms] = await Promise.all([
      db.examSeatPlan.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { _count: { select: { assignments: true } } },
      }),
      db.room.findMany({ where: { schoolId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, capacity: true } }),
    ]);
    return apiOk({
      plans: plans.map((p) => ({ id: p.id, title: p.title, date: p.date, sessions: p.sessions, count: p._count.assignments, createdAt: p.createdAt })),
      rooms,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      title?: string; date?: string; sessions?: number; classIds?: string[];
      rooms?: SeatRoom[]; strategy?: SeatStrategy; sessionMode?: SeatSessionMode;
    }>(req);
    const title = String(body.title ?? "").trim();
    const date = String(body.date ?? "").trim();
    const sessions = Math.min(12, Math.max(1, Math.floor(Number(body.sessions ?? 1)) || 1));
    const classIds = Array.isArray(body.classIds) ? body.classIds.map(String).filter(Boolean) : [];
    const rooms: SeatRoom[] = (Array.isArray(body.rooms) ? body.rooms : [])
      .map((r) => ({
        name: String(r?.name ?? "").trim(),
        rows: Math.min(30, Math.max(1, Math.floor(Number(r?.rows ?? 0)) || 0)),
        cols: Math.min(30, Math.max(1, Math.floor(Number(r?.cols ?? 0)) || 0)),
        deskType: r?.deskType === "DOUBLE" ? "DOUBLE" as const : "SINGLE" as const,
      }))
      .filter((r) => r.name && r.rows > 0 && r.cols > 0);
    const strategy: SeatStrategy = body.strategy === "MIXED" ? "MIXED" : "BY_CLASS";
    const sessionMode: SeatSessionMode = body.sessionMode === "SPLIT" ? "SPLIT" : "ALL_EACH";
    if (!title || !date || !classIds.length || !rooms.length) {
      return apiErr(400, "عنوان، تاریخ، دست‌کم یک کلاس و دست‌کم یک اتاق لازم است.", "BAD_INPUT");
    }
    const students = await db.student.findMany({
      where: { schoolId, classId: { in: classIds } },
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { id: true, name: true } } },
    });
    if (!students.length) return apiErr(400, "برای کلاس‌های انتخاب‌شده دانش‌آموزی یافت نشد.", "NO_STUDENTS");
    const seatStudents = students.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      classId: s.classId ?? "",
      className: s.class?.name ?? "",
    }));
    const needed = sessionMode === "SPLIT" ? Math.ceil(seatStudents.length / sessions) : seatStudents.length;
    if (needed > totalCapacity(rooms)) {
      return apiErr(400, `ظرفیت اتاق‌ها کافی نیست: برای هر نوبت ${needed} صندلی لازم است ولی ظرفیت ${totalCapacity(rooms)} است.`, "LOW_CAPACITY");
    }
    const built = buildAssignments(seatStudents, classIds, rooms, sessions, strategy, sessionMode);
    if (!built) return apiErr(400, "چیدمان ساخته نشد؛ ظرفیت اتاق‌ها را بررسی کنید.", "LOW_CAPACITY");
    const plan = await db.examSeatPlan.create({
      data: {
        schoolId, title, date, sessions, createdById: me.id,
        config: JSON.stringify({ rooms, classIds, strategy, sessionMode }),
      },
    });
    await db.examSeatAssignment.createMany({
      data: built.map((b) => ({ planId: plan.id, studentId: b.studentId, sessionNo: b.sessionNo, roomName: b.roomName, seatNo: b.seatNo, rowNo: b.rowNo, colNo: b.colNo })),
    });
    await audit({ user: me, action: "examSeatPlan.create", entityType: "SCHOOL", entityId: schoolId, meta: { title, count: built.length }, schoolId });
    return apiOk({ id: plan.id, count: built.length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") ?? "");
    const plan = await db.examSeatPlan.findFirst({ where: { id, schoolId } });
    if (!plan) return apiErr(404, "طرح یافت نشد.", "NOT_FOUND");
    await db.examSeatPlan.delete({ where: { id } });
    await audit({ user: me, action: "examSeatPlan.delete", entityType: "SCHOOL", entityId: schoolId, meta: { title: plan.title }, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
