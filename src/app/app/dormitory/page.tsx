"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, BedDouble, CalendarOff } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Building = { id: string; name: string; address: string; isActive: boolean; rooms: Array<{ id: string; name: string; floor: number; capacity: number; notes: string; isActive: boolean }> };
type Assignment = { id: string; studentId: string; studentName: string; roomId: string; buildingName: string; bedLabel: string; status: string; startDate: string; endDate: string | null; room: { name: string } };
type Leave = { id: string; studentId: string; studentName: string; fromDate: string; toDate: string; reason: string | null; status: string };
type DormData = { buildings: Building[]; assignments: Assignment[]; leaves: Leave[] };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };

const LEAVE_FA: Record<string, string> = { PENDING: "در انتظار", APPROVED: "تأیید شده", REJECTED: "رد شده" };

export default function DormitoryPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isStaff = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"].includes(role);
  const isAudience = role === "STUDENT" || role === "PARENT";
  const { data, loading, error, refetch } = useApi<DormData>("/api/dormitory");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(isStaff ? "/api/classes" : null);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: roster } = useApi<{ students: StudentRow[] }>(isStaff && classId ? `/api/seating?classId=${classId}` : null);
  const [busy, setBusy] = useState("");

  const [bName, setBName] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [rBuilding, setRBuilding] = useState("");
  const [rName, setRName] = useState("");
  const [rFloor, setRFloor] = useState("0");
  const [rCapacity, setRCapacity] = useState("4");
  const [roomId, setRoomId] = useState("");
  const [bedLabel, setBedLabel] = useState("");
  const [leaveStudent, setLeaveStudent] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      await apiPost("/api/dormitory", { action, ...extra });
      toast.success("انجام شد.");
      refetch();
      return true;
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); return false; }
    finally { setBusy(""); }
  }

  const activeAssignments = (data?.assignments ?? []).filter((a) => a.status === "ACTIVE");
  const rooms = (data?.buildings ?? []).flatMap((b) => b.rooms.map((r) => ({ ...r, buildingName: b.name })));
  const occupancy = (rid: string) => activeAssignments.filter((a) => a.roomId === rid).length;
  const audienceStudents = [...new Map((data?.assignments ?? []).map((a) => [a.studentId, a.studentName])).entries()];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="خوابگاه شبانه‌روزی" desc="ساختمان و اتاق با ظرفیت، اسکان دانش‌آموزان و مرخصی‌های شبانه‌روزی — جدا از سرویس ایاب‌وذهاب و مرخصی کارکنان." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="ساختمان" value={data.buildings.length} tone="spring" />
            <StatCard icon={BedDouble} label="اتاق" value={rooms.length} tone="soft" />
            <StatCard icon={BedDouble} label="ساکنان فعال" value={activeAssignments.length} tone="ink" />
            <StatCard icon={CalendarOff} label="مرخصی در انتظار" value={data.leaves.filter((l) => l.status === "PENDING").length} tone="soft" />
          </div>

          {isStaff && (
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <div className="b-card p-6 flex flex-col gap-3">
                <b className="text-[14px]">ساختمان جدید</b>
                <span className="flex gap-2 flex-wrap">
                  <input className="b-input flex-1 min-w-36" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="نام ساختمان" />
                  <input className="b-input flex-1 min-w-36" value={bAddress} onChange={(e) => setBAddress(e.target.value)} placeholder="نشانی (اختیاری)" />
                  <button className="b-btn b-btn-spring" disabled={busy === "createBuilding" || !bName} onClick={async () => { if (await post("createBuilding", { name: bName, address: bAddress })) { setBName(""); setBAddress(""); } }}>ثبت ساختمان</button>
                </span>
                <b className="text-[14px] mt-2">اتاق جدید</b>
                <span className="flex gap-2 flex-wrap">
                  <Select value={rBuilding} onChange={setRBuilding} options={[{ value: "", label: "انتخاب ساختمان" }, ...(data.buildings ?? []).map((b) => ({ value: b.id, label: b.name }))]} placeholder="ساختمان" />
                  <input className="b-input w-32" value={rName} onChange={(e) => setRName(e.target.value)} placeholder="نام اتاق" />
                  <input className="b-input w-20" dir="ltr" inputMode="numeric" value={rFloor} onChange={(e) => setRFloor(e.target.value)} placeholder="طبقه" />
                  <input className="b-input w-24" dir="ltr" inputMode="numeric" value={rCapacity} onChange={(e) => setRCapacity(e.target.value)} placeholder="ظرفیت" />
                  <button className="b-btn b-btn-spring" disabled={busy === "createRoom" || !rBuilding || !rName} onClick={async () => { if (await post("createRoom", { buildingId: rBuilding, name: rName, floor: Number(rFloor) || 0, capacity: Number(rCapacity) || 0 })) { setRName(""); } }}>ثبت اتاق</button>
                </span>
              </div>

              <div className="b-card p-6 flex flex-col gap-3">
                <b className="text-[14px]">اسکان دانش‌آموز</b>
                <span className="flex gap-2 flex-wrap">
                  <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" />
                  <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="دانش‌آموز" />
                </span>
                <span className="flex gap-2 flex-wrap">
                  <Select value={roomId} onChange={setRoomId} options={[{ value: "", label: "انتخاب اتاق" }, ...rooms.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.buildingName} · ${r.name} (اشغال ${faNumber(occupancy(r.id))} از ${faNumber(r.capacity)})` }))]} placeholder="اتاق" />
                  <input className="b-input w-28" value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} placeholder="تخت (اختیاری)" />
                  <button className="b-btn b-btn-spring" disabled={busy === "assign" || !studentId || !roomId} onClick={async () => { if (await post("assign", { studentId, roomId, bedLabel })) { setBedLabel(""); } }}>
                    {busy === "assign" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BedDouble className="w-4 h-4" />} اسکان
                  </button>
                </span>
                <p className="text-[12.5px] text-steel">اسکان دوم برای دانش‌آموزی که اسکان فعال دارد، و اسکان در اتاق پر، پذیرفته نمی‌شود.</p>
              </div>
            </div>
          )}

          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">اتاق‌ها و ساکنان</b>
            {rooms.length === 0 && <span className="text-[12.5px] text-steel">هنوز اتاقی ثبت نشده است.</span>}
            {rooms.map((r) => (
              <div key={r.id} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                <span><b>{r.buildingName} · {r.name}</b><span className="text-steel"> — طبقهٔ {faNumber(r.floor)} · ظرفیت {faNumber(r.capacity)} · اشغال {faNumber(occupancy(r.id))}</span>{!r.isActive && <span className="text-steel"> (غیرفعال)</span>}</span>
                <span className="block text-[12.5px] text-steel">{activeAssignments.filter((a) => a.roomId === r.id).map((a) => `${a.studentName}${a.bedLabel ? ` (تخت ${a.bedLabel})` : ""}`).join("، ") || "بدون ساکن"}</span>
              </div>
            ))}
            {isStaff && activeAssignments.length > 0 && (
              <div className="flex flex-col gap-1 mt-3">
                <b className="text-[13px]">پایان اسکان</b>
                {activeAssignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-[12.5px]">
                    <span>{a.studentName} — {a.buildingName} · {a.room.name}</span>
                    <button className="b-btn b-btn-ghost" disabled={busy === "endAssignment"} onClick={() => post("endAssignment", { id: a.id })}>پایان اسکان</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">مرخصی‌های خوابگاهی</b>
            {data.leaves.length === 0 && <span className="text-[12.5px] text-steel">مرخصی‌ای ثبت نشده است.</span>}
            {data.leaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                <span>{l.studentName}<span className="text-steel"> · {formatDateFa(l.fromDate)} تا {formatDateFa(l.toDate)}{l.reason ? ` · ${l.reason}` : ""}</span><span className="block text-[11px] text-steel">{LEAVE_FA[l.status] ?? l.status}</span></span>
                {isStaff && l.status === "PENDING" && (
                  <span className="flex gap-2">
                    <button className="b-btn b-btn-spring" disabled={busy === "decideLeave"} onClick={() => post("decideLeave", { id: l.id, decision: "APPROVED" })}>تأیید</button>
                    <button className="b-btn b-btn-ghost" disabled={busy === "decideLeave"} onClick={() => post("decideLeave", { id: l.id, decision: "REJECTED" })}>رد</button>
                  </span>
                )}
              </div>
            ))}
            {(isAudience || isStaff) && (
              <span className="flex gap-2 flex-wrap mt-1">
                {isAudience && <Select value={leaveStudent} onChange={setLeaveStudent} options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...audienceStudents.map(([id, name]) => ({ value: id, label: name }))]} placeholder="دانش‌آموز" />}
                {isStaff && <span className="text-[12.5px] text-steel">مرخصی را دانش‌آموز یا ولی از همین صفحه ثبت می‌کند؛ کادر فقط تأیید/رد می‌کند.</span>}
                {isAudience && (
                  <>
                    <input className="b-input w-36" type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
                    <input className="b-input w-36" type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
                    <input className="b-input flex-1 min-w-36" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="دلیل (اختیاری)" />
                    <button className="b-btn b-btn-spring" disabled={busy === "requestLeave" || !leaveStudent || !leaveFrom || !leaveTo} onClick={async () => { if (await post("requestLeave", { studentId: leaveStudent, fromDate: leaveFrom, toDate: leaveTo, reason: leaveReason })) { setLeaveReason(""); } }}>ثبت مرخصی</button>
                  </>
                )}
              </span>
            )}
          </div>

          {data.assignments.length === 0 && data.leaves.length === 0 && !isStaff && <EmptyState icon={BedDouble} title="اسکان خوابگاهی ثبت نشده است" />}
        </>
      )}
    </div>
  );
}
