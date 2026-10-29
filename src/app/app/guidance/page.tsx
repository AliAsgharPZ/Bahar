"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Compass, Loader2, Save, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Area = { key: string; label: string };
type Rank = { key: string; label: string; percent: number; hint: string };
type GData = {
  record: { scores: Record<string, number>; recommended: string | null; counselorNote: string | null } | null;
  ranking?: Rank[];
  areas: Area[];
};
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };

export default function GuidancePage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data, loading, error, refetch } = useApi<GData>(
    isAudience ? "/api/guidance" : studentId ? `/api/guidance?studentId=${studentId}` : null,
  );
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scores = draft ?? Object.fromEntries((data?.areas ?? []).map((a) => [a.key, String(data?.record?.scores?.[a.key] ?? "")]));
  const noteVal = note ?? data?.record?.counselorNote ?? "";

  async function save() {
    setSaving(true);
    try {
      const nums = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v) || 0]));
      await apiPost("/api/guidance", { studentId, scores: nums, counselorNote: noteVal });
      toast.success(t("guidance.toast.saved"));
      setDraft(null); setNote(null);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.guidance")} desc={t("guidance.desc")} />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); setDraft(null); }}
              options={[{ value: "", label: t("guidance.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.student")}</span>
            <Select value={studentId} onChange={(v) => { setStudentId(v); setDraft(null); setNote(null); }}
              options={[{ value: "", label: t("guidance.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} /></label>
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {!isAudience && !studentId && <EmptyState icon={Compass} title={t("guidance.select.studentPrompt")} />}
      {(isAudience || studentId) && data && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {!isAudience ? (
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">{t("guidance.scoresTitle")}</b>
              {data.areas.map((a) => (
                <label key={a.key} className="flex items-center justify-between gap-3">
                  <span className="text-[13px]">{a.label}</span>
                  <input className="b-input w-24" dir="ltr" inputMode="decimal" value={scores[a.key] ?? ""}
                    onChange={(e) => setDraft({ ...scores, [a.key]: e.target.value })} placeholder={t("guidance.placeholder.score")} />
                </label>
              ))}
              <label className="flex flex-col gap-1.5 mt-1"><span className="text-[12px] font-bold">{t("guidance.counselorNote")}</span>
                <textarea className="b-input min-h-20" value={noteVal} onChange={(e) => setNote(e.target.value)} placeholder={t("guidance.placeholder.note")} /></label>
              <span className="flex gap-1.5">
                <button className="b-btn b-btn-spring self-start" disabled={saving} onClick={save}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("guidance.saveCompute")}
                </button>
                {data.record && (
                  <button className="b-btn b-btn-ghost !text-destructive self-start" onClick={async () => { if (!window.confirm(t("guidance.deleteConfirm"))) return; try { await apiDelete(`/api/guidance?studentId=${studentId}`); toast.success(t("guidance.toast.deleted")); setDraft(null); setNote(null); refetch(); } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); } }}>
                    <Trash2 className="w-4 h-4" /> {t("guidance.deleteRecord")}
                  </button>
                )}
              </span>
            </div>
          ) : (
            <div className="b-card p-6 flex flex-col gap-2">
              <b className="text-[14px]">{t("guidance.counselorNote")}</b>
              <p className="text-[13px] leading-relaxed text-steel">{data.record?.counselorNote || t("guidance.noNote")}</p>
            </div>
          )}
          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">{t("guidance.ranking")}</b>
            {!data.ranking && <span className="text-[12.5px] text-steel">{t("guidance.noScores")}</span>}
            {(data.ranking ?? []).map((r, i) => (
              <div key={r.key} className="flex flex-col gap-1">
                <span className="flex items-center justify-between text-[13px]">
                  <b>{faNumber(i + 1)}. {r.label} {i === 0 && <span className="b-badge b-badge-spring ms-1">{t("guidance.firstChoice")}</span>}</b>
                  <span className="text-spring font-bold">{faNumber(r.percent)}٪</span>
                </span>
                <span className="h-2.5 rounded-full bg-cloud overflow-hidden">
                  <span className={`block h-full rounded-full ${i === 0 ? "bg-spring" : "bg-spring/40"}`} style={{ width: `${r.percent}%` }} />
                </span>
                <span className="text-[11.5px] text-steel">{r.hint}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
