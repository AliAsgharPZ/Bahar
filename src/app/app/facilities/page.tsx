"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { DoorOpen, Wrench, Laptop, Users2, PackageSearch, Plus, Trash2, QrCode, Timer } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa, formatTimeFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Room = { id: string; name: string; kind: string; capacity: number; floor: number | null; active: boolean };
type Booking = { id: string; roomId: string | null; assetId: string | null; room: { name: string } | null; by: { firstName: string; lastName: string }; purpose: string; startAt: string; endAt: string; status: string };
type Asset = { id: string; name: string; code: string; category: string; location: string | null; status: string; custodian: { firstName: string; lastName: string } | null };
type MaintTicket = { id: string; title: string; description: string | null; priority: string; status: string; slaHours: number; createdAt: string; resolvedAt: string | null; asset: { name: string; code: string } | null; location: string | null; reportedBy: { firstName: string; lastName: string } };
type Visitor = { id: string; name: string; nationalId: string | null; phone: string | null; purpose: string; hostName: string | null; expected: boolean; expectedDate: string | null; status: string; checkInAt: string | null; checkOutAt: string | null };
type LostItem = { id: string; title: string; description: string | null; location: string | null; foundAt: string; status: string; claimedByName: string | null };

const TABS = [
  { key: "rooms", tkey: "facilities.tab.rooms", icon: DoorOpen },
  { key: "assets", tkey: "facilities.tab.assets", icon: Laptop },
  { key: "maintenance", tkey: "facilities.tab.maintenance", icon: Wrench },
  { key: "visitors", tkey: "facilities.tab.visitors", icon: Users2 },
  { key: "lostfound", tkey: "facilities.tab.lostfound", icon: PackageSearch },
];
const ASSET_TKEY: Record<string, string> = { OK: "enum.assetStatus.OK", BROKEN: "enum.assetStatus.BROKEN", REPAIRING: "enum.assetStatus.REPAIRING", RETIRED: "enum.assetStatus.RETIRED" };
const MT_TKEY: Record<string, string> = { OPEN: "dashboard.ticket.open", IN_PROGRESS: "enum.mtStatus.IN_PROGRESS", RESOLVED: "enum.mtStatus.RESOLVED", CLOSED: "dashboard.ticket.closed" };

