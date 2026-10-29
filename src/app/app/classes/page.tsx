"use client";

import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
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
        toast.success(t("classes.toast.edited"));
        setEditing(null);
      } else {
        await apiPost("/api/classes", { ...form, capacity: Number(form.capacity) });
        toast.success(t("classes.toast.created"));
        setShowCreate(false);
      }
      setForm(empty);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  async function archive(c: ClassRow) {
    if (!(await confirm({ title: t("classes.archive.title"), description: `${t("classes.archive.descStart")} «${c.name}» ${t("classes.archive.descEnd")}`, confirmLabel: t("classes.archive.confirm"), danger: true }))) return;
    try {
      await apiDelete(`/api/classes/${c.id}`);
      toast.success(t("classes.toast.archived"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function assignTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!manage) return;
    try {
      await apiPost("/api/teaching", { ...assignForm, classId: manage.id });
      toast.success(t("classes.toast.teacherAssigned"));
      setAssignForm({ teacherId: "", subjectId: "" });
      refetchTeaching();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function removeAssignment(id: string) {
    try {
      await apiDelete(`/api/teaching/${id}`);
      toast.success(t("classes.toast.assignmentRemoved"));
      refetchTeaching();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  const totalStudents = data?.classes.reduce((s, c) => s + c._count.students, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.classes")}
        desc={t("classes.desc")}
        action={
          canManage && (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => { setShowCreate(true); setEditing(null); setForm(empty); }}>
              <Plus className="w-4 h-4" /> {t("classes.new")}
            </button>
          )
        }
      />

      {/* راند ۱۹: در موبایل تک‌ستونه — قبلاً ۳ ستونِ ۱۱۹px برچسب‌ها را نامرئی می‌کرد */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={School} label={t("common.class")} value={data?.classes.length ?? 0} tone="spring" />
        <StatCard icon={Users} label={t("common.student")} value={totalStudents} tone="ink" />
        <StatCard icon={BookOpen} label={t("classes.stat.teacherSubjectAssignments")} value={data?.classes.reduce((s, c) => s + c._count.teachingAssignments, 0) ?? 0} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.classes.length === 0 && (
        <EmptyState icon={School} title={t("classes.empty.noClass")} desc={t("classes.empty.createFirst")} />
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
                  <span className="text-[11.5px] text-steel">{c.field ?? t("settings.general")} · {c.academicYear}</span>
                </div>
              </div>
              {c.roomNumber && <span className="b-badge b-badge-neutral">{t("classes.room")} {faNumber(c.roomNumber)}</span>}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.students)}</div>
                <div className="text-[10.5px] text-steel">{t("common.student")} / {faNumber(c.capacity)}</div>
              </div>
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.teachingAssignments)}</div>
                <div className="text-[10.5px] text-steel">{t("classes.activeSubjects")}</div>
              </div>
              <div className="b-card-sm !rounded-xl p-2.5">
                <div className="font-bold text-[15px]">{faNumber(c._count.scheduleSlots)}</div>
                <div className="text-[10.5px] text-steel">{t("classes.weeklyPeriods")}</div>
              </div>
            </div>

            <p className="t-sm text-steel">
              {t("classes.homeroom")} <b className="text-ink">{c.homeroomTeacher ? `${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}` : "—"}</b>
            </p>

            {canManage && (
              <div className="flex items-center gap-2">
                <button
                  className="b-btn b-btn-soft b-btn-sm flex-1"
                  onClick={() => { setEditing(c); setForm({ name: c.name, grade: c.grade, field: c.field ?? "", academicYear: c.academicYear, capacity: String(c.capacity), roomNumber: c.roomNumber ?? "", homeroomTeacherId: c.homeroomTeacherId ?? "" }); }}
                >
                  <Pencil className="w-3.5 h-3.5" /> {t("common.edit")}
                </button>
                <button className="b-btn b-btn-ghost b-btn-sm flex-1" onClick={() => setManage(c)}>
                  <BookOpen className="w-3.5 h-3.5" /> {t("classes.teachers")}
                </button>
                <button className="b-btn b-btn-ghost !p-0 w-9 h-9 !min-h-9" onClick={() => archive(c)} aria-label={t("classes.archive.confirm")}>
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
            <h2 className="font-bold text-lg mb-6">{editing ? `${t("common.edit")} ${editing.name}` : t("classes.new")}</h2>
            <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">{t("classes.field.className")}</span>
                <input className="b-input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder={t("classes.placeholder.className")} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.grade")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.grade}
                  onChange={(v) => set("grade", v)}
                  options={getCountrySync().gradeLevels.map((g) => ({ value: g, label: g }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.field")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.field}
                  onChange={(v) => set("field", v)}
                  options={getCountrySync().fields.map((f) => ({ value: f === "عمومی" ? "" : f, label: f }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.academicYear")}</span>
                <input className="b-input" dir="ltr" value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.capacity")}</span>
                <input className="b-input" dir="ltr" inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.roomNumber")}</span>
                <input className="b-input" value={form.roomNumber} onChange={(e) => set("roomNumber", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("classes.field.homeroomTeacher")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.homeroomTeacherId}
                  onChange={(v) => set("homeroomTeacherId", v)}
                  options={[{ value: "", label: t("classes.noHomeroom") }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
                  placeholder={t("classes.noHomeroom")}
                />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? t("common.save") : t("classes.createClass")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => { setShowCreate(false); setEditing(null); }}>{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setManage(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("classes.manageTitle")} {manage.name}</h2>
            <p className="t-sm text-steel mb-6">{t("classes.manageDesc")}</p>

            <form onSubmit={assignTeacher} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("classes.assign.subject")}</span>
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
                <span className="text-[12px] font-bold">{t("common.teacher")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={assignForm.teacherId}
                  onChange={(v) => setAssignForm((f) => ({ ...f, teacherId: v }))}
                  options={[{ value: "", label: "—" }, ...teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
                  placeholder="—"
                />
              </label>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm">{t("classes.assign.submit")}</button>
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
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {teachingData && teachingData.assignments.length === 0 && (
                <p className="t-sm text-steel">{t("classes.empty.noAssignment")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
