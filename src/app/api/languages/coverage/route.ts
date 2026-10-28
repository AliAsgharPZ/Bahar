import { apiOk, handleApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { CATALOG_KEYS, validateLanguagePack } from "@/lib/langs";
import { SHIPPED_LANG_PACKS, catalogDomains } from "@/lib/langs/shipped";
import { WORLD_LANGUAGES } from "@/lib/langs/world";

/* بهار | پوشش ترجمه — کاتالوگ، دامنه‌ها، بسته‌های همراه سامانه و
   بسته‌های پایگاه داده، با فهرست کلیدهای ترجمه‌نشدهٔ هر بسته.
   کلید ترجمه‌نشده به فارسی پایه بازمی‌گردد؛ این مسیر فقط گزارش
   می‌دهد و چیزی را تغییر نمی‌دهد. */

export async function GET() {
  try {
    const dbPacks = await db.languagePack.findMany({
      select: { code: true, name: true, nativeName: true, direction: true, status: true, data: true, keyCount: true, coverage: true },
    });
    const dbRows = dbPacks.map((p) => {
      let strings: Record<string, unknown> = {};
      try { strings = JSON.parse(p.data) as Record<string, unknown>; } catch { strings = {}; }
      const keys = Object.keys(strings).filter((k) => CATALOG_KEYS.includes(k));
      return {
        code: p.code, name: p.name, nativeName: p.nativeName, direction: p.direction, status: p.status,
        keyCount: keys.length, coverage: Math.round((keys.length / CATALOG_KEYS.length) * 100),
        missingKeys: CATALOG_KEYS.filter((k) => !keys.includes(k)),
        storedCoverage: p.coverage,
      };
    });
    return apiOk({
      catalogSize: CATALOG_KEYS.length,
      domains: catalogDomains(),
      shipped: SHIPPED_LANG_PACKS.map((p) => ({ code: p.code, name: p.name, nativeName: p.nativeName, direction: p.direction, keyCount: p.keyCount, coverage: p.coverage, missingKeys: p.missingKeys })),
      dbPacks: dbRows,
      worldLanguages: WORLD_LANGUAGES,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
