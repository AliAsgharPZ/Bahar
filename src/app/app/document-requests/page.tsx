"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileBadge, Loader2, Check, PackageCheck, X } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = {
  id: string; kind: string; kindFa: string; purpose: string | null; status: string; staffNote: string | null;
  createdAt: string; studentName: string; studentNumber: string; className: string | null;
  requester: { firstName: string; lastName: string; role: string } | null;
};
type Data = { isOffice: boolean; myStudents: { id: string; name: string }[]; pendingCount: number; items: Row[] };

const KINDS = ["ENROLLMENT_CERT", "TRANSCRIPT", "INTRODUCTION", "OTHER"] as const;

function chip(status: string, t: (k: string) => string) {
  const cls = status === "PENDING" ? "bg-warning/15 text-warning" : status === "READY" ? "bg-info/15 text-info" : status === "DELIVERED" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive";
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{t(`documents.status.${status}`)}</span>;
}

export default function DocumentRequestsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/document-requests");
  const [studentId, setStudentId] = useState("");
  const [kind, setKind] = useState<string>("ENROLLMENT_CERT");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const chosenStudent = studentId || data.myStudents[0]?.id || "";

  const send = async () => {
    if (!chosenStudent) { toast.error(t("documents.f.student")); return; }
    setBusy(true);
    try {
      await apiPost("/api/document-requests", { studentId: chosenStudent, kind, purpose: purpose || undefined });
      setPurpose("");
      toast.success(t("documents.sentToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const handle = async (id: string, status: string) => {
    try {
      await apiPatch("/api/document-requests", { id, status, staffNote: notes[id] || undefined });
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("documents.title")} desc={t("documents.desc")} />

      {!data.isOffice && data.myStudents.length > 0 && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><FileBadge className="w-5 h-5" /> {t("documents.newTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="b-input w-full" value={chosenStudent} onChange={(e) => setStudentId(e.target.value)} aria-label={t("documents.f.student")}>
              {data.myStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="b-input w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("documents.f.kind")}>
              {KINDS.map((k) => <option key={k} value={k}>{t(`documents.kind.${k}`)}</option>)}
            </select>
            <input className="b-input w-full" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("documents.f.purpose")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={send}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBadge className="w-4 h-4" />} {t("documents.send")}
          </button>
        </section>
      )}

      <h3 className="font-bold">
        {data.isOffice ? `${t("documents.queueTitle")} (${faNumber(data.pendingCount)} ${t("documents.status.PENDING")})` : t("documents.mineTitle")}
      </h3>
      {data.items.length === 0 ? (
        <EmptyState title={t("documents.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{r.kindFa}</p>
                {chip(r.status, t)}
                <span className="text-sm text-muted-foreground">
                  {r.studentName}{r.className ? ` · ${r.className}` : ""} · {faNumber(r.studentNumber)}
                  {data.isOffice && r.requester ? ` · ${r.requester.firstName} ${r.requester.lastName}` : ""}
                </span>
              </div>
              {r.purpose && <p className="text-sm text-muted-foreground">{r.purpose}</p>}
              {r.staffNote && <p className="text-sm">{r.staffNote}</p>}
              {data.isOffice && r.status !== "DELIVERED" && r.status !== "REJECTED" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="b-input min-h-11 flex-1 min-w-48"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder={t("documents.staffNotePh")}
                    aria-label={t("documents.staffNotePh")}
                  />
                  {r.status === "PENDING" && (
                    <button className="b-btn b-btn-primary min-h-11" onClick={() => handle(r.id, "READY")}><Check className="w-4 h-4" /> {t("documents.markReady")}</button>
                  )}
                  {r.status === "READY" && (
                    <button className="b-btn b-btn-primary min-h-11" onClick={() => handle(r.id, "DELIVERED")}><PackageCheck className="w-4 h-4" /> {t("documents.markDelivered")}</button>
                  )}
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => handle(r.id, "REJECTED")}><X className="w-4 h-4" /> {t("documents.reject")}</button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
