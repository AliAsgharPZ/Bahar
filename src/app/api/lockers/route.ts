import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/lockers — فهرست کمدها + دانش‌آموز صاحب هر کمد */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const rows = await db.locker.findMany({ where: { schoolId }, orderBy: { number: "asc" }, take: 500 });
    const studentIds = [...new Set(rows.map((r) => r.studentId).filter(Boolean))] as string[];
    const students = studentIds.length
      ? await db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      items: rows.map((r) => ({
        id: r.id, number: r.number, location: r.location, status: r.status, note: r.note, studentId: r.studentId,
        studentName: r.studentId ? byId.get(r.studentId) : null,
      })),
      freeCount: rows.filter((r) => r.status === "FREE").length,
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
    const body = await readJson<{ number?: string; location?: string }>(req);
    const number = String(body.number ?? "").trim();
    if (!number) return apiErr(400, "شمارهٔ کمد لازم است.", "BAD_INPUT");
    const dup = await db.locker.findFirst({ where: { schoolId, number } });
    if (dup) return apiErr(409, "کمدی با این شماره هست.", "DUP");
    const created = await db.locker.create({ data: { schoolId, number, location: body.location ? String(body.location).trim() : null } });
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
    const body = await readJson<{ id?: string; studentId?: string | null; note?: string }>(req);
    const found = await db.locker.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "کمد یافت نشد.", "NOT_FOUND");
    const studentId = body.studentId === undefined ? found.studentId : body.studentId;
    if (studentId) {
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const taken = await db.locker.findFirst({ where: { schoolId, studentId, NOT: { id: found.id } } });
      if (taken) return apiErr(409, "این دانش‌آموز کمد دیگری دارد.", "HAS_LOCKER");
    }
    const updated = await db.locker.update({
      where: { id: found.id },
      data: { studentId, status: studentId ? "TAKEN" : "FREE", note: body.note !== undefined ? String(body.note).trim() || null : found.note },
    });
    return apiOk({ id: updated.id, status: updated.status });
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
    const found = await db.locker.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "کمد یافت نشد.", "NOT_FOUND");
    await db.locker.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
