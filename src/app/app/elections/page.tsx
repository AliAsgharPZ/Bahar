"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Vote, Loader2, CheckCircle2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Cand = { id: string; name: string; className: string | null; manifesto: string | null; approved: boolean; votes: number | null };
type Election = { id: string; title: string; status: string; myCandidateId: string | null; candidates: Cand[]; totalVotes: number | null };
type Data = { isOffice: boolean; elections: Election[] };

export default function ElectionsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/elections");
  const [title, setTitle] = useState("");
  const [nom, setNom] = useState<Record<string, { name: string; manifesto: string }>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const act = async (payload: Record<string, unknown>, msg?: string) => {
    try { await apiPost("/api/elections", payload); if (msg) toast.success(msg); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const create = async () => {
    if (!title.trim()) { toast.error(t("elections.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/elections", { action: "create", title }); setTitle(""); toast.success(t("elections.createdToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("elections.title")} desc={t("elections.desc")} />
      {data.isOffice && (
        <section className="b-card p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input className="b-input flex-1 min-w-52" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("elections.f.title")} />
            <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={create}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />} {t("elections.create")}
            </button>
          </div>
        </section>
      )}
      {data.elections.length === 0 ? (
        <EmptyState title={t("elections.empty")} />
      ) : (
        data.elections.map((e) => (
          <section key={e.id} className="b-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold flex-1">{e.title}</h2>
              <span className="px-2 py-0.5 rounded-full text-xs bg-info/15 text-info">{t(`elections.status.${e.status}`)}</span>
              {e.totalVotes !== null && <span className="text-sm text-muted-foreground">{faNumber(e.totalVotes)} {t("elections.votes")}</span>}
              {data.isOffice && e.status === "NOMINATION" && <button className="b-btn b-btn-primary min-h-11" onClick={() => act({ action: "status", electionId: e.id, status: "VOTING" }, t("elections.startedToast"))}>{t("elections.startVoting")}</button>}
              {data.isOffice && e.status === "VOTING" && <button className="b-btn b-btn-ghost min-h-11" onClick={() => act({ action: "status", electionId: e.id, status: "CLOSED" }, t("elections.closedToast"))}>{t("elections.close")}</button>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {e.candidates.map((c) => (
                <article key={c.id} className={`rounded-2xl border p-3 space-y-1 ${e.myCandidateId === c.id ? "border-primary" : "border-border"}`}>
                  <p className="font-bold flex items-center gap-2">
                    {c.name}
                    {e.myCandidateId === c.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    {!c.approved && <span className="text-xs text-warning">{t("elections.pendingApproval")}</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{c.className ?? ""}{c.manifesto ? ` — ${c.manifesto}` : ""}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {c.votes !== null && <span className="text-sm font-bold">{faNumber(c.votes)} {t("elections.votes")}</span>}
                    {e.status === "VOTING" && !e.myCandidateId && (
                      <button className="b-btn b-btn-primary min-h-11" onClick={() => act({ action: "vote", electionId: e.id, candidateId: c.id }, t("elections.votedToast"))}>{t("elections.voteBtn")}</button>
                    )}
                    {data.isOffice && !c.approved && (
                      <button className="b-btn b-btn-ghost min-h-11" onClick={() => act({ action: "approve", electionId: e.id, candidateId: c.id }, t("elections.approvedToast"))}>{t("elections.approve")}</button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {e.status === "NOMINATION" && (
              <div className="flex flex-wrap gap-2">
                <input
                  className="b-input flex-1 min-w-44" placeholder={t("elections.f.candidateName")}
                  value={nom[e.id]?.name ?? ""}
                  onChange={(ev) => setNom((s) => ({ ...s, [e.id]: { name: ev.target.value, manifesto: s[e.id]?.manifesto ?? "" } }))}
                />
                <input
                  className="b-input flex-1 min-w-44" placeholder={t("elections.f.manifesto")}
                  value={nom[e.id]?.manifesto ?? ""}
                  onChange={(ev) => setNom((s) => ({ ...s, [e.id]: { name: s[e.id]?.name ?? "", manifesto: ev.target.value } }))}
                />
                <button
                  className="b-btn b-btn-ghost min-h-11"
                  onClick={() => act({ action: "nominate", electionId: e.id, name: nom[e.id]?.name ?? "", manifesto: nom[e.id]?.manifesto || undefined }, t("elections.nominatedToast"))}
                >
                  {t("elections.nominate")}
                </button>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
