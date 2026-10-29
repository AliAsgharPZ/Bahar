"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client";
import { faNumber, formatDateFa, formatTimeFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Meeting = { id: string; topic: string; note: string | null; slotStart: string; slotEnd: string; status: string; reviewNote: string | null; student: { user: { firstName: string; lastName: string } } | null; requestedBy: { id: string; firstName: string; lastName: string; role: string }; staff: { id: string; firstName: string; lastName: string; role: string } };
type Staff = { id: string; firstName: string; lastName: string; role: string };
type Kid = { studentId: string; student: { user: { firstName: string; lastName: string } } };
const STATUS_TKEY: Record<string, string> = { PENDING: "meetings.status.PENDING", APPROVED: "dashboard.meeting.approved", REJECTED: "meetings.status.REJECTED", DONE: "meetings.status.DONE", CANCELED: "meetings.status.CANCELED" };

export default function MeetingsPage() {
  const { t } = useLang();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [myKids, setMyKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string>("");
  const [form, setForm] = useState({ staffId: "", studentId: "", topic: "", note: "", date: "", time: "" });

  useEffect(() => {
    apiGet<{ user: { id: string; role: string } }>("/api/auth/me")
      .then((d) => { setMeId(d.user.id); setMeRole(d.user.role); })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    apiGet<{ meetings: Meeting[]; staff: Staff[]; myKids: Kid[] }>("/api/meetings")
      .then((d) => { setMeetings(d.meetings); setStaff(d.staff); setMyKids(d.myKids); })
      .catch((e) => setError(e instanceof Error ? e.message : t("meetings.error.load")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  // پاسخ فقط توسط کارمند مربوطه یا مدیر مدرسه
  const canRespond = (m: Meeting) =>
    !!meId && (m.staff.id === meId || ["MANAGER", "SUPER_ADMIN", "ADMIN"].includes(meRole));
  // لغو درخواست فقط توسط خودِ درخواست‌کننده (ولی) پیش از پاسخ
  const canCancel = (m: Meeting) => !!meId && m.requestedBy.id === meId && m.status === "PENDING";

  const isParent = myKids.length > 0;
  async function submit() {
    if (!form.staffId || !form.topic || !form.date || !form.time) { toast.error(t("meetings.toast.required")); return; }
    const start = new Date(`${form.date}T${form.time}`);
    const end = new Date(start.getTime() + 30 * 60000);
    if (isNaN(start.getTime())) { toast.error(t("meetings.toast.invalidDate")); return; }
    if (start.getTime() < Date.now()) { toast.error(t("meetings.toast.pastDate")); return; }
    try {
      await apiPost("/api/meetings", { action: "request", staffId: form.staffId, studentId: form.studentId || undefined, topic: form.topic, note: form.note || undefined, slotStart: start.toISOString(), slotEnd: end.toISOString() });
      toast.success(t("meetings.toast.requested"));
      setForm({ staffId: "", studentId: "", topic: "", note: "", date: "", time: "" }); setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function respond(id: string, status: string) {
    try { await apiPost("/api/meetings", { action: "respond", meetingId: id, status }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBox message={error} />;
  return (
    <div>
      <PageHeader
        title={t("nav.meetings")}
        desc={isParent ? t("meetings.desc.parent") : t("meetings.desc.staff")}
        action={isParent && <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("meetings.book")}</button>}
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <Select
            value={form.staffId}
            onChange={(v) => setForm({ ...form, staffId: v })}
            options={[{ value: "", label: t("meetings.field.staff") }, ...staff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))]}
            placeholder={t("meetings.field.staff")}
            className="w-full"
            buttonClassName="!w-full"
          />
          <Select
            value={form.studentId}
            onChange={(v) => setForm({ ...form, studentId: v })}
            options={[{ value: "", label: t("meetings.field.child") }, ...myKids.map((k) => ({ value: k.studentId, label: `${k.student.user.firstName} ${k.student.user.lastName}` }))]}
            placeholder={t("meetings.field.child")}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder={t("meetings.field.topic")} className="b-input" />
          <div className="flex gap-2">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="b-input" />
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="b-input" />
          </div>
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("meetings.field.note")} className="b-input sm:col-span-2 !min-h-[60px]" />
          <button onClick={submit} className="b-btn b-btn-sm b-btn-spring sm:col-span-2 w-fit">{t("meetings.submitRequest")}</button>
        </div>
      )}
      {meetings.length === 0 ? <EmptyState icon={Handshake} title={t("meetings.empty")} /> : (
        <div className="flex flex-col gap-2.5">
          {meetings.map((m) => (
            <div key={m.id} className="b-card-sm p-4 flex items-center gap-3 flex-wrap">
              <span className={`b-badge ${m.status === "APPROVED" ? "b-badge-success" : m.status === "PENDING" ? "b-badge-warning" : m.status === "REJECTED" ? "b-badge-critical" : "b-badge-neutral"}`}>{STATUS_TKEY[m.status] ? t(STATUS_TKEY[m.status]) : m.status}</span>
              <span className="text-[13px] font-bold">{m.topic}</span>
              {m.student && <span className="text-[11.5px] text-steel">{t("meetings.about")} {m.student.user.firstName} {m.student.user.lastName}</span>}
              <span className="text-[11px] text-steel flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateFa(m.slotStart)} · {formatTimeFa(m.slotStart)}</span>
              <span className="text-[11px] text-stone ms-auto">{m.requestedBy.firstName} ↔ {m.staff.firstName} {m.staff.lastName}</span>
              {m.status === "PENDING" && canRespond(m) && (
                <span className="flex gap-1.5">
                  <button onClick={() => respond(m.id, "APPROVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[26px] !text-[10px] !px-2 !py-0">{t("meetings.confirm")}</button>
                  <button onClick={() => respond(m.id, "REJECTED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0 !text-destructive">{t("meetings.reject")}</button>
                </span>
              )}
              {m.status === "APPROVED" && canRespond(m) && <button onClick={() => respond(m.id, "DONE")} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0">{t("meetings.done")}</button>}
              {canCancel(m) && (
                <button onClick={() => respond(m.id, "CANCELED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0 !text-destructive">{t("meetings.cancelRequest")}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
