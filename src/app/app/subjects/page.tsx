"use client";

import { useLang } from "@/lib/i18n";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, LibraryBig } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useConfirm } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type SubjectRow = { id: string; name: string; code: string | null; grade: string | null; weeklyHours: number; _count: { teachingAssignments: number } };
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };

export default function SubjectsPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const { data, loading, error, refetch } = useApi<{ subjects: SubjectRow[] }>("/api/subjects");
  const confirm = useConfirm();
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState({ name: "", code: "", grade: "", weeklyHours: "2" });
  const [saving, setSaving] = useState(false);

  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه
  const inPanel = Boolean(me?.user.actingSchool);
  const canManage = me?.user.role === "MANAGER" || (inPanel && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_subjects"));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, weeklyHours: Number(form.weeklyHours) };
      if (editing) {
        await apiPatch(`/api/subjects/${editing.id}`, payload);
        toast.success(t("subjects.toast.edited"));
        setEditing(null);
      } else {
        await apiPost("/api/subjects", payload);
        toast.success(t("subjects.toast.added"));
        setShow(false);
      }
      setForm({ name: "", code: "", grade: "", weeklyHours: "2" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: SubjectRow) {
    if (!(await confirm({ title: t("subjects.delete.title"), description: `${t("subjects.delete.descStart")} «${s.name}» ${t("subjects.delete.descEnd")}`, confirmLabel: t("common.delete"), danger: true }))) return;
    try {
      await apiDelete(`/api/subjects/${s.id}`);
      toast.success(t("subjects.toast.deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.subjects")}
        desc={t("subjects.desc")}
        action={
          canManage && (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => { setShow(true); setEditing(null); setForm({ name: "", code: "", grade: "", weeklyHours: "2" }); }}>
              <Plus className="w-4 h-4" /> {t("subjects.new")}
            </button>
          )
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.subjects.length === 0 && <EmptyState icon={LibraryBig} title={t("subjects.empty.noSubject")} />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.subjects ?? []).map((s) => (
          <div key={s.id} className="b-card-sm p-5 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <b className="text-[14.5px] truncate">{s.name}</b>
              <span className="text-[11.5px] text-steel">
                {faNumber(s.weeklyHours)} {t("subjects.hoursPerWeek")} {s.grade ? `· ${s.grade}` : ""} {s.code ? `· ${t("subjects.code")} ${s.code}` : ""}
              </span>
              <span className="b-badge b-badge-neutral self-start mt-1">{faNumber(s._count.teachingAssignments)} {t("subjects.assignments")}</span>
            </div>
            {canManage && (
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring"
                  onClick={() => { setEditing(s); setForm({ name: s.name, code: s.code ?? "", grade: s.grade ?? "", weeklyHours: String(s.weeklyHours) }); }}
                  aria-label={t("common.edit")}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(s)}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(show || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => { setShow(false); setEditing(null); }} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-md b-pop">
            <h2 className="font-bold text-lg mb-6">{editing ? `${t("common.edit")} ${editing.name}` : t("subjects.new")}</h2>
            <form onSubmit={save} className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 col-span-2">
                <span className="text-[12.5px] font-bold">{t("subjects.field.name")}</span>
                <input className="b-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder={t("subjects.placeholder.name")} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("subjects.field.code")}</span>
                <input className="b-input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("subjects.field.weeklyHours")}</span>
                <input className="b-input" dir="ltr" inputMode="numeric" value={form.weeklyHours} onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 col-span-2">
                <span className="text-[12.5px] font-bold">{t("subjects.field.targetGrade")}</span>
                <input className="b-input" value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))} placeholder={t("subjects.placeholder.grade")} />
              </label>
              <div className="col-span-2 flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => { setShow(false); setEditing(null); }}>{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
