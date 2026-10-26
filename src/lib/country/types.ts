// ============================================================
// بهار | سیستم پروفایل کشور (Country Profile) — تعریف انواع
// همه ویژگی‌های وابسته به ملیت (تقویم، کد ملی، موبایل، مناطق،
// ارز، پایه‌ها، هفته کاری،…) از این پروفایل خوانده می‌شود.
// دیفالت: ایران — قابل تعویض با بسته کشور کاستوم (CountryPack)
// ============================================================

/** تقویم‌های پشتیبانی‌شده — کلیدهای Intl Unicode calendar */
export const CALENDARS = [
  "persian",
  "gregory",
  "islamic-umalqura",
  "islamic-civil",
  "islamic-tbla",
  "hebrew",
  "ethiopic",
  "coptic",
  "indian",
  "buddhist",
  "chinese",
  "dangi",
  "japanese",
] as const;
export type CalendarKind = (typeof CALENDARS)[number];

/** الگوریتم اعتبارسنجی شناسه ملی */
export type NationalIdAlgorithm =
  | "iran-mod11" // ایران — رقم کنترل باقیمانده بر ۱۱
  | "luhn" // کشورهایی با رقم کنترل Luhn
  | "digits" // فقط الگو (بدون رقم کنترل)
  | "none"; // هر رشته غیرخالی

export type CountryProfile = {
  /** کد یکتا (مثل IR) */
  code: string;
  /** نام کشور به فارسی — نمایش مدیریتی */
  name: string;
  /** نام بومی */
  nativeName: string;
  /** locale نمایش — مثل fa-IR / tr-TR / ar-SA */
  locale: string;
  direction: "rtl" | "ltr";
  /** منطقه زمانی IANA — مثل Asia/Tehran */
  timezone: string;
  calendar: CalendarKind;
  /** ارقام نمایش: native (ارقام بومی مثل فارسی) | latin */
  digits: "native" | "latin";
  nationalId: {
    label: string; // «کد ملی»
    algorithm: NationalIdAlgorithm;
    /** regex source بدون اسلش — مثل "^\\d{10}$" */
    pattern: string;
    placeholder: string;
    example: string;
    /** پیام خطا (اختیاری — پیام پیش‌فرض فارسی ساخته می‌شود) */
    invalidMessage?: string;
  };
  phone: {
    /** regex source — مثل "^09\\d{9}$" یا "^\\+90\\d{10}$" */
    pattern: string;
    placeholder: string;
    example: string;
  };
  currency: {
    /** واحد پول نمایش — «تومان» / «لیر» / «درهم» */
    label: string;
    code: string; // IRR / TRY / AED
    /** سقف/کف مبلغ تراکنش شهریه */
    minAmount: number;
    maxAmount: number;
  };
  week: {
    /** روزهای کاری مدرسه — ۱=شنبه … ۷=جمعه (مثل [1,2,3,4,5]) */
    workDays: number[];
    /** برچسب ۷ روز — اندیس ۱ تا ۷ (طول ۸، [0] خالی) */
    labels: string[];
  };
  /** پایه‌های تحصیلی (dropdown کلاس‌ها) */
  gradeLevels: string[];
  /** رشته‌های تحصیلی */
  fields: string[];
  /** انواع مدرسه */
  schoolTypes: string[];
  /** مناطق (استان/ایالت + شهرستان‌ها) */
  regions: { name: string; center: string; counties: string[] }[];
  /** نقشه SVG اختیاری برای انتخاب منطقه — اگر نبود فقط دراپ‌داون */
  map?: {
    viewBox: { w: number; h: number };
    provinces: { name: string; d: string; cx: number; cy: number }[];
  };
  grading: {
    /** نمره کامل — ایران: ۲۰ */
    maxScore: number;
    /** تعداد نیمسال — ایران: ۲ */
    terms: number;
    /** برچسب نیمسال‌ها — اندیس ۱ تا terms (طول terms+1، [0] خالی) */
    termLabels: string[];
  };
  /** نمونه سال تحصیلی — «1404-1405» */
  academicYearExample: string;
  /** ماژول‌های اختیاری کشور-خاص */
  modules: {
    /** شبکه شاد — فقط ایران */
    shad: boolean;
  };
  /** یادداشت سازنده بسته (نمایش در پنل) */
  notes?: string;
  version?: string;
};

export const COUNTRY_PACK_MAX_BYTES = 600 * 1024; // ۶۰۰KB

/** ساختار خروجی اعتبارسنجی بسته کشور */
export type CountryPackValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    regions: number;
    counties: number;
    workDays: number;
    gradeLevels: number;
    hasMap: boolean;
    mapProvinces: number;
    bytes: number;
  };
};
