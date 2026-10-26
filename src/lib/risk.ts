import { db } from "@/lib/db";
import { calendarParts, toKey, faDigits, calendarToDate } from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";

// ============================================================
// بهار | موتور هشدار زودهنگام (Early-Warning Engine) — راند ۱۶
// امتیاز ریسک هر دانش‌آموز از ۴ عامل محاسبه می‌شود:
//   حضور (۳۵٪) + نمرات (۳۰٪) + رفتار (۱۵٪) + سلامت روان (۲۰٪)
// خروجی: 0-100 (بالاتر = ریسک بیشتر) + سطح LOW/MODERATE/HIGH
// اجرا: جاروی روزانه زمان‌بند + محاسبه لحظه‌ای در API
// ============================================================

export type RiskFactor = {
  key: "attendance" | "grades" | "behavior" | "wellbeing";
  score: number; // 0-100
  weight: number;
  detail: string; // توضیح فارسی خوانا
};

export type RiskResult = {
  score: number;
  level: "LOW" | "MODERATE" | "HIGH";
  factors: RiskFactor[];
  period: string;
};

const WEIGHTS = { attendance: 0.35, grades: 0.3, behavior: 0.15, wellbeing: 0.2 } as const;

function levelOf(score: number): "LOW" | "MODERATE" | "HIGH" {
  if (score >= 66) return "HIGH";
  if (score >= 33) return "MODERATE";
  return "LOW";
}

/** کلیدهای N روز گذشته در تقویم فعال */
function pastKeys(days: number): string[] {
  const keys: string[] = [];
  const base = Date.now();
  for (let i = 0; i < days; i += 1) keys.push(toKey(new Date(base - i * 864e5)));
  return keys;
}

/** عامل حضور — نرخ غیبت ۳۰ روز گذشته + رشته غیبت متوالی */
async function attendanceFactor(studentId: string): Promise<RiskFactor> {
  const keys30 = pastKeys(30);
  const rows = await db.attendance.findMany({
    where: { studentId, date: { in: keys30 }, period: 0 },
    select: { date: true, status: true },
  });
  if (rows.length < 5) {
    return { key: "attendance", score: 0, weight: WEIGHTS.attendance, detail: "داده حضور کافی نیست (کمتر از ۵ روز ثبت‌شده)" };
  }
  const absent = rows.filter((r) => r.status === "ABSENT");
  const late = rows.filter((r) => r.status === "LATE");
  const rate = absent.length / rows.length;
  // رشته غیبت متوالی (بر اساس کلید تاریخ مرتب‌شده)
  const dayKeys = [...new Set(rows.filter((r) => r.status === "ABSENT").map((r) => String(r.date)))].sort();
  let streak = 0;
  let maxStreak = 0;
  let prevKey = "";
  for (const k of dayKeys) {
    if (prevKey && isNextDay(prevKey, k)) streak += 1;
    else streak = 1;
    maxStreak = Math.max(maxStreak, streak);
    prevKey = k;
  }
  // امتیاز: نرخ غیبت ۲۰٪+ → سقف؛ هر رشته ۳+ روز → +۲۰
  let score = Math.min(100, Math.round(rate * 100 * 2.5));
  if (maxStreak >= 3) score = Math.min(100, score + 20);
  const detail = `غیبت ${faDigits(absent.length)} از ${faDigits(rows.length)} روز (نرخ ${faDigits(Math.round(rate * 100))}٪)` +
    (late.length ? ` · تاخیر ${faDigits(late.length)}` : "") +
    (maxStreak >= 3 ? ` · ${faDigits(maxStreak)} روز غیبت متوالی` : "");
  return { key: "attendance", score, weight: WEIGHTS.attendance, detail };
}

