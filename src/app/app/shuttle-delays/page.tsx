"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Timer, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; routeName: string; delayMinutes: number; reason: string | null; status: string; reporterName: string };
type Data = { isStaff: boolean; items: Row[] };

export default function ShuttleDelaysPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/shuttle-delays");
  const [routeName, setRouteName] = useState("");
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={error || t("common.error")} onRetry={refetch} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/shuttle-delays", { routeName, delayMinutes: minutes, reason: reason || undefined }); setRouteName(""); setReason(""); setMinutes(15); toast.success(t("shuttle.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await apiPatch("/api/shuttle-delays", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/shuttle-delays?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("shuttle.title")} desc={t("shuttle.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Timer className="w-5 h-5" /> {t("shuttle.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder={t("shuttle.f.route")} aria-label={t("shuttle.f.route")} />
          <input className="b-input w-full" type="number" min={1} max={480} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} placeholder={t("shuttle.f.minutes")} aria-label={t("shuttle.f.minutes")} />
          <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("shuttle.f.reason")} aria-label={t("shuttle.f.reason")} />
        </div>
        <button className="b-btn b-btn-spring min-h-11" disabled={busy || !routeName} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />} {t("shuttle.add")}
        </button>
      </section>
      <p className="text-sm text-muted-foreground">{faNumber(data.items.length)} {t("shuttle.count")}</p>
      {data.items.length === 0 ? (
        <EmptyState title={t("shuttle.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.routeName} · {faNumber(r.delayMinutes)} دقیقه</p>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("shuttle.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{r.reporterName}{r.reason ? ` · ${r.reason}` : ""}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm">{t(`shuttle.status.${r.status}`)}</span>
                {data.isStaff && r.status === "NEW" && <button className="b-btn min-h-11" onClick={() => setStatus(r.id, "ACK")}>{t("shuttle.ack")}</button>}
                {data.isStaff && r.status !== "RESOLVED" && <button className="b-btn min-h-11" onClick={() => setStatus(r.id, "RESOLVED")}>{t("shuttle.resolve")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
