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
  "nav.study": "برنامه مطالعه",
  "nav.guidance": "هدایت تحصیلی",
  "nav.fame": "دیوار افتخار",
  "nav.tv": "تابلوی مدرسه",
  "nav.yearbook": "کتاب سال",
  "nav.clubs": "باشگاه‌ها",
  "nav.meals": "برنامه غذایی",
  "nav.wallet": "بوفه و کیف پول",
  "nav.portfolio": "پورتفولیو",
  "nav.admissions": "قیف پذیرش",
  "nav.preschool": "پیش‌دبستانی",
  "nav.health": "سلامت جسمانی و درمانگاه",
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
  "nav.dormitory": "خوابگاه",
  "nav.mcp": "سرور MCP",
  "nav.accessibility": "دسترس‌پذیری",
  "nav.countries": "بسته‌های کشور",
  "nav.labs": "آزمایشگاه‌ها",
  "nav.tracks": "مسیرهای تخصصی",
  "nav.plugins": "افزونه‌ها",
  "nav.languages": "زبان‌ها و پوشش ترجمه",

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

/** کاتالوگ جملات سایت عمومی (لندینگ + سربرگ/پاصفحهٔ عمومی + عنوان گام‌های کیت‌ها)
    با متن فارسی پایه. توجه: پاسخ‌های بلند FAQ، متن‌های راهنمای کیت‌ها و
    محتوای بلاگ «محتوا» هستند نه جملهٔ رابط کاربری، و فارسی می‌مانند. */
