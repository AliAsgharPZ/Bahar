"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Programme = { id: string; kind: string; name: string; field: string; degreeLevel: string | null; _count: { enrollments: number } };
type Row = { id: string; studentName: string; [k: string]: unknown };
type TracksData = { programmes: Programme[]; enrollments: Row[]; theses: Row[]; internships: Row[]; workshops: Array<{ id: string; title: string; date: string; location: string; _count: { attendances: number } }> };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };

export default function TracksPage() {
  const { t } = useLang();
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
    try { await apiPost("/api/tracks", { action, ...extra }); toast.success(t("tracks.toast.done")); refetch(); return true; }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); return false; }
    finally { setBusy(""); }
  }

  const studentPicker = (
    <span className="flex gap-2 flex-wrap">
      <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: t("tracks.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} />
      <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: t("tracks.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} />
    </span>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.tracks")} desc={t("tracks.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">{t("tracks.programme.new")}</b>
              <span className="flex gap-2 flex-wrap">
                <Select value={kind} onChange={setKind} options={[{ value: "HIGHER_ED", label: t("tracks.kind.higherEd") }, { value: "VOCATIONAL", label: t("tracks.kind.vocational") }]} placeholder={t("tracks.placeholder.kind")} />
                <input className="b-input flex-1 min-w-36" value={pName} onChange={(e) => setPName(e.target.value)} placeholder={t("tracks.placeholder.programmeName")} />
                <input className="b-input w-32" value={pField} onChange={(e) => setPField(e.target.value)} placeholder={t("tracks.placeholder.field")} />
                <input className="b-input w-32" value={pDegree} onChange={(e) => setPDegree(e.target.value)} placeholder={t("tracks.placeholder.degree")} />
                <button className="b-btn b-btn-spring" disabled={busy === "createProgramme" || !pName} onClick={async () => { if (await post("createProgramme", { kind, name: pName, field: pField, degreeLevel: pDegree })) { setPName(""); setPField(""); setPDegree(""); } }}>{t("tracks.programme.create")}</button>
              </span>
              <b className="text-[14px] mt-2">{t("tracks.enroll.title")}</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <Select value={progId} onChange={setProgId} options={[{ value: "", label: t("tracks.select.programme") }, ...data.programmes.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === "HIGHER_ED" ? t("tracks.kind.higherEd") : t("tracks.kind.vocational")})` }))]} placeholder={t("tracks.programme.label")} />
                <button className="b-btn b-btn-spring" disabled={busy === "enroll" || !progId || !studentId} onClick={() => post("enroll", { programmeId: progId, studentId })}>{t("tracks.enroll.action")}</button>
              </span>
            </div>
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">{t("tracks.programme.list")}</b>
              {data.programmes.length === 0 && <span className="text-[12px] text-steel">{t("tracks.programme.empty")}</span>}
              {data.programmes.map((p) => (
                <div key={p.id} className="py-2 border-b border-hairline last:border-0 text-[14px]">
                  <b>{p.name}</b><span className="text-steel"> — {p.kind === "HIGHER_ED" ? t("tracks.kind.higherEd") : t("tracks.kind.vocational")}{p.field ? ` · ${p.field}` : ""}{p.degreeLevel ? ` · ${p.degreeLevel}` : ""} · {faNumber(p._count.enrollments)} {t("tracks.enroll.count")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">{t("tracks.thesis.new")}</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={thesisTitle} onChange={(e) => setThesisTitle(e.target.value)} placeholder={t("tracks.placeholder.thesisTitle")} />
                <button className="b-btn b-btn-spring" disabled={busy === "createThesis" || !studentId || !thesisTitle} onClick={async () => { if (await post("createThesis", { programmeId: progId || undefined, studentId, title: thesisTitle })) setThesisTitle(""); }}>{t("tracks.thesis.create")}</button>
              </span>
              {data.theses.map((th) => (
                <div key={th.id} className="py-1 border-b border-hairline last:border-0 text-[14px]">
                  <b>{String(th.title)}</b><span className="text-steel"> — {th.studentName} · {String(th.status)}</span>
                  <span className="flex gap-2 mt-1">
                    <button className="b-btn b-btn-ghost" onClick={() => post("updateThesis", { id: th.id, status: "IN_PROGRESS" })}>{t("tracks.thesis.inProgress")}</button>
                    <button className="b-btn b-btn-ghost" onClick={() => post("updateThesis", { id: th.id, status: "DEFENDED" })}>{t("tracks.thesis.defended")}</button>
                  </span>
                </div>
              ))}
            </div>
            <div className="b-card p-6 flex flex-col gap-3">
              <b className="text-[14px]">{t("tracks.internship.new")}</b>
              {studentPicker}
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={workplace} onChange={(e) => setWorkplace(e.target.value)} placeholder={t("tracks.placeholder.workplace")} />
                <input className="b-input w-32" type="date" value={intStart} onChange={(e) => setIntStart(e.target.value)} />
                <input className="b-input w-32" type="date" value={intEnd} onChange={(e) => setIntEnd(e.target.value)} />
                <input className="b-input w-24" dir="ltr" inputMode="numeric" value={intHours} onChange={(e) => setIntHours(e.target.value)} placeholder={t("tracks.placeholder.totalHours")} />
                <button className="b-btn b-btn-spring" disabled={busy === "createInternship" || !studentId || !workplace || !intStart || !intEnd || !intHours} onClick={() => post("createInternship", { programmeId: progId || undefined, studentId, workplace, startDate: intStart, endDate: intEnd, hoursTotal: Number(intHours) || 0 })}>{t("tracks.internship.create")}</button>
              </span>
              {data.internships.map((i) => (
                <div key={i.id} className="py-1 border-b border-hairline last:border-0 text-[14px]">
                  <b>{String(i.workplace)}</b><span className="text-steel"> — {i.studentName} · {faNumber(Number(i.hoursDone))} {t("common.from")} {faNumber(Number(i.hoursTotal))} {t("common.time")} · {String(i.status)}</span>
                </div>
              ))}
              <b className="text-[14px] mt-2">{t("tracks.workshop.new")}</b>
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={wsTitle} onChange={(e) => setWsTitle(e.target.value)} placeholder={t("tracks.placeholder.workshopTitle")} />
                <input className="b-input w-36" type="date" value={wsDate} onChange={(e) => setWsDate(e.target.value)} />
                <button className="b-btn b-btn-spring" disabled={busy === "createWorkshop" || !wsTitle || !wsDate} onClick={() => post("createWorkshop", { programmeId: progId || undefined, title: wsTitle, date: wsDate })}>{t("tracks.workshop.create")}</button>
              </span>
              {data.workshops.map((w) => (
                <div key={w.id} className="py-1 border-b border-hairline last:border-0 text-[14px]">
                  <b>{w.title}</b><span className="text-steel"> — {formatDateFa(w.date)} · {faNumber(w._count.attendances)} {t("enum.attendance.PRESENT")}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
