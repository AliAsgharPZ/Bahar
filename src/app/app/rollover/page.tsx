"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarSync, Loader2, GraduationCap, ArrowUpCircle } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type ClassRow = { id: string; name: string; grade: string; academicYear: string; _count: { students: number } };
type Plan = { toName: string; toGrade: string; graduate: boolean };

export default function RolloverPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<{ classes: ClassRow[]; years: string[] }>("/api/rollover");
  const confirm = useConfirm();
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ moved: number; graduated: number; createdClasses: number } | null>(null);

  const years = data?.years ?? [];
  const year = fromYear || years[0] || "";
  const classes = useMemo(() => (data?.classes ?? []).filter((c) => c.academicYear === year), [data, year]);

  function planOf(c: ClassRow): Plan {
    return plans[c.id] ?? { toName: c.name, toGrade: c.grade, graduate: false };
  }
  function setPlan(id: string, patch: Partial<Plan>, base: ClassRow) {
    setPlans((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { toName: base.name, toGrade: base.grade, graduate: false }), ...patch } }));
  }

  async function execute() {
    if (!toYear.trim()) { toast.error(t("rollover.sal-mqsd-ra-bnvysyd")); return; }
    const list = classes.map((c) => ({ fromClassId: c.id, ...planOf(c) }));
    const grads = list.filter((p) => p.graduate).length;
    if (!(await confirm({
      title: t("nav.rollover"),
      description: `${faNumber(list.length)} ${t("rollover.klas-prdazsh-my-shvd")} ${faNumber(grads)} ${t("rollover.klas-fargh-althsyl-my-shvnd-v-bqyh-bh-sal")} ${toYear} ${t("rollover.mntql-my-shvnd-ayn-kar-qabl-bazgsht-nyst")}`,
      confirmLabel: t("rollover.ajra-kn"), danger: true,
    }))) return;
    setBusy(true);
    try {
      const r = await apiPost<{ moved: number; graduated: number; createdClasses: number }>("/api/rollover", { toYear: toYear.trim(), plans: list });
      setResult(r);
      toast.success(t("rollover.artqay-sal-anjam-shd"));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("rollover.bstn-sal-thsyly-v-artqa")} desc={t("rollover.bray-hr-klas-nam-v-payh-sal-bad-ra-mshkhs-knyd-ya-klas-ra-fargh")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      <div className="b-card p-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("rollover.sal-mbd")}</span>
          <Select value={year} onChange={setFromYear} options={years.map((y) => ({ value: y, label: y }))} placeholder={t("rollover.sal")} /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("rollover.sal-mqsd")} *</span>
          <input className="b-input w-32" value={toYear} onChange={(e) => setToYear(e.target.value)} placeholder="1406-1405" /></label>
        <button className="b-btn b-btn-spring" disabled={busy || classes.length === 0} onClick={execute}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarSync className="w-4 h-4" />} {t("rollover.ajray-artqa")}
        </button>
        {result && (
          <span className="text-[12px] text-steel">
            {t("rollover.ntyjh")}: {faNumber(result.moved)} {t("rollover.dansh-amvz-mntql-shd")} {faNumber(result.graduated)} {t("rollover.fargh-althsyl")} {faNumber(result.createdClasses)} {t("rollover.klas-jdyd-sakhth-shd")}
          </span>
        )}
      </div>

      {data && classes.length === 0 && <EmptyState icon={CalendarSync} title={t("rollover.bray-ayn-sal-klasy-nyst")} />}
      <div className="flex flex-col gap-2 b-auto-stagger">
        {classes.map((c) => {
          const p = planOf(c);
          return (
            <div key={c.id} className="b-card-sm p-4 grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
              <span><b className="text-[14px]">{c.name}</b><span className="block text-[12px] text-steel">{t("rollover.payh")} {c.grade} · {faNumber(c._count.students)} {t("rollover.dansh-amvz-faal")}</span></span>
              <input className="b-input" value={p.toName} disabled={p.graduate} onChange={(e) => setPlan(c.id, { toName: e.target.value }, c)} placeholder={t("rollover.nam-klas-sal-bad")} />
              <input className="b-input" value={p.toGrade} disabled={p.graduate} onChange={(e) => setPlan(c.id, { toGrade: e.target.value }, c)} placeholder={t("rollover.payh-sal-bad")} />
              <button className={`b-badge ${p.graduate ? "b-badge-blossom" : "b-badge-neutral"}`} onClick={() => setPlan(c.id, { graduate: !p.graduate }, c)}>
                {p.graduate ? <><GraduationCap className="w-3.5 h-3.5" /> {t("rollover.fargh-althsyl-my-shvd")}</> : <><ArrowUpCircle className="w-3.5 h-3.5" /> {t("rollover.artqa-bh-sal-bad")}</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
