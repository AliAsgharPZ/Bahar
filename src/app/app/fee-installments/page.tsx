"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; parts: number; reason: string | null; status: string; studentName: string; className: string | null };
type Data = { isOffice: boolean; items: Row[] };

export default function FeeInstallmentsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/fee-installments");
  const [parts, setParts] = useState("3");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/fee-installments", { parts: Number(parts) || 3, reason: reason || undefined }); setReason(""); toast.success(t("fees.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/fee-installments", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("fees.title")} desc={t("fees.desc")} />
      {!data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Wallet className="w-5 h-5" /> {t("fees.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={parts} onChange={(e) => setParts(e.target.value)} aria-label={t("fees.f.parts")}>
              {[2, 3, 4, 5, 6, 9, 12].map((n) => <option key={n} value={n}>{faNumber(n)} {t("fees.parts")}</option>)}
            </select>
            <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("fees.f.reason")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} {t("fees.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("fees.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{faNumber(r.parts)} {t("fees.parts")}{data.isOffice ? ` — ${r.studentName}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.className ?? ""}{r.reason ? ` · ${r.reason}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                {t(`fees.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("fees.approve")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("fees.reject")}</button>
              </>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
