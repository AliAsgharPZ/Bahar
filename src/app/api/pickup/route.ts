import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * GET /api/pickup — کارکنان: همهٔ اشخاص مجاز مدرسه؛ ولی: فقط برای فرزندان خودش
 * POST /api/pickup — افزودن شخص مجاز (ولی برای فرزندش، کارکنان برای هر دانش‌آموز)
 * PATCH /api/pickup { id, isAuthorized } — فعال/غیرفعال‌کردن مجوز
 * DELETE /api/pickup?id=
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    let studentIds: string[] | null = null;
    if (!isStaff) {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentIds = links.map((l) => l.studentId);
    }
    const rows = await db.pickupPerson.findMany({
      where: { schoolId, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { student: { select: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
    });
    return apiOk({
      isStaff,
      items: rows.map((r) => ({
        id: r.id, studentId: r.studentId, name: r.name, relation: r.relation, phone: r.phone,
        carPlate: r.carPlate, isAuthorized: r.isAuthorized,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        className: r.student.class?.name ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; name?: string; relation?: string; phone?: string; carPlate?: string }>(req);
    const studentId = String(body.studentId ?? "");
    const name = String(body.name ?? "").trim();
    const relation = String(body.relation ?? "").trim();
    if (!name || !relation) return apiErr(400, "نام و نسبت شخص مجاز لازم است.", "BAD_INPUT");
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    if (!isStaff) {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.pickupPerson.create({
      data: { schoolId, studentId, name, relation, phone: body.phone ? String(body.phone).trim() : null, carPlate: body.carPlate ? String(body.carPlate).trim() : null },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; isAuthorized?: boolean }>(req);
    const found = await db.pickupPerson.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    const updated = await db.pickupPerson.update({ where: { id: found.id }, data: { isAuthorized: body.isAuthorized !== false } });
    return apiOk({ id: updated.id, isAuthorized: updated.isAuthorized });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.pickupPerson.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (!(STAFF as readonly string[]).includes(me.role)) {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId: found.studentId } });
      if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.pickupPerson.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
