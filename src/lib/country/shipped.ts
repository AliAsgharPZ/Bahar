import type { CountryProfile } from "./types";
import irPack from "./packs/ir.json";
import irVillages from "./packs/ir-villages.json";
import aePack from "./packs/ae.json";
import saPack from "./packs/sa.json";
import dePack from "./packs/de.json";
import usPack from "./packs/us.json";
import frPack from "./packs/fr.json";
import itPack from "./packs/it.json";

/* ============================================================
   بهار | بسته‌های کشورِ همراه سامانه (shipped packs)
   این‌ها دادهٔ محصول‌اند و با کد سامانه می‌آیند؛ واردات بستهٔ
   تازه (سوپرادمین، از مسیر /api/countries) جداگانه در پایگاه
   داده ذخیره می‌شود و این رجیستری را تغییر نمی‌دهد.
   صادقانه: روستاهای ایران در سطح استان وارد شده‌اند (۵۲٬۲۲۵ نام از
   GeoNames، بدون تفکیک شهرستان — چون منبع، شهرستان را ندارد)؛
   divisions تا سطح روستا را دارد ولی فهرست روستاهای هر شهر هنوز
   خالی است. امارات و عربستان هنوز روستا ندارند. آلمان، آمریکا،
   فرانسه و ایتالیا فقط در سطح استان/ایالت‌اند (بدون شهر و روستا)؛
   مقیاس نمره و فهرست پایه‌هایشان عمومی است، نه نظام رسمی کشور.
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

// روستاهای ایران در سطح استان (منبع: GeoNames — تفکیک شهرستان ندارد).
export const IR_PROVINCE_VILLAGES: Record<string, string[]> = Object.fromEntries(
  (irVillages as { provinces: { province: string; villages: string[] }[] }).provinces.map((p) => [p.province, p.villages]),
);
export const IR_PROVINCE_VILLAGE_COUNT = Object.values(IR_PROVINCE_VILLAGES).reduce((s, v) => s + v.length, 0);

export function provinceVillagesFor(code: string, province: string): string[] {
  if (code.toUpperCase() !== "IR") return [];
  return IR_PROVINCE_VILLAGES[province] ?? [];
}

function summarize(pack: CountryProfile): ShippedPackSummary {
  const divisions = pack.divisions ?? [];
  const cities = divisions.reduce((s, d) => s + d.cities.length, 0);
  const cityVillages = divisions.reduce((s, d) => s + d.cities.reduce((t, c) => t + c.villages.length, 0), 0);
  const provinceVillages = pack.code === "IR" ? IR_PROVINCE_VILLAGE_COUNT : 0;
  const villages = cityVillages + provinceVillages;
  const level = cityVillages > 0 ? "استان + شهر + روستا"
    : provinceVillages > 0 ? "استان + شهر + روستا (روستاها در سطح استان)"
    : cities > 0 ? "استان + شهر (روستا هنوز وارد نشده)" : "استان";
  return {
    code: pack.code, name: pack.name, nativeName: pack.nativeName,
    level, provinces: divisions.length, cities, villages,
  };
}

export const SHIPPED_PACKS: CountryProfile[] = [irPack as CountryProfile, aePack as CountryProfile, saPack as CountryProfile, dePack as CountryProfile, usPack as CountryProfile, frPack as CountryProfile, itPack as CountryProfile];
export const SHIPPED_SUMMARIES: ShippedPackSummary[] = SHIPPED_PACKS.map(summarize);
export const SHIPPED_CODES = SHIPPED_PACKS.map((p) => p.code);

export function shippedPack(code: string): CountryProfile | null {
  return SHIPPED_PACKS.find((p) => p.code === code.toUpperCase()) ?? null;
}

export function placesFor(code: string, province?: string, city?: string): { provinces: string[]; cities: string[]; villages: string[]; provinceVillages: number } | null {
  const pack = shippedPack(code);
  if (!pack || !pack.divisions) return null;
  const provinces = pack.divisions.map((d) => d.province);
  if (!province) return { provinces, cities: [], villages: [], provinceVillages: 0 };
  const div = pack.divisions.find((d) => d.province === province);
  if (!div) return { provinces, cities: [], villages: [], provinceVillages: 0 };
  const cities = div.cities.map((c) => c.name);
  const provinceVillages = provinceVillagesFor(code, province).length;
  if (!city) return { provinces, cities, villages: [], provinceVillages };
  const found = div.cities.find((c) => c.name === city);
  return { provinces, cities, villages: found ? found.villages : [], provinceVillages };
}
