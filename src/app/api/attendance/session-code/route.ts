import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, requireSchoolId } from "@/lib/api";
import { getCheckinSettings, currentClassCode } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/** GET /api/attendance/session-code?classId= — کد چرخان فعلی کلاس برای نمایش روی تابلو/پروژکتور (کارکنان همان کلاس) */
export async function GET(req: NextRequest) {
  try {
    const me = await requirePermission(req, "take_attendance");
    const schoolId = requireSchoolId(me);
    const classId = new URL(req.url).searchParams.get("classId") ?? "";
    const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true, schoolId: true, homeroomTeacherId: true } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    if (me.role === "TEACHER") {
      const teaches = await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId } });
      if (!teaches && cls.homeroomTeacherId !== me.id) return apiErr(403, "شما معلم این کلاس نیستید.", "FORBIDDEN");
    }
    const settings = await getCheckinSettings(schoolId);
    if (!settings.codeEnabled) return apiErr(409, "روش «کد کلاس» برای این مدرسه فعال نیست.", "METHOD_OFF");
    const date = todayJalali();
    const { code, windowEndsAt } = currentClassCode(classId, date);
    return apiOk({ code, date, windowEndsAt, refreshInSec: Math.max(1, Math.round((windowEndsAt - Date.now()) / 1000)) });
  } catch (e) {
    return handleApiError(e);
  }
}
