"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; subject: string; className: string; originalDate: string; newDate: string; room: string | null; teacherName: string | null; note: string | null };
type Data = { isStaff: boolean; classes: { id: string; name: string }[]; items: Row[] };

export default function MakeupClassesPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/makeup-classes");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [orig, setOrig] = useState("");
  const [newDate, setNewDate] = useState("");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!classId || !subject.trim() || !newDate.trim()) { toast.error(t("makeup.f.newDate")); return; }
    setBusy(true);
    try {
      const res = await apiPost<{ notified: number }>("/api/makeup-classes", { classId, subject, originalDate: orig || undefined, newDate, room: room || undefined });
      setSubject(""); setOrig(""); setNewDate(""); setRoom("");
      toast.success(`${t("makeup.addedToast")} — ${faNumber(res.notified)} ${t("makeup.notified")}`);
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/makeup-classes?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("makeup.title")} desc={t("makeup.desc")} />
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><CalendarPlus className="w-5 h-5" /> {t("makeup.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={classId} onChange={(e) => setClassId(e.target.value)} aria-label={t("makeup.f.class")}>
              <option value="">{t("makeup.f.class")}</option>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="b-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("makeup.f.subject")} />
            <input className="b-input w-full" dir="ltr" value={orig} onChange={(e) => setOrig(e.target.value)} placeholder={t("makeup.f.orig")} />
            <input className="b-input w-full" dir="ltr" value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder={t("makeup.f.newDate")} />
            <input className="b-input w-full" value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t("makeup.f.room")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />} {t("makeup.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("makeup.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.subject} — {r.className}</p>
                {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("makeup.delete")}><Trash2 className="w-4 h-4" /></button>}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("makeup.from")} {faNumber(r.originalDate)} ← {t("makeup.to")} <b className="text-foreground">{faNumber(r.newDate)}</b>
                {r.room ? ` · ${r.room}` : ""}{r.teacherName ? ` · ${r.teacherName}` : ""}
              </p>
              {r.note && <p className="text-sm">{r.note}</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
