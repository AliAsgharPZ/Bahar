"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe2, Loader2, Save } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { convertScore } from "@/lib/grades-scale";

type Locale = { id: string; name: string; calendarSystem: string; gradingScale: string; currencyLabel: string; weekStart: string };
type Opt = { value: string; label: string };

export default function LocaleSettingsPage() {
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
      await apiSend(val);
      toast.success("پروفایل کشور ذخیره شد.");
      setDraft(null);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="پروفایل کشور مدرسه" desc="تقویم، مقیاس نمره، واحد پول و آغاز هفته — تا سامانه با ساختار آموزشی کشور شما هماهنگ شود." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && val && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="b-card p-6 flex flex-col gap-4">
            <b className="text-[14px] flex items-center gap-2"><Globe2 className="w-4 h-4 text-spring" /> {data.locale.name}</b>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">تقویم سامانه</span>
              <Select className="w-full" buttonClassName="!w-full" value={val.calendarSystem} onChange={(v) => set({ calendarSystem: v })}
                options={data.calendars} placeholder="تقویم" /></label>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">مقیاس نمره</span>
              <Select className="w-full" buttonClassName="!w-full" value={val.gradingScale} onChange={(v) => set({ gradingScale: v })}
                options={data.scales} placeholder="مقیاس" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">واحد پول</span>
                <input className="b-input" value={val.currencyLabel} onChange={(e) => set({ currencyLabel: e.target.value })} placeholder="تومان" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">آغاز هفته</span>
                <Select className="w-full" buttonClassName="!w-full" value={val.weekStart} onChange={(v) => set({ weekStart: v })}
                  options={[{ value: "SATURDAY", label: "شنبه" }, { value: "SUNDAY", label: "یکشنبه" }, { value: "MONDAY", label: "دوشنبه" }]} placeholder="آغاز هفته" /></label>
            </div>
            <button className="b-btn b-btn-spring self-start" disabled={saving} onClick={save}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره
            </button>
            <p className="text-[11.5px] text-steel">مقیاس نمره از همین حالا روی ستون «نمره در مقیاس مدرسه» در خروجی اکسل و CSV نمرات اعمال می‌شود.</p>
          </div>

          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">مبدل زندهٔ نمره</b>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">نمره از ۲۰</span>
              <input className="b-input w-36" dir="ltr" inputMode="decimal" value={sample} onChange={(e) => setSample(e.target.value)} /></label>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <span className="rounded-xl bg-cloud p-3">از ۱۰۰: <b>{convertScore(Number(sample) || 0, "SCORE100")}</b></span>
              <span className="rounded-xl bg-cloud p-3">GPA: <b>{convertScore(Number(sample) || 0, "GPA4")}</b></span>
              <span className="rounded-xl bg-cloud p-3">حرفی: <b>{convertScore(Number(sample) || 0, "LETTER")}</b></span>
              <span className="rounded-xl bg-cloud p-3">مقیاس فعلی مدرسه: <b>{convertScore(Number(sample) || 0, val.gradingScale)}</b></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function apiSend(val: Locale) {
  const res = await fetch("/api/school-locale", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarSystem: val.calendarSystem, gradingScale: val.gradingScale,
      currencyLabel: val.currencyLabel, weekStart: val.weekStart,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? "خطا در ذخیره");
  return j;
}
