"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, NotebookPen, CalendarClock, Pencil, Check, X } from "lucide-react";
import { useApi, apiPost, apiDelete, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Assignment = {
  id: string; title: string; description: string; dueDate: string; createdAt: string;
  class: { id: string; name: string } | null; subject: { id: string; name: string } | null;
  teacher: { firstName: string; lastName: string } | null;
};
type ClassRow = { id: string; name: string };
type SubjectRow = { id: string; name: string };
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };

export default function AssignmentsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه
  const canCreate = me?.user.role === "MANAGER" || (Boolean(me?.user.actingSchool) && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_assignments"));
  const confirm = useConfirm();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ classId: "", subjectId: "", title: "", description: "", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const mine = me?.user.role === "TEACHER";
  const { data, loading, error, refetch } = useApi<{ assignments: Assignment[] }>(mine ? "/api/assignments?mine=1" : "/api/assignments");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(canCreate ? "/api/classes" : null);
  const { data: subjectsData } = useApi<{ subjects: SubjectRow[] }>(canCreate ? "/api/subjects" : null);

  const now = Date.now();
  const upcoming = useMemo(() => (data?.assignments ?? []).filter((a) => new Date(a.dueDate).getTime() >= now), [data, now]);
  const past = useMemo(() => (data?.assignments ?? []).filter((a) => new Date(a.dueDate).getTime() < now), [data, now]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/assignments", form);
      toast.success("تکلیف ایجاد شد.");
      setShow(false);
      setForm({ classId: "", subjectId: "", title: "", description: "", dueDate: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Assignment) {
    if (!(await confirm({ title: "حذف تکلیف", description: `تکلیف «${a.title}» حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/assignments/${a.id}`);
      toast.success("حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  // ---------- ویرایش تکلیف ----------
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", dueDate: "" });
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(a: Assignment) {
    setEditId(a.id);
    setEditForm({ title: a.title, description: a.description, dueDate: a.dueDate.slice(0, 10) });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    try {
      await apiPatch(`/api/assignments/${editId}`, editForm);
      toast.success("تکلیف ویرایش شد.");
      setEditId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setEditSaving(false);
    }
  }

  function Card({ a }: { a: Assignment }) {
    const overdue = new Date(a.dueDate).getTime() < now;
    return (
      <div className="b-card-md p-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <b className="text-[15px]">{a.title}</b>
          <span className={`b-badge ${overdue ? "b-badge-neutral" : "b-badge-spring"} shrink-0`}>
            <CalendarClock className="w-3 h-3" /> {formatDateFa(a.dueDate)}
          </span>
        </div>
        <p className="t-sm text-steel leading-relaxed line-clamp-4">{a.description}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-steel">
            {a.class?.name ?? "—"} {a.subject ? `· ${a.subject.name}` : ""} {a.teacher ? `· ${a.teacher.firstName} ${a.teacher.lastName}` : ""}
          </span>
          {canCreate && (
            <span className="flex items-center gap-1 shrink-0">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:text-spring hover:bg-spring-tint" onClick={() => openEdit(a)} aria-label="ویرایش">
                <Pencil className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10" onClick={() => remove(a)} aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تکالیف"
        desc={canCreate ? "ایجاد تکلیف برای کلاس‌ها با مهلت مشخص." : "تکالیف کلاس شما با مهلت‌ها."}
        action={
          canCreate && (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShow(true)}>
              <Plus className="w-4 h-4" /> تکلیف جدید
            </button>
          )
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.assignments.length === 0 && <EmptyState icon={NotebookPen} title="تکلیفی ثبت نشده" />}

      {upcoming.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3">پیش‌رو ({faNumber(upcoming.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4">{upcoming.map((a) => <Card key={a.id} a={a} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3 text-steel">پایان‌یافته ({faNumber(past.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4 opacity-70">{past.map((a) => <Card key={a.id} a={a} />)}</div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setShow(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-6">تکلیف جدید</h2>
            <form onSubmit={create} className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">کلاس *</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.classId}
                  onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
                  options={[{ value: "", label: "—" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                  placeholder="—"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">درس</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.subjectId}
                  onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                  options={[{ value: "", label: "عمومی" }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                  placeholder="عمومی"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">عنوان *</span>
                <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="مثلاً تمرین‌های فصل ۲" />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">توضیحات *</span>
                <textarea className="b-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required rows={4} placeholder="برای هماهنگی گروهی می‌توانید از پیام‌رسان شاد استفاده کنید." />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">مهلت *</span>
                <input className="b-input" dir="ltr" type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ایجاد تکلیف"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShow(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* دیالوگ ویرایش تکلیف */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !editSaving && setEditId(null)} aria-hidden />
          <form onSubmit={saveEdit} className="relative b-card p-6 w-full max-w-lg b-pop">
            <h2 className="font-bold text-lg mb-4">ویرایش تکلیف</h2>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">عنوان *</span>
                <input className="b-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required minLength={2} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">توضیحات *</span>
                <textarea className="b-input min-h-24" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">مهلت *</span>
                <input className="b-input" dir="ltr" type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} required />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" className="b-btn b-btn-ghost b-btn-sm" onClick={() => setEditId(null)} disabled={editSaving}><X className="w-4 h-4" /> انصراف</button>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm" disabled={editSaving}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} ذخیره
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
