"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wrench, Loader2, Undo2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; assetName: string; borrowerName: string; outAt: string; inAt: string | null; dueAt: string | null; note: string | null };
type Data = { out: Row[]; history: Row[] };

function when(iso: string) {
  const d = new Date(iso);
  return faNumber(d.toLocaleDateString("fa-IR")) + " " + faNumber(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
}

export default function AssetLoansPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/asset-loans");
  const [asset, setAsset] = useState("");
  const [borrower, setBorrower] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!asset.trim() || !borrower.trim()) { toast.error(t("loans.f.asset")); return; }
    setBusy(true);
    try { await apiPost("/api/asset-loans", { assetName: asset, borrowerName: borrower, dueAt: due || undefined }); setAsset(""); setBorrower(""); setDue(""); toast.success(t("loans.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const back = async (id: string) => {
    try { await apiPatch("/api/asset-loans", { id }); toast.success(t("loans.backToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("loans.title")} desc={t("loans.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Wrench className="w-5 h-5" /> {t("loans.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="b-input w-full" value={asset} onChange={(e) => setAsset(e.target.value)} placeholder={t("loans.f.asset")} />
          <input className="b-input w-full" value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder={t("loans.f.borrower")} />
          <input className="b-input w-full" dir="ltr" value={due} onChange={(e) => setDue(e.target.value)} placeholder={t("loans.f.due")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />} {t("loans.add")}
        </button>
      </section>
      <h2 className="font-bold">{t("loans.outNow")} ({faNumber(data.out.length)})</h2>
      {data.out.length === 0 ? (
        <EmptyState title={t("loans.emptyOut")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.out.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.assetName}</p>
                <p className="text-sm text-muted-foreground">{r.borrowerName} · {when(r.outAt)}{r.dueAt ? ` · ${t("loans.due")}: ${faNumber(r.dueAt)}` : ""}</p>
              </div>
              <button className="b-btn b-btn-primary min-h-11" onClick={() => back(r.id)}><Undo2 className="w-4 h-4" /> {t("loans.back")}</button>
            </div>
          ))}
        </section>
      )}
      {data.history.length > 0 && (
        <>
          <h2 className="font-bold">{t("loans.history")}</h2>
          <section className="b-card divide-y divide-border">
            {data.history.map((r) => (
              <div key={r.id} className="p-3 text-sm flex flex-wrap gap-2">
                <span className="font-bold">{r.assetName}</span>
                <span className="text-muted-foreground">{r.borrowerName} · {when(r.outAt)} ← {r.inAt ? when(r.inAt) : ""}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
