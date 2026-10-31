"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Trophy, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Log = { id: string; bookTitle: string; author: string | null; pages: number; finished: boolean; rating: number | null };
type Data = { mine: Log[]; myStudentId: string | null; isStaff: boolean; leaderboard: { studentId: string; name: string; className: string | null; pages: number; books: number }[] };

export default function ReadingPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/reading");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [finished, setFinished] = useState(true);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("reading.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/reading", { bookTitle: title, author: author || undefined, pages: Number(pages) || 0, finished }); setTitle(""); setAuthor(""); setPages(""); toast.success(t("reading.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/reading?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("reading.title")} desc={t("reading.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5" /> {t("reading.leaderboard")}</h2>
        {data.leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("reading.noLeaders")}</p>
        ) : (
          <ol className="space-y-1">
            {data.leaderboard.map((l, i) => (
              <li key={l.studentId} className="flex items-center gap-2 text-sm">
                <span className="w-7 font-bold">{faNumber(i + 1)}.</span>
                <span className="flex-1">{l.name}{l.className ? ` · ${l.className}` : ""}</span>
                <span>{faNumber(l.books)} {t("reading.books")} · {faNumber(l.pages)} {t("reading.pages")}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      {data.myStudentId && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><BookOpen className="w-5 h-5" /> {t("reading.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("reading.f.title")} />
            <input className="b-input w-full" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t("reading.f.author")} />
            <input className="b-input w-full" inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={t("reading.f.pages")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="w-5 h-5" />
            {t("reading.f.finished")}
          </label>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />} {t("reading.add")}
          </button>
        </section>
      )}
      {data.myStudentId && (data.mine.length === 0 ? (
        <EmptyState title={t("reading.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.mine.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.bookTitle}</p>
                <p className="text-sm text-muted-foreground">{r.author ?? ""} · {faNumber(r.pages)} {t("reading.pages")}{r.rating ? ` · ⭐ ${faNumber(r.rating)}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.finished ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {r.finished ? t("reading.finished") : t("reading.reading")}
              </span>
              <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("reading.delete")}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
