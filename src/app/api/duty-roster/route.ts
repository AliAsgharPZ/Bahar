import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/duty-roster?date= — کشیک‌های یک روز + فهرست همکاران برای تخصیص */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const date = req.nextUrl.searchParams.get("date") || todayJalali();
    const rows = await db.dutyAssignment.findMany({ where: { schoolId, date }, orderBy: { createdAt: "asc" } });
    const teachers = await db.user.findMany({
      where: { schoolId, isActive: true, role: { in: ["TEACHER", "DEPUTY", "MANAGER", "CUSTODIAN"] } },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: { lastName: "asc" },
    });
    const byId = new Map(teachers.map((u) => [u.id, u]));
    return apiOk({
      date,
      teachers,
      items: rows.map((r) => ({
        id: r.id, duty: r.duty, userId: r.userId, note: r.note,
        name: byId.get(r.userId) ? `${byId.get(r.userId)!.firstName} ${byId.get(r.userId)!.lastName}` : "",
        mine: r.userId === me.id,
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
    const body = await readJson<{ date?: string; duty?: string; userId?: string; note?: string }>(req);
    const duty = String(body.duty ?? "").trim();
    if (!duty) return apiErr(400, "نوع کشیک لازم است (مثلاً ناظم حیاط).", "BAD_INPUT");
    const user = await db.user.findFirst({ where: { id: String(body.userId ?? ""), schoolId }, select: { id: true } });
    if (!user) return apiErr(404, "همکار یافت نشد.", "NOT_FOUND");
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const created = await db.dutyAssignment.create({
      data: { schoolId, date, duty, userId: user.id, note: body.note ? String(body.note).trim() : null },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.dutyAssignment.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.dutyAssignment.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
