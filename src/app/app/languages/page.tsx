"use client";

import { useState } from "react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

type PackRow = { code: string; name: string; nativeName: string; direction: string; keyCount: number; coverage: number; missingKeys: string[]; status?: string };
type WorldLanguage = { code: string; nameFa: string; nameEn: string; nativeName: string };
type CoverageData = { catalogSize: number; domains: Record<string, number>; shipped: PackRow[]; dbPacks: PackRow[]; worldLanguages?: WorldLanguage[] };

export default function LanguagesPage() {
  const { data, loading, error } = useApi<CoverageData>("/api/languages/coverage");
  const [showMissing, setShowMissing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="زبان‌ها و پوشش ترجمه" desc="کاتالوگ، پوشش واقعی هر بسته و کلیدهای ترجمه‌نشده — کلید ترجمه‌نشده به فارسی پایه بازمی‌گردد." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="b-card p-6 flex flex-col gap-2">
            <b className="text-[14px]">کاتالوگ: {faNumber(data.catalogSize)} کلید</b>
            <p className="text-[13px] text-steel">
              {Object.entries(data.domains).map(([d, n]) => `${d}: ${faNumber(n)}`).join(" · ")}
            </p>
            <p className="text-[12.5px] text-steel">
              کاتالوگ فقط رشته‌های رابط کاربری است؛ جمله‌های راهنمای اضافی در کاتالوگ نیستند و به‌عنوان ترجمه شمرده نمی‌شوند.
            </p>
          </div>
          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">بسته‌های همراه سامانه</b>
            {data.shipped.map((p) => (
              <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                <span><b>{p.name} ({p.code})</b><span className="text-steel"> — {p.nativeName} · {faNumber(p.keyCount)} از {faNumber(data.catalogSize)} کلید · پوشش {faNumber(p.coverage)}٪</span></span>
                {p.missingKeys.length > 0 && (
                  <button className="b-btn b-btn-ghost mt-1" onClick={() => setShowMissing(showMissing === p.code ? null : p.code)}>
                    {showMissing === p.code ? "پنهان‌کردن کلیدهای ترجمه‌نشده" : `دیدن ${faNumber(p.missingKeys.length)} کلید ترجمه‌نشده`}
                  </button>
                )}
                {showMissing === p.code && <p className="text-[12px] text-steel mt-1" dir="ltr">{p.missingKeys.join(", ")}</p>}
              </div>
            ))}
          </div>
          {data.dbPacks.length > 0 && (
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">بسته‌های پایگاه داده (آپلودی)</b>
              {data.dbPacks.map((p) => (
                <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                  <b>{p.name} ({p.code})</b><span className="text-steel"> — پوشش {faNumber(p.coverage)}٪ · {faNumber(p.missingKeys.length)} کلید ترجمه‌نشده</span>
                </div>
              ))}
            </div>
          )}
          {data.worldLanguages && (
            <div className="b-card p-6 flex flex-col gap-2">
              <b className="text-[14px]">فهرست نام همهٔ زبان‌های جهان — {faNumber(data.worldLanguages.length)} زبان</b>
              <p className="text-[12.5px] text-steel">
                این فهرست فقط نام زبان‌هاست (فارسی + انگلیسی + نام بومی، منبع ICU/CLDR)؛ ترجمهٔ کامل کاتالوگ فعلاً فقط
                برای {faNumber(data.shipped.length)} بستهٔ همراه سامانه موجود است و بقیه با واردات بستهٔ تازه (سوپرادمین)
                پر می‌شوند — این فهرست هرگز بستهٔ کامل شمرده نمی‌شود.
              </p>
              <p className="text-[12.5px] text-steel leading-7">{data.worldLanguages.map((l) => `${l.nameFa} (${l.nativeName})`).join(" · ")}</p>
            </div>
          )}
          <p className="text-[12.5px] text-steel">بارگذاری بستهٔ تازه همچنان فقط برای سوپرادمین و از مسیر /api/languages انجام می‌شود؛ این صفحه فقط گزارش پوشش است.</p>
        </>
      )}
    </div>
  );
}
