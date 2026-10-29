"use client";

import { useMemo, useState } from "react";
import { X, Check, MapPin, ChevronLeft, Loader2 } from "lucide-react";
import { IRAN_PROVINCE_PATHS, IRAN_MAP_VIEWBOX } from "@/lib/iran-map";
import { IRAN_PROVINCES, countiesOf } from "@/lib/iran";
import { faNumber } from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";

// ============================================================
// بهار | انتخابگر نقشه ایران — استان + شهرستان
// کاربرد: انتخاب شهرستان مدرسه + هدف‌گیری اطلاعیه
// ============================================================

export type RegionSelection = {
  provinces: string[];
  counties: string[]; // کلید «استان|شهرستان»
};

type Props = {
  open: boolean;
  onClose: () => void;
  selection: RegionSelection;
  onChange: (sel: RegionSelection) => void;
  title?: string;
  desc?: string;
};

export function IranMapPicker({ open, onClose, selection, onChange, title, desc }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activeProvince, setActiveProvince] = useState<string | null>(null);
  const [tab, setTab] = useState<"provinces" | "counties">("provinces");

  // FIX (راند ۱۶): مناطق از پروفایل کشور فعال؛
  // نقشه: از بسته کاستوم (profile.map) یا نقشه داخلی ایران — بدون نقشه: فقط دراپ‌داون
  const countryCode = getCountrySync().code;
  const regions = useMemo(() => {
    const c = getCountrySync();
    return c.regions.length ? c.regions : IRAN_PROVINCES.map((p) => ({ name: p.fa, center: p.center, counties: p.counties }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);
  const mapData = useMemo(() => {
    const c = getCountrySync();
    if (c.map) return { viewBox: c.map.viewBox, provinces: c.map.provinces.map((pp) => ({ fa: pp.name, en: pp.name, d: pp.d, cx: pp.cx, cy: pp.cy, approxArea: 0 })) };
    if (c.code === "IR" || c.regions.length === 0) return { viewBox: IRAN_MAP_VIEWBOX, provinces: IRAN_PROVINCE_PATHS };
    return null; // کشور بدون نقشه → فقط لیست
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode]);
    const paths = useMemo(() => (mapData ? mapData.provinces : []), [mapData]);
  const selectedProvinceSet = useMemo(() => {
    // استانی انتخاب‌شده تلقی می‌شود که خودش تیک خورده یا همه شهرستان‌هایش انتخاب شده
    const s = new Set(selection.provinces);
    for (const p of regions) {
      const list = p.counties;
      if (list.length > 0 && list.every((c) => selection.counties.includes(`${p.name}|${c}`))) {
        s.add(p.name);
      }
    }
    return s;
  }, [selection]);

  if (!open) return null;

  const toggleProvince = (fa: string) => {
    const isSelected = selectedProvinceSet.has(fa);
    if (isSelected) {
      // حذف استان + همه شهرستان‌هایش
      onChange({
        provinces: selection.provinces.filter((p) => p !== fa),
        counties: selection.counties.filter((c) => !c.startsWith(`${fa}|`)),
      });
    } else {
      // افزودن استان (اگر کاربر در تب شهرستان هست فقط استان را اضافه کن)
      if (tab === "provinces") {
        onChange({
          provinces: [...selection.provinces, fa],
          counties: selection.counties,
        });
      } else {
        onChange({
          provinces: [...selection.provinces, fa],
          counties: [...selection.counties],
        });
      }
    }
    setActiveProvince(fa);
  };

  const toggleCounty = (province: string, county: string) => {
    const key = `${province}|${county}`;
    const provinceSelected = selectedProvinceSet.has(province);
    if (provinceSelected) {
      // استان کامل انتخاب بود → حذف استان و افزودن همه شهرستان‌ها جز این یکی
      const all = countiesOf(province).map((c) => `${province}|${c}`);
      onChange({
        provinces: selection.provinces.filter((p) => p !== province),
        counties: [...selection.counties.filter((c) => !all.includes(c)), key],
      });
    } else if (selection.counties.includes(key)) {
      onChange({ ...selection, counties: selection.counties.filter((c) => c !== key) });
    } else {
      onChange({ ...selection, counties: [...selection.counties, key] });
    }
  };

  const clearAll = () => onChange({ provinces: [], counties: [] });
  const totalSelected = selectedProvinceSet.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-deep/50" onClick={onClose} aria-hidden />
      <div className="relative b-card !rounded-3xl p-0 w-full max-w-4xl max-h-[92vh] overflow-hidden b-pop flex flex-col">
        {/* هدر */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-hairline-soft shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-[16px] truncate">{title ?? "انتخاب منطقه روی نقشه ایران"}</h2>
              <p className="text-[12px] text-steel truncate">
                {desc ?? "استان‌ها و شهرستان‌ها را برای هدف‌گیری انتخاب کنید — اختیاری و قابل ترکیب با نوع کاربر."}
              </p>
            </div>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-cloud shrink-0" onClick={onClose} aria-label="بستن">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 pt-3 shrink-0">
          <button
            className={`b-pill-tab ${tab === "provinces" ? "b-pill-tab-active" : ""}`}
            onClick={() => setTab("provinces")}
          >
            انتخاب استان
          </button>
          <button
            className={`b-pill-tab ${tab === "counties" ? "b-pill-tab-active" : ""}`}
            onClick={() => setTab("counties")}
          >
            انتخاب شهرستان
          </button>
          <span className="ms-auto text-[12px] text-steel">
            {totalSelected > 0 || selection.counties.length > 0 ? (
              <>
                {totalSelected > 0 && <b className="text-spring">{faNumber(totalSelected)} استان</b>}
                {totalSelected > 0 && selection.counties.length > 0 && " · "}
                {selection.counties.length > 0 && <b className="text-spring">{faNumber(selection.counties.length)} شهرستان</b>}
              </>
            ) : (
              "بدون محدودیت جغرافیایی — همه ایران"
            )}
          </span>
          {(totalSelected > 0 || selection.counties.length > 0) && (
            <button className="text-[12px] text-destructive font-bold hover:underline" onClick={clearAll}>
              پاک‌کردن
            </button>
          )}
        </div>

        {/* بدنه */}
        <div className="flex-1 grid md:grid-cols-[1.15fr_1fr] min-h-0 overflow-hidden">
          {/* نقشه — کشور بدون نقشه فقط لیست دارد */}
          <div className={`relative p-4 md:p-6 flex items-center justify-center bg-cloud/40 border-l border-hairline-soft ${mapData ? "" : "hidden md:!flex"}`}>
            {mapData && (
            <svg
              viewBox={`0 0 ${mapData.viewBox.w} ${mapData.viewBox.h}`}
              className="w-full max-h-[52vh]"
              role="img"
              aria-label="نقشه ایران"
            >
              {paths.map((p) => {
                const selected = selectedProvinceSet.has(p.fa);
                const isHover = hovered === p.fa;
                return (
                  <path
                    key={p.en}
                    d={p.d}
                    fill={selected ? "#00825E" : isHover ? "#B7DCCB" : "#E3E8E5"}
                    stroke="#FFFFFF"
                    strokeWidth={1.2}
                    className="cursor-pointer transition-colors"
                    onClick={() => toggleProvince(p.fa)}
                    onMouseEnter={() => setHovered(p.fa)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
              {paths.map((p) =>
                p.approxArea > 2.4 && !hovered ? (
                  <text
                    key={`t-${p.en}`}
                    x={p.cx}
                    y={p.cy}
                    textAnchor="middle"
                    fontSize={11}
                    fill={selectedProvinceSet.has(p.fa) ? "#FFFFFF" : "#5B6B66"}
                    className="pointer-events-none select-none"
                  >
                    {p.fa}
                  </text>
                ) : null
              )}
              {hovered && (() => {
                const p = paths.find((x) => x.fa === hovered);
                if (!p) return null;
                return (
                  <text
                    x={p.cx}
                    y={p.cy - 10}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill="#005A42"
                    className="pointer-events-none select-none"
                  >
                    {p.fa}
                  </text>
                );
              })()}
            </svg>
            )}
            <div className="absolute bottom-3 end-4 text-[12px] text-steel bg-background/80 rounded-full px-3 py-1">
              {hovered ? `استان ${hovered} — ${faNumber(countiesOf(hovered).length)} شهرستان` : "روی استان کلیک کنید تا انتخاب شود"}
            </div>
          </div>

          {/* پنل شهرستان‌ها */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-hairline-soft flex items-center gap-2">
              {activeProvince ? (
                <>
                  <button className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-cloud" onClick={() => setActiveProvince(null)} aria-label="بازگشت">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <b className="text-[14px]">{activeProvince}</b>
                  <span className="text-[12px] text-steel">شهرستان‌ها</span>
                  <button
                    className="ms-auto text-[12px] font-bold text-spring hover:underline"
                    onClick={() => {
                      const all = countiesOf(activeProvince).map((c) => `${activeProvince}|${c}`);
                      onChange({
                        provinces: [...new Set([...selection.provinces.filter((p) => p !== activeProvince)])],
                        counties: [...new Set([...selection.counties, ...all])],
                      });
                    }}
                  >
                    انتخاب همه
                  </button>
                </>
              ) : (
                <span className="text-[12px] text-steel">
                  {tab === "counties" ? "یک استان را از نقشه یا فهرست انتخاب کنید" : "استان‌های انتخاب‌شده:"}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto b-scroll p-3">
              {!activeProvince && (
                <div className="flex flex-col gap-1.5">
                  {regions.map((p) => {
                    const selected = selectedProvinceSet.has(p.name);
                    return (
                      <button
                        key={p.name}
                        className={`b-option flex items-center gap-3 !py-2.5 ${selected ? "b-option-selected" : ""}`}
                        onClick={() => (tab === "provinces" ? toggleProvince(p.name) : setActiveProvince(p.name))}
                      >
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold ${
                            selected ? "bg-spring text-primary-foreground" : "bg-cloud text-steel"
                          }`}
                        >
                          {selected ? <Check className="w-4 h-4" /> : faNumber(p.counties.length)}
                        </span>
                        <span className="flex flex-col min-w-0 text-end">
                          <b className="text-[12px]">{p.name}</b>
                          <span className="text-[12px] text-steel">مرکز: {p.center}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {activeProvince && (
                <div className="grid grid-cols-2 gap-1.5">
                  {countiesOf(activeProvince).map((c) => {
                    const key = `${activeProvince}|${c}`;
                    const selected = selection.counties.includes(key) || selectedProvinceSet.has(activeProvince);
                    return (
                      <button
                        key={key}
                        className={`b-option flex items-center gap-2 !py-2 !px-2.5 ${selected ? "b-option-selected" : ""}`}
                        onClick={() => toggleCounty(activeProvince, c)}
                      >
                        <span className={`w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center border ${selected ? "bg-spring border-spring" : "border-hairline"}`}>
                          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </span>
                        <span className="text-[12px] truncate">{c}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* فوتر */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-hairline-soft shrink-0">
          <p className="text-[12px] text-steel">
            انتخاب خالی = بدون محدودیت. اگر استان و شهرستان هر دو انتخاب شوند، شهرستان دقیق‌تر است.
          </p>
          <button className="b-btn b-btn-spring b-btn-sm" onClick={onClose}>
            تایید و بستن
          </button>
        </div>
      </div>
    </div>
  );
}

/** برچسب خلاصه انتخاب برای نمایش در فرم */
export function regionSummary(sel: RegionSelection): string {
  const parts: string[] = [];
  if (sel.provinces.length > 0) parts.push(`${faNumber(sel.provinces.length)} استان`);
  if (sel.counties.length > 0) parts.push(`${faNumber(sel.counties.length)} شهرستان`);
  return parts.length ? parts.join(" + ") : "همه ایران";
}

/** نمایش کوچک انتخاب منطقه در فرم اطلاعیه */
export function RegionSelectionButton({
  selection, onOpen,
}: {
  selection: RegionSelection;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="b-input flex items-center justify-between gap-2 text-end"
      onClick={onOpen}
    >
      <span className="flex items-center gap-2 text-[14px]">
        <MapPin className="w-4 h-4 text-spring shrink-0" />
        {regionSummary(selection)}
      </span>
      <Loader2 className="w-3.5 h-3.5 text-stone rotate-90 hidden" />
      <ChevronLeft className="w-4 h-4 text-stone shrink-0" />
    </button>
  );
}
