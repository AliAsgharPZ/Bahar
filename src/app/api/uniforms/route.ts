import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
const STATUSES = ["MEASURED", "ORDERED", "DELIVERED"] as const;

/** GET /api/uniforms — کارکنان: همه + کلاس‌ها؛ دانش‌آموز/ولی: فقط خودشان */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    let studentIds: string[] | null = null;
    if (!isStaff) {
      if (me.role === "STUDENT") {
        const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
        studentIds = p ? [p.id] : [];
      } else {
        const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
        studentIds = links.map((l) => l.studentId);
      }
    }
    const rows = await db.uniformRecord.findMany({
      where: { schoolId, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    const classes = isStaff ? await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
    return apiOk({
      isStaff, classes,
      items: rows.map((r) => ({
        id: r.id, studentId: r.studentId, item: r.item, size: r.size, status: r.status, note: r.note,
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
    const body = await readJson<{ studentId?: string; item?: string; size?: string; note?: string }>(req);
    const item = String(body.item ?? "").trim();
    if (!item) return apiErr(400, "نام پوشاک لازم است.", "BAD_INPUT");
    const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.uniformRecord.create({
      data: { schoolId, studentId: student.id, item, size: body.size ? String(body.size).trim() : null, note: body.note ? String(body.note).trim() : null },
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
    const body = await readJson<{ id?: string; status?: string; size?: string }>(req);
    const found = await db.uniformRecord.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    const status = body.status && (STATUSES as readonly string[]).includes(body.status) ? body.status : found.status;
    const updated = await db.uniformRecord.update({
      where: { id: found.id },
      data: { status, size: body.size !== undefined ? String(body.size).trim() || null : found.size },
    });
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
