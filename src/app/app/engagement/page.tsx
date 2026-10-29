"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Vote, Lightbulb, Plus, CheckCircle2, Home, Trophy, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Poll = { id: string; question: string; description: string | null; audience: string; active: boolean; totalVotes: number; myVotes: string[]; options: Array<{ id: string; text: string; votes: number }> };
type Suggestion = { id: string; authorName: string | null; body: string; category: string; status: string; adminNote: string | null; createdAt: string };
type HouseRow = { id: string; name: string; color: string; motto: string | null; members: number; behaviorPoints: number; badgePoints: number; total: number; topMembers: Array<{ id: string; name: string; points: number }> };

const AUDIENCE_TKEY: Record<string, string> = { ALL: "enum.audience.ALL", STUDENTS: "enum.audience.STUDENTS", PARENTS: "enum.audience.PARENTS", TEACHERS: "enum.audience.TEACHERS", STAFF: "engagement.audience.staff" };
const SUG_CAT_TKEY: Record<string, string> = { FACILITIES: "engagement.suggestion.category.facilities", EDUCATION: "nav.group.education", FOOD: "engagement.suggestion.category.food", SERVICE: "engagement.suggestion.category.service", OTHER: "engagement.suggestion.category.other" };
const SUG_STATUS_TKEY: Record<string, string> = { NEW: "engagement.suggestion.status.new", REVIEWING: "engagement.suggestion.status.reviewing", ACCEPTED: "engagement.suggestion.status.accepted", REJECTED: "engagement.suggestion.status.rejected" };

