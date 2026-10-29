"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Save, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type StaffRow = { user: { id: string; firstName: string; lastName: string; role: string }; record: { status: string; checkIn: string | null; checkOut: string | null; note: string | null } | null };
type MgrData = { manager: true; date: string; staff: StaffRow[] };
type OwnData = { manager: false; date: string; mine: Array<{ id: string; date: string; status: string; checkIn: string | null; checkOut: string | null }> };

const STATUS_OPTIONS = [
  { value: "PRESENT", tkey: "enum.attendance.PRESENT" },
  { value: "LATE", tkey: "dashboard.hint.late" },
  { value: "ABSENT", tkey: "dashboard.hint.absent" },
  { value: "LEAVE", tkey: "enum.staffAttendanceStatus.LEAVE" },
  { value: "MISSION", tkey: "enum.staffAttendanceStatus.MISSION" },
];
const STATUS_TKEY: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.tkey]));
const ROLE_TKEY: Record<string, string> = { MANAGER: "common.manager", DEPUTY: "common.deputy", TEACHER: "common.teacher", CUSTODIAN: "role.custodian" };

export default function StaffAttendancePage() {
  const { t } = useLang();
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
      toast.success(`${d.saved} ${t("staffAttendance.nfr-sbt-shd")}`);
      load(date);
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(false); }
  }

  if (!data) return <LoadingBlock label={t("staffAttendance.hzvr-v-ghyab-karknan")} />;

  if (!data.manager) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("staffAttendance.hzvr-v-ghyab-mn")} desc={t("staffAttendance.svabq-hzvr-shma-dr-mdrsh")} />
        {data.mine.length === 0
          ? <EmptyState icon={ClipboardCheck} title={t("staffAttendance.sabqh-ay-nyst")} desc={t("staffAttendance.hnvz-hzvry-bray-shma-sbt-nshdh-ast")} />
          : <section className="b-card p-5 overflow-x-auto b-scroll">
              <table className="w-full text-[14px] min-w-[480px]">
                <thead><tr className="text-steel"><th className="p-2 text-start">{t("common.date")}</th><th className="p-2 text-start">{t("common.status")}</th><th className="p-2 text-start">{t("auth.login.submit")}</th><th className="p-2 text-start">{t("shell.logoutShort")}</th></tr></thead>
                <tbody className="b-rows-in">
                  {data.mine.map((r) => (
                    <tr key={r.id} className="border-t border-hairline-soft">
                      <td className="p-2 font-bold">{r.date}</td>
                      <td className="p-2">{t(STATUS_TKEY[r.status] ?? r.status)}</td>
                      <td className="p-2">{r.checkIn ?? "—"}</td>
                      <td className="p-2">{r.checkOut ?? "—"}</td>
                      <td className="p-2"><button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label={t("staffAttendance.hzf-rkvrd")} onClick={async () => { if (!window.confirm(t("staffAttendance.ayn-rkvrd-hzvr-hzf-shvd"))) return; try { await apiDelete(`/api/staff-attendance?id=${r.id}`); toast.success(t("staffAttendance.hzf-shd")); load(date); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}><Trash2 className="w-4 h-4" /></button></td>
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
        title={t("nav.staffAttendance")}
        desc={t("staffAttendance.sbt-rvzanh-hzvr-mdyr-maavn-malman-v-sraydar-mbnay-mrkhsy-v-hqvq")}
        action={<button className="b-btn b-btn-spring" disabled={busy} onClick={save}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("staffAttendance.sbt-hmh")}</button>}
      />
      <div className="flex items-center gap-3">
        <label className="text-[12px] font-bold">{t("common.date")} ({t("staffAttendance.shmsy")}):</label>
        <input className="b-input !w-44" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1404-08-05" />
      </div>
      <section className="b-card p-5 md:p-6">
        {data.staff.length === 0
          ? <EmptyState icon={ClipboardCheck} title={t("staffAttendance.karmndy-nyst")} desc={t("staffAttendance.karbr-faaly-ba-nqsh-karknan-dr-ayn-mdrsh-nyst")} />
          : <div className="flex flex-col divide-y divide-hairline-soft">
              {data.staff.map((row) => (
                <div key={row.user.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-40">
                    <b className="text-[14px]">{row.user.firstName} {row.user.lastName}</b>
                    <span className="t-cap text-steel block">{t(ROLE_TKEY[row.user.role] ?? row.user.role)}</span>
                  </div>
                  <div className="w-44">
                    <Select
                      value={marks[row.user.id] ?? ""}
                      onChange={(v) => setMarks((m) => ({ ...m, [row.user.id]: v }))}
                      placeholder={t("users.notRegistered")}
                      options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.tkey) }))}
                      ariaLabel={`${t("common.status")} ${row.user.firstName} ${row.user.lastName}`}
                    />
                  </div>
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}
