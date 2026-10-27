"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trophy, Loader2, Plus, UserCheck, UserX, Power, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type Club = {
  id: string; name: string; coach: string | null; weekday: number; timeLabel: string | null;
  capacity: number; minGrade: string | null; maxGrade: string | null; fee: number;
  isActive: boolean; enrolledCount: number;
};
type MyEnr = { clubId: string; studentId: string; status: string };
type StudentRow = { id: string; name: string };
type ClassRow = { id: string; name: string; academicYear: string };
type Me = { user: { role: string } };

const DAYS = ["", "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export default function ClubsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isStaff = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(role);
  const isParent = role === "PARENT";
  const { data, loading, error, refetch } = useApi<{ clubs: Club[]; myEnrollments: MyEnr[] }>("/api/clubs");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(isParent ? "/api/classes" : null);
  const [classId, setClassId] = useState("");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const [childId, setChildId] = useState("");
  const [form, setForm] = useState({ name: "", coach: "", weekday: "3", timeLabel: "", capacity: "30", minGrade: "", maxGrade: "", fee: "0" });
  const [busy, setBusy] = useState("");

  const children = roster?.students ?? [];
  const targetStudent = role === "STUDENT" ? undefined : childId;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      await apiPost("/api/clubs", { action: "create", ...form, weekday: Number(form.weekday), capacity: Number(form.capacity), fee: Number(form.fee) });
      toast.success("باشگاه ساخته شد.");
      setForm({ name: "", coach: "", weekday: "3", timeLabel: "", capacity: "30", minGrade: "", maxGrade: "", fee: "0" });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function enroll(club: Club, drop: boolean, enrolled?: boolean) {
    setBusy(club.id);
    try {
      const r = await apiPost<{ waitlisted?: boolean }>("/api/clubs", {
        action: drop ? "drop" : "enroll", clubId: club.id, studentId: targetStudent,
      });
      if (!drop) toast.success(r.waitlisted ? "ظرفیت پر بود — در لیست انتظار ثبت شد." : "ثبت‌نام انجام شد.");
      if (drop) toast.success("ثبت‌نام لغو شد.");
      void enrolled;
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function toggle(club: Club) {
    setBusy(club.id);
    try { await apiPost("/api/clubs", { action: "toggle", id: club.id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  const clubs = data?.clubs ?? [];
  const myMap = new Map((data?.myEnrollments ?? []).map((e) => [`${e.clubId}|${e.studentId}`, e.status]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="باشگاه‌ها و فوق‌برنامه" desc="کلاس‌های فوق‌برنامهٔ مدرسه — ثبت‌نام آنلاین با ظرفیت و لیست انتظار خودکار." />
      {isParent && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس فرزند</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setChildId(""); }}
              options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">فرزند</span>
            <Select value={childId} onChange={setChildId}
              options={[{ value: "", label: "انتخاب فرزند" }, ...children.map((s) => ({ value: s.id, label: s.name }))]} placeholder="فرزند" /></label>
        </div>
      )}

      {isStaff && (
        <form onSubmit={create} className="b-card p-5 grid md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">نام باشگاه *</span>
            <input className="b-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="رباتیک، نقاشی، فوتسال…" required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">مربی</span>
            <input className="b-input" value={form.coach} onChange={(e) => setForm((f) => ({ ...f, coach: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">روز هفته</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.weekday} onChange={(v) => setForm((f) => ({ ...f, weekday: v }))}
              options={DAYS.slice(1).map((d, i) => ({ value: String(i + 1), label: d }))} placeholder="روز" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">ساعت</span>
            <input className="b-input" value={form.timeLabel} onChange={(e) => setForm((f) => ({ ...f, timeLabel: e.target.value }))} placeholder="۱۴ تا ۱۶" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">ظرفیت</span>
            <input className="b-input" type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">پایه (از ـ تا)</span>
            <span className="flex gap-1.5">
              <input className="b-input" value={form.minGrade} onChange={(e) => setForm((f) => ({ ...f, minGrade: e.target.value }))} placeholder="اول" />
              <input className="b-input" value={form.maxGrade} onChange={(e) => setForm((f) => ({ ...f, maxGrade: e.target.value }))} placeholder="ششم" />
            </span></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">شهریه دوره (تومان)</span>
            <input className="b-input" dir="ltr" type="number" min={0} value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} /></label>
          <span className="flex items-end">
            <button className="b-btn b-btn-spring" disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ساخت باشگاه
            </button>
          </span>
        </form>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && clubs.length === 0 && <EmptyState icon={Trophy} title="باشگاهی تعریف نشده" />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 b-auto-stagger">
        {clubs.map((c) => {
          const full = c.enrolledCount >= c.capacity;
          const myStatus = role === "STUDENT"
            ? (data?.myEnrollments ?? []).find((e) => e.clubId === c.id)?.status
            : childId ? myMap.get(`${c.id}|${childId}`) : undefined;
          return (
            <div key={c.id} className={`b-card-md p-5 flex flex-col gap-2 ${!c.isActive ? "opacity-60" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <b className="text-[15px]">{c.name}</b>
                <span className={`b-badge ${c.isActive ? "b-badge-spring" : "b-badge-blossom"}`}>{c.isActive ? "فعال" : "غیرفعال"}</span>
              </span>
              <span className="text-[12.5px] text-steel">{DAYS[c.weekday]}{c.timeLabel ? ` · ${c.timeLabel}` : ""}{c.coach ? ` · مربی: ${c.coach}` : ""}</span>
              <span className="text-[12.5px] text-steel">
                ظرفیت: {faNumber(c.enrolledCount)} از {faNumber(c.capacity)}{full ? " (پر)" : ""}
                {c.minGrade || c.maxGrade ? ` · پایهٔ ${c.minGrade ?? "…"} تا ${c.maxGrade ?? "…"}` : ""}
                {c.fee > 0 ? ` · شهریه ${faNumber(c.fee)} تومان` : " · رایگان"}
              </span>
              <span className="flex gap-1.5 mt-1 flex-wrap">
                {!isStaff && myStatus && (
                  <span className={`b-badge ${myStatus === "ENROLLED" ? "b-badge-spring" : "b-badge-neutral"}`}>{myStatus === "ENROLLED" ? "ثبت‌نام‌شده" : "لیست انتظار"}</span>
                )}
                {!isStaff && (role === "STUDENT" || childId) && c.isActive && (
                  myStatus
                    ? <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === c.id} onClick={() => enroll(c, true)}><UserX className="w-3.5 h-3.5" /> لغو ثبت‌نام</button>
                    : <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === c.id} onClick={() => enroll(c, false)}><UserCheck className="w-3.5 h-3.5" /> {full ? "لیست انتظار" : "ثبت‌نام"}</button>
                )}
                {isStaff && (
                  <button className="b-btn b-btn-ghost b-btn-sm" disabled={busy === c.id} onClick={() => toggle(c)}>
                    <Power className="w-3.5 h-3.5" /> {c.isActive ? "غیرفعال" : "فعال"}
                  </button>
                )}
                {isStaff && (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === c.id}
                    onClick={async () => { if (!window.confirm(`باشگاه «${c.name}» و همهٔ ثبت‌نام‌هایش حذف شود؟`)) return; try { await apiDelete(`/api/clubs?id=${c.id}`); toast.success("باشگاه حذف شد."); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}>
                    <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
