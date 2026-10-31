import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/keys-log — کلیدهای بیرون + تاریخچه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const rows = await db.keyCheckout.findMany({ where: { schoolId }, orderBy: { outAt: "desc" }, take: 200 });
    return apiOk({
      out: rows.filter((r) => !r.inAt),
      history: rows.filter((r) => r.inAt).slice(0, 50),
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
    const body = await readJson<{ keyLabel?: string; holderName?: string; note?: string }>(req);
    const keyLabel = String(body.keyLabel ?? "").trim();
    const holderName = String(body.holderName ?? "").trim();
    if (!keyLabel || !holderName) return apiErr(400, "برچسب کلید و نام گیرنده لازم است.", "BAD_INPUT");
    const stillOut = await db.keyCheckout.findFirst({ where: { schoolId, keyLabel, inAt: null } });
    if (stillOut) return apiErr(409, "این کلید هنوز بیرون است.", "STILL_OUT");
    const created = await db.keyCheckout.create({
      data: { schoolId, keyLabel, holderName, note: body.note ? String(body.note).trim() : null },
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
    const found = await db.keyCheckout.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.inAt) return apiErr(409, "این کلید قبلاً برگشته است.", "ALREADY_IN");
    await db.keyCheckout.update({ where: { id: found.id }, data: { inAt: new Date() } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
