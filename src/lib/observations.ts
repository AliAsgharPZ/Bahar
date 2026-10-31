/* ============================================================
   بهار | مشاهدهٔ کلاس و ارزشیابی معلم
   مدیر/معاون سر کلاس حاضر می‌شود و پنج معیار را ۱ تا ۵ نمره
   می‌دهد؛ میانگین خودکار حساب می‌شود و معلم مشاهده‌های خودش
   را با نقاط قوت و زمینه‌های رشد می‌بیند.
   ============================================================ */

export const OBSERVATION_CRITERIA = [
  { key: "planning", label: "آمادگی و طرح درس" },
  { key: "management", label: "مدیریت کلاس" },
  { key: "teaching", label: "روش تدریس و انتقال مفاهیم" },
  { key: "interaction", label: "تعامل و مشارکت‌دادن دانش‌آموزان" },
  { key: "assessment", label: "ارزشیابی و بازخورد" },
] as const;

export type ObservationCriterionKey = (typeof OBSERVATION_CRITERIA)[number]["key"];
export type ObservationScores = Record<ObservationCriterionKey, number>;

/** نمره‌ها را به بازهٔ ۱..۵ می‌برد؛ مقدار نامعتبر = ۰ (ثبت‌نشده). */
export function clampScores(input: Partial<Record<string, unknown>> | null | undefined): ObservationScores {
  const out = {} as ObservationScores;
  for (const c of OBSERVATION_CRITERIA) {
    const v = Number(input?.[c.key] ?? 0);
    out[c.key] = Number.isFinite(v) ? Math.min(5, Math.max(0, Math.round(v))) : 0;
  }
  return out;
}

/** میانگین فقط روی معیارهای نمره‌دار (بزرگ‌تر از صفر). */
export function observationAverage(scores: ObservationScores): number {
  const vals = OBSERVATION_CRITERIA.map((c) => scores[c.key]).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function parseScores(json: string | null | undefined): ObservationScores {
  try {
    return clampScores(JSON.parse(json || "{}") as Record<string, unknown>);
  } catch {
    return clampScores(null);
  }
}
