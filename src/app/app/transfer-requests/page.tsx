"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; toSchool: string; reason: string | null; status: string; studentName: string; className: string | null };
type Data = { isOffice: boolean; items: Row[] };

export default function TransferRequestsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/transfer-requests");
  const [toSchool, setToSchool] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!toSchool.trim()) { toast.error(t("transfer.f.toSchool")); return; }
    setBusy(true);
    try { await apiPost("/api/transfer-requests", { toSchool, reason: reason || undefined }); setToSchool(""); setReason(""); toast.success(t("transfer.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/transfer-requests", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("transfer.title")} desc={t("transfer.desc")} />
      {!data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" /> {t("transfer.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="b-input w-full" value={toSchool} onChange={(e) => setToSchool(e.target.value)} placeholder={t("transfer.f.toSchool")} />
            <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("transfer.f.reason")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />} {t("transfer.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("transfer.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{t("transfer.to")} {r.toSchool}{data.isOffice ? ` — ${r.studentName}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.className ?? ""}{r.reason ? ` · ${r.reason}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                {t(`transfer.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("transfer.approve")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("transfer.reject")}</button>
              </>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
