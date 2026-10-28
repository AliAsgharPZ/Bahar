"use client";

import { Network, School, Users, GraduationCap, LayoutGrid, UserPlus, Wallet } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

type Row = {
  id: string; name: string; code: string; city: string | null; province: string | null;
  isActive: boolean; students: number; staff: number; classes: number;
  leads: number; feesPaid: number; ratio: number;
};
type Data = { schools: Row[]; totals: { schools: number; students: number; staff: number; classes: number; leads: number; feesPaid: number } };

export default function NetworkPage() {
  const { data, loading, error } = useApi<Data>("/api/network");
  const t = data?.totals;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="داشبورد شبکهٔ مدارس" desc="نمای تجمیعی بالای سلسله‌مراتب — همهٔ مدرسه‌ها، دانش‌آموزان و کادر در یک نگاه (EMIS)." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={School} label="مدرسه" value={t.schools} tone="ink" />
          <StatCard icon={GraduationCap} label="دانش‌آموز فعال" value={t.students} tone="spring" />
          <StatCard icon={Users} label="کادر آموزشی و اجرایی" value={t.staff} tone="soft" />
          <StatCard icon={LayoutGrid} label="کلاس" value={t.classes} tone="soft" />
          <StatCard icon={UserPlus} label="متقاضی پذیرش" value={t.leads} tone="warning" />
          <StatCard icon={Wallet} label="شهریهٔ وصول‌شده (تومان)" value={t.feesPaid} tone="blossom" />
        </div>
      )}
      {data && data.schools.length === 0 && <EmptyState icon={Network} title="مدرسه‌ای ثبت نشده" />}
      {data && data.schools.length > 0 && (
        <div className="b-card overflow-x-auto b-scroll">
          <table className="w-full text-[13px] min-w-[820px]">
            <thead><tr className="text-steel border-b border-hairline">
              <th className="p-3 text-start font-bold">مدرسه</th>
              <th className="p-3 text-start font-bold">شهر / استان</th>
              <th className="p-3 text-start font-bold">دانش‌آموز</th>
              <th className="p-3 text-start font-bold">کادر</th>
              <th className="p-3 text-start font-bold">نسبت دانش‌آموز به کادر</th>
              <th className="p-3 text-start font-bold">کلاس</th>
              <th className="p-3 text-start font-bold">متقاضی</th>
              <th className="p-3 text-start font-bold">وصول شهریه</th>
              <th className="p-3 text-start font-bold">وضعیت</th>
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
                  <td className="p-3">{faNumber(s.feesPaid)} تومان</td>
                  <td className="p-3"><span className={`b-badge ${s.isActive ? "b-badge-spring" : "b-badge-blossom"}`}>{s.isActive ? "فعال" : "غیرفعال"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
