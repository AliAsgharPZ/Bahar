"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, Check, Flame, Loader2, Plus, Trash2 } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, StatCard } from "@/components/shared/bits";
import { faNumber, todayKey } from "@/lib/persian";

type Task = { id: string; title: string; minutes: number; done: boolean; date: string };
type SData = { tasks: Task[]; streak: number; weekMinutes: number; today: string; date: string };

export default function StudyPage() {
  const [date, setDate] = useState(todayKey());
  const { data, loading, error, refetch } = useApi<SData>(`/api/study?date=${date}`);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action + (extra.id as string ?? ""));
    try {
      await apiPost("/api/study", { action, date, ...extra });
      if (action === "add") { setTitle(""); toast.success("به برنامه اضافه شد."); }
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  const tasks = data?.tasks ?? [];
  const doneCount = tasks.filter((t) => t.done).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="برنامهٔ مطالعه و زنجیرهٔ عادت" desc="هر روز کارت را بنویس، تیک بزن و زنجیره‌ات را نشکن — عادت کوچک روزانه، نتیجهٔ بزرگ سالانه." />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Flame} label="زنجیرهٔ مطالعه (روز)" value={data?.streak ?? 0} tone="blossom" />
        <StatCard icon={BookOpenCheck} label="دقایق مطالعهٔ این هفته" value={data?.weekMinutes ?? 0} tone="spring" />
        <StatCard icon={Check} label="کارهای امروز" value={`${faNumber(doneCount)} از ${faNumber(tasks.length)}`} tone="ink" />
      </div>
      <div className="b-card p-6 flex flex-col gap-4">
        <span className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">تاریخ (شمسی)</span>
            <input className="b-input w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1405-08-05" /></label>
          <label className="flex flex-col gap-1.5 flex-1 min-w-52"><span className="text-[12px] font-bold">کار مطالعهٔ تازه</span>
            <input className="b-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: فصل ۳ ریاضی + ۲۰ تست" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">دقیقه</span>
            <input className="b-input w-20" dir="ltr" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          <button className="b-btn b-btn-spring" disabled={busy === "add" || title.trim().length < 2} onClick={() => act("add", { title, minutes: Number(minutes) })}>
            {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} افزودن
          </button>
        </span>
        {loading && <LoadingBlock />}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-col">
          {tasks.length === 0 && !loading && <span className="text-[12.5px] text-steel py-2">برای این روز کاری ثبت نشده است.</span>}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-hairline last:border-0">
              <button
                onClick={() => act("toggle", { id: t.id })}
                className={`b-btn b-btn-ghost w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${t.done ? "bg-spring border-spring text-white" : "border-hairline text-transparent"}`}
                aria-label={t.done ? "انجام نشده" : "انجام شد"}
              >
                <Check className="w-4 h-4" />
              </button>
              <span className={`flex-1 text-[13.5px] ${t.done ? "line-through text-steel" : ""}`}>{t.title}</span>
              <span className="text-[12px] text-steel">{faNumber(t.minutes)} دقیقه</span>
              <button className="b-btn b-btn-ghost text-stone hover:text-destructive" onClick={() => act("delete", { id: t.id })} aria-label="حذف">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
