"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Loader2, Save, Stethoscope, BellRing, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Physical = { sportsStatus: string; sportsNote: string; asthma: boolean; heartCondition: boolean; seizures: boolean; diabetes: boolean; mobilityNote: string; visionNote: string; hearingNote: string; medications: string; reviewDate: string };
type Health = ({ bloodType: string | null; allergies: string | null; conditions: string | null; emergencyContact: string | null; vaccinations: string } & {
  sportsStatus?: string; sportsNote?: string | null; asthma?: boolean; heartCondition?: boolean; seizures?: boolean; diabetes?: boolean;
  mobilityNote?: string | null; visionNote?: string | null; hearingNote?: string | null; medications?: string | null; reviewDate?: string | null;
}) | null;
const SPORTS_TKEY: Record<string, string> = { FULL: "health.sports.full", LIMITED: "health.sports.limited", EXEMPT: "health.sports.exempt" };
type Visit = { id: string; date: string; complaint: string; action: string | null; sentHome: boolean };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };

type Vax = { name: string; date: string; done: boolean };

export default function HealthPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data, loading, error, refetch } = useApi<{ health: Health; visits: Visit[] }>(
    isAudience ? "/api/health" : studentId ? `/api/health?studentId=${studentId}` : null,
  );

  const { data: rosterData } = useApi<{ roster: { studentId: string; name: string; className: string; sportsStatus: string; sportsNote: string | null; conditions: string | null; allergies: string | null; asthma: boolean; heartCondition: boolean; seizures: boolean; diabetes: boolean; mobilityNote: string | null; medications: string | null }[] }>(!isAudience ? "/api/health?roster=1" : null);
  const health = data?.health;
  const [card, setCard] = useState<({ bloodType: string; allergies: string; conditions: string; emergencyContact: string } & Physical) | null>(null);
  const [vax, setVax] = useState<Vax[] | null>(null);
  const [visit, setVisit] = useState({ date: todayKey(), complaint: "", visitAction: "", sentHome: false });
  const [saving, setSaving] = useState("");

  const cardVal = card ?? {
    bloodType: health?.bloodType ?? "", allergies: health?.allergies ?? "",
    conditions: health?.conditions ?? "", emergencyContact: health?.emergencyContact ?? "",
    sportsStatus: health?.sportsStatus ?? "FULL", sportsNote: health?.sportsNote ?? "",
    asthma: !!health?.asthma, heartCondition: !!health?.heartCondition, seizures: !!health?.seizures, diabetes: !!health?.diabetes,
    mobilityNote: health?.mobilityNote ?? "", visionNote: health?.visionNote ?? "", hearingNote: health?.hearingNote ?? "",
    medications: health?.medications ?? "", reviewDate: health?.reviewDate ?? "",
  };
  const vaxVal: Vax[] = vax ?? (() => { try { return JSON.parse(health?.vaccinations ?? "[]"); } catch { return []; } })();

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    setSaving("card");
    try {
      await apiPost("/api/health", { action: "saveHealth", studentId, ...cardVal, vaccinations: vaxVal });
      toast.success(t("health.toast.cardSaved"));
      setCard(null); setVax(null);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(""); }
  }

  async function addVisit(e: React.FormEvent) {
    e.preventDefault();
    setSaving("visit");
    try {
      await apiPost("/api/health", { action: "visit", studentId, ...visit });
      toast.success(t("health.toast.visitSaved"));
      setVisit((v) => ({ ...v, complaint: "", visitAction: "", sentHome: false }));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(""); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("health.title")} desc={t("health.desc")} />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); setCard(null); setVax(null); }}
              options={[{ value: "", label: t("health.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("health.select.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.student")}</span>
            <Select value={studentId} onChange={(v) => { setStudentId(v); setCard(null); setVax(null); }}
              options={[{ value: "", label: t("health.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("health.select.student")} /></label>
        </div>
      )}
      {!isAudience && !studentId && <EmptyState icon={HeartPulse} title={t("health.empty.selectStudent")} />}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {!isAudience && rosterData && rosterData.roster.length > 0 && (
        <div className="b-card p-6 flex flex-col gap-3">
          <b className="text-[14px] flex items-center gap-2"><HeartPulse className="w-4 h-4 text-blossom" /> {t("health.rosterTitle")} ({faNumber(rosterData.roster.length)})</b>
          <div className="flex flex-col divide-y divide-hairline-soft">
            {rosterData.roster.map((r) => (
              <div key={r.studentId} className="py-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                <b>{r.name}</b>
                <span className="text-steel">{r.className}</span>
                <span className={r.sportsStatus === "EXEMPT" ? "b-badge b-badge-blossom" : "b-badge b-badge-warning"}>{SPORTS_TKEY[r.sportsStatus] ? t(SPORTS_TKEY[r.sportsStatus]) : r.sportsStatus}</span>
                {[r.asthma && t("health.condition.asthma"), r.heartCondition && t("health.condition.heart"), r.seizures && t("health.condition.seizures"), r.diabetes && t("health.condition.diabetes")].filter(Boolean).map((f) => (
                  <span key={String(f)} className="b-badge b-badge-neutral">{f}</span>
                ))}
                <span className="text-steel">{[r.sportsNote, r.conditions, r.mobilityNote, r.allergies && `${t("health.allergy")}: ${r.allergies}`, r.medications && `${t("health.medicine")}: ${r.medications}`].filter(Boolean).join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(isAudience || studentId) && data && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px] flex items-center gap-2"><HeartPulse className="w-4 h-4 text-blossom" /> {t("health.cardTitle")}</b>
            {health?.allergies && <div className="rounded-xl bg-blossom/10 border border-blossom/30 p-3 text-[12.5px]"><b>{t("health.label.allergies")}</b> {health.allergies}</div>}
            {!isAudience ? (
              <form onSubmit={saveCard} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.bloodType")}</span>
                    <input className="b-input" dir="ltr" value={cardVal.bloodType} onChange={(e) => setCard({ ...cardVal, bloodType: e.target.value })} placeholder="O+" /></label>
                  <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.emergency")}</span>
                    <input className="b-input" value={cardVal.emergencyContact} onChange={(e) => setCard({ ...cardVal, emergencyContact: e.target.value })} placeholder={t("health.placeholder.emergency")} /></label>
                </div>
                <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.allergies")}</span>
                  <input className="b-input" value={cardVal.allergies} onChange={(e) => setCard({ ...cardVal, allergies: e.target.value })} placeholder={t("health.placeholder.allergies")} /></label>
                <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.conditions")}</span>
                  <input className="b-input" value={cardVal.conditions} onChange={(e) => setCard({ ...cardVal, conditions: e.target.value })} placeholder={t("health.placeholder.conditions")} /></label>
                <fieldset className="rounded-2xl border border-hairline p-3.5 flex flex-col gap-3">
                  <legend className="text-[12px] font-bold px-1">{t("health.physicalTitle")}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.sportsStatus")}</span>
                      <select className="b-input" value={cardVal.sportsStatus} onChange={(e) => setCard({ ...cardVal, sportsStatus: e.target.value })}>
                        <option value="FULL">{t("health.sportOption.full")}</option>
                        <option value="LIMITED">{t("health.sportOption.limited")}</option>
                        <option value="EXEMPT">{t("health.sports.exempt")}</option>
                      </select></label>
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.reviewDate")}</span>
                      <input className="b-input" dir="ltr" value={cardVal.reviewDate} onChange={(e) => setCard({ ...cardVal, reviewDate: e.target.value })} placeholder="1405-12-01" /></label>
                  </div>
                  <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.sportsNote")}</span>
                    <input className="b-input" value={cardVal.sportsNote} onChange={(e) => setCard({ ...cardVal, sportsNote: e.target.value })} placeholder={t("health.placeholder.sportsNote")} /></label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12.5px] font-bold">
                    {([["asthma", t("health.condition.asthma")], ["heartCondition", t("health.condition.heartProblem")], ["seizures", t("health.condition.seizuresFull")], ["diabetes", t("health.condition.diabetes")]] as const).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={cardVal[k]} onChange={(e) => setCard({ ...cardVal, [k]: e.target.checked })} /> {label}
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.mobility")}</span>
                      <input className="b-input" value={cardVal.mobilityNote} onChange={(e) => setCard({ ...cardVal, mobilityNote: e.target.value })} placeholder={t("health.placeholder.mobility")} /></label>
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.medications")}</span>
                      <input className="b-input" value={cardVal.medications} onChange={(e) => setCard({ ...cardVal, medications: e.target.value })} placeholder={t("health.placeholder.medications")} /></label>
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.vision")}</span>
                      <input className="b-input" value={cardVal.visionNote} onChange={(e) => setCard({ ...cardVal, visionNote: e.target.value })} placeholder={t("health.placeholder.vision")} /></label>
                    <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.hearing")}</span>
                      <input className="b-input" value={cardVal.hearingNote} onChange={(e) => setCard({ ...cardVal, hearingNote: e.target.value })} placeholder={t("health.placeholder.hearing")} /></label>
                  </div>
                </fieldset>
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-bold">{t("health.vaccines")}</span>
                  {vaxVal.map((v, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <input className="b-input flex-1" value={v.name} onChange={(e) => { const n = [...vaxVal]; n[i] = { ...n[i], name: e.target.value }; setVax(n); }} placeholder={t("health.placeholder.vaccineName")} />
                      <input className="b-input w-32" dir="ltr" value={v.date} onChange={(e) => { const n = [...vaxVal]; n[i] = { ...n[i], date: e.target.value }; setVax(n); }} placeholder="1404-06-01" />
                      <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={v.done} onChange={(e) => { const n = [...vaxVal]; n[i] = { ...n[i], done: e.target.checked }; setVax(n); }} /> {t("health.vaccinated")}</label>
                    </span>
                  ))}
                  <button type="button" className="b-btn b-btn-ghost b-btn-sm self-start" onClick={() => setVax([...vaxVal, { name: "", date: "", done: false }])}>{t("health.addVaccine")}</button>
                </div>
                <button className="b-btn b-btn-spring self-start" disabled={saving === "card"}>
                  {saving === "card" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("health.saveCard")}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-2 text-[13px]">
                <span><span className="text-steel">{t("health.label.bloodType")} </span>{health?.bloodType ?? "—"}</span>
                <span><span className="text-steel">{t("health.label.conditions")} </span>{health?.conditions ?? "—"}</span>
                <span><span className="text-steel">{t("health.label.emergency")} </span>{health?.emergencyContact ?? "—"}</span>
                <span className="text-[12px] font-bold mt-1">{t("health.vaccines")}</span>
                {vaxVal.length === 0 && <span className="text-steel text-[12px]">{t("users.notRegistered")}</span>}
                {vaxVal.map((v, i) => (
                  <span key={i} className="flex justify-between"><span>{v.name}</span><span className={v.done ? "text-spring font-bold" : "text-blossom font-bold"}>{v.done ? `${t("health.vaccinated")} ${v.date}` : t("health.incomplete")}</span></span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {!isAudience && (
              <form onSubmit={addVisit} className="b-card p-6 flex flex-col gap-3">
                <b className="text-[14px] flex items-center gap-2"><Stethoscope className="w-4 h-4 text-spring" /> {t("health.visitTitle")}</b>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.day")}</span>
                    <input className="b-input" dir="ltr" value={visit.date} onChange={(e) => setVisit((v) => ({ ...v, date: e.target.value }))} required /></label>
                  <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={visit.sentHome} onChange={(e) => setVisit((v) => ({ ...v, sentHome: e.target.checked }))} /> <span className="text-[12.5px]">{t("health.sentHome")}</span></label>
                </div>
                <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.complaint")}</span>
                  <input className="b-input" value={visit.complaint} onChange={(e) => setVisit((v) => ({ ...v, complaint: e.target.value }))} placeholder={t("health.placeholder.complaint")} required /></label>
                <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("health.field.visitAction")}</span>
                  <input className="b-input" value={visit.visitAction} onChange={(e) => setVisit((v) => ({ ...v, visitAction: e.target.value }))} placeholder={t("health.placeholder.visitAction")} /></label>
                <button className="b-btn b-btn-spring self-start" disabled={saving === "visit"}>
                  {saving === "visit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} {t("health.notifyParent")}
                </button>
              </form>
            )}
            <div className="b-card p-6 flex flex-col gap-2">
              <b className="text-[14px]">{t("health.visitHistory")}</b>
              {(data.visits ?? []).length === 0 && <span className="text-[12.5px] text-steel">{t("health.noVisits")}</span>}
              {(data.visits ?? []).map((v) => (
                <div key={v.id} className="flex flex-col gap-0.5 py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span className="flex justify-between items-center"><b>{v.complaint}</b><span className="flex items-center gap-2"><span className="text-steel">{v.date}</span><button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label={t("health.deleteVisit")} onClick={async () => { if (!window.confirm(t("health.deleteConfirm"))) return; try { await apiDelete(`/api/health?id=${v.id}`); toast.success(t("health.toast.deleted")); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}><Trash2 className="w-3.5 h-3.5" /></button></span></span>
                  {v.action && <span className="text-steel">{v.action}</span>}
                  {v.sentHome && <span className="b-badge b-badge-blossom self-start">{t("health.sentHome")}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
