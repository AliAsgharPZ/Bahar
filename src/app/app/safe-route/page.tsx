"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Footprints, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; location: string; hazard: string; description: string | null; status: string; reporterName: string };
type Data = { isStaff: boolean; items: Row[] };
const HAZARDS = ["ROADWORK", "TRAFFIC", "LIGHTING", "OTHER"] as const;

export default function SafeRoutePage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/safe-route");
  const [location, setLocation] = useState("");
  const [hazard, setHazard] = useState<string>(HAZARDS[0]);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={error || t("common.error")} onRetry={refetch} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/safe-route", { location, hazard, description: description || undefined }); setLocation(""); setDescription(""); toast.success(t("saferoute.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await apiPatch("/api/safe-route", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/safe-route?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("saferoute.title")} desc={t("saferoute.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Footprints className="w-5 h-5" /> {t("saferoute.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("saferoute.f.location")} aria-label={t("saferoute.f.location")} />
          <select className="b-input w-full" value={hazard} onChange={(e) => setHazard(e.target.value)} aria-label={t("saferoute.f.hazard")}>
            {HAZARDS.map((h) => <option key={h} value={h}>{t(`saferoute.hazard.${h}`)}</option>)}
          </select>
          <input className="b-input w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("saferoute.f.desc")} aria-label={t("saferoute.f.desc")} />
        </div>
        <button className="b-btn b-btn-spring min-h-11" disabled={busy || !location} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Footprints className="w-4 h-4" />} {t("saferoute.add")}
        </button>
      </section>
      <p className="text-sm text-muted-foreground">{faNumber(data.items.length)} {t("saferoute.count")}</p>
      {data.items.length === 0 ? (
        <EmptyState title={t("saferoute.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.location} · {t(`saferoute.hazard.${r.hazard}`)}</p>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("saferoute.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">{r.reporterName}{r.description ? ` · ${r.description}` : ""}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm">{t(`saferoute.status.${r.status}`)}</span>
                {data.isStaff && r.status === "NEW" && <button className="b-btn min-h-11" onClick={() => setStatus(r.id, "ACK")}>{t("saferoute.ack")}</button>}
                {data.isStaff && r.status !== "RESOLVED" && <button className="b-btn min-h-11" onClick={() => setStatus(r.id, "RESOLVED")}>{t("saferoute.resolve")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
