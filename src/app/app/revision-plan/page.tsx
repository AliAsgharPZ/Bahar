"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Session = { date: string; examId: string; examTitle: string; examDate: string; subject: string; minutes: number; focusWeak: boolean; step: string };
type ExamRow = { id: string; title: string; startsAt: string };

export default function RevisionPlanPage() {
  const { t } = useLang();
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<{ student: { name: string }; weakSubjects: { name: string; avg: number }[]; exams: ExamRow[]; sessions: Session[]; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Record<string, { created: number; skipped: number; total: number }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);

  async function run() {
    if (!studentId) { toast.error(t("revisionPlan.selectStudent")); return; }
    setBusy(true);
    setSaved({});
    try {
      const res = await fetch(`/api/revision-plan?studentId=${studentId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? t("common.errorShort"));
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(false); }
  }

  async function save(examId: string) {
    setSavingId(examId);
    try {
      const res = await apiPost<{ created: number; skipped: number; total: number }>("/api/revision-plan", { studentId, examId });
      setSaved((m) => ({ ...m, [examId]: res }));
      const parts = [`${faNumber(res.created)} ${t("revisionPlan.savedUnit")}`];
      if (res.skipped > 0) parts.push(`${faNumber(res.skipped)} ${t("revisionPlan.skippedUnit")}`);
      toast.success(parts.join("، "));
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSavingId(null); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("revisionPlan.title")} desc={t("revisionPlan.desc")} />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">{t("common.class")}</span>
          <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: t("revisionPlan.selectClass") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder={t("common.class")} />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">{t("common.student")}</span>
          <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: t("revisionPlan.selectStudentOption") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? t("revisionPlan.building") : t("revisionPlan.build")}</button>
      </div>

      {!result && <p className="t-sm text-steel">{t("revisionPlan.hint")}</p>}
      {result && (
        <>
          {result.weakSubjects.length > 0 && (
            <div className="b-card p-4 md:p-5">
              <b>{t("revisionPlan.weakestPrefix")} </b>
              <span className="t-sm text-steel">{result.weakSubjects.map((s) => `${s.name} (${s.avg})`).join("، ")}</span>
            </div>
          )}
          {result.exams.length === 0 && <p className="t-sm text-steel">{t("revisionPlan.noExams")}</p>}
          {result.exams.length > 0 && <p className="t-sm text-steel">{t("revisionPlan.saveHint")}</p>}
          <div className="grid md:grid-cols-2 gap-4">
            {result.exams.map((ex) => {
              const exSessions = result.sessions.filter((s) => s.examId === ex.id);
              const sv = saved[ex.id];
              const done = sv && sv.created + sv.skipped >= sv.total && sv.total > 0;
              return (
                <div key={ex.id} className="b-card p-4 md:p-5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-[14.5px] min-w-0 truncate">{ex.title} · {ex.startsAt.slice(0, 10)}</b>
                    {exSessions.length > 0 && !done && (
                      <button className="b-btn b-btn-sm b-btn-ink shrink-0" onClick={() => save(ex.id)} disabled={savingId === ex.id}>
                        {savingId === ex.id ? t("revisionPlan.saving") : t("revisionPlan.save")}
                      </button>
                    )}
                  </div>
                  {exSessions.length === 0 && <p className="t-sm text-steel mt-2">{t("revisionPlan.noSessions")}</p>}
                  {exSessions.length > 0 && (
                    <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm min-w-[520px]">
                      <tbody>
                        {exSessions.map((s, i) => (
                          <tr key={i} className="border-t border-hairline-soft">
                            <td className="py-1.5 pe-2 font-bold">{s.date}</td>
                            <td className="py-1.5 pe-2">{s.subject}{s.focusWeak ? ` · ${t("revisionPlan.weakTag")}` : ""}</td>
                            <td className="py-1.5 pe-2">{s.step}</td>
                            <td className="py-1.5 text-end">{s.minutes} {t("dashboard.uptime.minute")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                  {done && sv && (
                    <p className="t-sm font-bold text-spring-deep mt-2">
                      {faNumber(sv.created)} {t("revisionPlan.savedUnit")}{sv.skipped > 0 ? `، ${faNumber(sv.skipped)} ${t("revisionPlan.skippedUnit")}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="t-sm text-steel">{result.note}</p>
        </>
      )}
    </div>
  );
}
