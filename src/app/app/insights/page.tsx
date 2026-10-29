"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, TrendingUp, Loader2, ChevronLeft, FileText, Activity } from "lucide-react";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { useApi, apiGet } from "@/lib/client";
import { faNumber, formatDateFa, faDigits } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

// ============================================================
// بهار | بینش‌ها و هشدار زودهنگام — راند ۱۶
// امتیاز ریسک دانش‌آموزان از ۴ عامل: حضور/نمره/رفتار/سلامت روان
// دسترسی: مدیر، معاون، سرویس (پنل مدرسه) + روایت تحلیلی
// ============================================================

type Factor = { key: string; score: number; weight: number; detail: string };
type TopRow = {
  studentId: string;
  name: string;
  className: string;
  score: number;
  level: "LOW" | "MODERATE" | "HIGH";
  computedAt: string;
  factors: Factor[];
};
type InsightsData = {
  period: string;
  levelCounts: Record<string, number>;
  periods: Array<{ period: string; count: number }>;
  top: TopRow[];
};

const LEVEL_TKEY: Record<string, string> = { HIGH: "insights.level.high", MODERATE: "insights.level.moderate", LOW: "insights.level.low" };
const LEVEL_BADGE: Record<string, string> = { HIGH: "b-badge-critical", MODERATE: "b-badge-warning", LOW: "b-badge-success" };
const FACTOR_TKEY: Record<string, string> = {
  attendance: "nav.attendance",
  grades: "nav.grades",
  behavior: "dashboard.mini.behavior",
  wellbeing: "nav.wellbeing",
};

