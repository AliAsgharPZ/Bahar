// ============================================================
// بهار | کش پروفایل کشور — دسترسی همگام (سمت سرور و کلاینت)
// سرور: instrumentation در بوت + sweep زمان‌بند هر ۱۵ دقیقه تازه می‌کند
// کلاینت: CountryProvider بعد از fetch بسته فعال
// تا قبل از هیدریشن → دیفالت ایران (رفتار کاملاً یکسان با قبل)
// ============================================================
import { IRAN_PROFILE } from "./iran";
import type { CountryProfile } from "./types";

type CacheState = { profile: CountryProfile; loadedAt: number };

const g = globalThis as unknown as { __baharCountry?: CacheState };

/** پروفایل فعال — همیشه یک مقدار معتبر (دیفالت ایران) */
export function getCountrySync(): CountryProfile {
  return g.__baharCountry?.profile ?? IRAN_PROFILE;
}

/** جای‌گذاری پروفایل در کش (سمت سرور و کلاینت) */
export function setCountryCache(profile: CountryProfile): void {
  g.__baharCountry = { profile, loadedAt: Date.now() };
}

/** بازگشت به دیفالت ایران (وقتی بسته فعال حذف/غیرفعال شد) */
export function resetCountryCache(): void {
  g.__baharCountry = undefined;
}

/** عمر کش — Infinity یعنی هنوز هیدرات نشده */
export function countryCacheAgeMs(): number {
  return g.__baharCountry ? Date.now() - g.__baharCountry.loadedAt : Infinity;
}

/** آیا پروفایل فعال ایران است؟ */
export function isIranDefault(): boolean {
  return getCountrySync().code === "IR";
}
