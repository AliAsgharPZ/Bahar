"use client";

import { useLang } from "@/lib/i18n";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, NotebookPen, CalendarClock, Pencil, Check, X, Send, ReceiptText, UserCheck } from "lucide-react";
import { useApi, apiPost, apiDelete, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Submission = { id: string; status: string; receiptCode: string; submittedAt: string; content: string };
type Assignment = {
  id: string; title: string; description: string; dueDate: string; createdAt: string;
  class: { id: string; name: string } | null; subject: { id: string; name: string } | null;
  teacher: { firstName: string; lastName: string } | null;
  mySubmission?: Submission | null;
  _count?: { submissions: number };
};
type ClassRow = { id: string; name: string };
type SubjectRow = { id: string; name: string };
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };

export default function AssignmentsPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه
  const canCreate = me?.user.role === "MANAGER" || (Boolean(me?.user.actingSchool) && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_assignments"));
  const confirm = useConfirm();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ classId: "", subjectId: "", title: "", description: "", dueDate: "" });
  const [targets, setTargets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { data: rosterData } = useApi<{ students: { id: string; name: string }[] }>(show && form.classId ? `/api/seating?classId=${form.classId}` : null);

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
      await apiPost("/api/assignments", { ...form, targetStudentIds: targets });
      toast.success(t("assignments.toast.created"));
      setShow(false);
      setTargets([]);
      setForm({ classId: "", subjectId: "", title: "", description: "", dueDate: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Assignment) {
    if (!(await confirm({ title: t("assignments.delete.title"), description: `${t("assignments.delete.descStart")} «${a.title}» ${t("assignments.delete.descEnd")}`, confirmLabel: t("common.delete"), danger: true }))) return;
    try {
      await apiDelete(`/api/assignments/${a.id}`);
      toast.success(t("assignments.toast.deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
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
      toast.success(t("assignments.toast.edited"));
      setEditId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setEditSaving(false);
    }
  }

  const isStudent = me?.user.role === "STUDENT";

  function SubmissionsBox({ a }: { a: Assignment }) {
    const { t } = useLang();
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState(false);
    const [roster, setRoster] = useState<{ student: { id: string; firstName: string; lastName: string }; submission: Submission | null }[] | null>(null);
    const [counts, setCounts] = useState<{ total: number; submitted: number; late: number; exempt: number } | null>(null);

    async function loadRoster() {
      const res = await fetch(`/api/assignments/${a.id}/submissions`, { credentials: "include" }).then((x) => x.json()).catch(() => null);
      if (res?.ok) { setRoster(res.roster); setCounts(res.counts); }
    }

    async function submit() {
      setBusy(true);
      try {
        const r = await apiPost<{ receipt: { code: string } }>(`/api/assignments/${a.id}/submissions`, { action: "submit", content });
        toast.success(`${t("assignments.toast.submittedPrefix")} ${r.receipt.code}`);
        refetch();
      } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
      finally { setBusy(false); }
    }

    async function toggleExempt(studentId: string, exempt: boolean) {
      try {
        await apiPost(`/api/assignments/${a.id}/submissions`, { action: exempt ? "exempt" : "unexempt", studentId });
        loadRoster();
      } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    }

    if (isStudent) {
      const mine = a.mySubmission;
      if (mine?.status === "EXEMPT") return <div className="b-badge b-badge-neutral self-start">{t("assignments.exempt")}</div>;
      if (mine) {
        return (
          <div className="rounded-2xl bg-spring-tint/60 p-3 flex items-center gap-2 text-[12px]">
            <ReceiptText className="w-4 h-4 text-spring shrink-0" />
            <span>{t("assignments.submitted.receipt")} <b dir="ltr">{mine.receiptCode}</b> · {formatDateFa(mine.submittedAt)}{mine.status === "LATE" ? ` · ${t("assignments.submitted.late")}` : ""}</span>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <button className="b-btn b-btn-ghost b-btn-sm self-start" onClick={() => setOpen((v) => !v)}>
            <Send className="w-4 h-4" /> {t("assignments.submit")}
          </button>
          {open && (
            <div className="flex flex-col gap-2">
              <textarea className="b-input min-h-20" placeholder={t("assignments.placeholder.submit")} value={content} onChange={(e) => setContent(e.target.value)} />
              <button className="b-btn b-btn-spring b-btn-sm self-start" disabled={busy} onClick={submit}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("assignments.submitReceipt")}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <button className="b-btn b-btn-ghost b-btn-sm self-start" onClick={() => { setOpen((v) => !v); if (!roster) loadRoster(); }}>
          <UserCheck className="w-4 h-4" /> {t("assignments.submissions")} ({faNumber(a._count?.submissions ?? 0)})
        </button>
        {open && (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto b-scroll">
            {roster === null && <Loader2 className="w-4 h-4 animate-spin" />}
            {counts && <p className="text-[12px] text-steel">{t("assignments.counts.from")} {faNumber(counts.total)} {t("assignments.counts.people")} {faNumber(counts.submitted)} {t("assignments.counts.submitted")} ({faNumber(counts.late)} {t("assignments.counts.late")}) · {faNumber(counts.exempt)} {t("assignments.counts.exempt")}</p>}
            {(roster ?? []).map((r) => (
              <div key={r.student.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-hairline last:border-0 text-[12px]">
                <span>{r.student.firstName} {r.student.lastName}</span>
                {r.submission?.status === "EXEMPT" ? (
                  <button className="b-badge b-badge-neutral" onClick={() => toggleExempt(r.student.id, false)}>{t("assignments.counts.exempt")} ✕</button>
                ) : r.submission ? (
                  <span className="b-badge b-badge-spring" dir="ltr">{r.submission.receiptCode}{r.submission.status === "LATE" ? ` · ${t("assignments.lateShort")}` : ""}</span>
                ) : (
                  <button className="b-badge b-badge-neutral hover:bg-stone" onClick={() => toggleExempt(r.student.id, true)}>{t("assignments.notSubmittedExempt")}</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function Card({ a }: { a: Assignment }) {
    const { t } = useLang();
    const overdue = new Date(a.dueDate).getTime() < now;
    return (
      <div className="b-card-md p-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <b className="text-[16px]">{a.title}</b>
          <span className={`b-badge ${overdue ? "b-badge-neutral" : "b-badge-spring"} shrink-0`}>
            <CalendarClock className="w-3 h-3" /> {formatDateFa(a.dueDate)}
          </span>
        </div>
        <p className="t-sm text-steel leading-relaxed line-clamp-4">{a.description}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-steel">
            {a.class?.name ?? "—"} {a.subject ? `· ${a.subject.name}` : ""} {a.teacher ? `· ${a.teacher.firstName} ${a.teacher.lastName}` : ""}
          </span>
          {canCreate && (
            <span className="flex items-center gap-1 shrink-0">
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:text-spring hover:bg-spring-tint" onClick={() => openEdit(a)} aria-label={t("common.edit")}>
                <Pencil className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10" onClick={() => remove(a)} aria-label={t("common.delete")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
        {(isStudent || !["PARENT"].includes(me?.user.role ?? "")) && <SubmissionsBox a={a} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.assignments")}
        desc={canCreate ? t("assignments.desc.create") : t("assignments.desc.view")}
        action={
          canCreate && (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShow(true)}>
              <Plus className="w-4 h-4" /> {t("assignments.new")}
            </button>
          )
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.assignments.length === 0 && <EmptyState icon={NotebookPen} title={t("assignments.empty.noAssignment")} />}

      {upcoming.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3">{t("assignments.upcoming")} ({faNumber(upcoming.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4">{upcoming.map((a) => <Card key={a.id} a={a} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3 text-steel">{t("assignments.past")} ({faNumber(past.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4 opacity-70">{past.map((a) => <Card key={a.id} a={a} />)}</div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setShow(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-6">{t("assignments.new")}</h2>
            <form onSubmit={create} className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("assignments.field.class")}</span>
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
                <span className="text-[12px] font-bold">{t("assignments.field.subject")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.subjectId}
                  onChange={(v) => setForm((f) => ({ ...f, subjectId: v }))}
                  options={[{ value: "", label: t("settings.general") }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                  placeholder={t("settings.general")}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-bold">{t("assignments.field.title")}</span>
                <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder={t("assignments.placeholder.title")} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-bold">{t("assignments.field.description")}</span>
                <textarea className="b-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required rows={4} placeholder={t("assignments.placeholder.description")} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("assignments.field.due")}</span>
                <input className="b-input" dir="ltr" type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required />
              </label>
              {form.classId && (rosterData?.students.length ?? 0) > 0 && (
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("assignments.field.targets")}</span>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto b-scroll">
                    {(rosterData?.students ?? []).map((s) => {
                      const on = targets.includes(s.id);
                      return (
                        <button type="button" key={s.id} onClick={() => setTargets((t) => (on ? t.filter((x) => x !== s.id) : [...t, s.id]))}
                          className={`b-badge ${on ? "b-badge-spring" : "b-badge-neutral"}`}>{s.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("assignments.create")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShow(false)}>{t("common.cancel")}</button>
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
            <h2 className="font-bold text-lg mb-4">{t("assignments.editTitle")}</h2>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("assignments.field.title")}</span>
                <input className="b-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required minLength={2} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("assignments.field.description")}</span>
                <textarea className="b-input min-h-24" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("assignments.field.due")}</span>
                <input className="b-input" dir="ltr" type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} required />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button type="button" className="b-btn b-btn-ghost b-btn-sm" onClick={() => setEditId(null)} disabled={editSaving}><X className="w-4 h-4" /> {t("common.cancel")}</button>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm" disabled={editSaving}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("common.save")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
