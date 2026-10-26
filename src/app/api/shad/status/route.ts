import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError } from "@/lib/api";
import { shadStatus, gatewayHealth } from "@/lib/shad";

/** GET /api/shad/status — وضعیت اتصال حساب شاد مدرسه + دروازه + روشن‌بودن ماژول مدرسه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    // FIX (راند ۱۶): نقش خدماتی داخل پنل مدرسه — وضعیت همان مدرسه را می‌بیند
    // (راند ۱۹: me.schoolId پس از ورود به پنل مدرسه خودِ مدرسهٔ فعال است)
    const schoolId = me.schoolId;
    if (!schoolId) return apiOk({ connected: false, status: "NO_SCHOOL", mode: "NONE", gateway: { online: false }, shadEnabled: true });
    const [status, gateway, school] = await Promise.all([
      shadStatus(schoolId),
      gatewayHealth(),
      db.school.findUnique({ where: { id: schoolId }, select: { shadEnabled: true } }),
    ]);
    // راند ۱۸: شاد مدرسه می‌تواند خاموش باشد — UI با این پرچم فرم‌ها را مخفی می‌کند
    return apiOk({ ...status, gateway, shadEnabled: school?.shadEnabled !== false });
  } catch (e) {
    return handleApiError(e);
  }
}
