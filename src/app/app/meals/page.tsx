"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2, Save, Trash2 } from "lucide-react";
import { useApi, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { jalaliDayOfWeek } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Day = { weekday: number; id?: string | null; breakfast: string; lunch: string; snack: string };
type Me = { user: { role: string } };

const DAY_TKEY = ["", "meals.day.sat", "meals.day.sun", "meals.day.mon", "meals.day.tue", "meals.day.wed", "meals.day.thu", "meals.day.fri"];

export default function MealsPage() {
  const { t } = useLang();
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
      if (!res.ok) throw new Error(j?.error?.message ?? t("common.errorShort"));
      toast.success(`${t("meals.menu")} ${DAY_TKEY[day.weekday] ? t(DAY_TKEY[day.weekday]) : ""} ${t("meals.saved")}`);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSavingDay(0); }
  }

  const plan = data?.plan ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("meals.title")} desc={t("meals.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && plan.every((d) => !d.breakfast && !d.lunch && !d.snack) && !isManager && (
        <EmptyState icon={UtensilsCrossed} title={t("meals.empty")} />
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 b-auto-stagger">
        {plan.map((d) => {
          const val = drafts[d.weekday] ?? d;
          const set = (patch: Partial<Day>) => setDrafts((prev) => ({ ...prev, [d.weekday]: { ...val, ...patch } }));
          const isToday = d.weekday === today;
          return (
            <div key={d.weekday} className={`b-card-md p-5 flex flex-col gap-2.5 ${isToday ? "b-grad-border" : ""}`}>
              <span className="flex items-center justify-between">
                <b className="text-[14px]">{DAY_TKEY[d.weekday] ? t(DAY_TKEY[d.weekday]) : ""}</b>
                {isToday && <span className="b-badge b-badge-spring">{t("dashboard.today")}</span>}
              </span>
              {isManager ? (
                <>
                  <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-steel">{t("meals.breakfast")}</span>
                    <input className="b-input" value={val.breakfast} onChange={(e) => set({ breakfast: e.target.value })} placeholder="…" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-steel">{t("meals.lunch")}</span>
                    <input className="b-input" value={val.lunch} onChange={(e) => set({ lunch: e.target.value })} placeholder="…" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[12px] font-bold text-steel">{t("meals.snack")}</span>
                    <input className="b-input" value={val.snack} onChange={(e) => set({ snack: e.target.value })} placeholder="…" /></label>
                  <span className="flex gap-1.5">
                    <button className="b-btn b-btn-spring b-btn-sm self-start" disabled={savingDay === d.weekday} onClick={() => save(val)}>
                      {savingDay === d.weekday ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("common.save")}
                    </button>
                    {val.id && (
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={async () => { if (!window.confirm(`${t("meals.menu")} ${DAY_TKEY[d.weekday] ? t(DAY_TKEY[d.weekday]) : ""} ${t("meals.deleteConfirmSuffix")}`)) return; try { await apiDelete(`/api/meals?id=${val.id}`); toast.success(t("meals.toast.deleted")); setDrafts((prev) => { const n = { ...prev }; delete n[d.weekday]; return n; }); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                        <Trash2 className="w-4 h-4" /> {t("meals.deleteMenu")}
                      </button>
                    )}
                  </span>
                </>
              ) : (
                <div className="flex flex-col gap-1.5 text-[14px]">
                  <span><span className="text-steel">{t("meals.label.breakfast")} </span>{d.breakfast || "—"}</span>
                  <span><span className="text-steel">{t("meals.label.lunch")} </span>{d.lunch || "—"}</span>
                  <span><span className="text-steel">{t("meals.label.snack")} </span>{d.snack || "—"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
