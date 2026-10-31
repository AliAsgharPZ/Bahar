import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const LIBRARIAN = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/book-suggestions — پیشنهادهای خرید کتاب برای کتابخانه + تصمیم کتابدار */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const canDecide = (LIBRARIAN as readonly string[]).includes(me.role);
    const rows = await db.bookSuggestion.findMany({
      where: { schoolId, ...(canDecide ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({ canDecide, items: rows });
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
    const body = await readJson<{ title?: string; author?: string; reason?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "نام کتاب لازم است.", "BAD_INPUT");
    const created = await db.bookSuggestion.create({
      data: {
        schoolId, requesterId: me.id, requesterName: `${me.firstName} ${me.lastName}`,
        title,
        author: body.author ? String(body.author).trim() : null,
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
    const me = await requireUser(req, [...LIBRARIAN]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["BOUGHT", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.bookSuggestion.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "پیشنهاد یافت نشد.", "NOT_FOUND");
    const updated = await db.bookSuggestion.update({ where: { id: found.id }, data: { status } });
    await notifyUser(found.requesterId, status === "BOUGHT" ? "SUCCESS" : "INFO",
      status === "BOUGHT" ? "کتاب پیشنهادی‌تان خریداری شد" : "دربارهٔ پیشنهاد کتاب‌تان",
      `کتاب «${found.title}»: ${status === "BOUGHT" ? "خریداری و به کتابخانه اضافه شد" : "این بار خریداری نشد"}.`,
      "/app/book-suggestions", "BOOK");
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
