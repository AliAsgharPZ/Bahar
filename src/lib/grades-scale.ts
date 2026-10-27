/* ============================================================
   بهار | تبدیل مقیاس نمره — نمرهٔ مبنا در بهار ۲۰ است؛ پروفایل
   کشور هر مدرسه تعیین می‌کند نمره در خروجی‌ها و گزارش‌ها با
   کدام مقیاس نمایش داده شود: از ۲۰، از ۱۰۰، GPA چهارنمره‌ای
   یا حرفی (A تا F).
   ============================================================ */

export type GradingScale = "SCORE20" | "SCORE100" | "GPA4" | "LETTER";

export const GRADING_SCALES: { value: GradingScale; label: string }[] = [
  { value: "SCORE20", label: "از ۲۰ (ایران)" },
  { value: "SCORE100", label: "از ۱۰۰ (درصدی)" },
  { value: "GPA4", label: "GPA از ۴" },
  { value: "LETTER", label: "حرفی (A تا F)" },
];

export const CALENDAR_SYSTEMS = [
  { value: "JALALI", label: "شمسی (جلالی)" },
  { value: "GREGORIAN", label: "میلادی" },
  { value: "HIJRI", label: "قمری (هجری)" },
] as const;

/** تبدیل نمرهٔ ۰..۲۰ به مقیاس مقصد؛ خروجی رشتهٔ نمایشی است */
export function convertScore(score20: number, scale: string): string {
  const s = Math.min(20, Math.max(0, score20));
  switch (scale) {
    case "SCORE100":
      return String(Math.round(s * 5));
    case "GPA4":
      return (Math.round((s / 20) * 4 * 100) / 100).toFixed(2);
    case "LETTER":
      if (s >= 18) return "A";
      if (s >= 16) return "B";
      if (s >= 14) return "C";
      if (s >= 12) return "D";
      if (s >= 10) return "E";
      return "F";
    default:
      return String(Math.round(s * 100) / 100);
  }
}

/** آیا مقیاس، عددی است (برای میانگین‌گیری روی مقدار تبدیل‌شده) */
export function scaleIsNumeric(scale: string): boolean {
  return scale !== "LETTER";
}
