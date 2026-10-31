"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; description: string; status: string; requesterName: string };
type Data = { isOffice: boolean; items: Row[] };

export default function ClubProposalsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/club-proposals");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim() || desc.trim().length < 10) { toast.error(t("clubProp.f.desc")); return; }
    setBusy(true);
    try { await apiPost("/api/club-proposals", { title, description: desc }); setTitle(""); setDesc(""); toast.success(t("clubProp.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/club-proposals", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("clubProp.title")} desc={t("clubProp.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5" /> {t("clubProp.addTitle")}</h2>
        <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("clubProp.f.title")} />
        <textarea className="b-input w-full min-h-24" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("clubProp.f.desc")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {t("clubProp.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("clubProp.empty")} />
      ) : (
        <section className="space-y-3">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold flex-1">{r.title}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                  {t(`clubProp.status.${r.status}`)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.description}</p>
              <p className="text-sm text-muted-foreground">{t("clubProp.by")} {r.requesterName}</p>
              {data.isOffice && r.status === "PENDING" && (
                <div className="flex gap-2">
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "APPROVED")}>{t("clubProp.approve")}</button>
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("clubProp.reject")}</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
