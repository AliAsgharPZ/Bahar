"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Target, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; metric: string; targetValue: string | null; currentValue: string | null; status: string; studentName: string; className: string | null; note: string | null };
type Data = { isStaff: boolean; items: Row[] };

export default function StudentGoalsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/student-goals");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("goals2.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/student-goals", { title, targetValue: target || undefined }); setTitle(""); setTarget(""); toast.success(t("goals2.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const saveProgress = async (r: Row) => {
    try { await apiPatch("/api/student-goals", { id: r.id, currentValue: progress[r.id] ?? r.currentValue ?? "" }); toast.success(t("goals2.savedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const setStatus = async (r: Row, status: string) => {
    try { await apiPatch("/api/student-goals", { id: r.id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("goals2.title")} desc={t("goals2.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Target className="w-5 h-5" /> {t("goals2.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("goals2.f.title")} />
          <input className="b-input w-full" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("goals2.f.target")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} {t("goals2.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("goals2.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.title}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "ACHIEVED" ? "bg-success/15 text-success" : r.status === "DROPPED" ? "bg-muted text-muted-foreground" : "bg-info/15 text-info"}`}>
                  {t(`goals2.status.${r.status}`)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {data.isStaff ? `${r.studentName}${r.className ? ` · ${r.className}` : ""} · ` : ""}
                {t("goals2.target")}: {r.targetValue ?? "—"} · {t("goals2.now")}: {r.currentValue ?? "—"}
              </p>
              {r.status === "ACTIVE" && (
                <div className="flex flex-wrap gap-2">
                  <input
                    className="b-input min-h-11 flex-1 min-w-36"
                    value={progress[r.id] ?? r.currentValue ?? ""}
                    onChange={(e) => setProgress((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder={t("goals2.f.current")}
                    aria-label={t("goals2.f.current")}
                  />
                  <button className="b-btn b-btn-ghost min-h-11" onClick={() => saveProgress(r)}>{t("goals2.saveProgress")}</button>
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => setStatus(r, "ACHIEVED")}>{t("goals2.achieve")}</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
