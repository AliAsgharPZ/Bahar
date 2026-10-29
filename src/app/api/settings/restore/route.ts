import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser } from "@/lib/api";
import { restoreFromPayload } from "@/lib/backup";

/**
 * POST /api/settings/restore — بازیابی کامل سامانه از فایل بکاپ (آپلود JSON)
 * بدنه: {payload: <فایل بکاپ به‌صورت JSON>} + {confirm: true}
 * فقط سوپرادمین. مخرب: همه داده‌های فعلی جایگزین می‌شوند.
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "بازیابی بکاپ فقط توسط مدیر کل سامانه انجام می‌شود.");
    }
    const body = await readJson<{ payload?: unknown; confirm?: boolean; file?: string }>(req);
    if (!body.confirm) {
      throw new ApiError(400, "CONFIRM", "برای بازیابی، تایید صریح لازم است.");
    }
    let payload = body.payload;
    if (!payload && body.file) {
      try {
        payload = JSON.parse(body.file);
      } catch {
        throw new ApiError(400, "BAD_JSON", "فایل بکاپ JSON معتبر نیست.");
      }
    }
    if (!payload) {
      throw new ApiError(400, "BAD_PAYLOAD", "فایل بکاپ ارسال نشده است.");
    }

    const result = await restoreFromPayload(payload);
    await audit({
      user: me, action: "RESTORE_BACKUP", entityType: "BACKUP",
      meta: { total: result.total, restored: result.restored },
    });
    return apiOk({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Error && (e.message.includes("سازگار") || e.message.includes("ناقص"))) {
      return apiErr(400, e.message, "BAD_BACKUP");
    }
    return handleApiError(e);
  }
}
