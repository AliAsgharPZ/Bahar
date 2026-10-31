"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Loader2, Trash2, Trophy } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; team: string; category: string | null; description: string | null; score: number | null; award: string | null };
type Data = { isStaff: boolean; items: Row[] };

export default function ScienceFairPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/science-fair");
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim() || !team.trim()) { toast.error(t("science.f.team")); return; }
    setBusy(true);
    try { await apiPost("/api/science-fair", { title, team, category: category || undefined, description: desc || undefined }); setTitle(""); setTeam(""); setDesc(""); toast.success(t("science.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const score = async (r: Row) => {
    try { await apiPatch("/api/science-fair", { id: r.id, score: Number(scores[r.id] ?? r.score ?? 0) }); toast.success(t("science.scoredToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const award = async (r: Row) => {
    const v = prompt(t("science.f.award"), r.award ?? "");
    if (v === null) return;
    try { await apiPatch("/api/science-fair", { id: r.id, award: v }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/science-fair?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("science.title")} desc={t("science.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><FlaskConical className="w-5 h-5" /> {t("science.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("science.f.titleP")} />
          <input className="b-input w-full" value={team} onChange={(e) => setTeam(e.target.value)} placeholder={t("science.f.team")} />
          <input className="b-input w-full" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("science.f.category")} />
        </div>
        <textarea className="b-input w-full min-h-16" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("science.f.desc")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} {t("science.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("science.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.title}</p>
                {r.score !== null && <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-bold">{faNumber(r.score)}</span>}
                {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("science.delete")}><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-sm text-muted-foreground">{r.team}{r.category ? ` · ${r.category}` : ""}</p>
              {r.description && <p className="text-sm">{r.description}</p>}
              {r.award && <p className="text-sm text-warning flex items-center gap-1"><Trophy className="w-4 h-4" /> {r.award}</p>}
              {data.isStaff && (
                <div className="flex gap-2 pt-1">
                  <input
                    className="b-input min-h-11 w-24" inputMode="numeric"
                    value={scores[r.id] ?? (r.score !== null ? String(r.score) : "")}
                    onChange={(e) => setScores((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder={t("science.f.score")}
                    aria-label={t("science.f.score")}
                  />
                  <button className="b-btn b-btn-ghost min-h-11" onClick={() => score(r)}>{t("science.scoreBtn")}</button>
                  <button className="b-btn b-btn-ghost min-h-11" onClick={() => award(r)}>{t("science.awardBtn")}</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
