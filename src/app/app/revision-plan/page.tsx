"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Session = { date: string; examTitle: string; examDate: string; subject: string; minutes: number; focusWeak: boolean; step: string };

export default function RevisionPlanPage() {
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<{ student: { name: string }; weakSubjects: { name: string; avg: number }[]; sessions: Session[]; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);

  async function run() {
    if (!studentId) { toast.error("دانش‌آموز را انتخاب کنید."); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/revision-plan?studentId=${studentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا");
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="برنامه مرور امتحان" desc="زمان‌بندی مرور فاصله‌دار (۷/۳/۱ روز قبل از هر امتحان) با اولویت درس‌های ضعیف‌تر — فقط پیشنهاد است و ذخیره نمی‌شود." />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">کلاس</span>
          <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder="کلاس" />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">دانش‌آموز</span>
          <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="دانش‌آموز" />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? "در حال ساخت…" : "ساختن برنامه"}</button>
      </div>

      {!result && <p className="t-sm text-steel">کلاس و دانش‌آموز را انتخاب کنید و «ساختن برنامه» را بزنید.</p>}
      {result && (
        <>
          {result.weakSubjects.length > 0 && (
            <div className="b-card p-4 md:p-5">
              <b>ضعیف‌ترین درس‌ها: </b>
              <span className="t-sm text-steel">{result.weakSubjects.map((s) => `${s.name} (${s.avg})`).join("، ")}</span>
            </div>
          )}
          {result.sessions.length === 0 && <p className="t-sm text-steel">امتحانی در ۳۰ روز آینده نیست.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px] b-card">
              <thead>
                <tr className="border-b border-hairline-soft text-right">
                  <th className="py-2 px-3">تاریخ مرور</th>
                  <th className="py-2 px-3">امتحان</th>
                  <th className="py-2 px-3">درس</th>
                  <th className="py-2 px-3">مرحله</th>
                  <th className="py-2 px-3">مدت</th>
                </tr>
              </thead>
              <tbody>
                {result.sessions.map((s, i) => (
                  <tr key={i} className="border-t border-hairline-soft">
                    <td className="py-2 px-3 font-bold">{s.date}</td>
                    <td className="py-2 px-3 min-w-0">{s.examTitle} ({s.examDate})</td>
                    <td className="py-2 px-3">{s.subject}{s.focusWeak ? " · ضعیف" : ""}</td>
                    <td className="py-2 px-3">{s.step}</td>
                    <td className="py-2 px-3">{s.minutes} دقیقه</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-sm text-steel">{result.note}</p>
        </>
      )}
    </div>
  );
}
