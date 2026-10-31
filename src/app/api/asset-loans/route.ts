import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/asset-loans — امانت‌های بیرون + تاریخچه؛ POST: امانت تازه؛ PATCH: برگشت */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const rows = await db.assetLoan.findMany({ where: { schoolId }, orderBy: { outAt: "desc" }, take: 200 });
    return apiOk({ out: rows.filter((r) => !r.inAt), history: rows.filter((r) => r.inAt).slice(0, 50) });
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
    const body = await readJson<{ assetName?: string; borrowerName?: string; dueAt?: string; note?: string }>(req);
    const assetName = String(body.assetName ?? "").trim();
    const borrowerName = String(body.borrowerName ?? "").trim();
    if (!assetName || !borrowerName) return apiErr(400, "نام وسیله و امانت‌گیرنده لازم است.", "BAD_INPUT");
    const created = await db.assetLoan.create({
      data: {
        schoolId, assetName, borrowerName,
        borrowerUserId: me.id === borrowerName ? me.id : null,
        dueAt: body.dueAt ? String(body.dueAt).trim() : null,
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
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string }>(req);
    const found = await db.assetLoan.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.inAt) return apiErr(409, "این وسیله قبلاً برگشته است.", "ALREADY_IN");
    await db.assetLoan.update({ where: { id: found.id }, data: { inAt: new Date() } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
