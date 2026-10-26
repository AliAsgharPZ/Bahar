import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, audit, isDemoUser, actingSchoolIdFor } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requirePermission(req, "manage_schedule");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    // دامنه مدرسه: کاربر مدرسه‌ای یا ادمینِ داخل پنل مدرسه (کوکی اعتبارسنجی‌شده)
    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const assignment = await db.teachingAssignment.findUnique({ where: { id } });
    if (!assignment || assignment.schoolId !== scopeSchoolId) {
      return apiErr(404, "تخصیص یافت نشد.", "NOT_FOUND");
    }
    await db.teachingAssignment.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_TEACHING", entityType: "TEACHING", entityId: id, schoolId: assignment.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
