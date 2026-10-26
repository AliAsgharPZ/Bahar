import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

/** GET /api/shad/outbox — گزارش پیام‌های ارسالی از دروازه شاد */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    // FIX (راند ۱۶): معاون بدون «ارسال شاد» پیام‌های حاوی رمز اولیه کاربران را می‌دید
    if (me.role === "DEPUTY" && !hasPermission(me, "send_shad") && !hasPermission(me, "view_shad")) {
      return apiErr(403, "مشاهده صف ارسال شاد نیاز به دسترسی «ارسال شاد» یا «مشاهده شاد» دارد.", "FORBIDDEN");
    }
    // ادمین سرویس فقط با دسترسی view_shad
    if (me.role === "ADMIN" && !hasPermission(me, "view_shad")) {
      return apiErr(403, "مشاهده صف ارسال شاد نیاز به دسترسی «مشاهده وضعیت شاد» دارد.", "FORBIDDEN");
    }
    /* FIX (راند ۱۹-a): قبلاً نقش سرویس فقط پارامتر schoolId را می‌خواند و
       me.schoolId را نادیده می‌گرفت → سوپرادمین داخل «پنل مدرسه» (که me.schoolId
       با کوکی bahar_acting_school ادغام شده) همیشه گزارش خالی می‌دید.
       حالا: پارامتر صریح (فقط نقش سرویس) > مدرسهٔ مؤثر (خود کاربر یا پنل فعال).
       مدیر/معاون همچنان فقط مدرسهٔ خودشان را می‌بینند (بدون IDOR). */
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const qSchoolId = isService ? new URL(req.url).searchParams.get("schoolId") : null;
    const schoolId = qSchoolId ?? me.schoolId ?? undefined;
    if (!schoolId) return apiOk({ outbox: [] });

    const outbox = await db.shadOutbox.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return apiOk({
      outbox: outbox.map((o) => ({
        id: o.id,
        recipientName: o.recipientName,
        recipientShadNumber: o.recipientShadNumber,
        body: o.body,
        purpose: o.purpose,
        status: o.status,
        error: o.error,
        sentAt: o.sentAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