function FacilitiesInner() {
  const { t } = useLang();
  const sp = useSearchParams();
  const assetParam = sp.get("asset"); // لینک عمیق از روی برچسب QR دارایی
  const [tab, setTab] = useState(assetParam ? "assets" : sp.get("tab") ?? "rooms");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tickets, setTickets] = useState<MaintTicket[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    const kind = tab === "rooms" ? "rooms" : tab;
    setLoading(true);
    setLoadError("");
    // FIX (راند ۱۶): تب اتاق/رزرو هم فهرست تجهیزات را می‌گیرد — انتخاب «رزرو تجهیزات» قبلاً خالی بود
    if (kind === "rooms") {
      // firefighting fetch — نتیجه بعداً می‌رسد و state را پر می‌کند
      apiGet<Record<string, unknown>>("/api/facilities?kind=assets").then((d2) => { setAssets((d2.assets as Asset[]) ?? assets); }).catch(() => {});
    }
    apiGet<Record<string, unknown>>(`/api/facilities?kind=${kind}`).then((d) => {
      setRooms((d.rooms as Room[]) ?? rooms);
      setBookings((d.bookings as Booking[]) ?? bookings);
      setAssets((d.assets as Asset[]) ?? assets);
      setTickets((d.tickets as MaintTicket[]) ?? tickets);
      setOverdueCount((d.overdueCount as number) ?? 0);
      setVisitors((d.visitors as Visitor[]) ?? visitors);
      setLostItems((d.lostItems as LostItem[]) ?? lostItems);
    }).catch((e) => {
      setLoadError(e instanceof Error ? e.message : t("facilities.khta-dr-bargzary-dadh-ha"));
    }).finally(() => setLoading(false));
  }, [tab]);
  useEffect(load, [load]);

  async function create(kind: string) {
    try {
      await apiPost("/api/facilities", { kind, ...form });
      toast.success(t("facilities.sbt-shd"));
      setShowNew(""); setForm({}); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function patch(kind: string, id: string, data: Record<string, unknown>) {
    try { await apiPatch("/api/facilities", { kind, id, ...data }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function del(kind: string, id: string) {
    try { await apiDelete(`/api/facilities?kind=${kind}&id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader title={t("facilities.mdyryt-amkanat-mdrsh")} desc={t("facilities.ataq-ha-tjhyzat-tamyrat-mhman-ha-v-ashyay-gmshdh-hmh-dr-ykja")} />
      <div role="tablist" className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        {TABS.map((tb) => (
          <button role="tab" aria-selected={tab === tb.key} key={tb.key} onClick={() => setTab(tb.key)} className={`b-pill-tab ${tab === tb.key ? "b-pill-tab-active" : ""}`}>
            <tb.icon className="w-3.5 h-3.5" /> {t(tb.tkey)}
            {tb.key === "maintenance" && overdueCount > 0 && <span className="b-badge b-badge-critical !text-[12px] !px-1.5">{faNumber(overdueCount)}</span>}
          </button>
        ))}
      </div>

      {/* ── اتاق‌ها ── */}
      {tab === "rooms" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{t("facilities.ataq-ha")} ({faNumber(rooms.length)})</h2>
            <button onClick={() => setShowNew(showNew === "room" ? "" : "room")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("facilities.ataq-jdyd")}</button>
          </div>
          {showNew === "room" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("facilities.nam-ataq")} className="b-input" />
              <Select
                value={form.roomKind ?? "CLASSROOM"}
                onChange={(v) => setForm({ ...form, roomKind: v })}
                options={[{ value: "CLASSROOM", label: t("common.class") }, { value: "LAB", label: t("facilities.azmayshgah") }, { value: "SPORT", label: t("facilities.saln-vrzsh") }, { value: "HALL", label: "سالن" }, { value: "CONFERENCE", label: "سالن همایش" }, { value: "FIELD", label: "زمین ورزشی" }, { value: "LIBRARY", label: t("nav.library") }, { value: "OFFICE", label: t("facilities.adary") }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <input type="number" value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder={t("facilities.zrfyt")} className="b-input" />
              <button onClick={() => create("room")} className="b-btn b-btn-sm b-btn-spring">{t("facilities.sbt")}</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="b-card-sm p-4 group">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[14px]">{r.name}</p>
                  <button onClick={() => del("room", r.id)} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100 text-stone hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="text-[12px] text-steel mt-1">{{ CLASSROOM: t("common.class"), LAB: t("facilities.azmayshgah"), SPORT: t("facilities.saln-vrzsh"), HALL: "سالن", CONFERENCE: "سالن همایش", FIELD: "زمین ورزشی", LIBRARY: t("nav.library"), OFFICE: t("facilities.adary") }[r.kind] ?? t("facilities.sayr")} · {t("facilities.zrfyt")} {faNumber(r.capacity)} {t("dashboard.unit.person")}{r.floor ? ` ${t("facilities.tbqh")} ${faNumber(r.floor)}` : ""}</p>
              </motion.div>
            ))}
          </div>
          <div>
            <h2 className="font-bold mb-3">{t("facilities.rzrvhay-pysh-rv")}</h2>
            <button onClick={() => setShowNew(showNew === "booking" ? "" : "booking")} className="b-btn b-btn-sm b-btn-ghost mb-3"><Plus className="w-4 h-4" /> {t("facilities.rzrv-jdyd")}</button>
            {showNew === "booking" && (
              <div className="b-card-md p-5 grid gap-3 sm:grid-cols-5 mb-4">
                <Select
                  value={form.targetType ?? "ROOM"}
                  onChange={(v) => setForm({ ...form, targetType: v })}
                  options={[{ value: "ROOM", label: t("facilities.ataq") }, { value: "ASSET", label: t("facilities.tjhyzat") }]}
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <Select
                  value={form.targetId ?? ""}
                  onChange={(v) => setForm({ ...form, targetId: v })}
                  options={[{ value: "", label: t("facilities.antkhab") }, ...(form.targetType === "ASSET" ? assets : rooms).map((x) => ({ value: x.id, label: x.name }))]}
                  placeholder={t("facilities.antkhab")}
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <input type="datetime-local" value={form.startAt ?? ""} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="b-input" />
                <input type="datetime-local" value={form.endAt ?? ""} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="b-input" />
                <input value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder={t("facilities.dlyl-rzrv")} className="b-input" />
                <button onClick={() => create("booking")} className="b-btn b-btn-sm b-btn-spring sm:col-span-5 w-fit">{t("facilities.sbt-rzrv")}</button>
              </div>
            )}
            {bookings.length === 0 ? <p className="t-sm text-steel">{t("facilities.rzrvy-nyst")}</p> : (
              <div className="flex flex-col gap-2">
                {bookings.map((b) => (
                  <div key={b.id} className="b-card-sm p-3.5 flex items-center gap-3 flex-wrap">
                    <span className={`b-badge ${b.status === "APPROVED" ? "b-badge-success" : b.status === "PENDING" ? "b-badge-warning" : "b-badge-neutral"}`}>
                      {b.status === "APPROVED" ? t("dashboard.meeting.approved") : b.status === "PENDING" ? t("dashboard.meeting.pending") : b.status}
                    </span>
                    <span className="text-[12px] font-bold">{b.room?.name ?? t("facilities.tjhyzat")}</span>
                    <span className="text-[12px] text-steel flex-1">{b.purpose}</span>
                    <span className="text-[12px] text-steel">{formatDateFa(b.startAt)} · {formatTimeFa(b.startAt)}</span>
                    <span className="text-[12px] text-stone">{b.by.firstName} {b.by.lastName}</span>
                    {b.status === "PENDING" && <button onClick={() => patch("booking", b.id, { status: "APPROVED" })} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2 !py-0">{t("facilities.t-yyd")}</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── دارایی‌ها ── */}
      {tab === "assets" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{t("facilities.darayy-ha")} ({faNumber(assets.length)})</h2>
            <button onClick={() => setShowNew(showNew === "asset" ? "" : "asset")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("facilities.darayy-jdyd")}</button>
          </div>
          {showNew === "asset" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4 mb-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("students.field.firstName")} className="b-input" />
              <input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={t("facilities.kd-shnash")} className="b-input" />
              <Select
                value={form.category ?? "PROJECTOR"}
                onChange={(v) => setForm({ ...form, category: v })}
                options={[{ value: "PROJECTOR", label: t("facilities.prvzhktvr") }, { value: "LAPTOP", label: t("facilities.lp-tap") }, { value: "COMPUTER", label: t("facilities.kampyvtr") }, { value: "SOUND", label: t("facilities.svty") }, { value: "LAB", label: t("facilities.azmayshgah") }, { value: "OTHER", label: t("facilities.sayr") }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("facilities.mhl-nghdary")} className="b-input" />
              <button onClick={() => create("asset")} className="b-btn b-btn-sm b-btn-spring sm:col-span-4 w-fit">{t("facilities.sbt")}</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`b-card-sm p-4 group ${assetParam === a.id ? "!border-spring ring-2 ring-spring/50 !bg-spring-tint/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[14px]">{a.name}</p>
                  <span className={`b-badge ${a.status === "OK" ? "b-badge-success" : a.status === "BROKEN" ? "b-badge-critical" : "b-badge-warning"}`}>{t(ASSET_TKEY[a.status] ?? a.status)}</span>
                </div>
                <p className="text-[12px] text-steel mt-1">{t("facilities.kd")}: {a.code}{a.location ? ` · ${a.location}` : ""}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => patch("asset", a.id, { status: a.status === "OK" ? "BROKEN" : "OK" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0">
                    {a.status === "OK" ? t("facilities.sbt-khraby") : t("facilities.salm-shd")}
                  </button>
                  <a href={`/api/qr/asset/${a.id}`} target="_blank" rel="noreferrer" className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0"><QrCode className="w-3 h-3" /> QR</a>
                  <button onClick={() => del("asset", a.id)} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 max-md:opacity-100 text-stone hover:text-destructive ms-auto"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            ))}
            {assets.length === 0 && <p className="t-sm text-steel">{t("facilities.darayy-sbt-nshdh-ast")}</p>}
          </div>
        </div>
      )}

      {/* ── تعمیرات ── */}
      {tab === "maintenance" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{t("facilities.tykt-hay-tamyr")} {overdueCount > 0 && <span className="b-badge b-badge-critical ms-2">{faNumber(overdueCount)} {t("facilities.aqb-aftadh")}</span>}</h2>
            <button onClick={() => setShowNew(showNew === "maintenance" ? "" : "maintenance")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("facilities.sbt-khraby")}</button>
          </div>
          {showNew === "maintenance" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-3 mb-4">
              <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("facilities.anvan-khraby")} className="b-input sm:col-span-2" />
              <Select
                value={form.priority ?? "NORMAL"}
                onChange={(v) => setForm({ ...form, priority: v })}
                options={[{ value: "LOW", label: t("facilities.avlvyt-payyn") }, { value: "NORMAL", label: t("facilities.mamvly") }, { value: "HIGH", label: t("shell.notif.cat.urgent") }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <Select
                value={form.assetId ?? ""}
                onChange={(v) => setForm({ ...form, assetId: v })}
                options={[{ value: "", label: t("facilities.darayy-mrtbt-akhtyary") }, ...assets.map((a) => ({ value: a.id, label: a.name }))]}
                placeholder={t("facilities.darayy-mrtbt-akhtyary")}
                className="w-full"
                buttonClassName="!w-full"
              />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("facilities.mhl")} className="b-input" />
              <button onClick={() => create("maintenance")} className="b-btn b-btn-sm b-btn-spring w-fit">{t("facilities.sbt")}</button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {tickets.map((tk) => {
              const overdue = !["RESOLVED", "CLOSED"].includes(tk.status) && Date.now() - new Date(tk.createdAt).getTime() > tk.slaHours * 3600000;
              return (
                <div key={tk.id} className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${overdue ? "border-s-4 !border-s-destructive" : ""}`}>
                  <span className={`b-badge ${tk.status === "RESOLVED" || tk.status === "CLOSED" ? "b-badge-success" : tk.status === "IN_PROGRESS" ? "b-badge-warning" : "b-badge-neutral"}`}>{t(MT_TKEY[tk.status] ?? tk.status)}</span>
                  <span className="text-[14px] font-bold">{tk.title}</span>
                  {tk.asset && <span className="text-[12px] text-steel">{tk.asset.name}</span>}
                  {tk.location && <span className="text-[12px] text-steel">📍 {tk.location}</span>}
                  <span className="text-[12px] text-stone ms-auto flex items-center gap-1"><Timer className="w-3 h-3" /> SLA {faNumber(tk.slaHours)}{t("facilities.s")}</span>
                  {tk.status === "OPEN" && <button onClick={() => patch("maintenance", tk.id, { status: "IN_PROGRESS" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0">{t("facilities.shrva")}</button>}
                  {!["RESOLVED", "CLOSED"].includes(tk.status) && (
                    <button
                      onClick={() => {
                        const note = prompt(t("facilities.tvzyh-rfa-khraby-chh-aqdamy-shd"), t("facilities.rfa-shd"));
                        if (note === null) return;
                        patch("maintenance", tk.id, { status: "RESOLVED", resolutionNote: note.trim() || t("facilities.rfa-shd") });
                      }}
                      className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2 !py-0"
                    >{t("facilities.rfa-shd")}</button>
                  )}
                </div>
              );
            })}
            {tickets.length === 0 && <p className="t-sm text-steel">{t("facilities.khraby-gzarsh-nshdh-ast")}</p>}
          </div>
        </div>
      )}

      {/* ── مهمان‌ها ── */}
      {tab === "visitors" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{t("facilities.sbt-mhman-ha")}</h2>
            <button onClick={() => setShowNew(showNew === "visitor" ? "" : "visitor")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("facilities.sbt-mrajah")}</button>
          </div>
          {showNew === "visitor" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4 mb-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("facilities.nam-mhman")} className="b-input" />
              <input value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder={t("facilities.dlyl-mrajah")} className="b-input" />
              <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("facilities.shmarh-tmas")} className="b-input" />
              <button onClick={() => create("visitor")} className="b-btn b-btn-sm b-btn-spring">{t("facilities.vrvd-sbt-shd")}</button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {visitors.map((v) => (
              <div key={v.id} className="b-card-sm p-3.5 flex items-center gap-3 flex-wrap">
                <span className={`b-badge ${v.status === "CHECKED_IN" ? "b-badge-success" : v.status === "CHECKED_OUT" ? "b-badge-neutral" : "b-badge-warning"}`}>
                  {v.status === "CHECKED_IN" ? t("enum.attendance.PRESENT") : v.status === "CHECKED_OUT" ? t("facilities.kharj-shdh") : v.expected ? t("facilities.mvrd-antzar") : v.status}
                </span>
                <span className="text-[14px] font-bold">{v.name}</span>
                <span className="text-[12px] text-steel flex-1">{v.purpose}{v.hostName ? ` ${t("facilities.myzban")} ${v.hostName}` : ""}</span>
                {v.checkInAt && <span className="text-[12px] text-stone">{t("auth.login.submit")}: {formatTimeFa(v.checkInAt)}</span>}
                {v.checkOutAt && <span className="text-[12px] text-stone">{t("shell.logoutShort")}: {formatTimeFa(v.checkOutAt)}</span>}
                {v.status === "CHECKED_IN" && <button onClick={() => patch("visitor", v.id, { action: "checkout" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0">{t("facilities.sbt-khrvj")}</button>}
              </div>
            ))}
            {visitors.length === 0 && <p className="t-sm text-steel">{t("facilities.mrajah-ay-sbt-nshdh-ast")}</p>}
          </div>
        </div>
      )}

      {/* ── اشیای گمشده ── */}
      {tab === "lostfound" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">{t("facilities.ashyay-gmshdh-v-pydashdh")}</h2>
            <button onClick={() => setShowNew(showNew === "lostfound" ? "" : "lostfound")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("facilities.shy-pydashdh")}</button>
          </div>
          {showNew === "lostfound" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-3 mb-4">
              <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("facilities.anvan-shy")} className="b-input" />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("facilities.mhl-yaftn")} className="b-input" />
              <button onClick={() => create("lostfound")} className="b-btn b-btn-sm b-btn-spring w-fit">{t("facilities.sbt")}</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lostItems.map((it) => (
              <div key={it.id} className={`b-card-sm p-4 ${it.status !== "FOUND" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[14px]">{it.title}</p>
                  <span className={`b-badge ${it.status === "FOUND" ? "b-badge-warning" : it.status === "CLAIMED" ? "b-badge-success" : "b-badge-neutral"}`}>
                    {it.status === "FOUND" ? t("facilities.mvjvd") : it.status === "CLAIMED" ? t("facilities.thvyl-shdh") : t("facilities.dvr-rykhth")}
                  </span>
                </div>
                <p className="text-[12px] text-steel mt-1">{it.location ? `📍 ${it.location} · ` : ""}{formatDateFa(it.foundAt)}</p>
                {it.status === "FOUND" && (
                  <button
                    onClick={() => {
                      const name = prompt(t("facilities.nam-thvyl-gyrndh"));
                      if (name === null) return;
                      if (!name.trim()) { toast.error(t("facilities.nam-thvyl-gyrndh-ra-vard-knyd")); return; }
                      patch("lostfound", it.id, { status: "CLAIMED", claimedByName: name.trim() });
                    }}
                    className="b-btn b-btn-sm b-btn-ghost mt-2 !min-h-[40px] !text-[12px] !px-2 !py-0"
                  >{t("facilities.thvyl-shd")}</button>
                )}
              </div>
            ))}
            {lostItems.length === 0 && <p className="t-sm text-steel">{t("common.empty")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FacilitiesPage() {
  return <Suspense fallback={<LoadingBlock />}><FacilitiesInner /></Suspense>;
}
