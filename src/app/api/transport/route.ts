import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | سرویس مدرسه — مسیرها، خودرو/راننده و تخصیص دانش‌آموز
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

function schoolOf(req: NextRequest, me: { schoolId: string | null }) {
  return me.schoolId ?? actingSchoolIdFor(req, me as never) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = schoolOf(req, me);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");

    if (STAFF.includes(me.role)) {
      const [routes, assignments] = await Promise.all([
        db.transportRoute.findMany({
          where: { schoolId },
          include: { _count: { select: { assignments: true } } },
          orderBy: { name: "asc" },
        }),
        db.transportAssignment.findMany({
          where: { schoolId },
          include: {
            route: { select: { id: true, name: true } },
            student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
      ]);
      return apiOk({ staff: true, routes, assignments });
    }

    // دانش‌آموز: تخصیص خودش — ولی: تخصیص فرزندان
    let studentIds: string[] = [];
    if (me.role === "STUDENT") {
      const st = await db.student.findFirst({ where: { userId: me.id, schoolId }, select: { id: true } });
      if (st) studentIds = [st.id];
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentIds = links.map((l) => l.studentId);
    }
    const assignments = studentIds.length
      ? await db.transportAssignment.findMany({
          where: { schoolId, studentId: { in: studentIds } },
          include: { route: true, student: { select: { id: true } } },
        })
      : [];
    return apiOk({ staff: false, routes: [], assignments });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = schoolOf(req, me);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      action?: string; id?: string; name?: string; driverName?: string; driverPhone?: string;
      vehiclePlate?: string; vehicleDesc?: string; capacity?: number; stops?: string[];
      routeId?: string; studentId?: string; stopName?: string; monthlyFee?: number; assignmentId?: string;
    }>(req);

    if (body.action === "createRoute" || body.action === "updateRoute") {
      const name = (body.name ?? "").trim().slice(0, 80);
      if (!name) return apiErr(400, "نام مسیر الزامی است.", "BAD_NAME");
      const data = {
        name,
        driverName: body.driverName?.trim().slice(0, 60) || null,
        driverPhone: body.driverPhone?.trim().slice(0, 20) || null,
        vehiclePlate: body.vehiclePlate?.trim().slice(0, 20) || null,
        vehicleDesc: body.vehicleDesc?.trim().slice(0, 60) || null,
        capacity: Math.min(200, Math.max(1, Math.round(body.capacity ?? 20))),
        stops: JSON.stringify((body.stops ?? []).map((s) => String(s).trim().slice(0, 60)).filter(Boolean).slice(0, 60)),
      };
      if (body.action === "createRoute") {
        const route = await db.transportRoute.create({ data: { schoolId, ...data } });
        await audit({ user: me, action: "ساخت مسیر سرویس", entityType: "TransportRoute", entityId: route.id, schoolId });
        return apiOk({ route });
      }
      const existing = await db.transportRoute.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
      if (!existing) return apiErr(404, "مسیر یافت نشد.", "NOT_FOUND");
      const route = await db.transportRoute.update({ where: { id: existing.id }, data });
      return apiOk({ route });
    }

    if (body.action === "deleteRoute") {
      const existing = await db.transportRoute.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
      if (!existing) return apiErr(404, "مسیر یافت نشد.", "NOT_FOUND");
      await db.transportRoute.delete({ where: { id: existing.id } });
      await audit({ user: me, action: "حذف مسیر سرویس", entityType: "TransportRoute", entityId: existing.id, schoolId });
      return apiOk({ ok: true });
    }

    if (body.action === "assign") {
      const route = await db.transportRoute.findFirst({ where: { id: String(body.routeId ?? ""), schoolId } });
      if (!route) return apiErr(404, "مسیر یافت نشد.", "NOT_FOUND");
      const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId, status: "ACTIVE" } });
      if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const count = await db.transportAssignment.count({ where: { routeId: route.id } });
      const already = await db.transportAssignment.findUnique({ where: { routeId_studentId: { routeId: route.id, studentId: student.id } } });
      if (!already && count >= route.capacity) return apiErr(409, "ظرفیت این مسیر تکمیل است.", "FULL");
      const assignment = await db.transportAssignment.upsert({
        where: { routeId_studentId: { routeId: route.id, studentId: student.id } },
        create: {
          schoolId, routeId: route.id, studentId: student.id,
          stopName: body.stopName?.trim().slice(0, 60) || null,
          monthlyFee: Math.max(0, Math.round(body.monthlyFee ?? 0)),
        },
        update: {
          stopName: body.stopName?.trim().slice(0, 60) || null,
          monthlyFee: Math.max(0, Math.round(body.monthlyFee ?? 0)),
        },
      });
      await audit({ user: me, action: "تخصیص دانش‌آموز به سرویس", entityType: "TransportAssignment", entityId: assignment.id, schoolId });
      return apiOk({ assignment });
    }

    if (body.action === "unassign") {
      const a = await db.transportAssignment.findFirst({ where: { id: String(body.assignmentId ?? ""), schoolId } });
      if (!a) return apiErr(404, "تخصیص یافت نشد.", "NOT_FOUND");
      await db.transportAssignment.delete({ where: { id: a.id } });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const kind = url.searchParams.get("kind") ?? "route";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    if (kind === "assignment") {
      const row = await db.transportAssignment.findUnique({ where: { id }, select: { schoolId: true } });
      if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
      if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.transportAssignment.delete({ where: { id } });
    } else {
      const row = await db.transportRoute.findUnique({ where: { id }, select: { schoolId: true } });
      if (!row) return apiErr(404, "مسیر یافت نشد.", "NOT_FOUND");
      if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.transportRoute.delete({ where: { id } });
    }
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
