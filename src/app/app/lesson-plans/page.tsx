"use client";

import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
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
      toast.success(t("lessonPlans.toast.added"));
      setForm((f) => ({ ...f, topic: "", objectives: "" }));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  async function act(id: string, action: string) {
    setBusyId(id + action);
    try { await apiPost("/api/lesson-plans", { action, id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusyId(""); }
  }

  const plans = data?.plans ?? [];
  const coverage = data?.coverage ?? [];
  const taught = plans.filter((p) => p.status === "TAUGHT").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.lessonPlans")}
        desc={t("lessonPlans.desc")}
        action={
          <Select value={classFilter} onChange={setClassFilter}
            options={[{ value: "", label: t("lessonPlans.filter.allClasses") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("lessonPlans.filter.classPlaceholder")} />
        }
      />
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={NotebookPen} label={t("lessonPlans.stat.total")} value={plans.length} tone="ink" />
          <StatCard icon={CheckCheck} label={t("lessonPlans.stat.taught")} value={taught} tone="spring" />
          <StatCard icon={NotebookPen} label={t("lessonPlans.stat.coverage")} value={plans.length ? `${faNumber(Math.round((taught / plans.length) * 100))}٪` : "—"} tone="soft" />
        </div>
      )}

      {!isManager && (
        <form onSubmit={add} className="b-card p-5 grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.classId} onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
              options={[{ value: "", label: t("lessonPlans.noClass") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("lessonPlans.field.subject")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.subjectId} onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
              options={[{ value: "", label: "—" }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("lessonPlans.field.subject")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("lessonPlans.field.topic")}</span>
            <input className="b-input" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder={t("lessonPlans.placeholder.topic")} required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("lessonPlans.field.date")}</span>
            <input className="b-input" dir="ltr" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required /></label>
          <label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-[12px] font-bold">{t("lessonPlans.field.objectives")}</span>
            <textarea className="b-input min-h-20" value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} /></label>
          <button className="b-btn b-btn-spring justify-self-start" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("lessonPlans.submit")}
          </button>
        </form>
      )}

      {isManager && coverage.length > 0 && (
        <div className="b-card p-5">
          <b className="text-[14px] block mb-3">{t("lessonPlans.coverage.title")}</b>
          <div className="flex flex-col gap-2">
            {coverage.map((c) => (
              <div key={c.teacherId} className="flex items-center gap-3 text-[14px]">
                <span className="w-36 shrink-0 font-bold">{c.teacherName}</span>
                <span className="flex-1 h-2.5 rounded-full bg-cloud overflow-hidden">
                  <span className="block h-full bg-spring rounded-full" style={{ width: `${c.planned ? (c.taught / c.planned) * 100 : 0}%` }} />
                </span>
                <span className="text-steel shrink-0">{faNumber(c.taught)} {t("common.from")} {faNumber(c.planned)} {t("lessonPlans.stat.taught")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && plans.length === 0 && <EmptyState icon={NotebookPen} title={t("lessonPlans.empty.noPlan")} />}
      <div className="flex flex-col gap-2 b-auto-stagger">
        {plans.map((p) => (
          <div key={p.id} className="b-card-sm p-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="flex flex-col gap-0.5 min-w-0">
              <b className="text-[14px]">{p.topic}</b>
              <span className="text-[12px] text-steel">{p.teacherName} · {p.className || "—"} · {p.subjectName || "—"} · {p.date}</span>
              {p.objectives && <span className="text-[12px] text-steel line-clamp-1">{p.objectives}</span>}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className={`b-badge ${p.status === "TAUGHT" ? "b-badge-spring" : "b-badge-neutral"}`}>{p.status === "TAUGHT" ? t("lessonPlans.stat.taught") : t("lessonPlans.status.planned")}</span>
              {p.status !== "TAUGHT" && (
                <button className="b-btn b-btn-spring b-btn-sm" disabled={busyId === p.id + "taught"} onClick={() => act(p.id, "taught")}>
                  <CheckCheck className="w-3.5 h-3.5" /> {t("lessonPlans.markTaught")}
                </button>
              )}
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busyId === p.id + "delete"} onClick={() => act(p.id, "delete")} aria-label={t("common.delete")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
