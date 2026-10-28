"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Plus, Trash2, History, Power } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, relativeTimeFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Rule = { id: string; name: string; trigger: string; config: string; action: string; actionConfig: string; active: boolean; runCount: number; lastRunAt: string | null };
type Log = { id: string; ruleName?: string; trigger: string; summary: string; result: string; createdAt: string };

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [triggers, setTriggers] = useState<Record<string, string>>({});
  const [actions, setActions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", trigger: "ABSENT_THRESHOLD", threshold: "5", action: "NOTIFY", title: "" });

  const load = useCallback(() => {
    apiGet<{ rules: Rule[]; logs: Log[]; triggers: Record<string, string>; actions: Record<string, string> }>("/api/automation")
      .then((d) => { setLoadError(""); setRules(d.rules); setLogs(d.logs); setTriggers(d.triggers); setActions(d.actions); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری قوانین"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function create() {
    if (!form.name.trim()) { toast.error("نام قانون لازم است"); return; }
    try {
      await apiPost("/api/automation", {
        name: form.name, trigger: form.trigger, action: form.action,
        config: { threshold: Number(form.threshold) || 5 },
        actionConfig: { title: form.title || form.name, target: "MANAGER" },
      });
      toast.success("قانون فعال شد");
      setForm({ name: "", trigger: "ABSENT_THRESHOLD", threshold: "5", action: "NOTIFY", title: "" });
      setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function toggle(r: Rule) {
    try { await apiPatch("/api/automation", { id: r.id, active: !r.active }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function remove(id: string) {
    try { await apiDelete(`/api/automation?id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  const THRESHOLD_TRIGGERS = ["ABSENT_THRESHOLD", "LOW_ATTENDANCE", "GRADE_DROP"];
  return (
    <div>
      <PageHeader
        title="اتوماسیون مدرسه"
        desc="قوانین شرطی ساده — «اگر غیبت از ۵ گذشت، به مدیر اطلاع بده»"
        action={<button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> قانون جدید</button>}
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام قانون (مثلاً هشدار غیبت مکرر) *" className="b-input" />
          <Select
            value={form.trigger}
            onChange={(v) => setForm({ ...form, trigger: v })}
            options={Object.entries(triggers).map(([k, v]) => ({ value: k, label: v }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          {THRESHOLD_TRIGGERS.includes(form.trigger) && (
            <input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="آستانه (مثلاً 5)" className="b-input" />
          )}
          <Select
            value={form.action}
            onChange={(v) => setForm({ ...form, action: v })}
            options={Object.entries(actions).map(([k, v]) => ({ value: k, label: v }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان اعلان/تسک (اختیاری)" className="b-input sm:col-span-2" />
          <button onClick={create} className="b-btn b-btn-sm b-btn-spring sm:col-span-2 w-fit">ایجاد و فعال‌سازی</button>
        </div>
      )}
      {rules.length === 0 ? <EmptyState icon={Zap} title="قانونی تعریف نشده" desc="اولین اتوماسیون مدرسه را بسازید." /> : (
        <div className="flex flex-col gap-2.5 mb-8">
          {rules.map((r, i) => {
            let cfg: { threshold?: number } = {};
            try { cfg = JSON.parse(r.config || "{}") as { threshold?: number }; } catch { cfg = {}; } // FIX راند ۱۶
            return (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${!r.active ? "opacity-55" : ""}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.active ? "bg-spring-tint text-spring-deep" : "bg-cloud text-stone"}`}>
                  <Zap className="w-4.5 h-4.5 w-5 h-5" />
                </span>
                <div className="flex-1 min-w-[180px]">
                  <p className="text-[13px] font-bold">{r.name}</p>
                  <p className="text-[11px] text-steel">
                    {triggers[r.trigger]}{cfg.threshold ? ` (آستانه ${faNumber(cfg.threshold)})` : ""} ← {actions[r.action]}
                    {r.runCount > 0 ? ` · ${faNumber(r.runCount)} بار اجرا` : ""}
                  </p>
                </div>
                <button onClick={() => toggle(r)} className={`b-btn b-btn-sm !min-h-[28px] !text-[10px] !px-2.5 !py-0 ${r.active ? "b-btn-ghost" : "b-btn-spring"}`}>
                  <Power className="w-3.5 h-3.5" /> {r.active ? "خاموش" : "روشن"}
                </button>
                <button onClick={() => remove(r.id)} className="b-btn b-btn-ghost text-stone hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </motion.div>
            );
          })}
        </div>
      )}
      {logs.length > 0 && (
        <div>
          <h2 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4 text-steel" /> اجراهای اخیر</h2>
          <div className="b-card-sm divide-y divide-hairline-soft/60">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3 text-[12px] flex-wrap">
                <span className={`b-dot shrink-0 ${l.result === "DONE" ? "bg-success" : l.result === "SKIPPED" ? "bg-warning" : "bg-destructive"}`} />
                <span className="font-bold">{triggers[l.trigger] ?? l.trigger}</span>
                <span className="text-steel flex-1 truncate">{l.summary}</span>
                <span className="text-[10px] text-stone shrink-0">{relativeTimeFa(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
