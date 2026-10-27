"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2, Save } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { jalaliDayOfWeek } from "@/lib/persian";

type Day = { weekday: number; breakfast: string; lunch: string; snack: string };
type Me = { user: { role: string } };

const DAYS = ["", "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export default function MealsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me?.user.role ?? "");
  const { data, loading, error, refetch } = useApi<{ plan: Day[] }>("/api/meals");
  const [drafts, setDrafts] = useState<Record<number, Day>>({});
  const [savingDay, setSavingDay] = useState(0);
  const today = jalaliDayOfWeek();

  async function save(day: Day) {
    setSavingDay(day.weekday);
    try {
      const res = await fetch("/api/meals", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(day),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "خطا");
      toast.success(`منوی ${DAYS[day.weekday]} ذخیره شد.`);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSavingDay(0); }
  }

  const plan = data?.plan ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="برنامهٔ غذایی هفته" desc="منوی صبحانه، ناهار و میان‌وعدهٔ هر روز — یک بار تنظیم می‌شود، همهٔ هفته دیده می‌شود." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && plan.every((d) => !d.breakfast && !d.lunch && !d.snack) && !isManager && (
        <EmptyState icon={UtensilsCrossed} title="برنامهٔ غذایی هنوز تنظیم نشده" />
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 b-auto-stagger">
        {plan.map((d) => {
          const val = drafts[d.weekday] ?? d;
          const set = (patch: Partial<Day>) => setDrafts((prev) => ({ ...prev, [d.weekday]: { ...val, ...patch } }));
          const isToday = d.weekday === today;
          return (
            <div key={d.weekday} className={`b-card-md p-5 flex flex-col gap-2.5 ${isToday ? "b-grad-border" : ""}`}>
              <span className="flex items-center justify-between">
                <b className="text-[14.5px]">{DAYS[d.weekday]}</b>
                {isToday && <span className="b-badge b-badge-spring">امروز</span>}
              </span>
              {isManager ? (
                <>
                  <label className="flex flex-col gap-1"><span className="text-[11.5px] font-bold text-steel">صبحانه</span>
                    <input className="b-input" value={val.breakfast} onChange={(e) => set({ breakfast: e.target.value })} placeholder="…" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[11.5px] font-bold text-steel">ناهار</span>
                    <input className="b-input" value={val.lunch} onChange={(e) => set({ lunch: e.target.value })} placeholder="…" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[11.5px] font-bold text-steel">میان‌وعده</span>
                    <input className="b-input" value={val.snack} onChange={(e) => set({ snack: e.target.value })} placeholder="…" /></label>
                  <button className="b-btn b-btn-spring b-btn-sm self-start" disabled={savingDay === d.weekday} onClick={() => save(val)}>
                    {savingDay === d.weekday ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-1.5 text-[13px]">
                  <span><span className="text-steel">صبحانه: </span>{d.breakfast || "—"}</span>
                  <span><span className="text-steel">ناهار: </span>{d.lunch || "—"}</span>
                  <span><span className="text-steel">میان‌وعده: </span>{d.snack || "—"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
