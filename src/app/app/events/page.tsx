"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Sparkles, MapPin, CalendarDays } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { formatDateFa, formatTimeFa, faNumber, EVENT_KIND_LABELS, AUDIENCE_LABELS } from "@/lib/persian";

type Event = {
  id: string; title: string; description: string | null; startAt: string; endAt: string | null;
  kind: string; audience: string; class: { id: string; name: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
};
type ClassRow = { id: string; name: string };
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };

const KIND_COLORS: Record<string, string> = {
  MEETING: "b-badge-spring",
  CEREMONY: "b-badge-blossom",
  EXAM: "b-badge-critical",
  HOLIDAY: "b-badge-neutral",
  TRIP: "b-badge-spring",
  WORKSHOP: "b-badge-warning",
  OTHER: "b-badge-neutral",
};

export default function EventsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  // هم‌راستا با سرور: ادمین بدون manage_events دکمه نمی‌بیند (قبلاً دکمه می‌دید و 403 می‌خورد)
  // FIX (راند ۱۶): سوپرادمین فقط داخل پنل مدرسه (API مدرسه می‌خواهد)
  const canCreate = me?.user.role === "MANAGER" || (Boolean(me?.user.actingSchool) && me?.user.role === "SUPER_ADMIN") || Boolean(me?.user.permissions.includes("manage_events"));
  const confirm = useConfirm();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", startAt: "", endAt: "", kind: "MEETING", audience: "ALL", classId: "" });
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useApi<{ events: Event[] }>("/api/events");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(canCreate ? "/api/classes" : null);

  const now = Date.now();
  const upcoming = (data?.events ?? []).filter((e) => new Date(e.startAt).getTime() >= now);
  const past = (data?.events ?? []).filter((e) => new Date(e.startAt).getTime() < now);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/events", { ...form, endAt: form.endAt || undefined, classId: form.audience === "CLASS" ? form.classId : undefined });
      toast.success("رویداد ایجاد شد.");
      setShow(false);
      setForm({ title: "", description: "", startAt: "", endAt: "", kind: "MEETING", audience: "ALL", classId: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "حذف رویداد", description: "این رویداد حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/events/${id}`);
      toast.success("حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  function EventCard({ ev, dim }: { ev: Event; dim?: boolean }) {
    return (
      <div className={`b-card-md p-6 flex flex-col gap-3 ${dim ? "opacity-70" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <b className="text-[15px]">{ev.title}</b>
            <span className="text-[12px] text-steel flex items-center gap-2 flex-wrap">
              <span className={`b-badge ${KIND_COLORS[ev.kind] ?? "b-badge-neutral"}`}>{EVENT_KIND_LABELS[ev.kind] ?? ev.kind}</span>
              <span className="b-badge b-badge-neutral">{ev.audience === "CLASS" ? `کلاس ${ev.class?.name ?? ""}` : AUDIENCE_LABELS[ev.audience]}</span>
            </span>
          </div>
          {canCreate && (
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => remove(ev.id)} aria-label="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {ev.description && <p className="t-sm text-steel leading-relaxed">{ev.description}</p>}
        <div className="flex items-center gap-4 text-[12px] text-steel flex-wrap">
          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {formatDateFa(ev.startAt)} · {formatTimeFa(ev.startAt)}</span>
          {ev.endAt && <span>تا {formatDateFa(ev.endAt)}</span>}
          {ev.createdBy && <span>· ثبت: {ev.createdBy.firstName} {ev.createdBy.lastName}</span>}
        </div>
      </div>
    );
  }

  // خروجی تقویم iCalendar — رویدادها در تقویم گوشی/گوگل‌کالندر وارد می‌شوند
  function downloadIcs() {
    const esc = (s: string) => s.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
    const stamp = (d: Date) => d.toISOString().replaceAll("-", "").replaceAll(":", "").split(".")[0] + "Z";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bahar//School Events//FA", "CALSCALE:GREGORIAN"];
    for (const ev of data?.events ?? []) {
      const start = new Date(ev.startAt);
      const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 3600000);
      lines.push("BEGIN:VEVENT", `UID:${ev.id}@bahar`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(ev.title)}`);
      if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bahar-events.ics";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("فایل تقویم دانلود شد — در تقویم گوشی یا گوگل‌کالندر واردش کنید.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="رویدادها"
        desc="جلسات، امتحانات، مراسم، گردش‌های علمی و کارگاه‌های مدرسه."
        action={
          <span className="flex gap-2">
            {data && data.events.length > 0 && (
              <button className="b-btn b-btn-soft b-btn-sm" onClick={downloadIcs}>
                <CalendarDays className="w-4 h-4" /> خروجی تقویم (iCal)
              </button>
            )}
            {canCreate && (
              <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShow(true)}>
                <Plus className="w-4 h-4" /> رویداد جدید
              </button>
            )}
          </span>
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.events.length === 0 && <EmptyState icon={Sparkles} title="رویدادی ثبت نشده" />}

      {upcoming.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3">پیش‌رو ({faNumber(upcoming.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4">{upcoming.map((e) => <EventCard key={e.id} ev={e} />)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="font-bold text-[14px] mb-3 text-steel">گذشته ({faNumber(past.length)})</h3>
          <div className="grid md:grid-cols-2 gap-4">{past.map((e) => <EventCard key={e.id} ev={e} dim />)}</div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setShow(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-6">رویداد جدید</h2>
            <form onSubmit={create} className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">عنوان *</span>
                <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="مثلاً جلسه اولیا و مربیان" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">نوع</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.kind}
                  onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                  options={Object.entries(EVENT_KIND_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">مخاطب</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={form.audience}
                  onChange={(v) => setForm((f) => ({ ...f, audience: v }))}
                  options={[...Object.entries(AUDIENCE_LABELS).filter(([k]) => k !== "CLASS").map(([k, v]) => ({ value: k, label: v })), { value: "CLASS", label: "کلاس خاص" }]}
                />
              </label>
              {form.audience === "CLASS" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">کلاس *</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.classId}
                    onChange={(v) => setForm((f) => ({ ...f, classId: v }))}
                    options={[{ value: "", label: "—" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]}
                    placeholder="—"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">شروع *</span>
                <input className="b-input" dir="ltr" type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">پایان</span>
                <input className="b-input" dir="ltr" type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12.5px] font-bold">توضیحات</span>
                <textarea className="b-input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </label>
              <div className="sm:col-span-2 flex items-center gap-3 mt-2">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ایجاد رویداد"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShow(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
