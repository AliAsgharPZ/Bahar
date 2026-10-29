import { CATALOG_KEYS, validateLanguagePack } from "../langs";
import enPack from "./packs/en.json";
import arPack from "./packs/ar.json";
import trPack from "./packs/tr.json";
import frPack from "./packs/fr.json";
import esPack from "./packs/es.json";
import dePack from "./packs/de.json";
import itPack from "./packs/it.json";
import ptPack from "./packs/pt.json";
import urPack from "./packs/ur.json";

/* ============================================================
   بهار | بسته‌های زبانِ همراه سامانه (shipped packs)
   هر هشت بستهٔ همراه سامانه کامل‌اند (۲۰۰ از ۲۰۰ کلید کاتالوگ):
   انگلیسی، عربی، ترکی، فرانسوی، اسپانیایی، آلمانی، ایتالیایی و
   پرتغالی؛ بستهٔ نهم، اردو، نیز ۲۰۰ از ۲۰۰ کلید را دارد ولی
   ترجمهٔ دستیِ غیرمتخصص است و بازبینی تخصصی نشده است. کلیدهای ترجمه‌نشدهٔ بسته‌های دیگرِ پایگاه داده همچنان
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
};

function build(pack: { code: string; name: string; nativeName: string; direction: string; strings: Record<string, string> }): ShippedLangPack {
  const result = validateLanguagePack(pack);
  const missingKeys = CATALOG_KEYS.filter((k) => !(k in pack.strings));
  return {
    code: pack.code, name: pack.name, nativeName: pack.nativeName,
    direction: pack.direction as "rtl" | "ltr",
    strings: pack.strings, keyCount: result.stats.keyCount, coverage: result.stats.coverage, missingKeys,
  };
}

export const SHIPPED_LANG_PACKS: ShippedLangPack[] = [
  build(enPack as never), build(arPack as never), build(trPack as never), build(frPack as never),
  build(esPack as never), build(dePack as never), build(itPack as never), build(ptPack as never),
  build(urPack as never),
];

export function shippedLangPack(code: string): ShippedLangPack | null {
  return SHIPPED_LANG_PACKS.find((p) => p.code === code.toLowerCase()) ?? null;
}

/** پوشش کاتالوگ به تفکیک دامنه (بخش پیش از نقطهٔ کلید). */
export function catalogDomains(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of CATALOG_KEYS) {
    const d = k.split(".")[0];
    out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}
