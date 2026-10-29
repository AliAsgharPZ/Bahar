"use client";

import { Award, Crown, FileBadge, Sparkles, Trophy } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type FeedItem = { kind: "BADGE" | "CERT" | "QUIZ"; title: string; studentName: string; at: string };
type House = { id: string; name: string; color: string; motto: string | null; points: number; members: number };

const KIND_ICON = { BADGE: Sparkles, CERT: FileBadge, QUIZ: Award };

export default function FamePage() {
  const { t } = useLang();
  const { data, loading, error } = useApi<{ feed: FeedItem[]; houses: House[] }>("/api/fame");
  const champion = data?.houses[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("fame.title")} desc={t("fame.desc")} grad />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          {champion && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={Crown} label={t("fame.champion")} value={champion.name} tone="blossom" />
              <StatCard icon={Trophy} label={t("fame.championPoints")} value={champion.points} tone="spring" />
              <StatCard icon={Sparkles} label={t("fame.recent")} value={data.feed.length} tone="ink" />
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[15px] mb-2">{t("fame.leagueTable")}</b>
              {data.houses.length === 0 && <span className="text-[12.5px] text-steel">{t("fame.noHouses")}</span>}
              {data.houses.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 py-2.5 border-b border-hairline last:border-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold ${i === 0 ? "bg-blossom text-white" : "bg-cloud text-steel"}`}>{faNumber(i + 1)}</span>
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: h.color }} />
                  <span className="flex-1 min-w-0">
                    <b className="text-[13.5px] block truncate">{t("fame.housePrefix")} {h.name}</b>
                    <span className="text-[11px] text-steel">{faNumber(h.members)} {t("fame.member")}{h.motto ? ` · ${h.motto}` : ""}</span>
                  </span>
                  <b className="text-spring">{faNumber(h.points)}</b>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[15px] mb-2">{t("nav.fame")}</b>
              {data.feed.length === 0 && <EmptyState icon={Sparkles} title={t("fame.empty")} />}
              {data.feed.map((f, i) => {
                const Icon = KIND_ICON[f.kind];
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-hairline last:border-0">
                    <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0"><Icon className="w-4.5 h-4.5" /></span>
                    <span className="flex-1 min-w-0 text-[13px]">
                      <b>{f.studentName}</b> {f.title}
                      <span className="block text-[11px] text-steel">{formatDateFa(f.at)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
