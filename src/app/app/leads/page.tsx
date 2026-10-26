"use client";

import { toast } from "sonner";
import { CheckCheck, Phone, UserRound, CalendarDays } from "lucide-react";
import { useApi, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateTimeFa, relativeTimeFa, faNumber } from "@/lib/persian";

type Lead = {
  id: string;
  name: string;
  parentName: string | null;
  phone: string;
  grade: string | null;
  message: string | null;
  status: string;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "جدید", CONTACTED: "تماس گرفته شد", REGISTERED: "ثبت‌نام کامل", ARCHIVED: "بایگانی",
};

export default function LeadsPage() {
  const { data, loading, error, refetch } = useApi<{ leads: Lead[]; summary: { total: number; new: number; contacted: number; registered: number } }>("/api/leads");

  async function changeStatus(lead: Lead, status: string) {
    try {
      await apiPatch("/api/leads", { id: lead.id, status });
      toast.success("وضعیت به‌روزرسانی شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="پیش‌ثبت‌نام‌های سایت مدرسه"
        desc="درخواست‌هایی که از فرم «پیش‌ثبت‌نام» سایت عمومی مدرسه ثبت شده‌اند."
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={CheckCheck} label="کل درخواست‌ها" value={data.summary.total} tone="spring" />
          <StatCard icon={Phone} label="در انتظار تماس" value={data.summary.new} tone={data.summary.new ? "blossom" : "soft"} />
          <StatCard icon={UserRound} label="تماس گرفته‌شده" value={data.summary.contacted} tone="ink" />
          <StatCard icon={CalendarDays} label="ثبت‌نام کامل" value={data.summary.registered} tone="soft" />
        </div>
      )}

      {data && data.leads.length === 0 && (
        <EmptyState
          icon={CheckCheck}
          title="درخواستی نیست"
          desc="با انتشار سایت مدرسه، درخواست‌های پیش‌ثبت‌نام اینجا نمایش داده می‌شوند."
        />
      )}

      {data && data.leads.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.leads.map((l) => (
            <div key={l.id} className="b-card-sm p-4 flex flex-wrap items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center text-[12px] font-bold shrink-0">
                {l.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <b className="text-[13.5px] block truncate">
                  {l.name}
                  {l.parentName ? <span className="text-[11px] text-steel font-normal"> — ولی: {l.parentName}</span> : null}
                </b>
                <span className="text-[11.5px] text-steel flex items-center gap-2 flex-wrap">
                  <a href={`tel:${l.phone}`} dir="ltr" className="font-mono text-spring hover:underline">{l.phone}</a>
                  {l.grade && <span>پایه {l.grade}</span>}
                  <span className="text-stone">{relativeTimeFa(l.createdAt)}</span>
                </span>
                {l.message && <p className="text-[11.5px] text-steel mt-1 max-w-xl truncate">{l.message}</p>}
              </div>
              <Select
                value={l.status}
                onChange={(v) => changeStatus(l, v)}
                options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                className="!w-auto max-w-[160px]"
                buttonClassName="!h-10"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
