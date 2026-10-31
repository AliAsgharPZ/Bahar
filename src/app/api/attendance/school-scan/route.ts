import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { getCheckinSettings, parseSchoolToken, recordCheckin } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * POST /api/attendance/school-scan — دانش‌آموز QR روزانهٔ مدرسه را اسکن کرده
 * و وارد حسابش شده است: { token } → ثبت حضور با روش QR.
 * توکن باید مال مدرسهٔ خود دانش‌آموز و مال امروز باشد.
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
    const body = await readJson<{ token?: string }>(req);
    const parsed = parseSchoolToken(String(body.token ?? ""), todayJalali());
    if (!parsed || parsed.schoolId !== profile.schoolId) {
      return apiErr(400, "این QR معتبر نیست یا مهلتش گذشته است.", "BAD_TOKEN");
    }
    const settings = await getCheckinSettings(profile.schoolId);
    if (!settings.qrEnabled) return apiErr(409, "روش QR برای این مدرسه فعال نیست.", "METHOD_OFF");
    const res = await recordCheckin({
      studentId: profile.id,
      classId: profile.classId,
      date: todayJalali(),
      method: "QR",
    });
    if (!res.ok) return apiErr(500, "ثبت حضور ناموفق بود.", "FAILED");
    return apiOk({ ok: true, created: res.created });
  } catch (e) {
    return handleApiError(e);
  }
}
