"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarSync, Loader2, GraduationCap, ArrowUpCircle } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type ClassRow = { id: string; name: string; grade: string; academicYear: string; _count: { students: number } };
type Plan = { toName: string; toGrade: string; graduate: boolean };

export default function RolloverPage() {
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
    if (!toYear.trim()) { toast.error("سال مقصد را بنویسید."); return; }
    const list = classes.map((c) => ({ fromClassId: c.id, ...planOf(c) }));
    const grads = list.filter((p) => p.graduate).length;
    if (!(await confirm({
      title: "بستن سال تحصیلی",
      description: `${faNumber(list.length)} کلاس پردازش می‌شود؛ ${faNumber(grads)} کلاس فارغ‌التحصیل می‌شوند و بقیه به سال ${toYear} منتقل می‌شوند. این کار قابل بازگشت نیست.`,
      confirmLabel: "اجرا کن", danger: true,
    }))) return;
    setBusy(true);
    try {
      const r = await apiPost<{ moved: number; graduated: number; createdClasses: number }>("/api/rollover", { toYear: toYear.trim(), plans: list });
      setResult(r);
      toast.success("ارتقای سال انجام شد.");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="بستن سال تحصیلی و ارتقا" desc="برای هر کلاس، نام و پایهٔ سال بعد را مشخص کنید یا کلاس را فارغ‌التحصیل علامت بزنید." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      <div className="b-card p-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">سال مبدأ</span>
          <Select value={year} onChange={setFromYear} options={years.map((y) => ({ value: y, label: y }))} placeholder="سال" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">سال مقصد *</span>
          <input className="b-input w-32" value={toYear} onChange={(e) => setToYear(e.target.value)} placeholder="1406-1405" /></label>
        <button className="b-btn b-btn-spring" disabled={busy || classes.length === 0} onClick={execute}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarSync className="w-4 h-4" />} اجرای ارتقا
        </button>
        {result && (
          <span className="text-[12.5px] text-steel">
            نتیجه: {faNumber(result.moved)} دانش‌آموز منتقل شد · {faNumber(result.graduated)} فارغ‌التحصیل · {faNumber(result.createdClasses)} کلاس جدید ساخته شد
          </span>
        )}
      </div>

      {data && classes.length === 0 && <EmptyState icon={CalendarSync} title="برای این سال کلاسی نیست" />}
      <div className="flex flex-col gap-2 b-auto-stagger">
        {classes.map((c) => {
          const p = planOf(c);
          return (
            <div key={c.id} className="b-card-sm p-4 grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center">
              <span><b className="text-[13.5px]">{c.name}</b><span className="block text-[11.5px] text-steel">پایهٔ {c.grade} · {faNumber(c._count.students)} دانش‌آموز فعال</span></span>
              <input className="b-input" value={p.toName} disabled={p.graduate} onChange={(e) => setPlan(c.id, { toName: e.target.value }, c)} placeholder="نام کلاس سال بعد" />
              <input className="b-input" value={p.toGrade} disabled={p.graduate} onChange={(e) => setPlan(c.id, { toGrade: e.target.value }, c)} placeholder="پایهٔ سال بعد" />
              <button className={`b-badge ${p.graduate ? "b-badge-blossom" : "b-badge-neutral"}`} onClick={() => setPlan(c.id, { graduate: !p.graduate }, c)}>
                {p.graduate ? <><GraduationCap className="w-3.5 h-3.5" /> فارغ‌التحصیل می‌شود</> : <><ArrowUpCircle className="w-3.5 h-3.5" /> ارتقا به سال بعد</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
