import { CATALOG_KEYS, validateLanguagePack } from "./langs";
import enPack from "./packs/en.json";
import arPack from "./packs/ar.json";
import trPack from "./packs/tr.json";

/* ============================================================
   بهار | بسته‌های زبانِ همراه سامانه (shipped packs)
   انگلیسی کامل است (۲۰۰ از ۲۰۰ کلید)؛ عربی و ترکی فقط پوسته،
   ناوبری و عملیات عمومی را دارند (۱۵۷ از ۲۰۰) و بقیهٔ کلیدها
   مثل همیشه به فارسی پایه بازمی‌گردند. هیچ ادعای ۱۰۰٪ برای
   زبانی که واقعاً کامل نیست، در اینجا نیست.
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
  build(enPack as never), build(arPack as never), build(trPack as never),
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
