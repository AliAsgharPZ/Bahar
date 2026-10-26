import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/roles";
import { todayJalali, jalaliDayOfWeek, formatDateFa, currencyLabel } from "@/lib/persian";
import { planStatusOf } from "@/lib/plans";
import { createHmac } from "crypto";

/* ============================================================
   بهار | هستهٔ ربات تلگرام (راند ۱۹)
   منطق مشترک بین دو حالت اجرای ربات:
   ۱) standalone قدیمی: scripts/telegram-bot/bot.js (polling)
      ← POST /api/telegram با هدر x-bot-token
   ۲) وب‌هوک (جدید): POST /api/telegram/webhook — تلگرام مستقیم
      خودِ سایت را صدا می‌زند؛ بدون نیاز به پروسهٔ جدا.
   ============================================================ */

export type BotAction =
  | { action: "link"; chatId: string; username?: string; code?: string }
  | { action: "unlink"; chatId: string }
  | { action: "data"; chatId: string; cmd?: string }
  | { action: "poll"; chatId: string };

export type BotResponse = { status: number; data: Record<string, unknown> };

type LinkedUser = {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  schoolId: string | null;
  schoolName: string | null;
};

async function linkedUser(chatId: string): Promise<LinkedUser | null> {
  const link = await db.telegramLink.findUnique({
    where: { chatId },
    include: { user: { include: { school: { select: { name: true } } } } },
  });
  if (!link || !link.user.isActive) return null;
  return {
    id: link.userId,
    role: link.user.role,
    firstName: link.user.firstName,
    lastName: link.user.lastName,
    schoolId: link.user.schoolId,
    schoolName: link.user.school?.name ?? null,
  };
}

