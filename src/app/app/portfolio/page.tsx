"use client";

import { Award, BookOpenCheck, ClipboardCheck, Printer, Sparkles, UserRound } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Portfolio = {
  student: { name: string; className: string; grade: string; schoolName: string; houseName: string | null; studentNumber: string };
  certificates: { id: string; title: string; kind: string; issuedAt: string; serial: string }[];
  badges: { id: string; name: string; awardedAt: string }[];
  topQuizzes: { title: string; score: number | null }[];
  booksRead: number;
  attendanceRate: number | null;
  strengths: string[];
};
type Me = { user: { role: string } };

export default function PortfolioPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const { data, loading, error } = useApi<{ portfolio: Portfolio | null }>("/api/portfolio");
  const p = data?.portfolio;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("portfolio.title")}
        desc={t("portfolio.desc")}
        action={p ? (
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> {t("portfolio.print")}
          </button>
        ) : undefined}
      />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && !p && <EmptyState icon={Sparkles} title={t("portfolio.empty")} />}
      {p && (
        <>
          <div className="b-card b-grad-border p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5">
            <span className="w-20 h-20 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
              <UserRound className="w-10 h-10" />
            </span>
            <div className="flex flex-col gap-1">
              <b className="text-[22px] b-grad-text">{p.student.name}</b>
              <span className="text-[14px] text-steel">
                {p.student.schoolName} · {p.student.className} · {t("portfolio.gradePrefix")} {p.student.grade}
                {p.student.houseName ? ` · ${t("portfolio.housePrefix")} ${p.student.houseName}` : ""} · {t("portfolio.studentNumberPrefix")} {p.student.studentNumber}
              </span>
              <span className="flex gap-1.5 mt-1 flex-wrap">
                {p.badges.slice(0, 6).map((b) => (
                  <span key={b.id} className="b-badge b-badge-spring">{b.name}</span>
                ))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Award} label={t("portfolio.certificates")} value={p.certificates.length} tone="spring" />
            <StatCard icon={Sparkles} label={t("portfolio.honors")} value={p.badges.length} tone="blossom" />
            <StatCard icon={BookOpenCheck} label={t("portfolio.booksRead")} value={p.booksRead} tone="soft" />
            <StatCard icon={ClipboardCheck} label={t("dashboard.attendanceRate")} value={p.attendanceRate != null ? `${faNumber(p.attendanceRate)}٪` : "—"} tone="ink" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-2">
              <b className="text-[14px]">{t("portfolio.certificatesTitle")}</b>
              {p.certificates.length === 0 && <span className="text-[12px] text-steel">{t("portfolio.noCertificates")}</span>}
              {p.certificates.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span>{c.title}</span>
                  <span className="text-steel text-[12px]">{formatDateFa(c.issuedAt)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-4">
              <div className="b-card p-6 flex flex-col gap-2">
                <b className="text-[14px]">{t("portfolio.topQuizzes")}</b>
                {p.topQuizzes.length === 0 && <span className="text-[12px] text-steel">{t("portfolio.noQuizzes")}</span>}
                {p.topQuizzes.map((q, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                    <span>{q.title}</span>
                    <b className="text-spring">{q.score != null ? faNumber(q.score) : "—"}</b>
                  </div>
                ))}
              </div>
              <div className="b-card p-6 flex flex-col gap-2">
                <b className="text-[14px]">{t("portfolio.strengths")}</b>
                {p.strengths.length === 0 && <span className="text-[12px] text-steel">{t("portfolio.noStrengths")}</span>}
                {p.strengths.map((s, i) => (
                  <span key={i} className="text-[14px] flex gap-2"><Sparkles className="w-4 h-4 text-spring shrink-0 mt-0.5" /> {s}</span>
                ))}
              </div>
            </div>
          </div>
          <p className="t-cap text-stone text-center">{t("portfolio.footer")}</p>
        </>
      )}
    </div>
  );
}