/** آیا کلید b دقیقاً روزِ بعد از کلید a در تقویم فعال است؟ */
function isNextDay(a: string, b: string): boolean {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = calendarPartsToDate(ay, am, ad);
  const dbb = calendarPartsToDate(by, bm, bd);
  if (!da || !dbb) return false;
  return Math.round((dbb.getTime() - da.getTime()) / 864e5) === 1;
}
function calendarPartsToDate(y: number, m: number, d: number): Date | null {
  try {
    const dt = calendarToDate(y, m, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

/** عامل نمرات — میانگین نیمسال جاری + روند ۲ ماه اخیر */
async function gradesFactor(studentId: string): Promise<RiskFactor> {
  const maxScore = getCountrySync().grading.maxScore;
  const rows = await db.gradeRecord.findMany({
    where: { studentId },
    select: { score: true, maxScore: true, term: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  if (rows.length < 3) {
    return { key: "grades", score: 0, weight: WEIGHTS.grades, detail: "داده نمره کافی نیست (کمتر از ۳ نمره)" };
  }
  // نیمسال آخر
  const latestTerm = rows[0].term;
  const termRows = rows.filter((r) => r.term === latestTerm);
  const avg = termRows.reduce((s, r) => s + (r.score / (r.maxScore || maxScore)) * maxScore, 0) / termRows.length;
  const ratio = avg / maxScore; // 0..1
  let score = 0;
  if (ratio < 0.5) score = 80;
  else if (ratio < 0.6) score = 55;
  else if (ratio < 0.7) score = 30;
  else score = 5;
  // روند نزولی: مقایسه نیم‌ماه اخیر با نیم‌ماه قبل
  const twoWeeksAgo = Date.now() - 14 * 864e5;
  const recent = rows.filter((r) => r.createdAt.getTime() >= twoWeeksAgo);
  const older = rows.filter((r) => r.createdAt.getTime() < twoWeeksAgo);
  let trendNote = "";
  if (recent.length >= 3 && older.length >= 3) {
    const avgR = recent.reduce((s, r) => s + (r.score / (r.maxScore || maxScore)) * maxScore, 0) / recent.length;
    const avgO = older.reduce((s, r) => s + (r.score / (r.maxScore || maxScore)) * maxScore, 0) / older.length;
    const drop = avgO - avgR;
    if (drop > maxScore * 0.15) {
      score = Math.min(100, score + 30);
      trendNote = ` · روند نزولی (${faDigits(Math.round((drop / maxScore) * 100))}٪ افت اخیر)`;
    } else if (avgR > avgO + maxScore * 0.1) {
      score = Math.max(0, score - 10);
      trendNote = " · روند صعودی اخیر";
    }
  }
  const detail = `میانگین نیمسال: ${faDigits(Math.round(avg * 10) / 10)} از ${faDigits(maxScore)}${trendNote}`;
  return { key: "grades", score, weight: WEIGHTS.grades, detail };
}

/** عامل رفتار — رکوردهای منفی ۳۰ روز گذشته */
async function behaviorFactor(studentId: string): Promise<RiskFactor> {
  const monthAgo = new Date(Date.now() - 30 * 864e5);
  const rows = await db.behaviorRecord.findMany({
    where: { studentId, createdAt: { gte: monthAgo } },
    select: { kind: true, points: true },
  });
  if (!rows.length) {
    return { key: "behavior", score: 0, weight: WEIGHTS.behavior, detail: "بدون رکورد رفتاری در ۳۰ روز گذشته" };
  }
  const negative = rows.filter((r) => r.kind === "NEGATIVE").length;
  const positive = rows.filter((r) => r.kind === "POSITIVE").length;
  let score = Math.min(100, negative * 18);
  if (positive >= negative && positive > 0) score = Math.max(0, score - 15);
  const detail = `${faDigits(negative)} رکورد منفی · ${faDigits(positive)} رکورد مثبت (۳۰ روز)`;
  return { key: "behavior", score, weight: WEIGHTS.behavior, detail };
}

/** عامل سلامت روان — چک‌این‌های ۱۴ روز گذشته */
async function wellbeingFactor(studentId: string): Promise<RiskFactor> {
  const keys14 = pastKeys(14);
  const rows = await db.wellbeingCheckin.findMany({
    where: { studentId, date: { in: keys14 } },
    select: { mood: true, flagged: true },
  });
  if (!rows.length) {
    return { key: "wellbeing", score: 0, weight: WEIGHTS.wellbeing, detail: "چک‌این سلامت روان ثبت نشده" };
  }
  const avgMood = rows.reduce((s, r) => s + r.mood, 0) / rows.length;
  const flagged = rows.filter((r) => r.flagged).length;
  let score = 0;
  if (avgMood <= 2.2) score = 85;
  else if (avgMood <= 2.8) score = 60;
  else if (avgMood <= 3.4) score = 30;
  score = Math.min(100, score + flagged * 12);
  const detail = `میانگین حال: ${faDigits(Math.round(avgMood * 10) / 10)} از ۵ در ${faDigits(rows.length)} چک‌این` +
    (flagged ? ` · ${faDigits(flagged)} مورد پرچم‌شده` : "");
  return { key: "wellbeing", score, weight: WEIGHTS.wellbeing, detail };
}

/** کلید دوره جاری (ماه تقویم فعال مثل 1404-07) */
export function currentPeriod(): string {
  const { y, m } = calendarParts(new Date());
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** محاسبه ریسک کامل یک دانش‌آموز */
export async function computeRisk(studentId: string): Promise<RiskResult> {
  const [att, gr, beh, wel] = await Promise.all([
    attendanceFactor(studentId),
    gradesFactor(studentId),
    behaviorFactor(studentId),
    wellbeingFactor(studentId),
  ]);
  const factors = [att, gr, beh, wel];
  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  return { score: Math.min(100, Math.max(0, score)), level: levelOf(score), factors, period: currentPeriod() };
}

/** جاروی روزانه — به‌روزرسانی RiskScore همه دانش‌آموزان فعال (تمام مدارس) */
let lastRiskSweepPeriod = "";
export async function sweepRiskScores(): Promise<void> {
  const period = currentPeriod();
  if (lastRiskSweepPeriod === period) return; // یک‌بار در هر ماه تقویمی
  lastRiskSweepPeriod = period;

  const students = await db.student.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 20000,
  });
  let updated = 0;
  const now = new Date();
  for (const st of students) {
    try {
      const risk = await computeRisk(st.id);
      await db.riskScore.upsert({
        where: { studentId_period: { studentId: st.id, period } },
        update: { score: risk.score, level: risk.level, breakdown: JSON.stringify(risk.factors), computedAt: now },
        create: { studentId: st.id, period, score: risk.score, level: risk.level, breakdown: JSON.stringify(risk.factors), computedAt: now },
      });
      updated += 1;
    } catch { /* دانش‌آموز خراب کل جارو را نمی‌شکند */ }
  }
  if (updated > 0) console.log(`[RISK] ${updated} امتیاز ریسک برای دوره ${period} به‌روزرسانی شد`);
}

// ============================================================
// روایت تحلیلی (Narrative Report) — تولید متن فارسی از داده‌ها
// ============================================================

export type NarrativeInput = {
  studentName: string;
  gradeLevel?: string | null;
  className?: string | null;
  termAverage?: number | null;
  maxScore: number;
  bestSubject?: { name: string; avg: number } | null;
  worstSubject?: { name: string; avg: number } | null;
  attendanceRate?: number | null;
  absentDays?: number | null;
  lateCount?: number | null;
  behaviorPositive?: number | null;
  behaviorNegative?: number | null;
  avgMood?: number | null;
  riskLevel?: string | null;
};

/** متن روایی تحلیلی — قطعه‌قطعه از داده واقعی، بدون LLM خارجی */
export function buildNarrative(input: NarrativeInput): string {
  const parts: string[] = [];
  const max = input.maxScore;
  const f = (n: number | null | undefined) => (n == null ? null : faDigits(Math.round(n * 10) / 10));

  // افتتاحیه
  const intro = input.gradeLevel
    ? `${input.studentName} (پایه ${input.gradeLevel}${input.className ? ` — ${input.className}` : ""})`
    : input.studentName;
  parts.push(`${intro}:`);

  // عملکرد تحصیلی
  if (input.termAverage != null) {
    const ratio = input.termAverage / max;
    if (ratio >= 0.85) parts.push(`عملکرد تحصیلی بسیار خوب است با میانگین ${f(input.termAverage)} از ${faDigits(max)}؛ این سطح نشان‌دهنده پشتکار و نظم مستمر در درس‌ها است.`);
    else if (ratio >= 0.7) parts.push(`میانگین نمرات ${f(input.termAverage)} از ${faDigits(max)} است که در سطح خوبی قرار دارد؛ با برنامه‌ریزی منظم می‌تواند به سطوح بالاتر برسد.`);
    else if (ratio >= 0.5) parts.push(`میانگین نمرات ${f(input.termAverage)} از ${faDigits(max)} است؛ برای بهبود، تمرکز بر درس‌های ضعیف‌تر و مشاوره با معلم مربوطه توصیه می‌شود.`);
    else parts.push(`میانگین نمرات ${f(input.termAverage)} از ${faDigits(max)} پایین‌تر از حد انتظار است؛ جلسه مشترک با مشاور و اولیا برای شناسایی علت‌ها ضروری است.`);
    if (input.bestSubject && input.worstSubject && input.bestSubject.name !== input.worstSubject.name) {
      parts.push(`قوی‌ترین درس «${input.bestSubject.name}» با میانگین ${f(input.bestSubject.avg)} و نیازمند توجه‌ترین درس «${input.worstSubject.name}» با میانگین ${f(input.worstSubject.avg)} است.`);
    }
  }

  // حضور
  if (input.attendanceRate != null) {
    if (input.attendanceRate >= 95) parts.push(`حضور منظم و ممتد است (نرخ ${f(input.attendanceRate)}٪)${input.lateCount ? ` با ${faDigits(input.lateCount)} مورد تاخیر جزئی` : ""}.`);
    else if (input.attendanceRate >= 85) parts.push(`نرخ حضور ${f(input.attendanceRate)}٪ است؛ ${faDigits(input.absentDays ?? 0)} روز غیبت ثبت شده که پیگیری علت آن بهتر است.`);
    else parts.push(`غیبت‌ها قابل توجه است: ${faDigits(input.absentDays ?? 0)} روز (نرخ حضور ${f(input.attendanceRate)}٪) — گفت‌وگوی فوری با خانواده پیشنهاد می‌شود.`);
  }

  // رفتار
  if ((input.behaviorPositive ?? 0) + (input.behaviorNegative ?? 0) > 0) {
    const pos = input.behaviorPositive ?? 0;
    const neg = input.behaviorNegative ?? 0;
    if (neg === 0) parts.push(`از نظر رفتاری ${pos > 0 ? `${faDigits(pos)} رکورد مثبت ثبت شده و ` : ""}بدون رکورد منفی است — وضعیت مطلوب.`);
    else if (pos >= neg) parts.push(`${faDigits(pos)} رکورد رفتاری مثبت در برابر ${faDigits(neg)} منفی ثبت شده؛ نقاط قوت رفتاری بر نقاط ضعف غالب است.`);
    else parts.push(`${faDigits(neg)} رکورد رفتاری منفی در برابر ${faDigits(pos)} مثبت — جلسه انضباطی با حضور مشاور توصیه می‌شود.`);
  }

  // سلامت روان
  if (input.avgMood != null) {
    if (input.avgMood >= 4) parts.push(`وضعیت روحی در چک‌این‌های اخیر خوب گزارش شده (میانگین ${f(input.avgMood)} از ۵).`);
    else if (input.avgMood >= 3) parts.push(`حالت عمومی متوسط است (میانگین ${f(input.avgMood)} از ۵)؛ پیگیری غیرمستقیم توصیه می‌شود.`);
    else parts.push(`چک‌این‌های سلامت روان نشان‌دهنده حال پایین است (میانگین ${f(input.avgMood)} از ۵) — ارجاع به مشاور مدرسه به‌شدت توصیه می‌شود.`);
  }

  // جمع‌بندی
  if (input.riskLevel === "HIGH") parts.push("جمع‌بندی: این دانش‌آموز در فهرست هشدار زودهنگام (سطح بالا) قرار دارد؛ مداخله هماهنگ معلمان، مشاور و خانواده لازم است.");
  else if (input.riskLevel === "MODERATE") parts.push("جمع‌بندی: نشانه‌های اولیه ریسک دیده می‌شود؛ پایش دقیق‌تر در هفته‌های آینده پیشنهاد می‌شود.");
  else parts.push("جمع‌بندی: وضعیت کلی مطلوب است؛ حفظ روند فعلی و تشویق مستمر توصیه می‌شود.");

  return parts.join("\n");
}
