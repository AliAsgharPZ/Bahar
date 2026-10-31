"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

const faToEn = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
import { useLang } from "@/lib/i18n";

type Row = { id: string; duty: string; userId: string; name: string; note: string | null; mine: boolean };
type Data = { date: string; teachers: { id: string; firstName: string; lastName: string }[]; items: Row[] };

const DUTIES = ["ناظم حیاط", "ناظم صف صبحگاه", "ناظم راهرو", "ناظم سالن غذاخوری", "ناظم درب خروج", "کشیک کتابخانه", "غیره"];

export default function DutyRosterPage() {
  const { t } = useLang();
  const [date, setDate] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/duty-roster${date ? `?date=${encodeURIComponent(date)}` : ""}`, [date]);
  const [duty, setDuty] = useState(DUTIES[0]);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!userId) { toast.error(t("roster.f.teacher")); return; }
    setBusy(true);
    try { await apiPost("/api/duty-roster", { date: date || data.date, duty, userId }); toast.success(t("roster.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/duty-roster?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("roster.title")} desc={t("roster.desc")} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="roster-date">{t("roster.date")}</label>
        <input id="roster-date" className="b-input" dir="ltr" value={date} onChange={(e) => setDate(faToEn(e.target.value))} placeholder="1404-08-10" />
        <span className="text-sm text-muted-foreground">{t("roster.showing")} {faNumber(data.date)}</span>
      </div>
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5" /> {t("roster.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="b-input w-full" value={duty} onChange={(e) => setDuty(e.target.value)} aria-label={t("roster.f.duty")}>
            {DUTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="b-input w-full" value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t("roster.f.teacher")}>
            <option value="">{t("roster.f.teacher")}</option>
            {data.teachers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} {t("roster.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("roster.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.duty}{r.mine ? ` · ${t("roster.mine")}` : ""}</p>
                <p className="text-sm text-muted-foreground">{r.name}{r.note ? ` · ${r.note}` : ""}</p>
              </div>
              <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("roster.delete")}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
