"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartPulse, Frown, Meh, Smile, Laugh, Send, Loader2, AlertTriangle, Heart } from "lucide-react";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { useApi } from "@/lib/client";
import { apiGet, apiPost } from "@/lib/client";
import { toast } from "sonner";
import { faNumber, faDigits, formatDateFa } from "@/lib/persian";

// ============================================================
// بهار | چک‌این سلامت روان — راند ۱۶
// دانش‌آموز: حال روزانه (۱-۵) + یادداشت — روزی یک‌بار
// کارکنان (مدیر/معاون/معلم/سرویس): آمار مدرسه + موارد پرچم‌شده
// ============================================================

type Me = { user: { role: string } };

const MOODS = [
  { v: 1, icon: Frown, label: "خیلی بد", cls: "text-destructive", bg: "bg-destructive/10" },
  { v: 2, icon: Frown, label: "بد", cls: "text-warning-deep", bg: "bg-warning/10" },
  { v: 3, icon: Meh, label: "متوسط", cls: "text-steel", bg: "bg-cloud" },
  { v: 4, icon: Smile, label: "خوب", cls: "text-spring", bg: "bg-spring-tint" },
  { v: 5, icon: Laugh, label: "خیلی خوب", cls: "text-spring", bg: "bg-spring-tint" },
];

export default function WellbeingPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const isStudent = me?.user.role === "STUDENT";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سلامت روان"
        desc={isStudent ? "حال امروزت را ثبت کن — روزی یک‌بار، کمتر از یک دقیقه" : "چک‌این‌های روزانه دانش‌آموزان، موارد نیازمند توجه و روند مدرسه"}
      />
      {me && (isStudent ? <StudentCheckin /> : <StaffView />)}
      {!me && <LoadingBlock label="…" />}
    </div>
  );
}

/* ---------------- نمای دانش‌آموز ---------------- */

type StudentData = {
  today: string;
  todayCheckin: { mood: number; note: string | null; createdAt: string } | null;
  history: Array<{ date: string; mood: number; flagged: boolean }>;
};

