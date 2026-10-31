import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/assembly?date= — برنامهٔ صبحگاه یک روز */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const date = req.nextUrl.searchParams.get("date") || todayJalali();
    const items = await db.assemblyItem.findMany({ where: { schoolId, date }, orderBy: { createdAt: "asc" } });
    return apiOk({ date, items, isStaff: (STAFF as readonly string[]).includes(me.role) });
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
    const body = await readJson<{ date?: string; segment?: string; title?: string; presenterName?: string; className?: string; note?: string }>(req);
    const segment = String(body.segment ?? "").trim();
    if (!segment) return apiErr(400, "بخش صبحگاه (مثلاً قرائت قرآن) لازم است.", "BAD_INPUT");
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const created = await db.assemblyItem.create({
      data: {
        schoolId, date, segment,
        title: body.title ? String(body.title).trim() : null,
        presenterName: body.presenterName ? String(body.presenterName).trim() : null,
        className: body.className ? String(body.className).trim() : null,
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
    const found = await db.assemblyItem.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.assemblyItem.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
