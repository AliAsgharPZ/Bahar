"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; category: string; text: string; status: string; handledNote: string | null; createdAt: string };
type Data = { items: Row[]; newCount: number };

const CATS = ["BULLYING", "SAFETY", "HEALTH", "OTHER"] as const;

export default function SafetyReportsPage() {
  const { t } = useLang();
  const [category, setCategory] = useState("BULLYING");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (text.trim().length < 10) { toast.error(t("safety.f.text")); return; }
    setBusy(true);
    try { await apiPost("/api/safety-reports", { category, text }); setText(""); setSent(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("safety.title")} desc={t("safety.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> {t("safety.formTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c} className={`px-3 min-h-11 rounded-full border text-sm ${category === c ? "bg-primary text-primary-foreground border-primary" : "border-border"}`} onClick={() => setCategory(c)} aria-pressed={category === c}>
              {t(`safety.cat.${c}`)}
            </button>
          ))}
        </div>
        <textarea className="b-input w-full min-h-28" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("safety.f.text")} />
        <p className="text-sm text-muted-foreground">{t("safety.anonNote")}</p>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} {t("safety.send")}
        </button>
        {sent && <p className="text-success text-sm">{t("safety.sent")}</p>}
      </section>
      <CounselQueue t={t} />
    </div>
  );
}

function CounselQueue({ t }: { t: (k: string) => string }) {
  // فقط برای مدیریت/معاون داده برمی‌گردد؛ برای بقیه خطای دسترسی می‌آید و چیزی نمایش داده نمی‌شود
  const { data } = useApi<Data>("/api/safety-reports");
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!data) return null;

  const patch = async (id: string, status: string) => {
    try { await apiPatch("/api/safety-reports", { id, status, handledNote: notes[id] || undefined }); toast.success(t("safety.handledToast")); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-bold">{t("safety.queueTitle")} ({faNumber(data.newCount)} {t("safety.new")})</h2>
      {data.items.length === 0 ? (
        <EmptyState title={t("safety.empty")} />
      ) : (
        data.items.map((r) => (
          <article key={r.id} className="b-card p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs bg-destructive/15 text-destructive">{t(`safety.cat.${r.category}`)}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "NEW" ? "bg-warning/15 text-warning" : r.status === "HANDLED" ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>
                {t(`safety.status.${r.status}`)}
              </span>
              <span className="text-sm text-muted-foreground">{faNumber(new Date(r.createdAt).toLocaleDateString("fa-IR"))}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{r.text}</p>
            {r.handledNote && <p className="text-sm text-muted-foreground">{t("safety.note")}: {r.handledNote}</p>}
            {r.status !== "HANDLED" && (
              <div className="flex flex-wrap gap-2">
                <input className="b-input min-h-11 flex-1 min-w-44" value={notes[r.id] ?? ""} onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))} placeholder={t("safety.f.note")} aria-label={t("safety.f.note")} />
                {r.status === "NEW" && <button className="b-btn b-btn-ghost min-h-11" onClick={() => patch(r.id, "SEEN")}>{t("safety.seen")}</button>}
                <button className="b-btn b-btn-primary min-h-11" onClick={() => patch(r.id, "HANDLED")}>{t("safety.handled")}</button>
              </div>
            )}
          </article>
        ))
      )}
    </section>
  );
}
