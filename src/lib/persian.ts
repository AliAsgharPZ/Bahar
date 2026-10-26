// ============================================================
// بهار | ابزارهای بومی‌سازی — رقم، تاریخ تقویم فعال، هفته
// از راند ۱۶ به بعد همه توابع از «پروفایل کشور فعال» می‌خوانند:
//   • دیفالت = ایران → رفتار دقیقاً مثل قبل (تقویم شمسی/ارقام فارسی)
//   • بسته کشور کاستوم → تقویم/ارقام/زمان/هفته همان کشور
// کش همگام: سرور (instrumentation) و کلاینت (CountryProvider)
// ============================================================
import { getCountrySync } from "@/lib/country/cache";
import type { CalendarKind } from "@/lib/country/types";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** ارقام بومی برای نمایش — در حالت latin تبدیل نمی‌کند */
export function faDigits(input: string | number): string {
  if (getCountrySync().digits === "latin") return String(input);
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** نرمال‌سازی ورودی کاربر → ارقام لاتین (همیشه، مستقل از پروفایل) */
export function enDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// ------------------------------------------------------------
// پیکربندی نمایش از پروفایل فعال
// ------------------------------------------------------------
function tz(): string {
  return getCountrySync().timezone;
}

/** locale کامل برای Intl: «fa-IR-u-ca-persian» (+ nu-latn در حالت لاتین) */
function displayLocale(opts?: { numeric?: boolean }): string {
  const c = getCountrySync();
  const ext: string[] = [];
  if (c.calendar !== "gregory") ext.push(`ca-${c.calendar}`);
  if (c.digits === "latin") ext.push("nu-latn");
  const base = c.locale;
  if (!ext.length) return base;
  return `${base}-u-${ext.join("-")}`;
}

/** اجزای تاریخ در تقویم فعال (به وقت منطقه زمانی کشور) */
export function calendarParts(date: Date = new Date(), calendar?: CalendarKind): { y: number; m: number; d: number } {
  const cal = calendar ?? getCountrySync().calendar;
  const fmt = new Intl.DateTimeFormat(`en-US-u-ca-${cal}`, {
    timeZone: tz(),
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** اجزای تاریخ شمسی — نام قدیمی calendarParts (سازگاری) */
export function jalaliParts(date: Date = new Date()): { y: number; m: number; d: number } {
  return calendarParts(date, "persian");
}

/** کلید تاریخ امروز در تقویم فعال — 1404-07-10 (شمسی) / 2025-10-08 (میلادی) */
export function todayKey(): string {
  return toKey(new Date());
}

/** امروز شمسی — نام قدیمی (سازگاری) */
export function todayJalali(): string {
  return todayKey();
}

/** تبدیل Date به کلید تقویم فعال */
export function toKey(date: Date): string {
  const { y, m, d } = calendarParts(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** تبدیل Date به کلید شمسی — نام قدیمی (سازگاری) */
export function toJalaliKey(date: Date): string {
  const { y, m, d } = calendarParts(date, "persian");
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** شماره روز هفته: شنبه=۱ … جمعه=۷ (مستقل از تقویم) */
export function jalaliDayOfWeek(date: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz(),
    weekday: "short",
  });
  const wd = fmt.format(date); // Sat, Sun, ...
  const map: Record<string, number> = {
    Sat: 1, Sun: 2, Mon: 3, Tue: 4, Wed: 5, Thu: 6, Fri: 7,
  };
  return map[wd] ?? 1;
}

/** برچسب‌های ۷ روز هفته از پروفایل فعال (ایران: شنبه…جمعه) */
export function weekdays(): { value: number; label: string }[] {
  const labels = getCountrySync().week.labels;
  const out: { value: number; label: string }[] = [];
  for (let i = 1; i <= 7; i += 1) out.push({ value: i, label: labels[i] ?? String(i) });
  return out;
}

/** روزهای کاری مدرسه از پروفایل فعال (ایران: شنبه تا چهارشنبه) */
export function workDays(): number[] {
  return getCountrySync().week.workDays;
}

/** هفته ایران — ثابت تاریخی (سازگاری با کدهای موجود) */
export const WEEKDAYS_FA = [
  { value: 1, label: "شنبه" },
  { value: 2, label: "یکشنبه" },
  { value: 3, label: "دوشنبه" },
  { value: 4, label: "سه‌شنبه" },
  { value: 5, label: "چهارشنبه" },
  { value: 6, label: "پنجشنبه" },
  { value: 7, label: "جمعه" },
];

export function weekdayLabel(v: number): string {
  const labels = getCountrySync().week.labels;
  return labels[v] ?? WEEKDAYS_FA.find((w) => w.value === v)?.label ?? "—";
}

/** تاریخ خوانا در تقویم/زبان فعال: ۱۰ مهر ۱۴۰۴ / 8 Ekim 2025 */
export function formatDateFa(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(displayLocale(), {
      timeZone: tz(),
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return faDigits(d.toLocaleDateString());
  }
}

/** تاریخ + ساعت */
export function formatDateTimeFa(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(displayLocale(), {
      timeZone: tz(),
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return faDigits(d.toLocaleString());
  }
}

/** ساعت HH:MM */
export function formatTimeFa(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(displayLocale(), {
      timeZone: tz(),
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return faDigits(d.toLocaleTimeString());
  }
}

/** برچسب نسبی زمان (چند دقیقه پیش…) — برای همه تقویم‌ها */
export function relativeTimeFa(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "همین حالا";
  if (min < 60) return `${faDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${faDigits(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${faDigits(day)} روز پیش`;
  return formatDateFa(d);
}

export const EVENT_KIND_LABELS: Record<string, string> = {
  MEETING: "جلسه",
  CEREMONY: "مراسم",
  EXAM: "امتحان",
  HOLIDAY: "تعطیلی",
  TRIP: "گردش علمی",
  WORKSHOP: "کارگاه",
  OTHER: "سایر",
};

export const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "همه",
  STUDENTS: "دانش‌آموزان",
  TEACHERS: "معلمان",
  PARENTS: "اولیا",
  CLASS: "کلاس خاص",
};

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
  LATE: "تاخیر",
  EXCUSED: "موجه",
};

export const GRADE_KIND_LABELS: Record<string, string> = {
  QUIZ: "کوئیز",
  MIDTERM: "میان‌ترم",
  FINAL: "پایان‌ترم",
  PROJECT: "پروژه",
  ACTIVITY: "فعالیت کلاسی",
  BEHAVIOR: "برخوردار",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "پسر",
  FEMALE: "دختر",
};

export const PARENT_RELATION_LABELS: Record<string, string> = {
  FATHER: "پدر",
  MOTHER: "مادر",
  GUARDIAN: "سرپرست",
};

export const STUDENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "فعال",
  GRADUATED: "فارغ‌التحصیل",
  TRANSFERRED: "انتقالی",
  SUSPENDED: "معلق",
};

/** اعداد بومی با جداکننده هزارگان (در حالت latin: 1,234,567) */
export function faNumber(n: number | string): string {
  const c = getCountrySync();
  if (c.digits === "latin") {
    const num = typeof n === "number" ? n : Number(String(n).replace(/[٬,]/g, ""));
    return Number.isFinite(num) ? num.toLocaleString("en-US") : String(n);
  }
  const s = typeof n === "number" ? n.toLocaleString("en-US") : String(n);
  return faDigits(s);
}

/** برچسب واحد پول فعال («تومان» / «لیر» / …) */
export function currencyLabel(): string {
  return getCountrySync().currency.label;
}

// ============================================================
// تاریخ تقویم فعال — ورودی/خروجی فرم‌ها (سال/ماه/روز ↔ Date)
// ============================================================

/** ماه‌های تقویم فعال — برای دیفالت ایران همان فروردین…اسفند */
const MONTH_NAMES_CACHE = new Map<string, string[]>();

export function calendarMonthNames(): string[] {
  const c = getCountrySync();
  const key = `${c.calendar}|${c.locale}`;
  const hit = MONTH_NAMES_CACHE.get(key);
  if (hit) return hit;
  const names: string[] = [""]; // [0] خالی — اندیس ۱ تا ۱۲
  try {
    for (let m = 1; m <= 12; m += 1) {
      const fmt = new Intl.DateTimeFormat(`${c.locale}-u-ca-${c.calendar}`, { month: "long", timeZone: "UTC" });
      // یک تاریخ میانی از هر ماه میلادی → نام ماه تقویم مقصد
      names.push(fmt.format(new Date(Date.UTC(2025, Math.min(11, m), 15))));
    }
  } catch {
    return JALALI_MONTHS;
  }
  MONTH_NAMES_CACHE.set(key, names);
  return names;
}

/** نام ماه فعال — اندیس ۱ تا ۱۲ */
export function monthLabel(m: number): string {
  return calendarMonthNames()[m] ?? JALALI_MONTHS[m - 1] ?? "";
}

/** ماه‌های شمسی — ثابت تاریخی (سازگاری) */
export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

/** اجزای کامل تقویم فعال */
export function jalaliFull(date: Date = new Date()): { y: number; m: number; d: number; monthName: string } {
  const { y, m, d } = calendarParts(date);
  return { y, m, d, monthName: monthLabel(m) };
}

// جابه‌جایی تقریبی سال تقویم‌ها نسبت به میلادی (برای تخمین اولیه جست‌وجو)
const CAL_OFFSETS: Record<string, number> = {
  persian: 621,
  gregory: 0,
  "islamic-umalqura": 579,
  "islamic-civil": 579,
  "islamic-tbla": 579,
  hebrew: -3761,
  ethiopic: -8,
  coptic: -284,
  indian: 79,
  buddhist: -543,
  chinese: 0,
  dangi: 0,
  japanese: 0,
};

/**
 * تبدیل تاریخ تقویم فعال به Date — با تطبیق روی تقویم Intl
 * (پایدار، بدون الگوریتم دستی، برای همه تقویم‌های پشتیبانی‌شده).
 * ساعت به ۱۲:۰۰ UTC تنظیم می‌شود تا در هر منطقه‌زمانی همان روز بماند.
 */
export function calendarToDate(y: number, m: number, d: number, calendar?: CalendarKind): Date {
  const cal = calendar ?? getCountrySync().calendar;
  if (cal === "gregory") {
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    return Number.isNaN(dt.getTime()) ? new Date() : dt;
  }
  const offset = CAL_OFFSETS[cal] ?? 621;
  let cursor = new Date(Date.UTC(y + offset, Math.min(11, m - 1), Math.min(28, d), 12));
  for (let i = 0; i < 2000; i += 1) {
    const p = calendarParts(cursor, cal);
    if (p.y === y && p.m === m && p.d === d) return new Date(cursor.getTime());
    if (p.y > y || (p.y === y && (p.m > m || (p.m === m && p.d > d)))) {
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      cursor = new Date(cursor.getTime() + 86400000);
    }
  }
  return new Date(Date.UTC(y + offset, 2, 21, 12));
}

/** تبدیل تاریخ شمسی به Date — نام قدیمی (سازگاری) */
export function jalaliToDate(y: number, m: number, d: number): Date {
  return calendarToDate(y, m, d, "persian");
}

/** تاریخ خوانا برای ورودی: "1404/07/10" */
export function formatJalaliInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const { y, m, d: day } = calendarParts(d);
  return `${y}/${String(m).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

/** حدود سال مجاز ورودی بر اساس تقویم فعال */
function yearBounds(): [number, number] {
  switch (getCountrySync().calendar) {
    case "persian":
      return [1300, 1500];
    case "gregory":
      return [1900, 2100];
    case "islamic-umalqura":
    case "islamic-civil":
    case "islamic-tbla":
      return [1300, 1600];
    case "hebrew":
      return [5600, 5900];
    case "buddhist":
      return [2400, 2700];
    default:
      return [1000, 9999];
  }
}

/** تجزیه رشته "1404/07/10" در تقویم فعال (ارقام بومی هم پذیرفته می‌شود) */
export function parseJalaliInput(input: string): { y: number; m: number; d: number } | null {
  const clean = enDigits(input).replace(/[^0-9\/]/g, "");
  const parts = clean.split("/").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  const [y, m, d] = parts;
  const [yMin, yMax] = yearBounds();
  if (y < yMin || y > yMax || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** ساخت slug امن از نام — برای ساب‌دامین سایت مدرسه (حروف فارسی و لاتین) */
export function slugify(input: string): string {
  const map: Record<string, string> = {
    آ: "a", ا: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh",
    د: "d", ذ: "z", ر: "r", ز: "z", ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t",
    ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g", ل: "l", م: "m", ن: "n",
    و: "v", ه: "h", ی: "y", "ي": "y", "ئ": "y", " ": "-", "‌": "-", "ك": "k",
    "ç": "c", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ı": "i", "ə": "e", "ა": "a", "Ა": "a",
  };
  const latin = input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin && /^[a-z0-9-]/.test(latin)) return latin.slice(0, 40);
  // اگر نام کاملاً غیرلاتین بود — از کد استفاده می‌شود
  return "school";
}
