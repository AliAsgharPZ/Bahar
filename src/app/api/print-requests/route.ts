import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;
const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/print-requests — سفارش‌های چاپ من + صف چاپخانهٔ دفتر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const rows = await db.printRequest.findMany({
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
    const body = await readJson<{ title?: string; copies?: number; pages?: number; color?: boolean; note?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "عنوان سند لازم است (مثلاً نمونه‌سؤال ریاضی).", "BAD_INPUT");
    const created = await db.printRequest.create({
      data: {
        schoolId, requesterId: me.id, requesterName: `${me.firstName} ${me.lastName}`,
        title,
        copies: Math.max(1, Math.round(Number(body.copies ?? 1))),
        pages: Math.max(1, Math.round(Number(body.pages ?? 1))),
        color: body.color === true,
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
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["PRINTING", "READY", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.printRequest.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "سفارش یافت نشد.", "NOT_FOUND");
    const updated = await db.printRequest.update({ where: { id: found.id }, data: { status } });
    if (status === "READY") {
      await notifyUser(found.requesterId, "SUCCESS", "چاپ‌تان آماده است", `«${found.title}» چاپ شد و از دفتر قابل تحویل است.`, "/app/print-requests", "PRINT");
    } else if (status === "REJECTED") {
      await notifyUser(found.requesterId, "INFO", "سفارش چاپ رد شد", `سفارش چاپ «${found.title}» رد شد؛ برای جزئیات با دفتر صحبت کنید.`, "/app/print-requests", "PRINT");
    }
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
