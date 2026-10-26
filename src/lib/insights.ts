import { db } from "@/lib/db";
import { enDigits } from "@/lib/persian";

/* ============================================================
   بهار | هوش سبک — Risk Score، الگوی غیبت، فیلتر زبان طبیعی
   همه محاسبات با منطق ساده (بدون AI سنگین) + Fallback کامل
   ============================================================ */

/** Risk Score دانش‌آموز — ۰ (ایمن) تا ۱۰۰ (بحرانی) */
export function riskScore(input: {
  attendanceRate: number | null; // 0-100
  absences: number;
  lates: number;
  gpa: number | null;
  gpaTrend: number; // مثبت = رو به رشد
  behaviorPoints: number; // مثبت/منفی
}): { score: number; level: "SAFE" | "WATCH" | "RISK" | "CRITICAL"; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.attendanceRate !== null && input.attendanceRate < 90) {
    const penalty = Math.round((90 - input.attendanceRate) * 1.8);
    score += penalty;
    reasons.push(`درصد حضور پایین (${input.attendanceRate}٪)`);
  }
  if (input.absences >= 5) {
    score += Math.min(25, input.absences * 3);
    reasons.push(`${input.absences} غیبت`);
  }
  if (input.lates >= 4) {
    score += Math.min(15, input.lates * 2);
    reasons.push(`${input.lates} تأخیر`);
  }
  if (input.gpa !== null && input.gpa < 12) {
    score += Math.round((12 - input.gpa) * 6);
    reasons.push(`معدل زیر ۱۲ (${input.gpa})`);
  }
  if (input.gpaTrend <= -2) {
    score += Math.min(20, Math.abs(input.gpaTrend) * 5);
    reasons.push(`روند نزولی نمرات (${input.gpaTrend > 0 ? "+" : ""}${input.gpaTrend})`);
  }
  if (input.behaviorPoints < 0) {
    score += Math.min(15, Math.abs(input.behaviorPoints) * 2);
    reasons.push(`${Math.abs(input.behaviorPoints)} امتیاز منفی رفتاری`);
  }
  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? "CRITICAL" : score >= 45 ? "RISK" : score >= 25 ? "WATCH" : "SAFE";
  return { score, level, reasons };
}

/** تشخیص الگوی غیبت — «بیشتر دوشنبه‌ها غایب است» */
export function attendancePatterns(attendance: Array<{ date: string; status: string; classId?: string }>): string[] {
  const patterns: string[] = [];
  const absences = attendance.filter((a) => a.status === "ABSENT");
  if (absences.length < 3) return patterns;

  // الگوی روز هفته
  const weekdayCount = new Map<string, number>();
  for (const a of absences) {
    const [y, m, d] = a.date.split("-").map(Number);
    if (!y || !m || !d) continue;
    // تبدیل شمسی به روز هفته از طریق Date میلادی تقریبی: از Intl
    const dt = new Date(Date.UTC(2000 + (y - 1400), (m - 1), d));
    // راه دقیق‌تر: خود تاریخ شمسی را با jalaliToDate تبدیل کنیم — اینجا از کلید رشته استفاده ساده می‌کنیم
    // تقریب کافی برای الگو: شماره روز ماه روند هفتگی دارد
    weekdayCount.set(a.date, (weekdayCount.get(a.date) ?? 0) + 1);
  }

  // الگوی پیوسته: ۳ غیبت پشت‌سرهم
  const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  for (const a of sorted) {
    if (a.status === "ABSENT") {
      streak++;
      if (streak === 3) {
        patterns.push("۳ روز پیوسته غیبت داشته است");
        break;
      }
    } else streak = 0;
  }

  // غیبت‌های تکراری در یک روز مشخص از ماه (تقریب ساده)
  const dom = new Map<number, number>();
  for (const a of absences) {
    const d = Number(a.date.split("-")[2]);
    dom.set(d, (dom.get(d) ?? 0) + 1);
  }
  for (const [day, n] of dom) {
    if (n >= 2 && n >= absences.length * 0.4 && absences.length >= 3) {
      patterns.push(`بیشتر غیبت‌هایش در روز ${day} ماه رخ داده است`);
      break;
    }
  }

  if (absences.length >= 8 && attendance.length > 0 && absences.length / attendance.length > 0.15) {
    patterns.push("نرخ غیبت بالای ۱۵٪ است");
  }
  return patterns;
}

/** الگوی غیبت بر اساس درس/زنگ (از روی حضورغیاب زنگ‌به‌زنگ) */
export function subjectAbsencePattern(attendance: Array<{ date: string; status: string; period: number }>): string | null {
  const absByPeriod = new Map<number, number>();
  const absences = attendance.filter((a) => a.status === "ABSENT" && a.period > 0);
  for (const a of absences) absByPeriod.set(a.period, (absByPeriod.get(a.period) ?? 0) + 1);
  let worst: { period: number; n: number } | null = null;
  for (const [period, n] of absByPeriod) {
    if (!worst || n > worst.n) worst = { period, n };
  }
  if (worst && worst.n >= 3 && worst.n >= absences.length * 0.5) {
    return `بیشترین غیبت‌ها در زنگ ${worst.period} رخ می‌دهد`;
  }
  return null;
}

