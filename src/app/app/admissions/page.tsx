"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Loader2, Phone, ArrowLeft, GraduationCap, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Lead = {
  id: string; name: string; parentName: string | null; phone: string;
  grade: string | null; message: string | null; status: string;
  note: string | null; convertedStudentId: string | null; createdAt: string;
};
type ClassRow = { id: string; name: string; academicYear: string };

const STAGES: { key: string; label: string; cls: string }[] = [
  { key: "NEW", label: "جدید", cls: "b-badge-soft" },
  { key: "CONTACTED", label: "تماس گرفته شد", cls: "b-badge-neutral" },
  { key: "TOUR", label: "بازدید مدرسه", cls: "b-badge-neutral" },
  { key: "WAITLIST", label: "لیست انتظار", cls: "b-badge-neutral" },
  { key: "ADMITTED", label: "پذیرفته‌شده", cls: "b-badge-spring" },
  { key: "ENROLLED", label: "ثبت‌نام‌شده", cls: "b-badge-spring" },
  { key: "ARCHIVED", label: "بایگانی", cls: "b-badge-blossom" },
];
const NEXT: Record<string, string> = {
  NEW: "CONTACTED", CONTACTED: "TOUR", TOUR: "ADMITTED", WAITLIST: "ADMITTED", ADMITTED: "ENROLLED",
};

export default function AdmissionsPage() {
  const { data, loading, error, refetch } = useApi<{ leads: Lead[]; counts: Record<string, number> }>("/api/admissions");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const [converting, setConverting] = useState<Lead | null>(null);
  const [form, setForm] = useState({ nationalId: "", firstName: "", lastName: "", classId: "" });
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ tempPassword: string } | null>(null);

  async function move(lead: Lead, status: string) {
    setBusy(lead.id + status);
    try {
      await apiPost("/api/admissions", { action: "status", id: lead.id, status });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function convert(e: React.FormEvent) {
    e.preventDefault();
    if (!converting) return;
    setBusy("convert");
    try {
      const r = await apiPost<{ tempPassword: string }>("/api/admissions", { action: "convert", id: converting.id, ...form });
      setResult(r);
      toast.success("دانش‌آموز ساخته شد.");
      setConverting(null);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  const leads = data?.leads ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="قیف پذیرش و ثبت‌نام" desc="از اولین تماس تا ثبت‌نام نهایی — هیچ متقاضی‌ای گم نمی‌شود." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {result && (
        <div className="rounded-xl bg-spring-tint border border-spring/30 p-4 text-[13px] flex items-center justify-between gap-3 flex-wrap">
          <span>دانش‌آموز جدید ساخته شد. رمز موقت ورود: <b dir="ltr" className="font-mono">{result.tempPassword}</b> — به ولی تحویل دهید (در اولین ورود باید عوض شود).</span>
          <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setResult(null)}>بستن</button>
        </div>
      )}
      {data && leads.length === 0 && <EmptyState icon={UserPlus} title="هنوز متقاضی‌ای ثبت نشده" desc="فرم پیش‌ثبت‌نام سایت مدرسه، لیدها را همین‌جا می‌آورد." />}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {STAGES.map((stage) => {
          const items = leads.filter((l) => l.status === stage.key || (stage.key === "ENROLLED" && l.status === "REGISTERED"));
          return (
            <div key={stage.key} className="b-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <b className="text-[13.5px]">{stage.label}</b>
                <span className={`b-badge ${stage.cls}`}>{faNumber(items.length)}</span>
              </div>
              {items.map((l) => (
                <div key={l.id} className="rounded-xl border border-hairline p-3 flex flex-col gap-1.5 text-[12.5px]">
                  <span className="flex items-start justify-between gap-2"><b>{l.name}</b><button className="text-stone hover:text-destructive shrink-0" aria-label="حذف سرنخ" onClick={async () => { if (!window.confirm(`سرنخ «${l.name}» حذف شود؟`)) return; try { await apiDelete(`/api/admissions?id=${l.id}`); toast.success("حذف شد."); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}><Trash2 className="w-3.5 h-3.5" /></button></span>
                  <span className="text-steel flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> <span dir="ltr">{l.phone}</span>{l.parentName ? ` · ولی: ${l.parentName}` : ""}</span>
                  <span className="text-steel">{l.grade ? `پایهٔ ${l.grade} · ` : ""}{formatDateFa(l.createdAt)}</span>
                  {l.message && <p className="text-steel line-clamp-2">{l.message}</p>}
                  <span className="flex gap-1.5 mt-1 flex-wrap">
                    {NEXT[l.status] && l.status !== "ADMITTED" && (
                      <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === l.id + NEXT[l.status]} onClick={() => move(l, NEXT[l.status])}>
                        <ArrowLeft className="w-3.5 h-3.5" /> مرحلهٔ بعد
                      </button>
                    )}
                    {l.status === "ADMITTED" && !l.convertedStudentId && (
                      <button className="b-btn b-btn-spring b-btn-sm" onClick={() => {
                        setConverting(l);
                        const parts = l.name.trim().split(/\s+/);
                        setForm({ nationalId: "", firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") ?? "", classId: "" });
                      }}>
                        <GraduationCap className="w-3.5 h-3.5" /> تبدیل به دانش‌آموز
                      </button>
                    )}
                    {(l.status === "CONTACTED" || l.status === "TOUR") && (
                      <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => move(l, "WAITLIST")}>لیست انتظار</button>
                    )}
                    {l.status !== "ARCHIVED" && l.status !== "ENROLLED" && (
                      <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => move(l, "ARCHIVED")}>بایگانی</button>
                    )}
                  </span>
                </div>
              ))}
              {items.length === 0 && <p className="text-[11.5px] text-steel">خالی</p>}
            </div>
          );
        })}
      </div>

      {converting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={() => setConverting(null)}>
          <form onSubmit={convert} className="b-card p-6 w-full max-w-md flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <b className="text-[15px]">تبدیل «{converting.name}» به دانش‌آموز</b>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کد ملی دانش‌آموز *</span>
              <input className="b-input" dir="ltr" inputMode="numeric" value={form.nationalId} onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))} required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">نام *</span>
                <input className="b-input" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">نام خانوادگی *</span>
                <input className="b-input" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required /></label>
            </div>
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس</span>
              <Select className="w-full" buttonClassName="!w-full" value={form.classId} onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
                options={[{ value: "", label: "بدون کلاس (بعداً)" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" /></label>
            <div className="flex gap-2 justify-end">
              <button type="button" className="b-btn b-btn-ghost" onClick={() => setConverting(null)}>لغو</button>
              <button className="b-btn b-btn-spring" disabled={busy === "convert"}>
                {busy === "convert" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />} ساخت دانش‌آموز
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
