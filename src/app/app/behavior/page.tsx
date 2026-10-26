"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Plus, Trash2, ThumbsUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete, useApi } from "@/lib/client";
import { faNumber, relativeTimeFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";

type Rec = { id: string; kind: string; reason: string; note: string | null; points: number; createdAt: string; recordedBy: { firstName: string; lastName: string } | null; student: { user: { firstName: string; lastName: string }; class: { name: string } | null } };
type StudentOpt = { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };

export default function BehaviorPage() {
  const confirm = useConfirm();
  const [records, setRecords] = useState<Rec[]>([]);
  const [reasons, setReasons] = useState<Record<string, { label: string; kind: string; points: number }>>({});
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [kind, setKind] = useState("ALL");
  // مجموعه کامل بدون فیلتر — مبنای آمار کارت‌ها
  const { data: allData } = useApi<{ records: Rec[] }>("/api/behavior");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ studentId: "", reason: "", note: "" });
  const [isStaff, setIsStaff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // نقش کاربر — برای نمایش دکمه حذف (فقط مدیر/معاون/ادمین سرویس)
  const { data: meData } = useApi<{ user: { role: string } }>("/api/auth/me");
  const canDeleteRole = !!meData && ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(meData.user.role);

  const load = useCallback(() => {
    apiGet<{ records: Rec[]; reasons: Record<string, { label: string; kind: string; points: number }> }>(`/api/behavior${kind !== "ALL" ? `?kind=${kind}` : ""}`)
      .then((d) => { setRecords(d.records); setReasons(d.reasons); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا در بارگذاری رکوردها"))
      .finally(() => setLoading(false));
  }, [kind]);
  useEffect(load, [load]);

  useEffect(() => {
    apiGet<{ students: StudentOpt[] }>("/api/students").then((d) => { setStudents(d.students ?? []); setIsStaff(true); }).catch(() => setIsStaff(false));
  }, []);

  async function submit() {
    if (!form.studentId || !form.reason) { toast.error("دانش‌آموز و دلیل را انتخاب کنید"); return; }
    try {
      await apiPost("/api/behavior", form);
      toast.success("ثبت شد — به دانش‌آموز و اولیا اطلاع‌رسانی شد");
      setForm({ studentId: "", reason: "", note: "" }); setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function remove(id: string) {
    if (!(await confirm({ title: "حذف رکورد انضباطی", description: "این رکورد انضباطی حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/behavior?id=${id}`);
      toast.success("رکورد حذف شد.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  const canDelete = records.length > 0; // کاربرد: نمایش سرصفحه حذف
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBox message={error} />;
  const positives = records.filter((r) => r.kind === "POSITIVE");
  const negatives = records.filter((r) => r.kind === "NEGATIVE");
  // آمار کل رکوردها — نه برش فیلترشده (قبلاً با فیلتر «تشویق‌ها» بقیهٔ کارت‌ها صفر می‌شدند)
  const allRecords = (allData?.records ?? records).filter((r) => r.kind === "POSITIVE" || r.kind === "NEGATIVE");
  const allPositives = allRecords.filter((r) => r.kind === "POSITIVE");
  const allNegatives = allRecords.filter((r) => r.kind === "NEGATIVE");
  return (
    <div>
      <PageHeader
        title="انضباط و رفتار"
        desc="ثبت تشویق و اخطار با دلایل استاندارد — همه تغییرات به دانش‌آموز و خانواده اطلاع‌رسانی می‌شود"
        action={isStaff && <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> ثبت جدید</button>}
      />
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="b-card-sm p-4 text-center"><p className="text-[11px] text-steel">تشویق‌ها</p><p className="text-xl font-bold text-success">{faNumber(allPositives.length)}</p></div>
        <div className="b-card-sm p-4 text-center"><p className="text-[11px] text-steel">اخطارها</p><p className="text-xl font-bold text-destructive">{faNumber(allNegatives.length)}</p></div>
        <div className="b-card-sm p-4 text-center"><p className="text-[11px] text-steel">امتیاز خالص</p><p className={`text-xl font-bold ${allRecords.reduce((sum, r) => sum + r.points, 0) >= 0 ? "text-spring-deep" : "text-destructive"}`}>{faNumber(allRecords.reduce((sum, r) => sum + r.points, 0))}</p></div>
      </div>
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-3">
          <Select
            value={form.studentId}
            onChange={(v) => setForm({ ...form, studentId: v })}
            options={[{ value: "", label: "دانش‌آموز…" }, ...students.map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}${s.class ? ` (${s.class.name})` : ""}` }))]}
            placeholder="دانش‌آموز…"
            className="w-full sm:col-span-1"
            buttonClassName="!w-full"
          />
          <Select
            value={form.reason}
            onChange={(v) => setForm({ ...form, reason: v })}
            options={[{ value: "", label: "دلیل…" }, ...Object.entries(reasons).map(([k, v]) => ({ value: k, label: `${v.label} (${v.points > 0 ? "+" : ""}${v.points})` }))]}
            placeholder="دلیل…"
            className="w-full"
            buttonClassName="!w-full"
          />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="توضیح (اختیاری)" className="b-input" />
          <div className="flex gap-2 sm:col-span-3">
            <button onClick={submit} className="b-btn b-btn-spring b-btn-sm">ثبت</button>
            <button onClick={() => setShowNew(false)} className="b-btn b-btn-ghost b-btn-sm">انصراف</button>
          </div>
        </div>
      )}
      <div className="flex gap-1.5 mb-5">
        {["ALL", "POSITIVE", "NEGATIVE"].map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`b-pill-tab ${kind === k ? "b-pill-tab-active" : ""}`}>
            {k === "ALL" ? "همه" : k === "POSITIVE" ? "تشویق‌ها" : "اخطارها"}
          </button>
        ))}
      </div>
      {records.length === 0 ? <EmptyState icon={HeartHandshake} title="رکوردی نیست" desc="تشویق یا اخطاری ثبت نشده است." /> : (
        <div className="flex flex-col gap-2.5">
          {records.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className={`b-card-sm p-4 flex items-center gap-3 ${r.kind === "POSITIVE" ? "border-s-4 !border-s-success" : "border-s-4 !border-s-destructive"}`}>
              <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${r.kind === "POSITIVE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {r.kind === "POSITIVE" ? <ThumbsUp className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{r.student.user.firstName} {r.student.user.lastName} <span className="text-steel font-normal">— {reasons[r.reason]?.label ?? r.reason}</span></p>
                <p className="text-[11px] text-steel truncate">
                  {r.student.class?.name ?? "—"} · {r.recordedBy ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}` : "سیستم"} · {relativeTimeFa(r.createdAt)}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <span className={`b-badge shrink-0 ${r.points > 0 ? "b-badge-success" : "b-badge-critical"}`}>{r.points > 0 ? "+" : ""}{faNumber(r.points)}</span>
              {canDeleteRole && canDelete && (
                <button
                  onClick={() => remove(r.id)}
                  className="b-btn b-btn-ghost b-btn-sm !text-destructive shrink-0"
                  title="حذف رکورد"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
