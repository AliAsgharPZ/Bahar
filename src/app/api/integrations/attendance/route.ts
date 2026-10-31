import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson } from "@/lib/api";
import { getCheckinSettings, hashIntegrationKey, recordCheckin, type AttendanceMethod } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * POST /api/integrations/attendance — ورودی اتصال سامانه‌های بیرونی حضور و غیاب.
 *
 * سامانهٔ بیرونی (دستگاه تشخیص چهره، دوربین CCTV، کارت‌خوان NFC، گیت تردد و…)
 * رویدادهای حضور را با کلید اتصال مدرسه می‌فرستد. بهار هیچ دادهٔ بیومتریکی
 * دریافت یا نگه‌داری نمی‌کند؛ فقط «چه کسی، چه روزی، با چه وضعیتی» ثبت می‌شود.
 *
 * احراز: هدر `x-bahar-key: bhr_...` یا `Authorization: Bearer bhr_...`
 * بدنه: { events: [{ student: "<کد ملی یا شماره دانش‌آموزی>", status?: "PRESENT"|"LATE", date?: "1405-08-09" }] }
 */
export async function POST(req: NextRequest) {
  try {
    const plain = req.headers.get("x-bahar-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!plain) return apiErr(401, "کلید اتصال لازم است.", "NO_KEY");
    const key = await db.integrationKey.findFirst({
      where: { keyHash: hashIntegrationKey(plain), isActive: true },
      select: { id: true, schoolId: true, name: true, method: true },
    });
    if (!key) return apiErr(401, "کلید اتصال معتبر نیست.", "BAD_KEY");
    const settings = await getCheckinSettings(key.schoolId);
    if (!settings.externalEnabled) return apiErr(409, "اتصال بیرونی برای این مدرسه فعال نیست.", "EXTERNAL_OFF");

    const body = await readJson<{ events?: Array<{ student?: string; status?: string; date?: string }> }>(req);
    const events = Array.isArray(body.events) ? body.events.slice(0, 500) : [];
    if (!events.length) return apiErr(400, "رویدادی نفرستادید.", "NO_EVENTS");

    const today = todayJalali();
    const results: Array<{ student: string; ok: boolean; created?: boolean; error?: string }> = [];
    let accepted = 0;
    for (const ev of events) {
      const ident = String(ev.student ?? "").trim();
      const date = ev.date && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : today;
      if (!ident) {
        results.push({ student: ident, ok: false, error: "NO_IDENT" });
        continue;
      }
      const student = await db.student.findFirst({
        where: {
          schoolId: key.schoolId,
          OR: [{ studentNumber: ident }, { user: { nationalId: ident } }],
        },
        select: { id: true, classId: true },
      });
      if (!student || !student.classId) {
        results.push({ student: ident, ok: false, error: "NOT_FOUND" });
        continue;
      }
      const res = await recordCheckin({
        studentId: student.id,
        classId: student.classId,
        date,
        status: ev.status === "LATE" ? "LATE" : "PRESENT",
        method: key.method as AttendanceMethod,
        sourceLabel: key.name,
        recordedById: null,
      });
      if (res.ok) accepted += 1;
      results.push({ student: ident, ok: res.ok, created: res.ok ? res.created : undefined });
    }
    await db.integrationKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return apiOk({ accepted, total: events.length, results });
  } catch (e) {
    return handleApiError(e);
  }
}
