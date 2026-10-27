"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Plus, Loader2, Check, X, LogOut, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey } from "@/lib/persian";

type Pass = {
  id: string; date: string; exitTime: string | null; reason: string; pickupBy: string | null; status: string;
  student?: { id: string; user?: { firstName: string; lastName: string }; class?: { name: string } | null };
};
type MyStudent = { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };
type Data = { staff: boolean; date: string; passes: Pass[]; myStudents?: MyStudent[] };

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "در انتظار تأیید", cls: "b-badge-warning" },
  APPROVED: { label: "تأیید شده", cls: "b-badge-spring" },
  REJECTED: { label: "رد شده", cls: "b-badge-critical" },
  EXITED: { label: "خارج شده", cls: "b-badge-neutral" },
};

export default function GatePassesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [date, setDate] = useState(todayKey());
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [reason, setReason] = useState("");
  const [pickupBy, setPickupBy] = useState("");
  const [studentTerm, setStudentTerm] = useState("");
  const [studentHits, setStudentHits] = useState<MyStudent[]>([]);

  const load = useCallback((d: string) => {
    apiGet<Data>(`/api/gate-passes?date=${encodeURIComponent(d)}`).then(setData).catch(() => setData({ staff: false, date: d, passes: [] }));
  }, []);
  useEffect(() => { load(date); }, [load, date]);

  useEffect(() => {
    if (!open || !data?.staff || studentTerm.trim().length < 2) { setStudentHits([]); return; }
    const t = setTimeout(() => {
      apiGet<{ students: MyStudent[] }>(`/api/students?q=${encodeURIComponent(studentTerm.trim())}`).then((d) => setStudentHits(d.students ?? [])).catch(() => setStudentHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, data?.staff, studentTerm]);

  async function decide(p: Pass, status: string) {
    setBusy(p.id);
    try { await apiPatch("/api/gate-passes", { id: p.id, status }); toast.success("انجام شد."); load(date); }
    catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  async function create() {
    if (!studentId) { toast.error("دانش‌آموز را انتخاب کنید."); return; }
    if (!reason.trim()) { toast.error("دلیل خروج را بنویسید."); return; }
    setBusy("create");
    try {
      await apiPost("/api/gate-passes", { studentId, date, exitTime: exitTime || undefined, reason, pickupBy: pickupBy || undefined });
      toast.success("مجوز ثبت شد.");
      setOpen(false); setStudentId(""); setReason(""); setExitTime(""); setPickupBy(""); setStudentTerm("");
      load(date);
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label="مجوزهای خروج…" />;
  const students = data.staff ? studentHits : (data.myStudents ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="مجوز خروج دانش‌آموز"
        desc={data.staff ? "درخواست‌های خروج زودهنگام امروز — تأیید، رد و ثبت خروج نهایی در دروازه." : "درخواست خروج زودهنگام برای خودتان/فرزندتان و پیگیری وضعیت."}
        action={<button className="b-btn b-btn-spring" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> درخواست جدید</button>}
      />
      <div className="flex items-center gap-3">
        <label className="text-[12.5px] font-bold">تاریخ (شمسی):</label>
        <input className="b-input !w-44" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {data.passes.length === 0
        ? <EmptyState icon={DoorOpen} title="مجوزی برای این روز نیست" desc="درخواستی ثبت نشده است." />
        : <section className="b-card p-5 md:p-6">
            <div className="flex flex-col divide-y divide-hairline-soft b-rows-in">
              {data.passes.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-48">
                    <b className="text-[13.5px]">{p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : ""}</b>
                    {p.student?.class && <span className="t-cap text-steel"> · {p.student.class.name}</span>}
                    <span className="t-sm text-steel block">{p.reason}{p.exitTime ? ` — ساعت ${p.exitTime}` : ""}{p.pickupBy ? ` — تحویل به: ${p.pickupBy}` : ""}</span>
                  </div>
                  <span className={`b-badge ${STATUS[p.status]?.cls ?? "b-badge-neutral"}`}>{STATUS[p.status]?.label ?? p.status}</span>
                  {data.staff && (
                    <button className="text-stone hover:text-destructive" aria-label="حذف مجوز" onClick={async () => { if (!window.confirm("این مجوز خروج حذف شود؟")) return; try { await apiDelete(`/api/gate-passes?id=${p.id}`); toast.success("حذف شد."); load(date); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {data.staff && p.status === "PENDING" && (
                    <span className="flex gap-1.5">
                      <button className="b-btn b-btn-soft b-btn-sm" disabled={busy === p.id} onClick={() => decide(p, "APPROVED")}><Check className="w-3.5 h-3.5" /> تأیید</button>
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === p.id} onClick={() => decide(p, "REJECTED")}><X className="w-3.5 h-3.5" /> رد</button>
                    </span>
                  )}
                  {data.staff && p.status === "APPROVED" && (
                    <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === p.id} onClick={() => decide(p, "EXITED")}><LogOut className="w-3.5 h-3.5" /> ثبت خروج</button>
                  )}
                </div>
              ))}
            </div>
          </section>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="b-card w-full max-w-md p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">درخواست مجوز خروج</h3>
            {data.staff ? (
              <>
                <input className="b-input" placeholder="جستجوی نام دانش‌آموز…" value={studentTerm} onChange={(e) => { setStudentTerm(e.target.value); setStudentId(""); }} />
                {students.length > 0 && !studentId && (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto b-scroll">
                    {students.map((s) => (
                      <button key={s.id} className="b-card-sm !rounded-xl p-2.5 text-start text-[13px]" onClick={() => setStudentId(s.id)}>
                        <b>{s.user.firstName} {s.user.lastName}</b> <span className="text-steel">{s.class?.name ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {studentId && <p className="t-sm text-spring-deep">دانش‌آموز انتخاب شد ✓</p>}
              </>
            ) : (
              <Select
                value={studentId}
                onChange={setStudentId}
                placeholder="انتخاب دانش‌آموز…"
                options={(data.myStudents ?? []).map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}${s.class ? ` — ${s.class.name}` : ""}` }))}
                ariaLabel="دانش‌آموز"
              />
            )}
            <input className="b-input" placeholder="ساعت خروج (مثلاً 12:30)" dir="ltr" value={exitTime} onChange={(e) => setExitTime(e.target.value)} />
            <input className="b-input" placeholder="دلیل خروج *" value={reason} onChange={(e) => setReason(e.target.value)} />
            <input className="b-input" placeholder="تحویل‌گیرنده (پدر/مادر/…)" value={pickupBy} onChange={(e) => setPickupBy(e.target.value)} />
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "create"} onClick={create}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : "ثبت درخواست"}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setOpen(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
