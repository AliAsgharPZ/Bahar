import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser } from "@/lib/api";
import { shadConnect, ShadApiError } from "@/lib/shad";
import { isValidShadNumber } from "@/lib/auth";
import { enDigits } from "@/lib/persian";
import { planHas } from "@/lib/plans";

/** POST /api/shad/connect — اتصال حساب شاد مدیر با توکن auth (web.shad.ir) */
export async function POST(req: NextRequest) {
  try {
    /* FIX (راند ۱۹-a): سوپرادمین/ادمین داخل «پنل مدرسه» هم می‌توانند دروازهٔ واقعی
       را وصل کنند؛ خارج از پنل، me.schoolId تهی است و NO_SCHOOL می‌گیرند. */
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (!me.schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");
    // دروازه شاد قابلیت پلن طلایی+ است
    const school = await db.school.findUnique({ where: { id: me.schoolId }, select: { plan: true, shadEnabled: true } });
    // راند ۱۸: شاد اختیاری است — مدرسه می‌تواند خاموشش کرده باشد
    if (school && school.shadEnabled === false) {
      return apiErr(403, "قابلیت شاد در این مدرسه غیرفعال شده است.", "SHAD_DISABLED");
    }
    if (school && !planHas(school.plan, "shad")) {
      return apiErr(403, "دروازه شاد در اشتراک این مدرسه فعال نیست (پلن طلایی یا الماسی لازم است).", "PLAN");
    }
    const body = await readJson<{ token?: string; phone?: string }>(req);

    const token = String(body.token ?? "").trim();
    const phone = enDigits(String(body.phone ?? "")).trim();
    if (!isValidShadNumber(phone)) {
      return apiErr(400, "شماره شاد مدیر (موبایل ۰۹…) نامعتبر است.", "BAD_PHONE");
    }
    if (token.length < 20) {
      return apiErr(400, "توکن شاد نامعتبر است؛ از web.shad.ir آن را کپی کنید.", "BAD_TOKEN");
    }

    try {
      const result = await shadConnect(me.schoolId, phone, token, me.id);
      await audit({
        user: me, action: "SHAD_CONNECT", entityType: "SHAD_SESSION",
        meta: { phone: result.account.phone, accountName: result.account.name },
        schoolId: me.schoolId,
      });
      return apiOk({ ok: true, account: result.account });
    } catch (e) {
      if (e instanceof ShadApiError) {
        return apiErr(502, e.message, e.code);
      }
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
