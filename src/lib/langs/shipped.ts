import { CATALOG_KEYS, SITE_CATALOG, SITE_KEYS, validateLanguagePack, validateSitePack } from "../langs";
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

/* ============================================================
   بهار | بسته‌های زبانِ همراه سامانه (shipped packs)
   هر هشت بستهٔ همراه سامانه کامل‌اند (۲۰۰ از ۲۰۰ کلید کاتالوگ):
   انگلیسی، عربی، ترکی، فرانسوی، اسپانیایی، آلمانی، ایتالیایی و
   پرتغالی؛ بستهٔ نهم، اردو، نیز ۲۰۰ از ۲۰۰ کلید را دارد ولی
   ترجمهٔ دستیِ غیرمتخصص است و بازبینی تخصصی نشده است؛ بسته‌های
   دهم و یازدهم، آذربایجانی و هندی، نیز همین وضعیت را دارند
   (۲۰۰ از ۲۰۰ کلید، دستی، بازبینی‌نشده). کلیدهای ترجمه‌نشدهٔ بسته‌های دیگرِ پایگاه داده همچنان
   به فارسی پایه بازمی‌گردند. فهرست نام همهٔ زبان‌های جهان (بدون
   ترجمه) جداگانه در ./world.ts است و بستهٔ کامل شمرده نمی‌شود.
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
};

function build(pack: { code: string; name: string; nativeName: string; direction: string; strings: Record<string, string>; siteStrings?: Record<string, string> }): ShippedLangPack {
  const result = validateLanguagePack(pack);
  const siteResult = validateSitePack(pack);
  const missingKeys = CATALOG_KEYS.filter((k) => !(k in pack.strings));
  const siteStrings = pack.siteStrings ?? {};
  const siteMissingKeys = SITE_KEYS.filter((k) => !(k in siteStrings));
  return {
    code: pack.code, name: pack.name, nativeName: pack.nativeName,
    direction: pack.direction as "rtl" | "ltr",
    strings: pack.strings, keyCount: result.stats.keyCount, coverage: result.stats.coverage, missingKeys,
    siteStrings, siteKeyCount: siteResult.stats.keyCount, siteCoverage: siteResult.stats.coverage, siteMissingKeys,
  };
}

export const SHIPPED_LANG_PACKS: ShippedLangPack[] = [
  build(enPack as never), build(arPack as never), build(trPack as never), build(frPack as never),
  build(esPack as never), build(dePack as never), build(itPack as never), build(ptPack as never),
  build(urPack as never), build(azPack as never), build(hiPack as never),
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
