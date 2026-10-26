import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, rateLimit } from "@/lib/api";
import { todayKey, toKey } from "@/lib/persian";

// ============================================================
// بهار | API چک‌این سلامت روان — GET/POST /api/wellbeing
// دانش‌آموز: ثبت حال روزانه (۱-۵) + یادداشت اختیاری — روزی یک‌بار
// مشاور/مدیر: نمای مدرسه (آمار + موارد پرچم‌شده + روند)
// پرچم خودکار: mood <= 2 یا یادداشت شامل واژه‌های نگران‌کننده
// ============================================================

const WORRY_WORDS = ["خودکشی", "خودآزاری", "کشتن خودم", "نمی‌خوام زنده", "نمی‌خواهم زنده", "افسرده", "بی‌ارزش", "تنهایی شدید", "کمرنجی"];

function flagCheck(mood: number, note: string | null): boolean {
  if (mood <= 2) return true;
  if (!note) return false;
  return WORRY_WORDS.some((w) => note.includes(w));
}

/** GET → دانش‌آموز: چک‌این امروز + تاریخچه؛ مشاور/مدیر: نمای مدرسه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const today = todayKey();

    if (me.role === "STUDENT") {
      const student = await db.student.findFirst({
        where: { userId: me.id },
        select: { id: true },
      });
      if (!student) return apiErr(404, "پرونده دانش‌آموزی یافت نشد.", "NO_STUDENT");

      const [todayCheckin, history] = await Promise.all([
        db.wellbeingCheckin.findUnique({
          where: { studentId_date: { studentId: student.id, date: today } },
          select: { mood: true, note: true, createdAt: true },
        }),
        db.wellbeingCheckin.findMany({
          where: { studentId: student.id },
          orderBy: { date: "desc" },
          take: 30,
          select: { date: true, mood: true, flagged: true },
        }),
      ]);
      return apiOk({ today, todayCheckin, history });
    }

    // مشاور/مدیر/خدماتی — نمای مدرسه
    if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER"].includes(me.role)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 14));
    const keys: string[] = [];
    for (let i = 0; i < days; i += 1) keys.push(toKey(new Date(Date.now() - i * 864e5)));

    // مدرسه فعال
    let schoolId = me.schoolId;
    if (!schoolId && (me.role === "SUPER_ADMIN" || me.role === "ADMIN")) {
      const cookie = req.cookies.get("bahar_acting_school")?.value ?? null;
      if (cookie) schoolId = cookie;
    }
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const [rows, flagged] = await Promise.all([
      db.wellbeingCheckin.findMany({
        where: { date: { in: keys }, student: { schoolId, status: "ACTIVE" } },
        orderBy: { date: "desc" },
        take: 5000,
        select: {
          date: true, mood: true, flagged: true,
          student: { select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
        },
      }),
      db.wellbeingCheckin.findMany({
        where: { flagged: true, date: { in: keys }, student: { schoolId, status: "ACTIVE" } },
        orderBy: { date: "desc" },
        take: 100,
        select: {
          date: true, mood: true, note: true,
          student: { select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
        },
      }),
    ]);

    const avgMood = rows.length ? rows.reduce((s, r) => s + r.mood, 0) / rows.length : null;
    // توزیع روزانه میانگین (برای نمودار روند)
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const cur = byDay.get(r.date) ?? { sum: 0, n: 0 };
      cur.sum += r.mood;
      cur.n += 1;
      byDay.set(r.date, cur);
    }
    const trend = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }));

    // جزئیات چک‌این‌های پرچم‌دار (شامل یادداشت آزاد دانش‌آموز) فقط برای
    // مدیریت مدرسه است؛ معلم و ادمین فقط شمارش تجمیعی را می‌بینند.
    const canSeeFlaggedDetails = me.role === "MANAGER" || me.role === "DEPUTY" || me.role === "SUPER_ADMIN";

    return apiOk({
      days,
      totalCheckins: rows.length,
      avgMood: avgMood != null ? Math.round(avgMood * 10) / 10 : null,
      flaggedCount: flagged.length,
      trend,
      flagged: canSeeFlaggedDetails ? flagged.map((f) => ({
        studentId: f.student.id,
        name: `${f.student.user.firstName} ${f.student.user.lastName}`,
        className: f.student.class?.name ?? "—",
        date: f.date,
        mood: f.mood,
        note: f.note,
      })) : [],
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST → دانش‌آموز: ثبت چک‌این امروز (روزی یک‌بار) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["STUDENT"]);
    if (!rateLimit(`wellbeing:${me.id}`, 6, 60_000)) {
      return apiErr(429, "درخواست‌های پی‌درپی؛ کمی صبر کنید.", "RATE_LIMITED");
    }
    const body = await readJson<{ mood?: number; note?: string }>(req);
    const mood = Number(body.mood);
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      return apiErr(400, "حال باید عددی بین ۱ تا ۵ باشد.", "BAD_MOOD");
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : null;

    const student = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    if (!student) return apiErr(404, "پرونده دانش‌آموزی یافت نشد.", "NO_STUDENT");

    const today = todayKey();
    const existing = await db.wellbeingCheckin.findUnique({
      where: { studentId_date: { studentId: student.id, date: today } },
      select: { id: true },
    });
    if (existing) {
      return apiErr(409, "چک‌این امروز ثبت شده است — فردا دوباره سر می‌زنیم.", "ALREADY_DONE");
    }

    await db.wellbeingCheckin.create({
      data: {
        studentId: student.id,
        authorizedBy: me.id, // خود دانش‌آموز (خوداظهاری)
        date: today,
        mood,
        note,
        flagged: flagCheck(mood, note),
      },
    });
    return apiOk({ ok: true, flagged: flagCheck(mood, note) });
  } catch (e) {
    return handleApiError(e);
  }
}
