"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/client";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type ClassRow = { id: string; name: string; academicYear: string };
type SubjectRow = { id: string; name: string };
type Group = { members: { id: string; name: string; avg: number | null }[]; avg: number | null };

export default function StudyGroupsPage() {
  const { t } = useLang();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [size, setSize] = useState("4");
  const [result, setResult] = useState<{ class: { name: string }; subject: string | null; groups: Group[]; ungraded: number; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: subjectsData } = useApi<{ subjects: SubjectRow[] }>("/api/subjects");

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/study-groups?classId=${classId}&subjectId=${subjectId}&size=${size}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? t("common.errorShort"));
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("studyGroups.title")} desc={t("studyGroups.desc")} />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">{t("common.class")}</span>
          <Select value={classId} onChange={setClassId} options={[{ value: "", label: t("studyGroups.firstClass") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder={t("common.class")} />
        </label>
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">{t("studyGroups.subjectOptional")}</span>
          <Select value={subjectId} onChange={setSubjectId} options={[{ value: "", label: t("studyGroups.allSubjectsAvg") }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("studyGroups.subjectPlaceholder")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-sm font-bold">{t("studyGroups.groupSize")}</span>
          <Select value={size} onChange={setSize} options={[{ value: "3", label: t("studyGroups.size3") }, { value: "4", label: t("studyGroups.size4") }, { value: "5", label: t("studyGroups.size5") }, { value: "6", label: t("studyGroups.size6") }]} placeholder={t("studyGroups.sizePlaceholder")} />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? t("studyGroups.building") : t("studyGroups.build")}</button>
      </div>

      {!result && <p className="t-sm text-steel">{t("studyGroups.hint")}</p>}
      {result && (
        <>
          <p className="t-sm text-steel">
            {t("common.class")} {result.class.name}{result.subject ? ` · ${t("studyGroups.subjectPrefix")} ${result.subject}` : ` · ${t("studyGroups.allSubjects")}`}
            {result.ungraded > 0 ? ` · ${result.ungraded} ${t("studyGroups.ungradedSuffix")}` : ""}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.groups.map((g, i) => (
              <div key={i} className="b-card p-4 md:p-5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[14px]">{t("studyGroups.group")} {i + 1}</b>
                  <span className="b-badge b-badge-spring">{g.avg !== null ? `${t("studyGroups.avgPrefix")} ${g.avg}` : t("studyGroups.noAvg")}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {g.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{m.name}</span>
                      <span className="text-steel shrink-0">{m.avg !== null ? m.avg : "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="t-sm text-steel">{result.note}</p>
        </>
      )}
    </div>
  );
}
