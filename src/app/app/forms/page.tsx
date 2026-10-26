"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, Trash2, Lock, LockOpen, X } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };
type FormRow = {
  id: string; title: string; description: string | null; audience: string; status: string;
  deadline: string | null; createdAt: string; fields: Field[];
  _count?: { submissions: number }; submittedStudentIds?: string[];
};
type Data = { staff: boolean; forms: FormRow[]; myStudentIds?: string[] };

type DraftField = { label: string; type: string; required: boolean; options: string };
const TYPE_OPTIONS = [
  { value: "text", label: "متن کوتاه" },
  { value: "textarea", label: "متن بلند" },
  { value: "select", label: "انتخاب از فهرست" },
  { value: "checkbox", label: "تأیید (بله/خیر)" },
  { value: "number", label: "عدد" },
];

export default function FormsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [audience, setAudience] = useState("PARENTS");
  const [deadline, setDeadline] = useState("");
  const [fields, setFields] = useState<DraftField[]>([{ label: "", type: "text", required: true, options: "" }]);

  const load = useCallback(() => { apiGet<Data>("/api/forms").then(setData).catch(() => setData({ staff: false, forms: [] })); }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const clean = fields.filter((f) => f.label.trim());
    if (!title.trim()) { toast.error("عنوان فرم را بنویسید."); return; }
    if (!clean.length) { toast.error("حداقل یک فیلد لازم است."); return; }
    setBusy("create");
    try {
      await apiPost("/api/forms", {
        title, description: desc || undefined, audience,
        deadline: deadline || undefined,
        fields: clean.map((f, i) => ({
          key: `f${i + 1}`,
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          options: f.type === "select" ? f.options.split("\n").map((o) => o.trim()).filter(Boolean) : undefined,
        })),
      });
      toast.success("فرم ساخته و منتشر شد.");
      setOpen(false); setTitle(""); setDesc(""); setDeadline("");
      setFields([{ label: "", type: "text", required: true, options: "" }]);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  async function toggle(f: FormRow) {
    setBusy(f.id);
    try { await apiPatch("/api/forms", { id: f.id, status: f.status === "OPEN" ? "CLOSED" : "OPEN" }); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  async function remove(f: FormRow) {
    if (!confirm(`فرم «${f.title}» و همهٔ پاسخ‌هایش حذف شود؟`)) return;
    setBusy(f.id);
    try { await apiDelete(`/api/forms?id=${encodeURIComponent(f.id)}`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label="فرم‌ها…" />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="فرم‌ها و رضایت‌نامه‌ها"
        desc={data.staff ? "فرم آنلاین بسازید — رضایت‌نامه اردو، ثبت‌نام، نظرسنجی — و پاسخ‌ها را یکجا ببینید." : "فرم‌هایی که باید تکمیل کنید."}
        action={data.staff ? <button className="b-btn b-btn-spring" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> فرم جدید</button> : undefined}
      />
      {data.forms.length === 0
        ? <EmptyState icon={ClipboardList} title="فرمی نیست" desc={data.staff ? "اولین فرم را بسازید." : "فرم بازی برای شما وجود ندارد."} />
        : <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
            {data.forms.map((f) => (
              <div key={f.id} className="b-card b-card-hover p-5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <b className="text-[15px]">{f.title}</b>
                  <span className={`b-badge ${f.status === "OPEN" ? "b-badge-spring" : "b-badge-neutral"}`}>{f.status === "OPEN" ? "باز" : "بسته"}</span>
                </div>
                {f.description && <p className="t-sm text-steel line-clamp-2">{f.description}</p>}
                <p className="t-cap text-steel">
                  مخاطب: {f.audience === "PARENTS" ? "اولیا" : f.audience === "STUDENTS" ? "دانش‌آموزان" : "همه"}
                  {f.deadline ? ` · مهلت: ${f.deadline}` : ""}
                  {data.staff ? ` · ${faNumber(f._count?.submissions ?? 0)} پاسخ` : ""}
                  {!data.staff && f.submittedStudentIds ? ` · تکمیل‌شده برای ${faNumber(f.submittedStudentIds.length)} نفر` : ""}
                </p>
                <div className="flex gap-2 mt-1">
                  <Link className="b-btn b-btn-soft b-btn-sm" href={`/app/forms/${f.id}`}>{data.staff ? "پاسخ‌ها و جزئیات" : "تکمیل فرم"}</Link>
                  {data.staff && (
                    <>
                      <button className="b-btn b-btn-ghost b-btn-sm" disabled={busy === f.id} onClick={() => toggle(f)}>
                        {f.status === "OPEN" ? <><Lock className="w-3.5 h-3.5" /> بستن</> : <><LockOpen className="w-3.5 h-3.5" /> بازکردن</>}
                      </button>
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === f.id} onClick={() => remove(f)}><Trash2 className="w-3.5 h-3.5" /> حذف</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="b-card w-full max-w-xl p-6 flex flex-col gap-3 max-h-[92vh] overflow-y-auto b-scroll" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">فرم جدید</h3>
            <input className="b-input" placeholder="عنوان (مثلاً رضایت‌نامه اردوی علمی)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="b-input !min-h-[70px]" placeholder="توضیح (اختیاری)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={audience} onChange={setAudience} options={[{ value: "PARENTS", label: "اولیا" }, { value: "STUDENTS", label: "دانش‌آموزان" }, { value: "ALL", label: "همه" }]} ariaLabel="مخاطب" />
              <input className="b-input" placeholder="مهلت (شمسی، اختیاری)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <b className="text-[13px]">فیلدها</b>
              {fields.map((f, i) => (
                <div key={i} className="b-card-sm !rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input className="b-input flex-1" placeholder="عنوان فیلد (مثلاً نام و نام خانوادگی ولی)" value={f.label} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <button className="text-destructive shrink-0" onClick={() => setFields(fields.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-44">
                      <Select value={f.type} onChange={(v) => setFields(fields.map((x, j) => j === i ? { ...x, type: v } : x))} options={TYPE_OPTIONS} ariaLabel="نوع فیلد" />
                    </div>
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="checkbox" checked={f.required} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> الزامی
                    </label>
                  </div>
                  {f.type === "select" && (
                    <textarea className="b-input !min-h-[56px]" placeholder="گزینه‌ها — هر گزینه در یک سطر" value={f.options} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} />
                  )}
                </div>
              ))}
              <button className="b-btn b-btn-ghost b-btn-sm w-fit" onClick={() => setFields([...fields, { label: "", type: "text", required: false, options: "" }])}><Plus className="w-3.5 h-3.5" /> فیلد دیگر</button>
            </div>
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "create"} onClick={create}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : "انتشار فرم"}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setOpen(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
