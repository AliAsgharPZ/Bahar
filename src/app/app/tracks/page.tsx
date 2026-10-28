"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Programme = { id: string; kind: string; name: string; field: string; degreeLevel: string | null; _count: { enrollments: number } };
type Row = { id: string; studentName: string; [k: string]: unknown };
type TracksData = { programmes: Programme[]; enrollments: Row[]; theses: Row[]; internships: Row[]; workshops: Array<{ id: string; title: string; date: string; location: string; _count: { attendances: number } }> };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };

export default function TracksPage() {
  const { data, loading, error, refetch } = useApi<TracksData>("/api/tracks");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const [busy, setBusy] = useState("");

  const [kind, setKind] = useState("HIGHER_ED");
  const [pName, setPName] = useState("");
  const [pField, setPField] = useState("");
  const [pDegree, setPDegree] = useState("");
  const [progId, setProgId] = useState("");
  const [thesisTitle, setThesisTitle] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [intStart, setIntStart] = useState("");
  const [intEnd, setIntEnd] = useState("");
  const [intHours, setIntHours] = useState("");
  const [wsTitle, setWsTitle] = useState("");
  const [wsDate, setWsDate] = useState("");

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try { await apiPost("/api/tracks", { action, ...extra }); toast.success("انجام شد."); refetch(); return true; }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); return false; }
    finally { setBusy(""); }
  }

  const studentPicker = (
    <span className="flex gap-2 flex-wrap">
      <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" />
      <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="دانش‌آموز" />
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="مسیرهای تخصصی" desc="رشته‌های آموزش عالی و فنی‌حرفه‌ای، پایان‌نامه، کارورزی و کارگاه — وصل به همان دانش‌آموز و مدرسه." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">رشتهٔ جدید</b>
              <span className="flex gap-2 flex-wrap">
                <Select value={kind} onChange={setKind} options={[{ value: "HIGHER_ED", label: "آموزش عالی" }, { value: "VOCATIONAL", label: "فنی‌حرفه‌ای" }]} placeholder="نوع" />
                <input className="b-input flex-1 min-w-36" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="نام رشته" />
                <input className="b-input w-32" value={pField} onChange={(e) => setPField(e.target.value)} placeholder="رشته/حوزه" />
                <input className="b-input w-32" value={pDegree} onChange={(e) => setPDegree(e.target.value)} placeholder="مقطع (اختیاری)" />
                <button className="b-btn b-btn-spring" disabled={busy === "createProgramme" || !pName} onClick={async () => { if (await post("createProgramme", { kind, name: pName, field: pField, degreeLevel: pDegree })) { setPName(""); setPField(""); setPDegree(""); } }}>ثبت رشته</button>
              </span>
              <b className="text-[14px] mt-2">ثبت‌نام در رشته</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <Select value={progId} onChange={setProgId} options={[{ value: "", label: "انتخاب رشته" }, ...data.programmes.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === "HIGHER_ED" ? "آموزش عالی" : "فنی‌حرفه‌ای"})` }))]} placeholder="رشته" />
                <button className="b-btn b-btn-spring" disabled={busy === "enroll" || !progId || !studentId} onClick={() => post("enroll", { programmeId: progId, studentId })}>ثبت‌نام</button>
              </span>
            </div>
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">رشته‌ها</b>
              {data.programmes.length === 0 && <span className="text-[12.5px] text-steel">رشته‌ای ثبت نشده است.</span>}
              {data.programmes.map((p) => (
                <div key={p.id} className="py-2 border-b border-hairline last:border-0 text-[13px]">
                  <b>{p.name}</b><span className="text-steel"> — {p.kind === "HIGHER_ED" ? "آموزش عالی" : "فنی‌حرفه‌ای"}{p.field ? ` · ${p.field}` : ""}{p.degreeLevel ? ` · ${p.degreeLevel}` : ""} · {faNumber(p._count.enrollments)} ثبت‌نام</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">پایان‌نامهٔ جدید</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={thesisTitle} onChange={(e) => setThesisTitle(e.target.value)} placeholder="عنوان پایان‌نامه" />
                <button className="b-btn b-btn-spring" disabled={busy === "createThesis" || !studentId || !thesisTitle} onClick={async () => { if (await post("createThesis", { programmeId: progId || undefined, studentId, title: thesisTitle })) setThesisTitle(""); }}>ثبت پایان‌نامه</button>
              </span>
              {data.theses.map((t) => (
                <div key={t.id} className="py-1 border-b border-hairline last:border-0 text-[13px]">
                  <b>{String(t.title)}</b><span className="text-steel"> — {t.studentName} · {String(t.status)}</span>
                  <span className="flex gap-2 mt-1">
                    <button className="b-btn b-btn-ghost" onClick={() => post("updateThesis", { id: t.id, status: "IN_PROGRESS" })}>در حال انجام</button>
                    <button className="b-btn b-btn-ghost" onClick={() => post("updateThesis", { id: t.id, status: "DEFENDED" })}>دفاع‌شده</button>
                  </span>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">کارورزی جدید</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder="محل کارورزی" />
                <input className="b-input w-32" type="date" value={intStart} onChange={(e) => setIntStart(e.target.value)} />
                <input className="b-input w-32" type="date" value={intEnd} onChange={(e) => setIntEnd(e.target.value)} />
                <input className="b-input w-24" dir="ltr" inputMode="numeric" value={intHours} onChange={(e) => setIntHours(e.target.value)} placeholder="ساعت کل" />
                <button className="b-btn b-btn-spring" disabled={busy === "createInternship" || !studentId || !workplace || !intStart || !intEnd || !intHours} onClick={() => post("createInternship", { programmeId: progId || undefined, studentId, workplace, startDate: intStart, endDate: intEnd, hoursTotal: Number(intHours) || 0 })}>ثبت کارورزی</button>
              </span>
              {data.internships.map((i) => (
                <div key={i.id} className="py-1 border-b border-hairline last:border-0 text-[13px]">
                  <b>{String(i.workplace)}</b><span className="text-steel"> — {i.studentName} · {faNumber(Number(i.hoursDone))} از {faNumber(Number(i.hoursTotal))} ساعت · {String(i.status)}</span>
                </div>
              ))}
              <b className="text-[14px] mt-2">جلسهٔ کارگاه جدید</b>
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={wsTitle} onChange={(e) => setWsTitle(e.target.value)} placeholder="عنوان کارگاه" />
                <input className="b-input w-36" type="date" value={wsDate} onChange={(e) => setWsDate(e.target.value)} />
                <button className="b-btn b-btn-spring" disabled={busy === "createWorkshop" || !wsTitle || !wsDate} onClick={() => post("createWorkshop", { programmeId: progId || undefined, title: wsTitle, date: wsDate })}>ثبت کارگاه</button>
              </span>
              {data.workshops.map((w) => (
                <div key={w.id} className="py-1 border-b border-hairline last:border-0 text-[13px]">
                  <b>{w.title}</b><span className="text-steel"> — {formatDateFa(w.date)} · {faNumber(w._count.attendances)} حاضر</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
