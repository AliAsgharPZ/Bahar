// بهار | نقش‌ها و کاتالوگ دسترسی‌ها (مدرسه‌ای + ریز ادمین سرویس)
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  DEPUTY: "DEPUTY",
  TEACHER: "TEACHER",
  CUSTODIAN: "CUSTODIAN",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "مدیر کل سامانه",
  ADMIN: "ادمین سرویس",
  MANAGER: "مدیر مدرسه",
  DEPUTY: "معاون",
  TEACHER: "معلم",
  CUSTODIAN: "سرایدار",
  STUDENT: "دانش‌آموز",
  PARENT: "ولی",
};

export const ROLE_ORDER: string[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "DEPUTY",
  "TEACHER",
  "CUSTODIAN",
  "STUDENT",
  "PARENT",
];

/** دسترسی‌های ریز مدرسه‌ای که مدیر به معاون/معلم می‌دهد */
export const PERMISSION_CATALOG = [
  { key: "manage_students", label: "مدیریت دانش‌آموزان", desc: "افزودن، ویرایش و مشاهده دانش‌آموزان" },
  { key: "manage_teachers", label: "مدیریت معلمان", desc: "مشاهده و ویرایش اطلاعات معلمان" },
  { key: "manage_classes", label: "مدیریت کلاس‌ها", desc: "ایجاد و ویرایش کلاس‌ها" },
  { key: "manage_subjects", label: "مدیریت درس‌ها", desc: "ایجاد و ویرایش دروس" },
  { key: "manage_schedule", label: "برنامه هفتگی", desc: "چیدمان برنامه کلاس‌ها" },
  { key: "enter_grades", label: "ثبت نمرات", desc: "ثبت و ویرایش نمرات دانش‌آموزان" },
  { key: "unlock_grades", label: "بازکردن نمره قفل‌شده", desc: "ویرایش نمرات نهایی‌شده پس از قفل کارنامه" },
  { key: "take_attendance", label: "حضور و غیاب", desc: "ثبت حضور و غیاب روزانه" },
  { key: "manage_assignments", label: "تکالیف", desc: "ایجاد و مدیریت تکالیف" },
  { key: "manage_events", label: "رویدادها", desc: "ایجاد رویداد و تقویم مدرسه" },
  { key: "manage_announcements", label: "اعلان‌ها", desc: "ارسال اطلاعیه به مدرسه" },
  { key: "view_school_reports", label: "گزارش‌های مدرسه", desc: "گزارش نمرات، حضور و آمار" },
  { key: "send_shad", label: "ارسال با شاد", desc: "ارسال پیام و رمز با شاد" },
  { key: "manage_finance", label: "امور مالی", desc: "ثبت شهریه و پیگیری پرداخت" },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]["key"];

export const DEFAULT_TEACHER_PERMISSIONS: string[] = [
  "take_attendance",
  "enter_grades",
  "manage_assignments",
];

export const DEFAULT_DEPUTY_PERMISSIONS: string[] = [
  "manage_students",
  "enter_grades",
  "take_attendance",
  "manage_events",
  "manage_announcements",
  "view_school_reports",
];

// ------------------------------------------------------------
// دسترسی‌های ریز «ادمین سرویس» — از کلی‌ترین تا جزئی‌ترین
// فقط سوپرادمین می‌تواند هنگام ساخت/ویرایش ادمین، این‌ها را
// روشن/خاموش کند؛ SUPER_ADMIN همیشه همه دسترسی‌ها را دارد.
// ------------------------------------------------------------
export type ServicePermGroup = {
  group: string;
  desc: string;
  items: { key: string; label: string; desc: string }[];
};

