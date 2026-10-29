"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type ClassRow = { id: string; name: string; academicYear: string };
type SubjectRow = { id: string; name: string };
type Group = { members: { id: string; name: string; avg: number | null }[]; avg: number | null };

export default function StudyGroupsPage() {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [size, setSize] = useState("4");
  const [result, setResult] = useState<{ class: { name: string }; subject: string | null; groups: Group[]; ungraded: number; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: subjectsData } = useApi<{ subjects: SubjectRow[] }>("/api/subjects");

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/study-groups?classId=${classId}&subjectId=${subjectId}&size=${size}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا");
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="گروه‌های مطالعه" desc="پیشنهاد گروه‌بندی متوازن دانش‌آموزان یک کلاس بر اساس میانگین نمره (مارپیچ: قوی و ضعیف در هر گروه) — گروه‌ها ذخیره نمی‌شوند و داده تغییر نمی‌کند." />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">کلاس</span>
          <Select value={classId} onChange={setClassId} options={[{ value: "", label: "نخستین کلاس مدرسه" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder="کلاس" />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">درس (اختیاری)</span>
          <Select value={subjectId} onChange={setSubjectId} options={[{ value: "", label: "همهٔ درس‌ها (میانگین کل)" }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="درس" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-sm font-bold">اندازهٔ گروه</span>
          <Select value={size} onChange={setSize} options={[{ value: "3", label: "۳ نفر" }, { value: "4", label: "۴ نفر" }, { value: "5", label: "۵ نفر" }, { value: "6", label: "۶ نفر" }]} placeholder="اندازه" />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? "در حال ساخت…" : "ساختن گروه‌ها"}</button>
      </div>

      {!result && <p className="t-sm text-steel">کلاس را انتخاب کنید و «ساختن گروه‌ها» را بزنید.</p>}
      {result && (
        <>
          <p className="t-sm text-steel">
            کلاس {result.class.name}{result.subject ? ` · درس ${result.subject}` : " · همهٔ درس‌ها"}
            {result.ungraded > 0 ? ` · ${result.ungraded} دانش‌آموز بدون نمره در انتهای فهرست قرار گرفتند.` : ""}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.groups.map((g, i) => (
              <div key={i} className="b-card p-4 md:p-5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[14.5px]">گروه {i + 1}</b>
                  <span className="b-badge b-badge-spring">{g.avg !== null ? `میانگین ${g.avg}` : "بدون میانگین"}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {g.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <span className="text-steel shrink-0">{m.avg !== null ? m.avg : "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="t-sm text-steel">{result.note}</p>
        </>
      )}
    </div>
  );
}
