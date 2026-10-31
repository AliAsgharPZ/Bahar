import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/sports-records?studentId= — رکوردهای ورزشی؛ بهترین رکورد هر رشته هم جدا می‌آید */
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
    const want = req.nextUrl.searchParams.get("studentId");
    const rows = await db.sportRecord.findMany({
      where: { schoolId, ...(scope ? { studentId: { in: scope } } : want ? { studentId: want } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
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
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; discipline?: string; value?: string; unit?: string; date?: string; note?: string }>(req);
    const discipline = String(body.discipline ?? "").trim();
    const value = String(body.value ?? "").trim();
    if (!discipline || !value) return apiErr(400, "رشته و رکورد لازم است.", "BAD_INPUT");
    const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.sportRecord.create({
      data: {
        schoolId, studentId: student.id, discipline, value,
        unit: body.unit ? String(body.unit).trim() : null,
        date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali(),
        note: body.note ? String(body.note).trim() : null,
      },
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
    const found = await db.sportRecord.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.sportRecord.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
