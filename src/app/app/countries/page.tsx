"use client";

import { useState } from "react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type PackSummary = { code: string; name: string; nativeName: string; level: string; provinces: number; cities: number; villages: number };
type WorldCountry = { code: string; nameFa: string; nameEn: string };
type Places = { provinces: string[]; cities: string[]; villages: string[]; provinceVillages: number };

export default function CountriesPage() {
  const { t } = useLang();
  const { data: shipped, loading, error } = useApi<{ packs: PackSummary[]; world: WorldCountry[] }>("/api/countries/shipped");
  const [code, setCode] = useState("IR");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const q = `/api/countries/places?code=${code}${province ? `&province=${encodeURIComponent(province)}` : ""}${city ? `&city=${encodeURIComponent(city)}` : ""}`;
  const { data: places } = useApi<Places>(q);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.countries")} desc={t("countries.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {shipped && (
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">{t("countries.shippedTitle")}</b>
          {shipped.packs.map((p) => (
            <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
              <b>{p.name} ({p.code})</b><span className="text-steel"> — {p.nativeName} · {p.level}</span>
              <span className="block text-[12.5px] text-steel">{t("countries.label.province")} {faNumber(p.provinces)} · {t("countries.label.city")} {faNumber(p.cities)} · {t("countries.label.village")} {faNumber(p.villages)}</span>
            </div>
          ))}
          <p className="text-[12.5px] text-steel mt-2">{t("countries.honestNote")}</p>
        </div>
      )}
      {shipped?.world && (
        <div className="b-card p-6 flex flex-col gap-2">
          <b className="text-[14px]">{t("countries.worldTitle")} — {faNumber(shipped.world.length)} {t("countries.worldUnit")}</b>
          <p className="text-[12.5px] text-steel">{t("countries.worldNote")}</p>
          <p className="text-[12.5px] text-steel leading-7">{shipped.world.map((c) => `${c.nameFa} (${c.nameEn})`).join(" · ")}</p>
        </div>
      )}
      <div className="b-card p-6 flex flex-col gap-3">
        <b className="text-[14px]">{t("countries.browseTitle")}</b>
        <span className="flex gap-2 flex-wrap">
          <Select value={code} onChange={(v) => { setCode(v); setProvince(""); setCity(""); }} options={(shipped?.packs ?? []).map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))} placeholder={t("countries.select.country")} />
          <Select value={province} onChange={(v) => { setProvince(v); setCity(""); }} options={[{ value: "", label: t("countries.select.province") }, ...(places?.provinces ?? []).map((p) => ({ value: p, label: p }))]} placeholder={t("countries.select.provinceShort")} />
          <Select value={city} onChange={setCity} options={[{ value: "", label: t("countries.select.city") }, ...(places?.cities ?? []).map((c) => ({ value: c, label: c }))]} placeholder={t("countries.select.cityShort")} />
        </span>
        {province && !city && (places?.provinceVillages ?? 0) > 0 && (
          <p className="text-[13px] text-steel">
            {t("countries.provinceVillagesPrefix")} {province}: {faNumber(places!.provinceVillages)} {t("countries.provinceVillagesSuffix")}
          </p>
        )}
        {province && city && (
          <p className="text-[13px] text-steel">
            {t("countries.cityVillagesPrefix")} {city}: {(places?.villages ?? []).length === 0 ? t("countries.cityVillagesNone") : places!.villages.join("، ")}
          </p>
        )}
      </div>
    </div>
  );
}
