import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser, actingSchoolIdFor } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_assignments");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه (کوکی اعتبارسنجی‌شده)
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const a = await db.assignment.findUnique({ where: { id }, include: { class: true } });
    if (!a || a.class.schoolId !== scopeSchoolId) return apiErr(404, "تکلیف یافت نشد.", "NOT_FOUND");
    if (me.role === "TEACHER" && a.teacherId !== me.id) {
      return apiErr(403, "این تکلیف متعلق به شما نیست.", "FORBIDDEN");
    }
    const body = await readJson<Record<string, string>>(req);
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.dueDate !== undefined) {
      const due = new Date(String(body.dueDate));
      if (isNaN(due.getTime())) return apiErr(400, "تاریخ نامعتبر است.", "BAD_DATE");
      data.dueDate = due;
    }
    await db.assignment.update({ where: { id }, data });
    await audit({ user: me, action: "UPDATE_ASSIGNMENT", entityType: "ASSIGNMENT", entityId: id, schoolId: a.class.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_assignments");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const a = await db.assignment.findUnique({ where: { id }, include: { class: true } });
    if (!a || a.class.schoolId !== scopeSchoolId) return apiErr(404, "تکلیف یافت نشد.", "NOT_FOUND");
    if (me.role === "TEACHER" && a.teacherId !== me.id) {
      return apiErr(403, "این تکلیف متعلق به شما نیست.", "FORBIDDEN");
    }
    await db.assignment.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_ASSIGNMENT", entityType: "ASSIGNMENT", entityId: id, schoolId: a.class.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
