import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser, actingSchoolIdFor , toInt } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_classes");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه (کوکی اعتبارسنجی‌شده)
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const cls = await db.class.findUnique({ where: { id } });
    if (!cls || cls.schoolId !== scopeSchoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    const body = await readJson<Record<string, string | number | undefined>>(req);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.grade !== undefined) data.grade = String(body.grade).trim();
    if (body.field !== undefined) data.field = body.field ? String(body.field) : null;
    if (body.capacity !== undefined) {
      const cap = toInt(body.capacity, 1, 200);
      if (cap === null) return apiErr(400, "ظرفیت باید عدد ۱ تا ۲۰۰ باشد.", "BAD_CAPACITY");
      data.capacity = cap;
    } // FIX راند ۱۶
    if (body.roomNumber !== undefined) data.roomNumber = body.roomNumber ? String(body.roomNumber) : null;
    if (body.homeroomTeacherId !== undefined) {
      // معلم سرکلاس باید معلمِ فعال همان مدرسه باشد (مثل POST)
      if (body.homeroomTeacherId) {
        const tOk = await db.user.findFirst({ where: { id: String(body.homeroomTeacherId), schoolId: cls.schoolId, role: "TEACHER", isActive: true }, select: { id: true } });
        if (!tOk) return apiErr(400, "معلم سرکلاس انتخاب‌شده معتبر نیست.", "BAD_TEACHER");
      }
      data.homeroomTeacherId = body.homeroomTeacherId ? String(body.homeroomTeacherId) : null;
    }

    await db.class.update({ where: { id }, data });
    await audit({ user: me, action: "UPDATE_CLASS", entityType: "CLASS", entityId: id, schoolId: cls.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_classes");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const cls = await db.class.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
    if (!cls || cls.schoolId !== scopeSchoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    if (cls._count.students > 0) {
      return apiErr(400, "کلاس دارای دانش‌آموز است؛ ابتدا دانش‌آموزان را منتقل کنید.", "CLASS_NOT_EMPTY");
    }
    await db.class.update({ where: { id }, data: { isActive: false } });
    await audit({ user: me, action: "ARCHIVE_CLASS", entityType: "CLASS", entityId: id, schoolId: cls.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
