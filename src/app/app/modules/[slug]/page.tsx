"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Def = { slug: string; category: string; topic: string; mechanic: string; audience: string; level: string; format: string; title: string; description: string };
type Entry = { id: string; progress: number; note: string | null; status: string };

export default function ModuleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { t } = useLang();
  const mod = useApi<{ item: Def }>(`/api/modules?slug=${slug}`, [slug]);
  const entries = useApi<{ items: Entry[] }>(`/api/module-entries?slug=${slug}`, [slug]);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (mod.loading || entries.loading) return <LoadingBlock />;
  if (mod.error || !mod.data) return <ErrorBox message={mod.error || t("common.error")} onRetry={mod.refetch} />;
  const d = mod.data.item;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/module-entries", { moduleSlug: slug, progress, note: note || undefined }); setProgress(0); setNote(""); toast.success(t("modules.addedToast")); entries.refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={d.title} desc={d.description} />
      <p className="text-sm text-muted-foreground">{d.category} · {d.topic} · {d.mechanic} · {d.audience} · {d.level} · {d.format}</p>
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold">{t("modules.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} placeholder={t("modules.f.progress")} aria-label={t("modules.f.progress")} />
          <input className="b-input w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("modules.f.note")} aria-label={t("modules.f.note")} />
        </div>
        <button className="b-btn b-btn-spring min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("modules.add")}
        </button>
      </section>
      {!entries.data || entries.data.items.length === 0 ? (
        <EmptyState title={t("modules.emptyEntries")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {entries.data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{faNumber(r.progress)}٪ · {r.status === "DONE" ? t("modules.done") : t("modules.active")}</p>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={async () => { try { await apiDelete(`/api/module-entries?id=${r.id}`); entries.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); } }} aria-label={t("modules.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
              {r.status !== "DONE" && <button className="b-btn b-btn-ghost min-h-11" onClick={async () => { await apiPatch("/api/module-entries", { id: r.id, status: "DONE" }); entries.refetch(); }}>{t("modules.done")}</button>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
