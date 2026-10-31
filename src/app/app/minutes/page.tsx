"use client";

import { useState } from "react";
import { toast } from "sonner";
import { NotebookText, Loader2, Save, Trash2, Plus, CheckCircle2, Circle } from "lucide-react";
import { useApi, apiPost, apiDelete, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber, formatDateFa } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type ActionRow = { id: string; text: string; ownerId: string | null; ownerName: string | null; due: string | null; done: boolean };
type MinuteRow = {
  id: string; title: string; kind: string; date: string; authorName: string;
  attendeeNames: string[]; agenda: string | null; decisions: string | null;
  actions: ActionRow[]; openActions: number;
};
type MinutesData = {
  minutes: MinuteRow[];
  staff: { id: string; name: string; role: string }[];
  kinds: { key: string; label: string }[];
  canWrite: boolean;
  myId: string;
};
type DraftAction = { text: string; ownerId: string; due: string };

export default function MinutesPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<MinutesData>("/api/minutes");
  const canWrite = data?.canWrite ?? false;
  const myId = data?.myId ?? "";

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("STAFF");
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [agenda, setAgenda] = useState("");
  const [decisions, setDecisions] = useState("");
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) { toast.error(t("minutes.err.title")); return; }
    setSaving(true);
    try {
      await apiPost("/api/minutes", {
        title, kind, date: date || undefined, attendees, agenda, decisions,
        actions: actions.filter((a) => a.text.trim()).map((a) => ({ text: a.text, ownerId: a.ownerId || null, due: a.due || null })),
      });
      toast.success(t("minutes.toast.saved"));
      setTitle(""); setDate(""); setAttendees([]); setAgenda(""); setDecisions(""); setActions([]);
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm(t("minutes.deleteConfirm"))) return;
    try {
      await apiDelete(`/api/minutes?id=${id}`);
      toast.success(t("minutes.toast.deleted"));
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
  }

  async function toggleAction(minuteId: string, action: ActionRow) {
    try {
      await apiPatch("/api/minutes", { id: minuteId, actionId: action.id, done: !action.done });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
  }

  function toggleAttendee(id: string) {
    setAttendees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("minutes.title")} desc={t("minutes.desc")} />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {data && canWrite && (
        <div className="b-card p-5 flex flex-col gap-4">
          <b className="text-[14px] flex items-center gap-2"><NotebookText className="w-4 h-4 text-spring" /> {t("minutes.new")}</b>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5 sm:col-span-1">
              <span className="text-[12px] font-bold">{t("minutes.meetingTitle")}</span>
              <input className="b-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("minutes.meetingTitlePlaceholder")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("minutes.kind")}</span>
              <Select value={kind} onChange={setKind} options={data.kinds.map((k) => ({ value: k.key, label: t(`minutes.kind.${k.key}`) }))} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("minutes.date")}</span>
              <input type="date" className="b-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold">{t("minutes.attendees")}</span>
            <div className="flex gap-2 flex-wrap">
              {data.staff.map((u) => (
                <button
                  key={u.id} type="button" aria-pressed={attendees.includes(u.id)}
                  className={`b-pill-tab ${attendees.includes(u.id) ? "b-pill-tab-active" : ""}`}
                  onClick={() => toggleAttendee(u.id)}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("minutes.agenda")}</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder={t("minutes.agendaPlaceholder")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("minutes.decisions")}</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={decisions} onChange={(e) => setDecisions(e.target.value)} placeholder={t("minutes.decisionsPlaceholder")} />
            </label>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold">{t("minutes.actions")}</span>
            {actions.map((a, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_180px_150px_auto] gap-2 items-center">
                <input
                  className="b-input" value={a.text} placeholder={t("minutes.actionText")}
                  onChange={(e) => setActions((prev) => prev.map((x, xi) => (xi === i ? { ...x, text: e.target.value } : x)))}
                />
                <Select
                  value={a.ownerId} placeholder={t("minutes.actionNoOwner")}
                  options={[{ value: "", label: t("minutes.actionNoOwner") }, ...data.staff.map((u) => ({ value: u.id, label: u.name }))]}
                  onChange={(v) => setActions((prev) => prev.map((x, xi) => (xi === i ? { ...x, ownerId: v } : x)))}
                />
                <input
                  type="date" className="b-input" value={a.due} aria-label={t("minutes.actionDue")}
                  onChange={(e) => setActions((prev) => prev.map((x, xi) => (xi === i ? { ...x, due: e.target.value } : x)))}
                />
                <button
                  type="button" aria-label={t("minutes.delete")}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setActions((prev) => prev.filter((_, xi) => xi !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" className="b-btn b-btn-soft b-btn-sm self-start" onClick={() => setActions((prev) => [...prev, { text: "", ownerId: "", due: "" }])}>
              <Plus className="w-3.5 h-3.5" /> {t("minutes.addAction")}
            </button>
          </div>

          <button className="b-btn b-btn-spring self-start" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("minutes.save")}
          </button>
        </div>
      )}

      {data && data.minutes.length === 0 && <EmptyState icon={NotebookText} title={t("minutes.empty")} />}

      {data && data.minutes.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.minutes.map((m) => (
            <article key={m.id} className="b-card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <b className="text-[14px]">{m.title}</b>
                <span className="b-badge b-badge-neutral">{t(`minutes.kind.${m.kind}`)}</span>
                <span className="text-[12px] text-steel">{formatDateFa(m.date)}</span>
                {m.openActions > 0 && <span className="b-badge b-badge-spring">{faNumber(m.openActions)} {t("minutes.openActions")}</span>}
                {canWrite && (
                  <button
                    type="button" aria-label={t("minutes.delete")}
                    className="ms-auto w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove(m.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {m.attendeeNames.length > 0 && (
                <p className="text-[12.5px] text-steel">{t("minutes.attendees")}: {m.attendeeNames.join("، ")}</p>
              )}
              {(m.agenda || m.decisions) && (
                <div className="grid md:grid-cols-2 gap-3 text-[12.5px] leading-relaxed">
                  {m.agenda && <p><b className="block text-[12px] mb-1">{t("minutes.agenda")}</b>{m.agenda}</p>}
                  {m.decisions && <p><b className="block text-[12px] mb-1">{t("minutes.decisions")}</b>{m.decisions}</p>}
                </div>
              )}
              {m.actions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <b className="text-[12px]">{t("minutes.actions")}</b>
                  {m.actions.map((a) => {
                    const mine = a.ownerId === myId;
                    const canToggle = canWrite || mine;
                    return (
                      <div key={a.id} className="flex items-center gap-2.5 text-[12.5px]">
                        <button
                          type="button" disabled={!canToggle}
                          aria-label={t("minutes.done")} aria-pressed={a.done}
                          className={a.done ? "text-spring" : "text-steel"}
                          onClick={() => canToggle && toggleAction(m.id, a)}
                        >
                          {a.done ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Circle className="w-4.5 h-4.5" />}
                        </button>
                        <span className={a.done ? "line-through text-steel" : ""}>{a.text}</span>
                        {a.ownerName && <span className="b-badge b-badge-neutral">{a.ownerName}</span>}
                        {a.due && <span className="text-[12px] text-steel">{t("minutes.actionDue")}: {a.due}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <span className="text-[12px] text-steel">{t("minutes.author")}: {m.authorName}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
