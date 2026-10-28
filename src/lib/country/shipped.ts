import type { CountryProfile } from "./types";
import irPack from "./packs/ir.json";
import aePack from "./packs/ae.json";
import saPack from "./packs/sa.json";

/* ============================================================
   بهار | بسته‌های کشورِ همراه سامانه (shipped packs)
   این‌ها دادهٔ محصول‌اند و با کد سامانه می‌آیند؛ واردات بستهٔ
   تازه (سوپرادمین، از مسیر /api/countries) جداگانه در پایگاه
   داده ذخیره می‌شود و این رجیستری را تغییر نمی‌دهد.
   صادقانه: روستا برای هیچ کشوری هنوز وارد نشده است — ساختار
   divisions تا سطح روستا را دارد ولی فهرست روستاها خالی است.
   ============================================================ */

export type ShippedPackSummary = {
  code: string;
  name: string;
  nativeName: string;
  level: string; // سطح پوشش واقعی، نه ادعا
  provinces: number;
  cities: number;
  villages: number;
};

function summarize(pack: CountryProfile): ShippedPackSummary {
  const divisions = pack.divisions ?? [];
  const cities = divisions.reduce((s, d) => s + d.cities.length, 0);
  const villages = divisions.reduce((s, d) => s + d.cities.reduce((t, c) => t + c.villages.length, 0), 0);
  return {
    code: pack.code, name: pack.name, nativeName: pack.nativeName,
    level: villages > 0 ? "استان + شهر + روستا" : cities > 0 ? "استان + شهر (روستا هنوز وارد نشده)" : "استان",
    provinces: divisions.length, cities, villages,
  };
}

export const SHIPPED_PACKS: CountryProfile[] = [irPack as CountryProfile, aePack as CountryProfile, saPack as CountryProfile];
export const SHIPPED_SUMMARIES: ShippedPackSummary[] = SHIPPED_PACKS.map(summarize);
export const SHIPPED_CODES = SHIPPED_PACKS.map((p) => p.code);

export function shippedPack(code: string): CountryProfile | null {
  return SHIPPED_PACKS.find((p) => p.code === code.toUpperCase()) ?? null;
}

export function placesFor(code: string, province?: string, city?: string): { provinces: string[]; cities: string[]; villages: string[] } | null {
  const pack = shippedPack(code);
  if (!pack || !pack.divisions) return null;
  const provinces = pack.divisions.map((d) => d.province);
  if (!province) return { provinces, cities: [], villages: [] };
  const div = pack.divisions.find((d) => d.province === province);
  if (!div) return { provinces, cities: [], villages: [] };
  const cities = div.cities.map((c) => c.name);
  if (!city) return { provinces, cities, villages: [] };
  const found = div.cities.find((c) => c.name === city);
  return { provinces, cities, villages: found ? found.villages : [] };
}
