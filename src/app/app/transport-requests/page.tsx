"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bus, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; kind: string; details: string; status: string; studentName: string; className: string | null };
type Data = { isOffice: boolean; items: Row[] };

const KINDS = ["CHANGE_STOP", "CHANGE_ROUTE", "TEMP_DAY_OFF", "NEW_SERVICE", "OTHER"] as const;

export default function TransportRequestsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/transport-requests");
  const [kind, setKind] = useState<string>("CHANGE_STOP");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (details.trim().length < 5) { toast.error(t("transport2.f.details")); return; }
    setBusy(true);
    try { await apiPost("/api/transport-requests", { kind, details }); setDetails(""); toast.success(t("transport2.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/transport-requests", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("transport2.title")} desc={t("transport2.desc")} />
      {!data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Bus className="w-5 h-5" /> {t("transport2.addTitle")}</h2>
          <select className="b-input w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("transport2.f.kind")}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`transport2.kind.${k}`)}</option>)}
          </select>
          <textarea className="b-input w-full min-h-20" value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("transport2.f.details")} />
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bus className="w-4 h-4" />} {t("transport2.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("transport2.empty")} />
      ) : (
        <section className="space-y-3">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold flex-1">{t(`transport2.kind.${r.kind}`)}{data.isOffice ? ` — ${r.studentName}` : ""}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                  {t(`transport2.status.${r.status}`)}
                </span>
              </div>
              <p className="text-sm">{r.details}</p>
              {r.className && <p className="text-sm text-muted-foreground">{r.className}</p>}
              {data.isOffice && r.status === "PENDING" && (
                <div className="flex gap-2">
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("transport2.approve")}</button>
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("transport2.reject")}</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
