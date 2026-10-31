"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PhoneCall, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; contactName: string; direction: string; summary: string; followUp: string | null; date: string; staffName: string; mine: boolean };
type Data = { items: Row[] };

export default function CallLogPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/call-log");
  const [contact, setContact] = useState("");
  const [direction, setDirection] = useState("OUT");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!contact.trim() || !summary.trim()) { toast.error(t("calls.f.contact")); return; }
    setBusy(true);
    try { await apiPost("/api/call-log", { contactName: contact, direction, summary, followUp: followUp || undefined }); setContact(""); setSummary(""); setFollowUp(""); toast.success(t("calls.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/call-log?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("calls.title")} desc={t("calls.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><PhoneCall className="w-5 h-5" /> {t("calls.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t("calls.f.contact")} />
          <select className="b-input w-full" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label={t("calls.f.direction")}>
            <option value="OUT">{t("calls.dir.OUT")}</option>
            <option value="IN">{t("calls.dir.IN")}</option>
          </select>
        </div>
        <textarea className="b-input w-full min-h-20" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("calls.f.summary")} />
        <input className="b-input w-full" value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder={t("calls.f.followUp")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />} {t("calls.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("calls.empty")} />
      ) : (
        <section className="space-y-3">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.contactName}</p>
                <span className="px-2 py-0.5 rounded-full text-xs bg-info/15 text-info">{t(`calls.dir.${r.direction}`)}</span>
                <span className="text-sm text-muted-foreground">{faNumber(r.date)}</span>
                {r.mine && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("calls.delete")}><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-sm">{r.summary}</p>
              <p className="text-sm text-muted-foreground">{t("calls.by")} {r.staffName}{r.followUp ? ` · ${t("calls.followUp")}: ${r.followUp}` : ""}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
