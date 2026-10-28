"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2, Plus, Printer, Users, Armchair, IdCard, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Session = { id: string; title: string; subjectName: string | null; startsAt: string; durationMin: number; _count?: { seats: number; invigilators: number } };
type Seat = { room: string; seatNo: string; studentName: string; className: string };
type Detail = { session: Session; seats: Seat[]; invigilators: { userId: string; name: string; room: string }[] };
type MySeat = { session: { id: string; title: string; subjectName: string | null; startsAt: string; durationMin: number }; room: string; seatNo: string; studentName: string; className: string };
type ClassRow = { id: string; name: string; academicYear: string };
type Teacher = { id: string; firstName: string; lastName: string };
type Me = { user: { role: string } };

export default function ExamsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const { data, loading, error, refetch } = useApi<{ sessions?: Session[]; mine?: MySeat[] }>("/api/exams");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: teachersData } = useApi<{ users: Teacher[] }>(!isAudience ? "/api/users?role=TEACHER" : null);
  const confirm = useConfirm();

  const [form, setForm] = useState({ title: "", subjectName: "", startsAt: "", durationMin: "90" });
  const [creating, setCreating] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const { data: detail, refetch: refetchDetail } = useApi<Detail>(selId ? `/api/exams/${selId}` : null);
  const [arrClass, setArrClass] = useState("");
  const [rooms, setRooms] = useState("سالن اصلی");
  const [busy, setBusy] = useState("");
  const [invRoom, setInvRoom] = useState("سالن اصلی");
  const [invPicks, setInvPicks] = useState<{ userId: string; room: string }[]>([]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiPost("/api/exams", { ...form, durationMin: Number(form.durationMin) });
      toast.success("جلسهٔ امتحان ساخته شد.");
      setForm({ title: "", subjectName: "", startsAt: "", durationMin: "90" });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setCreating(false); }
  }

  async function arrange() {
    if (!selId || !arrClass) return;
    setBusy("arrange");
    try {
      const r = await apiPost<{ arranged: number }>(`/api/exams/${selId}`, {
        action: "arrange", classId: arrClass,
        rooms: rooms.split("،").join(",").split(",").map((s) => s.trim()).filter(Boolean),
        perRoom: 30,
      });
      toast.success(`${faNumber(r.arranged)} صندلی چیده شد.`);
      refetchDetail(); refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function saveInvigilators() {
    if (!selId) return;
    setBusy("inv");
    try {
      await apiPost(`/api/exams/${selId}`, { action: "invigilators", invigilators: invPicks });
      toast.success("مراقبین ثبت شدند.");
      refetchDetail(); refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: "حذف جلسه", description: "این جلسهٔ امتحان و همهٔ صندلی‌هایش حذف شود؟", confirmLabel: "حذف", danger: true }))) return;
    try { await apiDelete(`/api/exams/${id}`); if (selId === id) setSelId(null); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
  }

  if (isAudience) {
    const mine = data?.mine ?? [];
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="کارت ورود به جلسه" desc="جلسه‌های امتحانی که برای شما/فرزندتان صندلی تعیین شده است." />
        {loading && <LoadingBlock />}
        {error && <ErrorBox message={error} />}
        {data && mine.length === 0 && <EmptyState icon={IdCard} title="هنوز صندلی‌ای تعیین نشده" />}
        <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
          {mine.map((m, i) => (
            <div key={i} className="b-card-md p-6 flex flex-col gap-3 border-dashed">
              <div className="flex items-center justify-between">
                <b className="text-[15px]">{m.session.title}</b>
                <span className="b-badge b-badge-spring">{m.session.subjectName ?? "امتحان"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[13px]">
                <span className="text-steel">دانش‌آموز</span><b>{m.studentName}</b>
                <span className="text-steel">کلاس</span><b>{m.className}</b>
                <span className="text-steel">زمان</span><b>{formatDateFa(m.session.startsAt)} · {faNumber(m.session.durationMin)} دقیقه</b>
                <span className="text-steel">سالن</span><b>{m.room}</b>
                <span className="text-steel">شماره صندلی</span><b className="text-lg">{faNumber(m.seatNo)}</b>
              </div>
              <p className="text-[11.5px] text-steel">همراه داشتن این کارت (یا نمایش آن در گوشی) هنگام ورود به جلسه الزامی است.</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const sessions = data?.sessions ?? [];
  const roomsOf = (detail?.seats ?? []).reduce<Record<string, Seat[]>>((acc, s) => {
    (acc[s.room] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="عملیات امتحانات" desc="ساخت جلسه، چیدمان خودکار صندلی (درهم برای جلوگیری از تقلب)، تعیین مراقب و چاپ کارت ورود." />

      <form onSubmit={create} className="b-card p-5 grid md:grid-cols-[1fr_1fr_1fr_120px_auto] gap-3 items-end">
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">عنوان جلسه *</span>
          <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="امتحان پایان‌ترم ریاضی" required /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">درس</span>
          <input className="b-input" value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} placeholder="ریاضی" /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">زمان شروع *</span>
          <input className="b-input" dir="ltr" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} required /></label>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">مدت (دقیقه)</span>
          <input className="b-input" type="number" min={15} max={480} value={form.durationMin} onChange={(e) => setForm((f) => ({ ...f, durationMin: e.target.value }))} /></label>
        <button className="b-btn b-btn-spring" disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ساخت جلسه</button>
      </form>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && sessions.length === 0 && <EmptyState icon={ClipboardList} title="جلسه‌ای ساخته نشده" />}

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <button key={s.id} onClick={() => setSelId(s.id)} className={`b-btn b-btn-ghost b-card-sm p-4 text-start ${selId === s.id ? "ring-2 ring-spring" : ""}`}>
              <b className="text-[13.5px] block">{s.title}</b>
              <span className="text-[11.5px] text-steel">{s.subjectName ?? ""} · {formatDateFa(s.startsAt)} · {faNumber(s._count?.seats ?? 0)} صندلی · {faNumber(s._count?.invigilators ?? 0)} مراقب</span>
            </button>
          ))}
        </div>

        {selId && detail && (
          <div className="b-card p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <b className="text-[15px]">{detail.session.title}</b>
              <span className="flex gap-2">
                <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> چاپ کارت‌ها</button>
                <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={() => remove(selId)}><Trash2 className="w-4 h-4" /> حذف جلسه</button>
              </span>
            </div>

            <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end rounded-xl bg-cloud p-4">
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">چیدمان برای کلاس</span>
                <Select className="w-full" buttonClassName="!w-full" value={arrClass} onChange={setArrClass}
                  options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="انتخاب کلاس" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">سالن‌ها (با کاما جدا کنید — هر سالن ۳۰ نفر)</span>
                <input className="b-input" value={rooms} onChange={(e) => setRooms(e.target.value)} /></label>
              <button className="b-btn b-btn-spring" disabled={busy === "arrange" || !arrClass} onClick={arrange}>
                {busy === "arrange" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Armchair className="w-4 h-4" />} چیدن صندلی‌ها
              </button>
            </div>

            <div className="rounded-xl bg-cloud p-4 flex flex-col gap-3">
              <b className="text-[13px] flex items-center gap-2"><Users className="w-4 h-4" /> مراقبین جلسه</b>
              <div className="flex flex-wrap gap-1.5">
                {(teachersData?.users ?? []).map((t) => {
                  const picked = invPicks.some((p) => p.userId === t.id && p.room === invRoom) || detail.invigilators.some((i) => i.userId === t.id && i.room === invRoom);
                  return (
                    <button key={t.id} className={`b-badge ${picked ? "b-badge-spring" : "b-badge-neutral"}`}
                      onClick={() => setInvPicks((prev) => {
                        const base = prev.length ? prev : detail.invigilators.map((i) => ({ userId: i.userId, room: i.room }));
                        return base.some((p) => p.userId === t.id && p.room === invRoom)
                          ? base.filter((p) => !(p.userId === t.id && p.room === invRoom))
                          : [...base, { userId: t.id, room: invRoom }];
                      })}>
                      {t.firstName} {t.lastName}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input className="b-input max-w-48" value={invRoom} onChange={(e) => setInvRoom(e.target.value)} placeholder="سالن" />
                <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === "inv"} onClick={saveInvigilators}>
                  {busy === "inv" ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت مراقبین"}
                </button>
                <span className="text-[11.5px] text-steel">{detail.invigilators.length ? `فعلی: ${detail.invigilators.map((i) => `${i.name} (${i.room})`).join("، ")}` : ""}</span>
              </div>
            </div>

            <div id="admit-print" className="flex flex-col gap-4">
              {Object.entries(roomsOf).map(([room, seats]) => (
                <div key={room}>
                  <b className="text-[13px] block mb-2">{room} — {faNumber(seats.length)} نفر</b>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {seats.map((s, i) => (
                      <div key={i} className="rounded-xl border border-hairline p-3 text-[12px] flex flex-col gap-1">
                        <span className="flex justify-between"><b>{s.studentName}</b><span className="b-badge b-badge-spring">صندلی {faNumber(s.seatNo)}</span></span>
                        <span className="text-steel">{s.className} · {room}</span>
                        <span className="text-steel">{detail.session.title} · {formatDateFa(detail.session.startsAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {detail.seats.length === 0 && <p className="text-[12.5px] text-steel">هنوز صندلی‌ای چیده نشده است.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
