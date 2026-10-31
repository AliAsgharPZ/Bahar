import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/club-proposals — پیشنهادهای تشکیل باشگاه تازه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const rows = await db.clubProposal.findMany({
      where: { schoolId, ...(isOffice ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return apiOk({ isOffice, items: rows });
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
    const body = await readJson<{ title?: string; description?: string }>(req);
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || description.length < 10) return apiErr(400, "نام باشگاه و توضیح کامل (برنامه و هدف) لازم است.", "BAD_INPUT");
    const created = await db.clubProposal.create({
      data: { schoolId, requesterId: me.id, requesterName: `${me.firstName} ${me.lastName}`, title, description },
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
    if (!["APPROVED", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.clubProposal.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "پیشنهاد یافت نشد.", "NOT_FOUND");
    const updated = await db.clubProposal.update({ where: { id: found.id }, data: { status, handledById: me.id } });
    await notifyUser(found.requesterId, status === "APPROVED" ? "SUCCESS" : "INFO",
      status === "APPROVED" ? "باشگاه‌تان تأیید شد" : "دربارهٔ پیشنهاد باشگاه‌تان",
      `پیشنهاد «${found.title}»: ${status === "APPROVED" ? "تأیید شد؛ برای راه‌اندازی با دفتر هماهنگ کنید" : "این بار تأیید نشد"}.`,
      "/app/club-proposals", "CLUB");
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
