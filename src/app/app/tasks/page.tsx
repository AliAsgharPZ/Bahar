"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, ListTodo, CheckCircle2, Clock, CircleDashed, Calendar, Flag } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Task = {
  id: string; title: string; description: string | null; status: string; priority: string;
  dueDate: string | null; sourceKind: string | null;
  assignee: { id: string; firstName: string; lastName: string; role: string } | null;
  creator: { firstName: string; lastName: string } | null;
  student: { user: { firstName: string; lastName: string } } | null;
};
type Member = { id: string; firstName: string; lastName: string; role: string };

const COLS = [
  { key: "TODO", label: "در صف", icon: CircleDashed, color: "text-stone" },
  { key: "IN_PROGRESS", label: "در جریان", icon: Clock, color: "text-info" },
  { key: "DONE", label: "انجام‌شده", icon: CheckCircle2, color: "text-success" },
];
const PRIO: Record<string, { label: string; cls: string }> = {
  URGENT: { label: "فوری", cls: "b-badge-critical" },
  HIGH: { label: "بالا", cls: "b-badge-warning" },
  NORMAL: { label: "معمولی", cls: "b-badge-neutral" },
  LOW: { label: "پایین", cls: "b-badge-neutral" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "NORMAL", dueDate: "", assigneeId: "" });
  const [mine, setMine] = useState(false);

  const load = useCallback(() => {
    apiGet<{ tasks: Task[]; members: Member[]; canManage: boolean }>(`/api/tasks${mine ? "?mine=1" : ""}`)
      .then((d) => { setLoadError(""); setTasks(d.tasks); setMembers(d.members); setCanManage(d.canManage); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری تسک‌ها"))
      .finally(() => setLoading(false));
  }, [mine]);
  useEffect(load, [load]);

  async function create() {
    if (!form.title.trim()) return;
    try {
      await apiPost("/api/tasks", { ...form, dueDate: form.dueDate || undefined });
      toast.success("تسک ایجاد شد");
      setForm({ title: "", description: "", priority: "NORMAL", dueDate: "", assigneeId: "" });
      setShowNew(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function move(t: Task, status: string) {
    const prev = [...tasks];
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    try { await apiPatch("/api/tasks", { id: t.id, status }); } catch { setTasks(prev); toast.error("جابجایی ناموفق"); }
  }
  async function remove(id: string) {
    try { await apiDelete(`/api/tasks?id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title="مدیریت تسک‌ها"
        desc="کارهای مدرسه با مسئول، ددلاین و اولویت — کشیدن بین ستون‌ها"
        action={
          <div className="flex gap-2">
            <button onClick={() => setMine((v) => !v)} className={`b-pill-tab ${mine ? "b-pill-tab-active" : ""}`}>فقط تسک‌های من</button>
            <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> تسک جدید</button>
          </div>
        }
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان تسک *" className="b-input sm:col-span-2" autoFocus />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="شرح (اختیاری)" className="b-input sm:col-span-2 !min-h-[70px]" />
          <Select
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: v })}
            options={[{ value: "LOW", label: "اولویت: پایین" }, { value: "NORMAL", label: "اولویت: معمولی" }, { value: "HIGH", label: "اولویت: بالا" }, { value: "URGENT", label: "اولویت: فوری" }]}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="b-input" title="ددلاین" />
          {canManage && (
            <Select
              value={form.assigneeId}
              onChange={(v) => setForm({ ...form, assigneeId: v })}
              options={[{ value: "", label: "بدون مسئول" }, ...members.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))]}
              placeholder="بدون مسئول"
              className="w-full sm:col-span-2"
              buttonClassName="!w-full"
            />
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={create} className="b-btn b-btn-spring b-btn-sm">ایجاد</button>
            <button onClick={() => setShowNew(false)} className="b-btn b-btn-ghost b-btn-sm">انصراف</button>
          </div>
        </div>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="تسکی نیست" desc="اولین تسک مدرسه را بسازید." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLS.map((col) => {
            const items = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="b-card-md p-4 min-h-[200px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const ev = e as unknown as { dataTransfer?: { getData(k: string): string } };
                  const id = ev.dataTransfer?.getData("task") ?? "";
                  const t = tasks.find((x) => x.id === id);
                  if (t && t.status !== col.key) move(t, col.key);
                }}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <col.icon className={`w-4 h-4 ${col.color}`} />
                  <span className="font-bold text-[13.5px]">{col.label}</span>
                  <span className="b-badge b-badge-neutral ms-auto">{faNumber(items.length)}</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {items.map((t, i) => {
                    const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE";
                    return (
                      <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        draggable
                        onDragStart={(e) => { const ev = e as unknown as { dataTransfer?: { setData(k: string, v: string): void } }; ev.dataTransfer?.setData("task", t.id); }}
                        className={`p-3.5 rounded-2xl bg-cloud cursor-grab active:cursor-grabbing group ${overdue ? "border border-destructive/30" : ""}`}>
                        <div className="flex items-start gap-2">
                          <span className="flex-1 text-[12.5px] font-bold leading-snug">{t.title}</span>
                          {canManage && (
                            <button onClick={() => remove(t.id)} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 text-stone hover:text-destructive transition-all shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {t.description && <p className="text-[11px] text-steel mt-1 line-clamp-2">{t.description}</p>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`b-badge !text-[9.5px] !px-1.5 !py-0.5 ${PRIO[t.priority]?.cls ?? "b-badge-neutral"}`}>{PRIO[t.priority]?.label}</span>
                          {t.dueDate && <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-destructive font-bold" : "text-stone"}`}><Calendar className="w-3 h-3" />{formatDateFa(t.dueDate)}</span>}
                          {t.student && <span className="text-[10px] text-steel truncate">🎓 {t.student.user.firstName} {t.student.user.lastName}</span>}
                          {t.assignee && <span className="text-[10px] text-steel ms-auto">{t.assignee.firstName} {t.assignee.lastName}</span>}
                          {t.sourceKind === "AUTOMATION" && <span className="b-badge b-badge-spring !text-[9px] !px-1.5 !py-0">خودکار</span>}
                        </div>
                        {t.status !== "DONE" && (
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {t.status === "TODO" && <button onClick={() => move(t, "IN_PROGRESS")} className="b-btn b-btn-sm b-btn-ghost !min-h-[24px] !text-[9.5px] !px-2 !py-0">شروع</button>}
                            {t.status === "IN_PROGRESS" && <button onClick={() => move(t, "TODO")} className="b-btn b-btn-sm b-btn-ghost !min-h-[24px] !text-[9.5px] !px-2 !py-0">بازگشت</button>}
                            <button onClick={() => move(t, "DONE")} className="b-btn b-btn-sm b-btn-spring !min-h-[24px] !text-[9.5px] !px-2 !py-0">انجام شد</button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
