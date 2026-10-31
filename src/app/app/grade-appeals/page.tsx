"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Scale, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; subject: string; reason: string; status: string; response: string | null; studentName: string; className: string | null };
type Data = { isStaff: boolean; items: Row[] };

const NEXT_ACTIONS: Record<string, { status: string; key: string }[]> = {
  PENDING: [{ status: "REVIEWING", key: "appeals.toReviewing" }, { status: "APPROVED", key: "appeals.approve" }, { status: "REJECTED", key: "appeals.reject" }],
  REVIEWING: [{ status: "APPROVED", key: "appeals.approve" }, { status: "REJECTED", key: "appeals.reject" }],
};

export default function GradeAppealsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/grade-appeals");
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!subject.trim() || reason.trim().length < 5) { toast.error(t("appeals.f.reason")); return; }
    setBusy(true);
    try { await apiPost("/api/grade-appeals", { subject, reason }); setSubject(""); setReason(""); toast.success(t("appeals.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (r: Row, status: string) => {
    try { await apiPatch("/api/grade-appeals", { id: r.id, status, response: responses[r.id] || undefined }); toast.success(t("appeals.decidedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("appeals.title")} desc={t("appeals.desc")} />
      {!data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Scale className="w-5 h-5" /> {t("appeals.addTitle")}</h2>
          <input className="b-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("appeals.f.subject")} />
          <textarea className="b-input w-full min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("appeals.f.reason")} />
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />} {t("appeals.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("appeals.empty")} />
      ) : (
        <section className="space-y-3">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold flex-1">{r.subject}{data.isStaff ? ` — ${r.studentName}` : ""}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "APPROVED" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : r.status === "REVIEWING" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                  {t(`appeals.status.${r.status}`)}
                </span>
              </div>
              <p className="text-sm">{r.reason}</p>
              {r.className && <p className="text-sm text-muted-foreground">{r.className}</p>}
              {r.response && <p className="text-sm text-muted-foreground">{t("appeals.response")}: {r.response}</p>}
              {data.isStaff && NEXT_ACTIONS[r.status] && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <input
                    className="b-input min-h-11 flex-1 min-w-44"
                    value={responses[r.id] ?? ""}
                    onChange={(e) => setResponses((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder={t("appeals.f.response")}
                    aria-label={t("appeals.f.response")}
                  />
                  {NEXT_ACTIONS[r.status].map((a) => (
                    <button key={a.status} className="b-btn b-btn-ghost min-h-11" onClick={() => decide(r, a.status)}>{t(a.key)}</button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
