import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { todayKey } from "@/lib/persian";

/* ============================================================
   بهار | سوار/پیاده‌شدن سرویس — مراقب یا مدیر برای هر روز
   سوارشدن و پیاده‌شدن هر دانش‌آموز را ثبت می‌کند؛ ولی همان
   روز وضعیت فرزندش را می‌بیند.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const date = new URL(req.url).searchParams.get("date") ?? todayKey();

    if (me.role === "PARENT" || me.role === "STUDENT") {
      const studentIds = me.role === "STUDENT"
        ? [(await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id].filter(Boolean) as string[]
        : (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
      const assignments = await db.transportAssignment.findMany({
        where: { studentId: { in: studentIds } },
        include: { route: { select: { name: true, driverName: true } }, boardings: { where: { date } } },
      });
      return apiOk({
        date,
        items: assignments.map((a) => ({
          routeName: a.route.name,
          driverName: a.route.driverName,
          boardedAt: a.boardings[0]?.boardedAt ?? null,
          alightedAt: a.boardings[0]?.alightedAt ?? null,
        })),
      });
    }

    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const assignments = await db.transportAssignment.findMany({
      where: { schoolId, route: { isActive: true } },
      include: {
        route: { select: { id: true, name: true } },
        student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
        boardings: { where: { date } },
      },
      orderBy: [{ route: { name: "asc" } }, { createdAt: "asc" }],
    });
    return apiOk({
      date,
      items: assignments.map((a) => ({
        assignmentId: a.id,
        routeId: a.route.id,
        routeName: a.route.name,
        stopName: a.stopName,
        student: { id: a.student.id, name: `${a.student.user.firstName} ${a.student.user.lastName}`, className: a.student.class?.name ?? "" },
        boardedAt: a.boardings[0]?.boardedAt ?? null,
        alightedAt: a.boardings[0]?.alightedAt ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ assignmentId?: string; date?: string; leg?: string; value?: boolean }>(req);
    const asg = await db.transportAssignment.findFirst({
      where: { id: String(body.assignmentId ?? ""), schoolId },
      select: { id: true },
    });
    if (!asg) return apiErr(404, "تخصیص سرویس یافت نشد.", "NOT_FOUND");
    const date = body.date ?? todayKey();
    const leg = body.leg === "alight" ? "alight" : "board";
    const now = body.value === false ? null : new Date();
    const data = leg === "board" ? { boardedAt: now } : { alightedAt: now };
    const row = await db.transportBoarding.upsert({
      where: { assignmentId_date: { assignmentId: asg.id, date } },
      create: { schoolId, assignmentId: asg.id, date, markedById: me.id, ...data },
      update: { markedById: me.id, ...data },
    });
    await audit({ user: me, action: leg === "board" ? "ثبت سوارشدن سرویس" : "ثبت پیاده‌شدن سرویس", entityType: "TransportBoarding", entityId: row.id, schoolId });
    return apiOk({ boarding: row });
  } catch (e) {
    return handleApiError(e);
  }
}
