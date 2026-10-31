import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/medication-log?studentId= — دفتر ثبت داروی دانش‌آموزان در مدرسه (چه دارویی، کی، به دست چه کسی) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const studentId = req.nextUrl.searchParams.get("studentId");
    const rows = await db.medicationLog.findMany({
      where: { schoolId, ...(studentId ? { studentId } : {}) },
      orderBy: { givenAt: "desc" },
      take: 200,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      items: rows.map((r) => ({
        ...r,
        studentName: byId.get(r.studentId) ? `${byId.get(r.studentId)!.user.firstName} ${byId.get(r.studentId)!.user.lastName}` : "",
        className: byId.get(r.studentId)?.class?.name ?? null,
      })),
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
    const body = await readJson<{ studentId?: string; medicine?: string; dose?: string; note?: string }>(req);
    const medicine = String(body.medicine ?? "").trim();
    if (!medicine) return apiErr(400, "نام دارو لازم است.", "BAD_INPUT");
    const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.medicationLog.create({
      data: {
        schoolId, studentId: student.id, medicine,
        dose: body.dose ? String(body.dose).trim() : null,
        givenById: me.id,
        note: body.note ? String(body.note).trim() : null,
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}