/** پردازش عملیات ربات — مشابه POST /api/telegram (بدون احراز؛ احراز بر عهدهٔ فراخوان) */
export async function handleBotAction(body: BotAction): Promise<BotResponse> {
  if (!body.chatId) return { status: 400, data: { error: { code: "BAD_REQUEST", message: "chatId لازم است." } } };

  /* ── پیوند حساب با کد از پروفایل ── */
  if (body.action === "link") {
    if (!body.code) {
      return {
        status: 200,
        data: {
          ok: false,
          message:
            "کد پیوند را از پروفایل بهار خود بگیرید و بفرستید:\n/profile یا دکمه «پیوند تلگرام» در پروفایل",
        },
      };
    }
    const link = await db.telegramLink.findUnique({ where: { linkCode: body.code } });
    if (!link) return { status: 200, data: { ok: false, message: "کد پیوند نامعتبر یا منقضی است." } };
    const existing = await db.telegramLink.findUnique({ where: { chatId: body.chatId } });
    if (existing && existing.userId !== link.userId) {
      await db.telegramLink.delete({ where: { chatId: body.chatId } });
    }
    await db.telegramLink.update({
      where: { linkCode: body.code },
      data: { chatId: body.chatId, username: body.username ?? null },
    });
    const u = await db.user.findUnique({
      where: { id: link.userId },
      include: { school: { select: { name: true } } },
    });
    return {
      status: 200,
      data: {
        ok: true,
        message: `سلام ${u?.firstName ?? ""} ${u?.lastName ?? ""} عزیز! 👋\nحساب بهار شما با موفقیت به تلگرام پیوند خورد.\nنقش: ${ROLE_LABELS[u?.role ?? ""] ?? u?.role}${u?.school ? `\nمدرسه: ${u.school.name}` : ""}\n\nبرای دیدن امکانات /help را بزنید.`,
      },
    };
  }

  if (body.action === "unlink") {
    await db.telegramLink.deleteMany({ where: { chatId: body.chatId } });
    return { status: 200, data: { ok: true, message: "پیوند حساب حذف شد." } };
  }

  /* ── داده‌های نقش‌محور ── */
  if (body.action === "data") {
    const me = await linkedUser(body.chatId);
    if (!me) {
      return {
        status: 200,
        data: { ok: false, message: "ابتدا حساب خود را پیوند کنید. کد پیوند را از پروفایل بهار بگیرید." },
      };
    }
    const cmd = body.cmd ?? "help";
    const school = me.schoolId ? await db.school.findUnique({ where: { id: me.schoolId } }) : null;

    if (cmd === "me") {
      return {
        status: 200,
        data: {
          ok: true,
          message: `👤 ${me.firstName} ${me.lastName}\nنقش: ${ROLE_LABELS[me.role]}\nمدرسه: ${me.schoolName ?? "—"}\nاشتراک: ${school ? planStatusOf(school.plan, school.planExpiresAt).label : "—"}`,
        },
      };
    }

    if (cmd === "grades") {
      if (me.role !== "STUDENT" && me.role !== "PARENT") {
        return { status: 200, data: { ok: false, message: "این بخش برای دانش‌آموز و والد است." } };
      }
      const studentIds: string[] = [];
      if (me.role === "STUDENT") {
        const s = await db.student.findFirst({ where: { userId: me.id } });
        if (s) studentIds.push(s.id);
      } else {
        const kids = await db.studentParent.findMany({ where: { parentUserId: me.id } });
        studentIds.push(...kids.map((k) => k.studentId));
      }
      const grades = await db.gradeRecord.findMany({
        where: { studentId: { in: studentIds } },
        include: { subject: true, student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      if (!grades.length) return { status: 200, data: { ok: true, message: "هنوز نمره‌ای ثبت نشده است." } };
      const lines = grades.map((g) => `• ${g.subject.name}: ${g.score.toLocaleString("fa-IR")} (${formatDateFa(g.createdAt)})`);
      return { status: 200, data: { ok: true, message: `📚 آخرین نمرات:\n${lines.join("\n")}` } };
    }

    if (cmd === "attendance") {
      if (me.role !== "STUDENT" && me.role !== "PARENT") {
        return { status: 200, data: { ok: false, message: "این بخش برای دانش‌آموز و والد است." } };
      }
      const studentIds: string[] = [];
      if (me.role === "STUDENT") {
        const s = await db.student.findFirst({ where: { userId: me.id } });
        if (s) studentIds.push(s.id);
      } else {
        const kids = await db.studentParent.findMany({ where: { parentUserId: me.id } });
        studentIds.push(...kids.map((k) => k.studentId));
      }
      const att = await db.attendance.findMany({
        where: { studentId: { in: studentIds } },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { date: "desc" },
        take: 30,
      });
      const absents = att.filter((a) => a.status === "ABSENT");
      const lates = att.filter((a) => a.status === "LATE");
      const rate = att.length ? Math.round(((att.length - absents.length) / att.length) * 100) : null;
      return {
        status: 200,
        data: {
          ok: true,
          message: `📋 حضور و غیاب:\n• درصد حضور: ${rate !== null ? rate.toLocaleString("fa-IR") + "٪" : "—"}\n• غیبت: ${absents.length.toLocaleString("fa-IR")}\n• تأخیر: ${lates.length.toLocaleString("fa-IR")}`,
        },
      };
    }

    if (cmd === "schedule") {
      let classIds: string[] = [];
      if (me.role === "STUDENT") {
        const s = await db.student.findFirst({ where: { userId: me.id } });
        if (s?.classId) classIds = [s.classId];
      } else if (me.role === "TEACHER") {
        const slots = await db.scheduleSlot.findMany({
          where: { teacherId: me.id, dayOfWeek: jalaliDayOfWeek() },
          select: { classId: true },
        });
        classIds = slots.map((s) => s.classId);
      } else if (me.schoolId) {
        const cls = await db.class.findMany({ where: { schoolId: me.schoolId }, select: { id: true } });
        classIds = cls.map((c) => c.id);
      }
      const today = await db.scheduleSlot.findMany({
        where: classIds.length ? { classId: { in: classIds }, dayOfWeek: jalaliDayOfWeek() } : { dayOfWeek: -1 },
        include: { subject: true, class: true, teacher: { select: { firstName: true, lastName: true } } },
        orderBy: { period: "asc" },
        take: 10,
      });
      if (!today.length) return { status: 200, data: { ok: true, message: "امروز برنامه‌ای ثبت نشده است. 🌴" } };
      const lines = today.map(
        (s) => `• زنگ ${s.period.toLocaleString("fa-IR")}: ${s.subject?.name ?? "—"}${s.class ? ` (${s.class.name})` : ""}`
      );
      return { status: 200, data: { ok: true, message: `📅 برنامه امروز:\n${lines.join("\n")}` } };
    }

    if (cmd === "assignments") {
      let classId: string | null = null;
      if (me.role === "STUDENT") {
        const s = await db.student.findFirst({ where: { userId: me.id } });
        classId = s?.classId ?? null;
      }
      const assignments = await db.assignment.findMany({
        where: classId ? { classId } : { teacherId: me.id },
        include: { subject: true, class: true },
        orderBy: { dueDate: "asc" },
        take: 8,
      });
      if (!assignments.length) return { status: 200, data: { ok: true, message: "تکلیفی ثبت نشده است. ✨" } };
      const lines = assignments.map(
        (a) => `• ${a.title}${a.subject ? ` (${a.subject.name})` : ""} — تا ${formatDateFa(a.dueDate)}`
      );
      return { status: 200, data: { ok: true, message: `📝 تکالیف:\n${lines.join("\n")}` } };
    }

    if (cmd === "fees") {
      if (me.role !== "STUDENT" && me.role !== "PARENT") {
        return { status: 200, data: { ok: false, message: "این بخش برای دانش‌آموز و والد است." } };
      }
      const studentIds: string[] = [];
      if (me.role === "STUDENT") {
        const s = await db.student.findFirst({ where: { userId: me.id } });
        if (s) studentIds.push(s.id);
      } else {
        const kids = await db.studentParent.findMany({ where: { parentUserId: me.id } });
        studentIds.push(...kids.map((k) => k.studentId));
      }
      const fees = await db.studentFee.findMany({ where: { studentId: { in: studentIds }, status: "UNPAID" } });
      const total = fees.reduce((s, f) => s + f.amount, 0);
      return {
        status: 200,
        data: {
          ok: true,
          message: fees.length
            ? `💳 شهریه:\n• اقساط پرداخت‌نشده: ${fees.length.toLocaleString("fa-IR")}\n• مجموع بدهی: ${total.toLocaleString("fa-IR")} ${currencyLabel()}`
            : "💳 شهریه: بدهی ثبت‌شده‌ای ندارید. ✅",
        },
      };
    }

    if (cmd === "notifications") {
      const notifs = await db.notification.findMany({
        where: { userId: me.id, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      if (!notifs.length) return { status: 200, data: { ok: true, message: "اعلان خوانده‌نشده ندارید. ✅" } };
      const icons: Record<string, string> = { URGENT: "🔴", IMPORTANT: "🟡", INFO: "🔵", SUCCESS: "🟢" };
      const lines = notifs.map((n) => `${icons[n.category] ?? "🔵"} ${n.title}`);
      await db.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
      return { status: 200, data: { ok: true, message: `🔔 اعلان‌های خوانده‌نشده:\n${lines.join("\n")}` } };
    }

    if (cmd === "children") {
      if (me.role !== "PARENT") return { status: 200, data: { ok: false, message: "این بخش برای والدین است." } };
      const kids = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: true } } },
      });
      const lines: string[] = [];
      for (const k of kids) {
        const [grades, att] = await Promise.all([
          db.gradeRecord.findMany({ where: { studentId: k.studentId } }),
          db.attendance.findMany({ where: { studentId: k.studentId } }),
        ]);
        let w = 0;
        let ws = 0;
        for (const g of grades) {
          w += g.score * g.weight;
          ws += g.weight;
        }
        const abs = att.filter((a) => a.status === "ABSENT").length;
        lines.push(
          `• ${k.student.user.firstName} ${k.student.user.lastName} — ${k.student.class?.name ?? "بدون کلاس"} | معدل: ${ws ? (w / ws).toFixed(2) : "—"} | غیبت: ${abs.toLocaleString("fa-IR")}`
        );
      }
      return { status: 200, data: { ok: true, message: `👨‍👩‍👧‍👦 فرزندان شما:\n${lines.join("\n")}` } };
    }

    if (cmd === "digest") {
      const notifs = await db.notification.count({ where: { userId: me.id, readAt: null } });
      const msgs = await db.message.count({ where: { recipientId: me.id, readAt: null } });
      return {
        status: 200,
        data: {
          ok: true,
          message: `🌅 خلاصه امروز (${todayJalali()}):\n• اعلان خوانده‌نشده: ${notifs.toLocaleString("fa-IR")}\n• پیام جدید: ${msgs.toLocaleString("fa-IR")}\n\n/help برای همه دستورات`,
        },
      };
    }

    // help
    return {
      status: 200,
      data: {
        ok: true,
        message:
          "🌸 ربات بهار — دستورات:\n/me — پروفایل من\n/grades — نمرات\n/attendance — حضور و غیاب\n/schedule — برنامه امروز\n/assignments — تکالیف\n/fees — شهریه\n/notifications — اعلان‌ها\n/children — فرزندان (والد)\n/digest — خلاصه روز\n/unlink — قطع پیوند حساب",
      },
    };
  }

  /* ── poll: اعلان‌های جدید برای push ── */
  if (body.action === "poll") {
    const me = await linkedUser(body.chatId);
    if (!me) return { status: 200, data: { messages: [] } };
    const notifs = await db.notification.findMany({
      where: { userId: me.id, readAt: null, createdAt: { gte: new Date(Date.now() - 10 * 60000) } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const icons: Record<string, string> = { URGENT: "🔴", IMPORTANT: "🟡", INFO: "🔵", SUCCESS: "🟢" };
    return {
      status: 200,
      data: {
        messages: notifs.map((n) => ({
          text: `${icons[n.category] ?? "🔵"} <b>${n.title}</b>\n${n.body}`,
          markRead: n.id,
        })),
      },
    };
  }

  return { status: 400, data: { error: { code: "BAD_ACTION", message: "عملیات نامعتبر." } } };
}

/* ────────────────────────────────────────────────
   بخش وب‌هوک (راند ۱۹) — اتصال مستقیم تلگرام به سایت
   ──────────────────────────────────────────────── */

/** راز وب‌هوک — از خودِ توکن ربات مشتق می‌شود (پایدار، بدون فیلد تنظیمات اضافه) */
export function telegramWebhookSecret(botToken: string): string {
  return createHmac("sha256", "bahar-telegram-webhook-v1").update(botToken).digest("hex");
}

/** فراخوانی مستقیم Bot API تلگرام از سرور (fetch داخلی، بدون وابستگی) */
export async function telegramApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "network error" };
  }
}

/** نگاشت متن پیام تلگرام به عملیات ربات — همان جدول scripts/telegram-bot/bot.js */
export function mapTelegramText(text: string): { action: "link"; code: string } | { action: "data"; cmd: string } | { action: "unlink" } | { action: "data"; cmd: "help" } | null {
  const t = text.trim();
  const startMatch = t.match(/^\/start\s+([A-Za-z0-9]{6,10})$/);
  if (startMatch) return { action: "link", code: startMatch[1].toUpperCase() };
  if (t === "/start") return { action: "data", cmd: "help" };
  if (t === "/unlink") return { action: "unlink" };
  const COMMAND_MAP: Record<string, string> = {
    "/help": "help",
    "/me": "me",
    "/profile": "me",
    "/grades": "grades",
    "/attendance": "attendance",
    "/schedule": "schedule",
    "/assignments": "assignments",
    "/fees": "fees",
    "/notifications": "notifications",
    "/children": "children",
    "/digest": "digest",
    "راهنما": "help",
    "❓ راهنما": "help",
    "پروفایل من": "me",
    "👤 پروفایل من": "me",
    "نمرات": "grades",
    "📚 نمرات": "grades",
    "حضور و غیاب": "attendance",
    "📋 حضور و غیاب": "attendance",
    "برنامه امروز": "schedule",
    "📅 برنامه امروز": "schedule",
    "تکالیف": "assignments",
    "📝 تکالیف": "assignments",
    "شهریه": "fees",
    "💳 شهریه": "fees",
    "اعلان‌ها": "notifications",
    "🔔 اعلان‌ها": "notifications",
    "فرزندانم": "children",
    "👨‍👩‍👧‍👦 فرزندانم": "children",
    "خلاصه امروز": "digest",
    "🌅 خلاصه امروز": "digest",
  };
  const cmd = COMMAND_MAP[t];
  if (cmd) return { action: "data", cmd };
  return null;
}

/** کیبورد ثابت دستورات — همان ربات standalone */
export const MAIN_KEYBOARD = {
  keyboard: [
    [{ text: "🌅 خلاصه امروز" }, { text: "👤 پروفایل من" }],
    [{ text: "📚 نمرات" }, { text: "📋 حضور و غیاب" }],
    [{ text: "📅 برنامه امروز" }, { text: "📝 تکالیف" }],
    [{ text: "💳 شهریه" }, { text: "🔔 اعلان‌ها" }],
    [{ text: "👨‍👩‍👧‍👦 فرزندانم" }, { text: "❓ راهنما" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};
