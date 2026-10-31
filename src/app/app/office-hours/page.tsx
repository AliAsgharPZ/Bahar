"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Row = { id: string; teacherUserId: string; teacherName: string; weekday: string; timeText: string; room: string | null };
type Data = { isStaff: boolean; myUserId: string; items: Row[] };

const WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه"];

export default function OfficeHoursPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/office-hours");
  const [weekday, setWeekday] = useState(WEEKDAYS[0]);
  const [timeText, setTimeText] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!timeText.trim()) { toast.error(t("hours.f.time")); return; }
    setBusy(true);
    try { await apiPost("/api/office-hours", { weekday, timeText, room: room || undefined }); setTimeText(""); setRoom(""); toast.success(t("hours.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/office-hours?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("hours.title")} desc={t("hours.desc")} />
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Clock className="w-5 h-5" /> {t("hours.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="b-input w-full" value={weekday} onChange={(e) => setWeekday(e.target.value)} aria-label={t("hours.f.weekday")}>
              {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <input className="b-input w-full" value={timeText} onChange={(e) => setTimeText(e.target.value)} placeholder={t("hours.f.time")} />
            <input className="b-input w-full" value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t("hours.f.room")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} {t("hours.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("hours.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-bold">{r.teacherName}</p>
                <p className="text-sm text-muted-foreground">{r.weekday} · {r.timeText}{r.room ? ` · ${r.room}` : ""}</p>
              </div>
              {r.teacherUserId === data.myUserId && (
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("hours.delete")}><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
