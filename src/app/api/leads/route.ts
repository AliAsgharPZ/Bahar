import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, ApiError, isDemoUser, actingSchoolIdFor , audit } from "@/lib/api";

/** GET /api/leads — لیدهای پیش‌ثبت‌نام سایت مدرسه (مدیر/ادمین) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");
    if (!["MANAGER", "SUPER_ADMIN", "ADMIN", "DEPUTY"].includes(me.role)) {
      throw new ApiError(403, "FORBIDDEN", "دسترسی ندارید.");
    }
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const leads = await db.schoolLead.findMany({
      where: { schoolId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({
      leads,
      summary: {
        total: leads.length,
        new: leads.filter((l) => l.status === "NEW").length,
        contacted: leads.filter((l) => l.status === "CONTACTED").length,
        registered: leads.filter((l) => l.status === "REGISTERED").length,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/leads — تغییر وضعیت لید */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");
    if (!["MANAGER", "SUPER_ADMIN", "ADMIN", "DEPUTY"].includes(me.role)) {
      throw new ApiError(403, "FORBIDDEN", "دسترسی ندارید.");
    }
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["NEW", "CONTACTED", "REGISTERED", "ARCHIVED"].includes(status)) {
      throw new ApiError(400, "BAD_STATUS", "وضعیت نامعتبر است.");
    }
    const lead = await db.schoolLead.findUnique({ where: { id: String(body.id ?? "") } });
    if (!lead || lead.schoolId !== schoolId) throw new ApiError(404, "NOT_FOUND", "لید یافت نشد.");
    await db.schoolLead.update({ where: { id: lead.id }, data: { status } });
    await audit({ user: me, action: "تغییر وضعیت سرنخ", entityType: "SchoolLead", entityId: lead.id, schoolId: lead.schoolId, meta: { status } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
