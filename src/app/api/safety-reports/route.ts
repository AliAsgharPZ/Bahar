import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const COUNSEL = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;
const CATEGORIES = ["BULLYING", "SAFETY", "HEALTH", "OTHER"] as const;

/**
 * POST /api/safety-reports — گزارش کاملاً ناشناس: هیچ فیلدی از گزارش‌دهنده ذخیره نمی‌شود
 * GET / PATCH — فقط مدیریت و معاون/مشاور: صف رسیدگی
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ category?: string; text?: string }>(req);
    const text = String(body.text ?? "").trim();
    if (text.length < 10) return apiErr(400, "شرح گزارش را کامل‌تر بنویسید تا قابل پیگیری باشد.", "BAD_INPUT");
    const category = body.category && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : "OTHER";
    const created = await db.safetyReport.create({ data: { schoolId, category, text: text.slice(0, 3000) } });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...COUNSEL]);
    const schoolId = requireSchoolId(me);
    const rows = await db.safetyReport.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 200 });
    return apiOk({ items: rows, newCount: rows.filter((r) => r.status === "NEW").length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...COUNSEL]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string; handledNote?: string }>(req);
    const status = String(body.status ?? "");
    if (!["SEEN", "HANDLED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.safetyReport.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "گزارش یافت نشد.", "NOT_FOUND");
    await db.safetyReport.update({
      where: { id: found.id },
      data: { status, handledById: me.id, handledNote: body.handledNote ? String(body.handledNote).trim() : found.handledNote },
    });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
