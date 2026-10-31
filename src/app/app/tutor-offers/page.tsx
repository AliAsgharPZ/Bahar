"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; studentName: string; subject: string; level: string | null; note: string | null; mine: boolean };
type Data = { myStudentId: string | null; items: Row[] };

export default function TutorOffersPage() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/tutor-offers${q ? `?subject=${encodeURIComponent(q)}` : ""}`, [q]);
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!subject.trim()) { toast.error(t("tutor.f.subject")); return; }
    setBusy(true);
    try { await apiPost("/api/tutor-offers", { subject, level: level || undefined, note: note || undefined }); setSubject(""); setLevel(""); setNote(""); toast.success(t("tutor.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/tutor-offers?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("tutor.title")} desc={t("tutor.desc")} />
      {data.myStudentId && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5" /> {t("tutor.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="b-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("tutor.f.subject")} />
            <input className="b-input w-full" value={level} onChange={(e) => setLevel(e.target.value)} placeholder={t("tutor.f.level")} />
            <input className="b-input w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("tutor.f.note")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />} {t("tutor.add")}
          </button>
        </section>
      )}
      <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("tutor.searchPh")} aria-label={t("tutor.searchPh")} />
      {data.items.length === 0 ? (
        <EmptyState title={t("tutor.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.subject}</p>
                {r.mine && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("tutor.delete")}><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-sm text-muted-foreground">{r.studentName}{r.level ? ` · ${r.level}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
              {r.mine && <span className="text-xs text-info">{t("tutor.mine")}</span>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
