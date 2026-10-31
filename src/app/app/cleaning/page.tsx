"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SprayCan, Loader2, CheckCircle2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

const faToEn = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
import { useLang } from "@/lib/i18n";

type Data = {
  classes: { id: string; name: string }[]; classId: string; date: string;
  duty: { id: string; studentIds: string[]; done: boolean; note: string | null } | null;
  students: { id: string; name: string }[];
};

export default function CleaningPage() {
  const { t } = useLang();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState("");
  const qs = new URLSearchParams();
  if (classId) qs.set("classId", classId);
  if (date) qs.set("date", date);
  const { data, loading, error, refetch } = useApi<Data>(`/api/cleaning?${qs.toString()}`, [classId, date]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const selected = picked ?? data.duty?.studentIds ?? [];

  const toggle = (id: string) => {
    setPicked((prev) => {
      const cur = prev ?? data.duty?.studentIds ?? [];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  };

  const save = async () => {
    setBusy(true);
    try { await apiPost("/api/cleaning", { classId: data.classId, date: data.date, studentIds: selected }); setPicked(null); toast.success(t("cleaning.savedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const markDone = async () => {
    if (!data.duty) return;
    try { await apiPatch("/api/cleaning", { id: data.duty.id, done: !data.duty.done }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("cleaning.title")} desc={t("cleaning.desc")} />
      <div className="flex flex-wrap gap-2 items-center">
        <select className="b-input" value={classId || data.classId} onChange={(e) => { setClassId(e.target.value); setPicked(null); }} aria-label={t("cleaning.f.class")}>
          {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="b-input" dir="ltr" value={date} onChange={(e) => setDate(faToEn(e.target.value))} placeholder="1404-08-10" aria-label={t("cleaning.f.date")} />
        <span className="text-sm text-muted-foreground">{faNumber(data.date)}</span>
        {data.duty && (
          <button className={`b-btn min-h-11 ${data.duty.done ? "b-btn-ghost" : "b-btn-primary"}`} onClick={markDone}>
            <CheckCircle2 className="w-4 h-4" /> {data.duty.done ? t("cleaning.doneYes") : t("cleaning.markDone")}
          </button>
        )}
      </div>
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><SprayCan className="w-5 h-5" /> {t("cleaning.pickTitle")} ({faNumber(selected.length)})</h2>
        <div className="flex flex-wrap gap-2">
          {data.students.map((s) => (
            <button
              key={s.id}
              className={`px-3 min-h-11 rounded-full border text-sm ${selected.includes(s.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
              onClick={() => toggle(s.id)}
              aria-pressed={selected.includes(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <SprayCan className="w-4 h-4" />} {t("cleaning.save")}
        </button>
      </section>
    </div>
  );
}