export const SERVICE_PERMISSION_GROUPS: ServicePermGroup[] = [
  {
    group: "مدیریت مدارس",
    desc: "دسترسی به چرخه کامل مدارس سرویس",
    items: [
      { key: "view_schools", label: "مشاهده مدارس", desc: "فهرست مدارس و آمار آنها" },
      { key: "create_schools", label: "ایجاد مدرسه", desc: "ثبت مدرسه جدید با مدیر" },
      { key: "edit_schools", label: "ویرایش مدرسه", desc: "ویرایش مشخصات، لوگو، شهرستان" },
      { key: "delete_schools", label: "حذف مدرسه", desc: "حذف کامل مدرسه و داده‌ها" },
      { key: "set_school_plan", label: "تعیین اشتراک", desc: "پلن برنز تا الماسی و تاریخ انقضا" },
      { key: "enter_school_panel", label: "ورود به پنل مدرسه", desc: "مدیریت درون‌مدرسه‌ای مثل مدیر" },
    ],
  },
  {
    group: "مدیریت کاربران",
    desc: "کاربران کل سرویس",
    items: [
      { key: "view_users", label: "مشاهده کاربران", desc: "فهرست همه کاربران سرویس" },
      { key: "create_users", label: "ساخت کاربر", desc: "ایجاد کاربر در هر مدرسه" },
      { key: "edit_users", label: "ویرایش کاربر", desc: "ویرایش همه مشخصات کاربران" },
      { key: "delete_users", label: "حذف کاربر", desc: "حذف کامل کاربر از سامانه" },
      { key: "reset_passwords", label: "بازنشانی رمز", desc: "ساخت رمز تصادفی جدید" },
      { key: "manage_admins", label: "مدیریت ادمین‌ها", desc: "ساخت/ویرایش ادمین سرویس (جز سطح دسترسی سوپرادمین)" },
    ],
  },
  {
    group: "اطلاعیه سراسری",
    desc: "پیام‌های سطح سرویس به همه مدارس",
    items: [
      { key: "platform_announcements", label: "ارسال اطلاعیه سراسری", desc: "هدف‌گیری بر اساس نقش و نقشه ایران" },
    ],
  },
  {
    group: "بلاگ سرویس",
    desc: "محتوای عمومی سایت",
    items: [
      { key: "manage_blog", label: "مدیریت بلاگ", desc: "نوشتن، انتشار و مدیریت پست‌ها و نظرات" },
    ],
  },
  {
    group: "پشتیبانی و تیکت",
    desc: "پاسخ به کاربران",
    items: [
      { key: "view_tickets", label: "مشاهده تیکت‌ها", desc: "دسترسی به صف پشتیبانی" },
      { key: "reply_tickets", label: "پاسخ تیکت", desc: "ارسال پیام در گفتگوی تیکت" },
      { key: "close_tickets", label: "بستن تیکت", desc: "تغییر وضعیت به بسته/باز" },
    ],
  },
  {
    group: "دروازه شاد",
    desc: "وضعیت اتصال مدارس",
    items: [
      { key: "view_shad", label: "مشاهده وضعیت شاد", desc: "دیدن نشست‌ها و صف ارسال" },
    ],
  },
  {
    group: "پشتیبان‌گیری",
    desc: "بکاپ کل سامانه",
    items: [
      { key: "manage_backups", label: "مدیریت بکاپ", desc: "ساخت، دانلود و بازیابی نسخه پشتیبان" },
    ],
  },
  {
    group: "تنظیمات و گزارش",
    desc: "قلب سرویس",
    items: [
      { key: "view_settings", label: "مشاهده تنظیمات", desc: "تنظیمات سامانه و زبان طراحی (فقط سوپرادمین ویرایش می‌کند)" },
      { key: "edit_settings", label: "ویرایش تنظیمات", desc: "تغییر تنظیمات سامانه (سوپرادمین یا ادمین مجاز)" },
      { key: "view_audit", label: "گزارش فعالیت", desc: "مشاهده رخدادهای ثبت‌شده" },
    ],
  },
];

export const ALL_SERVICE_PERMISSIONS: string[] = SERVICE_PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** مجموعه دسترسی پیش‌فرض ادمین سرویس جدید (بدون حساس‌ها) */
export const DEFAULT_ADMIN_PERMISSIONS: string[] = [
  "view_schools", "view_users", "view_tickets", "reply_tickets", "view_audit", "view_shad",
];

/** نقش‌های سطح سرویس (بدون مدرسه) */
export const SERVICE_ROLES: string[] = ["SUPER_ADMIN", "ADMIN"];
/** نقش‌های پرسنلی مدرسه */
export const STAFF_ROLES: string[] = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"];

export function parsePermissions(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * آیا کاربر دسترسی «مدرسه‌ای» یا «سرویسی» مدیریتی دارد؟
 * - SUPER_ADMIN: همه‌چیز
 * - MANAGER: همه دسترسی‌های مدرسه خودش
 * - DEPUTY/TEACHER: بر اساس آرایه permissions
 * - ADMIN: فقط دسترسی‌های سرویسی/مدرسه‌ای که به او داده شده
 */
export function hasPermission(
  user: { role: string; permissions?: string | string[] | null },
  key: string
): boolean {
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "MANAGER") {
    // مدیر مدرسه همه دسترسی‌های «مدرسه‌ای» را دارد؛
    // دسترسی‌های سرویسی (بلاگ، اعلان سراسری، مدیریت مدارس و…) فقط برای سوپرادمین/ادمین مجاز است.
    return PERMISSION_CATALOG.some((c) => c.key === key);
  }
  let perms: string[];
  if (Array.isArray(user.permissions)) perms = user.permissions;
  else perms = parsePermissions(user.permissions);
  return perms.includes(key);
}