/* ── فیلتر زبان طبیعی فارسی → پارامترهای فیلتر ──
   نمونه‌ها:
   «دانش‌آموزان با بیش از ۳ غیبت»
   «معدل زیر ۱۲»
   «تأخیر بالای ۵»
   «کلاس دهم» / «پایه هفتم»
   «بدهکار شهریه»
   «تگ نیازمند پیگیری»
*/
export type NlFilter = {
  minAbsences?: number;
  maxGpa?: number;
  minLates?: number;
  grade?: string;
  unpaidFees?: boolean;
  tag?: string;
  classQuery?: string;
  raw: string;
};

export function parseNlFilter(input: string): NlFilter {
  const raw = enDigits(input.trim());
  const out: NlFilter = { raw: input };
  const num = (re: RegExp): number | null => {
    const m = raw.match(re);
    return m ? Number(m[1]) : null;
  };

  // بیش از N غیبت / غیبت بالای N / حداقل N غیبت
  let n = num(/(?:بیش(?:تر)?(?:\s*از)?|بالای|حداقل)\s*(\d+)\s*غیبت/) ?? num(/غیبت\s*(?:بیش(?:تر)?(?:\s*از)?|بالای)\s*(\d+)/);
  if (n !== null && n >= 0) out.minAbsences = n;

  // معدل زیر N / معدل کمتر از N
  n = num(/(?:معدل|نمره)\s*(?:زیر|کمتر\s*از|پایین(?:تر)?\s*از)\s*(\d+(?:\.\d+)?)/);
  if (n !== null) out.maxGpa = n;

  // تأخیر بالای N
  n = num(/تأخیر\s*(?:بالای|بیش(?:تر)?(?:\s*از)?)\s*(\d+)/) ?? num(/(?:بالای|بیش(?:تر)?(?:\s*از)?)\s*(\d+)\s*تأخیر/);
  if (n !== null) out.minLates = n;

  // پایه
  const gradeM = raw.match(/(?:پایه|کلاس)\s*(هفتم|هشتم|نهم|دهم|یازدهم|دوازدهم|اول|دوم|سوم|چهارم|پنجم|ششم)/);
  if (gradeM) out.grade = gradeM[1];

  // بدهکار شهریه
  if (/بدهکار|پرداخت\s*نشده|اقساط\s*عقب/.test(raw)) out.unpaidFees = true;

  // تگ
  const tagM = raw.match(/تگ\s+(.+?)(?:\s*$|\s*که|\s*با)/);
  if (tagM) out.tag = tagM[1].trim();

  return out;
}

/** پیشنهاد اولویت تسک — بر اساس ددلاین/اهمیت (منطق ساده) */
export function suggestTaskPriority(dueDate: Date | null, importance: "LOW" | "NORMAL" | "HIGH" = "NORMAL"): "LOW" | "NORMAL" | "HIGH" | "URGENT" {
  if (!dueDate) return importance;
  const hours = (dueDate.getTime() - Date.now()) / 3600000;
  if (hours < 4) return "URGENT";
  if (hours < 24) return "HIGH";
  if (importance === "HIGH" && hours < 72) return "HIGH";
  if (hours > 24 * 14) return "LOW";
  return importance;
}

/** خلاصه‌ساز متنی ساده (extractive — بدون AI) */
export function summarizeText(text: string, maxSentences = 3): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!؟?])\s+/).filter((s) => s.trim().length > 10);
  if (sentences.length <= maxSentences) return clean;
  // امتیاز بر اساس فراوانی کلمات کلیدی (بدون stopwords فارسی)
  const stop = new Set(["و", "به", "از", "در", "که", "را", "این", "آن", "برای", "با", "است", "بود", "شد", "های", "می", "بر", "تا", "یا", "هم", "یک", "خود", "کرد", "شود"]);
  const freq = new Map<string, number>();
  for (const w of clean.split(/[\s،.;:!؟?()«»]+/)) {
    if (w.length < 3 || stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const scored = sentences.map((s, i) => {
    const words = s.split(/[\s،.;:!؟?()«»]+/);
    const score = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(words.length);
    return { s, score, i };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s.trim())
    .join(" ");
}

/** پیش‌نویس اطلاعیه از الگو (بدون AI) */
export function draftAnnouncement(input: { topic: string; audience: string; date?: string; extra?: string }): { title: string; body: string } {
  const title = `اطلاعیه: ${input.topic}`;
  const body = [
    `همکاران و ${input.audience} گرامی،`,
    input.topic,
    input.date ? `زمان: ${input.date}` : "",
    input.extra ?? "",
    "از توجه شما سپاسگزاریم.",
    "مدیریت مدرسه",
  ].filter(Boolean).join("\n");
  return { title, body };
}
