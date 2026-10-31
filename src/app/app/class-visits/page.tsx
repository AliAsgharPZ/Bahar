"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; parentName: string; date: string; reason: string | null; status: string };
type Data = { isOffice: boolean; items: Row[] };

export default function ClassVisitsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/class-visits");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast.error(t("visits.f.date")); return; }
    setBusy(true);
    try { await apiPost("/api/class-visits", { date, reason: reason || undefined }); setDate(""); setReason(""); toast.success(t("visits.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/class-visits", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("visits.title")} desc={t("visits.desc")} />
      {!data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><DoorOpen className="w-5 h-5" /> {t("visits.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="b-input w-full" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder={t("visits.f.date")} />
            <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("visits.f.reason")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <DoorOpen className="w-4 h-4" />} {t("visits.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("visits.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{faNumber(r.date)}{data.isOffice ? ` — ${r.parentName}` : ""}</p>
                {r.reason && <p className="text-sm text-muted-foreground">{r.reason}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                {t(`visits.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("visits.approve")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("visits.reject")}</button>
              </>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
