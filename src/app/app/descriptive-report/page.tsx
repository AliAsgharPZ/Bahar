"use client";

import { useLang } from "@/lib/i18n";

import { useState } from "react";
import { toast } from "sonner";
import { FileBarChart, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type Row = { id: string; subjectId: string | null; subjectName: string; competency: string; level: string; term: number; note: string | null };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type SubjectRow = { id: string; name: string };
type Me = { user: { role: string } };



export default function DescriptiveReportPage() {
  const { t } = useLang();
  const LEVELS: Record<string, { label: string; cls: string }> = {
    VERY_GOOD: { label: t("enum.descriptiveLevel.VERY_GOOD"), cls: "b-badge-spring" },
    GOOD: { label: t("enum.descriptiveLevel.GOOD"), cls: "b-badge-soft" },
    ACCEPTABLE: { label: t("enum.descriptiveLevel.ACCEPTABLE"), cls: "b-badge-neutral" },
    NEEDS_WORK: { label: t("enum.descriptiveLevel.NEEDS_WORK"), cls: "b-badge-blossom" },
  };
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [term, setTerm] = useState(1);
  const [form, setForm] = useState({ subjectId: "", competency: "", level: "GOOD", note: "" });
  const [saving, setSaving] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data: subjectsData } = useApi<{ subjects: SubjectRow[] }>(!isAudience ? "/api/subjects" : null);
  const { data, loading, error, refetch } = useApi<{ rows: Row[] }>(
    isAudience ? "/api/descriptive-grades" : studentId ? `/api/descriptive-grades?studentId=${studentId}` : null,
  );

  const rows = (data?.rows ?? []).filter((r) => r.term === term);
  const bySubject = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.subjectName || t("settings.general")] ??= []).push(r);
    return acc;
  }, {});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/descriptive-grades", { ...form, studentId, term });
      toast.success(t("descriptiveReport.toast.added"));
      setForm((f) => ({ ...f, competency: "", note: "" }));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    try { await apiPost("/api/descriptive-grades", { action: "delete", id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.descriptiveReport")}
        desc={t("descriptiveReport.desc")}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {!isAudience && (
              <>
                <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
                  options={[{ value: "", label: t("descriptiveReport.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("descriptiveReport.select.class")} />
                <Select value={studentId} onChange={setStudentId}
                  options={[{ value: "", label: t("descriptiveReport.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("descriptiveReport.select.student")} />
              </>
            )}
            <div className="flex rounded-full bg-cloud p-1">
              {[1, 2].map((tt) => (
                <button key={tt} onClick={() => setTerm(tt)} className={`px-3 py-1 rounded-full text-[12px] font-bold ${term === tt ? "bg-white shadow-sm" : "text-steel"}`}>{t("descriptiveReport.term.label")} {tt === 1 ? t("descriptiveReport.term.first") : t("descriptiveReport.term.second")}</button>
              ))}
            </div>
            {(isAudience || studentId) && rows.length > 0 && (
              <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("descriptiveReport.print")}</button>
            )}
          </div>
        }
      />

      {!isAudience && !studentId && <EmptyState icon={FileBarChart} title={t("descriptiveReport.empty.selectStudent")} />}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {!isAudience && studentId && (
        <form onSubmit={add} className="b-card p-5 grid md:grid-cols-[1fr_1.4fr_150px_auto] gap-3 items-end">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("descriptiveReport.field.subject")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.subjectId} onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
              options={[{ value: "", label: t("settings.general") }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("settings.general")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("descriptiveReport.field.competency")}</span>
            <input className="b-input" value={form.competency} onChange={(e) => setForm((f) => ({ ...f, competency: e.target.value }))} placeholder={t("descriptiveReport.placeholder.competency")} required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("descriptiveReport.field.level")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.level} onChange={(v) => setForm((f) => ({ ...f, level: v }))}
              options={Object.entries(LEVELS).map(([value, l]) => ({ value, label: l.label }))} placeholder={t("descriptiveReport.field.level")} /></label>
          <button className="b-btn b-btn-spring" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("descriptiveReport.submit")}</button>
        </form>
      )}

      {(isAudience || studentId) && data && rows.length === 0 && <EmptyState icon={FileBarChart} title={t("descriptiveReport.empty.noRow")} />}
      {Object.entries(bySubject).map(([subject, list]) => (
        <div key={subject} className="b-card p-5">
          <b className="text-[14px] block mb-3">{subject} ({faNumber(list.length)} {t("descriptiveReport.competencies")})</b>
          <div className="flex flex-col">
            {list.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-hairline last:border-0">
                <span className="text-[14px]">{r.competency}{r.note ? <span className="block text-[12px] text-steel mt-0.5">{r.note}</span> : null}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`b-badge ${LEVELS[r.level]?.cls ?? "b-badge-neutral"}`}>{LEVELS[r.level]?.label ?? r.level}</span>
                  {!isAudience && <button className="b-btn b-btn-ghost text-steel hover:text-destructive" onClick={() => del(r.id)} aria-label={t("common.delete")}><Trash2 className="w-4 h-4" /></button>}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
