"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IdCard, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; reason: string; status: string; studentName: string; className: string | null };
type Data = { isOffice: boolean; items: Row[] };

export default function IdReissuePage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/id-reissue");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (reason.trim().length < 3) { toast.error(t("idcard.f.reason")); return; }
    setBusy(true);
    try { await apiPost("/api/id-reissue", { reason }); setReason(""); toast.success(t("idcard.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/id-reissue", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("idcard.title")} desc={t("idcard.desc")} />
      {!data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><IdCard className="w-5 h-5" /> {t("idcard.addTitle")}</h2>
          <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("idcard.f.reason")} />
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <IdCard className="w-4 h-4" />} {t("idcard.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("idcard.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.reason}</p>
                {data.isOffice && <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "READY" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                {t(`idcard.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "READY")}>{t("idcard.ready")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("idcard.reject")}</button>
              </>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