export default function InsightsPage() {
  const { t } = useLang();
  const [levelFilter, setLevelFilter] = useState<string>("");
  const url = levelFilter ? `/api/insights?level=${levelFilter}` : "/api/insights";
  const { data, loading, error, refetch } = useApi<InsightsData>(url, [levelFilter]);

  // تفصیلی دانش‌آموز انتخاب‌شده
  const [detail, setDetail] = useState<{ student: { name: string; className: string | null }; risk: { score: number; level: string; factors: Factor[] } } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // روایت تحلیلی
  const [narrative, setNarrative] = useState<{ narrative: string; stats: Record<string, unknown> } | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const [narrFor, setNarrFor] = useState("");

  const openDetail = useCallback(async (studentId: string) => {
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiGet<{ student: { name: string; className: string | null }; risk: { score: number; level: string; factors: Factor[] } }>(`/api/insights?studentId=${studentId}`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openNarrative = useCallback(async (studentId: string, name: string) => {
    setNarrative(null);
    setNarrLoading(true);
    setNarrFor(name);
    try {
      const d = await apiGet<{ narrative: string; stats: Record<string, unknown> }>(`/api/insights/narrative?studentId=${studentId}`);
      setNarrative(d);
    } catch {
      setNarrative(null);
    } finally {
      setNarrLoading(false);
    }
  }, []);

  useEffect(() => { /* refetch when filter changes via useApi dep */ }, [levelFilter]);

  if (loading && !data) return <LoadingBlock label={t("insights.loading")} />;
  if (error) return <ErrorBox message={typeof error === "string" ? error : t("insights.error.load")} />;
  if (!data) return null;

  const high = data.levelCounts.HIGH ?? 0;
  const moderate = data.levelCounts.MODERATE ?? 0;
  const low = data.levelCounts.LOW ?? 0;
  const total = high + moderate + low;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.insights")}
        desc={`${t("insights.desc.before")} ${faDigits(data.period)} ${t("insights.desc.after")}`}
      />

      {/* کارت‌های سطح */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={ShieldAlert} label={t("insights.highUrgent")} value={faNumber(high)} tone={high > 0 ? "warning" : "spring"} />
        <StatCard icon={TrendingUp} label={t("insights.level.moderate")} value={faNumber(moderate)} tone="warning" />
        <StatCard icon={Activity} label={t("insights.healthyStatus")} value={faNumber(low)} tone="spring" />
      </div>

      {/* فیلتر */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: "", label: `${t("common.all")} (${faNumber(total)})` },
          { v: "HIGH", label: `${t("insights.level.high")} (${faNumber(high)})` },
          { v: "MODERATE", label: `${t("insights.filter.attention")} (${faNumber(moderate)})` },
          { v: "LOW", label: `${t("insights.level.low")} (${faNumber(low)})` },
        ].map((f) => (
          <button
            key={f.v}
            className={`b-pill-tab ${levelFilter === f.v ? "b-pill-tab-active" : ""}`}
            onClick={() => setLevelFilter(f.v)}
          >
            {f.label}
          </button>
        ))}
        <button className="b-btn b-btn-ghost b-btn-sm ms-auto" onClick={() => refetch()}>
          <Loader2 className="w-4 h-4" /> {t("common.refresh")}
        </button>
      </div>

      {/* جدول ریسک */}
      {data.top.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={t("insights.empty.title")}
          desc={t("insights.empty.desc")}
        />
      ) : (
        <div className="b-card-sm overflow-hidden">
          <div className="overflow-x-auto b-scroll">
            <table className="w-full text-[12.5px] min-w-[640px]">
              <thead>
                <tr className="border-b border-hairline-soft text-steel text-[12px]">
                  <th className="text-right py-3 px-4 font-bold">{t("common.student")}</th>
                  <th className="text-right py-3 px-4 font-bold">{t("common.class")}</th>
                  <th className="text-right py-3 px-4 font-bold">{t("insights.table.riskScore")}</th>
                  <th className="text-right py-3 px-4 font-bold">{t("insights.table.level")}</th>
                  <th className="text-right py-3 px-4 font-bold">{t("insights.table.lastComputed")}</th>
                  <th className="text-right py-3 px-4 font-bold">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.top.map((r) => (
                  <tr key={r.studentId} className="border-b border-hairline-soft/60 last:border-0 hover:bg-cloud/30">
                    <td className="py-3 px-4 font-bold">{r.name}</td>
                    <td className="py-3 px-4 text-steel">{r.className}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-cloud overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.score >= 66 ? "bg-destructive" : r.score >= 33 ? "bg-warning-deep" : "bg-spring"}`}
                            style={{ width: `${Math.min(100, r.score)}%` }}
                          />
                        </div>
                        <b>{faNumber(r.score)}</b>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className={`b-badge ${LEVEL_BADGE[r.level]}`}>{LEVEL_TKEY[r.level] ? t(LEVEL_TKEY[r.level]) : r.level}</span></td>
                    <td className="py-3 px-4 text-steel text-[11.5px]">{formatDateFa(r.computedAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5">
                        <button className="b-btn b-btn-ghost b-btn-sm !min-h-[40px] !text-[12px]" onClick={() => openDetail(r.studentId)}>
                          {t("insights.factors")}
                        </button>
                        <button className="b-btn b-btn-soft b-btn-sm !min-h-[40px] !text-[12px]" onClick={() => openNarrative(r.studentId, r.name)}>
                          <FileText className="w-3.5 h-3.5" /> {t("insights.narrative")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* مودال عوامل */}
      {detailLoading && <LoadingBlock label={t("insights.loadingFactors")} />}
      {detail && (
        <div className="b-card-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <b className="text-[13px]">{detail.student.name}</b>
            {detail.student.className && <span className="b-badge b-badge-neutral">{detail.student.className}</span>}
            <span className={`b-badge ${LEVEL_BADGE[detail.risk.level]} ms-auto`}>{LEVEL_TKEY[detail.risk.level] ? t(LEVEL_TKEY[detail.risk.level]) : detail.risk.level} — {faNumber(detail.risk.score)}</span>
            <button className="b-btn b-btn-ghost text-steel hover:text-ink" onClick={() => setDetail(null)}>✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {detail.risk.factors.map((f) => (
              <div key={f.key} className="b-card-sm !rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <b className="text-[12px]">{FACTOR_TKEY[f.key] ? t(FACTOR_TKEY[f.key]) : f.key}</b>
                  <span className={`b-badge ${f.score >= 66 ? "b-badge-critical" : f.score >= 33 ? "b-badge-warning" : "b-badge-success"}`}>{faNumber(f.score)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-cloud overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${f.score >= 66 ? "bg-destructive" : f.score >= 33 ? "bg-warning-deep" : "bg-spring"}`}
                    style={{ width: `${Math.min(100, f.score)}%` }}
                  />
                </div>
                <p className="text-[12px] text-steel leading-relaxed">{f.detail}</p>
                <p className="text-[12px] text-stone mt-1">{t("insights.factor.weight")}: {faNumber(Math.round(f.weight * 100))}٪</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* مودال روایت تحلیلی */}
      {(narrLoading || narrative) && (
        <div className="b-card-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-spring" />
            <b className="text-[13px]">{t("insights.narrativeTitle")} — {narrFor}</b>
            <div className="ms-auto flex gap-1.5">
              {narrative && (
                <button
                  className="b-btn b-btn-soft b-btn-sm !min-h-[40px] !text-[12px]"
                  onClick={() => navigator.clipboard?.writeText(narrative.narrative).then(() => window.dispatchEvent(new Event("bahar-toast-copy"))).catch(() => {})}
                >
                  {t("insights.copyText")}
                </button>
              )}
              <button className="b-btn b-btn-ghost text-steel hover:text-ink" onClick={() => { setNarrative(null); setNarrLoading(false); }}>✕</button>
            </div>
          </div>
          {narrLoading && <LoadingBlock label={t("insights.loadingNarrative")} />}
          {narrative && (
            <div className="text-[13px] leading-[2] whitespace-pre-line bg-cloud/40 rounded-xl p-4">
              {narrative.narrative}
            </div>
          )}
        </div>
      )}

      <p className="text-[12px] text-stone leading-relaxed">
        {t("insights.footerNote")}
      </p>
    </div>
  );
}
