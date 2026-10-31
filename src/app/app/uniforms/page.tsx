"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Shirt, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; item: string; size: string | null; status: string; studentName: string; className: string | null; note: string | null };
type Data = { isStaff: boolean; classes: { id: string; name: string }[]; items: Row[] };
type StudentRow = { id: string; user: { firstName: string; lastName: string } };

const NEXT: Record<string, string> = { MEASURED: "ORDERED", ORDERED: "DELIVERED" };

export default function UniformsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/uniforms");
  const [classId, setClassId] = useState("");
  const { data: studentsData } = useApi<{ students: StudentRow[] }>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const [studentId, setStudentId] = useState("");
  const [item, setItem] = useState("");
  const [size, setSize] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!studentId || !item.trim()) { toast.error(t("uniforms.f.item")); return; }
    setBusy(true);
    try { await apiPost("/api/uniforms", { studentId, item, size: size || undefined }); setItem(""); setSize(""); toast.success(t("uniforms.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const advance = async (r: Row) => {
    const next = NEXT[r.status];
    if (!next) return;
    try { await apiPatch("/api/uniforms", { id: r.id, status: next }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("uniforms.title")} desc={t("uniforms.desc")} />
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Shirt className="w-5 h-5" /> {t("uniforms.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} aria-label={t("uniforms.f.class")}>
              <option value="">{t("uniforms.f.class")}</option>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t("uniforms.f.student")} disabled={!classId}>
              <option value="">{t("uniforms.f.student")}</option>
              {(studentsData?.students ?? []).map((s) => <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName}</option>)}
            </select>
            <input className="b-input w-full" value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("uniforms.f.item")} />
            <input className="b-input w-full" value={size} onChange={(e) => setSize(e.target.value)} placeholder={t("uniforms.f.size")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shirt className="w-4 h-4" />} {t("uniforms.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("uniforms.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.item}{r.size ? ` · ${t("uniforms.f.size")}: ${r.size}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "DELIVERED" ? "bg-success/15 text-success" : r.status === "ORDERED" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                {t(`uniforms.status.${r.status}`)}
              </span>
              {data.isStaff && NEXT[r.status] && (
                <button className="b-btn b-btn-ghost min-h-11" onClick={() => advance(r)}>{t(`uniforms.to.${NEXT[r.status]}`)}</button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
