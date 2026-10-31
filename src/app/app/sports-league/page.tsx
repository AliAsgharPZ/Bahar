"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trophy, Loader2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Standing = { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };
type Match = { id: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null; date: string };
type Data = { isStaff: boolean; teams: { id: string; name: string }[]; matches: Match[]; standings: Standing[] };

export default function SportsLeaguePage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/sports-league");
  const [teamName, setTeamName] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [date, setDate] = useState("");
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const act = async (payload: Record<string, unknown>, msg?: string) => {
    try { await apiPost("/api/sports-league", payload); if (msg) toast.success(msg); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const addTeam = async () => {
    if (!teamName.trim()) { toast.error(t("league.f.team")); return; }
    setBusy(true);
    try { await apiPost("/api/sports-league", { action: "team", name: teamName }); setTeamName(""); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const teamOpts = data.teams.map((x) => <option key={x.id} value={x.name}>{x.name}</option>);

  return (
    <div className="space-y-6">
      <PageHeader title={t("league.title")} desc={t("league.desc")} />
      <section className="b-card p-4 space-y-2">
        <h2 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5" /> {t("league.standings")}</h2>
        {data.standings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("league.noTeams")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-start">
                  <th className="py-1 text-start">{t("league.team")}</th>
                  <th>{t("league.played")}</th><th>{t("league.won")}</th><th>{t("league.drawn")}</th><th>{t("league.lost")}</th>
                  <th>{t("league.gf")}</th><th>{t("league.ga")}</th><th>{t("league.points")}</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.map((s, i) => (
                  <tr key={s.team} className="border-t border-border">
                    <td className="py-2 font-bold">{faNumber(i + 1)}. {s.team}</td>
                    <td className="text-center">{faNumber(s.played)}</td>
                    <td className="text-center">{faNumber(s.won)}</td>
                    <td className="text-center">{faNumber(s.drawn)}</td>
                    <td className="text-center">{faNumber(s.lost)}</td>
                    <td className="text-center">{faNumber(s.gf)}</td>
                    <td className="text-center">{faNumber(s.ga)}</td>
                    <td className="text-center font-bold">{faNumber(s.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold">{t("league.manage")}</h2>
          <div className="flex flex-wrap gap-2">
            <input className="b-input flex-1 min-w-44" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t("league.f.team")} />
            <button className="b-btn b-btn-ghost min-h-11" disabled={busy} onClick={addTeam}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{t("league.addTeam")}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="b-input flex-1 min-w-36" value={home} onChange={(e) => setHome(e.target.value)} aria-label={t("league.home")}>
              <option value="">{t("league.home")}</option>{teamOpts}
            </select>
            <select className="b-input flex-1 min-w-36" value={away} onChange={(e) => setAway(e.target.value)} aria-label={t("league.away")}>
              <option value="">{t("league.away")}</option>{teamOpts}
            </select>
            <input className="b-input w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1404-08-15" aria-label={t("league.date")} />
            <button className="b-btn b-btn-primary min-h-11" onClick={() => act({ action: "match", homeTeam: home, awayTeam: away, date }, t("league.matchAdded"))}>{t("league.addMatch")}</button>
          </div>
        </section>
      )}
      {data.matches.length === 0 ? (
        <EmptyState title={t("league.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.matches.map((m) => (
            <div key={m.id} className="p-4 flex flex-wrap items-center gap-2">
              <p className="flex-1 min-w-52 font-bold">
                {m.homeTeam} {m.homeScore !== null ? `${faNumber(m.homeScore)} — ${faNumber(m.awayScore ?? 0)}` : "×"} {m.awayTeam}
              </p>
              <span className="text-sm text-muted-foreground">{faNumber(m.date)}</span>
              {data.isStaff && m.homeScore === null && (
                <span className="flex gap-1 items-center">
                  <input className="b-input w-16 min-h-11" inputMode="numeric" value={scores[m.id]?.h ?? ""} onChange={(e) => setScores((s) => ({ ...s, [m.id]: { h: e.target.value, a: s[m.id]?.a ?? "" } }))} aria-label={t("league.homeScore")} />
                  <input className="b-input w-16 min-h-11" inputMode="numeric" value={scores[m.id]?.a ?? ""} onChange={(e) => setScores((s) => ({ ...s, [m.id]: { h: s[m.id]?.h ?? "", a: e.target.value } }))} aria-label={t("league.awayScore")} />
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => act({ action: "result", matchId: m.id, homeScore: Number(scores[m.id]?.h ?? 0), awayScore: Number(scores[m.id]?.a ?? 0) }, t("league.resultSaved"))}>{t("league.saveResult")}</button>
                </span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
