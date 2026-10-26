import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, audit, readJson, ApiError, isDemoUser, actingSchoolIdFor } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const a = await db.announcement.findUnique({ where: { id } });
    if (!a) return apiErr(404, "اطلاعیه یافت نشد.", "NOT_FOUND");

    const isPlatform = a.scope === "PLATFORM";
    // کوکی مدرسه فعال فقط از طریق اعتبارسنجِ مرکزی — خواندن خام قابل جعل از سمت کلاینت است
    const acting = actingSchoolIdFor(req, me);
    const canManage =
      (a.schoolId && (a.schoolId === me.schoolId || a.schoolId === acting)) ||
      (isPlatform && (me.role === "SUPER_ADMIN" || hasPermission(me, "platform_announcements")));
    if (!canManage || (me.role !== "MANAGER" && me.role !== "SUPER_ADMIN" && me.role !== "ADMIN" && !hasPermission(me, "manage_announcements"))) {
      return apiErr(403, "ویرایش این اطلاعیه برای شما مجاز نیست.", "FORBIDDEN");
    }

    const body = await readJson<Record<string, unknown>>(req).catch(() => ({}) as Record<string, unknown>);
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.body !== undefined) data.body = String(body.body);
    if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);
    await db.announcement.update({ where: { id }, data });
    await audit({ user: me, action: "UPDATE_ANNOUNCEMENT", entityType: "ANNOUNCEMENT", entityId: id, schoolId: a.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const a = await db.announcement.findUnique({ where: { id } });
    if (!a) return apiErr(404, "اطلاعیه یافت نشد.", "NOT_FOUND");

    // کوکی مدرسه فعال فقط از طریق اعتبارسنجِ مرکزی
    const acting = actingSchoolIdFor(req, me);
    const canManage =
      (a.schoolId && (a.schoolId === me.schoolId || a.schoolId === acting) && ["MANAGER", "SUPER_ADMIN", "ADMIN"].includes(me.role)) ||
      (a.scope === "PLATFORM" && (me.role === "SUPER_ADMIN" || hasPermission(me, "platform_announcements")));
    if (!canManage) {
      throw new ApiError(403, "FORBIDDEN", "حذف این اطلاعیه برای شما مجاز نیست.");
    }
    await db.announcement.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_ANNOUNCEMENT", entityType: "ANNOUNCEMENT", entityId: id, schoolId: a.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
