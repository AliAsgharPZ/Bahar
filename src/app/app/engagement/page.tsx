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

type Poll = { id: string; question: string; description: string | null; audience: string; active: boolean; totalVotes: number; myVotes: string[]; options: Array<{ id: string; text: string; votes: number }> };
type Suggestion = { id: string; authorName: string | null; body: string; category: string; status: string; adminNote: string | null; createdAt: string };
type HouseRow = { id: string; name: string; color: string; motto: string | null; members: number; behaviorPoints: number; badgePoints: number; total: number; topMembers: Array<{ id: string; name: string; points: number }> };

const AUDIENCE: Record<string, string> = { ALL: "همه", STUDENTS: "دانش‌آموزان", PARENTS: "والدین", TEACHERS: "معلمان", STAFF: "کارکنان" };
const SUG_CAT: Record<string, string> = { FACILITIES: "امکانات", EDUCATION: "آموزش", FOOD: "سلف و غذا", SERVICE: "خدمات", OTHER: "سایر" };
const SUG_STATUS: Record<string, string> = { NEW: "جدید", REVIEWING: "در بررسی", ACCEPTED: "پذیرفته‌شده", REJECTED: "رد‌شده" };

function EngagementInner() {
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
      }).catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در دریافت داده‌ها")).finally(() => setLoading(false));
  }, [tab]);
  useEffect(load, [load]);

  async function createPoll() {
    const options = pollForm.options.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!pollForm.question.trim() || options.length < 2) { toast.error("سؤال و حداقل ۲ گزینه (هر خط یک گزینه) لازم است"); return; }
    try {
      await apiPost("/api/engagement", { action: "create-poll", ...pollForm, options });
      toast.success("نظرسنجی ساخته شد");
      setPollForm({ question: "", options: "", audience: "ALL" }); setShowNewPoll(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function vote(pollId: string, optionId: string) {
    try { await apiPost("/api/engagement", { action: "vote", pollId, optionIds: [optionId] }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function togglePoll(pollId: string, active: boolean) {
    try {
      await apiPost("/api/engagement", { action: "close-poll", id: pollId, active });
      toast.success(active ? "نظرسنجی بازگشایی شد" : "نظرسنجی بسته شد");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function suggest() {
    if (sugBody.trim().length < 10) { toast.error("متن پیشنهاد حداقل ۱۰ نویسه"); return; }
    try {
      await apiPost("/api/engagement", { action: "suggest", body: sugBody, category: sugCat, anonymous: sugAnon });
      toast.success("پیشنهاد شما ثبت شد — سپاس!");
      setSugBody(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function review(id: string, status: string) {
    // FIX (راند ۱۶): یادداشت مدیر هنگام پذیرش/رد — دکمه‌ها برای وضعیت «در بررسی» هم فعال‌اند
    const note = status === "ACCEPTED" || status === "REJECTED"
      ? (prompt("یادداشت پاسخ مدیریت (اختیاری — برای اولیا نمایش داده می‌شود):") ?? "").trim().slice(0, 300)
      : "";
    try { await apiPost("/api/engagement", { action: "review-suggestion", id, status, adminNote: note || undefined }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  // ---------- خونه‌ها ----------
  const [housesError, setHousesError] = useState("");
  const loadHouses = useCallback(() => {
    apiGet<{ houses: HouseRow[] }>("/api/houses").then((d) => { setHousesError(""); setHouses(d.houses); }).catch((e) => setHousesError(e instanceof Error ? e.message : "خطا در بارگذاری خونه‌ها")).finally(() => setHousesLoaded(true));
  }, []);
  useEffect(() => { if (tab === "houses") loadHouses(); }, [tab, loadHouses]);

  async function createHouse() {
    if (houseForm.name.trim().length < 2) { toast.error("نام خونه حداقل ۲ نویسه"); return; }
    try {
      await apiPost("/api/houses", houseForm);
      toast.success("خونه تعریف شد");
      setHouseForm({ name: "", color: "#00825e", motto: "" }); setShowNewHouse(false); loadHouses();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function deleteHouse(id: string) {
    try { await apiDelete(`/api/houses?id=${id}`); toast.success("خونه حذف شد"); loadHouses(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader title="نظرسنجی و پیشنهادها" desc="صدای مدرسه — رأی بدهید و پیشنهاد بدهید" />
      <div className="flex gap-1.5 mb-6 flex-wrap">
        <button onClick={() => setTab("polls")} className={`b-pill-tab ${tab === "polls" ? "b-pill-tab-active" : ""}`}><Vote className="w-3.5 h-3.5" /> نظرسنجی‌ها</button>
        <button onClick={() => setTab("suggestions")} className={`b-pill-tab ${tab === "suggestions" ? "b-pill-tab-active" : ""}`}><Lightbulb className="w-3.5 h-3.5" /> صندوق پیشنهاد</button>
        <button onClick={() => setTab("houses")} className={`b-pill-tab ${tab === "houses" ? "b-pill-tab-active" : ""}`}><Home className="w-3.5 h-3.5" /> جدول خونه‌ها</button>
      </div>

      {tab === "polls" && (
        <div className="flex flex-col gap-5">
          {canManage && (
            <button onClick={() => setShowNewPoll((v) => !v)} className="b-btn b-btn-sm b-btn-spring w-fit"><Plus className="w-4 h-4" /> نظرسنجی جدید</button>
          )}
          {showNewPoll && (
            <div className="b-card-md p-5 flex flex-col gap-3">
              <input value={pollForm.question} onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })} placeholder="سؤال نظرسنجی *" className="b-input" />
              <textarea value={pollForm.options} onChange={(e) => setPollForm({ ...pollForm, options: e.target.value })} placeholder="گزینه‌ها — هر خط یک گزینه" className="b-input !min-h-[80px]" />
              <div className="flex gap-2 items-center">
                <Select
                  value={pollForm.audience}
                  onChange={(v) => setPollForm({ ...pollForm, audience: v })}
                  options={Object.entries(AUDIENCE).map(([k, v]) => ({ value: k, label: v }))}
                  className="!w-40"
                  buttonClassName="!w-40"
                />
                <button onClick={createPoll} className="b-btn b-btn-sm b-btn-spring">ایجاد</button>
              </div>
            </div>
          )}
          {polls.length === 0 ? <EmptyState icon={Vote} title="نظرسنجی فعالی نیست" /> : polls.map((p, i) => {
            const voted = p.myVotes.length > 0;
            const closed = !p.active;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`b-card-md p-5 ${closed ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-bold text-[15px]">{p.question}</h3>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {closed && <span className="b-badge b-badge-neutral">بسته‌شده</span>}
                    {canManage && (
                      <button onClick={() => togglePoll(p.id, closed)} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0" title={closed ? "بازگشایی نظرسنجی" : "بستن نظرسنجی"}>
                        {closed ? "بازگشایی" : "بستن"}
                      </button>
                    )}
                    <span className="b-badge b-badge-neutral">{AUDIENCE[p.audience]}</span>
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
                          <span className="text-[11px] text-steel">{faNumber(pct)}٪ ({faNumber(o.votes)})</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10.5px] text-stone mt-2.5">{faNumber(p.totalVotes)} رأی{voted ? " · رأی شما ثبت شد" : closed ? " · بسته‌شده" : ""}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {tab === "houses" && (
        <div className="flex flex-col gap-5">
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => setShowNewHouse((v) => !v)} className="b-btn b-btn-sm b-btn-spring w-fit"><Plus className="w-4 h-4" /> خونه جدید</button>
            </div>
          )}
          {showNewHouse && canManage && (
            <div className="b-card-md p-5 flex flex-wrap gap-2.5 items-end">
              <input value={houseForm.name} onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })} placeholder="نام خونه (مثلاً خونه آسمان)" className="b-input !w-56" maxLength={30} />
              <input type="color" value={houseForm.color} onChange={(e) => setHouseForm({ ...houseForm, color: e.target.value })} className="b-input !w-14 !h-[44px] !p-1 cursor-pointer" title="رنگ خونه" />
              <input value={houseForm.motto} onChange={(e) => setHouseForm({ ...houseForm, motto: e.target.value })} placeholder="شعار (اختیاری)" className="b-input !w-64" maxLength={80} />
              <button onClick={createHouse} className="b-btn b-btn-sm b-btn-spring">ایجاد</button>
            </div>
          )}
          {housesError ? <ErrorBox message={housesError} /> : !housesLoaded ? <LoadingBlock /> : houses.length === 0 ? (
            <EmptyState icon={Home} title="هنوز خونه‌ای تعریف نشده" desc={canManage ? "خونه‌ها را تعریف کنید و از صفحه دانش‌آموزان به آن‌ها واگذاری گروهی انجام دهید." : "امتیاز خونه‌ها به‌زودی از سوی مدیریت مدرسه فعال می‌شود."} />
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
                      <b className="text-[15px] flex items-center gap-1.5 truncate">{h.name} {i === 0 && <Crown className="w-4 h-4 text-[#C9971C] shrink-0" />}</b>
                      <span className="text-[11px] text-steel block">{faNumber(h.members)} عضو{h.motto ? ` · ${h.motto}` : ""}</span>
                    </div>
                    <b className="text-[22px] font-extrabold" style={{ color: h.color }}>{faNumber(h.total)}</b>
                    {canManage && (
                      <button onClick={() => deleteHouse(h.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-stone hover:text-blossom hover:bg-blossom/10 transition-colors shrink-0" title="حذف خونه">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-steel">
                    <span>رفتار: <b className="text-ink">{faNumber(h.behaviorPoints)}</b></span>
                    <span>نشان‌ها: <b className="text-ink">{faNumber(h.badgePoints)}</b></span>
                  </div>
                  {h.topMembers.length > 0 && (
                    <div className="border-t border-hairline-soft pt-3 flex flex-col gap-1.5">
                      <span className="text-[10.5px] text-stone">امتیازآورترین‌ها:</span>
                      {h.topMembers.map((m, j) => (
                        <span key={m.id} className="text-[12px] flex items-center gap-2">
                          <span className="text-[10px] text-stone w-3">{faNumber(j + 1)}</span>
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
          <p className="text-[11px] text-stone leading-relaxed">
            امتیاز هر خونه = مجموع امتیازهای رفتاری (مثبت/منفی) + امتیاز نشان‌های اعضای فعال آن؛ با ثبت رفتار و اعطای نشان به‌روزرسانی می‌شود.
          </p>
        </div>
      )}

      {tab === "suggestions" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="b-card-md p-5 sticky top-4">
              <h3 className="font-bold mb-3">پیشنهاد خود را بفرستید</h3>
              <textarea value={sugBody} onChange={(e) => setSugBody(e.target.value)} placeholder="مدرسه چه چیزی را باید بهتر کند؟" className="b-input !min-h-[110px]" />
              <div className="flex gap-2 mt-2.5">
                <Select
                  value={sugCat}
                  onChange={(v) => setSugCat(v)}
                  options={Object.entries(SUG_CAT).map(([k, v]) => ({ value: k, label: v }))}
                  className="!w-36"
                  buttonClassName="!w-36"
                />
                <button onClick={() => setSugAnon((v) => !v)} className={`b-pill-tab !text-[11px] ${sugAnon ? "b-pill-tab-active" : ""}`}>{sugAnon ? "ناشناس" : "با نام"}</button>
              </div>
              <button onClick={suggest} className="b-btn b-btn-spring w-full mt-3">ارسال پیشنهاد</button>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            {suggestions.length === 0 ? <EmptyState icon={Lightbulb} title="پیشنهادی ثبت نشده" desc="اولین نفر باشید!" /> : suggestions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="b-card-sm p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="b-badge b-badge-neutral">{SUG_CAT[s.category]}</span>
                  <span className={`b-badge ${s.status === "ACCEPTED" ? "b-badge-success" : s.status === "REJECTED" ? "b-badge-critical" : s.status === "REVIEWING" ? "b-badge-warning" : "b-badge-neutral"}`}>{SUG_STATUS[s.status]}</span>
                  <span className="text-[11px] text-stone ms-auto">{s.authorName ?? "ناشناس"} · {formatDateFa(s.createdAt)}</span>
                </div>
                <p className="text-[13px] leading-relaxed">{s.body}</p>
                {s.adminNote && <p className="text-[11.5px] text-spring-deep mt-2">پاسخ مدیریت: {s.adminNote}</p>}
                {canManage && (s.status === "NEW" || s.status === "REVIEWING") && (
                  <div className="flex gap-1.5 mt-2.5">
                    {s.status === "NEW" && <button onClick={() => review(s.id, "REVIEWING")} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0">در بررسی</button>}
                    <button onClick={() => review(s.id, "ACCEPTED")} className="b-btn b-btn-sm b-btn-spring !min-h-[26px] !text-[10px] !px-2 !py-0">پذیرفتن</button>
                    <button onClick={() => review(s.id, "REJECTED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0 !text-destructive">رد</button>
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