export const SITE_CATALOG: Record<string, string> = {
  // ---------- سربرگ و برند ----------
  "site.brand.tagline": "سامانه مدیریت مدرسه",
  "site.nav.features": "امکانات",
  "site.nav.roles": "نقش‌ها",
  "site.nav.blog": "بلاگ",
  "site.nav.faq": "سوالات متداول",
  "site.nav.menu": "منو",
  "site.login": "ورود",
  "site.panel": "ورود به پنل",
  "site.account": "ورود به حساب",
  "site.lang": "زبان",
  "site.intro": "معرفی بهار",
  "site.langKit": "کیت ساخت زبان",
  "site.blogTitle": "بلاگ بهار",
  // ---------- هیرو ----------
  "site.hero.badge": "یک حساب · سه پلتفرم",
  "site.hero.title": "مدرسه‌ات را مثل بهار، شکوفا کن",
  "site.hero.sub": "سامانه یکپارچه مدیریت مدرسه: دانش‌آموزان و اولیا، معلمان و معاونین، کلاس‌ها، نمرات، حضور و غیاب، رویدادها و پیام‌رسان داخلی — همه در یک جای امن و سریع.",
  "site.hero.web": "وب",
  "site.hero.android": "اندروید",
  "site.hero.windows": "ویندوز",
  "site.hero.imgAlt": "کلاس درخشان مدرسه با نور بهاری",
  // ---------- کاشی‌های امکانات ----------
  "site.feat.web.t": "وب",
  "site.feat.web.d": "پنل کامل در مرورگر",
  "site.feat.android.t": "اندروید",
  "site.feat.android.d": "نصب از وب، تجربه اپ",
  "site.feat.windows.t": "ویندوز",
  "site.feat.windows.d": "نصب روی دسکتاپ",
  "site.feat.security.t": "امنیت",
  "site.feat.security.d": "کد ملی + رمز تصادفی",
  // ---------- کارت‌های تصویری ----------
  "site.show.manager.kicker": "برای مدیر مدرسه",
  "site.show.manager.title": "کنترل کامل، یک نگاه",
  "site.show.manager.desc": "داشبورد زنده مدرسه، تعیین دسترسی معاون و معلم، ساخت حساب کاربران و ارسال رمز با شاد.",
  "site.show.manager.descNoShad": "داشبورد زنده مدرسه، تعیین دسترسی معاون و معلم و ساخت حساب کاربران.",
  "site.show.manager.alt": "مدیر مدرسه در حال بررسی داشبورد بهار",
  "site.show.parent.kicker": "برای اولیا",
  "site.show.parent.title": "کارنامه فرزند، همیشه همراه",
  "site.show.parent.desc": "نمرات، کارنامه ماهانه، حضور و غیاب، تکالیف و رویدادها — در نسخه موبایل، هر لحظه در جیب شما.",
  "site.show.parent.alt": "ولی دانش‌آموز در حال مشاهده کارنامه در بهار",
  // ---------- نقش‌ها ----------
  "site.roles.heading": "هر نقش، به اندازه‌ی خودش",
  "site.roles.sub": "دسترسی دانش‌آموز و ولی فقط به اندازه نیاز است؛ دسترسی معاون و معلم را مدیر مدرسه تعیین می‌کند و مدیریت کل سرویس بر عهده ادمین سرویس است.",
  "site.role.admin.t": "ادمین سرویس",
  "site.role.admin.c1": "مدیریت کل سرویس و همه مدارس",
  "site.role.admin.c2": "بکاپ و ایمنی سامانه",
  "site.role.admin.c3": "بلاگ، تیکت‌ها و ادمین‌های سرویس",
  "site.role.manager.t": "مدیر مدرسه",
  "site.role.manager.c1": "مدیریت معلمان، دانش‌آموزان و کلاس‌ها",
  "site.role.manager.c2": "معاونین، رویدادها و اعلان‌ها",
  "site.role.manager.c3": "تعیین دسترسی معاون و معلم",
  "site.role.manager.c4": "ارسال رمز کاربران با شاد",
  "site.role.deputy.t": "معاون",
  "site.role.deputy.c1": "دسترسی‌ها توسط مدیر تعیین می‌شود",
  "site.role.deputy.c2": "نمرات، حضورغیاب، رویداد و…",
  "site.role.deputy.c3": "بر اساس مجوزهای دریافتی",
  "site.role.teacher.t": "معلم",
  "site.role.teacher.c1": "ثبت نمرات و حضورغیاب کلاس‌ها",
  "site.role.teacher.c2": "تکالیف و پیام به اولیا",
  "site.role.teacher.c3": "برنامه هفتگی شخصی",
  "site.role.student.t": "دانش‌آموز",
  "site.role.student.c1": "نمرات و کارنامه من",
  "site.role.student.c2": "کارنامه ماهانه و برنامه کلاسم",
  "site.role.student.c3": "پیام به معلمان و مدیر",
  "site.role.parent.t": "ولی",
  "site.role.parent.c1": "کارنامه و غیبت فرزند",
  "site.role.parent.c2": "رویدادها و اطلاعیه‌ها",
  "site.role.parent.c3": "ارتباط با معلم و مدیر",
  // ---------- ماژول‌ها ----------
  "site.modules.heading": "کامل‌ترین سامانه مدیریت مدرسه",
  "site.modules.sub": "۱۶ ماژول به‌هم‌پیوسته، از پرونده دانش‌آموز تا سایت اختصاصی مدرسه",
  "site.mod.students.t": "دانش‌آموزان و اولیا",
  "site.mod.students.d": "پرونده کامل با اطلاعات اولیا",
  "site.mod.teachers.t": "معلمان و معاونین",
  "site.mod.teachers.d": "دسترسی‌سنجی دقیق توسط مدیر",
  "site.mod.classes.t": "کلاس‌ها و درس‌ها",
  "site.mod.classes.d": "مدیریت پایه، رشته و تخصیص معلم",
  "site.mod.schedule.t": "برنامه هفتگی",
  "site.mod.schedule.d": "چیدمان زنگ‌ها و معلم‌ها",
  "site.mod.attendance.t": "حضور و غیاب",
  "site.mod.attendance.d": "ثبت روزانه و گزارش غیبت",
  "site.mod.grades.t": "نمرات و کارنامه",
  "site.mod.grades.d": "دفتر نمرات و میانگین‌ها",
  "site.mod.monthly.t": "کارنامه ماهانه",
  "site.mod.monthly.d": "خلاصه عملکرد هر ماه به تفکیک",
  "site.mod.assignments.t": "تکالیف",
  "site.mod.assignments.d": "ایجاد و پیگیری مهلت‌ها",
  "site.mod.events.t": "رویدادها",
  "site.mod.events.d": "جلسات، امتحان، گردش علمی",
  "site.mod.notices.t": "اطلاعیه هدفمند",
  "site.mod.notices.d": "بر اساس نقش و نقشه ایران",
  "site.mod.messenger.t": "پیام‌رسان داخلی",
  "site.mod.messenger.d": "کوتاه و سبک داخل مدرسه",
  "site.mod.shad.t": "ارسال با شاد",
  "site.mod.shad.d": "ارسال رمز و اطلاع‌رسانی",
  "site.mod.backup.t": "بکاپ خودکار ماهانه",
  "site.mod.backup.d": "پشتیبان‌گیری کامل و بازیابی سریع",
  "site.mod.site.t": "سایت مدرسه",
  "site.mod.site.d": "۱۶ تمپلیت آماده با آدرس اختصاصی",
  "site.mod.map.t": "نقشه ایران",
  "site.mod.map.d": "انتخاب استان و شهرستان روی نقشه",
  "site.mod.finance.t": "شهریه و مالی",
  "site.mod.finance.d": "پیگیری پرداخت دانش‌آموزان",
  "site.mod.support.t": "تیکت پشتیبانی",
  "site.mod.support.d": "پاسخ مستقیم تیم بهار",
  // ---------- سوالات متداول (فقط پرسش‌ها؛ پاسخ‌های بلند فارسی می‌مانند) ----------
  "site.faq.heading": "سوالات متداول",
  "site.faq.q1": "چطور وارد حسابم می‌شوم؟",
  "site.faq.q2": "رمزم را فراموش کردم، چه کار کنم؟",
  "site.faq.q3": "چرا پیام‌رسان بهار محدود است؟",
  "site.faq.q4": "بهار روی چه پلتفرم‌هایی کار می‌کند؟",
  "site.faq.q5": "رمز عبور تصادفی چقدر امن است؟",
  "site.faq.q6": "اطلاعات دانش‌آموز و ولی در پرونده چه چیزهایی است؟",
  "site.faq.q7": "دسترسی معاون و معلم چگونه تعیین می‌شود؟",
  "site.faq.q8": "ارسال رمز با شاد چگونه انجام می‌شود؟",
  "site.faq.q9": "آیا امکان نصب نسخه اندروید به‌صورت APK وجود دارد؟",
  "site.faq.q10": "کارنامه ماهانه چیست؟",
  // ---------- فراخوان ----------
  "site.cta.heading": "آماده شکوفایی مدرسه‌تان هستید؟",
  "site.cta.sub": "همهٔ قابلیت‌ها و حساب دمو را در یک صفحه ببینید؛ سپس مدرسه‌تان را به بهار تبدیل کنید — از ثبت نمره تا کارنامه، از حضور و غیاب تا اطلاع‌رسانی.",
  // ---------- پاصفحه ----------
  "site.footer.about": "سامانه جامع مدیریت مدرسه — وب، اندروید و ویندوز؛ با زبان طراحی متا و رنگ‌های اختصاصی بهار.",
  "site.footer.modules": "ماژول‌ها",
  "site.footer.roles": "نقش‌ها",
  "site.footer.links": "لینک‌ها",
  "site.footer.platforms": "پلتفرم‌ها",
  "site.footer.r3": "معاون و معلم",
  "site.footer.r4": "دانش‌آموز و ولی",
  "site.footer.p1": "نسخه وب",
  "site.footer.bottom": "بهار · سامانه مدیریت مدرسه",
  "site.footer.logoAlt": "لوگوی بهار",
  // ---------- عنوان گام‌های کیت‌ها (فقط عنوان؛ شرح گام‌ها مستندات فارسی می‌مانند) ----------
  "site.kit.countries.s1": "۱) دانلود قالب (نسخه ایران)",
  "site.kit.countries.s2": "۲) مطالعه راهنمای فیلدها",
  "site.kit.countries.s3": "۳) آماده‌سازی مناطق و نقشه",
  "site.kit.countries.s4": "۴) بارگذاری و اعتبارسنجی",
  "site.kit.countries.s5": "۵) فعال‌سازی",
  "site.kit.languages.s1": "۱) دانلود تمپلیت",
  "site.kit.languages.s2": "۲) ترجمه کلیدها",
  "site.kit.languages.s3": "۳) تکمیل مشخصات",
  "site.kit.languages.s4": "۴) بارگذاری در پنل",
  "site.kit.languages.s5": "۵) فعال‌سازی برای همه",
};

