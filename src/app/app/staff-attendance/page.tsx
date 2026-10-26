"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey } from "@/lib/persian";

type StaffRow = { user: { id: string; firstName: string; lastName: string; role: string }; record: { status: string; checkIn: string | null; checkOut: string | null; note: string | null } | null };
type MgrData = { manager: true; date: string; staff: StaffRow[] };
type OwnData = { manager: false; date: string; mine: Array<{ id: string; date: string; status: string; checkIn: string | null; checkOut: string | null }> };

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "حاضر" },
  { value: "LATE", label: "تأخیر" },
  { value: "ABSENT", label: "غایب" },
  { value: "LEAVE", label: "مرخصی" },
  { value: "MISSION", label: "مأموریت" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const ROLE_LABEL: Record<string, string> = { MANAGER: "مدیر", DEPUTY: "معاون", TEACHER: "معلم", CUSTODIAN: "سرایدار" };

export default function StaffAttendancePage() {
  const [data, setData] = useState<MgrData | OwnData | null>(null);
  const [date, setDate] = useState(todayKey());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback((d: string) => {
    apiGet<MgrData | OwnData>(`/api/staff-attendance?date=${encodeURIComponent(d)}`)
      .then((res) => {
        setData(res);
        if (res.manager) {
          const m: Record<string, string> = {};
          for (const row of res.staff) if (row.record) m[row.user.id] = row.record.status;
          setMarks(m);
        }
      })
      .catch(() => setData(null));
  }, []);
  useEffect(() => { load(date); }, [load, date]);

  async function save() {
    if (!data?.manager) return;
    setBusy(true);
    try {
      const records = Object.entries(marks).map(([userId, status]) => ({ userId, status }));
      const d = await apiPost<{ saved: number }>("/api/staff-attendance", { date, records });
      toast.success(`${d.saved} نفر ثبت شد.`);
      load(date);
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  }

  if (!data) return <LoadingBlock label="حضور و غیاب کارکنان…" />;

  if (!data.manager) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="حضور و غیاب من" desc="سوابق حضور شما در مدرسه." />
        {data.mine.length === 0
          ? <EmptyState icon={ClipboardCheck} title="سابقه‌ای نیست" desc="هنوز حضوری برای شما ثبت نشده است." />
          : <section className="b-card p-5">
              <table className="w-full text-[13px]">
                <thead><tr className="text-steel"><th className="p-2 text-start">تاریخ</th><th className="p-2 text-start">وضعیت</th><th className="p-2 text-start">ورود</th><th className="p-2 text-start">خروج</th></tr></thead>
                <tbody className="b-rows-in">
                  {data.mine.map((r) => (
                    <tr key={r.id} className="border-t border-hairline-soft">
                      <td className="p-2 font-bold">{r.date}</td>
                      <td className="p-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="p-2">{r.checkIn ?? "—"}</td>
                      <td className="p-2">{r.checkOut ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حضور و غیاب کارکنان"
        desc="ثبت روزانهٔ حضور مدیر، معاون، معلمان و سرایدار — مبنای مرخصی و حقوق."
        action={<button className="b-btn b-btn-spring" disabled={busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ثبت همه</button>}
      />
      <div className="flex items-center gap-3">
        <label className="text-[12.5px] font-bold">تاریخ (شمسی):</label>
        <input className="b-input !w-44" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1404-08-05" />
      </div>
      <section className="b-card p-5 md:p-6">
        {data.staff.length === 0
          ? <EmptyState icon={ClipboardCheck} title="کارمندی نیست" desc="کاربر فعالی با نقش کارکنان در این مدرسه نیست." />
          : <div className="flex flex-col divide-y divide-hairline-soft">
              {data.staff.map((row) => (
                <div key={row.user.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-40">
                    <b className="text-[13.5px]">{row.user.firstName} {row.user.lastName}</b>
                    <span className="t-cap text-steel block">{ROLE_LABEL[row.user.role] ?? row.user.role}</span>
                  </div>
                  <div className="w-44">
                    <Select
                      value={marks[row.user.id] ?? ""}
                      onChange={(v) => setMarks((m) => ({ ...m, [row.user.id]: v }))}
                      placeholder="ثبت نشده"
                      options={STATUS_OPTIONS}
                      ariaLabel={`وضعیت ${row.user.firstName} ${row.user.lastName}`}
                    />
                  </div>
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}
