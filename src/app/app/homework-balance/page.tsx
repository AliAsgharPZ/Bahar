"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type ClassRow = { id: string; name: string; academicYear: string };
type WeekRow = {
  label: string; count: number; overload: boolean;
  bySubject: { name: string; count: number }[];
  pileups: { date: string; count: number }[];
  items: { id: string; title: string; subject: string; dueDate: string }[];
};

export default function HomeworkBalancePage() {
  const [classId, setClassId] = useState("");
  const [weeks, setWeeks] = useState("4");
  const [result, setResult] = useState<{ class: { name: string }; weeks: WeekRow[]; summary: { total: number; overloadWeeks: number; lightestWeek: { label: string; count: number } | null; suggestion: string } } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/homework-balance?classId=${classId}&weeks=${weeks}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا");
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="تعادل تکالیف" desc="تراکم تکالیف هر کلاس در هفته‌های آینده، هفته‌های پرتراکم و سبک‌ترین هفته برای جابه‌جایی — فقط خواندنی، بدون تغییر داده." />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">کلاس</span>
          <Select value={classId} onChange={setClassId} options={[{ value: "", label: "نخستین کلاس مدرسه" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder="کلاس" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-sm font-bold">بازه</span>
          <Select value={weeks} onChange={setWeeks} options={[{ value: "2", label: "۲ هفته" }, { value: "4", label: "۴ هفته" }, { value: "8", label: "۸ هفته" }]} placeholder="بازه" />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? "در حال بررسی…" : "نمایش"}</button>
      </div>

      {!result && <p className="t-sm text-steel">کلاس و بازه را انتخاب کنید و «نمایش» را بزنید.</p>}
      {result && (
        <>
          <div className="b-card p-4 md:p-5">
            <div className="font-bold">کلاس {result.class.name} — مجموع {result.summary.total} تکلیف در بازه</div>
            <p className="t-sm text-steel mt-1">{result.summary.suggestion}</p>
            {result.summary.overloadWeeks > 0 && (
              <p className="t-sm font-bold text-blossom mt-1">{result.summary.overloadWeeks} هفته پرتراکم شناسایی شد.</p>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {result.weeks.map((w) => (
              <div key={w.label} className="b-card p-4 md:p-5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[14.5px]">{w.label}</b>
                  <span className={`b-badge ${w.overload ? "b-badge-blossom" : "b-badge-spring"}`}>
                    {w.count} تکلیف{w.overload ? " · پرتراکم" : ""}
                  </span>
                </div>
                {w.bySubject.length > 0 && (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm min-w-[240px]">
                      <tbody>
                        {w.bySubject.map((s) => (
                          <tr key={s.name} className="border-t border-hairline-soft">
                            <td className="py-1.5 pl-2">{s.name}</td>
                            <td className="py-1.5 text-left font-bold">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {w.pileups.length > 0 && (
                  <p className="t-sm text-blossom mt-2">
                    تجمع در یک روز: {w.pileups.map((p) => `${p.date} (${p.count} تکلیف)`).join("، ")}
                  </p>
                )}
                {w.items.length === 0 && <p className="t-sm text-steel mt-2">تکلیفی در این هفته نیست.</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
