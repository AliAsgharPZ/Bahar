"use client";

import { useEffect, useRef, useState } from "react";
import { Cake, CalendarDays, Megaphone, Trophy, UtensilsCrossed, Maximize } from "lucide-react";
import { useApi } from "@/lib/client";
import { LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { formatDateFa, formatTimeFa, faNumber } from "@/lib/persian";

type Tv = {
  schoolName: string; today: string;
  announcements: { id: string; title: string; body: string; pinned: boolean }[];
  events: { id: string; title: string; startAt: string; kind: string }[];
  birthdays: { name: string; role: string }[];
  meal: { breakfast: string; lunch: string; snack: string } | null;
  topHouse: { name: string; color: string; points: number } | null;
};

const SLIDES = ["announcements", "events", "celebrations", "house"] as const;

export default function TvPage() {
  const { data, loading, error, refetch } = useApi<Tv>("/api/tv");
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState(new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => { setSlide((s) => (s + 1) % SLIDES.length); setNow(new Date()); }, 9000);
    const r = setInterval(() => refetch(), 120000);
    return () => { clearInterval(t); clearInterval(r); };
  }, [refetch]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const cur = SLIDES[slide];

  return (
    <div ref={rootRef} className="b-card overflow-hidden">
      {/* نوار بالای تابلو */}
      <div className="b-hero-grad b-aurora px-6 md:px-10 py-6 flex items-center justify-between gap-4 text-white" style={{ background: "var(--ink)" }}>
        <div className="flex flex-col">
          <b className="text-[22px] md:text-[30px] b-grad-text">{data.schoolName || "مدرسهٔ ما"}</b>
          <span className="text-[13px] opacity-80">{formatDateFa(now)} · تابلوی مدرسه</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[30px] md:text-[40px] font-extrabold tabular-nums" dir="ltr">{formatTimeFa(now)}</span>
          <button
            className="no-print w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            title="تمام‌صفحه"
            onClick={() => { if (rootRef.current) void rootRef.current.requestFullscreen?.().catch(() => {}); }}
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 md:p-10 min-h-[46vh]">
        {cur === "announcements" && (
          <div className="b-rise flex flex-col gap-4" key="a">
            <h2 className="flex items-center gap-2 text-[20px] md:text-[26px] font-extrabold"><Megaphone className="w-6 h-6 text-spring" /> اطلاعیه‌ها</h2>
            {data.announcements.length === 0 && <p className="text-steel text-[16px]">اطلاعیهٔ تازه‌ای نیست.</p>}
            {data.announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="border-b border-hairline pb-3">
                <b className="text-[17px] md:text-[20px]">{a.pinned ? "📌 " : ""}{a.title}</b>
                <p className="text-[14px] md:text-[16px] text-steel leading-relaxed line-clamp-2">{a.body}</p>
              </div>
            ))}
          </div>
        )}
        {cur === "events" && (
          <div className="b-rise flex flex-col gap-4" key="e">
            <h2 className="flex items-center gap-2 text-[20px] md:text-[26px] font-extrabold"><CalendarDays className="w-6 h-6 text-spring" /> رویدادهای امروز و فردا</h2>
            {data.events.length === 0 && <p className="text-steel text-[16px]">رویدادی برای امروز و فردا ثبت نشده است.</p>}
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b border-hairline pb-3">
                <b className="text-[17px] md:text-[20px]">{e.title}</b>
                <span className="text-[14px] md:text-[16px] text-steel" dir="ltr">{formatTimeFa(e.startAt)}</span>
              </div>
            ))}
          </div>
        )}
        {cur === "celebrations" && (
          <div className="b-rise grid md:grid-cols-2 gap-8" key="c">
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-[20px] md:text-[26px] font-extrabold"><Cake className="w-6 h-6 text-blossom" /> تولدهای امروز</h2>
              {data.birthdays.length === 0 && <p className="text-steel text-[16px]">امروز تولدی نداریم.</p>}
              {data.birthdays.map((b, i) => (
                <span key={i} className="text-[17px] md:text-[20px]">🎂 {b.name} <span className="text-steel text-[14px]">({b.role === "TEACHER" ? "همکار" : "دانش‌آموز"})</span></span>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-[20px] md:text-[26px] font-extrabold"><UtensilsCrossed className="w-6 h-6 text-spring" /> غذای امروز</h2>
              {data.meal ? (
                <div className="text-[16px] md:text-[18px] flex flex-col gap-2">
                  <span>صبحانه: {data.meal.breakfast || "—"}</span>
                  <span>ناهار: {data.meal.lunch || "—"}</span>
                  <span>میان‌وعده: {data.meal.snack || "—"}</span>
                </div>
              ) : <p className="text-steel text-[16px]">برنامهٔ غذایی امروز تنظیم نشده است.</p>}
            </div>
          </div>
        )}
        {cur === "house" && (
          <div className="b-rise flex flex-col items-center gap-4 text-center" key="h">
            <h2 className="flex items-center gap-2 text-[20px] md:text-[26px] font-extrabold"><Trophy className="w-6 h-6 text-spring" /> صدرنشین لیگ خانه‌ها</h2>
            {data.topHouse ? (
              <>
                <span className="w-24 h-24 rounded-full flex items-center justify-center text-white text-[34px] font-extrabold" style={{ background: data.topHouse.color }}>
                  {data.topHouse.name.slice(0, 1)}
                </span>
                <b className="text-[26px] md:text-[34px]">خانهٔ {data.topHouse.name}</b>
                <span className="text-[16px] text-steel">{faNumber(data.topHouse.points)} امتیاز</span>
              </>
            ) : <p className="text-steel text-[16px]">هنوز خانه‌ای تعریف نشده است.</p>}
          </div>
        )}
      </div>

      {/* نشانگر اسلایدها */}
      <div className="flex items-center justify-center gap-2 pb-5">
        {SLIDES.map((s, i) => (
          <button key={s} onClick={() => setSlide(i)} aria-label={`اسلاید ${i + 1}`}
            className={`h-2 rounded-full transition-all ${i === slide ? "w-8 bg-spring" : "w-2 bg-hairline"}`} />
        ))}
      </div>
    </div>
  );
}
