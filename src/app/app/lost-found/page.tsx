"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackageSearch, Loader2, CheckCheck, Archive, BellRing } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = {
  id: string; kind: string; title: string; description: string | null; location: string | null;
  foundAt: string; status: string; claimedByName: string | null; reporterName: string | null;
  contact: string | null; mine: boolean;
};
type Data = { isStaff: boolean; found: Row[]; lost: Row[] };

function dateOf(iso: string) {
  return faNumber(new Date(iso).toLocaleDateString("fa-IR"));
}

function ItemCard({ r, isStaff, t, onClaim, onDispose, claimNames, setClaimNames }: {
  r: Row; isStaff: boolean; t: (k: string) => string;
  onClaim: (r: Row) => void; onDispose: (id: string) => void;
  claimNames: Record<string, string>; setClaimNames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const open = r.status === "FOUND" || r.status === "SEARCHING";
  return (
    <article className="b-card p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold flex-1">{r.title}</p>
        <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "FOUND" ? "bg-success/15 text-success" : r.status === "SEARCHING" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}>
          {t(`lostFound.status.${r.status}`)}
        </span>
        {r.mine && <span className="px-2 py-0.5 rounded-full text-xs bg-info/15 text-info">{t("lostFound.myReport")}</span>}
      </div>
      {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
      <p className="text-sm text-muted-foreground">
        {r.location ? `${r.kind === "FOUND" ? t("lostFound.f.whereFound") : t("lostFound.f.whereLost")} ${r.location} · ` : ""}
        {dateOf(r.foundAt)}
        {r.kind === "LOST" && r.reporterName ? ` · ${t("lostFound.reporter")} ${r.reporterName}` : ""}
        {r.contact ? ` · ${faNumber(r.contact)}` : ""}
        {r.status === "CLAIMED" && r.claimedByName ? ` → ${r.claimedByName}` : ""}
      </p>
      {open && isStaff && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            className="b-input min-h-11 flex-1 min-w-44"
            value={claimNames[r.id] ?? ""}
            onChange={(e) => setClaimNames((s) => ({ ...s, [r.id]: e.target.value }))}
            placeholder={t("lostFound.claimedToPh")}
            aria-label={t("lostFound.claimedToPh")}
          />
          <button className="b-btn b-btn-primary min-h-11" onClick={() => onClaim(r)}>
            <CheckCheck className="w-4 h-4" /> {r.kind === "FOUND" ? t("lostFound.claimBtn") : t("lostFound.resolveBtn")}
          </button>
          <button className="b-btn b-btn-ghost min-h-11" onClick={() => onDispose(r.id)}>
            <Archive className="w-4 h-4" /> {t("lostFound.disposeBtn")}
          </button>
        </div>
      )}
    </article>
  );
}

export default function LostFoundPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/lost-found");
  const [tab, setTab] = useState<"found" | "lost">("found");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [claimNames, setClaimNames] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const submit = async (mode: "lost" | "found") => {
    if (title.trim().length < 2) { toast.error(t("lostFound.f.title")); return; }
    setBusy(true);
    try {
      const res = await apiPost<{ possibleMatches: number }>("/api/lost-found", {
        mode, title, description: desc || undefined, location: location || undefined, contact: contact || undefined,
      });
      setTitle(""); setDesc(""); setLocation(""); setContact("");
      toast.success(mode === "lost" ? t("lostFound.reportedToast") : t("lostFound.registeredToast"));
      if (res.possibleMatches > 0) toast.info(t("lostFound.matchHint"), { icon: <BellRing className="w-4 h-4" /> });
      setTab(mode);
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const onClaim = async (r: Row) => {
    const name = (claimNames[r.id] ?? "").trim();
    if (!name) { toast.error(t("lostFound.claimedToPh")); return; }
    try { await apiPatch("/api/lost-found", { id: r.id, action: "claim", claimedByName: name }); toast.success(t("lostFound.doneToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const onDispose = async (id: string) => {
    try { await apiPatch("/api/lost-found", { id, action: "dispose" }); toast.success(t("lostFound.doneToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const openFound = data.found.filter((r) => r.status === "FOUND");
  const openLost = data.lost.filter((r) => r.status === "SEARCHING");
  const history = [...data.found, ...data.lost].filter((r) => r.status === "CLAIMED" || r.status === "DISPOSED");
  const list = tab === "found" ? openFound : openLost;

  const cardProps = { isStaff: data.isStaff, t, onClaim, onDispose, claimNames, setClaimNames };

  return (
    <div className="space-y-6">
      <PageHeader title={t("lostFound.title")} desc={t("lostFound.desc")} />

      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><PackageSearch className="w-5 h-5" /> {t("lostFound.reportTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("lostFound.f.title")} />
          <input className="b-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tab === "found" ? t("lostFound.f.whereFound") : t("lostFound.f.whereLost")} />
          <input className="b-input w-full" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("lostFound.f.desc")} />
          <input className="b-input w-full" dir="ltr" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("lostFound.f.contact")} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={() => submit("lost")}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageSearch className="w-4 h-4" />} {t("lostFound.reportBtn")}
          </button>
          {data.isStaff && (
            <button className="b-btn b-btn-ghost min-h-11" disabled={busy} onClick={() => submit("found")}>
              {t("lostFound.registerBtn")}
            </button>
          )}
        </div>
      </section>

      <div className="flex rounded-full border border-border overflow-hidden w-fit" role="tablist" aria-label={t("lostFound.title")}>
        {(["found", "lost"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`px-4 min-h-11 text-sm ${tab === x ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setTab(x)}>
            {x === "found" ? `${t("lostFound.foundTab")} (${faNumber(openFound.length)})` : `${t("lostFound.lostTab")} (${faNumber(openLost.length)})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={tab === "found" ? t("lostFound.emptyFound") : t("lostFound.emptyLost")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {list.map((r) => <ItemCard key={r.id} r={r} {...cardProps} />)}
        </section>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <button className="b-btn b-btn-ghost min-h-11" onClick={() => setShowHistory((s) => !s)}>
            <Archive className="w-4 h-4" /> {t("lostFound.historyTitle")} ({faNumber(history.length)})
          </button>
          {showHistory && (
            <section className="grid gap-3 md:grid-cols-2">
              {history.map((r) => <ItemCard key={r.id} r={r} {...cardProps} />)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
