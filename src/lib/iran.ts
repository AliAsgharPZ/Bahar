// ============================================================
// بهار | مناطق کشور — لایه سازگاری (Compatibility Layer)
// از راند ۱۶: توابع از «پروفایل کشور فعال» می‌خوانند؛ دیفالت ایران
// (۳۱ استان، ~۴۲۹ شهرستان — داده خام در lib/iran-data.ts).
// داده خام ایران برای مرجع/قالب در iran-data.ts باقی مانده است.
// ============================================================
import { getCountrySync } from "@/lib/country/cache";
import { IRAN_PROVINCES } from "@/lib/iran-data";

export type IranProvince = {
  fa: string;
  center: string;
  counties: string[];
};

/** داده خام ایران — فقط برای مرجع (دیتای واقعی از پروفایل فعال خوانده می‌شود) */
export { IRAN_PROVINCES };

/** نام استان‌های کشور فعال (ایران: ۳۱ استان) */
export function provinceNames(): string[] {
  return getCountrySync().regions.map((r) => r.name);
}

/** نام قدیمی — استان‌های ایران (سازگاری) */
export const IRAN_PROVINCE_NAMES: string[] = IRAN_PROVINCES.map((p) => p.fa);

/** شهرستان‌های یک استان در کشور فعال */
export function countiesOf(provinceName: string): string[] {
  return getCountrySync().regions.find((r) => r.name === provinceName)?.counties ?? [];
}

/** مرکز استان در کشور فعال */
export function provinceCenter(provinceName: string): string | undefined {
  return getCountrySync().regions.find((r) => r.name === provinceName)?.center;
}

/** اعتبارسنجی استان/شهرستان در کشور فعال */
export function isValidProvinceCounty(province: string | null | undefined, county: string | null | undefined): boolean {
  if (!province) return true;
  const list = countiesOf(province);
  if (list.length === 0) return true;
  if (!county) return true;
  return list.includes(county);
}

/** کلید یکتای منطقه: "تهران|کرج" */
export function regionKey(province: string, county: string): string {
  return `${province}|${county}`;
}

/** تعداد کل شهرستان‌های کشور فعال */
export function totalCounties(): number {
  return getCountrySync().regions.reduce((s, r) => s + r.counties.length, 0);
}

/** کلید تاریخ ثبت‌نام قدیمی — سازگاری */
export const TOTAL_COUNTIES = IRAN_PROVINCES.reduce((s, p) => s + p.counties.length, 0);
