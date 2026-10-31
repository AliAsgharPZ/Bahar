"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, Check, X } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Note = { id: string; fromName: string | null; toName: string; text: string };
type Data = { canMod: boolean; approved: Note[]; pending: Note[] };

export default function KindnessWallPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/kindness-wall");
  const [toName, setToName] = useState("");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!toName.trim() || text.trim().length < 5) { toast.error(t("kindness.f.text")); return; }
    setBusy(true);
    try { await apiPost("/api/kindness-wall", { toName, text, anonymous }); setToName(""); setText(""); toast.success(t("kindness.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const mod = async (id: string, approve: boolean) => {
    try { await apiPatch("/api/kindness-wall", { id, approve }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("kindness.title")} desc={t("kindness.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Heart className="w-5 h-5" /> {t("kindness.addTitle")}</h2>
        <input className="b-input w-full" value={toName} onChange={(e) => setToName(e.target.value)} placeholder={t("kindness.f.to")} />
        <textarea className="b-input w-full min-h-20" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("kindness.f.text")} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="w-5 h-5" />
          {t("kindness.anon")}
        </label>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />} {t("kindness.add")}
        </button>
      </section>
      {data.canMod && data.pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">{t("kindness.pendingTitle")} ({faNumber(data.pending.length)})</h2>
          {data.pending.map((n) => (
            <article key={n.id} className="b-card p-4 space-y-2 border-dashed">
              <p className="text-sm"><b>{t("kindness.to")} {n.toName}</b> — {n.text}</p>
              <p className="text-sm text-muted-foreground">{t("kindness.from")} {n.fromName ?? t("kindness.anonName")}</p>
              <div className="flex gap-2">
                <button className="b-btn b-btn-primary min-h-11" onClick={() => mod(n.id, true)}><Check className="w-4 h-4" /> {t("kindness.approve")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => mod(n.id, false)}><X className="w-4 h-4" /> {t("kindness.remove")}</button>
              </div>
            </article>
          ))}
        </section>
      )}
      {data.approved.length === 0 ? (
        <EmptyState title={t("kindness.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.approved.map((n) => (
            <article key={n.id} className="b-card p-4 space-y-1">
              <p className="font-bold flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" /> {t("kindness.to")} {n.toName}</p>
              <p className="text-sm">{n.text}</p>
              <p className="text-sm text-muted-foreground">{t("kindness.from")} {n.fromName ?? t("kindness.anonName")}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
