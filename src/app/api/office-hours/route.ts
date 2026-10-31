import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/office-hours — ساعات مراجعهٔ همهٔ معلمان؛ POST/DELETE: هر معلم ساعت خودش */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const items = await db.officeHour.findMany({ where: { schoolId }, orderBy: { weekday: "asc" }, take: 200 });
    return apiOk({ isStaff: (STAFF as readonly string[]).includes(me.role), myUserId: me.id, items });
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
    const body = await readJson<{ weekday?: string; timeText?: string; room?: string }>(req);
    const weekday = String(body.weekday ?? "").trim();
    const timeText = String(body.timeText ?? "").trim();
    if (!weekday || !timeText) return apiErr(400, "روز و ساعت مراجعه لازم است.", "BAD_INPUT");
    const created = await db.officeHour.create({
      data: {
        schoolId, teacherUserId: me.id, teacherName: `${me.firstName} ${me.lastName}`,
        weekday, timeText,
        room: body.room ? String(body.room).trim() : null,
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
    const found = await db.officeHour.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.teacherUserId !== me.id && !["MANAGER", "SUPER_ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.officeHour.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
