import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, rateLimit, demoWriteBlock} from "@/lib/api";
import { avatarApiFields } from "@/lib/avatar";

export const MAX_MESSAGE_LEN = 400;

/** GET /api/messages?withUserId= — گفتگو با یک کاربر + علامت‌گذاری خوانده‌شده */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!rateLimit(`msg:${me.id}`, 30, 60000)) {
      return apiErr(429, "ارسال پیام‌های بیش از حد؛ کمی صبر کنید.", "RATE_LIMITED");
    }
    const withUserId = new URL(req.url).searchParams.get("withUserId");
    if (!withUserId) return apiErr(400, "کاربر مقصد را مشخص کنید.", "BAD_INPUT");

    const other = await db.user.findUnique({ where: { id: withUserId } });
    if (!other || !other.isActive) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
    // FIX (راند ۱۶): افشای پروفایل بین‌مدرسه‌ای — همان قواعد دامنه POST
    // مجاز: خودش / هم‌مدرسه / رابطه والد-فرزند / نقش‌های خدماتی
    if (other.id !== me.id) {
      const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
      const sameSchool = Boolean(me.schoolId) && other.schoolId === me.schoolId;
      let parentLink = false;
      if (me.role === "STUDENT" || other.role === "STUDENT") {
        // آیا من والد/فرزند او هستم؟
        const studentUserId = me.role === "STUDENT" ? me.id : other.id;
        const parentUserId = me.role === "STUDENT" ? other.id : me.id;
        const st = await db.student.findFirst({ where: { userId: studentUserId }, select: { id: true } });
        if (st) {
          const link = await db.studentParent.findFirst({ where: { studentId: st.id, parentUserId }, select: { id: true } });
          parentLink = Boolean(link);
        }
      }
      if (!isService && !sameSchool && !parentLink) {
        return apiErr(403, "این کاربر در دسترس پیام‌رسانی شما نیست.", "FORBIDDEN");
      }
    }

    const messages = await db.message.findMany({
      where: {
        OR: [
          { senderId: me.id, recipientId: withUserId },
          { senderId: withUserId, recipientId: me.id },
        ],
      },
      orderBy: { sentAt: "asc" },
      take: 200,
    });

    // خواندن پیام‌های دریافتی
    await db.message.updateMany({
      where: { senderId: withUserId, recipientId: me.id, readAt: null },
      data: { readAt: new Date() },
    });

    return apiOk({
      messages,
      other: {
        id: other.id, firstName: other.firstName, lastName: other.lastName,
        role: other.role, shadNumber: other.shadNumber,
        ...avatarApiFields(other),
      },
      maxLen: MAX_MESSAGE_LEN,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/messages — ارسال پیام متنی کوتاه */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<{ recipientId?: string; body?: string }>(req);
    const recipientId = String(body.recipientId ?? "");
    const text = String(body.body ?? "").trim();

    if (!recipientId) return apiErr(400, "گیرنده را انتخاب کنید.", "BAD_INPUT");
    if (!text) return apiErr(400, "متن پیام خالی است.", "EMPTY");
    if (text.length > MAX_MESSAGE_LEN) {
      return apiErr(
        413,
        `پیام بیش از ${MAX_MESSAGE_LEN} نویسه است. پیام‌رسان بهار فقط برای پیام‌های کوتاه است؛ برای محتوای بلند و فایل از «شاد» استفاده کنید.`,
        "TOO_LONG_SHAD"
      );
    }

    const recipient = await db.user.findUnique({ where: { id: recipientId } });
    if (!recipient || !recipient.isActive) return apiErr(404, "گیرنده یافت نشد.", "NOT_FOUND");
    if (recipient.id === me.id) return apiErr(400, "نمی‌توانید به خودتان پیام بدهید.", "SELF");

    // ── دامنه مجاز تماس ──
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const sameSchool = me.schoolId && recipient.schoolId === me.schoolId;
    if (!isService && !sameSchool) {
      return apiErr(403, "پیام‌رسان بهار فقط داخل مدرسه فعال است.", "FORBIDDEN");
    }

    if (me.role === "STUDENT" && recipient.role === "STUDENT") {
      return apiErr(403, "دانش‌آموزان فقط با معلمان و مدیر مدرسه می‌توانند پیام بدهند.", "FORBIDDEN");
    }
    if (me.role === "PARENT" && recipient.role === "STUDENT") {
      // ولی فقط فرزند خودش را می‌بیند؛ پیام به دانش‌آموزان دیگر ممنوع
      const link = await db.studentParent.findFirst({
        where: { parentUserId: me.id, student: { userId: recipient.id } },
      });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    if (me.role === "STUDENT" && recipient.role === "PARENT") {
      // دانش‌آموز فقط به ولی خودش پیام می‌دهد
      const link = await db.studentParent.findFirst({
        where: { parentUserId: recipient.id, student: { userId: me.id } },
      });
      if (!link) return apiErr(403, "پیام به ولیِ دانش‌آموزان دیگر مجاز نیست.", "FORBIDDEN");
    }

    const message = await db.message.create({
      data: { senderId: me.id, recipientId, body: text },
    });
    await audit({ user: me, action: "ارسال پیام", entityType: "Message", entityId: message.id, schoolId: me.schoolId, meta: { to: message.recipientId } });
    return apiOk({ message });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    await db.message.deleteMany({ where: { id, senderId: me.id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
