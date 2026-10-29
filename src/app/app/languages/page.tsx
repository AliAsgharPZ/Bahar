"use client";

import { useState } from "react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type PackRow = { code: string; name: string; nativeName: string; direction: string; keyCount: number; coverage: number; missingKeys: string[]; status?: string };
type WorldLanguage = { code: string; nameFa: string; nameEn: string; nativeName: string };
type CoverageData = { catalogSize: number; domains: Record<string, number>; shipped: PackRow[]; dbPacks: PackRow[]; worldLanguages?: WorldLanguage[] };

export default function LanguagesPage() {
  const { t } = useLang();
  const { data, loading, error } = useApi<CoverageData>("/api/languages/coverage");
  const [showMissing, setShowMissing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.languages")} desc={t("languages.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="b-card p-6 flex flex-col gap-2">
            <b className="text-[14px]">{t("languages.catalogPrefix")} {faNumber(data.catalogSize)} {t("languages.keyUnit")}</b>
            <p className="text-[13px] text-steel">
              {Object.entries(data.domains).map(([d, n]) => `${d}: ${faNumber(n)}`).join(" · ")}
            </p>
            <p className="text-[12.5px] text-steel">{t("languages.catalogNote")}</p>
          </div>
          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">{t("languages.shippedTitle")}</b>
            {data.shipped.map((p) => (
              <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                <span><b>{p.name} ({p.code})</b><span className="text-steel"> — {p.nativeName} · {faNumber(p.keyCount)} {t("common.from")} {faNumber(data.catalogSize)} {t("languages.keyUnit")} · {t("languages.coverage")} {faNumber(p.coverage)}٪</span></span>
                {p.missingKeys.length > 0 && (
                  <button className="b-btn b-btn-ghost mt-1" onClick={() => setShowMissing(showMissing === p.code ? null : p.code)}>
                    {showMissing === p.code ? t("languages.hideMissing") : `${t("languages.showMissingPrefix")} ${faNumber(p.missingKeys.length)} ${t("languages.missingUnit")}`}
                  </button>
                )}
                {showMissing === p.code && <p className="text-[12px] text-steel mt-1" dir="ltr">{p.missingKeys.join(", ")}</p>}
              </div>
            ))}
          </div>
          {data.dbPacks.length > 0 && (
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">{t("languages.dbTitle")}</b>
              {data.dbPacks.map((p) => (
                <div key={p.code} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                  <b>{p.name} ({p.code})</b><span className="text-steel"> — {t("languages.coverage")} {faNumber(p.coverage)}٪ · {faNumber(p.missingKeys.length)} {t("languages.missingUnit")}</span>
                </div>
              ))}
            </div>
          )}
          {data.worldLanguages && (
            <div className="b-card p-6 flex flex-col gap-2">
              <b className="text-[14px]">{t("languages.worldTitle")} — {faNumber(data.worldLanguages.length)} {t("languages.worldUnit")}</b>
              <p className="text-[12.5px] text-steel">{t("languages.worldNoteBefore")} {faNumber(data.shipped.length)} {t("languages.worldNoteAfter")}</p>
              <p className="text-[12.5px] text-steel leading-7">{data.worldLanguages.map((l) => `${l.nameFa} (${l.nativeName})`).join(" · ")}</p>
            </div>
          )}
          <p className="text-[12.5px] text-steel">{t("languages.uploadNote")}</p>
        </>
      )}
    </div>
  );
}