function EngagementInner() {
  const { t } = useLang();
  const sp = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") ?? "polls");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNewPoll, setShowNewPoll] = useState(false);
  const [pollForm, setPollForm] = useState({ question: "", options: "", audience: "ALL" });
  const [sugBody, setSugBody] = useState("");
  const [sugCat, setSugCat] = useState("OTHER");
  const [sugAnon, setSugAnon] = useState(true);

  // خونه‌ها
  const [houses, setHouses] = useState<HouseRow[]>([]);
  const [housesLoaded, setHousesLoaded] = useState(false);
  const [houseForm, setHouseForm] = useState({ name: "", color: "#00825e", motto: "" });
  const [showNewHouse, setShowNewHouse] = useState(false);

  const load = useCallback(() => {
    apiGet<{ polls?: Poll[]; suggestions?: Suggestion[]; canManage: boolean }>(`/api/engagement?tab=${tab}`)
      .then((d) => {
        if (d.polls) setPolls(d.polls);
        if (d.suggestions) setSuggestions(d.suggestions);
        setCanManage(d.canManage);
      }).catch((e) => setLoadError(e instanceof Error ? e.message : t("engagement.error.load"))).finally(() => setLoading(false));
  }, [tab]);
  useEffect(load, [load]);

  async function createPoll() {
    const options = pollForm.options.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!pollForm.question.trim() || options.length < 2) { toast.error(t("engagement.toast.questionRequired")); return; }
    try {
      await apiPost("/api/engagement", { action: "create-poll", ...pollForm, options });
      toast.success(t("engagement.toast.pollCreated"));
      setPollForm({ question: "", options: "", audience: "ALL" }); setShowNewPoll(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function vote(pollId: string, optionId: string) {
    try { await apiPost("/api/engagement", { action: "vote", pollId, optionIds: [optionId] }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function togglePoll(pollId: string, active: boolean) {
    try {
      await apiPost("/api/engagement", { action: "close-poll", id: pollId, active });
      toast.success(active ? t("engagement.toast.pollReopened") : t("engagement.toast.pollClosed"));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function suggest() {
    if (sugBody.trim().length < 10) { toast.error(t("engagement.toast.suggestionTooShort")); return; }
    try {
      await apiPost("/api/engagement", { action: "suggest", body: sugBody, category: sugCat, anonymous: sugAnon });
      toast.success(t("engagement.toast.suggestionSent"));
      setSugBody(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function review(id: string, status: string) {
    // FIX (راند ۱۶): یادداشت مدیر هنگام پذیرش/رد — دکمه‌ها برای وضعیت «در بررسی» هم فعال‌اند
    const note = status === "ACCEPTED" || status === "REJECTED"
      ? (prompt(t("engagement.prompt.adminNote")) ?? "").trim().slice(0, 300)
      : "";
    try { await apiPost("/api/engagement", { action: "review-suggestion", id, status, adminNote: note || undefined }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  // ---------- خونه‌ها ----------
  const [housesError, setHousesError] = useState("");
  const loadHouses = useCallback(() => {
    apiGet<{ houses: HouseRow[] }>("/api/houses").then((d) => { setHousesError(""); setHouses(d.houses); }).catch((e) => setHousesError(e instanceof Error ? e.message : t("engagement.error.houses"))).finally(() => setHousesLoaded(true));
  }, []);
  useEffect(() => { if (tab === "houses") loadHouses(); }, [tab, loadHouses]);

  async function createHouse() {
    if (houseForm.name.trim().length < 2) { toast.error(t("engagement.toast.houseNameShort")); return; }
    try {
      await apiPost("/api/houses", houseForm);
      toast.success(t("engagement.toast.houseCreated"));
      setHouseForm({ name: "", color: "#00825e", motto: "" }); setShowNewHouse(false); loadHouses();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function deleteHouse(id: string) {
    try { await apiDelete(`/api/houses?id=${id}`); toast.success(t("engagement.toast.houseDeleted")); loadHouses(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader title={t("engagement.title")} desc={t("engagement.desc")} />
      <div className="flex gap-1.5 mb-6 flex-wrap">
        <button onClick={() => setTab("polls")} className={`b-pill-tab ${tab === "polls" ? "b-pill-tab-active" : ""}`}><Vote className="w-3.5 h-3.5" /> {t("engagement.tab.polls")}</button>
        <button onClick={() => setTab("suggestions")} className={`b-pill-tab ${tab === "suggestions" ? "b-pill-tab-active" : ""}`}><Lightbulb className="w-3.5 h-3.5" /> {t("engagement.tab.suggestions")}</button>
        <button onClick={() => setTab("houses")} className={`b-pill-tab ${tab === "houses" ? "b-pill-tab-active" : ""}`}><Home className="w-3.5 h-3.5" /> {t("engagement.tab.houses")}</button>
      </div>

      {tab === "polls" && (
        <div className="flex flex-col gap-5">
          {canManage && (
            <button onClick={() => setShowNewPoll((v) => !v)} className="b-btn b-btn-sm b-btn-spring w-fit"><Plus className="w-4 h-4" /> {t("engagement.newPoll")}</button>
          )}
          {showNewPoll && (
            <div className="b-card-md p-5 flex flex-col gap-3">
              <input value={pollForm.question} onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })} placeholder={t("engagement.field.question")} className="b-input" />
              <textarea value={pollForm.options} onChange={(e) => setPollForm({ ...pollForm, options: e.target.value })} placeholder={t("engagement.field.options")} className="b-input !min-h-[80px]" />
              <div className="flex gap-2 items-center">
                <Select
                  value={pollForm.audience}
                  onChange={(v) => setPollForm({ ...pollForm, audience: v })}
                  options={Object.entries(AUDIENCE_TKEY).map(([k, key]) => ({ value: k, label: t(key) }))}
                  className="!w-40"
                  buttonClassName="!w-40"
                />
                <button onClick={createPoll} className="b-btn b-btn-sm b-btn-spring">{t("common.create")}</button>
              </div>
            </div>
          )}
          {polls.length === 0 ? <EmptyState icon={Vote} title={t("engagement.empty.polls")} /> : polls.map((p, i) => {
            const voted = p.myVotes.length > 0;
            const closed = !p.active;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`b-card-md p-5 ${closed ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-bold text-[15px]">{p.question}</h3>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {closed && <span className="b-badge b-badge-neutral">{t("engagement.closed")}</span>}
                    {canManage && (
                      <button onClick={() => togglePoll(p.id, closed)} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0" title={closed ? t("engagement.reopenPoll") : t("engagement.closePoll")}>
                        {closed ? t("engagement.reopen") : t("common.close")}
                      </button>
                    )}
                    <span className="b-badge b-badge-neutral">{AUDIENCE_TKEY[p.audience] ? t(AUDIENCE_TKEY[p.audience]) : p.audience}</span>
                  </span>
                </div>
                {p.description && <p className="text-[12px] text-steel mb-3">{p.description}</p>}
                <div className="flex flex-col gap-2">
                  {p.options.map((o) => {
                    const pct = p.totalVotes > 0 ? Math.round((o.votes / p.totalVotes) * 100) : 0;
                    const my = p.myVotes.includes(o.id);
                    return (
                      <button key={o.id} disabled={voted || closed} onClick={() => vote(p.id, o.id)}
                        className={`b-btn b-btn-ghost relative text-start p-3 rounded-2xl border transition-all overflow-hidden ${my ? "border-spring bg-spring-tint/50" : voted || closed ? "border-transparent bg-cloud" : "border-transparent bg-cloud hover:border-spring/40"}`}>
                        <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                          className={`absolute inset-y-0 start-0 ${my ? "bg-spring/20" : "bg-spring-tint"}`} />
                        <span className="relative flex items-center gap-2">
                          <span className="text-[13px] font-bold flex-1">{o.text}{my && <CheckCircle2 className="w-4 h-4 inline text-spring ms-1.5" />}</span>
                          <span className="text-[12px] text-steel">{faNumber(pct)}٪ ({faNumber(o.votes)})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px] text-stone mt-2.5">{faNumber(p.totalVotes)} {t("engagement.votes")}{voted ? ` · ${t("engagement.yourVoteRecorded")}` : closed ? ` · ${t("engagement.closed")}` : ""}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === "houses" && (
        <div className="flex flex-col gap-5">
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => setShowNewHouse((v) => !v)} className="b-btn b-btn-sm b-btn-spring w-fit"><Plus className="w-4 h-4" /> {t("engagement.newHouse")}</button>
            </div>
          )}
          {showNewHouse && canManage && (
            <div className="b-card-md p-5 flex flex-wrap gap-2.5 items-end">
              <input value={houseForm.name} onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })} placeholder={t("engagement.field.houseName")} className="b-input !w-56" maxLength={30} />
              <input type="color" value={houseForm.color} onChange={(e) => setHouseForm({ ...houseForm, color: e.target.value })} className="b-input !w-14 !h-[44px] !p-1 cursor-pointer" title={t("engagement.field.houseColor")} />
              <input value={houseForm.motto} onChange={(e) => setHouseForm({ ...houseForm, motto: e.target.value })} placeholder={t("engagement.field.motto")} className="b-input !w-64" maxLength={80} />
              <button onClick={createHouse} className="b-btn b-btn-sm b-btn-spring">{t("common.create")}</button>
            </div>
          )}
          {housesError ? <ErrorBox message={housesError} /> : !housesLoaded ? <LoadingBlock /> : houses.length === 0 ? (
            <EmptyState icon={Home} title={t("engagement.empty.houses")} desc={canManage ? t("engagement.empty.housesManage") : t("engagement.empty.housesSoon")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {houses.map((h, i) => (
                <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={`b-card-md p-5 flex flex-col gap-3 ${i === 0 ? "ring-2" : ""}`}
                  style={i === 0 ? { boxShadow: `0 0 0 2px ${h.color}55` } : undefined}>
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-[15px] shrink-0" style={{ background: h.color }}>
                      {i === 0 ? <Trophy className="w-5 h-5" /> : faNumber(i + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <b className="text-[15px] flex items-center gap-1.5 truncate">{h.name} {i === 0 && <Crown className="w-4 h-4 text-[#f2a918] shrink-0" />}</b>
                      <span className="text-[12px] text-steel block">{faNumber(h.members)} {t("engagement.member")}{h.motto ? ` · ${h.motto}` : ""}</span>
                    </div>
                    <b className="text-[22px] font-extrabold" style={{ color: h.color }}>{faNumber(h.total)}</b>
                    {canManage && (
                      <button onClick={() => deleteHouse(h.id)} className="w-10 h-10 rounded-full flex items-center justify-center text-stone hover:text-blossom hover:bg-blossom/10 transition-colors shrink-0" title={t("engagement.deleteHouse")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-steel">
                    <span>{t("dashboard.mini.behavior")}: <b className="text-ink">{faNumber(h.behaviorPoints)}</b></span>
                    <span>{t("engagement.badges")}: <b className="text-ink">{faNumber(h.badgePoints)}</b></span>
                  </div>
                  {h.topMembers.length > 0 && (
                    <div className="border-t border-hairline-soft pt-3 flex flex-col gap-1.5">
                      <span className="text-[12px] text-stone">{t("engagement.topScorers")}</span>
                      {h.topMembers.map((m, j) => (
                        <span key={m.id} className="text-[12px] flex items-center gap-2">
                          <span className="text-[12px] text-stone w-3">{faNumber(j + 1)}</span>
                          <span className="flex-1 truncate">{m.name}</span>
                          <b style={{ color: h.color }}>{faNumber(m.points)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
          <p className="text-[12px] text-stone leading-relaxed">
            {t("engagement.housesFootnote")}
          </p>
        </div>
      )}

      {tab === "suggestions" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="b-card-md p-5 sticky top-4">
              <h3 className="font-bold mb-3">{t("engagement.sendSuggestionTitle")}</h3>
              <textarea value={sugBody} onChange={(e) => setSugBody(e.target.value)} placeholder={t("engagement.placeholder.suggestion")} className="b-input !min-h-[110px]" />
              <div className="flex gap-2 mt-2.5">
                <Select
                  value={sugCat}
                  onChange={(v) => setSugCat(v)}
                  options={Object.entries(SUG_CAT_TKEY).map(([k, key]) => ({ value: k, label: t(key) }))}
                  className="!w-36"
                  buttonClassName="!w-36"
                />
                <button onClick={() => setSugAnon((v) => !v)} className={`b-pill-tab !text-[12px] ${sugAnon ? "b-pill-tab-active" : ""}`}>{sugAnon ? t("engagement.anonymous") : t("engagement.named")}</button>
              </div>
              <button onClick={suggest} className="b-btn b-btn-spring w-full mt-3">{t("engagement.sendSuggestion")}</button>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            {suggestions.length === 0 ? <EmptyState icon={Lightbulb} title={t("engagement.empty.suggestions")} desc={t("engagement.beFirst")} /> : suggestions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="b-card-sm p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="b-badge b-badge-neutral">{SUG_CAT_TKEY[s.category] ? t(SUG_CAT_TKEY[s.category]) : s.category}</span>
                  <span className={`b-badge ${s.status === "ACCEPTED" ? "b-badge-success" : s.status === "REJECTED" ? "b-badge-critical" : s.status === "REVIEWING" ? "b-badge-warning" : "b-badge-neutral"}`}>{SUG_STATUS_TKEY[s.status] ? t(SUG_STATUS_TKEY[s.status]) : s.status}</span>
                  <span className="text-[12px] text-stone ms-auto">{s.authorName ?? t("engagement.anonymous")} · {formatDateFa(s.createdAt)}</span>
                </div>
                <p className="text-[13px] leading-relaxed">{s.body}</p>
                {s.adminNote && <p className="text-[11.5px] text-spring-deep mt-2">{t("engagement.adminReply")}: {s.adminNote}</p>}
                {canManage && (s.status === "NEW" || s.status === "REVIEWING") && (
                  <div className="flex gap-1.5 mt-2.5">
                    {s.status === "NEW" && <button onClick={() => review(s.id, "REVIEWING")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0">{t("engagement.suggestion.status.reviewing")}</button>}
                    <button onClick={() => review(s.id, "ACCEPTED")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2 !py-0">{t("engagement.accept")}</button>
                    <button onClick={() => review(s.id, "REJECTED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0 !text-destructive">{t("engagement.reject")}</button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EngagementPage() {
  return <Suspense fallback={<LoadingBlock />}><EngagementInner /></Suspense>;
}
