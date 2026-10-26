import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

/** GET /api/audit?limit= — گزارش فعالیت */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    // ادمین سرویس فقط با دسترسی view_audit گزارش‌های کل سرویس را می‌بیند
    const isService = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && hasPermission(me, "view_audit"));
    const acting = actingSchoolIdFor(req, me) ?? undefined;
    if (!isService && me.role !== "MANAGER" && !(me.role === "ADMIN" && acting)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    const limit = Math.max(1, Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50, 200)); // FIX راند ۱۶
    const where = isService ? {} : { schoolId: (me.role === "ADMIN" ? acting : me.schoolId) ?? undefined };
    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return apiOk({ logs });
  } catch (e) {
    return handleApiError(e);
  }
}
