import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const OFFICE = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

async function names(schoolId: string, ids: string[]) {
  const students = ids.length
    ? await db.student.findMany({ where: { schoolId, id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
    : [];
  return new Map(students.map((s) => [s.id, s]));
}

/** GET /api/mentoring — جفت‌های همیار؛ دانش‌آموز فقط جفت خودش را می‌بیند */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    let myStudentId: string | null = null;
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      myStudentId = p?.id ?? null;
    }
    const rows = await db.mentorPair.findMany({
      where: { schoolId, ...(isOffice ? {} : { OR: [{ mentorStudentId: myStudentId ?? "__" }, { menteeStudentId: myStudentId ?? "__" }] }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const byId = await names(schoolId, [...new Set(rows.flatMap((r) => [r.mentorStudentId, r.menteeStudentId]))]);
    const label = (id: string) => {
      const s = byId.get(id);
      return s ? `${s.user.firstName} ${s.user.lastName}` : "";
    };
    return apiOk({
      isOffice,
      items: rows.map((r) => ({
        id: r.id, focus: r.focus, isActive: r.isActive,
        mentorId: r.mentorStudentId, menteeId: r.menteeStudentId,
        mentorName: label(r.mentorStudentId), menteeName: label(r.menteeStudentId),
        mentorClass: byId.get(r.mentorStudentId)?.class?.name ?? null,
        menteeClass: byId.get(r.menteeStudentId)?.class?.name ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ mentorStudentId?: string; menteeStudentId?: string; focus?: string }>(req);
    const mentorId = String(body.mentorStudentId ?? "");
    const menteeId = String(body.menteeStudentId ?? "");
    if (!mentorId || !menteeId || mentorId === menteeId) return apiErr(400, "همیار و همراه باید دو دانش‌آموز متفاوت باشند.", "BAD_INPUT");
    const found = await db.student.findMany({ where: { schoolId, id: { in: [mentorId, menteeId] } }, select: { id: true } });
    if (found.length !== 2) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.mentorPair.create({
      data: { schoolId, mentorStudentId: mentorId, menteeStudentId: menteeId, focus: body.focus ? String(body.focus).trim() : null, createdById: me.id },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; isActive?: boolean }>(req);
    const found = await db.mentorPair.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.mentorPair.update({ where: { id: found.id }, data: { isActive: body.isActive !== false } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
