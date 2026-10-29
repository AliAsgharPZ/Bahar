// ============================================================
// بهار | فهرست تقویم‌های جهان — فقط تقویم‌هایی که در CALENDARS
// انتخابی‌اند (۱۵ تقویم). islamic-rgsa کلید Intl است ولی در ران‌تایم
// فعلی بی‌صدا به میلادی برمی‌گردد، پس انتخابی نیست. تقویم‌های
// تاریخی دیگر (ژولینی، نپالی بیکرام، کردی، مایا، …) در Intl نیستند
// و اگر به‌عنوان تقویم انتخابی اضافه شوند تبدیلشان حدسی می‌شود؛
// پس فقط اینجا مستند شده‌اند، نه انتخابی.
// ============================================================
import type { CalendarKind } from "./types";

export type CalendarInfo = {
  key: CalendarKind;
  fa: string;
  en: string;
  usedIn: string;
};

export const CALENDAR_CATALOG: CalendarInfo[] = [
  { key: "persian", fa: "هجری شمسی (جلالی)", en: "Persian (Jalali)", usedIn: "ایران، افغانستان" },
  { key: "gregory", fa: "میلادی", en: "Gregorian", usedIn: "بیشتر کشورهای جهان" },
  { key: "islamic", fa: "هجری قمری (عمومی)", en: "Islamic", usedIn: "کشورهای مسلمان" },
  { key: "islamic-umalqura", fa: "هجری قمری — ام‌القرا", en: "Islamic (Umm al-Qura)", usedIn: "عربستان سعودی" },
  { key: "islamic-civil", fa: "هجری قمری — مدنی", en: "Islamic (civil)", usedIn: "محاسباتی/مدنی" },
  { key: "islamic-tbla", fa: "هجری قمری — جدولی", en: "Islamic (tabular)", usedIn: "محاسباتی" },
  { key: "hebrew", fa: "عبری", en: "Hebrew", usedIn: "اسرائیل" },
  { key: "ethiopic", fa: "اتیوپیایی", en: "Ethiopic", usedIn: "اتیوپی" },
  { key: "ethioaa", fa: "اتیوپیایی — آمتی عالم", en: "Ethiopic (Amete Alem)", usedIn: "اتیوپی (کلیسایی)" },
  { key: "coptic", fa: "قبطی", en: "Coptic", usedIn: "مصر (کلیسای قبطی)" },
  { key: "indian", fa: "هندی (ساکا)", en: "Indian (Saka)", usedIn: "هند (رسمی)" },
  { key: "buddhist", fa: "بودیستی (تایلندی)", en: "Buddhist", usedIn: "تایلند" },
  { key: "chinese", fa: "چینی", en: "Chinese", usedIn: "چین، کره، ویتنام، ژاپن (سنتی)" },
  { key: "dangi", fa: "کره‌ای (دانگی)", en: "Korean (Dangi)", usedIn: "کره" },
  { key: "japanese", fa: "ژاپنی", en: "Japanese", usedIn: "ژاپن" },
  { key: "roc", fa: "مین‌گو (تایوان)", en: "Minguo (ROC)", usedIn: "تایوان" },
];

/** تقویم‌هایی که در Intl نیستند و به‌همین دلیل انتخابی نیستند — حدس ممنوع */
export const UNSUPPORTED_CALENDARS = [
  "هجری قمری RGSA — در ران‌تایم فعلی بی‌صدا به میلادی برمی‌گردد",
  "ژولینی (Julian)",
  "نپالی — بیکرام سامبات (Bikram Sambat)",
  "کردی",
  "مایا",
  "تبتی (محاسباتی کامل)",
  "ناناک‌شاهی",
  "فرانسوی انقلابی",
];
