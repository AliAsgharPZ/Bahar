/* ============================================================
   بهار | موتور هدایت تحصیلی — پیشنهاد رشته بر پایهٔ وزن‌های
   شفاف و قطعی (بدون هوش مصنوعی خارجی): نمرات هفت حوزهٔ درسی
   (۰ تا ۲۰) با وزن هر رشته ترکیب می‌شوند و رتبه‌بندی رشته‌ها
   با امتیاز درصدی برمی‌گردد تا مشاور و خانواده منطق پیشنهاد
   را دقیق ببینند.
   ============================================================ */

export const GUIDANCE_AREAS = [
  { key: "math", label: "ریاضی" },
  { key: "science", label: "علوم تجربی (درس علوم)" },
  { key: "literature", label: "ادبیات فارسی" },
  { key: "arabic", label: "عربی و معارف" },
  { key: "social", label: "مطالعات اجتماعی" },
  { key: "english", label: "زبان انگلیسی" },
  { key: "practical", label: "کار و فناوری / عملی" },
] as const;

export type GuidanceScores = Record<string, number>;

const STREAMS: { key: string; label: string; weights: Record<string, number>; hint: string }[] = [
  {
    key: "MATH_PHYSICS", label: "ریاضی و فیزیک",
    weights: { math: 4, science: 2, practical: 1, english: 1 },
    hint: "برای ذهن تحلیلی و مسیر مهندسی و فناوری.",
  },
  {
    key: "EXPERIMENTAL", label: "علوم تجربی",
    weights: { science: 4, math: 2, literature: 1, english: 1 },
    hint: "برای مسیر پزشکی، پیراپزشکی و علوم زیستی.",
  },
  {
    key: "HUMANITIES", label: "علوم انسانی",
    weights: { literature: 3, arabic: 2, social: 3, math: 1 },
    hint: "برای حقوق، روان‌شناسی، مدیریت و علوم اجتماعی.",
  },
  {
    key: "TECHNICAL", label: "فنی‌وحرفه‌ای و کارودانش",
    weights: { practical: 4, math: 2, science: 1, english: 1 },
    hint: "برای مهارت عملی و ورود سریع‌تر به بازار کار تخصصی.",
  },
];

export function rankStreams(scores: GuidanceScores): { key: string; label: string; percent: number; hint: string }[] {
  const out = STREAMS.map((s) => {
    let got = 0;
    let max = 0;
    for (const [area, w] of Object.entries(s.weights)) {
      const v = Math.min(20, Math.max(0, Number(scores[area] ?? 0)));
      got += v * w;
      max += 20 * w;
    }
    return { key: s.key, label: s.label, percent: max ? Math.round((got / max) * 100) : 0, hint: s.hint };
  });
  return out.sort((a, b) => b.percent - a.percent);
}
