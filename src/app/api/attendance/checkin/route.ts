import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";
import { getCheckinSettings, studentQrPayload, verifyClassCode, recordCheckin } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * GET  /api/attendance/checkin — برای دانش‌آموز: وضعیت فعال‌بودن روش‌ها + کارت QR امروز خودش
 * POST /api/attendance/checkin — اعلام حضور با کد چرخان کلاس: { code }
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["STUDENT"]);
    const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true, schoolId: true } });
    if (!profile) return apiOk({ qrEnabled: false, codeEnabled: false, geoEnabled: false });
    const settings = await getCheckinSettings(profile.schoolId);
    let qrSvg: string | null = null;
    if (settings.qrEnabled) {
      const payload = studentQrPayload(profile.id, todayJalali());
      qrSvg = await QRCode.toString(payload, { type: "svg", margin: 1, width: 220 });
    }
    return apiOk({ qrEnabled: settings.qrEnabled, codeEnabled: settings.codeEnabled, geoEnabled: settings.geoEnabled, qrSvg });
  } catch (e) {
    return handleApiError(e);
  }
}

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
    if (!settings.codeEnabled) return apiErr(409, "روش «کد کلاس» برای این مدرسه فعال نیست.", "METHOD_OFF");
    const body = await readJson<{ code?: string }>(req);
    const date = todayJalali();
    if (!verifyClassCode(profile.classId, date, String(body.code ?? ""))) {
      return apiErr(400, "کد کلاس درست نیست یا مهلتش گذشته است.", "BAD_CODE");
    }
    const res = await recordCheckin({
      studentId: profile.id,
      classId: profile.classId,
      date,
      method: "CODE",
      recordedById: me.id,
    });
    if (!res.ok) return apiErr(500, "ثبت انجام نشد.", "FAILED");
    return apiOk({ ok: true, created: res.created });
  } catch (e) {
    return handleApiError(e);
  }
}
