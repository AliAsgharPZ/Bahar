import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/parking — کارکنان: همهٔ پلاک‌های مجاز؛ بقیه: پلاک‌های خودشان */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const rows = await db.vehiclePermit.findMany({
      where: {
        schoolId,
        ...(isStaff ? {} : { ownerUserId: me.id }),
        ...(q ? { OR: [{ plate: { contains: q } }, { ownerName: { contains: q } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return apiOk({ isStaff, items: rows, activeCount: rows.filter((r) => r.isActive).length });
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
    const body = await readJson<{ ownerName?: string; plate?: string; kind?: string; note?: string }>(req);
    const plate = String(body.plate ?? "").trim();
    if (!plate) return apiErr(400, "پلاک لازم است.", "BAD_INPUT");
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    const created = await db.vehiclePermit.create({
      data: {
        schoolId,
        ownerUserId: me.id,
        ownerName: isStaff && body.ownerName ? String(body.ownerName).trim() : `${me.firstName} ${me.lastName}`,
        plate,
        kind: body.kind === "STAFF" ? "STAFF" : "PARENT",
        note: body.note ? String(body.note).trim() : null,
      },
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
    const body = await readJson<{ id?: string; isActive?: boolean }>(req);
    const found = await db.vehiclePermit.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    if (!isStaff && found.ownerUserId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.vehiclePermit.update({ where: { id: found.id }, data: { isActive: body.isActive !== false } });
    return apiOk({ ok: true });
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
    const found = await db.vehiclePermit.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    if (!isStaff && found.ownerUserId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.vehiclePermit.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
