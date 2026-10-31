"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Library, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; author: string | null; reason: string | null; status: string; requesterName: string };
type Data = { canDecide: boolean; items: Row[] };

export default function BookSuggestionsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/book-suggestions");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("bookSug.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/book-suggestions", { title, author: author || undefined, reason: reason || undefined }); setTitle(""); setAuthor(""); setReason(""); toast.success(t("bookSug.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/book-suggestions", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("bookSug.title")} desc={t("bookSug.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Library className="w-5 h-5" /> {t("bookSug.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("bookSug.f.title")} />
          <input className="b-input w-full" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t("bookSug.f.author")} />
        </div>
        <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("bookSug.f.reason")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Library className="w-4 h-4" />} {t("bookSug.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("bookSug.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.title}{r.author ? ` — ${r.author}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.requesterName}{r.reason ? ` · ${r.reason}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "BOUGHT" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                {t(`bookSug.status.${r.status}`)}
              </span>
              {data.canDecide && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "BOUGHT")}>{t("bookSug.bought")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("bookSug.reject")}</button>
              </>)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
