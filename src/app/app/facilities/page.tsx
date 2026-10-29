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

type Room = { id: string; name: string; kind: string; capacity: number; floor: number | null; active: boolean };
type Booking = { id: string; roomId: string | null; assetId: string | null; room: { name: string } | null; by: { firstName: string; lastName: string }; purpose: string; startAt: string; endAt: string; status: string };
type Asset = { id: string; name: string; code: string; category: string; location: string | null; status: string; custodian: { firstName: string; lastName: string } | null };
type MaintTicket = { id: string; title: string; description: string | null; priority: string; status: string; slaHours: number; createdAt: string; resolvedAt: string | null; asset: { name: string; code: string } | null; location: string | null; reportedBy: { firstName: string; lastName: string } };
type Visitor = { id: string; name: string; nationalId: string | null; phone: string | null; purpose: string; hostName: string | null; expected: boolean; expectedDate: string | null; status: string; checkInAt: string | null; checkOutAt: string | null };
type LostItem = { id: string; title: string; description: string | null; location: string | null; foundAt: string; status: string; claimedByName: string | null };

const TABS = [
  { key: "rooms", label: "اتاق‌ها و رزرو", icon: DoorOpen },
  { key: "assets", label: "دارایی‌ها", icon: Laptop },
  { key: "maintenance", label: "تعمیرات", icon: Wrench },
  { key: "visitors", label: "مهمان‌ها", icon: Users2 },
  { key: "lostfound", label: "اشیای گمشده", icon: PackageSearch },
];
const ASSET_STATUS: Record<string, string> = { OK: "سالم", BROKEN: "خراب", REPAIRING: "در تعمیر", RETIRED: "از رده خارج" };
const MT_STATUS: Record<string, string> = { OPEN: "باز", IN_PROGRESS: "در جریان", RESOLVED: "حل‌شده", CLOSED: "بسته" };

