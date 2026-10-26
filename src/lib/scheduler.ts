import { db } from "@/lib/db";
import { notifyMany } from "@/lib/notify";
import { faDigits, calendarParts, todayKey, toKey } from "@/lib/persian";
import { getActiveCountry } from "@/lib/country/server";
import { getCountrySync } from "@/lib/country/cache";
import { sweepRiskScores } from "@/lib/risk";
import { runAutomations } from "@/lib/automation";
import { retryQueuedOutboxForSchool } from "@/lib/shad";
import { ensureAutoBackup } from "@/lib/backup";
import { getSettings } from "@/lib/settings";

// ============================================================
// بهار | موتور گزارش‌های زمان‌بندی‌شده
// هر ۱۵ دقیقه گزارش‌های سررسید را تولید و به‌صورت اعلان ارسال می‌کند.
// سبک و بدون وابستگی: همه محاسبات مستقیم از بانک اطلاعاتی.
// ============================================================

const TICK_MS = 15 * 60 * 1000;
let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** زمان فعلی در منطقه زمانی کشور فعال (دیفالت: تهران) */
export function tehranNow(): { hour: number; dow: number; date: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: getCountrySync().timezone, hour12: false,
    hour: "numeric", minute: "numeric", weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const wd = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 }[get("weekday") as "Sat"] ?? 0;
  return { hour, dow: wd, date: now };
}

/** محاسبه اجرای بعدی (روزشمار یا هفتگی بر پایه ساعت تهران) */
export function computeNextRun(report: { schedule: string; dayOfWeek: number | null; hour: number }, now = new Date()): Date {
  const { hour, dow } = tehranNow();
  if (report.schedule === "DAILY") {
    // تا ساعت هدف امروز (تهران)؛ اگر گذشته، فردا
    let deltaHours = report.hour - hour;
    if (deltaHours <= 0) deltaHours += 24;
    return new Date(now.getTime() + deltaHours * 3600e3);
  }
  // WEEKLY
  let daysAhead = ((report.dayOfWeek ?? 0) - dow + 7) % 7;
  if (daysAhead === 0 && hour >= report.hour) daysAhead = 7;
  const deltaHours = daysAhead * 24 + Math.max(1, report.hour - hour);
  return new Date(now.getTime() + deltaHours * 3600e3);
}

/**
 * کلید تاریخ امروز در «تقویم فعال» — همان قالبی که حضور و غیاب ذخیره می‌کند.
 * ⚠️ FIX (راند ۱۶): قبلاً اینجا کلید میلادی en-CA ساخته می‌شد در حالی که
 * Attendance.date کلید شمسی است → خلاصه روزانه/هفتگی همیشه خالی می‌شد.
 * حالا برای ایران کلید شمسی (هم‌قالب داده) و برای کشورهای دیگر تقویم همان کشور.
 */
function todayJalaliKey(): string {
  return todayKey();
}

/** N روز گذشته در تقویم فعال */
function pastJalaliKeys(days: number): string[] {
  const keys: string[] = [];
  const base = Date.now();
  for (let i = 1; i <= days; i++) {
    keys.push(toKey(new Date(base - i * 864e5)));
  }
  return keys;
}

type ReportContent = { title: string; body: string; link: string };

