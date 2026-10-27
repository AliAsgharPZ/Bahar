import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { GRADING_SCALES, CALENDAR_SYSTEMS } from "@/lib/grades-scale";

/* ============================================================
   بهار | پروفایل کشور مدرسه — تقویم، مقیاس نمره، واحد پول و
   آغاز هفته؛ روی خروجی نمرات و نمایش‌های سامانه اثر می‌گذارد
   تا سامانه با ساختار آموزشی کشورهای مختلف هماهنگ شود.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, calendarSystem: true, gradingScale: true, currencyLabel: true, weekStart: true },
    });
    if (!school) return apiErr(404, "مدرسه یافت نشد.", "NOT_FOUND");
    return apiOk({ locale: school, scales: GRADING_SCALES, calendars: CALENDAR_SYSTEMS });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ calendarSystem?: string; gradingScale?: string; currencyLabel?: string; weekStart?: string }>(req);
    const calendars = CALENDAR_SYSTEMS.map((c) => c.value) as string[];
    const scales = GRADING_SCALES.map((s) => s.value) as string[];
    if (body.calendarSystem && !calendars.includes(body.calendarSystem)) return apiErr(400, "تقویم نامعتبر است.", "BAD_CAL");
    if (body.gradingScale && !scales.includes(body.gradingScale)) return apiErr(400, "مقیاس نمره نامعتبر است.", "BAD_SCALE");
    if (body.weekStart && !["SATURDAY", "SUNDAY", "MONDAY"].includes(body.weekStart)) return apiErr(400, "آغاز هفته نامعتبر است.", "BAD_WEEK");
    const school = await db.school.update({
      where: { id: schoolId },
      data: {
        ...(body.calendarSystem ? { calendarSystem: body.calendarSystem } : {}),
        ...(body.gradingScale ? { gradingScale: body.gradingScale } : {}),
        ...(body.currencyLabel ? { currencyLabel: body.currencyLabel.trim().slice(0, 20) } : {}),
        ...(body.weekStart ? { weekStart: body.weekStart } : {}),
      },
      select: { id: true, name: true, calendarSystem: true, gradingScale: true, currencyLabel: true, weekStart: true },
    });
    await audit({ user: me, action: "به‌روزرسانی پروفایل کشور مدرسه", entityType: "School", entityId: schoolId, schoolId });
    return apiOk({ locale: school });
  } catch (e) {
    return handleApiError(e);
  }
}
