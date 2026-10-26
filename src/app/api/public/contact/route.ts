import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, ApiError, rateLimit, ipOf, uniqueTicketCode, audit } from "@/lib/api";
import { enDigits } from "@/lib/persian";
import { getSettings } from "@/lib/settings";

// ============================================================
// فرم عمومی صفحه «معرفی سامانه» — تماس برای خرید / درخواست دمو
// بدون نیاز به ورود؛ به‌صورت تیکت به ادمین‌ها ثبت می‌شود
// ============================================================

const CATEGORIES: Record<string, string> = {
  PURCHASE: "BILLING",
  DEMO: "DEMO",
  QUESTION: "GENERAL",
};

/** POST /api/public/contact — ثبت درخواست تماس/دمو از صفحه معرفی */
export async function POST(req: NextRequest) {
  try {
    // محدودیت نرخ: حداکثر ۵ درخواست در ساعت از هر IP
    if (!rateLimit(`contact:${ipOf(req)}`, 5, 60 * 60_000)) {
      return apiErr(429, "درخواست‌های شما بیش از حد مجاز است؛ کمی بعد تلاش کنید.", "RATE_LIMITED");
    }
    const body = await readJson<{ name?: string; phone?: string; schoolName?: string; city?: string; kind?: string; message?: string }>(req);
    const name = String(body.name ?? "").trim();
    const phone = enDigits(String(body.phone ?? "")).trim();
    const schoolName = String(body.schoolName ?? "").trim();
    const kind = CATEGORIES[String(body.kind ?? "QUESTION")] ? String(body.kind) : "QUESTION";
    const message = String(body.message ?? "").trim();

    if (name.length < 3) throw new ApiError(400, "BAD_NAME", "نام خود را کامل وارد کنید.");
    if (!/^09\d{9}$/.test(phone)) throw new ApiError(400, "BAD_PHONE", "شماره موبایل معتبر (۰۹…) وارد کنید.");
    if (message.length > 1000) throw new ApiError(400, "BAD_MSG", "متن پیام بیش از حد بلند است.");

    // ضد هرزنامه: حداکثر ۲ درخواست با این شماره در ساعت
    const hourAgo = new Date(Date.now() - 3600000);
    const recent = await db.ticket.count({
      where: { user: { phone }, createdAt: { gte: hourAgo } },
    });
    if (recent >= 2) throw new ApiError(429, "TOO_MANY", "درخواست شما ثبت شد؛ برای پیگیری تماس می‌گیریم.");

    // کاربر سیستم برای این شماره هست؟
    let user = await db.user.findFirst({ where: { phone } });
    if (!user) {
      // ساخت کاربر «مهمان» غیرفعال فقط برای ثبت تیکت
      const { generatePassword, hashPassword } = await import("@/lib/auth");
      const pwd = generatePassword();
      const nationalId = `G${Date.now().toString(36)}`;
      user = await db.user.create({
        data: {
          nationalId,
          passwordHash: hashPassword(pwd),
          role: "PARENT",
          firstName: name.split(" ")[0] ?? name,
          lastName: name.split(" ").slice(1).join(" ") || "مهمان",
          phone,
          isActive: false,
          permissions: "[]",
        },
      });
    }

    const category = CATEGORIES[kind];
    const subject =
      kind === "PURCHASE" ? `درخواست خرید — ${schoolName || name}` :
      kind === "DEMO" ? `درخواست دموی رایگان — ${schoolName || name}` :
      `پرسش از صفحه معرفی — ${name}`;

    const bodyText = [
      `نام: ${name}`,
      `موبایل: ${phone}`,
      schoolName ? `مدرسه: ${schoolName}` : null,
      body.city ? `شهر: ${body.city}` : null,
      "",
      message || (kind === "DEMO" ? "درخواست حساب دمو برای تست سامانه." : "درخواست اطلاعات قیمت و راه‌اندازی."),
    ].filter(Boolean).join("\n");

    const ticket = await db.ticket.create({
      data: {
        code: await uniqueTicketCode(),
        userId: user.id,
        subject,
        category,
        priority: kind === "PURCHASE" ? "HIGH" : "NORMAL",
        status: "OPEN",
      },
    });
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, senderId: user.id, body: bodyText, fromAdmin: false },
    });
    // رخداد عمومی بدون نشست — ثبت در گزارش فعالیت برای ردگیری
    await audit({
      action: "PUBLIC_CONTACT",
      entityType: "TICKET",
      entityId: ticket.id,
      meta: { code: ticket.code, kind, phone, schoolName: schoolName || null, guestUser: user.id },
      ip: ipOf(req),
    });

    const settings = await getSettings();
    return apiOk({
      ok: true,
      ticketCode: ticket.code,
      salesPhone: settings.salesPhone,
      telegram: settings.salesTelegram,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
