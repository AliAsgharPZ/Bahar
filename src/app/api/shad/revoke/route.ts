import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, audit } from "@/lib/api";
import { shadRevoke } from "@/lib/shad";

/** POST /api/shad/revoke — قطع اتصال حساب شاد مدرسه */
export async function POST(req: NextRequest) {
  try {
    /* FIX (راند ۱۹-a): سوپرادمین/ادمین داخل «پنل مدرسه» هم می‌توانند اتصال شاد
       مدرسهٔ فعال را قطع کنند. */
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    if (!me.schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");
    const session = await db.shadSession.findUnique({ where: { schoolId: me.schoolId } });
    if (!session) return apiErr(404, "نشستی وجود ندارد.", "NOT_FOUND");
    await shadRevoke(me.schoolId);
    await audit({ user: me, action: "SHAD_REVOKE", entityType: "SHAD_SESSION", schoolId: me.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
