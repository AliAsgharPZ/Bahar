"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Siren, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; kind: string; date: string; durationMin: number | null; notes: string | null };
type Data = { isStaff: boolean; items: Row[]; counts: { kind: string; count: number }[] };

const KINDS = ["آتش‌نشانی", "زلزله", "تخلیه اضطراری", "کمک‌های اولیه", "دیگر"];

export default function DrillLogPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/drill-log");
  const [kind, setKind] = useState(KINDS[0]);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/drill-log", { kind, durationMin: duration ? Number(duration) : undefined, notes: notes || undefined }); setNotes(""); setDuration(""); toast.success(t("drills.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/drill-log?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("drills.title")} desc={t("drills.desc")} />
      {data.counts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.counts.map((c) => <span key={c.kind} className="px-3 py-1 rounded-full bg-primary/10 text-sm">{c.kind}: {faNumber(c.count)}</span>)}
        </div>
      )}
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Siren className="w-5 h-5" /> {t("drills.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="b-input w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("drills.f.kind")}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input className="b-input w-full" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t("drills.f.duration")} />
            <input className="b-input w-full" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("drills.f.notes")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Siren className="w-4 h-4" />} {t("drills.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("drills.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.kind}</p>
                <p className="text-sm text-muted-foreground">{faNumber(r.date)}{r.durationMin ? ` · ${faNumber(r.durationMin)} ${t("drills.min")}` : ""}{r.notes ? ` · ${r.notes}` : ""}</p>
              </div>
              {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("drills.delete")}><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
