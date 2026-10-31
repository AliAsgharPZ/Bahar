import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/cleaning?classId=&date= — نوبت نظافت یک کلاس در یک روز + دانش‌آموزان کلاس */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    const classId = req.nextUrl.searchParams.get("classId") || classes[0]?.id || "";
    const date = req.nextUrl.searchParams.get("date") || todayJalali();
    const duty = classId ? await db.cleaningDuty.findFirst({ where: { schoolId, classId, date } }) : null;
    const students = classId
      ? await db.student.findMany({ where: { schoolId, classId, status: "ACTIVE" }, select: { id: true, user: { select: { firstName: true, lastName: true } } }, orderBy: { studentNumber: "asc" } })
      : [];
    return apiOk({
      classes, classId, date,
      duty: duty ? { id: duty.id, studentIds: JSON.parse(duty.studentIds) as string[], done: duty.done, note: duty.note } : null,
      students: students.map((s) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}` })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ classId?: string; date?: string; studentIds?: string[]; note?: string }>(req);
    const cls = await db.class.findFirst({ where: { id: String(body.classId ?? ""), schoolId }, select: { id: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const ids = Array.isArray(body.studentIds) ? body.studentIds.slice(0, 40).map(String) : [];
    const valid = await db.student.findMany({ where: { schoolId, classId: cls.id, id: { in: ids } }, select: { id: true } });
    const validIds = valid.map((v) => v.id);
    const existing = await db.cleaningDuty.findFirst({ where: { schoolId, classId: cls.id, date } });
    if (existing) {
      await db.cleaningDuty.update({ where: { id: existing.id }, data: { studentIds: JSON.stringify(validIds), note: body.note ? String(body.note).trim() : existing.note } });
      return apiOk({ id: existing.id });
    }
    const created = await db.cleaningDuty.create({
      data: { schoolId, classId: cls.id, date, studentIds: JSON.stringify(validIds), note: body.note ? String(body.note).trim() : null },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; done?: boolean }>(req);
    const found = await db.cleaningDuty.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.cleaningDuty.update({ where: { id: found.id }, data: { done: body.done === true } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
