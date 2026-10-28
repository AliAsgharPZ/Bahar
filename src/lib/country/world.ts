import worldCountries from "./world-countries.json";

/* ============================================================
   بهار | فهرست نام همهٔ کشورهای جهان (name-only)
   نام فارسی + انگلیسی از ICU/CLDR (Intl.DisplayNames) — فقط نام؛
   این فهرست بستهٔ کامل کشور نیست (استان/شهر/روستا، منطقهٔ زمانی،
   واحد پول و الگوی تلفن ندارد) و هرگز نباید با SHIPPED_PACKS که
   بسته‌های کامل‌اند اشتباه گرفته شود.
   ============================================================ */

export type WorldCountry = { code: string; nameFa: string; nameEn: string };

export const WORLD_COUNTRIES: WorldCountry[] = (worldCountries as { entries: WorldCountry[] }).entries;
export const WORLD_COUNTRY_COUNT = WORLD_COUNTRIES.length;
