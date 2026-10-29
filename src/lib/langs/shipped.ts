import { CATALOG_KEYS, LONG_CATALOG, LONG_KEYS, SITE_CATALOG, SITE_KEYS, validateLanguagePack, validateLongPack, validateSitePack } from "../langs";
import enPack from "./packs/en.json";
import arPack from "./packs/ar.json";
import trPack from "./packs/tr.json";
import frPack from "./packs/fr.json";
import esPack from "./packs/es.json";
import dePack from "./packs/de.json";
import itPack from "./packs/it.json";
import ptPack from "./packs/pt.json";
import urPack from "./packs/ur.json";
import azPack from "./packs/az.json";
import hiPack from "./packs/hi.json";
import zhPack from "./packs/zh.json";

/* ============================================================
   بهار | بسته‌های زبانِ همراه سامانه (shipped packs)
   هشت بستهٔ همراه سامانه کامل‌اند (۲۰۰ از ۲۰۰ کلید کاتالوگ اپ + ۱۳۳ از ۱۳۳
   جملهٔ سایت): انگلیسی، عربی، ترکی، فرانسوی، اسپانیایی، آلمانی، ایتالیایی و
   پرتغالی؛ چهار بستهٔ دستیِ بدون بازبینی تخصصی نیز همین پوشش کامل را دارند:
   اردو، آذربایجانی، هندی و چینی (چینی از z.ai، راند ۳). کلیدهای ترجمه‌نشدهٔ
   بسته‌های دیگرِ پایگاه داده همچنان به فارسی پایه بازمی‌گردند. فهرست نام همهٔ
   زبان‌های جهان (بدون ترجمه) جداگانه در ./world.ts است و بستهٔ کامل شمرده نمی‌شود.
   ============================================================ */

export type ShippedLangPack = {
  code: string;
  name: string;
  nativeName: string;
  direction: "rtl" | "ltr";
  strings: Record<string, string>;
  keyCount: number;
  coverage: number;
  missingKeys: string[];
  /** جملات سایت عمومی (کاتالوگ SITE) — جدا از کلیدهای اپ، با fallback فارسی. */
  siteStrings: Record<string, string>;
  siteKeyCount: number;
  siteCoverage: number;
  siteMissingKeys: string[];
  /** متن‌های بلند (FAQ، پاراگراف‌های کیت) — جدا از SITE، با fallback فارسی. */
  longStrings: Record<string, string>;
  longKeyCount: number;
  longCoverage: number;
  longMissingKeys: string[];
};

function build(pack: { code: string; name: string; nativeName: string; direction: string; strings: Record<string, string>; siteStrings?: Record<string, string>; longStrings?: Record<string, string> }): ShippedLangPack {
  const result = validateLanguagePack(pack);
  const siteResult = validateSitePack(pack);
  const longResult = validateLongPack(pack.longStrings);
  const missingKeys = CATALOG_KEYS.filter((k) => !(k in pack.strings));
  const siteStrings = pack.siteStrings ?? {};
  const siteMissingKeys = SITE_KEYS.filter((k) => !(k in siteStrings));
  const longStrings = pack.longStrings ?? {};
  const longMissingKeys = LONG_KEYS.filter((k) => !(k in longStrings));
  return {
    code: pack.code, name: pack.name, nativeName: pack.nativeName,
    direction: pack.direction as "rtl" | "ltr",
    strings: pack.strings, keyCount: result.stats.keyCount, coverage: result.stats.coverage, missingKeys,
    siteStrings, siteKeyCount: siteResult.stats.keyCount, siteCoverage: siteResult.stats.coverage, siteMissingKeys,
    longStrings, longKeyCount: longResult.stats.keyCount, longCoverage: longResult.stats.coverage, longMissingKeys,
  };
}

export const SHIPPED_LANG_PACKS: ShippedLangPack[] = [
  build(enPack as never), build(arPack as never), build(trPack as never), build(frPack as never),
  build(esPack as never), build(dePack as never), build(itPack as never), build(ptPack as never),
  build(urPack as never), build(azPack as never), build(hiPack as never), build(zhPack as never),
];

export function shippedLangPack(code: string): ShippedLangPack | null {
  return SHIPPED_LANG_PACKS.find((p) => p.code === code.toLowerCase()) ?? null;
}

/** جملات سایت برای یک زبان — فارسی پایه + ترجمهٔ بسته (فقدان = فارسی). */
export function siteStringsFor(code: string): { code: string; direction: "rtl" | "ltr"; siteStrings: Record<string, string> } {
  const pack = code && code.toLowerCase() !== "fa" ? shippedLangPack(code) : null;
  if (!pack) return { code: "fa", direction: "rtl", siteStrings: SITE_CATALOG };
  return { code: pack.code, direction: pack.direction, siteStrings: { ...SITE_CATALOG, ...pack.siteStrings } };
}

/** متن‌های بلند برای یک زبان — فارسی پایه + ترجمهٔ بسته (فقدان = فارسی). */
export function longStringsFor(code: string): { code: string; direction: "rtl" | "ltr"; longStrings: Record<string, string> } {
  const pack = code && code.toLowerCase() !== "fa" ? shippedLangPack(code) : null;
  if (!pack) return { code: "fa", direction: "rtl", longStrings: LONG_CATALOG };
  return { code: pack.code, direction: pack.direction, longStrings: { ...LONG_CATALOG, ...pack.longStrings } };
}

/** زبان‌های قابل انتخاب در سایت عمومی (فارسی + بسته‌های همراه). */
export const SITE_LANGS: { code: string; nativeName: string; direction: "rtl" | "ltr" }[] = [
  { code: "fa", nativeName: "فارسی", direction: "rtl" },
  ...SHIPPED_LANG_PACKS.map((p) => ({ code: p.code, nativeName: p.nativeName, direction: p.direction })),
];

/** پوشش کاتالوگ به تفکیک دامنه (بخش پیش از نقطهٔ کلید). */
export function catalogDomains(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of CATALOG_KEYS) {
    const d = k.split(".")[0];
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}
