import { db } from "@/lib/db";

// ============================================================
// بهار | تنظیمات سامانه — ذخیره key/value JSON (سوپرادمین)
// ============================================================

export type BaharSettings = {
  siteTitle: string;
  siteTagline: string;
  supportPhone: string;
  supportEmail: string;
  salesPhone: string;
  salesTelegram: string;
  salesInstagram: string;
  demoEnabled: boolean;
  demoManagerNationalId: string;
  demoStudentNationalId: string;
  demoManagerPassword: string;
  demoStudentPassword: string;
  androidAppUrl: string; // لینک فایل APK (آپلودشده از پنل)
  windowsAppUrl: string; // لینک فایل ویندوز (آپلودشده از پنل)
  autoBackupDays: number; // دوره بکاپ خودکار (۳۰ روز)
  sessionDays: number;
  loginMaxAttempts: number;
  shadGatewayUrl: string;
  mainHost: string; // دامنه اصلی (اطلاعاتی)
  telegramBotToken: string; // توکن ربات تلگرام از BotFather
  telegramBotEnabled: boolean;
  logoUrl: string; // لوگوی سرویس (سوپرادمین)
  logotypeUrl: string; // لوگوتایپ متن
  faviconUrl: string; // فاوآیکون سفارشی
  maintenanceMode: boolean; // حالت تعمیراتی
  maintenanceMessage: string;
  featureFlags: Record<string, boolean>; // فعال/غیرفعال‌کردن تدریجی قابلیت‌ها
  countryPackCode: string; // کد بسته کشور فعال (دیفالت IR — ایران)
  require2faRoles: string[]; // نقش‌هایی که 2FA برایشان "توصیه اجباری" است (هشدار در ورود)
  // ── ورود دومرحله‌ای با کد یکبارمصرف (راند ۱۸) — دیفالت خاموش ──
  otpEnabled: boolean;
  otpChannel: "email" | "sms";
  otpTestMode: boolean; // حالت تست: کد در پاسخ API برمی‌گردد (بدون سرویس ارسال)
  otpEmailApiUrl: string; // سرویس ایمیل Resend-سازگار — POST JSON + Bearer
  otpEmailApiKey: string;
  otpEmailFrom: string;
  otpSmsApiUrl: string; // سرویس پیامک — POST JSON {to, text} + Bearer
  otpSmsApiKey: string;
  otpSmsSender: string;
};

export const DEFAULT_SETTINGS: BaharSettings = {
  siteTitle: "بهار — سامانه جامع مدیریت مدارس",
  siteTagline: "بهار کامل آموزش ایران؛ از ثبت‌نام تا کارنامه",
  supportPhone: "۰۲۱-۹۱۰۰۰۰۰۰",
  supportEmail: "support@bahar.school",
  salesPhone: "۰۹۱۲-۰۰۰-۰۰۰۰",
  salesTelegram: "https://t.me/bahar_school",
  salesInstagram: "https://instagram.com/bahar.school",
  demoEnabled: false,
  demoManagerNationalId: "2000000010",
  demoStudentNationalId: "5000000013",
  demoManagerPassword: "",
  demoStudentPassword: "",
  androidAppUrl: "",
  windowsAppUrl: "",
  autoBackupDays: 30,
  sessionDays: 14,
  loginMaxAttempts: 5,
  shadGatewayUrl: "http://127.0.0.1:8787",
  mainHost: "",
  telegramBotToken: "",
  telegramBotEnabled: false,
  logoUrl: "",
  logotypeUrl: "",
  faviconUrl: "",
  maintenanceMode: false,
  maintenanceMessage: "سامانه در حال به‌روزرسانی است؛ به‌زودی برمی‌گردیم.",
  featureFlags: {},
  countryPackCode: "IR",
  require2faRoles: ["MANAGER", "SUPER_ADMIN", "ADMIN"],
  otpEnabled: false,
  otpChannel: "email",
  otpTestMode: false,
  otpEmailApiUrl: "",
  otpEmailApiKey: "",
  otpEmailFrom: "",
  otpSmsApiUrl: "",
  otpSmsApiKey: "",
  otpSmsSender: "",
};

const SETTINGS_KEY = "system";

export async function getSettings(): Promise<BaharSettings> {
  try {
    const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
    if (!row) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(row.value) as Partial<BaharSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<BaharSettings>): Promise<BaharSettings> {
  const current = await getSettings();
  const next: BaharSettings = { ...current, ...patch };
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(next) },
  });
  return next;
}
