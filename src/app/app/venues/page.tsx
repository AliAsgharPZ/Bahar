"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Landmark, Presentation, Dumbbell, Trophy, Plus, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber, formatDateFa, formatTimeFa } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Room = { id: string; name: string; kind: string; capacity: number; floor: number | null; note: string | null; active: boolean };
type Booking = { id: string; roomId: string | null; room: { name: string } | null; by: { firstName: string; lastName: string }; purpose: string; startAt: string; endAt: string; status: string };
type Me = { user: { role: string } };

const VENUE_KINDS = ["HALL", "CONFERENCE", "SPORT", "FIELD"] as const;
const KIND_LABEL: Record<string, string> = { HALL: "سالن", CONFERENCE: "سالن همایش", SPORT: "سالن ورزشی", FIELD: "زمین ورزشی" };
const KIND_ICON: Record<string, typeof Landmark> = { HALL: Landmark, CONFERENCE: Presentation, SPORT: Dumbbell, FIELD: Trophy };

export default function VenuesPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<{ rooms: Room[]; bookings: Booking[] }>("/api/facilities?kind=rooms");
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(role);
  const [filter, setFilter] = useState<string>("ALL");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "HALL", capacity: "200", floor: "", note: "" });
  const [showBooking, setShowBooking] = useState<string | null>(null);
  const [bForm, setBForm] = useState({ startAt: "", endAt: "", purpose: "" });

  const rooms = (data?.rooms ?? []).filter((r) => VENUE_KINDS.includes(r.kind as (typeof VENUE_KINDS)[number]));
  const kindOf = new Map(rooms.map((r) => [r.id, r.kind]));
  const upcoming = (data?.bookings ?? []).filter(
    (b) => b.roomId && VENUE_KINDS.includes((kindOf.get(b.roomId) ?? "") as (typeof VENUE_KINDS)[number]) && new Date(b.endAt).getTime() >= Date.now(),
  );
  const shown = filter === "ALL" ? rooms : rooms.filter((r) => r.kind === filter);

  async function createVenue() {
    if (!form.name.trim()) { toast.error("نام محل لازم است."); return; }
    try {
      await apiPost("/api/facilities", { kind: "room", name: form.name.trim(), roomKind: form.kind, capacity: Number(form.capacity) || 30, floor: form.floor ? Number(form.floor) : null, note: form.note.trim() || null });
      toast.success(t("facilities.sbt-shd"));
      setShowNew(false); setForm({ name: "", kind: "HALL", capacity: "200", floor: "", note: "" }); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  async function deleteVenue(id: string) {
    try { await apiDelete(`/api/facilities?kind=room&id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  async function createBooking(venueId: string) {
    if (!bForm.startAt || !bForm.endAt || !bForm.purpose.trim()) { toast.error("بازه و دلیل رزرو لازم است."); return; }
    try {
      await apiPost("/api/facilities", { kind: "booking", targetType: "ROOM", targetId: venueId, startAt: bForm.startAt, endAt: bForm.endAt, purpose: bForm.purpose.trim() });
      toast.success(t("facilities.sbt-shd"));
      setShowBooking(null); setBForm({ startAt: "", endAt: "", purpose: "" }); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  async function setBookingStatus(id: string, status: string) {
    try { await apiPatch("/api/facilities", { kind: "booking", id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="محل‌ها و سالن‌ها"
        desc="سالن همایش، سالن، سالن ورزشی و زمین ورزشی مدرسه — با رزرو و جلوگیری از تداخل بازه‌ها"
        action={isManager ? (
          <button onClick={() => setShowNew(!showNew)} className="b-btn b-btn-spring"><Plus className="w-4 h-4" /> محل جدید</button>
        ) : undefined}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="b-card-sm p-4"><p className="text-[12px] text-steel">همهٔ محل‌ها</p><p className="text-[20px] font-bold">{faNumber(rooms.length)}</p></div>
        {VENUE_KINDS.map((k) => (
          <div key={k} className="b-card-sm p-4"><p className="text-[12px] text-steel">{KIND_LABEL[k]}</p><p className="text-[20px] font-bold">{faNumber(rooms.filter((r) => r.kind === k).length)}</p></div>
        ))}
      </div>
      <div className="b-card-sm p-4 flex items-center gap-3">
        <span className="text-[12px] text-steel">رزروهای پیش رو:</span>
        <b className="text-[14px]">{faNumber(upcoming.length)}</b>
      </div>

      {showNew && isManager && (
        <div className="b-card-md p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام محل *" className="b-input" />
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={VENUE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder={t("facilities.zrfyt")} className="b-input" />
          <input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="طبقه (اختیاری)" className="b-input" />
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="محل و توضیح (مثلاً حیاط شمالی، چمن مصنوعی)" className="b-input lg:col-span-4" />
          <button onClick={createVenue} className="b-btn b-btn-spring">{t("facilities.sbt")}</button>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto b-scroll pb-1">
        {[{ value: "ALL", label: "همه" }, ...VENUE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))].map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} className={`b-pill-tab ${filter === f.value ? "b-pill-tab-active" : ""}`}>{f.label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Landmark} title="محلی ثبت نشده است" desc="از دکمهٔ «محل جدید» یک سالن همایش، سالن، سالن ورزشی یا زمین ورزشی اضافه کنید." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => {
            const Icon = KIND_ICON[r.kind] ?? Landmark;
            const venueBookings = upcoming.filter((b) => b.roomId === r.id);
            return (
              <div key={r.id} className="b-card-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-spring-tint text-spring-deep flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
                    <b className="text-[14px] truncate">{r.name}</b>
                  </span>
                  {isManager && (
                    <button onClick={() => deleteVenue(r.id)} className="b-btn b-btn-ghost text-stone hover:text-destructive shrink-0" aria-label="حذف محل"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
                <p className="text-[12px] text-steel">
                  <span className="b-badge b-badge-neutral">{KIND_LABEL[r.kind] ?? r.kind}</span>
                  <span className="ms-2">{t("facilities.zrfyt")} {faNumber(r.capacity)} {t("dashboard.unit.person")}</span>
                  {r.floor !== null && <span className="ms-2">{t("facilities.tbqh")} {faNumber(r.floor)}</span>}
                </p>
                {r.note && <p className="text-[12px] text-steel">{r.note}</p>}
                {venueBookings.length > 0 && (
                  <p className="text-[12px] text-steel">{faNumber(venueBookings.length)} رزرو پیش رو</p>
                )}
                <button onClick={() => setShowBooking(showBooking === r.id ? null : r.id)} className="b-btn b-btn-sm b-btn-ghost w-fit">{t("facilities.rzrv-jdyd")}</button>
                {showBooking === r.id && (
                  <div className="grid gap-3">
                    <input type="datetime-local" value={bForm.startAt} onChange={(e) => setBForm({ ...bForm, startAt: e.target.value })} className="b-input" />
                    <input type="datetime-local" value={bForm.endAt} onChange={(e) => setBForm({ ...bForm, endAt: e.target.value })} className="b-input" />
                    <input value={bForm.purpose} onChange={(e) => setBForm({ ...bForm, purpose: e.target.value })} placeholder={t("facilities.dlyl-rzrv")} className="b-input" />
                    <button onClick={() => createBooking(r.id)} className="b-btn b-btn-sm b-btn-spring w-fit">{t("facilities.sbt-rzrv")}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="font-bold mb-3">{t("facilities.rzrvhay-pysh-rv")}</h2>
        {upcoming.length === 0 ? <p className="t-sm text-steel">{t("facilities.rzrvy-nyst")}</p> : (
          <div className="flex flex-col gap-2">
            {upcoming.map((b) => (
              <div key={b.id} className="b-card-sm p-3.5 flex items-center gap-3 flex-wrap">
                <span className={`b-badge ${b.status === "APPROVED" ? "b-badge-success" : b.status === "PENDING" ? "b-badge-warning" : "b-badge-neutral"}`}>
                  {b.status === "APPROVED" ? t("dashboard.meeting.approved") : b.status === "PENDING" ? t("dashboard.meeting.pending") : b.status}
                </span>
                <span className="text-[12px] font-bold">{b.room?.name ?? ""}</span>
                <span className="text-[12px] text-steel flex-1">{b.purpose}</span>
                <span className="text-[12px] text-steel">{formatDateFa(b.startAt)} · {formatTimeFa(b.startAt)}</span>
                <span className="text-[12px] text-stone">{b.by.firstName} {b.by.lastName}</span>
                {b.status === "PENDING" && isManager && <button onClick={() => setBookingStatus(b.id, "APPROVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2 !py-0">{t("facilities.t-yyd")}</button>}
                {b.status !== "CANCELED" && <button onClick={() => setBookingStatus(b.id, "CANCELED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0">لغو</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
