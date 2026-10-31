import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { requireUser, apiOk, apiErr, handleApiError, requireSchoolId } from "@/lib/api";
import { getCheckinSettings, schoolDailyToken } from "@/lib/checkin";
import { todayJalali } from "@/lib/persian";

/**
 * GET /api/attendance/school-qr — QR روزانهٔ مدرسه برای کارکنان:
 * لینک /checkin?t=<توکن روزانه> را به‌صورت SVG برمی‌گرداند تا مدرسه چاپش کند
 * (دیوار ورودی/کلاس) یا همان لینک را روی تگ NFC بنویسد. دانش‌آموز با گوشی
 * خودش اسکن می‌کند، وارد حسابش می‌شود و حضورش ثبت می‌شود.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const settings = await getCheckinSettings(schoolId);
    if (!settings.qrEnabled) return apiErr(409, "روش QR برای این مدرسه فعال نیست.", "METHOD_OFF");
    const date = todayJalali();
    const token = schoolDailyToken(schoolId, date);
    const url = `${req.nextUrl.origin}/checkin?t=${encodeURIComponent(token)}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 260 });
    return apiOk({ svg, url, date });
  } catch (e) {
    return handleApiError(e);
  }
}
