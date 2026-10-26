"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, School, Loader2, Trash2, Users, BookOpen } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { useApi as useApi2 } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";

type ClassRow = {
  id: string;
  name: string;
  grade: string;
  field: string | null;
  academicYear: string;
  capacity: number;
  roomNumber: string | null;
  homeroomTeacherId: string | null;
  homeroomTeacher: { id: string; firstName: string; lastName: string } | null;
  _count: { students: number; teachingAssignments: number; scheduleSlots: number };
};
type TeacherRow = { id: string; firstName: string; lastName: string };
type TeachingRow = {
  id: string;
  teacher: { id: string; firstName: string; lastName: string };
  class: { id: string; name: string };
  subject: { id: string; name: string };
};
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };

const empty = { name: "", grade: "دهم", field: "", academicYear: "1404-1405", capacity: "28", roomNumber: "", homeroomTeacherId: "" };

export default function ClassesPage() {
  const confirm = useConfirm();
  const { data: me } = useApi2<Me>("/api/auth/me");
  const { data, loading, error, refetch } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: teachersData } = useApi<{ users: TeacherRow[] }>("/api/users?role=TEACHER");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [manage, setManage] = useState<ClassRow | null>(null);
  const [assignForm, setAssignForm] = useState({ teacherId: "", subjectId: "" });
  const { data: subjectsData } = useApi<{ subjects: Array<{ id: string; name: string }> }>(manage ? "/api/subjects" : null);
  const { data: teachingData, refetch: refetchTeaching } = useApi<{ assignments: TeachingRow[] }>(
    manage ? `/api/teaching?classId=${manage.id}` : null
  );

  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه
  const inPanel = Boolean(me?.user.actingSchool);
  const canManage = me?.user.role === "MANAGER" || (inPanel && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_classes"));
  const teachers = teachersData?.users ?? [];

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/api/classes/${editing.id}`, { ...form, capacity: Number(form.capacity) });
        toast.success("کلاس ویرایش شد.");
        setEditing(null);
      } else {
        await apiPost("/api/classes", { ...form, capacity: Number(form.capacity) });
        toast.success("کلاس ساخته شد.");
        setShowCreate(false);
      }
      setForm(empty);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function archive(c: ClassRow) {
    if (!(await confirm({ title: "بایگانی کلاس", description: `کلاس «${c.name}» بایگانی شود؟`, confirmLabel: "بایگانی", danger: true }))) return;
    try {
      await apiDelete(`/api/classes/${c.id}`);
      toast.success("کلاس بایگانی شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function assignTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!manage) return;
    try {
      await apiPost("/api/teaching", { ...assignForm, classId: manage.id });
      toast.success("معلم به درس تخصیص یافت.");
      setAssignForm({ teacherId: "", subjectId: "" });
      refetchTeaching();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function removeAssignment(id: string) {
    try {
      await apiDelete(`/api/teaching/${id}`);
      toast.success("تخصیص حذف شد.");
      refetchTeaching();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  const totalStudents = data?.classes.reduce((s, c) => s + c._count.students, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="کلاس‌ها"
        desc="مدیریت پایه‌ها، رشته‌ها، معلم مشاور و تخصیص معلمان به درس‌ها."
        action={
          canManage && (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => { setShowCreate(true); setEditing(null); setForm(empty); }}>
              <Plus className="w-4 h-4" /> کلاس جدید
            </button>
          )
        }
      />

      {/* راند ۱۹: در موبایل تک‌ستونه — قبلاً ۳ ستونِ ۱۱۹px برچسب‌ها را نامرئی می‌کرد */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={School} label="کلاس" value={data?.classes.length ?? 0} tone="spring" />
        <StatCard icon={Users} label="دانش‌آموز" value={totalStudents} tone="ink" />
        <StatCard icon={BookOpen} label="تخصیص معلم-درس" value={data?.classes.reduce((s, c) => s + c._count.teachingAssignments, 0) ?? 0} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.classes.length === 0 && (
        <EmptyState icon={School} title="کلاسی ثبت نشده" desc="اولین کلاس مدرسه را بسازید." />
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {(data?.classes ?? []).map((c) => (
          <div key={c.id} className="b-card-md p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-full bg-spring text-primary-foreground flex items-center justify-center font-bold text-[13px] shrink-0">
                  {c.grade}
                </span>
                <div className="min-w-0">
                  <b className="text-[15px] block truncate">{c.name}</b>
                  <span className="text-[11.5px] text-steel">{c.field ?? "عمومی"} · {c.academicYear}</span>
                </div>
              </div>
              {c.roomNumber && <span className="b-badge b-badge-neutral">اتاق {faNumber(c.roomNumber)}</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.students)}</div>
                <div className="text-[10.5px] text-steel">دانش‌آموز / {faNumber(c.capacity)}</div>
              </div>
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.teachingAssignments)}</div>
                <div className="text-[10.5px] text-steel">درس فعال</div>
              </div>
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.scheduleSlots)}</div>
                <div className="text-[10.5px] text-steel">زنگ هفتگی</div>
              </div>
            </div>

            <p className="t-sm text-steel">
              مشاور: <b className="text-ink">{c.homeroomTeacher ? `${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}` : "—"}</b>
            </p>

            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  className="b-btn b-btn-soft b-btn-sm flex-1"
                  onClick={() => { setEditing(c); setForm({ name: c.name, grade: c.grade, field: c.field ?? "", academicYear: c.academicYear, capacity: String(c.capacity), roomNumber: c.roomNumber ?? "", homeroomTeacherId: c.homeroomTeacherId ?? "" }); }}
                >
                  <Pencil className="w-3.5 h-3.5" /> ویرایش
                </button>
                <button className="b-btn b-btn-ghost b-btn-sm flex-1" onClick={() => setManage(c)}>
                  <BookOpen className="w-3.5 h-3.5" /> معلم‌ها
                </button>
                <button className="b-btn b-btn-ghost !p-0 w-9 h-9 !min-h-9" onClick={() => archive(c)} aria-label="بایگانی">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(showCreate || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => { setShowCreate(false); setEditing(null); }} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl b-pop">
            <h2 className="font-bold text-lg mb-6">{editing ? `ویرایش ${editing.name}` : "کلاس جدید"}</h2>
            <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">نام کلاس *</span>
                <input className="b-input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="مثلاً دهم ریاضی ۱" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">پایه *</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.grade}
                  onChange={(v) => set("grade", v)}
                  options={getCountrySync().gradeLevels.map((g) => ({ value: g, label: g }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">رشته</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.field}
                  onChange={(v) => set("field", v)}
                  options={getCountrySync().fields.map((f) => ({ value: f === "عمومی" ? "" : f, label: f }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">سال تحصیلی *</span>
                <input className="b-input" dir="ltr" value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">ظرفیت</span>
                <input className="b-input" dir="ltr" inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">شماره اتاق</span>
                <input className="b-input" value={form.roomNumber} onChange={(e) => set("roomNumber", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">معلم مشاور</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.homeroomTeacherId}
                  onChange={(v) => set("homeroomTeacherId", v)}
                  options={[{ value: "", label: "— بدون مشاور —" }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
                  placeholder="— بدون مشاور —"
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "ذخیره" : "ایجاد کلاس"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => { setShowCreate(false); setEditing(null); }}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setManage(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">معلمان کلاس {manage.name}</h2>
            <p className="t-sm text-steel mb-6">تخصیص معلم به هر درس؛ معلم موجود جایگزین می‌شود.</p>

            <form onSubmit={assignTeacher} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">درس</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={assignForm.subjectId}
                  onChange={(v) => setAssignForm((f) => ({ ...f, subjectId: v }))}
                  options={[{ value: "", label: "—" }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                  placeholder="—"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">معلم</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={assignForm.teacherId}
                  onChange={(v) => setAssignForm((f) => ({ ...f, teacherId: v }))}
                  options={[{ value: "", label: "—" }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
                  placeholder="—"
                />
              </label>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm">تخصیص</button>
            </form>

            <div className="mt-6 flex flex-col gap-2.5">
              {(teachingData?.assignments ?? []).map((a) => (
                <div key={a.id} className="b-card-sm !rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <b className="text-[13px]">{a.subject.name}</b>
                    <span className="text-[11.5px] text-steel">{a.teacher.firstName} {a.teacher.lastName}</span>
                  </span>
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeAssignment(a.id)}
                    aria-label="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {teachingData && teachingData.assignments.length === 0 && (
                <p className="t-sm text-steel">تخصیصی ثبت نشده است.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
