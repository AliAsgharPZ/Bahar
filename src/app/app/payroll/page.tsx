"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Loader2, Printer, Save, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type SalaryRow = { id: string; yearMonth: string; base: number; allowances: number; deductions: number; net?: number; note: string | null };
type Row = { user: { id: string; firstName: string; lastName: string; role: string }; record: (SalaryRow & { net: number }) | null };
type Data = { rows?: Row[]; totals?: { base: number; allowances: number; deductions: number; net: number }; mine?: SalaryRow[] };
type Me = { user: { role: string } };

const ROLE_TKEY: Record<string, string> = { MANAGER: "common.manager", DEPUTY: "common.deputy", TEACHER: "common.teacher", CUSTODIAN: "enum.roleFa.CUSTODIAN" };
const thisMonth = () => {
  // ماه جاری شمسی به‌صورت تقریبی از روی تاریخ میلادی سرور کاربر — مقدار پیش‌فرض قابل ویرایش است
  return "1405-08";
};

export default function PayrollPage() {
  const { t } = useLang();
  const toman = (n: number) => `${faNumber(n)} ${t("payroll.toman")}`;
  const { data: me } = useApi<Me>("/api/auth/me");
  const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me?.user.role ?? "");
  const [month, setMonth] = useState(thisMonth());
  const { data, loading, error, refetch } = useApi<Data>(isManager ? `/api/payroll?month=${month}` : "/api/payroll");
  const [drafts, setDrafts] = useState<Record<string, { base: string; allowances: string; deductions: string }>>({});
  const [savingId, setSavingId] = useState("");

  async function save(userId: string) {
    const d = drafts[userId];
    if (!d) return;
    setSavingId(userId);
    try {
      await apiPost("/api/payroll", { userId, yearMonth: month, base: Number(d.base) || 0, allowances: Number(d.allowances) || 0, deductions: Number(d.deductions) || 0 });
      toast.success(t("payroll.fysh-sbt-shd"));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSavingId(""); }
  }

  if (!isManager) {
    const mine = data?.mine ?? [];
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("payroll.fysh-hqvqy-mn")} desc={t("payroll.fysh-hay-hqvqy-sbt-shdh-bray-shma")} />
        {loading && <LoadingBlock />}
        {error && <ErrorBox message={error} />}
        {data && mine.length === 0 && <EmptyState icon={Wallet} title={t("payroll.hnvz-fyshy-sbt-nshdh")} />}
        <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
          {mine.map((r) => (
            <div key={r.id} className="b-card-md p-6 flex flex-col gap-2 text-[13px]">
              <div className="flex items-center justify-between">
                <b className="text-[15px]">{t("payroll.fysh")} {r.yearMonth}</b>
                <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> {t("common.print")}</button>
              </div>
              <span className="flex justify-between"><span className="text-steel">{t("payroll.hqvq-payh")}</span><b>{toman(r.base)}</b></span>
              <span className="flex justify-between"><span className="text-steel">{t("payroll.mzaya")}</span><b>{toman(r.allowances)}</b></span>
              <span className="flex justify-between"><span className="text-steel">{t("payroll.ksvrat")}</span><b>{toman(r.deductions)}</b></span>
              <span className="flex justify-between border-t border-hairline pt-2"><span className="font-bold">{t("payroll.khals-prdakhty")}</span><b className="text-spring">{toman(r.base + r.allowances - r.deductions)}</b></span>
              {r.note && <p className="text-[11.5px] text-steel">{r.note}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("payroll.hqvq-v-dstmzd")}
        desc={t("payroll.sbt-hqvq-mahanh-karknan-khals-payh-mzaya-ksvrat-mbalgh-bh-tvman")}
        action={
          <label className="flex items-center gap-2">
            <span className="text-[12px] font-bold">{t("payroll.mah")} ({t("payroll.shmsy")})</span>
            <input className="b-input w-32" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="1405-08" />
          </label>
        }
      />
      {data?.totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Wallet} label={t("payroll.jma-payh")} value={toman(data.totals.base)} tone="ink" />
          <StatCard icon={Wallet} label={t("payroll.jma-mzaya")} value={toman(data.totals.allowances)} tone="soft" />
          <StatCard icon={Wallet} label={t("payroll.jma-ksvrat")} value={toman(data.totals.deductions)} tone="warning" />
          <StatCard icon={Wallet} label={t("payroll.jma-khals-prdakhty")} value={toman(data.totals.net)} tone="spring" />
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      <div className="b-card overflow-x-auto b-scroll">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="text-start text-steel border-b border-hairline">
              <th className="p-3 text-start font-bold">{t("payroll.karmnd")}</th>
              <th className="p-3 text-start font-bold">{t("payroll.payh")}</th>
              <th className="p-3 text-start font-bold">{t("payroll.mzaya")}</th>
              <th className="p-3 text-start font-bold">{t("payroll.ksvrat")}</th>
              <th className="p-3 text-start font-bold">{t("payroll.khals")}</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="b-rows-in">
            {rows.map(({ user, record }) => {
              const d = drafts[user.id] ?? {
                base: String(record?.base ?? ""), allowances: String(record?.allowances ?? ""), deductions: String(record?.deductions ?? ""),
              };
              const net = (Number(d.base) || 0) + (Number(d.allowances) || 0) - (Number(d.deductions) || 0);
              const set = (k: string, v: string) => setDrafts((prev) => ({ ...prev, [user.id]: { ...d, [k]: v } }));
              return (
                <tr key={user.id} className="border-b border-hairline last:border-0">
                  <td className="p-3"><b>{user.firstName} {user.lastName}</b><span className="block text-[12px] text-steel">{t(ROLE_TKEY[user.role] ?? user.role)}</span></td>
                  <td className="p-3"><input className="b-input w-32" dir="ltr" inputMode="numeric" value={d.base} onChange={(e) => set("base", e.target.value)} placeholder={t("payroll.0")} /></td>
                  <td className="p-3"><input className="b-input w-28" dir="ltr" inputMode="numeric" value={d.allowances} onChange={(e) => set("allowances", e.target.value)} placeholder={t("payroll.0")} /></td>
                  <td className="p-3"><input className="b-input w-28" dir="ltr" inputMode="numeric" value={d.deductions} onChange={(e) => set("deductions", e.target.value)} placeholder={t("payroll.0")} /></td>
                  <td className="p-3 font-bold">{toman(net)}</td>
                  <td className="p-3">
                    <span className="flex gap-1.5">
                      <button className="b-btn b-btn-spring b-btn-sm" disabled={savingId === user.id} onClick={() => save(user.id)}>
                        {savingId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("payroll.sbt")}
                      </button>
                      {record && (
                        <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" title={t("payroll.hzf-fysh-ayn-mah")}
                          onClick={async () => { if (!window.confirm(`${t("payroll.fysh")} ${user.firstName} ${user.lastName} ${t("payroll.bray-ayn-mah-hzf-shvd")}`)) return; try { await apiDelete(`/api/payroll?id=${record.id}`); toast.success(t("payroll.fysh-hzf-shd")); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <EmptyState icon={Wallet} title={t("payroll.karmndy-yaft-nshd")} />}
      </div>
    </div>
  );
}
