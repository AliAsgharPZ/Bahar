"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Loader2, Save } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { convertScore } from "@/lib/grades-scale";
import { useLang } from "@/lib/i18n";

type Locale = { id: string; name: string; calendarSystem: string; gradingScale: string; currencyLabel: string; weekStart: string };
type Opt = { value: string; label: string };

export default function LocaleSettingsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<{ locale: Locale; scales: Opt[]; calendars: Opt[] }>("/api/school-locale");
  const [draft, setDraft] = useState<Locale | null>(null);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState("17.5");

  const val = draft ?? data?.locale;
  const set = (patch: Partial<Locale>) => val && setDraft({ ...val, ...patch });

  async function save() {
    if (!val) return;
    setSaving(true);
    try {
      await apiSend(val, t("localeSettings.saveError"));
      toast.success(t("localeSettings.saved"));
      setDraft(null);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("localeSettings.title")} desc={t("localeSettings.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && val && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="b-card p-6 flex flex-col gap-4">
            <b className="text-[14px] flex items-center gap-2"><Globe2 className="w-4 h-4 text-spring" /> {data.locale.name}</b>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("localeSettings.calendar")}</span>
              <Select className="w-full" buttonClassName="!w-full" value={val.calendarSystem} onChange={(v) => set({ calendarSystem: v })}
                options={data.calendars} placeholder={t("localeSettings.calendarPlaceholder")} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("localeSettings.scale")}</span>
              <Select className="w-full" buttonClassName="!w-full" value={val.gradingScale} onChange={(v) => set({ gradingScale: v })}
                options={data.scales} placeholder={t("localeSettings.scalePlaceholder")} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("localeSettings.currency")}</span>
                <input className="b-input" value={val.currencyLabel} onChange={(e) => set({ currencyLabel: e.target.value })} placeholder={t("localeSettings.currencyPlaceholder")} /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("localeSettings.weekStart")}</span>
                <Select className="w-full" buttonClassName="!w-full" value={val.weekStart} onChange={(v) => set({ weekStart: v })}
                  options={[{ value: "SATURDAY", label: t("localeSettings.weekday.saturday") }, { value: "SUNDAY", label: t("localeSettings.weekday.sunday") }, { value: "MONDAY", label: t("localeSettings.weekday.monday") }]} placeholder={t("localeSettings.weekStart")} /></label>
            </div>
            <button className="b-btn b-btn-spring self-start" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("common.save")}
            </button>
            <p className="text-[11.5px] text-steel">{t("localeSettings.scaleNote")}</p>
          </div>

          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">{t("localeSettings.converter")}</b>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("localeSettings.score20")}</span>
              <input className="b-input w-36" dir="ltr" inputMode="decimal" value={sample} onChange={(e) => setSample(e.target.value)} /></label>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <span className="rounded-xl bg-cloud p-3">{t("localeSettings.outOf100")} <b>{convertScore(Number(sample) || 0, "SCORE100")}</b></span>
              <span className="rounded-xl bg-cloud p-3">GPA: <b>{convertScore(Number(sample) || 0, "GPA4")}</b></span>
              <span className="rounded-xl bg-cloud p-3">{t("localeSettings.letter")} <b>{convertScore(Number(sample) || 0, "LETTER")}</b></span>
              <span className="rounded-xl bg-cloud p-3">{t("localeSettings.currentScale")} <b>{convertScore(Number(sample) || 0, val.gradingScale)}</b></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function apiSend(val: Locale, saveError: string) {
  const res = await fetch("/api/school-locale", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarSystem: val.calendarSystem, gradingScale: val.gradingScale,
      currencyLabel: val.currencyLabel, weekStart: val.weekStart,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? saveError);
  return j;
}
