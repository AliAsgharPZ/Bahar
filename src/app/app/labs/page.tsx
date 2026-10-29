"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };

const TOOLS = [
  { value: "simulation", labelKey: "labs.tool.simulation" },
  { value: "history", labelKey: "labs.tool.history" },
  { value: "permissions", labelKey: "labs.tool.permissions" },
  { value: "quality", labelKey: "labs.tool.quality" },
  { value: "dependency", labelKey: "labs.tool.dependency" },
  { value: "forecast", labelKey: "labs.tool.forecast" },
];

export default function LabsPage() {
  const { t } = useLang();
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
      if (!res.ok) throw new Error(json?.error?.message ?? t("common.errorShort"));
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.labs")} desc={t("labs.desc")} />
      <div className="b-card p-6 flex flex-col gap-3">
        <span className="flex gap-2 flex-wrap">
          <Select value={tool} onChange={setTool} options={TOOLS.map((x) => ({ value: x.value, label: t(x.labelKey) }))} placeholder={t("labs.tool.placeholder")} />
          {(tool === "simulation" || tool === "dependency") && (
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }} options={[{ value: "", label: t("labs.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} />
          )}
          {tool === "simulation" && <input className="b-input w-36" dir="ltr" inputMode="numeric" value={absenceDelta} onChange={(e) => setAbsenceDelta(e.target.value)} placeholder={t("labs.placeholder.absenceDelta")} />}
          {tool === "dependency" && <Select value={depKind} onChange={setDepKind} options={[{ value: "class", label: t("common.class") }, { value: "student", label: t("common.student") }]} placeholder={t("labs.placeholder.kind")} />}
          {tool === "dependency" && depKind === "student" && (
            <Select value={studentId} onChange={setStudentId} options={[{ value: "", label: t("labs.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} />
          )}
          {tool === "history" && (
            <>
              <input className="b-input w-36" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder={t("labs.placeholder.entityType")} />
              <input className="b-input flex-1 min-w-36" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder={t("labs.placeholder.entityId")} />
            </>
          )}
          {tool === "permissions" && (
            <>
              <Select value={role} onChange={setRole} options={["SUPER_ADMIN", "MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"].map((r) => ({ value: r, label: r }))} placeholder={t("common.role")} />
              <input className="b-input flex-1 min-w-48" value={permInput} onChange={(e) => setPermInput(e.target.value)} placeholder={t("labs.placeholder.permissions")} dir="ltr" />
            </>
          )}
          <button className="b-btn b-btn-spring" disabled={busy} onClick={run}>{busy ? t("labs.running") : t("labs.run")}</button>
        </span>
        <p className="text-[12px] text-steel">{t("labs.outputNote")}</p>
      </div>
      {Boolean(result) && (
        <div className="b-card p-6">
          <b className="text-[14px] mb-2 block">{t("labs.result")}</b>
          <pre className="text-[12px] overflow-x-auto whitespace-pre-wrap" dir="ltr">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
