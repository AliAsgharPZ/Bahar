"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessagesSquare, Loader2, BadgeCheck, Send } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Answer = { id: string; authorName: string; text: string; isBest: boolean; mine: boolean };
type Post = { id: string; authorName: string; subject: string | null; title: string; text: string; solved: boolean; mine: boolean; answers: Answer[] };
type Data = { items: Post[] };

export default function HelpBoardPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/help-board");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const ask = async () => {
    if (!title.trim() || text.trim().length < 5) { toast.error(t("help.f.text")); return; }
    setBusy(true);
    try { await apiPost("/api/help-board", { action: "ask", subject: subject || undefined, title, text }); setSubject(""); setTitle(""); setText(""); toast.success(t("help.askedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const act = async (payload: Record<string, unknown>, msg?: string) => {
    try { await apiPost("/api/help-board", payload); if (msg) toast.success(msg); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("help.title")} desc={t("help.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><MessagesSquare className="w-5 h-5" /> {t("help.askTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("help.f.titleQ")} />
          <input className="b-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("help.f.subject")} />
        </div>
        <textarea className="b-input w-full min-h-20" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("help.f.text")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={ask}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />} {t("help.ask")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("help.empty")} />
      ) : (
        data.items.map((p) => (
          <section key={p.id} className="b-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold flex-1">{p.title}</p>
              {p.subject && <span className="px-2 py-0.5 rounded-full text-xs bg-info/15 text-info">{p.subject}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs ${p.solved ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {p.solved ? t("help.solved") : t("help.open")}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{p.text}</p>
            <p className="text-sm text-muted-foreground">{p.authorName} · {faNumber(p.answers.length)} {t("help.answers")}</p>
            <div className="space-y-2">
              {p.answers.map((a) => (
                <div key={a.id} className={`rounded-2xl border p-3 ${a.isBest ? "border-success" : "border-border"}`}>
                  <p className="text-sm font-bold flex items-center gap-1">
                    {a.authorName}
                    {a.isBest && <span className="text-success flex items-center gap-1 text-xs"><BadgeCheck className="w-4 h-4" /> {t("help.best")}</span>}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{a.text}</p>
                  {p.mine && !p.solved && (
                    <button className="b-btn b-btn-ghost min-h-11" onClick={() => act({ action: "best", postId: p.id, answerId: a.id }, t("help.bestToast"))}>{t("help.chooseBest")}</button>
                  )}
                </div>
              ))}
            </div>
            {!p.solved && (
              <div className="flex gap-2">
                <input
                  className="b-input min-h-11 flex-1"
                  value={answers[p.id] ?? ""}
                  onChange={(e) => setAnswers((s) => ({ ...s, [p.id]: e.target.value }))}
                  placeholder={t("help.f.answer")}
                  aria-label={t("help.f.answer")}
                />
                <button className="b-btn b-btn-primary min-h-11" onClick={() => act({ action: "answer", postId: p.id, text: answers[p.id] ?? "" }, t("help.answeredToast"))}>
                  <Send className="w-4 h-4" /> {t("help.answerBtn")}
                </button>
                {p.mine && <button className="b-btn b-btn-ghost min-h-11" onClick={() => act({ action: "solve", postId: p.id })}>{t("help.solveBtn")}</button>}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
