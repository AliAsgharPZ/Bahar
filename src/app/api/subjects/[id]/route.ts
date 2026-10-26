import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser, actingSchoolIdFor , toInt } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_subjects");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه (کوکی اعتبارسنجی‌شده)
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const subject = await db.subject.findUnique({ where: { id } });
    if (!subject || subject.schoolId !== scopeSchoolId) return apiErr(404, "درس یافت نشد.", "NOT_FOUND");
    const body = await readJson<Record<string, string | number | undefined>>(req);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.code !== undefined) data.code = body.code ? String(body.code) : null;
    if (body.grade !== undefined) data.grade = body.grade ? String(body.grade) : null;
    if (body.weeklyHours !== undefined) {
      const wh = toInt(body.weeklyHours, 0, 12);
      if (wh === null) return apiErr(400, "ساعت هفتگی باید عدد ۰ تا ۱۲ باشد.", "BAD_HOURS");
      data.weeklyHours = wh;
    } // FIX راند ۱۶
    await db.subject.update({ where: { id }, data });
    await audit({ user: me, action: "UPDATE_SUBJECT", entityType: "SUBJECT", entityId: id, schoolId: subject.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_subjects");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const subject = await db.subject.findUnique({ where: { id }, include: { _count: { select: { teachingAssignments: true, gradeRecords: true } } } });
    if (!subject || subject.schoolId !== scopeSchoolId) return apiErr(404, "درس یافت نشد.", "NOT_FOUND");
    if (subject._count.gradeRecords > 0 || subject._count.teachingAssignments > 0) {
      return apiErr(400, "این درس سابقه دارد و قابل حذف نیست.", "IN_USE");
    }
    await db.subject.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_SUBJECT", entityType: "SUBJECT", entityId: id, schoolId: subject.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
