import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/class-roles — مسئولیت‌های کلاس‌ها + کلاس‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const classId = req.nextUrl.searchParams.get("classId");
    const rows = await db.classRoleAssign.findMany({
      where: { schoolId, ...(classId ? { classId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return apiOk({
      classes,
      items: rows.map((r) => ({
        id: r.id, classId: r.classId, role: r.role, studentId: r.studentId, termLabel: r.termLabel,
        studentName: byId.get(r.studentId) ? `${byId.get(r.studentId)!.user.firstName} ${byId.get(r.studentId)!.user.lastName}` : "",
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
    const body = await readJson<{ classId?: string; role?: string; studentId?: string; termLabel?: string }>(req);
    const role = String(body.role ?? "").trim();
    if (!role) return apiErr(400, "نام مسئولیت لازم است (مثلاً مبصر).", "BAD_INPUT");
    const cls = await db.class.findFirst({ where: { id: String(body.classId ?? ""), schoolId }, select: { id: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId, classId: cls.id }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز در این کلاس نیست.", "NOT_FOUND");
    const created = await db.classRoleAssign.create({
      data: { schoolId, classId: cls.id, role, studentId: student.id, termLabel: body.termLabel ? String(body.termLabel).trim() : null },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.classRoleAssign.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.classRoleAssign.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