function StudentCheckin() {
  const { data, loading, error, refetch } = useApi<StudentData>("/api/wellbeing");
  const [mood, setMood] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = useCallback(async () => {
    if (!mood) return;
    setSaving(true);
    try {
      await apiPost("/api/wellbeing", { mood, note: note.trim() || undefined });
      setDone(true);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  }, [mood, note, refetch]);

  if (loading && !data) return <LoadingBlock label="چک‌این امروز…" />;
  if (error) return <ErrorBox message={typeof error === "string" ? error : "بارگذاری ناموفق بود"} />;
  if (!data) return null;

  const already = data.todayCheckin || done;

  return (
    <>
      {already ? (
        <div className="b-card-sm p-6 text-center">
          <Heart className="w-10 h-10 text-spring mx-auto mb-3" />
          <b className="block text-[14px] mb-1">چک‌این امروز ثبت شد — ممنون که حالت را گفتی</b>
          <p className="text-[12px] text-steel">
            حال ثبت‌شده: {MOODS.find((m) => m.v === (data.todayCheckin?.mood ?? mood))?.label ?? "—"}
          </p>
          <p className="text-[11px] text-stone mt-2">فردا دوباره سر می‌زنیم. اگر خواستی با مشاور مدرسه حرف بزنی، از پیام‌ها در ارتباط باش.</p>
        </div>
      ) : (
        <div className="b-card-sm p-6">
          <b className="block text-[14px] mb-4 text-center">حالت الان چطوره؟</b>
          <div className="flex items-end justify-center gap-3 sm:gap-4">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = mood === m.v;
              return (
                <button
                  key={m.v}
                  onClick={() => setMood(m.v)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${active ? `${m.bg} scale-110 shadow-sm` : "hover:bg-cloud"}`}
                  aria-label={m.label}
                >
                  <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${active ? m.cls : "text-stone"}`} />
                  <span className={`text-[10.5px] font-bold ${active ? "text-ink" : "text-steel"}`}>{m.label}</span>
                </button>
              );
            })}
          </div>
          <label className="flex flex-col gap-1.5 mt-5">
            <span className="text-[12px] font-bold">یادداشت (اختیاری — فقط مشاور مدرسه می‌بیند)</span>
            <textarea
              className="b-input min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder="اگر دوست داری چیزی بنویسی…"
            />
            <span className="text-[10px] text-stone text-end">{faDigits(note.length)}/{faDigits(300)}</span>
          </label>
          <button className="b-btn b-btn-spring w-full mt-3" onClick={submit} disabled={!mood || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} ثبت چک‌این امروز
          </button>
        </div>
      )}

      {/* تاریخچه */}
      {data.history.length > 0 && (
        <div className="b-card-sm p-4">
          <b className="block text-[13px] mb-3">تاریخچه {faDigits(data.history.length)} روز اخیر</b>
          <div className="flex items-end gap-1.5 h-24 overflow-x-auto b-scroll pb-1">
            {[...data.history].reverse().map((h) => {
              const m = MOODS.find((x) => x.v === h.mood);
              const Icon = m?.icon ?? Meh;
              return (
                <div key={h.date} className="flex flex-col items-center gap-1 shrink-0" title={`${formatDateFa(h.date)} — ${m?.label ?? ""}`}>
                  <Icon className={`w-5 h-5 ${h.mood <= 2 ? "text-destructive" : h.mood >= 4 ? "text-spring" : "text-steel"}`} />
                  <span className="text-[9px] text-stone">{faDigits(h.date.split("-")[2])}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- نمای کارکنان ---------------- */

type StaffData = {
  days: number;
  totalCheckins: number;
  avgMood: number | null;
  flaggedCount: number;
  trend: Array<{ date: string; avg: number; n: number }>;
  flagged: Array<{ studentId: string; name: string; className: string; date: string; mood: number; note: string | null }>;
};

function StaffView() {
  const [days, setDays] = useState(14);
  const { data, loading, error, refetch } = useApi<StaffData>(`/api/wellbeing?days=${days}`, [days]);
  const [confirmNote, setConfirmNote] = useState<string | null>(null);

  if (loading && !data) return <LoadingBlock label="چک‌این‌های مدرسه…" />;
  if (error) return <ErrorBox message={typeof error === "string" ? error : "بارگذاری ناموفق بود"} />;
  if (!data) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={HeartPulse} label="میانگین حال مدرسه" value={data.avgMood != null ? `${faNumber(data.avgMood)} از ۵` : "—"} tone={data.avgMood != null && data.avgMood < 3 ? "warning" : "spring"} />
        <StatCard icon={Heart} label="کل چک‌این‌ها" value={faNumber(data.totalCheckins)} tone="ink" />
        <StatCard icon={AlertTriangle} label="موارد پرچم‌شده" value={faNumber(data.flaggedCount)} tone={data.flaggedCount > 0 ? "warning" : "spring"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30].map((d) => (
          <button key={d} className={`b-pill-tab ${days === d ? "b-pill-tab-active" : ""}`} onClick={() => setDays(d)}>
            {faDigits(d)} روز اخیر
          </button>
        ))}
        <button className="b-btn b-btn-ghost b-btn-sm ms-auto" onClick={() => refetch()}>به‌روزرسانی</button>
      </div>

      {/* روند */}
      {data.trend.length > 0 && (
        <div className="b-card-sm p-4">
          <b className="block text-[13px] mb-3">روند میانگین حال روزانه</b>
          <div className="flex items-end gap-1 h-28">
            {data.trend.map((t) => {
              const h = Math.max(8, (t.avg / 5) * 100);
              const tone = t.avg < 3 ? "bg-warning-deep" : t.avg < 4 ? "bg-spring/70" : "bg-spring";
              return (
                <div key={t.date} className="flex-1 flex flex-col items-center gap-1 group min-w-[14px]" title={`${formatDateFa(t.date)} — میانگین ${faNumber(t.avg)} (${faDigits(t.n)} چک‌این)`}>
                  <div className={`w-full rounded-t-lg ${tone} transition-colors`} style={{ height: `${h}%` }} />
                  <span className="text-[8.5px] text-stone group-hover:text-steel">{faDigits(t.date.split("-")[2])}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* موارد پرچم‌شده */}
      {data.flagged.length > 0 && (
        <div className="b-card-sm p-4 !border-warning/40">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning-deep" />
            <b className="text-[13px] text-warning-deep">نیازمند پیگیری مشاور ({faNumber(data.flagged.length)})</b>
          </div>
          <div className="flex flex-col gap-2">
            {data.flagged.map((f) => (
              <div key={`${f.studentId}-${f.date}`} className="b-card-sm !rounded-xl p-3 flex items-start gap-3 flex-wrap">
                <div className="flex flex-col min-w-0">
                  <b className="text-[12.5px]">{f.name}</b>
                  <span className="text-[10.5px] text-steel">{f.className} · {formatDateFa(f.date)}</span>
                </div>
                <span className={`b-badge ${f.mood <= 2 ? "b-badge-critical" : "b-badge-warning"} ms-auto`}>
                  حال: {faDigits(f.mood)} از ۵
                </span>
                {f.note && (
                  <p className="text-[11.5px] text-steel leading-relaxed w-full bg-cloud/40 rounded-lg p-2">
                    «{f.note}» — یادداشت دانش‌آموز (محرمانه)
                  </p>
                )}
              </div>
            ))}
          </div>
          {confirmNote && <p className="text-[11px] text-warning-deep mt-2">{confirmNote}</p>}
          <p className="text-[10.5px] text-stone mt-3 leading-relaxed">
            موارد پرچم‌شده: حال ۱-۲ یا یادداشت حاوی واژه‌های نگران‌کننده. پیگیری محرمانه و با مشاور مدرسه انجام شود.
            برای اقدام، از «بینش‌ها» عوامل ریسک دانش‌آموز را ببینید و مداخله ثبت کنید.
          </p>
        </div>
      )}

      {data.totalCheckins === 0 && (
        <EmptyState
          icon={HeartPulse}
          title="هنوز چک‌اینی ثبت نشده"
          desc="دانش‌آموزان از صفحه «سلامت روان» در پنل خودشان حال روزانه ثبت می‌کنند — پس از چند روز داده اینجا جمع می‌شود."
        />
      )}
    </>
  );
}