export const SITE_KEYS = Object.keys(SITE_CATALOG);

/** اعتبارسنجی جملات سایت یک بسته — قوانین مشابه بستهٔ اپ (متن ≤ ۳۰۰ نویسه، بدون اسکریپت). */
export function validateSitePack(input: { siteStrings?: unknown }): { ok: boolean; errors: string[]; warnings: string[]; stats: { keyCount: number; coverage: number; unknownKeys: string[] } } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const strings = input.siteStrings;
  if (strings === undefined || strings === null || typeof strings !== "object" || Array.isArray(strings)) {
    return { ok: false, errors: ["فیلد «siteStrings» باید یک شیء JSON از کلید→متن باشد"], warnings, stats: { keyCount: 0, coverage: 0, unknownKeys: [] } };
  }
  const unknownKeys: string[] = [];
  let keyCount = 0;
  for (const [key, value] of Object.entries(strings as Record<string, unknown>)) {
    if (!SITE_KEYS.includes(key)) { unknownKeys.push(key); continue; }
    if (typeof value !== "string") { errors.push(`مقدار کلید سایت «${key}» باید متن باشد`); continue; }
    if (value.length > 300) { errors.push(`مقدار کلید سایت «${key}» بیش از حد بلند است (حداکثر ۳۰۰ نویسه)`); continue; }
    if (/<script|javascript:|on\w+\s*=/i.test(value)) { errors.push(`مقدار کلید سایت «${key}» شامل کد/اسکریپت مجاز نیست`); continue; }
    keyCount++;
  }
  if (unknownKeys.length > 0) warnings.push(`${unknownKeys.length} کلید سایت ناشناخته نادیده گرفته می‌شود: ${unknownKeys.slice(0, 5).join("، ")}${unknownKeys.length > 5 ? "…" : ""}`);
  const missing = SITE_KEYS.length - keyCount;
  if (missing > 0) warnings.push(`${missing} جملهٔ سایت ترجمه نشده و به فارسی بازمی‌گردد (fallback)`);
  const coverage = Math.round((keyCount / SITE_KEYS.length) * 100);
  return { ok: errors.length === 0, errors, warnings, stats: { keyCount, coverage, unknownKeys } };
}

/** محدودیت حجم JSON بسته زبان */
export const LANG_PACK_MAX_BYTES = 400 * 1024; // ۴۰۰KB