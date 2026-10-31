"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HandHeart, Loader2, Trophy, Check } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Entry = { id: string; activity: string; hours: number; date: string; approved: boolean; name: string };
type Data = { isOffice: boolean; mine: Entry[]; pending: Entry[]; myApprovedHours: number; leaderboard: { userId: string; name: string; hours: number }[] };

export default function VolunteerPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/volunteer");
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("1");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!activity.trim()) { toast.error(t("volunteer.f.activity")); return; }
    setBusy(true);
    try { await apiPost("/api/volunteer", { activity, hours: Number(hours) || 1 }); setActivity(""); toast.success(t("volunteer.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const approve = async (id: string) => {
    try { await apiPatch("/api/volunteer", { id }); toast.success(t("volunteer.approvedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("volunteer.title")} desc={t("volunteer.desc")} />
      <section className="b-card p-4 space-y-2">
        <h2 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5" /> {t("volunteer.leaderboard")}</h2>
        <p className="text-sm">{t("volunteer.myHours")}: <b>{faNumber(data.myApprovedHours)}</b> {t("volunteer.hours")}</p>
        {data.leaderboard.length > 0 && (
          <ol className="space-y-1 text-sm">
            {data.leaderboard.map((l, i) => (
              <li key={l.userId} className="flex gap-2"><span className="w-7 font-bold">{faNumber(i + 1)}.</span><span className="flex-1">{l.name}</span><span>{faNumber(l.hours)} {t("volunteer.hours")}</span></li>
            ))}
          </ol>
        )}
      </section>
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><HandHeart className="w-5 h-5" /> {t("volunteer.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
          <input className="b-input w-full" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder={t("volunteer.f.activity")} />
          <input className="b-input w-full" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={t("volunteer.f.hours")} aria-label={t("volunteer.f.hours")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandHeart className="w-4 h-4" />} {t("volunteer.add")}
        </button>
      </section>
      {data.isOffice && data.pending.length > 0 && (
        <section className="b-card p-4 space-y-2">
          <h2 className="font-bold">{t("volunteer.pendingTitle")} ({faNumber(data.pending.length)})</h2>
          {data.pending.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2 py-1">
              <p className="flex-1 text-sm">{e.name} — {e.activity} · {faNumber(e.hours)} {t("volunteer.hours")}</p>
              <button className="b-btn b-btn-primary min-h-11" onClick={() => approve(e.id)}><Check className="w-4 h-4" /> {t("volunteer.approve")}</button>
            </div>
          ))}
        </section>
      )}
      {data.mine.length === 0 ? (
        <EmptyState title={t("volunteer.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.mine.map((e) => (
            <div key={e.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{e.activity}</p>
                <p className="text-sm text-muted-foreground">{faNumber(e.date)} · {faNumber(e.hours)} {t("volunteer.hours")}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${e.approved ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                {e.approved ? t("volunteer.approved") : t("volunteer.pending")}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
