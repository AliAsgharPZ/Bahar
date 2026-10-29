"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Baby, Loader2, Save, ShieldCheck, Trash2, Plus } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Report = { id: string; studentId: string; date: string; meals: string; napMin: number | null; mood: string; medication: string | null; note: string | null; studentName?: string; className?: string };
type Pickup = { id: string; name: string; relation: string; phone: string | null; isAuthorized: boolean };
type StudentRow = { id: string; name: string };
type ClassRow = { id: string; name: string; academicYear: string };
type Me = { user: { role: string } };

const MOOD_TKEY: Record<string, string> = { GREAT: "preschool.mood.great", GOOD: "preschool.mood.good", CALM: "preschool.mood.calm", UPSET: "preschool.mood.upset", SICK: "preschool.mood.sick" };

export default function PreschoolPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [form, setForm] = useState({ meals: "", napMin: "", mood: "GOOD", medication: "", note: "" });
  const [pickupForm, setPickupForm] = useState({ name: "", relation: "مادر", phone: "" });
  const [saving, setSaving] = useState("");

  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data, loading, error, refetch } = useApi<{ reports: Report[]; pickups?: Pickup[] }>(
    isAudience ? "/api/daily-reports" : studentId ? `/api/daily-reports?studentId=${studentId}` : `/api/daily-reports?date=${date}`,
  );

  async function saveReport(e: React.FormEvent) {
    e.preventDefault();
    setSaving("report");
    try {
      await apiPost("/api/daily-reports", { ...form, studentId, date, napMin: form.napMin ? Number(form.napMin) : null });
      toast.success(t("preschool.toast.saved"));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(""); }
  }

  async function addPickup(e: React.FormEvent) {
    e.preventDefault();
    setSaving("pickup");
    try {
      await apiPost("/api/daily-reports", { action: "addPickup", studentId, ...pickupForm });
      setPickupForm({ name: "", relation: "مادر", phone: "" });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(""); }
  }

  async function removePickup(id: string) {
    try { await apiPost("/api/daily-reports", { action: "removePickup", studentId, id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
  }

  const reports = data?.reports ?? [];
  const pickups = data?.pickups ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("preschool.title")} desc={t("preschool.desc")} />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: t("preschool.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("preschool.select.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.select.child")}</span>
            <Select value={studentId} onChange={setStudentId}
              options={[{ value: "", label: t("preschool.select.allToday") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("preschool.select.child")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.field.day")}</span>
            <input className="b-input w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1405-08-05" /></label>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {!isAudience && studentId && (
        <form onSubmit={saveReport} className="b-card p-5 grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-[12px] font-bold">{t("preschool.field.meals")}</span>
            <input className="b-input" value={form.meals} onChange={(e) => setForm((f) => ({ ...f, meals: e.target.value }))} placeholder={t("preschool.placeholder.meals")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.field.nap")}</span>
            <input className="b-input" type="number" min={0} max={600} value={form.napMin} onChange={(e) => setForm((f) => ({ ...f, napMin: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.field.mood")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.mood} onChange={(v) => setForm((f) => ({ ...f, mood: v }))}
              options={Object.entries(MOOD_TKEY).map(([value, key]) => ({ value, label: t(key) }))} placeholder={t("preschool.select.mood")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.field.medication")}</span>
            <input className="b-input" value={form.medication} onChange={(e) => setForm((f) => ({ ...f, medication: e.target.value }))} placeholder={t("preschool.placeholder.medication")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("preschool.field.note")}</span>
            <input className="b-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></label>
          <button className="b-btn b-btn-spring md:col-span-2 justify-self-start" disabled={saving === "report"}>
            {saving === "report" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("preschool.saveReport")}
          </button>
        </form>
      )}

      {(isAudience || studentId) && (
        <div className="b-card p-5 flex flex-col gap-3">
          <b className="text-[14px] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-spring" /> {t("preschool.pickupTitle")}</b>
          <div className="flex flex-wrap gap-1.5">
            {pickups.map((p) => (
              <span key={p.id} className="b-badge b-badge-neutral !py-1.5 !px-3 flex items-center gap-2">
                {p.name} · {p.relation}{p.phone ? ` · ${p.phone}` : ""}
                <button onClick={() => removePickup(p.id)} aria-label={t("common.delete")}><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </span>
            ))}
            {pickups.length === 0 && <span className="text-[12px] text-steel">{t("preschool.noPickup")}</span>}
          </div>
          <form onSubmit={addPickup} className="flex gap-2 flex-wrap items-end">
            <input className="b-input w-44" value={pickupForm.name} onChange={(e) => setPickupForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("preschool.placeholder.pickupName")} required />
            <input className="b-input w-28" value={pickupForm.relation} onChange={(e) => setPickupForm((f) => ({ ...f, relation: e.target.value }))} placeholder={t("students.parent.relation")} />
            <input className="b-input w-36" dir="ltr" value={pickupForm.phone} onChange={(e) => setPickupForm((f) => ({ ...f, phone: e.target.value }))} placeholder="09…" />
            <button className="b-btn b-btn-spring b-btn-sm" disabled={saving === "pickup"}>
              {saving === "pickup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("common.add")}
            </button>
          </form>
        </div>
      )}

      {data && reports.length === 0 && <EmptyState icon={Baby} title={t("preschool.empty.title")} />}
      <div className="flex flex-col gap-3 b-auto-stagger">
        {reports.map((r) => (
          <div key={r.id} className="b-card-sm p-5 flex flex-col gap-1.5 text-[14px]">
            <span className="flex items-center justify-between flex-wrap gap-2">
              <b>{r.studentName ?? ""} <span className="text-steel font-normal">{r.className ?? ""}</span></b>
              <span className="flex gap-1.5 items-center">
                <span className="b-badge b-badge-neutral">{r.date}</span>
                <span className="b-badge b-badge-spring">{MOOD_TKEY[r.mood] ? t(MOOD_TKEY[r.mood]) : r.mood}</span>
                {!isAudience && <button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label={t("preschool.deleteReport")} onClick={async () => { if (!window.confirm(t("preschool.deleteConfirm"))) return; try { await apiDelete(`/api/daily-reports?id=${r.id}`); toast.success(t("preschool.toast.deleted")); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}><Trash2 className="w-4 h-4" /></button>}
              </span>
            </span>
            {r.meals && <span><span className="text-steel">{t("preschool.label.meals")} </span>{r.meals}</span>}
            {r.napMin != null && <span><span className="text-steel">{t("preschool.label.nap")} </span>{faNumber(r.napMin)} {t("dashboard.uptime.minute")}</span>}
            {r.medication && <span><span className="text-steel">{t("preschool.label.medicine")} </span>{r.medication}</span>}
            {r.note && <span><span className="text-steel">{t("preschool.label.note")} </span>{r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
