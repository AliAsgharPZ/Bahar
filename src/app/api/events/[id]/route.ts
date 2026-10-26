import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser, actingSchoolIdFor } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_events");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه (کوکی اعتبارسنجی‌شده)
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const ev = await db.schoolEvent.findUnique({ where: { id } });
    if (!ev || ev.schoolId !== scopeSchoolId) return apiErr(404, "رویداد یافت نشد.", "NOT_FOUND");
    const body = await readJson<Record<string, string>>(req);
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description);
    if (body.startAt !== undefined) {
      const d = new Date(String(body.startAt));
      if (isNaN(d.getTime())) return apiErr(400, "زمان شروع نامعتبر است.", "BAD_DATE");
      data.startAt = d;
    }
    if (body.endAt !== undefined) {
      if (body.endAt) {
        const d = new Date(String(body.endAt));
        if (isNaN(d.getTime())) return apiErr(400, "زمان پایان نامعتبر است.", "BAD_DATE");
        data.endAt = d;
      } else {
        data.endAt = null;
      }
    }
    // FIX (راند ۱۶): مقادیر enum در PATCH هم اعتبارسنجی می‌شوند (مثل POST)
    if (body.kind !== undefined) {
      if (!["MEETING", "CEREMONY", "EXAM", "HOLIDAY", "TRIP", "WORKSHOP", "OTHER"].includes(String(body.kind))) {
        return apiErr(400, "نوع رویداد نامعتبر است.", "BAD_KIND");
      }
      data.kind = String(body.kind);
    }
    if (body.audience !== undefined) {
      if (!["ALL", "STUDENTS", "TEACHERS", "PARENTS", "CLASS"].includes(String(body.audience))) {
        return apiErr(400, "مخاطب رویداد نامعتبر است.", "BAD_AUDIENCE");
      }
      data.audience = String(body.audience);
    }
    await db.schoolEvent.update({ where: { id }, data });
    await audit({ user: me, action: "UPDATE_EVENT", entityType: "EVENT", entityId: id, schoolId: ev.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_events");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const ev = await db.schoolEvent.findUnique({ where: { id } });
    if (!ev || ev.schoolId !== scopeSchoolId) return apiErr(404, "رویداد یافت نشد.", "NOT_FOUND");
    await db.schoolEvent.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_EVENT", entityType: "EVENT", entityId: id, schoolId: ev.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
