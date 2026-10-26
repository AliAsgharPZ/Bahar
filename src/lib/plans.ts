// ============================================================
// بهار | اشتراک مدارس — نقره‌ای / طلایی / الماسی
// (اشتراک رایگان وجود ندارد؛ همه پلن‌ها پولی هستند)
// سطوح دسترسی قابلیت‌ها بر اساس پلن + هشدار انقضا برای مدیر
// ============================================================

export type PlanKey = "SILVER" | "GOLD" | "DIAMOND";

export type PlanFeature =
  | "core" // دانش‌آموز، کلاس، درس، حضور و غیاب، نمره، تکالیف، برنامه هفتگی
  | "events" // رویدادها
  | "announcements" // اطلاعیه‌های مدرسه
  | "messenger" // پیام‌رسان داخلی
  | "shad" // دروازه شاد
  | "finance" // شهریه و امور مالی
  | "website" // سایت عمومی مدرسه (تمپلیت‌ها)
  | "custom_domain" // دامنه اختصاصی سایت مدرسه
  | "advanced_reports"; // گزارش‌های پیشرفته

export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  core: "هسته مدیریت مدرسه (دانش‌آموز، کلاس، نمره، حضور و غیاب، تکلیف، برنامه)",
  events: "رویدادها و تقویم مدرسه",
  announcements: "اطلاعیه‌ها با هدف‌گیری نقش و نقشه",
  messenger: "پیام‌رسان داخلی بهار",
  shad: "دروازه اتصال شاد",
  finance: "ماژول شهریه و امور مالی",
  website: "سایت عمومی مدرسه با تمپلیت آماده",
  custom_domain: "دامنه اختصاصی برای سایت مدرسه",
  advanced_reports: "گزارش‌های پیشرفته و تحلیل آماری",
};

export const PLANS: Record<PlanKey, {
  label: string;
  color: string;
  features: PlanFeature[];
  monthlyPrice: number; // تومان — داخلی، در سایت نمایش داده نمی‌شود
}> = {
  SILVER: {
    label: "نقره‌ای",
    color: "#8E9BAA",
    features: ["core", "events", "announcements", "messenger"],
    monthlyPrice: 290000,
  },
  GOLD: {
    label: "طلایی",
    color: "#C9971C",
    features: ["core", "events", "announcements", "messenger", "shad", "finance", "website"],
    monthlyPrice: 690000,
  },
  DIAMOND: {
    label: "الماسی",
    color: "#00825E",
    features: ["core", "events", "announcements", "messenger", "shad", "finance", "website", "custom_domain", "advanced_reports"],
    monthlyPrice: 1290000,
  },
};

export const PLAN_ORDER: PlanKey[] = ["SILVER", "GOLD", "DIAMOND"];

/** پلن پیشنهادی بهار — الماسی */
export const RECOMMENDED_PLAN: PlanKey = "DIAMOND";

export function planOf(plan: string | null | undefined): PlanKey {
  if (plan && plan in PLANS) return plan as PlanKey;
  return "SILVER";
}

export function planHas(plan: string | null | undefined, feature: PlanFeature): boolean {
  return PLANS[planOf(plan)].features.includes(feature);
}

export function planLabel(plan: string | null | undefined): string {
  return PLANS[planOf(plan)].label;
}

export type PlanStatus = {
  plan: PlanKey;
  label: string;
  color: string;
  features: PlanFeature[];
  expiresAt: string | null;
  daysLeft: number | null; // null = بی‌نهایت
  expired: boolean;
  warning: boolean; // کمتر از ۳۰ روز مانده
};

export function planStatusOf(plan: string | null | undefined, expiresAt: Date | string | null | undefined): PlanStatus {
  const key = planOf(plan);
  const p = PLANS[key];
  let daysLeft: number | null = null;
  let expired = false;
  let warning = false;
  let iso: string | null = null;
  if (expiresAt) {
    const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    iso = d.toISOString();
    daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
    expired = daysLeft <= 0;
    warning = !expired && daysLeft <= 30;
  }
  return { plan: key, label: p.label, color: p.color, features: p.features, expiresAt: iso, daysLeft, expired, warning };
}
