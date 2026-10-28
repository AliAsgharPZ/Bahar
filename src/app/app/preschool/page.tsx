"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Baby, Loader2, Save, ShieldCheck, Trash2, Plus } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey, faNumber } from "@/lib/persian";

type Report = { id: string; studentId: string; date: string; meals: string; napMin: number | null; mood: string; medication: string | null; note: string | null; studentName?: string; className?: string };
type Pickup = { id: string; name: string; relation: string; phone: string | null; isAuthorized: boolean };
type StudentRow = { id: string; name: string };
type ClassRow = { id: string; name: string; academicYear: string };
type Me = { user: { role: string } };

const MOODS: Record<string, string> = { GREAT: "عالی", GOOD: "خوب", CALM: "آرام", UPSET: "بی‌قرار", SICK: "ناخوش" };

export default function PreschoolPage() {
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
      toast.success("گزارش روز ثبت شد.");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSaving(""); }
  }

  async function addPickup(e: React.FormEvent) {
    e.preventDefault();
    setSaving("pickup");
    try {
      await apiPost("/api/daily-reports", { action: "addPickup", studentId, ...pickupForm });
      setPickupForm({ name: "", relation: "مادر", phone: "" });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSaving(""); }
  }

  async function removePickup(id: string) {
    try { await apiPost("/api/daily-reports", { action: "removePickup", studentId, id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
  }

  const reports = data?.reports ?? [];
  const pickups = data?.pickups ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="گزارش روزانهٔ پیش‌دبستانی" desc="خوراک، خواب، خلق و داروی امروز کودک — و افراد مجاز به تحویل او." />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="انتخاب کلاس" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کودک</span>
            <Select value={studentId} onChange={setStudentId}
              options={[{ value: "", label: "همهٔ کودکان امروز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="کودک" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">روز (شمسی)</span>
            <input className="b-input w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1405-08-05" /></label>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {!isAudience && studentId && (
        <form onSubmit={saveReport} className="b-card p-5 grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 md:col-span-2"><span className="text-[12px] font-bold">خوراک امروز</span>
            <input className="b-input" value={form.meals} onChange={(e) => setForm((f) => ({ ...f, meals: e.target.value }))} placeholder="صبحانه: … · ناهار: … · میان‌وعده: …" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">خواب (دقیقه)</span>
            <input className="b-input" type="number" min={0} max={600} value={form.napMin} onChange={(e) => setForm((f) => ({ ...f, napMin: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">خلق امروز</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.mood} onChange={(v) => setForm((f) => ({ ...f, mood: v }))}
              options={Object.entries(MOODS).map(([value, label]) => ({ value, label }))} placeholder="خلق" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">داروی داده‌شده</span>
            <input className="b-input" value={form.medication} onChange={(e) => setForm((f) => ({ ...f, medication: e.target.value }))} placeholder="نام و ساعت (در صورت وجود)" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">یادداشت مربی</span>
            <input className="b-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></label>
          <button className="b-btn b-btn-spring md:col-span-2 justify-self-start" disabled={saving === "report"}>
            {saving === "report" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ثبت گزارش روز
          </button>
        </form>
      )}

      {(isAudience || studentId) && (
        <div className="b-card p-5 flex flex-col gap-3">
          <b className="text-[13.5px] flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-spring" /> افراد مجاز به تحویل کودک</b>
          <div className="flex flex-wrap gap-1.5">
            {pickups.map((p) => (
              <span key={p.id} className="b-badge b-badge-neutral !py-1.5 !px-3 flex items-center gap-2">
                {p.name} · {p.relation}{p.phone ? ` · ${p.phone}` : ""}
                <button onClick={() => removePickup(p.id)} aria-label="حذف"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </span>
            ))}
            {pickups.length === 0 && <span className="text-[12px] text-steel">فردی ثبت نشده — تحویل فقط به ولی قانونی.</span>}
          </div>
          <form onSubmit={addPickup} className="flex gap-2 flex-wrap items-end">
            <input className="b-input w-44" value={pickupForm.name} onChange={(e) => setPickupForm((f) => ({ ...f, name: e.target.value }))} placeholder="نام فرد مجاز" required />
            <input className="b-input w-28" value={pickupForm.relation} onChange={(e) => setPickupForm((f) => ({ ...f, relation: e.target.value }))} placeholder="نسبت" />
            <input className="b-input w-36" dir="ltr" value={pickupForm.phone} onChange={(e) => setPickupForm((f) => ({ ...f, phone: e.target.value }))} placeholder="09…" />
            <button className="b-btn b-btn-spring b-btn-sm" disabled={saving === "pickup"}>
              {saving === "pickup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} افزودن
            </button>
          </form>
        </div>
      )}

      {data && reports.length === 0 && <EmptyState icon={Baby} title="گزارشی برای نمایش نیست" />}
      <div className="flex flex-col gap-3 b-auto-stagger">
        {reports.map((r) => (
          <div key={r.id} className="b-card-sm p-5 flex flex-col gap-1.5 text-[13px]">
            <span className="flex items-center justify-between flex-wrap gap-2">
              <b>{r.studentName ?? ""} <span className="text-steel font-normal">{r.className ?? ""}</span></b>
              <span className="flex gap-1.5 items-center">
                <span className="b-badge b-badge-neutral">{r.date}</span>
                <span className="b-badge b-badge-spring">{MOODS[r.mood] ?? r.mood}</span>
                {!isAudience && <button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label="حذف گزارش" onClick={async () => { if (!window.confirm("این گزارش روزانه حذف شود؟")) return; try { await apiDelete(`/api/daily-reports?id=${r.id}`); toast.success("حذف شد."); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}><Trash2 className="w-4 h-4" /></button>}
              </span>
            </span>
            {r.meals && <span><span className="text-steel">خوراک: </span>{r.meals}</span>}
            {r.napMin != null && <span><span className="text-steel">خواب: </span>{faNumber(r.napMin)} دقیقه</span>}
            {r.medication && <span><span className="text-steel">دارو: </span>{r.medication}</span>}
            {r.note && <span><span className="text-steel">یادداشت مربی: </span>{r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
