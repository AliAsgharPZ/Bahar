"use client";

import { Network, School, Users, GraduationCap, LayoutGrid, UserPlus, Wallet } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = {
  id: string; name: string; code: string; city: string | null; province: string | null;
  isActive: boolean; students: number; staff: number; classes: number;
  leads: number; feesPaid: number; ratio: number;
};
type Data = { schools: Row[]; totals: { schools: number; students: number; staff: number; classes: number; leads: number; feesPaid: number } };

export default function NetworkPage() {
  const { t } = useLang();
  const { data, loading, error } = useApi<Data>("/api/network");
  const totals = data?.totals;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("network.title")} desc={t("network.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={School} label={t("common.school")} value={totals.schools} tone="ink" />
          <StatCard icon={GraduationCap} label={t("network.stat.activeStudents")} value={totals.students} tone="spring" />
          <StatCard icon={Users} label={t("network.stat.staff")} value={totals.staff} tone="soft" />
          <StatCard icon={LayoutGrid} label={t("common.class")} value={totals.classes} tone="soft" />
          <StatCard icon={UserPlus} label={t("network.stat.leads")} value={totals.leads} tone="warning" />
          <StatCard icon={Wallet} label={t("network.stat.feesPaid")} value={totals.feesPaid} tone="blossom" />
        </div>
      )}
      {data && data.schools.length === 0 && <EmptyState icon={Network} title={t("network.empty.title")} />}
      {data && data.schools.length > 0 && (
        <div className="b-card overflow-x-auto b-scroll">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead><tr className="text-steel border-b border-hairline">
              <th className="p-3 text-start font-bold">{t("common.school")}</th>
              <th className="p-3 text-start font-bold">{t("network.table.cityProvince")}</th>
              <th className="p-3 text-start font-bold">{t("common.student")}</th>
              <th className="p-3 text-start font-bold">{t("network.table.staff")}</th>
              <th className="p-3 text-start font-bold">{t("network.table.ratio")}</th>
              <th className="p-3 text-start font-bold">{t("common.class")}</th>
              <th className="p-3 text-start font-bold">{t("network.table.leads")}</th>
              <th className="p-3 text-start font-bold">{t("dashboard.feeCollection")}</th>
              <th className="p-3 text-start font-bold">{t("common.status")}</th>
            </tr></thead>
            <tbody className="b-rows-in">
              {data.schools.map((s) => (
                <tr key={s.id} className="border-b border-hairline last:border-0">
                  <td className="p-3"><b>{s.name}</b><span className="block text-[11px] text-steel">{s.code}</span></td>
                  <td className="p-3">{[s.city, s.province].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="p-3">{faNumber(s.students)}</td>
                  <td className="p-3">{faNumber(s.staff)}</td>
                  <td className="p-3">{s.ratio ? faNumber(s.ratio) : "—"}</td>
                  <td className="p-3">{faNumber(s.classes)}</td>
                  <td className="p-3">{faNumber(s.leads)}</td>
                  <td className="p-3">{faNumber(s.feesPaid)} {t("network.currency")}</td>
                  <td className="p-3"><span className={`b-badge ${s.isActive ? "b-badge-spring" : "b-badge-blossom"}`}>{s.isActive ? t("common.active") : t("common.inactive")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
