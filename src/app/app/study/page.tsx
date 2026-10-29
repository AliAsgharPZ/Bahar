"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, Check, Flame, Loader2, Plus, Trash2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, StatCard } from "@/components/shared/bits";
import { faNumber, todayKey } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Task = { id: string; title: string; minutes: number; done: boolean; date: string };
type SData = { tasks: Task[]; streak: number; weekMinutes: number; today: string; date: string };

export default function StudyPage() {
  const { t } = useLang();
  const [date, setDate] = useState(todayKey());
  const { data, loading, error, refetch } = useApi<SData>(`/api/study?date=${date}`);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action + (extra.id as string ?? ""));
    try {
      await apiPost("/api/study", { action, date, ...extra });
      if (action === "add") { setTitle(""); toast.success(t("study.toast.added")); }
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  const tasks = data?.tasks ?? [];
  const doneCount = tasks.filter((tk) => tk.done).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("study.title")} desc={t("study.desc")} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Flame} label={t("study.streak")} value={data?.streak ?? 0} tone="blossom" />
        <StatCard icon={BookOpenCheck} label={t("study.weekMinutes")} value={data?.weekMinutes ?? 0} tone="spring" />
        <StatCard icon={Check} label={t("study.todayTasks")} value={`${faNumber(doneCount)} ${t("common.from")} ${faNumber(tasks.length)}`} tone="ink" />
      </div>
      <div className="b-card p-6 flex flex-col gap-4">
        <span className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("study.field.date")}</span>
            <input className="b-input w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1405-08-05" /></label>
          <label className="flex flex-col gap-1.5 flex-1 min-w-52"><span className="text-[12px] font-bold">{t("study.field.task")}</span>
            <input className="b-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("study.placeholder.task")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("dashboard.uptime.minute")}</span>
            <input className="b-input w-20" dir="ltr" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          <button className="b-btn b-btn-spring" disabled={busy === "add" || title.trim().length < 2} onClick={() => act("add", { title, minutes: Number(minutes) })}>
            {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("common.add")}
          </button>
        </span>
        {loading && <LoadingBlock />}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-col">
          {tasks.length === 0 && !loading && <span className="text-[12.5px] text-steel py-2">{t("study.noTasks")}</span>}
          {tasks.map((tk) => (
            <div key={tk.id} className="flex items-center gap-3 py-2.5 border-b border-hairline last:border-0">
              <button
                onClick={() => act("toggle", { id: tk.id })}
                className={`b-btn b-btn-ghost w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${tk.done ? "bg-spring border-spring text-white" : "border-hairline text-transparent"}`}
                aria-label={tk.done ? t("study.notDone") : t("study.done")}
              >
                <Check className="w-4 h-4" />
              </button>
              <span className={`flex-1 text-[13.5px] ${tk.done ? "line-through text-steel" : ""}`}>{tk.title}</span>
              <span className="text-[12px] text-steel">{faNumber(tk.minutes)} {t("dashboard.uptime.minute")}</span>
              <button className="b-btn b-btn-ghost text-stone hover:text-destructive" onClick={() => act("delete", { id: tk.id })} aria-label={t("common.delete")}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
