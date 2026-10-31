"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Undo2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; keyLabel: string; holderName: string; outAt: string; inAt: string | null; note: string | null };
type Data = { out: Row[]; history: Row[] };

function when(iso: string) {
  const d = new Date(iso);
  return faNumber(d.toLocaleDateString("fa-IR")) + " " + faNumber(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
}

export default function KeysLogPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/keys-log");
  const [keyLabel, setKeyLabel] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const checkout = async () => {
    if (!keyLabel.trim() || !holder.trim()) { toast.error(t("keysLog.f.key")); return; }
    setBusy(true);
    try { await apiPost("/api/keys-log", { keyLabel, holderName: holder }); setKeyLabel(""); setHolder(""); toast.success(t("keysLog.outToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const checkin = async (id: string) => {
    try { await apiPatch("/api/keys-log", { id }); toast.success(t("keysLog.inToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("keysLog.title")} desc={t("keysLog.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5" /> {t("keysLog.outTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder={t("keysLog.f.key")} />
          <input className="b-input w-full" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={t("keysLog.f.holder")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={checkout}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} {t("keysLog.checkout")}
        </button>
      </section>
      <h2 className="font-bold">{t("keysLog.outNow")} ({faNumber(data.out.length)})</h2>
      {data.out.length === 0 ? (
        <EmptyState title={t("keysLog.emptyOut")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.out.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.keyLabel}</p>
                <p className="text-sm text-muted-foreground">{r.holderName} · {when(r.outAt)}</p>
              </div>
              <button className="b-btn b-btn-primary min-h-11" onClick={() => checkin(r.id)}><Undo2 className="w-4 h-4" /> {t("keysLog.checkin")}</button>
            </div>
          ))}
        </section>
      )}
      {data.history.length > 0 && (
        <>
          <h2 className="font-bold">{t("keysLog.history")}</h2>
          <section className="b-card divide-y divide-border">
            {data.history.map((r) => (
              <div key={r.id} className="p-3 text-sm flex flex-wrap gap-2">
                <span className="font-bold">{r.keyLabel}</span>
                <span className="text-muted-foreground">{r.holderName} · {when(r.outAt)} ← {r.inAt ? when(r.inAt) : ""}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
