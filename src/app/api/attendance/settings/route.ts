import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { getCheckinSettings, newIntegrationKey, EXTERNAL_METHODS } from "@/lib/checkin";

const MANAGERS = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"];

/**
 * GET    /api/attendance/settings — تنظیمات روش‌های ثبت حضور + کلیدهای اتصال (بدون هش/کلید)
 * PUT    /api/attendance/settings — فعال/غیرفعال‌کردن روش‌ها (مدیران)
 * POST   /api/attendance/settings — ساخت کلید اتصال تازه؛ خود کلید فقط همین یک بار برمی‌گردد
 * DELETE /api/attendance/settings?id= — لغو یک کلید اتصال
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const settings = await getCheckinSettings(schoolId);
    const keys = MANAGERS.includes(me.role)
      ? await db.integrationKey.findMany({
          where: { schoolId },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, method: true, isActive: true, lastUsedAt: true, createdAt: true },
        })
      : [];
    return apiOk({ settings, keys, canManage: MANAGERS.includes(me.role) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req, MANAGERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      qrEnabled?: boolean; codeEnabled?: boolean; kioskEnabled?: boolean; externalEnabled?: boolean;
      geoEnabled?: boolean; geoLat?: number | null; geoLng?: number | null; geoRadiusM?: number;
    }>(req);
    const geoLat = body.geoLat == null ? null : Number(body.geoLat);
    const geoLng = body.geoLng == null ? null : Number(body.geoLng);
    if (geoLat != null && (!Number.isFinite(geoLat) || geoLat < -90 || geoLat > 90)) {
      return apiErr(400, "عرض جغرافیایی معتبر نیست.", "BAD_GEO");
    }
    if (geoLng != null && (!Number.isFinite(geoLng) || geoLng < -180 || geoLng > 180)) {
      return apiErr(400, "طول جغرافیایی معتبر نیست.", "BAD_GEO");
    }
    if (body.geoEnabled && (geoLat == null || geoLng == null)) {
      return apiErr(400, "برای فعال‌کردن موقعیت مکانی، مختصات مدرسه لازم است.", "BAD_GEO");
    }
    const geoRadiusM = Math.min(5000, Math.max(30, Math.round(Number(body.geoRadiusM ?? 200)) || 200));
    const data = {
      qrEnabled: !!body.qrEnabled,
      codeEnabled: !!body.codeEnabled,
      kioskEnabled: !!body.kioskEnabled,
      externalEnabled: !!body.externalEnabled,
      geoEnabled: !!body.geoEnabled,
      geoLat,
      geoLng,
      geoRadiusM,
    };
    await db.attendanceSettings.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data,
    });
    await audit({ user: me, action: "attendance.settings.update", entityType: "SCHOOL", entityId: schoolId, meta: data, schoolId });
    return apiOk({ settings: data });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, MANAGERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ name?: string; method?: string }>(req);
    const name = String(body.name ?? "").trim().slice(0, 80);
    const method = String(body.method ?? "OTHER");
    if (!name) return apiErr(400, "نام دستگاه/سامانه را بنویسید.", "BAD_INPUT");
    if (!EXTERNAL_METHODS.includes(method as (typeof EXTERNAL_METHODS)[number])) {
      return apiErr(400, "روش اتصال معتبر نیست.", "BAD_INPUT");
    }
    const settings = await getCheckinSettings(schoolId);
    if (!settings.externalEnabled) {
      return apiErr(409, "اول اتصال سامانه‌های بیرونی را فعال کنید.", "EXTERNAL_OFF");
    }
    const { plain, hash } = newIntegrationKey();
    const row = await db.integrationKey.create({
      data: { schoolId, name, method, keyHash: hash },
      select: { id: true, name: true, method: true, isActive: true, createdAt: true },
    });
    await audit({ user: me, action: "attendance.integration.create", entityType: "SCHOOL", entityId: schoolId, meta: { name, method }, schoolId });
    // کلید خام فقط در همین پاسخ برمی‌گردد و دیگر قابل بازیابی نیست
    return apiOk({ key: row, plainKey: plain });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, MANAGERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const row = await db.integrationKey.findFirst({ where: { id, schoolId } });
    if (!row) return apiErr(404, "کلید یافت نشد.", "NOT_FOUND");
    await db.integrationKey.update({ where: { id }, data: { isActive: false } });
    await audit({ user: me, action: "attendance.integration.revoke", entityType: "SCHOOL", entityId: schoolId, meta: { name: row.name }, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
