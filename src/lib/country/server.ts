// ============================================================
// بهار | لایه سرور پروفایل کشور — بسته فعال از تنظیمات/دیتابیس
// getActiveCountry(): با کش ۳۰ ثانیه‌ای (سرور)
// تازه‌سازی: بوت (instrumentation) + sweep زمان‌بند + ذخیره تنظیمات
// ============================================================
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { IRAN_PROFILE } from "./iran";
import { setCountryCache, resetCountryCache, countryCacheAgeMs, getCountrySync } from "./cache";
import { validateCountryPack } from "./pack";
import type { CountryProfile } from "./types";

const TTL_MS = 30_000;

/** بسته فعال — دیفالت ایران؛ خطا هرگز به بیرون نشت نمی‌کند */
export async function getActiveCountry(): Promise<CountryProfile> {
  try {
    if (countryCacheAgeMs() < TTL_MS) return getCountrySync();

    const settings = await getSettings();
    const code = settings.countryPackCode?.trim().toUpperCase();
    if (!code || code === "IR") {
      resetCountryCache();
      return IRAN_PROFILE;
    }

    const row = await db.countryPack.findFirst({ where: { code, status: "ACTIVE" } });
    if (!row) {
      // بسته فعال حذف/غیرفعال شده → دیفالت ایران
      resetCountryCache();
      return IRAN_PROFILE;
    }

    const parsed = JSON.parse(row.data);
    const { profile } = validateCountryPack(parsed);
    if (profile) {
      setCountryCache(profile);
      return profile;
    }
    // بسته خراب → دیفالت امن ایران
    resetCountryCache();
    return IRAN_PROFILE;
  } catch {
    return IRAN_PROFILE;
  }
}

/** تازه‌سازی اجباری کش (بعد از فعال‌سازی/غیرفعال‌سازی بسته) */
export async function refreshCountryCache(): Promise<CountryProfile> {
  try {
    const settings = await getSettings();
    const code = settings.countryPackCode?.trim().toUpperCase();
    if (!code || code === "IR") {
      resetCountryCache();
      return IRAN_PROFILE;
    }
    const row = await db.countryPack.findFirst({ where: { code, status: "ACTIVE" } });
    if (!row) {
      resetCountryCache();
      return IRAN_PROFILE;
    }
    const { profile } = validateCountryPack(JSON.parse(row.data));
    if (profile) {
      setCountryCache(profile);
      return profile;
    }
  } catch { /* ignore */ }
  resetCountryCache();
  return IRAN_PROFILE;
}

/** باطل‌کردن کش (بعد از تغییر تنظیمات) — بار بعدی از DB می‌خواند */
export function invalidateCountryCache(): void {
  resetCountryCache();
}

/** نسخه عمومی بسته فعال برای کلاینت (بدون راز) */
export async function getActiveCountryPublic(): Promise<CountryProfile> {
  return getActiveCountry();
}
