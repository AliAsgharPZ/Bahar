"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, ListTodo, CheckCircle2, Clock, CircleDashed, Calendar, Flag } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { useLang } from "@/lib/i18n";
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
  { key: "TODO", label: "tasks.status.todo", icon: CircleDashed, color: "text-stone" },
  { key: "IN_PROGRESS", label: "tasks.status.inProgress", icon: Clock, color: "text-info" },
  { key: "DONE", label: "tasks.status.done", icon: CheckCircle2, color: "text-success" },
];
const PRIO: Record<string, { label: string; cls: string }> = {
  URGENT: { label: "shell.notif.cat.urgent", cls: "b-badge-critical" },
  HIGH: { label: "tasks.priority.high", cls: "b-badge-warning" },
  NORMAL: { label: "tasks.priority.normal", cls: "b-badge-neutral" },
  LOW: { label: "tasks.priority.low", cls: "b-badge-neutral" },
};

export default function TasksPage() {
  const { t: tr } = useLang();
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
      .catch((e) => setLoadError(e instanceof Error ? e.message : tr("tasks.loadError")))
      .finally(() => setLoading(false));
  }, [mine]);
  useEffect(load, [load]);

  async function create() {
    if (!form.title.trim()) return;
    try {
      await apiPost("/api/tasks", { ...form, dueDate: form.dueDate || undefined });
      toast.success(tr("tasks.created"));
      setForm({ title: "", description: "", priority: "NORMAL", dueDate: "", assigneeId: "" });
      setShowNew(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : tr("common.errorShort")); }
  }
  async function move(t: Task, status: string) {
    const prev = [...tasks];
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    try { await apiPatch("/api/tasks", { id: t.id, status }); } catch { setTasks(prev); toast.error(tr("tasks.moveFailed")); }
  }
  async function remove(id: string) {
    try { await apiDelete(`/api/tasks?id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : tr("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title={tr("tasks.title")}
        desc={tr("tasks.desc")}
        action={
          <div className="flex gap-2">
            <button onClick={() => setMine((v) => !v)} className={`b-pill-tab ${mine ? "b-pill-tab-active" : ""}`}>{tr("tasks.onlyMine")}</button>
            <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {tr("tasks.new")}</button>
          </div>
        }
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr("tasks.form.title")} className="b-input sm:col-span-2" autoFocus />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={tr("tasks.form.description")} className="b-input sm:col-span-2 !min-h-[70px]" />
          <Select
            value={form.priority}
            onChange={(v) => setForm({ ...form, priority: v })}
            options={[{ value: "LOW", label: tr("tasks.priorityOption.low") }, { value: "NORMAL", label: tr("tasks.priorityOption.normal") }, { value: "HIGH", label: tr("tasks.priorityOption.high") }, { value: "URGENT", label: tr("tasks.priorityOption.urgent") }]}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="b-input" title={tr("tasks.form.deadline")} />
          {canManage && (
            <Select
              value={form.assigneeId}
              onChange={(v) => setForm({ ...form, assigneeId: v })}
              options={[{ value: "", label: tr("tasks.form.noAssignee") }, ...members.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))]}
              placeholder={tr("tasks.form.noAssignee")}
              className="w-full sm:col-span-2"
              buttonClassName="!w-full"
            />
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={create} className="b-btn b-btn-spring b-btn-sm">{tr("common.create")}</button>
            <button onClick={() => setShowNew(false)} className="b-btn b-btn-ghost b-btn-sm">{tr("common.cancel")}</button>
          </div>
        </div>
      )}
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title={tr("tasks.empty.title")} desc={tr("tasks.empty.desc")} />
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
                  <span className="font-bold text-[13.5px]">{tr(col.label)}</span>
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
                        {t.description && <p className="text-[12px] text-steel mt-1 line-clamp-2">{t.description}</p>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`b-badge !text-[9.5px] !px-1.5 !py-0.5 ${PRIO[t.priority]?.cls ?? "b-badge-neutral"}`}>{tr(PRIO[t.priority]?.label ?? "")}</span>
                          {t.dueDate && <span className={`text-[12px] flex items-center gap-0.5 ${overdue ? "text-destructive font-bold" : "text-stone"}`}><Calendar className="w-3 h-3" />{formatDateFa(t.dueDate)}</span>}
                          {t.student && <span className="text-[12px] text-steel truncate">🎓 {t.student.user.firstName} {t.student.user.lastName}</span>}
                          {t.assignee && <span className="text-[12px] text-steel ms-auto">{t.assignee.firstName} {t.assignee.lastName}</span>}
                          {t.sourceKind === "AUTOMATION" && <span className="b-badge b-badge-spring !text-[9px] !px-1.5 !py-0">{tr("tasks.auto")}</span>}
                        </div>
                        {t.status !== "DONE" && (
                          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 max-md:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {t.status === "TODO" && <button onClick={() => move(t, "IN_PROGRESS")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[9.5px] !px-2 !py-0">{tr("tasks.start")}</button>}
                            {t.status === "IN_PROGRESS" && <button onClick={() => move(t, "TODO")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[9.5px] !px-2 !py-0">{tr("common.back")}</button>}
                            <button onClick={() => move(t, "DONE")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[9.5px] !px-2 !py-0">{tr("tasks.done")}</button>
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
