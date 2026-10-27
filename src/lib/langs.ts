// ============================================================
// بهار | کاتالوگ زبان (Bahar Language Catalog)
// کلیدهای قابل‌ترجمه بسته‌های زبان کاستوم + متن فارسی پایه
// ============================================================
// ساختار کلیدها: DOMAIN_KEY
// هر کلیدی که در بسته زبان تعریف نشده باشد → متن فارسی پایه (fallback)

export type LangDirection = "rtl" | "ltr";

export interface LanguagePackMeta {
  code: string;
  name: string;
  nativeName: string;
  direction: LangDirection;
  author?: string;
  version?: string;
  notes?: string;
}

export interface LanguagePack extends LanguagePackMeta {
  strings: Record<string, string>;
}

/** کاتالوگ کامل کلیدهای قابل‌ترجمه (با متن فارسی پایه) */
export const CATALOG: Record<string, string> = {
  // ---------- پوسته اپ (Shell) ----------
  "shell.dashboard": "داشبورد",
  "shell.home": "خانه",
  "shell.menu": "منو",
  "shell.more": "بیشتر",
  "shell.search": "جستجو",
  "shell.search.placeholder": "جستجوی سراسری…",
  "shell.search.empty": "چیزی یافت نشد",
  "shell.notifications": "اعلان‌ها",
  "shell.notifications.empty": "اعلانی ندارید",
  "shell.notifications.markAll": "علامت‌گذاری همه به‌عنوان خوانده‌شده",
  "shell.collapse": "جمع کردن نوار کنار",
  "shell.expand": "باز کردن نوار کنار",
  "shell.logout": "خروج از حساب",
  "shell.profile": "پروفایل",
  "shell.settings": "تنظیمات",
  "shell.plan.free": "پلن رایگان",
  "shell.plan.daysLeft": "روز باقی‌مانده",
  "shell.plan.expired": "اشتراک منقضی شده",
  "shell.mustChange.title": "تغییر رمز عبور الزامی است",
  "shell.mustChange.action": "همین حالا تغییر دهید",
  "shell.impersonating": "در حال مشاهده به‌عنوان کاربر دیگر (فقط‌خواندنی)",
  "shell.impersonating.exit": "بازگشت به حساب اصلی",
  "shell.online": "آنلاین",
  "shell.offline": "آفلاین",
  "shell.language": "زبان",

  // ---------- ناوبری ماژول‌ها ----------
  "nav.schools": "مدارس",
  "nav.users": "کاربران",
  "nav.students": "دانش‌آموزان",
  "nav.classes": "کلاس‌ها",
  "nav.subjects": "درس‌ها",
  "nav.schedule": "برنامه هفتگی",
  "nav.attendance": "حضور و غیاب",
  "nav.grades": "نمرات",
  "nav.assignments": "تکالیف",
  "nav.tasks": "تسک‌ها و اقدامات",
  "nav.behavior": "انضباط و رفتار",
  "nav.badges": "بج‌ها و افتخارات",
  "nav.insights": "بینش‌ها و هشدار زودهنگام",
  "nav.wellbeing": "سلامت روان",
  "nav.questionBank": "بانک سوال",
  "nav.library": "کتابخانه",
  "nav.quizzes": "آزمون آنلاین",
  "nav.idCards": "کارت شناسایی",
  "nav.substitutions": "جایگزینی معلم",
  "nav.virtualSessions": "کلاس مجازی",
  "nav.seating": "چیدمان صندلی",
  "nav.reportComments": "کامنت کارنامه",
  "nav.clubs": "باشگاه‌ها",
  "nav.meals": "برنامه غذایی",
  "nav.wallet": "بوفه و کیف پول",
  "nav.portfolio": "پورتفولیو",
  "nav.admissions": "قیف پذیرش",
  "nav.preschool": "پیش‌دبستانی",
  "nav.health": "بهداشت و درمانگاه",
  "nav.lessonPlans": "طرح درس",
  "nav.network": "داشبورد شبکه",
  "nav.localeSettings": "پروفایل کشور",
  "nav.exams": "امتحانات",
  "nav.descriptiveReport": "کارنامه توصیفی",
  "nav.payroll": "حقوق و فیش",
  "nav.sms": "پنل پیامک",
  "nav.rollover": "بستن سال تحصیلی",
  "nav.transport": "سرویس مدرسه",
  "nav.gatePasses": "مجوز خروج",
  "nav.alumni": "فارغ‌التحصیلان",
  "nav.forms": "فرم‌ها و رضایت‌نامه‌ها",
  "nav.staffAttendance": "حضور و غیاب کارکنان",
  "nav.resources": "منابع آموزشی",
  "nav.automation": "اتوماسیون",
  "nav.facilities": "امکانات و اموال",
  "nav.engagement": "نظرسنجی و پیشنهاد",
  "nav.certificates": "گواهی‌ها",
  "nav.reports": "گزارش‌ها و داده",
  "nav.finance": "امور مالی",
  "nav.meetings": "ملاقات‌ها",
  "nav.leaves": "مرخصی‌ها",
  "nav.events": "رویدادها",
  "nav.announcements": "اعلان‌ها",
  "nav.leads": "پیش‌ثبت‌نام‌ها",
  "nav.website": "سایت مدرسه",
  "nav.messages": "پیام‌ها",
  "nav.shad": "شاد",
  "nav.tickets": "پشتیبانی",
  "nav.approvals": "تایید تغییرات",
  "nav.audit": "گزارش فعالیت",
  "nav.blog": "بلاگ",
  "nav.children": "فرزندان من",

  // ---------- عملیات عمومی ----------
  "common.save": "ذخیره",
  "common.saving": "در حال ذخیره…",
  "common.cancel": "انصراف",
  "common.delete": "حذف",
  "common.edit": "ویرایش",
  "common.add": "افزودن",
  "common.create": "ایجاد",
  "common.update": "به‌روزرسانی",
  "common.search": "جستجو",
  "common.filter": "فیلتر",
  "common.clear": "پاک‌سازی",
  "common.confirm": "تایید",
  "common.close": "بستن",
  "common.back": "بازگشت",
  "common.next": "بعدی",
  "common.previous": "قبلی",
  "common.loading": "در حال بارگذاری…",
  "common.retry": "تلاش دوباره",
  "common.yes": "بله",
  "common.no": "خیر",
  "common.all": "همه",
  "common.none": "هیچ",
  "common.empty": "موردی ثبت نشده است",
  "common.error": "خطایی رخ داد",
  "common.error.load": "بارگذاری ناموفق بود",
  "common.success": "با موفقیت انجام شد",
  "common.deleted": "با موفقیت حذف شد",
  "common.saved": "با موفقیت ذخیره شد",
  "common.updated": "با موفقیت به‌روزرسانی شد",
  "common.copy": "کپی",
  "common.copied": "کپی شد",
  "common.download": "دانلود",
  "common.upload": "بارگذاری",
  "common.print": "چاپ",
  "common.export": "خروجی",
  "common.import": "ورودی",
  "common.refresh": "به‌روزرسانی",
  "common.more": "بیشتر",
  "common.details": "جزئیات",
  "common.status": "وضعیت",
  "common.actions": "عملیات",
  "common.date": "تاریخ",
  "common.time": "ساعت",
  "common.name": "نام",
  "common.description": "توضیحات",
  "common.active": "فعال",
  "common.inactive": "غیرفعال",
  "common.total": "مجموع",
  "common.from": "از",
  "common.to": "تا",
  "common.role": "نقش",
  "common.class": "کلاس",
  "common.school": "مدرسه",
  "common.teacher": "معلم",
  "common.student": "دانش‌آموز",
  "common.parent": "والد",
  "common.manager": "مدیر",
  "common.deputy": "معاون",
  "common.selected": "انتخاب‌شده",
  "common.selectAll": "انتخاب همه",

  // ---------- ورود / احراز هویت ----------
  "auth.login.title": "ورود به بهار",
  "auth.login.username": "کد ملی (نام کاربری)",
  "auth.login.password": "رمز عبور",
  "auth.login.submit": "ورود",
  "auth.login.loading": "در حال ورود…",
  "auth.login.error.invalid": "کد ملی یا رمز عبور نادرست است",
  "auth.login.error.locked": "حساب شما موقتاً قفل شده است. کمی بعد تلاش کنید",
  "auth.login.error.nationalId": "کد ملی باید ۱۰ رقم باشد",
  "auth.login.error.password": "رمز عبور را وارد کنید",
  "auth.login.back": "بازگشت به صفحه اصلی",
  "auth.login.hint": "نام کاربری همه کاربران «کد ملی» است و رمز عبور به‌صورت تصادفی ساخته و از طریق پیام‌رسان شاد ارسال می‌شود",
  "auth.changePassword.title": "تغییر رمز عبور",
  "auth.changePassword.current": "رمز عبور فعلی",
  "auth.changePassword.new": "رمز عبور جدید",
  "auth.changePassword.confirm": "تکرار رمز عبور جدید",
  "auth.changePassword.submit": "تغییر رمز",
  "auth.logout.done": "با موفقیت خارج شدید",

  // ---------- داشبورد ----------
  "dashboard.title": "داشبورد",
  "dashboard.welcome": "خوش آمدید",
  "dashboard.todayAbsents": "غایبان امروز",
  "dashboard.healthScore": "امتیاز سلامت مدرسه",
  "dashboard.riskStudents": "دانش‌آموزان در معرض خطر",
  "dashboard.todayClasses": "زنگ‌های امروز",
  "dashboard.quickActions": "اقدامات سریع",
  "dashboard.whatChanged": "چه تغییری کرده؟",
  "dashboard.birthdays": "تولدهای نزدیک",
  "dashboard.viewAll": "مشاهده همه",
  "dashboard.avgGrade": "میانگین نمرات",
  "dashboard.attendanceRate": "نرخ حضور",
  "dashboard.activeStudents": "دانش‌آموزان فعال",

  // ---------- زبان‌ها (بخش خودِ سیستم زبان) ----------
  "lang.title": "زبان‌ها و ترجمه",
  "lang.active": "زبان فعال",
  "lang.switch": "تغییر زبان",
  "lang.persian": "فارسی",
  "lang.custom": "زبان کاستوم",

  // ---------- تنظیمات ----------
  "settings.title": "تنظیمات",
  "settings.general": "عمومی",
  "settings.security": "امنیت",
  "settings.branding": "هویت بصری",
  "settings.languages": "زبان‌ها",
  "settings.backup": "پشتیبان‌گیری",
  "settings.telegram": "تلگرام",
  "settings.saved": "تنظیمات ذخیره شد",
};

