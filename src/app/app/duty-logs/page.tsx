"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookMarked, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber, todayJalali } from "@/lib/persian";
import { ROLE_LABELS } from "@/lib/roles";
import { useLang } from "@/lib/i18n";

type Row = { id: string; category: string; text: string; createdAt: string; mine: boolean; author: { firstName: string; lastName: string; role: string } | null };
type Data = { date: string; items: Row[] };

const CATS = ["NOTE", "INCIDENT", "HANDOVER"] as const;

function timeOf(iso: string) {
  const d = new Date(iso);
  return faNumber(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
}

export default function DutyLogsPage() {
  const { t } = useLang();
  const [date, setDate] = useState(todayJalali());
  const { data, loading, error, refetch } = useApi<Data>(`/api/duty-logs?date=${date}`, [date]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string>("NOTE");
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (text.trim().length < 3) { toast.error(t("dutyLogs.f.text")); return; }
    setBusy(true);
    try {
      await apiPost("/api/duty-logs", { text, category, date });
      setText("");
      toast.success(t("dutyLogs.addedToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/duty-logs?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("dutyLogs.title")} desc={t("dutyLogs.desc")} />

      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><BookMarked className="w-5 h-5" /> {t("dutyLogs.writeTitle")}</h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("dutyLogs.title")}>
          {CATS.map((c) => (
            <button key={c} role="tab" aria-selected={category === c} className={`px-3 min-h-11 rounded-full border text-sm ${category === c ? "bg-primary text-primary-foreground border-primary" : "border-border"}`} onClick={() => setCategory(c)}>
              {t(`dutyLogs.cat.${c}`)}
            </button>
          ))}
        </div>
        <textarea className="b-input w-full min-h-24" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("dutyLogs.f.text")} aria-label={t("dutyLogs.f.text")} />
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookMarked className="w-4 h-4" />} {t("dutyLogs.add")}
        </button>
      </section>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground" htmlFor="duty-date">{t("dutyLogs.dateLabel")}</label>
        <input id="duty-date" className="b-input min-h-11" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1405-08-10" />
        <button className="b-btn b-btn-ghost min-h-11" onClick={() => setDate(todayJalali())}>{t("dutyLogs.today")}</button>
      </div>

      {data.items.length === 0 ? (
        <EmptyState title={t("dutyLogs.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.category === "INCIDENT" ? "bg-destructive/15 text-destructive" : r.category === "HANDOVER" ? "bg-info/15 text-info" : "bg-muted"}`}>
                  {t(`dutyLogs.cat.${r.category}`)}
                </span>
                <span className="font-medium">{r.author ? `${r.author.firstName} ${r.author.lastName}` : ""}</span>
                {r.author && <span className="text-muted-foreground">{ROLE_LABELS[r.author.role] ?? r.author.role}</span>}
                <span className="text-muted-foreground">{timeOf(r.createdAt)}</span>
                {r.mine && (
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive ms-auto" onClick={() => remove(r.id)}>
                    <Trash2 className="w-4 h-4" /> {t("dutyLogs.delete")}
                  </button>
                )}
              </div>
              <p className="text-sm leading-7 whitespace-pre-line">{r.text}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
