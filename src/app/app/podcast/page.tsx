"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Podcast, Loader2, Trash2, Play } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; description: string | null; url: string | null; hostName: string | null; date: string };
type Data = { isStaff: boolean; items: Row[] };

export default function PodcastPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/podcast");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [host, setHost] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("podcast.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/podcast", { title, url: url || undefined, hostName: host || undefined, description: desc || undefined }); setTitle(""); setUrl(""); setHost(""); setDesc(""); toast.success(t("podcast.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/podcast?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("podcast.title")} desc={t("podcast.desc")} />
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Podcast className="w-5 h-5" /> {t("podcast.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("podcast.f.title")} />
            <input className="b-input w-full" value={host} onChange={(e) => setHost(e.target.value)} placeholder={t("podcast.f.host")} />
          </div>
          <input className="b-input w-full" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("podcast.f.url")} />
          <textarea className="b-input w-full min-h-16" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("podcast.f.desc")} />
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Podcast className="w-4 h-4" />} {t("podcast.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("podcast.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.title}</p>
                {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("podcast.delete")}><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-sm text-muted-foreground">{faNumber(r.date)}{r.hostName ? ` · ${t("podcast.host")}: ${r.hostName}` : ""}</p>
              {r.description && <p className="text-sm">{r.description}</p>}
              {r.url && (
                <a className="b-btn b-btn-primary min-h-11 inline-flex" href={r.url} target="_blank" rel="noreferrer">
                  <Play className="w-4 h-4" /> {t("podcast.listen")}
                </a>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