/** کلیدهای مجاز — برای اعتبارسنجی بسته زبان */
export const CATALOG_KEYS = Object.keys(CATALOG);

/** اعتبارسنجی بسته زبان — خروجی: خطاها + هشدارها + آمار */
export function validateLanguagePack(input: {
  code?: unknown;
  name?: unknown;
  nativeName?: unknown;
  direction?: unknown;
  author?: unknown;
  version?: unknown;
  notes?: unknown;
  strings?: unknown;
}): { ok: boolean; errors: string[]; warnings: string[]; stats: { keyCount: number; coverage: number; unknownKeys: string[] } } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof input.code !== "string" || !/^[a-z][a-z0-9-]{1,14}$/i.test(input.code.trim())) {
    errors.push("کد زبان نامعتبر است — ۲ تا ۱۵ حرف/عدد/خط تیره (مثل en، tr، kurdish-sorani)");
  }
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 60) {
    errors.push("نام زبان (فارسی) لازم است — ۲ تا ۶۰ نویسه");
  }
  if (typeof input.nativeName !== "string" || input.nativeName.trim().length < 1 || input.nativeName.trim().length > 60) {
    errors.push("نام بومی زبان لازم است — ۱ تا ۶۰ نویسه");
  }
  if (input.direction !== "rtl" && input.direction !== "ltr") {
    errors.push('جهت متن باید "rtl" یا "ltr" باشد');
  }
  if (input.strings === undefined || input.strings === null || typeof input.strings !== "object" || Array.isArray(input.strings)) {
    errors.push('فیلد "strings" باید یک شیء JSON از کلید→متن باشد');
    return { ok: false, errors, warnings, stats: { keyCount: 0, coverage: 0, unknownKeys: [] } };
  }

  const strings = input.strings as Record<string, unknown>;
  const unknownKeys: string[] = [];
  let keyCount = 0;

  for (const [key, value] of Object.entries(strings)) {
    if (!CATALOG_KEYS.includes(key)) {
      unknownKeys.push(key);
      continue; // کلید ناشناخته — هشدار می‌گیرد ولی رد نمی‌شود
    }
    if (typeof value !== "string") {
      errors.push(`مقدار کلید «${key}» باید متن (رشته) باشد`);
      continue;
    }
    if (value.length > 300) {
      errors.push(`مقدار کلید «${key}» بیش از حد بلند است (حداکثر ۳۰۰ نویسه)`);
      continue;
    }
    if (/<script|javascript:|on\w+\s*=/i.test(value)) {
      errors.push(`مقدار کلید «${key}» شامل کد/اسکریپت مجاز نیست`);
      continue;
    }
    keyCount++;
  }

  if (unknownKeys.length > 0) {
    warnings.push(`${unknownKeys.length} کلید ناشناخته نادیده گرفته می‌شود: ${unknownKeys.slice(0, 5).join("، ")}${unknownKeys.length > 5 ? "…" : ""}`);
  }
  if (keyCount === 0) {
    errors.push("هیچ کلید معتبری از کاتالوگ ترجمه نشده است");
  }
  const missing = CATALOG_KEYS.length - keyCount;
  if (missing > 0) {
    warnings.push(`${missing} کلید ترجمه نشده و به فارسی بازمی‌گردد (fallback)`);
  }

  const coverage = Math.round((keyCount / CATALOG_KEYS.length) * 100);
  return { ok: errors.length === 0, errors, warnings, stats: { keyCount, coverage, unknownKeys } };
}

/** محدودیت حجم JSON بسته زبان */
export const LANG_PACK_MAX_BYTES = 400 * 1024; // ۴۰۰KB