/** تولید محتوای گزارش بر اساس نوع */
async function buildContent(kind: string, schoolId: string): Promise<ReportContent | null> {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  const schoolName = school?.name ?? "مدرسه";

  if (kind === "DAILY_DIGEST") {
    const today = todayJalaliKey();
    const [atts, assignmentsDue] = await Promise.all([
      db.attendance.findMany({
        where: { date: today, period: 0, class: { schoolId } },
        select: { status: true },
      }),
      db.assignment.count({ where: { dueDate: today, class: { schoolId } } }),
    ]);
    const present = atts.filter((a) => a.status === "PRESENT").length;
    const absent = atts.filter((a) => a.status === "ABSENT").length;
    const late = atts.filter((a) => a.status === "LATE").length;
    if (present + absent + late === 0) return null; // امروز ثبت نشده
    return {
      title: `خلاصه روزانه ${schoolName}`,
      body: `حضور ${faDigits(present)} · غیبت ${faDigits(absent)} · تاخیر ${faDigits(late)} — تکالیف سرآمده امروز: ${faDigits(assignmentsDue)}`,
      link: "/app/attendance",
    };
  }

  if (kind === "ATTENDANCE_SUMMARY") {
    const keys = pastJalaliKeys(7);
    const rows = await db.attendance.findMany({
      where: { date: { in: keys }, period: 0, class: { schoolId } },
      select: { status: true, studentId: true },
      take: 20000,
    });
    const present = rows.filter((r) => r.status === "PRESENT").length;
    const absent = rows.filter((r) => r.status === "ABSENT").length;
    const late = rows.filter((r) => r.status === "LATE").length;
    const total = present + absent + late;
    if (total === 0) return null;
    const rate = Math.round((present / total) * 100);
    // بیشترین غیبت‌ها
    const absByStudent = new Map<string, number>();
    for (const r of rows) {
      if (r.status === "ABSENT") absByStudent.set(r.studentId, (absByStudent.get(r.studentId) ?? 0) + 1);
    }
    const top = Array.from(absByStudent.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let topText = "";
    if (top.length > 0) {
      const students = await db.student.findMany({
        where: { id: { in: top.map((t) => t[0]) } },
        select: { id: true, user: { select: { firstName: true, lastName: true } } },
      });
      const names = new Map(students.map((s) => [s.id, `${s.user.firstName} ${s.user.lastName}`]));
      topText = " | بیشترین غیبت: " + top.map(([sid, n]) => `${names.get(sid) ?? "?"} (${faDigits(n)})`).join("، ");
    }
    return {
      title: `خلاصه حضور و غیاب هفتگی ${schoolName}`,
      body: `نرخ حضور ${faDigits(rate)}٪ — غیبت ${faDigits(absent)} · تاخیر ${faDigits(late)} در ۷ روز گذشته${topText}`,
      link: "/app/reports",
    };
  }

  if (kind === "RISK_DIGEST") {
    const keys = pastJalaliKeys(14);
    const rows = await db.attendance.findMany({
      where: { date: { in: keys }, period: 0, status: "ABSENT", class: { schoolId } },
      select: { studentId: true },
      take: 20000,
    });
    const absByStudent = new Map<string, number>();
    for (const r of rows) absByStudent.set(r.studentId, (absByStudent.get(r.studentId) ?? 0) + 1);
    const risky = Array.from(absByStudent.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (risky.length === 0) return null;
    const students = await db.student.findMany({
      where: { id: { in: risky.map((r) => r[0]) }, status: "ACTIVE" },
      select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
    });
    const names = new Map<string, { name: string; cls: string }>(students.map((s) => [s.id, { name: `${s.user.firstName} ${s.user.lastName}`, cls: s.class?.name ?? "بدون کلاس" }]));
    const list = risky
      .map(([sid, n]) => ({ name: names.get(sid)?.name, cls: names.get(sid)?.cls, n }))
      .filter((x) => x.name);
    if (list.length === 0) return null;
    return {
      title: `دانش‌آموزان در معرض خطر — ${schoolName}`,
      body: `${faDigits(list.length)} دانش‌آموز با ۳+ روز غیبت در ۱۴ روز گذشته: ` + list.map((s) => `${s.name} (${s.cls}، ${faDigits(s.n)} غیبت)`).join("، "),
      link: "/app/dashboard",
    };
  }

  return null;
}

/** اجرای همه گزارش‌های سررسید */
export async function runDueReports(): Promise<number> {
  const now = new Date();
  const due = await db.scheduledReport.findMany({
    where: { active: true, OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }] },
    take: 20,
  });
  let ran = 0;
  for (const r of due) {
    try {
      await runScheduledReport(r);
      ran++;
    } catch (e) {
      console.error("[SCHEDULER]", r.id, e);
    }
  }
  return ran;
}

/** اجرای یک گزارش مشخص — بدون توجه به سررسید (دکمه «اجرا فوری») */
export async function runScheduledReport(report: {
  id: string; kind: string; schoolId: string; audience: string;
  schedule: string; dayOfWeek: number | null; hour: number;
}): Promise<{ notified: number }> {
  const now = new Date();
  let notified = 0;
  const content = await buildContent(report.kind, report.schoolId);
  const roles = report.audience === "TEACHERS" ? ["TEACHER"] : ["MANAGER", "DEPUTY", "ADMIN"];
  const recipients = await db.user.findMany({
    where: { schoolId: report.schoolId, role: { in: roles }, isActive: true },
    select: { id: true },
    take: 100,
  });
  if (content && recipients.length > 0) {
    await notifyMany(recipients.map((u) => u.id), "IMPORTANT", content.title, content.body, content.link, "SCHEDULED_REPORT");
    notified = recipients.length;
  }
  await db.scheduledReport.update({
    where: { id: report.id },
    data: { lastRunAt: now, nextRunAt: computeNextRun(report, now) },
  });
  return { notified };
}

/** راه‌انداز تیک دوره‌ای (یک‌بار در هر پروسه) */
/** One scheduler tick — every periodic sweep, each isolated so one
 *  failure cannot block the others. Used by the in-process timer on
 *  Node and by the Cloudflare Cron Trigger (via /api/internal/sweeps). */
