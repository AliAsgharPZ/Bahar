import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { getCheckinSettings, parseStudentQr, recordCheckin } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * POST /api/attendance/scan — اسکن کارت QR دانش‌آموز با دستگاه معلم/مدیر.
 * بدنه: { payload } متن داخل QR، یا { studentNumber } برای ورود دستی کد دانش‌آموزی.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "take_attendance");
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const settings = await getCheckinSettings(schoolId);
    if (!settings.qrEnabled) return apiErr(409, "روش «کارت QR» برای این مدرسه فعال نیست.", "METHOD_OFF");
    const body = await readJson<{ payload?: string; studentNumber?: string }>(req);
    const date = todayJalali();

    let studentId: string | null = null;
    if (body.payload) {
      const parsed = parseStudentQr(String(body.payload), date);
      if (!parsed) return apiErr(400, "کد QR معتبر نیست یا مربوط به امروز نیست.", "BAD_QR");
      studentId = parsed.studentId;
    } else if (body.studentNumber) {
      const st = await db.student.findFirst({
        where: { schoolId, studentNumber: String(body.studentNumber).trim() },
        select: { id: true },
      });
      studentId = st?.id ?? null;
    }
    if (!studentId) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true, schoolId: true, classId: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!student || student.schoolId !== schoolId || !student.classId) {
      return apiErr(404, "دانش‌آموز در این مدرسه نیست.", "NOT_FOUND");
    }
    const res = await recordCheckin({
      studentId: student.id,
      classId: student.classId,
      date,
      method: "QR",
      recordedById: me.id,
    });
    if (!res.ok) return apiErr(500, "ثبت انجام نشد.", "FAILED");
    return apiOk({
      ok: true,
      created: res.created,
      student: `${student.user.firstName} ${student.user.lastName}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
