import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/call-log?studentId= — دفتر تماس‌های تلفنی همکاران با اولیا */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const studentId = req.nextUrl.searchParams.get("studentId");
    const rows = await db.callLog.findMany({
      where: { schoolId, ...(studentId ? { studentId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const staffIds = [...new Set(rows.map((r) => r.staffUserId))];
    const staff = staffIds.length
      ? await db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const byId = new Map(staff.map((u) => [u.id, u]));
    return apiOk({
      items: rows.map((r) => ({
        ...r,
        staffName: byId.get(r.staffUserId) ? `${byId.get(r.staffUserId)!.firstName} ${byId.get(r.staffUserId)!.lastName}` : "",
        mine: r.staffUserId === me.id,
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
    const body = await readJson<{ studentId?: string; contactName?: string; direction?: string; summary?: string; followUp?: string; date?: string }>(req);
    const summary = String(body.summary ?? "").trim();
    const contactName = String(body.contactName ?? "").trim();
    if (!summary || !contactName) return apiErr(400, "نام مخاطب و خلاصهٔ تماس لازم است.", "BAD_INPUT");
    if (body.studentId) {
      const st = await db.student.findFirst({ where: { id: body.studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    }
    const created = await db.callLog.create({
      data: {
        schoolId, staffUserId: me.id,
        studentId: body.studentId ? String(body.studentId) : null,
        contactName,
        direction: body.direction === "IN" ? "IN" : "OUT",
        summary,
        followUp: body.followUp ? String(body.followUp).trim() : null,
        date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali(),
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
    const found = await db.callLog.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.staffUserId !== me.id && !["MANAGER", "SUPER_ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.callLog.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