export async function runSchedulerTick(): Promise<void> {
  // تازه‌سازی پروفایل کشور فعال (اگر ادمین بسته را عوض کرده باشد)
  try { await getActiveCountry(); } catch { /* خالی */ }
  try { await runDueReports(); } catch { /* خالی */ }
  try { await sweepOverdueFees(); } catch { /* خالی */ }
  try { await sweepShadOutbox(); } catch { /* خالی */ }
  try { await sweepBirthdays(); } catch { /* خالی */ }
  try { await sweepAutoBackup(); } catch { /* خالی */ }
  try { await sweepRiskScores(); } catch { /* خالی */ }
}

export function startScheduler() {
  if (started || typeof setInterval === "undefined") return;
  started = true;
  const tick = runSchedulerTick;
  // اجرای اولیه بعد از ۳۰ ثانیه (بانک آماده باشد)
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, TICK_MS);
  if (timer && typeof timer.unref === "function") timer.unref();
  console.log("[SCHEDULER] گزارش‌های زمان‌بندی‌شده فعال شد (هر ۱۵ دقیقه)");
}

/**
 * جاروی روزانهٔ شهریه‌های معوق — تریگر FEE_OVERDUE اتوماسیون.
 * هر مدرسه حداکثر یک‌بار در روز برای هر دانش‌آموزِ بدهکار fire می‌شود
 * (بر اساس lastOverdueNoticeAt روی رکورد شهریه).
 */
let lastFeeSweepDay = "";
async function sweepOverdueFees(): Promise<void> {
  const today = todayJalaliKey();
  if (lastFeeSweepDay === today) return; // روزانه یک‌بار
  lastFeeSweepDay = today;

  const overdue = await db.studentFee.findMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: new Date() },
      OR: [{ lastOverdueNoticeAt: null }, { lastOverdueNoticeAt: { lt: new Date(Date.now() - 20 * 3600e3) } }],
    },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    take: 200,
  });
  for (const f of overdue) {
    await db.studentFee.update({ where: { id: f.id }, data: { lastOverdueNoticeAt: new Date() } });
    await runAutomations({
      type: "FEE_OVERDUE",
      schoolId: f.schoolId,
      studentId: f.studentId,
      studentName: `${f.student.user.firstName} ${f.student.user.lastName}`,
      amount: f.amount,
    });
  }
}

/**
 * جاروی صف خروجی شاد — ارسال مجدد پیام‌های QUEUED مدارسِ متصل.
 * پیام‌هایی که هنگام قطع بودن شاد صف شده‌اند، اینجا دوباره تلاش می‌شوند.
 */
async function sweepShadOutbox(): Promise<void> {
  const schools = await db.shadOutbox.findMany({
    where: { status: "QUEUED", attempts: { lt: 10 } },
    select: { schoolId: true },
    distinct: ["schoolId"],
    take: 30,
  });
  for (const s of schools) {
    try {
      await retryQueuedOutboxForSchool(s.schoolId, 50);
    } catch (e) {
      console.error("[SCHEDULER] shad-outbox", s.schoolId, e);
    }
  }
}

/**
 * جاروی روزانهٔ تولدها — تریگر BIRTHDAY اتوماسیون.
 * تطبیق ماه/روز شمسی تاریخ تولد دانش‌آموزان فعال با امروز تهران.
 */
let lastBirthdaySweepDay = "";
async function sweepBirthdays(): Promise<void> {
  const today = todayJalaliKey();
  if (lastBirthdaySweepDay === today) return; // روزانه یک‌بار
  lastBirthdaySweepDay = today;

  const nowParts = calendarParts(new Date());
  const students = await db.student.findMany({
    where: {
      status: "ACTIVE",
      user: { isActive: true, birthDate: { not: null }, schoolId: { not: null } },
    },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, birthDate: true, schoolId: true } },
    },
    take: 20000,
  });

  for (const st of students) {
    if (!st.user.birthDate || !st.user.schoolId) continue;
    const b = calendarParts(st.user.birthDate);
    // تطبیق ماه/روز (نه سال) — تولد ۲۹/۳۰ اسفند هم با تقویم کنار گذاشته می‌شود
    if (b.m === nowParts.m && b.d === nowParts.d) {
      await runAutomations({
        type: "BIRTHDAY",
        schoolId: st.user.schoolId,
        studentId: st.id,
        studentName: `${st.user.firstName} ${st.user.lastName}`,
      });
    }
  }
}

/**
 * پشتیبان‌گیری خودکار — در تیک روزانه (به‌جای اتکا به بازدید ادمین از داشبورد).
 * فاصله از تنظیمات مدرسه/سامانه خوانده می‌شود.
 */
let lastBackupSweepDay = "";
async function sweepAutoBackup(): Promise<void> {
  const today = todayJalaliKey();
  if (lastBackupSweepDay === today) return; // روزانه یک‌بار
  lastBackupSweepDay = today;
  try {
    const settings = await getSettings();
    if (settings.autoBackupDays > 0) {
      await ensureAutoBackup(settings.autoBackupDays);
    }
  } catch (e) {
    console.error("[SCHEDULER] auto-backup", e);
  }
}
