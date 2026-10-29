"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, BedDouble, CalendarOff } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Building = { id: string; name: string; address: string; isActive: boolean; rooms: Array<{ id: string; name: string; floor: number; capacity: number; notes: string; isActive: boolean }> };
type Assignment = { id: string; studentId: string; studentName: string; roomId: string; buildingName: string; bedLabel: string; status: string; startDate: string; endDate: string | null; room: { name: string } };
type Leave = { id: string; studentId: string; studentName: string; fromDate: string; toDate: string; reason: string | null; status: string };
type DormData = { buildings: Building[]; assignments: Assignment[]; leaves: Leave[] };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };

const LEAVE_TKEY: Record<string, string> = { PENDING: "dashboard.meeting.pending", APPROVED: "enum.leaveFa.APPROVED", REJECTED: "enum.leaveFa.REJECTED" };

export default function DormitoryPage() {
  const { t } = useLang();
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
      toast.success(t("dormitory.anjam-shd"));
      refetch();
      return true;
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); return false; }
    finally { setBusy(""); }
  }

  const activeAssignments = (data?.assignments ?? []).filter((a) => a.status === "ACTIVE");
  const rooms = (data?.buildings ?? []).flatMap((b) => b.rooms.map((r) => ({ ...r, buildingName: b.name })));
  const occupancy = (rid: string) => activeAssignments.filter((a) => a.roomId === rid).length;
  const audienceStudents = [...new Map((data?.assignments ?? []).map((a) => [a.studentId, a.studentName])).entries()];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("dormitory.khvabgah-shbanh-rvzy")} desc={t("dormitory.sakhtman-v-ataq-ba-zrfyt-askan-dansh-amvzan-v-mrkhsy-hay-shbanh")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2} label={t("dormitory.sakhtman")} value={data.buildings.length} tone="spring" />
            <StatCard icon={BedDouble} label={t("dormitory.ataq")} value={rooms.length} tone="soft" />
            <StatCard icon={BedDouble} label={t("dormitory.saknan-faal")} value={activeAssignments.length} tone="ink" />
            <StatCard icon={CalendarOff} label={t("dormitory.mrkhsy-dr-antzar")} value={data.leaves.filter((l) => l.status === "PENDING").length} tone="soft" />
          </div>

          {isStaff && (
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <div className="b-card p-6 flex flex-col gap-3">
                <b className="text-[14px]">{t("dormitory.sakhtman-jdyd")}</b>
                <span className="flex gap-2 flex-wrap">
                  <input className="b-input flex-1 min-w-36" value={bName} onChange={(e) => setBName(e.target.value)} placeholder={t("dormitory.nam-sakhtman")} />
                  <input className="b-input flex-1 min-w-36" value={bAddress} onChange={(e) => setBAddress(e.target.value)} placeholder={t("dormitory.nshany-akhtyary")} />
                  <button className="b-btn b-btn-spring" disabled={busy === "createBuilding" || !bName} onClick={async () => { if (await post("createBuilding", { name: bName, address: bAddress })) { setBName(""); setBAddress(""); } }}>{t("dormitory.sbt-sakhtman")}</button>
                </span>
                <b className="text-[14px] mt-2">{t("dormitory.ataq-jdyd")}</b>
                <span className="flex gap-2 flex-wrap">
                  <Select value={rBuilding} onChange={setRBuilding} options={[{ value: "", label: t("dormitory.antkhab-sakhtman") }, ...(data.buildings ?? []).map((b) => ({ value: b.id, label: b.name }))]} placeholder={t("dormitory.sakhtman")} />
                  <input className="b-input w-32" value={rName} onChange={(e) => setRName(e.target.value)} placeholder={t("dormitory.nam-ataq")} />
                  <input className="b-input w-20" dir="ltr" inputMode="numeric" value={rFloor} onChange={(e) => setRFloor(e.target.value)} placeholder={t("dormitory.tbqh")} />
                  <input className="b-input w-24" dir="ltr" inputMode="numeric" value={rCapacity} onChange={(e) => setRCapacity(e.target.value)} placeholder={t("dormitory.zrfyt")} />
                  <button className="b-btn b-btn-spring" disabled={busy === "createRoom" || !rBuilding || !rName} onClick={async () => { if (await post("createRoom", { buildingId: rBuilding, name: rName, floor: Number(rFloor) || 0, capacity: Number(rCapacity) || 0 })) { setRName(""); } }}>{t("dormitory.sbt-ataq")}</button>
                </span>
              </div>

              <div className="b-card p-6 flex flex-col gap-3">
                <b className="text-[14px]">{t("dormitory.askan-dansh-amvz")}</b>
                <span className="flex gap-2 flex-wrap">
                  <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: t("dormitory.antkhab-klas") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} />
                  <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: t("dormitory.antkhab-dansh-amvz") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} />
                </span>
                <span className="flex gap-2 flex-wrap">
                  <Select value={roomId} onChange={setRoomId} options={[{ value: "", label: t("dormitory.antkhab-ataq") }, ...rooms.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.buildingName} · ${r.name} ${t("dormitory.ashghal")} ${faNumber(occupancy(r.id))} ${t("common.from")} ${faNumber(r.capacity)})` }))]} placeholder={t("dormitory.ataq")} />
                  <input className="b-input w-28" value={bedLabel} onChange={(e) => setBedLabel(e.target.value)} placeholder={t("dormitory.tkht-akhtyary")} />
                  <button className="b-btn b-btn-spring" disabled={busy === "assign" || !studentId || !roomId} onClick={async () => { if (await post("assign", { studentId, roomId, bedLabel })) { setBedLabel(""); } }}>
                    {busy === "assign" ? <Loader2 className="w-4 h-4 animate-spin" /> : <BedDouble className="w-4 h-4" />} {t("dormitory.askan")}
                  </button>
                </span>
                <p className="text-[12.5px] text-steel">{t("dormitory.askan-dvm-bray-dansh-amvzy-kh-askan-faal-dard-v-askan-dr-ataq-pr")}</p>
              </div>
            </div>
          )}

          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">{t("dormitory.ataq-ha-v-saknan")}</b>
            {rooms.length === 0 && <span className="text-[12.5px] text-steel">{t("dormitory.hnvz-ataqy-sbt-nshdh-ast")}</span>}
            {rooms.map((r) => (
              <div key={r.id} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                <span><b>{r.buildingName} · {r.name}</b><span className="text-steel"> {t("dormitory.tbqh-2")} {faNumber(r.floor)} {t("dormitory.zrfyt-2")} {faNumber(r.capacity)} {t("dormitory.ashghal-2")} {faNumber(occupancy(r.id))}</span>{!r.isActive && <span className="text-steel"> ({t("common.inactive")})</span>}</span>
                <span className="block text-[12.5px] text-steel">{activeAssignments.filter((a) => a.roomId === r.id).map((a) => `${a.studentName}${a.bedLabel ? ` (تخت ${a.bedLabel})` : ""}`).join("، ") || t("dormitory.bdvn-sakn")}</span>
              </div>
            ))}
            {isStaff && activeAssignments.length > 0 && (
              <div className="flex flex-col gap-1 mt-3">
                <b className="text-[13px]">{t("dormitory.payan-askan")}</b>
                {activeAssignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-[12.5px]">
                    <span>{a.studentName} — {a.buildingName} · {a.room.name}</span>
                    <button className="b-btn b-btn-ghost" disabled={busy === "endAssignment"} onClick={() => post("endAssignment", { id: a.id })}>{t("dormitory.payan-askan")}</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">{t("dormitory.mrkhsy-hay-khvabgahy")}</b>
            {data.leaves.length === 0 && <span className="text-[12.5px] text-steel">{t("dormitory.mrkhsy-ay-sbt-nshdh-ast")}</span>}
            {data.leaves.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                <span>{l.studentName}<span className="text-steel"> · {formatDateFa(l.fromDate)} {t("common.to")} {formatDateFa(l.toDate)}{l.reason ? ` · ${l.reason}` : ""}</span><span className="block text-[12px] text-steel">{t(LEAVE_TKEY[l.status] ?? l.status)}</span></span>
                {isStaff && l.status === "PENDING" && (
                  <span className="flex gap-2">
                    <button className="b-btn b-btn-spring" disabled={busy === "decideLeave"} onClick={() => post("decideLeave", { id: l.id, decision: "APPROVED" })}>{t("dormitory.t-yyd")}</button>
                    <button className="b-btn b-btn-ghost" disabled={busy === "decideLeave"} onClick={() => post("decideLeave", { id: l.id, decision: "REJECTED" })}>{t("dormitory.rd")}</button>
                  </span>
                )}
              </div>
            ))}
            {(isAudience || isStaff) && (
              <span className="flex gap-2 flex-wrap mt-1">
                {isAudience && <Select value={leaveStudent} onChange={setLeaveStudent} options={[{ value: "", label: t("dormitory.antkhab-dansh-amvz") }, ...audienceStudents.map(([id, name]) => ({ value: id, label: name }))]} placeholder={t("common.student")} />}
                {isStaff && <span className="text-[12.5px] text-steel">{t("dormitory.mrkhsy-ra-dansh-amvz-ya-vly-az-hmyn-sfhh-sbt-my-knd-kadr-fqt-t-y")}/{t("dormitory.rd-my-knd")}</span>}
                {isAudience && (
                  <>
                    <input className="b-input w-36" type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
                    <input className="b-input w-36" type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
                    <input className="b-input flex-1 min-w-36" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder={t("dormitory.dlyl-akhtyary")} />
                    <button className="b-btn b-btn-spring" disabled={busy === "requestLeave" || !leaveStudent || !leaveFrom || !leaveTo} onClick={async () => { if (await post("requestLeave", { studentId: leaveStudent, fromDate: leaveFrom, toDate: leaveTo, reason: leaveReason })) { setLeaveReason(""); } }}>{t("dormitory.sbt-mrkhsy")}</button>
                  </>
                )}
              </span>
            )}
          </div>

          {data.assignments.length === 0 && data.leaves.length === 0 && !isStaff && <EmptyState icon={BedDouble} title={t("dormitory.askan-khvabgahy-sbt-nshdh-ast")} />}
        </>
      )}
    </div>
  );
}
