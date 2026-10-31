"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pill, Loader2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; medicine: string; dose: string | null; givenAt: string; studentName: string; className: string | null; note: string | null };
type Data = { items: Row[] };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; user: { firstName: string; lastName: string } };

export default function MedicationLogPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/medication-log");
  const { data: uni } = useApi<{ classes: ClassRow[] }>("/api/uniforms");
  const [classId, setClassId] = useState("");
  const { data: studentsData } = useApi<{ students: StudentRow[] }>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const [studentId, setStudentId] = useState("");
  const [medicine, setMedicine] = useState("");
  const [dose, setDose] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!studentId || !medicine.trim()) { toast.error(t("meds.f.medicine")); return; }
    setBusy(true);
    try { await apiPost("/api/medication-log", { studentId, medicine, dose: dose || undefined }); setMedicine(""); setDose(""); toast.success(t("meds.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const when = (iso: string) => {
    const d = new Date(iso);
    return faNumber(d.toLocaleDateString("fa-IR")) + " " + faNumber(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("meds.title")} desc={t("meds.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Pill className="w-5 h-5" /> {t("meds.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="b-input w-full" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} aria-label={t("meds.f.class")}>
            <option value="">{t("meds.f.class")}</option>
            {(uni?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t("meds.f.student")} disabled={!classId}>
            <option value="">{t("meds.f.student")}</option>
            {(studentsData?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
          </select>
          <input className="b-input w-full" value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder={t("meds.f.medicine")} />
          <input className="b-input w-full" value={dose} onChange={(e) => setDose(e.target.value)} placeholder={t("meds.f.dose")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />} {t("meds.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("meds.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4">
              <p className="font-bold">{r.medicine}{r.dose ? ` · ${r.dose}` : ""}</p>
              <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""} · {when(r.givenAt)}{r.note ? ` · ${r.note}` : ""}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
