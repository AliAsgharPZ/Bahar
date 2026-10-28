import worldLanguages from "./world-languages.json";

/* ============================================================
   بهار | فهرست نام همهٔ زبان‌های جهان (name-only)
   نام فارسی + انگلیسی + نام بومی از ICU/CLDR (Intl.DisplayNames) —
   فقط نام؛ این فهرست ترجمهٔ کاتالوگ نیست و هرگز نباید با
   SHIPPED_LANG_PACKS که بسته‌های کامل ۲۰۰ کلیدی‌اند اشتباه گرفته شود.
   ============================================================ */

export type WorldLanguage = { code: string; nameFa: string; nameEn: string; nativeName: string };

export const WORLD_LANGUAGES: WorldLanguage[] = (worldLanguages as { entries: WorldLanguage[] }).entries;
export const WORLD_LANGUAGE_COUNT = WORLD_LANGUAGES.length;
