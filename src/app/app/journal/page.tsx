"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NotebookPen, Loader2, Trash2, Share2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Entry = { id: string; date: string; mood: string | null; text: string; shared: boolean };
type Shared = { id: string; date: string; mood: string | null; text: string; authorName: string };
type Data = { mine: Entry[]; shared: Shared[]; isStaff: boolean };

const MOODS = ["😀 خوب", "🙂 معمولی", "😐 خسته", "😟 نگران", "🤩 پرانرژی"];

export default function JournalPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/journal");
  const [text, setText] = useState("");
  const [mood, setMood] = useState(MOODS[1]);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"mine" | "shared">("mine");

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (text.trim().length < 3) { toast.error(t("journal.f.text")); return; }
    setBusy(true);
    try { await apiPost("/api/journal", { text, mood, shared: share }); setText(""); setShare(false); toast.success(t("journal.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/journal?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("journal.title")} desc={t("journal.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><NotebookPen className="w-5 h-5" /> {t("journal.todayTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button key={m} className={`px-3 min-h-11 rounded-full border text-sm ${mood === m ? "bg-primary text-primary-foreground border-primary" : "border-border"}`} onClick={() => setMood(m)} aria-pressed={mood === m}>{m}</button>
          ))}
        </div>
        <textarea className="b-input w-full min-h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("journal.f.text")} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="w-5 h-5" />
          <Share2 className="w-4 h-4" /> {t("journal.shareLabel")}
        </label>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <NotebookPen className="w-4 h-4" />} {t("journal.save")}
        </button>
      </section>
      {data.isStaff && (
        <div className="flex rounded-full border border-border overflow-hidden w-fit" role="tablist" aria-label={t("journal.title")}>
          {(["mine", "shared"] as const).map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} className={`px-4 min-h-11 text-sm ${tab === x ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setTab(x)}>
              {x === "mine" ? t("journal.mineTab") : `${t("journal.sharedTab")} (${faNumber(data.shared.length)})`}
            </button>
          ))}
        </div>
      )}
      {tab === "mine" ? (
        data.mine.length === 0 ? <EmptyState title={t("journal.empty")} /> : (
          <section className="space-y-3">
            {data.mine.map((e) => (
              <article key={e.id} className="b-card p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{faNumber(e.date)}</span>
                  {e.mood && <span>{e.mood}</span>}
                  {e.shared && <span className="px-2 py-0.5 rounded-full bg-info/15 text-info text-xs">{t("journal.sharedBadge")}</span>}
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive ms-auto" onClick={() => remove(e.id)} aria-label={t("journal.delete")}><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="whitespace-pre-wrap">{e.text}</p>
              </article>
            ))}
          </section>
        )
      ) : (
        data.shared.length === 0 ? <EmptyState title={t("journal.sharedEmpty")} /> : (
          <section className="space-y-3">
            {data.shared.map((e) => (
              <article key={e.id} className="b-card p-4 space-y-1">
                <p className="text-sm text-muted-foreground">{e.authorName} · {faNumber(e.date)}{e.mood ? ` · ${e.mood}` : ""}</p>
                <p className="whitespace-pre-wrap">{e.text}</p>
              </article>
            ))}
          </section>
        )
      )}
    </div>
  );
}
