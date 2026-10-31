"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Medal, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; discipline: string; value: string; unit: string | null; date: string; studentName: string; className: string | null; note: string | null };
type Data = { isStaff: boolean; items: Row[] };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; user: { firstName: string; lastName: string } };

export default function SportsRecordsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/sports-records");
  const { data: uni } = useApi<{ classes: ClassRow[] }>("/api/uniforms");
  const [classId, setClassId] = useState("");
  const { data: studentsData } = useApi<{ students: StudentRow[] }>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const [studentId, setStudentId] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!studentId || !discipline.trim() || !value.trim()) { toast.error(t("sports.f.discipline")); return; }
    setBusy(true);
    try { await apiPost("/api/sports-records", { studentId, discipline, value, unit: unit || undefined }); setValue(""); toast.success(t("sports.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/sports-records?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("sports.title")} desc={t("sports.desc")} />
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Medal className="w-5 h-5" /> {t("sports.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} aria-label={t("sports.f.class")}>
              <option value="">{t("sports.f.class")}</option>
              {(uni?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t("sports.f.student")} disabled={!classId}>
              <option value="">{t("sports.f.student")}</option>
              {(studentsData?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
            </select>
            <input className="b-input w-full" value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder={t("sports.f.discipline")} />
            <div className="flex gap-2">
              <input className="b-input w-full" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("sports.f.value")} />
              <input className="b-input w-28" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t("sports.f.unit")} />
            </div>
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Medal className="w-4 h-4" />} {t("sports.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("sports.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <Medal className="w-5 h-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="font-bold">{r.discipline}: {faNumber(r.value)}{r.unit ? ` ${r.unit}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""} · {faNumber(r.date)}</p>
              </div>
              {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("sports.delete")}><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
