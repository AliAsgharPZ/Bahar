"use client";

import { BookOpenCheck, Crown, GraduationCap, PartyPopper, Printer, Sparkles, Users } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

type Yb = {
  schoolName: string;
  stats: { students: number; staff: number; classes: number; certificates: number; events: number; loans: number };
  topByClass: { className: string; name: string; avg: number }[];
  topBooks: { title: string; n: number }[];
  mostBadges: { name: string; n: number }[];
  champion: { name: string; color: string; points: number } | null;
};

export default function YearbookPage() {
  const { data, loading, error } = useApi<{ yearbook: Yb | null }>("/api/yearbook");
  const yb = data?.yearbook;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="کتاب سال دیجیتال"
        desc="سال تحصیلی در یک نگاه — آمادهٔ چاپ برای آرشیو و ارائه."
        grad
        action={yb ? (
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> چاپ کتاب سال
          </button>
        ) : undefined}
      />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && !yb && <EmptyState icon={PartyPopper} title="کتاب سال برای این حساب در دسترس نیست" />}
      {yb && (
        <>
          <div className="b-card b-grad-border p-6 md:p-8 text-center flex flex-col items-center gap-2">
            <GraduationCap className="w-10 h-10 text-spring" />
            <b className="text-[22px] b-grad-text">{yb.schoolName}</b>
            <span className="text-[13px] text-steel">کتاب سال تحصیلی — ساخته‌شدهٔ خودکار از داده‌های زندهٔ سامانه</span>
            {yb.champion && (
              <span className="b-badge b-badge-blossom mt-1">
                <Crown className="w-3.5 h-3.5" /> قهرمان لیگ خانه‌ها: {yb.champion.name} · {faNumber(yb.champion.points)} امتیاز
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="دانش‌آموز" value={yb.stats.students} tone="spring" />
            <StatCard icon={GraduationCap} label="همکار آموزشی" value={yb.stats.staff} tone="ink" />
            <StatCard icon={PartyPopper} label="رویداد برگزارشده" value={yb.stats.events} tone="blossom" />
            <StatCard icon={BookOpenCheck} label="امانت کتاب" value={yb.stats.loans} tone="soft" />
          </div>
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">برترین هر کلاس (میانگین نمرات نهایی)</b>
              {yb.topByClass.length === 0 && <span className="text-[12.5px] text-steel">نمرهٔ نهایی ثبت نشده است.</span>}
              {yb.topByClass.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span>{t.className}: <b>{t.name}</b></span>
                  <b className="text-spring">{faNumber(t.avg)}</b>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">پُرخوان‌ترین کتاب‌ها</b>
              {yb.topBooks.length === 0 && <span className="text-[12.5px] text-steel">امانتی ثبت نشده است.</span>}
              {yb.topBooks.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span>{b.title}</span>
                  <span className="text-steel">{faNumber(b.n)} امانت</span>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">پرافتخارترین‌ها (بیشترین نشان)</b>
              {yb.mostBadges.length === 0 && <span className="text-[12.5px] text-steel">نشانی اعطا نشده است.</span>}
              {yb.mostBadges.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-blossom" /> {b.name}</span>
                  <b className="text-blossom">{faNumber(b.n)} نشان</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
