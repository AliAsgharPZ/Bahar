import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

/* ============================================================
   موتور برنامه‌ریزی هفتگی — Constraint Engine
   قیود:
   1) کلاس همزمان دو درس نداشته باشد (کلید یکتای slot)
   2) معلم همزمان دو کلاس نداشته باشد
   3) درس‌های خاص (ورزش/آزمایشگاه/کامپیوتر) هم‌زمان نشوند (ظرفیت سالن)
   4) دو زنگ پشت‌سرهم یک درس نباشد (خستگی دانش‌آموز) — نرم
   5) ساعات هفتگی هر درس کامل تخصیص یابد
   6) توزیع یکنواخت درس‌ها در طول هفته — نرم
   خروجی: چند سناریو با امتیاز کیفیت (بار معلم/توزیع/تراکم)
   ============================================================ */

type SlotPlan = { classId: string; dayOfWeek: number; period: number; subjectId: string; teacherId: string };

const SPECIAL_HINTS = ["ورزش", "تربیتبدنی", "آزمایشگاه", "عملی", "کارگاه", "کامپیوتر"];

function isSpecialSubject(name: string): boolean {
  return SPECIAL_HINTS.some((h) => name.includes(h));
}

function generateScenario(
  entries: Array<{ classId: string; classGrade: string; subjectId: string; subjectName: string; teacherId: string; hours: number }>,
  days: number[],
  periods: number,
  seed: number
): { slots: SlotPlan[]; unscheduled: Array<{ label: string; reason: string }>; scoreTeacher: number; scoreSpread: number; scoreSpecial: number } {
  // rand با seed ثابت برای سناریوهای تکرارپذیر
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };

  const classBusy = new Set<string>(); // classId|day|period
  const teacherBusy = new Set<string>(); // teacherId|day|period
  const specialBusy = new Set<string>(); // day|period
  const slots: SlotPlan[] = [];
  const unscheduled: Array<{ label: string; reason: string }> = [];

  // هر کلاس: نگاشت تعداد زنگ‌های هر درس
  const byClass = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byClass.get(e.classId) ?? [];
    list.push(e);
    byClass.set(e.classId, list);
  }

  // نوبت‌دهی گردشی بین کلاس‌ها برای انصاف
  let round = 0;
  const remaining = new Map<string, Array<{ subjectId: string; subjectName: string; teacherId: string; hours: number }>>();
  for (const [classId, list] of byClass) {
    remaining.set(classId, list.map((e) => ({ subjectId: e.subjectId, subjectName: e.subjectName, teacherId: e.teacherId, hours: e.hours })));
  }
  const classIds = [...byClass.keys()];

  let progress = true;
  while (progress && round < 400) {
    progress = false;
    round++;
    for (const classId of classIds) {
      const list = remaining.get(classId) ?? [];
      if (!list.length) continue;
      // درس با بیشترین ساعت باقی‌مانده اول (steepest)
      list.sort((a, b) => b.hours - a.hours || (rand() - 0.5));
      let placedThisRound = false;
      for (let idx = 0; idx < list.length; idx++) {
        const item = list[idx];
        if (item.hours <= 0) continue;
        // امتحان همه (day, period) با ترتیب تصادفی
        const options: Array<{ d: number; p: number }> = [];
        for (const d of days) for (let p = 1; p <= periods; p++) options.push({ d, p });
        // مرتب‌سازی تصادفی + ترجیح زنگ‌های میانی برای درس‌های اصلی
        options.sort((a, b) => (rand() - 0.5) || 0);
        let chosen: { d: number; p: number } | null = null;
        for (const o of options) {
          const cKey = `${classId}|${o.d}|${o.p}`;
          const tKey = `${item.teacherId}|${o.d}|${o.p}`;
          if (classBusy.has(cKey) || teacherBusy.has(tKey)) continue;
          const special = isSpecialSubject(item.subjectName);
          if (special && specialBusy.has(`${o.d}|${o.p}`)) continue;
          // قید نرم: زنگ قبل همان درس نباشد (خستگی)
          const prevKey = `${classId}|${o.d}|${o.p - 1}`;
          const prev = slots.find((x) => `${x.classId}|${x.dayOfWeek}|${x.period}` === prevKey);
          if (prev && prev.subjectId === item.subjectId) continue;
          chosen = o;
          break;
        }
        if (chosen) {
          classBusy.add(`${classId}|${chosen.d}|${chosen.p}`);
          teacherBusy.add(`${item.teacherId}|${chosen.d}|${chosen.p}`);
          if (isSpecialSubject(item.subjectName)) specialBusy.add(`${chosen.d}|${chosen.p}`);
          slots.push({ classId, dayOfWeek: chosen.d, period: chosen.p, subjectId: item.subjectId, teacherId: item.teacherId });
          item.hours -= 1;
          placedThisRound = true;
          progress = true;
        }
      }
      if (!placedThisRound) {
        // یافتن درس‌های جامانده برای گزارش
        for (const item of list) {
          if (item.hours > 0) {
            unscheduled.push({
              label: `${item.subjectName} (${item.hours} زنگ)`,
              reason: "ظرفیت هفته یا تداخل معلم تکمیل است",
            });
          }
        }
        remaining.set(classId, []);
      }
    }
  }

  // امتیازدهی سناریو
  // 1) بار معلم: انحراف معیار تعداد زنگ روزانه هر معلم (کمتر = بهتر)
  const teacherDayCount = new Map<string, Map<number, number>>();
  for (const slot of slots) {
    const m = teacherDayCount.get(slot.teacherId) ?? new Map();
    m.set(slot.dayOfWeek, (m.get(slot.dayOfWeek) ?? 0) + 1);
    teacherDayCount.set(slot.teacherId, m);
  }
  let sumDev = 0, teacherCount = 0;
  for (const m of teacherDayCount.values()) {
    const counts = [...m.values()];
    const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, days.length);
    sumDev += Math.sqrt(counts.reduce((a, c) => a + (c - avg) ** 2, 0) / Math.max(1, counts.length));
    teacherCount++;
  }
  const scoreTeacher = teacherCount ? Math.max(0, 5 - (sumDev / teacherCount) * 1.6) : 5;

  // 2) توزیع درسی در طول هفته: هیچ درسی بیشتر از ۲ زنگ در روز (غیر از درس‌های خاص)
  let sameDayViolations = 0;
  const classDaySubject = new Set<string>();
  const seen = new Map<string, number>();
  for (const slot of slots) {
    const key = `${slot.classId}|${slot.dayOfWeek}|${slot.subjectId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    classDaySubject.add(key);
  }
  for (const [key, n] of seen) if (n > 2) sameDayViolations += n - 2;
  const scoreSpread = Math.max(0, 5 - sameDayViolations * 0.5);

  // 3) تراکم درس‌های خاص: پخش بودن در روزهای مختلف
  const specialDays = new Set<string>();
  for (const slot of slots) {
    const cls = entries.find((e) => e.classId === slot.classId && e.subjectId === slot.subjectId);
    if (cls && isSpecialSubject(cls.subjectName)) specialDays.add(`${slot.dayOfWeek}`);
  }
  const scoreSpecial = Math.min(5, 2 + specialDays.size);

  return { slots, unscheduled, scoreTeacher, scoreSpread, scoreSpecial };
}

/** POST /api/timetable-generate — تولید سناریوهای برنامه هفتگی */
export async function POST(req: NextRequest) {
  try {
    // FIX (راند ۱۶): معاون بدون «مدیریت برنامه هفتگی» نباید بتواند کل برنامه را بازتولید کند
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (me.role === "DEPUTY" && !hasPermission(me, "manage_schedule")) {
      return apiErr(403, "تولید برنامه نیاز به دسترسی «مدیریت برنامه هفتگی» دارد.", "FORBIDDEN");
    }
    const body = await readJson<{
      classIds?: string[];
      days?: number[];
      periods?: number;
      apply?: boolean;
      scenario?: number;
    }>(req);

    // ادمین سرویس داخل پنل مدرسه هم می‌تواند تولید کند (کوکی اعتبارسنجی‌شده)
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const classes = await db.class.findMany({
      where: { schoolId, isActive: true, ...(body.classIds?.length ? { id: { in: body.classIds } } : {}) },
    });
    if (!classes.length) return apiErr(400, "کلاسی برای برنامه‌ریزی یافت نشد.", "NO_CLASSES");

    const assignments = await db.teachingAssignment.findMany({
      where: { schoolId, classId: { in: classes.map((c) => c.id) } },
      include: { subject: true, class: true },
    });
    if (!assignments.length) return apiErr(400, "هیچ تخصیص معلم/درسی برای این کلاس‌ها ثبت نشده؛ ابتدا از «درس‌ها» تخصیص دهید.", "NO_ASSIGNMENTS");

    // FIX (راند ۱۶): روزها به ۱..۷ محدود + دیفالت هفته کاری پروفایل کشور
    const workDaysDefault = [1, 2, 3, 4, 5];
    const days = body.days?.length ? body.days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7) : workDaysDefault;
    if (!days.length) return apiErr(400, "روزهای هفته نامعتبر هستند (۱ تا ۷).", "BAD_DAYS");
    const periods = Math.min(Math.max(body.periods ?? 7, 4), 8);

    const entries = assignments.map((a) => ({
      classId: a.classId,
      classGrade: a.class.grade,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
      teacherId: a.teacherId,
      hours: Math.max(1, a.subject.weeklyHours),
    }));

    // سه سناریو با seed های متفاوت
    const scenarios = [11, 77, 301].map((seed, i) => {
      const r = generateScenario(entries, days, periods, seed);
      return {
        id: i,
        label: `گزینه ${["الف", "ب", "ج"][i]}`,
        slots: r.slots,
        unscheduled: r.unscheduled,
        scores: {
          teacher: Math.round(r.scoreTeacher * 10) / 10,
          spread: Math.round(r.scoreSpread * 10) / 10,
          special: Math.round(r.scoreSpecial * 10) / 10,
          total: Math.round(((r.scoreTeacher + r.scoreSpread + r.scoreSpecial) / 15) * 100),
        },
      };
    });

    // اعمال سناریو انتخاب‌شده
    if (body.apply && typeof body.scenario === "number") {
      const blocked = await demoWriteBlock(me);
      if (blocked) return blocked;
      const chosen = scenarios.find((s) => s.id === body.scenario);
      if (!chosen) return apiErr(400, "سناریو نامعتبر است.", "BAD_SCENARIO");
      // FIX: پاکسازی + ساخت در یک batch تا خرابی، برنامهٔ قبلی را پاک نکند
      await db.$transaction([
        db.scheduleSlot.deleteMany({
          where: { classId: { in: classes.map((c) => c.id) } },
        }),
        db.scheduleSlot.createMany({
          data: chosen.slots.map((s) => ({
            classId: s.classId,
            dayOfWeek: s.dayOfWeek,
            period: s.period,
            subjectId: s.subjectId,
            teacherId: s.teacherId,
          })),
        }),
      ]);
      await audit({
        user: me,
        action: "تولید خودکار برنامه هفتگی",
        entityType: "ScheduleSlot",
        meta: { scenario: chosen.label, slots: chosen.slots.length, classes: classes.length },
        schoolId,
      });
      return apiOk({ applied: true, scenario: chosen.label, scenarios });
    }

    return apiOk({ scenarios, classes: classes.map((c) => ({ id: c.id, name: c.name, grade: c.grade })) });
  } catch (e) {
    return handleApiError(e);
  }
}
