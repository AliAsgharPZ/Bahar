import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;
const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/supply-requests — درخواست‌های لوازم من + صف دفتر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const rows = await db.supplyRequest.findMany({
      where: { schoolId, ...(isOffice ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({ isOffice, items: rows });
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
    const body = await readJson<{ item?: string; qty?: number; reason?: string }>(req);
    const item = String(body.item ?? "").trim();
    if (!item) return apiErr(400, "نام کالا لازم است.", "BAD_INPUT");
    const created = await db.supplyRequest.create({
      data: {
        schoolId, requesterId: me.id, requesterName: `${me.firstName} ${me.lastName}`,
        item, qty: Math.max(1, Math.round(Number(body.qty ?? 1))),
        reason: body.reason ? String(body.reason).trim() : null,
      },
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
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["APPROVED", "DELIVERED", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.supplyRequest.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    const updated = await db.supplyRequest.update({ where: { id: found.id }, data: { status, handledById: me.id } });
    if (status !== "APPROVED") {
      await notifyUser(found.requesterId, status === "DELIVERED" ? "SUCCESS" : "INFO",
        status === "DELIVERED" ? "لوازم‌تان تحویل داده شد" : "درخواست لوازم رد شد",
        `درخواست «${found.item}»: ${status === "DELIVERED" ? "تحویل داده شد" : "متأسفانه رد شد"}.`,
        "/app/supply-requests", "SUPPLY");
    }
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
