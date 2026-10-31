"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackagePlus, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; item: string; qty: number; reason: string | null; status: string; requesterName: string };
type Data = { isOffice: boolean; items: Row[] };

export default function SupplyRequestsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/supply-requests");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!item.trim()) { toast.error(t("supply.f.item")); return; }
    setBusy(true);
    try { await apiPost("/api/supply-requests", { item, qty: Number(qty) || 1, reason: reason || undefined }); setItem(""); setReason(""); toast.success(t("supply.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/supply-requests", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("supply.title")} desc={t("supply.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><PackagePlus className="w-5 h-5" /> {t("supply.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_7rem]">
          <input className="b-input w-full" value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("supply.f.item")} />
          <input className="b-input w-full" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t("supply.f.qty")} aria-label={t("supply.f.qty")} />
        </div>
        <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("supply.f.reason")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />} {t("supply.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("supply.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.item} × {faNumber(r.qty)}</p>
                <p className="text-sm text-muted-foreground">{r.requesterName}{r.reason ? ` · ${r.reason}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "DELIVERED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : r.status === "APPROVED" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                {t(`supply.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-ghost min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("supply.approve")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("supply.reject")}</button>
              </>)}
              {data.isOffice && r.status === "APPROVED" && (
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "DELIVERED")}>{t("supply.deliver")}</button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
