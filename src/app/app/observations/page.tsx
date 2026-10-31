"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, Save, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber, formatDateFa } from "@/lib/persian";
import { useLang } from "@/lib/i18n";
import { OBSERVATION_CRITERIA } from "@/lib/observations";

type ObsRow = {
  id: string; teacherId: string; teacherName: string; observerName: string;
  classId: string | null; className: string | null; date: string; topic: string | null;
  scores: Record<string, number>; average: number;
  strengths: string | null; growthAreas: string | null; comment: string | null;
};
type ObsData = {
  observations: ObsRow[];
  teachers: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  canWrite: boolean;
};
type PlanRow = { id: string; teacherId: string; topic: string; date: string; subjectName?: string };

export default function ObservationsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<ObsData>("/api/observations");
  const canWrite = data?.canWrite ?? false;

  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const [topic, setTopic] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState("");
  const [growthAreas, setGrowthAreas] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // اتصال به ماژول طرح درس: طرح‌های همان معلم برای همان کلاس، برای پرکردن سریع موضوع
  const { data: plansData } = useApi<{ plans: PlanRow[] }>(
    canWrite && teacherId && classId ? `/api/lesson-plans?classId=${classId}` : null,
  );
  const teacherPlans = (plansData?.plans ?? []).filter((p) => p.teacherId === teacherId).slice(0, 6);

  async function save() {
    if (!teacherId) { toast.error(t("observations.err.teacher")); return; }
    setSaving(true);
    try {
      await apiPost("/api/observations", {
        teacherId, classId: classId || undefined, date: date || undefined, topic,
        scores, strengths, growthAreas, comment,
      });
      toast.success(t("observations.toast.saved"));
      setTopic(""); setScores({}); setStrengths(""); setGrowthAreas(""); setComment(""); setDate("");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm(t("observations.deleteConfirm"))) return;
    try {
      await apiDelete(`/api/observations?id=${id}`);
      toast.success(t("observations.toast.deleted"));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("observations.title")} desc={t("observations.desc")} />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {data && canWrite && (
        <div className="b-card p-5 flex flex-col gap-4">
          <b className="text-[14px] flex items-center gap-2"><Eye className="w-4 h-4 text-spring" /> {t("observations.new")}</b>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.teacher")}</span>
              <Select
                value={teacherId} onChange={setTeacherId} placeholder={t("observations.selectTeacher")}
                options={data.teachers.map((x) => ({ value: x.id, label: x.name }))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.class")}</span>
              <Select
                value={classId} onChange={setClassId} placeholder={t("observations.noClass")}
                options={[{ value: "", label: t("observations.noClass") }, ...data.classes.map((x) => ({ value: x.id, label: x.name }))]}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.date")}</span>
              <input type="date" className="b-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.topic")}</span>
              <input className="b-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("observations.topicPlaceholder")} />
            </label>
          </div>

          {teacherPlans.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-bold text-steel">{t("observations.fromPlan")}</span>
              {teacherPlans.map((p) => (
                <button
                  key={p.id} type="button"
                  className="b-btn b-btn-soft b-btn-sm"
                  onClick={() => setTopic(p.topic)}
                >
                  {p.topic}{p.subjectName ? ` · ${p.subjectName}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold">{t("observations.scores")}</span>
            {OBSERVATION_CRITERIA.map((c) => (
              <div key={c.key} className="flex items-center gap-3 flex-wrap">
                <span className="text-[12.5px] w-52 shrink-0">{t(`observations.crit.${c.key}`)}</span>
                <div className="flex gap-1.5" role="radiogroup" aria-label={t(`observations.crit.${c.key}`)}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v} type="button" role="radio" aria-checked={scores[c.key] === v}
                      className={`w-10 h-10 rounded-full text-[13px] font-bold transition-colors ${scores[c.key] === v ? "bg-spring text-white" : "bg-cloud text-steel hover:bg-spring-tint"}`}
                      onClick={() => setScores((s) => ({ ...s, [c.key]: v }))}
                    >
                      {faNumber(v)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.strengths")}</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder={t("observations.strengthsPlaceholder")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.growthAreas")}</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={growthAreas} onChange={(e) => setGrowthAreas(e.target.value)} placeholder={t("observations.growthAreasPlaceholder")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("observations.comment")}</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </div>

          <button className="b-btn b-btn-spring self-start" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("observations.save")}
          </button>
        </div>
      )}

      {data && data.observations.length === 0 && (
        <EmptyState icon={Eye} title={canWrite ? t("observations.empty") : t("observations.emptyTeacher")} />
      )}

      {data && data.observations.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.observations.map((o) => (
            <article key={o.id} className="b-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <b className="text-[14px]">{o.teacherName}</b>
                {o.className && <span className="b-badge b-badge-neutral">{o.className}</span>}
                {o.topic && <span className="text-[12.5px] text-steel">{o.topic}</span>}
                <span className="text-[12px] text-steel">{formatDateFa(o.date)}</span>
                <span className="ms-auto flex items-center gap-2">
                  <span className="b-badge b-badge-spring">{t("observations.average")}: {faNumber(o.average)}</span>
                  {canWrite && (
                    <button
                      type="button" aria-label={t("observations.delete")}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10"
                      onClick={() => remove(o.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {OBSERVATION_CRITERIA.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="text-[12px] text-steel w-52 shrink-0">{t(`observations.crit.${c.key}`)}</span>
                    <span className="h-2 flex-1 rounded-full bg-cloud overflow-hidden">
                      <span className="block h-full rounded-full bg-spring" style={{ width: `${((o.scores[c.key] ?? 0) / 5) * 100}%` }} />
                    </span>
                    <span className="text-[12px] font-bold w-6">{o.scores[c.key] ? faNumber(o.scores[c.key]) : "—"}</span>
                  </div>
                ))}
              </div>
              {(o.strengths || o.growthAreas || o.comment) && (
                <div className="grid md:grid-cols-3 gap-3 text-[12.5px] leading-relaxed">
                  {o.strengths && <p><b className="block text-[12px] mb-1">{t("observations.strengths")}</b>{o.strengths}</p>}
                  {o.growthAreas && <p><b className="block text-[12px] mb-1">{t("observations.growthAreas")}</b>{o.growthAreas}</p>}
                  {o.comment && <p><b className="block text-[12px] mb-1">{t("observations.comment")}</b>{o.comment}</p>}
                </div>
              )}
              <span className="text-[12px] text-steel">{t("observations.observer")}: {o.observerName}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
