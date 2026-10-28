"use client";

import { useState } from "react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type PackSummary = { code: string; name: string; nativeName: string; level: string; provinces: number; cities: number; villages: number };
type Places = { provinces: string[]; cities: string[]; villages: string[]; provinceVillages: number };

export default function CountriesPage() {
  const { data: shipped, loading, error } = useApi<{ packs: PackSummary[] }>("/api/countries/shipped");
  const [code, setCode] = useState("IR");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const q = `/api/countries/places?code=${code}${province ? `&province=${encodeURIComponent(province)}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}`;
  const { data: places } = useApi<Places>(q);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="بسته‌های کشور" desc="چارچوب مکان تا سطح روستا، بسته‌های همراه سامانه و سطح پوشش واقعی هرکدام — بدون ادعای کامل‌بودن." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {shipped && (
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">بسته‌های همراه سامانه</b>
          {shipped.packs.map((p) => (
            <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
              <b>{p.name} ({p.code})</b><span className="text-steel"> — {p.nativeName} · {p.level}</span>
              <span className="block text-[12.5px] text-steel">استان/منطقه: {faNumber(p.provinces)} · شهر: {faNumber(p.cities)} · روستا: {faNumber(p.villages)}</span>
            </div>
          ))}
          <p className="text-[12.5px] text-steel mt-2">
            صادقانه: روستاهای ایران در سطح استان وارد شده‌اند (۵۲٬۲۲۵ نام، منبع GeoNames) — چون آن منبع شهرستان را
            ندارد، روستا به شهرستان نسبت داده نشده است؛ امارات و عربستان هنوز روستا ندارند. ساختار روستای هر شهر هم
            با واردات بستهٔ تازه (سوپرادمین، از مسیر /api/countries) پر می‌شود.
          </p>
        </div>
      )}
      <div className="b-card p-6 flex flex-col gap-3">
        <b className="text-[14px]">مرور مکان‌ها: استان → شهر → روستا</b>
        <span className="flex gap-2 flex-wrap">
          <Select value={code} onChange={(v) => { setCode(v); setProvince(""); setCity(""); }} options={(shipped?.packs ?? []).map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))} placeholder="کشور" />
          <Select value={province} onChange={(v) => { setProvince(v); setCity(""); }} options={[{ value: "", label: "انتخاب استان" }, ...(places?.provinces ?? []).map((p) => ({ value: p, label: p }))]} placeholder="استان" />
          <Select value={city} onChange={setCity} options={[{ value: "", label: "انتخاب شهر" }, ...(places?.cities ?? []).map((c) => ({ value: c, label: c }))]} placeholder="شهر" />
        </span>
        {province && !city && (places?.provinceVillages ?? 0) > 0 && (
          <p className="text-[13px] text-steel">
            روستاهای استان {province}: {faNumber(places!.provinceVillages)} مورد — در سطح استان، بدون تفکیک شهرستان (منبع: GeoNames).
          </p>
        )}
        {province && city && (
          <p className="text-[13px] text-steel">
            روستاهای {city}: {(places?.villages ?? []).length === 0 ? "به‌صورت جداگانه برای این شهر وارد نشده‌اند — روستاهای استان در سطح استان موجود است (بالا)." : places!.villages.join("، ")}
          </p>
        )}
      </div>
    </div>
  );
}
