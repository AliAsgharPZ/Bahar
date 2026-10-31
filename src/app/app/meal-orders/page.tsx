"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; item: string; status: string; studentName: string; className: string | null; mine: boolean };
type Data = { isKitchen: boolean; date: string; summary: { item: string; count: number }[]; items: Row[] };

export default function MealOrdersPage() {
  const { t } = useLang();
  const [date, setDate] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/meal-orders${date ? `?date=${encodeURIComponent(date)}` : ""}`, [date]);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!item.trim()) { toast.error(t("meals2.f.item")); return; }
    setBusy(true);
    try { await apiPost("/api/meal-orders", { item, date: date || data.date }); setItem(""); toast.success(t("meals2.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const patch = async (id: string, status: string) => {
    try { await apiPatch("/api/meal-orders", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("meals2.title")} desc={t("meals2.desc")} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="meal-date">{t("meals2.date")}</label>
        <input id="meal-date" className="b-input" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1404-08-10" />
        <span className="text-sm text-muted-foreground">{faNumber(data.date)}</span>
      </div>
      {data.summary.length > 0 && (
        <section className="b-card p-4">
          <h2 className="font-bold mb-2">{t("meals2.summary")}</h2>
          <div className="flex flex-wrap gap-2">
            {data.summary.map((s) => (
              <span key={s.item} className="px-3 py-1 rounded-full bg-primary/10 text-sm">{s.item}: {faNumber(s.count)}</span>
            ))}
          </div>
        </section>
      )}
      {!data.isKitchen && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><UtensilsCrossed className="w-5 h-5" /> {t("meals2.addTitle")}</h2>
          <div className="flex gap-2">
            <input className="b-input flex-1" value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("meals2.f.item")} />
            <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UtensilsCrossed className="w-4 h-4" />} {t("meals2.add")}
            </button>
          </div>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("meals2.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-44">
                <p className="font-bold">{r.item}</p>
                <p className="text-sm text-muted-foreground">{r.studentName}{r.className ? ` · ${r.className}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "DELIVERED" ? "bg-success/15 text-success" : r.status === "CANCELLED" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"}`}>
                {t(`meals2.status.${r.status}`)}
              </span>
              {data.isKitchen && r.status === "ORDERED" && <button className="b-btn b-btn-primary min-h-11" onClick={() => patch(r.id, "DELIVERED")}>{t("meals2.deliver")}</button>}
              {r.mine && r.status === "ORDERED" && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => patch(r.id, "CANCELLED")}>{t("meals2.cancel")}</button>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
