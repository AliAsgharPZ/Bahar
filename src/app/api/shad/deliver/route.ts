import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser } from "@/lib/api";
import { deliverCredentials, shadStatus, retryQueuedOutboxForSchool } from "@/lib/shad";
import { ROLE_LABELS } from "@/lib/roles";
import { planHas } from "@/lib/plans";

/** POST /api/shad/deliver — ارسال (دوباره) اعتبارنامه کاربران به شماره شادشان */
export async function POST(req: NextRequest) {
  try {
    /* FIX (راند ۱۹-a): سوپرادمین/ادمین داخل «پنل مدرسه» هم می‌توانند اعتبارنامه
       ارسال کنند (me.schoolId ادغام‌شده با bahar_acting_school). ادمین مثل معاون
       به دسترسی صریح send_shad نیاز دارد؛ سوپرادمین بدون محدودیت. */
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (!me.schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");
    if (me.role === "DEPUTY" || me.role === "ADMIN") {
      // معاون/ادمین نیاز به دسترسی send_shad دارد
      if (!me.permissions.includes("send_shad")) {
        return apiErr(403, "دسترسی «ارسال با شاد» ندارید.", "FORBIDDEN");
      }
    }
    const schoolId = me.schoolId;
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) return apiErr(404, "مدرسه یافت نشد.", "NOT_FOUND");
    // راند ۱۸: شاد اختیاری است — مدرسه می‌تواند خاموشش کرده باشد
    if (school.shadEnabled === false) {
      return apiErr(403, "قابلیت شاد در این مدرسه غیرفعال شده است؛ اعتبارنامه‌ها را از صفحه «کاربران» کپی کنید.", "SHAD_DISABLED");
    }
    if (!planHas(school.plan, "shad")) {
      return apiErr(403, "دروازه شاد در اشتراک این مدرسه فعال نیست (پلن طلایی یا الماسی لازم است).", "PLAN");
    }

    const status = await shadStatus(schoolId);
    /* FIX (راند ۱۹-a): حساب دمو فقط در حالت شبیه‌سازی داخلی (INTERNAL) مجاز است —
       نشست واقعی (EXTERNAL با توکن web.shad.ir) پیام‌های واقعی به شماره‌های واقعی
       می‌فرستد و نباید از حساب دموی عمومی قابل اجرا باشد. */
    if (await isDemoUser(me) && status.mode !== "INTERNAL") {
      return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    }
    if (!status.connected) {
      return apiErr(400, "حساب شاد مدرسه متصل نیست؛ ابتدا مدیر از صفحهٔ «شاد» حسابش را متصل کند.", "NO_SESSION");
    }

    const body = await readJson<{ userIds?: string[]; allPending?: boolean }>(req);
    let userIds: string[] = Array.isArray(body.userIds) ? body.userIds.map(String) : [];

    if (body.allPending) {
      // همه کاربرانی که هنوز رمز موقت دارند و شاد ثبت‌شده
      const pending = await db.user.findMany({
        where: { schoolId, isActive: true, mustChangePassword: true, shadNumber: { not: null }, tempPassword: { not: null } },
        select: { id: true },
      });
      userIds = pending.map((p) => p.id);
    }

    const results: Array<{ userId: string; name: string; ok: boolean; error?: string }> = [];
    let consecutiveFail = 0;
    for (const uid of userIds) {
      const user = await db.user.findUnique({ where: { id: uid } });
      if (!user || user.schoolId !== schoolId) {
        results.push({ userId: uid, name: "—", ok: false, error: "NOT_FOUND" });
        continue;
      }
      if (!user.shadNumber || !user.tempPassword) {
        results.push({
          userId: uid, name: `${user.firstName} ${user.lastName}`,
          ok: false, error: user.shadNumber ? "NO_TEMP_PASSWORD" : "NO_SHAD_NUMBER",
        });
        continue;
      }
      const res = await deliverCredentials(user, school.name, ROLE_LABELS[user.role] ?? user.role);
      results.push({ userId: uid, name: `${user.firstName} ${user.lastName}`, ok: res.ok, error: res.error });
      if (res.ok) {
        consecutiveFail = 0;
      } else {
        consecutiveFail++;
        // اگر چند ارسال پشت‌سرهم شکست خورد (توکن نامعتبر/محدودیت شبکه)، ادامه نده
        if (consecutiveFail >= 3) {
          results.push({ userId: "—", name: "—", ok: false, error: `STOPPED_AFTER_${consecutiveFail}_FAILS` });
          break;
        }
      }
      // مکث کوتاه برای احترام به محدودیت نرخ شاد — فقط در حالت واقعی (شبیه‌سازی داخلی شبکه‌ای ندارد)
      if (status.mode === "EXTERNAL") {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    /* FIX (راند ۱۹-a): دکمهٔ «ارسال اعتبارنامه‌های در انتظار» قبلاً فقط کاربرانِ هنوز-
       رمز-موقت را می‌فرستاد و پیام‌های قدیمی QUEUED (کاربرانی که رمزشان عوض شده)
       را جارو نمی‌کرد → شمارندهٔ دکمه سر جایش می‌ماند و کاربر فکر می‌کرد کار نمی‌کند.
       حالا همان دکمه صف را هم جارو می‌کند (معادل «ارسال گروهی» در تعریف دروازه). */
    let sweep: { sent: number; failed: number; skipped: number; remaining: number } | null = null;
    if (body.allPending) {
      sweep = await retryQueuedOutboxForSchool(schoolId, 200);
    }

    await audit({
      user: me, action: "SHAD_DELIVER_CREDENTIALS", entityType: "SHAD",
      meta: {
        count: results.length,
        ok: results.filter((r) => r.ok).length,
        swept: sweep?.sent ?? 0,
      },
      schoolId,
    });
    return apiOk({ results, sweep });
  } catch (e) {
    return handleApiError(e);
  }
}