function FacilitiesInner() {
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
      setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری داده‌ها");
    }).finally(() => setLoading(false));
  }, [tab]);
  useEffect(load, [load]);

  async function create(kind: string) {
    try {
      await apiPost("/api/facilities", { kind, ...form });
      toast.success("ثبت شد");
      setShowNew(""); setForm({}); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function patch(kind: string, id: string, data: Record<string, unknown>) {
    try { await apiPatch("/api/facilities", { kind, id, ...data }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function del(kind: string, id: string) {
    try { await apiDelete(`/api/facilities?kind=${kind}&id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader title="مدیریت امکانات مدرسه" desc="اتاق‌ها، تجهیزات، تعمیرات، مهمان‌ها و اشیای گمشده — همه در یکجا" />
      <div className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`b-pill-tab ${tab === t.key ? "b-pill-tab-active" : ""}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {t.key === "maintenance" && overdueCount > 0 && <span className="b-badge b-badge-critical !text-[9px] !px-1.5">{faNumber(overdueCount)}</span>}
          </button>
        ))}
      </div>

      {/* ── اتاق‌ها ── */}
      {tab === "rooms" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">اتاق‌ها ({faNumber(rooms.length)})</h2>
            <button onClick={() => setShowNew(showNew === "room" ? "" : "room")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> اتاق جدید</button>
          </div>
          {showNew === "room" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام اتاق *" className="b-input" />
              <Select
                value={form.roomKind ?? "CLASSROOM"}
                onChange={(v) => setForm({ ...form, roomKind: v })}
                options={[{ value: "CLASSROOM", label: "کلاس" }, { value: "LAB", label: "آزمایشگاه" }, { value: "SPORT", label: "سالن ورزش" }, { value: "LIBRARY", label: "کتابخانه" }, { value: "OFFICE", label: "اداری" }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <input type="number" value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="ظرفیت" className="b-input" />
              <button onClick={() => create("room")} className="b-btn b-btn-sm b-btn-spring">ثبت</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="b-card-sm p-4 group">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[14px]">{r.name}</p>
                  <button onClick={() => del("room", r.id)} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 max-md:opacity-100 text-stone hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="text-[11.5px] text-steel mt-1">ظرفیت {faNumber(r.capacity)} نفر{r.floor ? ` · طبقه ${faNumber(r.floor)}` : ""}</p>
              </motion.div>
            ))}
          </div>
          <div>
            <h2 className="font-bold mb-3">رزروهای پیش رو</h2>
            <button onClick={() => setShowNew(showNew === "booking" ? "" : "booking")} className="b-btn b-btn-sm b-btn-ghost mb-3"><Plus className="w-4 h-4" /> رزرو جدید</button>
            {showNew === "booking" && (
              <div className="b-card-md p-5 grid gap-3 sm:grid-cols-5 mb-4">
                <Select
                  value={form.targetType ?? "ROOM"}
                  onChange={(v) => setForm({ ...form, targetType: v })}
                  options={[{ value: "ROOM", label: "اتاق" }, { value: "ASSET", label: "تجهیزات" }]}
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <Select
                  value={form.targetId ?? ""}
                  onChange={(v) => setForm({ ...form, targetId: v })}
                  options={[{ value: "", label: "انتخاب…" }, ...(form.targetType === "ASSET" ? assets : rooms).map((x) => ({ value: x.id, label: x.name }))]}
                  placeholder="انتخاب…"
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <input type="datetime-local" value={form.startAt ?? ""} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="b-input" />
                <input type="datetime-local" value={form.endAt ?? ""} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="b-input" />
                <input value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="دلیل رزرو *" className="b-input" />
                <button onClick={() => create("booking")} className="b-btn b-btn-sm b-btn-spring sm:col-span-5 w-fit">ثبت رزرو</button>
              </div>
            )}
            {bookings.length === 0 ? <p className="t-sm text-steel">رزروی نیست</p> : (
              <div className="flex flex-col gap-2">
                {bookings.map((b) => (
                  <div key={b.id} className="b-card-sm p-3.5 flex items-center gap-3 flex-wrap">
                    <span className={`b-badge ${b.status === "APPROVED" ? "b-badge-success" : b.status === "PENDING" ? "b-badge-warning" : "b-badge-neutral"}`}>
                      {b.status === "APPROVED" ? "تأییدشده" : b.status === "PENDING" ? "در انتظار" : b.status}
                    </span>
                    <span className="text-[12.5px] font-bold">{b.room?.name ?? "تجهیزات"}</span>
                    <span className="text-[11.5px] text-steel flex-1">{b.purpose}</span>
                    <span className="text-[11px] text-steel">{formatDateFa(b.startAt)} · {formatTimeFa(b.startAt)}</span>
                    <span className="text-[11px] text-stone">{b.by.firstName} {b.by.lastName}</span>
                    {b.status === "PENDING" && <button onClick={() => patch("booking", b.id, { status: "APPROVED" })} className="b-btn b-btn-sm b-btn-spring !min-h-[26px] !text-[10px] !px-2 !py-0">تأیید</button>}
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
            <h2 className="font-bold">دارایی‌ها ({faNumber(assets.length)})</h2>
            <button onClick={() => setShowNew(showNew === "asset" ? "" : "asset")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> دارایی جدید</button>
          </div>
          {showNew === "asset" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4 mb-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام *" className="b-input" />
              <input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="کد/شناسه *" className="b-input" />
              <Select
                value={form.category ?? "PROJECTOR"}
                onChange={(v) => setForm({ ...form, category: v })}
                options={[{ value: "PROJECTOR", label: "پروژکتور" }, { value: "LAPTOP", label: "لپ‌تاپ" }, { value: "COMPUTER", label: "کامپیوتر" }, { value: "SOUND", label: "صوتی" }, { value: "LAB", label: "آزمایشگاه" }, { value: "OTHER", label: "سایر" }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="محل نگهداری" className="b-input" />
              <button onClick={() => create("asset")} className="b-btn b-btn-sm b-btn-spring sm:col-span-4 w-fit">ثبت</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className={`b-card-sm p-4 group ${assetParam === a.id ? "!border-spring ring-2 ring-spring/50 !bg-spring-tint/30" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[13.5px]">{a.name}</p>
                  <span className={`b-badge ${a.status === "OK" ? "b-badge-success" : a.status === "BROKEN" ? "b-badge-critical" : "b-badge-warning"}`}>{ASSET_STATUS[a.status]}</span>
                </div>
                <p className="text-[11px] text-steel mt-1">کد: {a.code}{a.location ? ` · ${a.location}` : ""}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => patch("asset", a.id, { status: a.status === "OK" ? "BROKEN" : "OK" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0">
                    {a.status === "OK" ? "ثبت خرابی" : "سالم شد"}
                  </button>
                  <a href={`/api/qr/asset/${a.id}`} target="_blank" rel="noreferrer" className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0"><QrCode className="w-3 h-3" /> QR</a>
                  <button onClick={() => del("asset", a.id)} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 max-md:opacity-100 text-stone hover:text-destructive ms-auto"><Trash2 className="w-4 h-4" /></button>
                </div>
              </motion.div>
            ))}
            {assets.length === 0 && <p className="t-sm text-steel">دارایی ثبت نشده است</p>}
          </div>
        </div>
      )}

      {/* ── تعمیرات ── */}
      {tab === "maintenance" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">تیکت‌های تعمیر {overdueCount > 0 && <span className="b-badge b-badge-critical ms-2">{faNumber(overdueCount)} عقب‌افتاده</span>}</h2>
            <button onClick={() => setShowNew(showNew === "maintenance" ? "" : "maintenance")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> ثبت خرابی</button>
          </div>
          {showNew === "maintenance" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-3 mb-4">
              <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان خرابی *" className="b-input sm:col-span-2" />
              <Select
                value={form.priority ?? "NORMAL"}
                onChange={(v) => setForm({ ...form, priority: v })}
                options={[{ value: "LOW", label: "اولویت پایین" }, { value: "NORMAL", label: "معمولی" }, { value: "HIGH", label: "فوری" }]}
                className="w-full"
                buttonClassName="!w-full"
              />
              <Select
                value={form.assetId ?? ""}
                onChange={(v) => setForm({ ...form, assetId: v })}
                options={[{ value: "", label: "دارایی مرتبط (اختیاری)" }, ...assets.map((a) => ({ value: a.id, label: a.name }))]}
                placeholder="دارایی مرتبط (اختیاری)"
                className="w-full"
                buttonClassName="!w-full"
              />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="محل" className="b-input" />
              <button onClick={() => create("maintenance")} className="b-btn b-btn-sm b-btn-spring w-fit">ثبت</button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {tickets.map((t) => {
              const overdue = !["RESOLVED", "CLOSED"].includes(t.status) && Date.now() - new Date(t.createdAt).getTime() > t.slaHours * 3600000;
              return (
                <div key={t.id} className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${overdue ? "border-s-4 !border-s-destructive" : ""}`}>
                  <span className={`b-badge ${t.status === "RESOLVED" || t.status === "CLOSED" ? "b-badge-success" : t.status === "IN_PROGRESS" ? "b-badge-warning" : "b-badge-neutral"}`}>{MT_STATUS[t.status]}</span>
                  <span className="text-[13px] font-bold">{t.title}</span>
                  {t.asset && <span className="text-[11px] text-steel">{t.asset.name}</span>}
                  {t.location && <span className="text-[11px] text-steel">📍 {t.location}</span>}
                  <span className="text-[10.5px] text-stone ms-auto flex items-center gap-1"><Timer className="w-3 h-3" /> SLA {faNumber(t.slaHours)}س</span>
                  {t.status === "OPEN" && <button onClick={() => patch("maintenance", t.id, { status: "IN_PROGRESS" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0">شروع</button>}
                  {!["RESOLVED", "CLOSED"].includes(t.status) && (
                    <button
                      onClick={() => {
                        const note = prompt("توضیح رفع خرابی (چه اقدامی شد؟):", "رفع شد");
                        if (note === null) return;
                        patch("maintenance", t.id, { status: "RESOLVED", resolutionNote: note.trim() || "رفع شد" });
                      }}
                      className="b-btn b-btn-sm b-btn-spring !min-h-[26px] !text-[10px] !px-2 !py-0"
                    >رفع شد</button>
                  )}
                </div>
              );
            })}
            {tickets.length === 0 && <p className="t-sm text-steel">خرابی گزارش نشده است</p>}
          </div>
        </div>
      )}

      {/* ── مهمان‌ها ── */}
      {tab === "visitors" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">ثبت مهمان‌ها</h2>
            <button onClick={() => setShowNew(showNew === "visitor" ? "" : "visitor")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> ثبت مراجعه</button>
          </div>
          {showNew === "visitor" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-4 mb-4">
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام مهمان *" className="b-input" />
              <input value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="دلیل مراجعه *" className="b-input" />
              <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="شماره تماس" className="b-input" />
              <button onClick={() => create("visitor")} className="b-btn b-btn-sm b-btn-spring">ورود ثبت شد</button>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {visitors.map((v) => (
              <div key={v.id} className="b-card-sm p-3.5 flex items-center gap-3 flex-wrap">
                <span className={`b-badge ${v.status === "CHECKED_IN" ? "b-badge-success" : v.status === "CHECKED_OUT" ? "b-badge-neutral" : "b-badge-warning"}`}>
                  {v.status === "CHECKED_IN" ? "حاضر" : v.status === "CHECKED_OUT" ? "خارج‌شده" : v.expected ? "مورد انتظار" : v.status}
                </span>
                <span className="text-[13px] font-bold">{v.name}</span>
                <span className="text-[11.5px] text-steel flex-1">{v.purpose}{v.hostName ? ` · میزبان: ${v.hostName}` : ""}</span>
                {v.checkInAt && <span className="text-[10.5px] text-stone">ورود: {formatTimeFa(v.checkInAt)}</span>}
                {v.checkOutAt && <span className="text-[10.5px] text-stone">خروج: {formatTimeFa(v.checkOutAt)}</span>}
                {v.status === "CHECKED_IN" && <button onClick={() => patch("visitor", v.id, { action: "checkout" })} className="b-btn b-btn-sm b-btn-ghost !min-h-[26px] !text-[10px] !px-2 !py-0">ثبت خروج</button>}
              </div>
            ))}
            {visitors.length === 0 && <p className="t-sm text-steel">مراجعه‌ای ثبت نشده است</p>}
          </div>
        </div>
      )}

      {/* ── اشیای گمشده ── */}
      {tab === "lostfound" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">اشیای گمشده و پیداشده</h2>
            <button onClick={() => setShowNew(showNew === "lostfound" ? "" : "lostfound")} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> شیء پیداشده</button>
          </div>
          {showNew === "lostfound" && (
            <div className="b-card-md p-5 grid gap-3 sm:grid-cols-3 mb-4">
              <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="عنوان شیء *" className="b-input" />
              <input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="محل یافتن" className="b-input" />
              <button onClick={() => create("lostfound")} className="b-btn b-btn-sm b-btn-spring w-fit">ثبت</button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lostItems.map((it) => (
              <div key={it.id} className={`b-card-sm p-4 ${it.status !== "FOUND" ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[13px]">{it.title}</p>
                  <span className={`b-badge ${it.status === "FOUND" ? "b-badge-warning" : it.status === "CLAIMED" ? "b-badge-success" : "b-badge-neutral"}`}>
                    {it.status === "FOUND" ? "موجود" : it.status === "CLAIMED" ? "تحویل‌شده" : "دور‌ریخته"}
                  </span>
                </div>
                <p className="text-[11px] text-steel mt-1">{it.location ? `📍 ${it.location} · ` : ""}{formatDateFa(it.foundAt)}</p>
                {it.status === "FOUND" && (
                  <button
                    onClick={() => {
                      const name = prompt("نام تحویل‌گیرنده:");
                      if (name === null) return;
                      if (!name.trim()) { toast.error("نام تحویل‌گیرنده را وارد کنید."); return; }
                      patch("lostfound", it.id, { status: "CLAIMED", claimedByName: name.trim() });
                    }}
                    className="b-btn b-btn-sm b-btn-ghost mt-2 !min-h-[26px] !text-[10px] !px-2 !py-0"
                  >تحویل شد</button>
                )}
              </div>
            ))}
            {lostItems.length === 0 && <p className="t-sm text-steel">موردی ثبت نشده است</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FacilitiesPage() {
  return <Suspense fallback={<LoadingBlock />}><FacilitiesInner /></Suspense>;
}
