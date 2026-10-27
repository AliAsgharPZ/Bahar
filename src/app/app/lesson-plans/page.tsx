"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NotebookPen, Loader2, Plus, CheckCheck, Trash2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey, faNumber } from "@/lib/persian";

type Plan = { id: string; teacherName: string; subjectName: string; className: string; topic: string; date: string; objectives: string | null; status: string };
type Coverage = { teacherId: string; teacherName: string; planned: number; taught: number };
type ClassRow = { id: string; name: string; academicYear: string };
type SubjectRow = { id: string; name: string };
type Me = { user: { role: string; id: string } };

export default function LessonPlansPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me?.user.role ?? "");
  const [classFilter, setClassFilter] = useState("");
  const { data, loading, error, refetch } = useApi<{ plans: Plan[]; coverage: Coverage[] }>(
    `/api/lesson-plans${classFilter ? `?classId=${classFilter}` : ""}`,
  );
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: subjectsData } = useApi<{ subjects: SubjectRow[] }>("/api/subjects");
  const [form, setForm] = useState({ classId: "", subjectId: "", topic: "", date: todayKey(), objectives: "" });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/lesson-plans", form);
      toast.success("طرح درس ثبت شد.");
      setForm((f) => ({ ...f, topic: "", objectives: "" }));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSaving(false); }
  }

  async function act(id: string, action: string) {
    setBusyId(id + action);
    try { await apiPost("/api/lesson-plans", { action, id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusyId(""); }
  }

  const plans = data?.plans ?? [];
  const coverage = data?.coverage ?? [];
  const taught = plans.filter((p) => p.status === "TAUGHT").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="طرح درس و بودجه‌بندی"
        desc="برای هر جلسه مبحث و اهداف را ثبت کنید؛ پوشش واقعی کلاس همیشه معلوم است."
        action={
          <Select value={classFilter} onChange={setClassFilter}
            options={[{ value: "", label: "همهٔ کلاس‌ها" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="فیلتر کلاس" />
        }
      />
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={NotebookPen} label="کل طرح درس‌ها" value={plans.length} tone="ink" />
          <StatCard icon={CheckCheck} label="تدریس‌شده" value={taught} tone="spring" />
          <StatCard icon={NotebookPen} label="درصد پوشش" value={plans.length ? `${faNumber(Math.round((taught / plans.length) * 100))}٪` : "—"} tone="soft" />
        </div>
      )}

      {!isManager && (
        <form onSubmit={add} className="b-card p-5 grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.classId} onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
              options={[{ value: "", label: "بدون کلاس مشخص" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">درس</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.subjectId} onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
              options={[{ value: "", label: "—" }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="درس" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">مبحث *</span>
            <input className="b-input" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="مثلاً کسرها — جمع کسرهای هم‌مخرج" required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">روز (شمسی) *</span>
            <input className="b-input" dir="ltr" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required /></label>
          <label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-[12px] font-bold">اهداف و شرح</span>
            <textarea className="b-input min-h-20" value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} /></label>
          <button className="b-btn b-btn-spring justify-self-start" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ثبت طرح درس
          </button>
        </form>
      )}

      {isManager && coverage.length > 0 && (
        <div className="b-card p-5">
          <b className="text-[13.5px] block mb-3">پوشش به‌ازای معلم</b>
          <div className="flex flex-col gap-2">
            {coverage.map((c) => (
              <div key={c.teacherId} className="flex items-center gap-3 text-[13px]">
                <span className="w-36 shrink-0 font-bold">{c.teacherName}</span>
                <span className="flex-1 h-2.5 rounded-full bg-cloud overflow-hidden">
                  <span className="block h-full bg-spring rounded-full" style={{ width: `${c.planned ? (c.taught / c.planned) * 100 : 0}%` }} />
                </span>
                <span className="text-steel shrink-0">{faNumber(c.taught)} از {faNumber(c.planned)} تدریس‌شده</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && plans.length === 0 && <EmptyState icon={NotebookPen} title="طرح درسی ثبت نشده" />}
      <div className="flex flex-col gap-2 b-auto-stagger">
        {plans.map((p) => (
          <div key={p.id} className="b-card-sm p-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="flex flex-col gap-0.5 min-w-0">
              <b className="text-[13.5px]">{p.topic}</b>
              <span className="text-[11.5px] text-steel">{p.teacherName} · {p.className || "—"} · {p.subjectName || "—"} · {p.date}</span>
              {p.objectives && <span className="text-[11.5px] text-steel line-clamp-1">{p.objectives}</span>}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className={`b-badge ${p.status === "TAUGHT" ? "b-badge-spring" : "b-badge-neutral"}`}>{p.status === "TAUGHT" ? "تدریس‌شده" : "برنامه‌ریزی‌شده"}</span>
              {p.status !== "TAUGHT" && (
                <button className="b-btn b-btn-spring b-btn-sm" disabled={busyId === p.id + "taught"} onClick={() => act(p.id, "taught")}>
                  <CheckCheck className="w-3.5 h-3.5" /> تدریس شد
                </button>
              )}
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busyId === p.id + "delete"} onClick={() => act(p.id, "delete")} aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
