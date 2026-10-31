"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserCheck, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; classId: string; role: string; studentName: string; termLabel: string | null };
type Data = { classes: { id: string; name: string }[]; items: Row[] };
type StudentRow = { id: string; user: { firstName: string; lastName: string } };

const ROLES = ["مبصر", "نمایندهٔ کلاس", "مسئول کتابخانهٔ کلاس", "مسئول نظافت", "مسئول ورزش", "مسئول تابلو", "غیره"];

export default function ClassRolesPage() {
  const { t } = useLang();
  const [filterClass, setFilterClass] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/class-roles${filterClass ? `?classId=${filterClass}` : ""}`, [filterClass]);
  const { data: studentsData } = useApi<{ students: StudentRow[] }>(filterClass ? `/api/students?classId=${filterClass}` : null, [filterClass]);
  const [role, setRole] = useState(ROLES[0]);
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!filterClass || !studentId) { toast.error(t("classRoles.f.student")); return; }
    setBusy(true);
    try { await apiPost("/api/class-roles", { classId: filterClass, role, studentId }); toast.success(t("classRoles.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/class-roles?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const className = (id: string) => data.classes.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title={t("classRoles.title")} desc={t("classRoles.desc")} />
      <div className="flex flex-wrap gap-2 items-center">
        <select className="b-input" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} aria-label={t("classRoles.f.class")}>
          <option value="">{t("classRoles.allClasses")}</option>
          {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {filterClass && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><UserCheck className="w-5 h-5" /> {t("classRoles.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("classRoles.f.role")}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t("classRoles.f.student")}>
              <option value="">{t("classRoles.f.student")}</option>
              {(studentsData?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
            </select>
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} {t("classRoles.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("classRoles.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.role} — {r.studentName}</p>
                <p className="text-sm text-muted-foreground">{className(r.classId)}{r.termLabel ? ` · ${r.termLabel}` : ""}</p>
              </div>
              <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("classRoles.delete")}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
