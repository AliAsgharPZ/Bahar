"use client";

import { BookOpenCheck, Crown, GraduationCap, PartyPopper, Printer, Sparkles, Users } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Yb = {
  schoolName: string;
  stats: { students: number; staff: number; classes: number; certificates: number; events: number; loans: number };
  topByClass: { className: string; name: string; avg: number }[];
  topBooks: { title: string; n: number }[];
  mostBadges: { name: string; n: number }[];
  champion: { name: string; color: string; points: number } | null;
};

export default function YearbookPage() {
  const { t } = useLang();
  const { data, loading, error } = useApi<{ yearbook: Yb | null }>("/api/yearbook");
  const yb = data?.yearbook;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("yearbook.title")}
        desc={t("yearbook.desc")}
        grad
        action={yb ? (
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> {t("yearbook.print")}
          </button>
        ) : undefined}
      />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && !yb && <EmptyState icon={PartyPopper} title={t("yearbook.empty")} />}
      {yb && (
        <>
          <div className="b-card b-grad-border p-6 md:p-8 text-center flex flex-col items-center gap-2">
            <GraduationCap className="w-10 h-10 text-spring" />
            <b className="text-[22px] b-grad-text">{yb.schoolName}</b>
            <span className="text-[14px] text-steel">{t("yearbook.subtitle")}</span>
            {yb.champion && (
              <span className="b-badge b-badge-blossom mt-1">
                <Crown className="w-3.5 h-3.5" /> {t("yearbook.championPrefix")} {yb.champion.name} · {faNumber(yb.champion.points)} {t("yearbook.points")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label={t("common.student")} value={yb.stats.students} tone="spring" />
            <StatCard icon={GraduationCap} label={t("yearbook.staff")} value={yb.stats.staff} tone="ink" />
            <StatCard icon={PartyPopper} label={t("yearbook.events")} value={yb.stats.events} tone="blossom" />
            <StatCard icon={BookOpenCheck} label={t("yearbook.loans")} value={yb.stats.loans} tone="soft" />
          </div>
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">{t("yearbook.topByClass")}</b>
              {yb.topByClass.length === 0 && <span className="text-[12px] text-steel">{t("yearbook.noGrades")}</span>}
              {yb.topByClass.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span>{t.className}: <b>{t.name}</b></span>
                  <b className="text-spring">{faNumber(t.avg)}</b>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">{t("yearbook.topBooks")}</b>
              {yb.topBooks.length === 0 && <span className="text-[12px] text-steel">{t("yearbook.noLoans")}</span>}
              {yb.topBooks.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span>{b.title}</span>
                  <span className="text-steel">{faNumber(b.n)} {t("yearbook.loanUnit")}</span>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">{t("yearbook.mostBadges")}</b>
              {yb.mostBadges.length === 0 && <span className="text-[12px] text-steel">{t("yearbook.noBadges")}</span>}
              {yb.mostBadges.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-blossom" /> {b.name}</span>
                  <b className="text-blossom">{faNumber(b.n)} {t("yearbook.badgeUnit")}</b>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
