"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HeartHandshake, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; focus: string | null; isActive: boolean; mentorName: string; menteeName: string; mentorClass: string | null; menteeClass: string | null };
type Data = { isOffice: boolean; items: Row[] };
type StudentRow = { id: string; user: { firstName: string; lastName: string } };

export default function MentoringPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/mentoring");
  const { data: allStudents } = useApi<{ students: StudentRow[] }>("/api/students?take=200");
  const [mentorId, setMentorId] = useState("");
  const [menteeId, setMenteeId] = useState("");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!mentorId || !menteeId) { toast.error(t("mentoring.f.both")); return; }
    setBusy(true);
    try { await apiPost("/api/mentoring", { mentorStudentId: mentorId, menteeStudentId: menteeId, focus: focus || undefined }); setFocus(""); toast.success(t("mentoring.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const toggle = async (r: Row) => {
    try { await apiPatch("/api/mentoring", { id: r.id, isActive: !r.isActive }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const opts = (allStudents?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>);

  return (
    <div className="space-y-6">
      <PageHeader title={t("mentoring.title")} desc={t("mentoring.desc")} />
      {data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><HeartHandshake className="w-5 h-5" /> {t("mentoring.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="b-input w-full" value={mentorId} onChange={(e) => setMentorId(e.target.value)} aria-label={t("mentoring.f.mentor")}>
              <option value="">{t("mentoring.f.mentor")}</option>{opts}
            </select>
            <select className="b-input w-full" value={menteeId} onChange={(e) => setMenteeId(e.target.value)} aria-label={t("mentoring.f.mentee")}>
              <option value="">{t("mentoring.f.mentee")}</option>{opts}
            </select>
            <input className="b-input w-full" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder={t("mentoring.f.focus")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />} {t("mentoring.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("mentoring.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <p className="font-bold">{r.mentorName} <span className="text-muted-foreground">← همیارِ</span> {r.menteeName}</p>
              <p className="text-sm text-muted-foreground">
                {[r.mentorClass, r.menteeClass].filter(Boolean).join(" · ")}{r.focus ? ` · ${r.focus}` : ""}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {r.isActive ? t("mentoring.active") : t("mentoring.inactive")}
                </span>
                {data.isOffice && <button className="b-btn b-btn-ghost min-h-11" onClick={() => toggle(r)}>{r.isActive ? t("mentoring.deactivate") : t("mentoring.activate")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
