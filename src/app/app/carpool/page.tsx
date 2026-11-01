"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CarFront, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; originArea: string; seats: number; days: string; note: string | null; status: string; studentName: string; className: string | null };
type Data = { isStaff: boolean; items: Row[] };

export default function CarpoolPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/carpool");
  const [origin, setOrigin] = useState("");
  const [seats, setSeats] = useState(1);
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={error || t("common.error")} onRetry={refetch} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/carpool", { originArea: origin, seats, days, note: note || undefined }); setOrigin(""); setDays(""); setNote(""); setSeats(1); toast.success(t("carpool.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await apiPatch("/api/carpool", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/carpool?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const items = data.items.filter((r) => !q || r.originArea.includes(q) || r.studentName.includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={t("carpool.title")} desc={t("carpool.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><CarFront className="w-5 h-5" /> {t("carpool.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t("carpool.f.origin")} aria-label={t("carpool.f.origin")} />
          <input className="b-input w-full" type="number" min={1} max={6} value={seats} onChange={(e) => setSeats(Number(e.target.value))} placeholder={t("carpool.f.seats")} aria-label={t("carpool.f.seats")} />
          <input className="b-input w-full" value={days} onChange={(e) => setDays(e.target.value)} placeholder={t("carpool.f.days")} aria-label={t("carpool.f.days")} />
          <input className="b-input w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("carpool.f.note")} aria-label={t("carpool.f.note")} />
        </div>
        <button className="b-btn b-btn-spring min-h-11" disabled={busy || !origin || !days} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CarFront className="w-4 h-4" />} {t("carpool.add")}
        </button>
      </section>
      <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("carpool.searchPh")} aria-label={t("carpool.searchPh")} />
      <p className="text-sm text-muted-foreground">{faNumber(items.length)} {t("carpool.count")}</p>
      {items.length === 0 ? (
        <EmptyState title={t("carpool.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.originArea} · {faNumber(r.seats)} {t("carpool.f.seats")}</p>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("carpool.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""} · {r.days}{r.note ? ` · ${r.note}` : ""}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm">{t(`carpool.status.${r.status}`)}</span>
                {r.status !== "CLOSED" && <button className="b-btn b-btn-ghost min-h-11" onClick={() => setStatus(r.id, "CLOSED")}>{t("carpool.close")}</button>}
                {r.status === "CLOSED" && <button className="b-btn b-btn-ghost min-h-11" onClick={() => setStatus(r.id, "OPEN")}>{t("carpool.open")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
