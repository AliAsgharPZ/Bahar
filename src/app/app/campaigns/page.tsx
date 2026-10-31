"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Loader2, HandHeart } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; description: string | null; goalText: string | null; endsAt: string | null; isActive: boolean; joined: boolean; count: number; recentNames: string[] };
type Data = { canCreate: boolean; items: Row[] };

export default function CampaignsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/campaigns");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const create = async () => {
    if (!title.trim()) { toast.error(t("campaigns.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/campaigns", { title, description: desc || undefined, goalText: goal || undefined }); setTitle(""); setDesc(""); setGoal(""); toast.success(t("campaigns.createdToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const join = async (id: string) => {
    try { await apiPost("/api/campaigns", { action: "join", campaignId: id }); toast.success(t("campaigns.joinedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const close = async (id: string) => {
    try { await apiPatch("/api/campaigns", { id, isActive: false }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("campaigns.title")} desc={t("campaigns.desc")} />
      {data.canCreate && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Megaphone className="w-5 h-5" /> {t("campaigns.createTitle")}</h2>
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("campaigns.f.title")} />
          <textarea className="b-input w-full min-h-20" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("campaigns.f.desc")} />
          <input className="b-input w-full" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t("campaigns.f.goal")} />
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={create}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} {t("campaigns.create")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("campaigns.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((c) => (
            <article key={c.id} className="b-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{c.title}</p>
                {!c.isActive && <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">{t("campaigns.finished")}</span>}
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              {c.goalText && <p className="text-sm">🎯 {c.goalText}</p>}
              <p className="text-sm text-muted-foreground">
                {faNumber(c.count)} {t("campaigns.members")}
                {c.recentNames.length > 0 ? ` — ${c.recentNames.join("، ")}` : ""}
              </p>
              <div className="flex gap-2">
                {c.isActive && !c.joined && (
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => join(c.id)}>
                    <HandHeart className="w-4 h-4" /> {t("campaigns.join")}
                  </button>
                )}
                {c.joined && <span className="text-sm text-success self-center">{t("campaigns.youJoined")}</span>}
                {data.canCreate && c.isActive && <button className="b-btn b-btn-ghost min-h-11" onClick={() => close(c.id)}>{t("campaigns.finish")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
