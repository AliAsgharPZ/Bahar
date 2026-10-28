"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };

const TOOLS = [
  { value: "simulation", label: "شبیه‌سازی «اگر…»" },
  { value: "history", label: "بازپخش تاریخچه" },
  { value: "permissions", label: "زمین‌بازی مجوزها" },
  { value: "quality", label: "آزمایشگاه کیفیت داده" },
  { value: "dependency", label: "نمای وابستگی" },
  { value: "forecast", label: "پیش‌بینی ظرفیت" },
];

export default function LabsPage() {
  const [tool, setTool] = useState("simulation");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [absenceDelta, setAbsenceDelta] = useState("10");
  const [entityType, setEntityType] = useState("Student");
  const [entityId, setEntityId] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [permInput, setPermInput] = useState("take_attendance,enter_grades");
  const [depKind, setDepKind] = useState("class");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);

  async function run() {
    setBusy(true);
    try {
      let url = `/api/labs?tool=${tool}`;
      if (tool === "simulation") url += `&classId=${classId}&absenceDelta=${absenceDelta}`;
      if (tool === "history") url += `&entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`;
      if (tool === "dependency") url += `&kind=${depKind}&id=${encodeURIComponent(depKind === "class" ? classId : studentId)}`;
      if (tool === "permissions") {
        const res = await apiPost("/api/labs", { role, permissions: permInput.split(",").map((s) => s.trim()).filter(Boolean) });
        setResult(res);
        return;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا");
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="آزمایشگاه‌ها" desc="شبیه‌سازی، بازپخش تاریخچه، زمین‌بازی مجوز، کیفیت داده، وابستگی و پیش‌بینی ظرفیت — همه فقط‌خواندنی، هیچ‌کدام داده را تغییر نمی‌دهند." />
      <div className="b-card p-6 flex flex-col gap-3">
        <span className="flex gap-2 flex-wrap">
          <Select value={tool} onChange={setTool} options={TOOLS.map((t) => ({ value: t.value, label: t.label }))} placeholder="ابزار" />
          {(tool === "simulation" || tool === "dependency") && (
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" />
          )}
          {tool === "simulation" && <input className="b-input w-36" dir="ltr" inputMode="numeric" value={absenceDelta} onChange={(e) => setAbsenceDelta(e.target.value)} placeholder="افزایش غیبت (٪)" />}
          {tool === "dependency" && <Select value={depKind} onChange={setDepKind} options={[{ value: "class", label: "کلاس" }, { value: "student", label: "دانش‌آموز" }]} placeholder="نوع" />}
          {tool === "dependency" && depKind === "student" && (
            <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="دانش‌آموز" />
          )}
          {tool === "history" && (
            <>
              <input className="b-input w-36" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="نوع موجودیت" />
              <input className="b-input flex-1 min-w-36" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="شناسهٔ موجودیت" />
            </>
          )}
          {tool === "permissions" && (
            <>
              <Select value={role} onChange={setRole} options={["SUPER_ADMIN", "MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"].map((r) => ({ value: r, label: r }))} placeholder="نقش" />
              <input className="b-input flex-1 min-w-48" value={permInput} onChange={(e) => setPermInput(e.target.value)} placeholder="مجوزها با ویرگول" dir="ltr" />
            </>
          )}
          <button className="b-btn b-btn-spring" disabled={busy} onClick={run}>{busy ? "در حال اجرا…" : "اجرا"}</button>
        </span>
        <p className="text-[12.5px] text-steel">خروجی شبیه‌سازی و پیش‌بینی، حسابی ساده و برچسب‌دار است — پیش‌بینی قطعی یا مدل یادگیری ماشین نیست.</p>
      </div>
      {Boolean(result) && (
        <div className="b-card p-6">
          <b className="text-[14px] mb-2 block">نتیجه</b>
          <pre className="text-[12px] overflow-x-auto whitespace-pre-wrap" dir="ltr">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
