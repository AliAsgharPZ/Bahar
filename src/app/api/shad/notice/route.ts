import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser } from "@/lib/api";
import { shadSendMessage, shadStatus } from "@/lib/shad";

/** POST /api/shad/notice — ارسال اطلاع کوتاه به یک شماره شاد */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "send_shad");
    const schoolId = me.schoolId;
    if (!schoolId) return apiErr(400, "به مدرسه‌ای متصل نیستید.", "NO_SCHOOL");
    const status = await shadStatus(schoolId);
    /* FIX (راند ۱۹-a): حساب دمو فقط در حالت شبیه‌سازی داخلی مجاز است —
       نشست واقعی (EXTERNAL) پیام واقعی می‌فرستد. */
    if (await isDemoUser(me) && status.mode !== "INTERNAL") {
      return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    }
    if (!status.connected) {
      return apiErr(400, "حساب شاد مدرسه متصل نیست.", "NO_SESSION");
    }

    const body = await readJson<{ to?: string; text?: string; recipientUserId?: string }>(req);
    const to = String(body.to ?? "").trim();
    const text = String(body.text ?? "").trim();
    if (!to || !text) return apiErr(400, "شماره و متن الزامی است.", "BAD_INPUT");
    if (text.length > 400) {
      return apiErr(400, "متن بیش از حد بلند است.", "TOO_LONG");
    }
    // گیرنده باید کاربر فعال همین مدرسه باشد (جلوگیری از ارسال به شماره‌های خارج از مدرسه)
    const recipient = await db.user.findFirst({
      where: { shadNumber: to, schoolId, isActive: true },
      select: { id: true },
    });
    if (!recipient) {
      return apiErr(400, "این شماره شاد به کاربر فعالی از مدرسه شما تعلق ندارد.", "BAD_RECIPIENT");
    }

    const res = await shadSendMessage({
      schoolId, toShadNumber: to, body: text, purpose: "NOTICE",
      recipientUserId: body.recipientUserId ? String(body.recipientUserId) : null,
    });
    await audit({
      user: me, action: "SHAD_SEND_NOTICE", entityType: "SHAD",
      meta: { to, ok: res.ok }, schoolId,
    });
    if (!res.ok) return apiErr(502, "ارسال به شاد ناموفق بود.", "SEND_FAILED");
    return apiOk({ ok: true, id: res.id });
  } catch (e) {
    return handleApiError(e);
  }
}
