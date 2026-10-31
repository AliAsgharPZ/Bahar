import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/bike-registry — دوچرخه/اسکوترهای ثبت‌شده؛ دانش‌آموز مال خودش را می‌بیند، نگهبان همه را */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    let scope: string[] | null = null;
    if (!isStaff) {
      if (me.role === "STUDENT") {
        const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
        scope = p ? [p.id] : [];
      } else {
        const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
        scope = links.map((l) => l.studentId);
      }
    }
    const rows = await db.bikeRegistry.findMany({
      where: { schoolId, ...(scope ? { studentId: { in: scope } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      isStaff,
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
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; kind?: string; color?: string; serial?: string; spot?: string }>(req);
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p) return apiErr(404, "پروندهٔ دانش‌آموزی یافت نشد.", "NOT_FOUND");
      studentId = p.id;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.bikeRegistry.create({
      data: {
        schoolId, studentId,
        kind: body.kind ? String(body.kind).trim() : "دوچرخه",
        color: body.color ? String(body.color).trim() : null,
        serial: body.serial ? String(body.serial).trim() : null,
        spot: body.spot ? String(body.spot).trim() : null,
      },
    });
    return apiOk({ id: created.id });
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
    const found = await db.bikeRegistry.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (!(STAFF as readonly string[]).includes(me.role)) {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      if (p?.id !== found.studentId && !links.some((l) => l.studentId === found.studentId)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.bikeRegistry.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
