import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { getCheckinSettings, distanceM, recordCheckin } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * POST /api/attendance/geo-checkin — اعلام حضور با موقعیت مکانی (ژئوفنس):
 * { lat, lng } از GPS گوشی دانش‌آموز؛ اگر داخل شعاع مدرسه باشد حضور ثبت
 * می‌شود. مختصات دانش‌آموز نگه‌داری نمی‌شود — فقط فاصله بررسی و دور ریخته
 * می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["STUDENT"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const profile = await db.student.findUnique({
      where: { userId: me.id },
      select: { id: true, schoolId: true, classId: true },
    });
    if (!profile || !profile.classId) return apiErr(404, "پروفایل دانش‌آموزی یافت نشد.", "NOT_FOUND");
    const settings = await getCheckinSettings(profile.schoolId);
    if (!settings.geoEnabled || settings.geoLat == null || settings.geoLng == null) {
      return apiErr(409, "روش موقعیت مکانی برای این مدرسه فعال نیست.", "METHOD_OFF");
    }
    const body = await readJson<{ lat?: number; lng?: number }>(req);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return apiErr(400, "موقعیت مکانی معتبر نیست.", "BAD_GEO");
    }
    const dist = distanceM(lat, lng, settings.geoLat, settings.geoLng);
    if (dist > settings.geoRadiusM) {
      return apiErr(400, "از محدودهٔ مدرسه بیرون هستید.", "TOO_FAR", { distanceM: Math.round(dist) });
    }
    const res = await recordCheckin({
      studentId: profile.id,
      classId: profile.classId,
      date: todayJalali(),
      method: "GEO",
    });
    if (!res.ok) return apiErr(500, "ثبت حضور ناموفق بود.", "FAILED");
    return apiOk({ ok: true, created: res.created, distanceM: Math.round(dist) });
  } catch (e) {
    return handleApiError(e);
  }
}
