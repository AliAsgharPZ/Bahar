"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Plus, Loader2, CheckCircle2, Ban, Trash2, Search, Printer, Pencil } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { JalaliDateInput } from "@/components/shared/jalali-date-input";
import { Select, useConfirm } from "@/components/shared/pickers";
import { currencyLabel } from "@/lib/persian";
import { formatDateFa, faNumber, enDigits } from "@/lib/persian";
import { esc } from "@/lib/print-esc";

type Fee = {
  id: string;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  note: string | null;
  student?: { id: string; studentNumber: string; user: { firstName: string; lastName: string; nationalId: string }; class: { name: string } | null };
};

type FinanceData = {
  scope: string;
  fees: Fee[];
  summary?: { unpaid: number; unpaidAmount: number; paid: number; paidAmount: number; waived: number };
};


const STATUS_LABELS: Record<string, string> = { UNPAID: "پرداخت‌نشده", PAID: "پرداخت‌شده", WAIVED: "معاف" };

export default function FinancePage() {
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", target: "class", classId: "", studentId: "", note: "" });
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const url = `/api/finance${status ? `?status=${status}` : ""}`;
  const { data, loading, error, refetch } = useApi<FinanceData>(url, [status]);
  const { data: classesData } = useApi<{ classes: Array<{ id: string; name: string }> }>(
    data?.scope === "manager" ? "/api/classes" : null
  );
  const { data: studentsData } = useApi<{ students: Array<{ id: string; user: { firstName: string; lastName: string } }> }>(
    data?.scope === "manager" ? "/api/students" : null
  );

  const canManage = data?.scope === "manager";
  const isStudent = data?.scope === "student" || data?.scope === "parent";

  const fees = (data?.fees ?? []).filter((f) =>
    !q || f.title.includes(q) || (f.student && `${f.student.user.firstName} ${f.student.user.lastName}`.includes(q))
  );

  async function createFee(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/finance", {
        title: form.title,
        amount: Number(enDigits(form.amount.replace(/,/g, ""))),
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        classId: form.target === "class" ? form.classId : undefined,
        studentId: form.target === "student" ? form.studentId : undefined,
        note: form.note || undefined,
      });
      toast.success("قلم مالی ثبت شد.");
      setShowCreate(false);
      setForm({ title: "", amount: "", target: "class", classId: "", studentId: "", note: "" });
      setDueDate(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(f: Fee, newStatus: string) {
    try {
      await apiPatch("/api/finance", { id: f.id, status: newStatus });
      toast.success("وضعیت به‌روزرسانی شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function remove(f: Fee) {
    if (!(await confirm({ title: "حذف شهریه", description: `«${f.title}» حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/finance?id=${f.id}`);
      toast.success("حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }
  // ---------- ویرایش قلم مالی ----------
  const [editFee, setEditFee] = useState<Fee | null>(null);
  const [editForm, setEditForm] = useState({ title: "", amount: "", dueDate: "" });
  const [editSaving, setEditSaving] = useState(false);

  function openEditFee(f: Fee) {
    setEditFee(f);
    setEditForm({ title: f.title, amount: String(f.amount), dueDate: f.dueDate ? f.dueDate.slice(0, 10) : "" });
  }

  async function saveEditFee(e: React.FormEvent) {
    e.preventDefault();
    if (!editFee) return;
    setEditSaving(true);
    try {
      await apiPatch("/api/finance", {
        id: editFee.id,
        title: editForm.title,
        amount: Number(enDigits(editForm.amount).replace(/[,،]/g, "")),
        dueDate: editForm.dueDate || null,
      });
      toast.success("قلم مالی ویرایش شد.");
      setEditFee(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setEditSaving(false);
    }
  }

  /** رسید چاپی پرداخت */
  function printReceipt(f: Fee) {
    const w = window.open("", "_blank");
    if (!w) return;
    const student = f.student;
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>رسید پرداخت — ${esc(f.title)}</title>
    <style>
      @page { size: A5; margin: 10mm; }
      body { font-family: Vazirmatn, Tahoma, sans-serif; color: #000; }
      .rc { border: 2px solid #00825e; border-radius: 10px; padding: 10mm 12mm; max-width: 130mm; margin: 8mm auto; }
      h2 { color: #006749; text-align: center; font-size: 15pt; margin: 0 0 2mm; }
      .school { text-align: center; font-size: 10pt; color: #444; margin-bottom: 6mm; }
      table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
      td { padding: 2.2mm 0; border-bottom: 1px dashed #bbb; }
      td:last-child { text-align: left; font-weight: bold; }
      .amt { font-size: 13pt; color: #006749; }
      .ok { text-align: center; margin-top: 6mm; font-weight: bold; color: #00825e; }
    </style></head><body>
    <div class="rc">
      <h2>رسید پرداخت شهریه</h2>
      <div class="school">سامانه مدیریت مدرسه بهار</div>
      <table>
        <tr><td>عنوان</td><td>${esc(f.title)}</td></tr>
        ${student ? `<tr><td>دانش‌آموز</td><td>${esc(student.user.firstName)} ${esc(student.user.lastName)}</td></tr>
        <tr><td>کد ملی</td><td dir="ltr">${esc(student.user.nationalId)}</td></tr>
        <tr><td>کلاس</td><td>${esc(student.class?.name ?? "—")}</td></tr>` : ""}
        <tr><td>مبلغ</td><td class="amt">${faNumber(f.amount.toLocaleString("en-US"))} ${currencyLabel()}</td></tr>
        <tr><td>سرسید</td><td>${f.dueDate ? formatDateFa(f.dueDate) : "—"}</td></tr>
        <tr><td>وضعیت</td><td>${esc(STATUS_LABELS[f.status] ?? f.status)}</td></tr>
        ${f.paidAt ? `<tr><td>تاریخ پرداخت</td><td>${formatDateFa(f.paidAt)}</td></tr>` : ""}
        ${f.note ? `<tr><td>یادداشت</td><td>${esc(f.note)}</td></tr>` : ""}
        <tr><td>شماره رسید</td><td dir="ltr">${f.id.slice(-10).toUpperCase()}</td></tr>
      </table>
      ${f.status === "PAID" ? '<div class="ok">پرداخت تأیید شد — با تشکر</div>' : ""}
    </div>
    <script>setTimeout(() => window.print(), 300);</script>
    </body></html>`);
    w.document.close();
  }


  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="امور مالی" desc="شهریه و عوارض دانش‌آموزان." />
        <ErrorBox message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="امور مالی"
        desc={isStudent ? "شهریه و اقلام مالی شما." : "ثبت شهریه (تکی یا گروهی برای کل کلاس) و پیگیری پرداخت‌ها."}
        action={
          canManage ? (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> قلم مالی جدید
            </button>
          ) : undefined
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Wallet} label="پرداخت‌نشده" value={data.summary.unpaid} tone="blossom" />
          <StatCard icon={CheckCircle2} label={`مبلغ معوق (${currencyLabel()})`} value={faNumber(data.summary.unpaidAmount.toLocaleString("en-US"))} tone="ink" />
          <StatCard icon={CheckCircle2} label="پرداخت‌شده" value={data.summary.paid} tone="spring" />
          <StatCard icon={Wallet} label={`مبلغ دریافتی (${currencyLabel()})`} value={faNumber(data.summary.paidAmount.toLocaleString("en-US"))} tone="ink" />
          <StatCard icon={Ban} label="معاف" value={data.summary.waived} tone="soft" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="b-search-pill max-w-xs">
          <Search className="w-4 h-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی عنوان یا دانش‌آموز…" />
        </div>
        {["", "UNPAID", "PAID", "WAIVED"].map((st) => (
          <button key={st || "all"} className={`b-pill-tab ${status === st ? "b-pill-tab-active" : ""}`} onClick={() => setStatus(st)}>
            {st ? STATUS_LABELS[st] : "همه"}
          </button>
        ))}
      </div>

      {fees.length === 0 && !loading && (
        <EmptyState icon={Wallet} title="قلم مالی یافت نشد" desc={canManage ? "اولین شهریه یا عوارض را ثبت کنید." : "فعلاً موردی ثبت نشده است."} />
      )}

      {fees.length > 0 && (
        <div className="b-card-sm overflow-hidden">
          <div className="overflow-x-auto b-scroll">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-hairline-soft text-steel text-[11.5px]">
                  {data?.scope !== "student" && <th className="text-right py-3 px-4 font-bold">دانش‌آموز</th>}
                  <th className="text-right py-3 px-4 font-bold">عنوان</th>
                  <th className="text-right py-3 px-4 font-bold">مبلغ (${currencyLabel()})</th>
                  <th className="text-right py-3 px-4 font-bold hidden md:table-cell">سرسید</th>
                  <th className="text-right py-3 px-4 font-bold">وضعیت</th>
                  {canManage && <th className="text-right py-3 px-4 font-bold">عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="b-row border-b border-hairline-soft/60 last:border-0">
                    {data?.scope !== "student" && (
                      <td className="py-3 px-4">
                        {f.student ? (
                          <>
                            <b className="block truncate">{f.student.user.firstName} {f.student.user.lastName}</b>
                            <span className="text-[10.5px] text-steel">{f.student.class?.name ?? "بدون کلاس"}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4"><b className="truncate block max-w-[180px]">{f.title}</b></td>
                    <td className="py-3 px-4 font-bold">{faNumber(f.amount.toLocaleString("en-US"))}</td>
                    <td className="py-3 px-4 text-steel hidden md:table-cell text-[11.5px]">
                      {f.dueDate ? formatDateFa(f.dueDate) : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`b-badge ${f.status === "PAID" ? "b-badge-spring" : f.status === "WAIVED" ? "b-badge-neutral" : "b-badge-warning"}`}>
                        {STATUS_LABELS[f.status]}
                      </span>
                      {f.paidAt && <span className="text-[10px] text-stone block mt-0.5">{formatDateFa(f.paidAt)}</span>}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring" onClick={() => printReceipt(f)} title="رسید چاپی">
                            <Printer className="w-4 h-4" />
                          </button>
                          <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring" onClick={() => openEditFee(f)} title="ویرایش قلم">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {f.status !== "PAID" && (
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring" onClick={() => changeStatus(f, "PAID")} title="ثبت پرداخت">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {f.status === "UNPAID" && (
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-cloud" onClick={() => changeStatus(f, "WAIVED")} title="معاف">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive" onClick={() => remove(f)} title="حذف">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───── ساخت قلم مالی ───── */}
            {/* دیالوگ ویرایش قلم مالی */}
      {editFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !editSaving && setEditFee(null)} aria-hidden />
          <form onSubmit={saveEditFee} className="relative b-card p-6 w-full max-w-md b-pop">
            <h2 className="font-bold text-lg mb-4">ویرایش قلم مالی</h2>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">عنوان *</span>
                <input className="b-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required minLength={2} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">مبلغ (${currencyLabel()}) *</span>
                <input className="b-input" dir="ltr" inputMode="numeric" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">سرسید</span>
                {/* FIX (راند ۱۶): ویرایش هم مثل ایجاد از تقویم فعال — قبلاً میلادی بود */}
                <JalaliDateInput value={editForm.dueDate || null} onChange={(d) => setEditForm((f) => ({ ...f, dueDate: d ? d.toISOString() : "" }))} />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" className="b-btn b-btn-ghost b-btn-sm" onClick={() => setEditFee(null)} disabled={editSaving}>انصراف</button>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm" disabled={editSaving}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} ذخیره
              </button>
            </div>
          </form>
        </div>
      )}

{showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-lg b-pop">
            <h2 className="font-bold text-lg mb-1">قلم مالی جدید</h2>
            <p className="t-sm text-steel mb-6">می‌توانید برای یک دانش‌آموز یا همه دانش‌آموزان یک کلاس ثبت کنید.</p>
            <form onSubmit={createFee} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">عنوان *</span>
                <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="شهریه مهر ۱۴۰۵" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">مبلغ (${currencyLabel()}) *</span>
                <input className="b-input" dir="ltr" inputMode="numeric" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required placeholder="2500000" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">سرسید (شمسی)</span>
                <JalaliDateInput value={dueDate} onChange={setDueDate} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">هدف</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.target}
                    onChange={(v) => setForm((f) => ({ ...f, target: v }))}
                    options={[{ value: "class", label: "کل کلاس" }, { value: "student", label: "دانش‌آموز خاص" }]}
                  />
                </label>
                {form.target === "class" ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">کلاس *</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={form.classId}
                      onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
                      options={[{ value: "", label: "— انتخاب کلاس —" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                      placeholder="— انتخاب کلاس —"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">دانش‌آموز *</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={form.studentId}
                      onChange={(v) => setForm((f) => ({ ...f, studentId: v }))}
                      options={[{ value: "", label: "— انتخاب دانش‌آموز —" }, ...(studentsData?.students ?? []).map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}` }))]}
                      placeholder="— انتخاب دانش‌آموز —"
                    />
                  </label>
                )}
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">یادداشت</span>
                <input className="b-input" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
