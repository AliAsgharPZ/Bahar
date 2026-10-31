"use client";

/* ============================================================
   بهار | ایمپورت و اکسپورت انبوه (راند ۱۸)
   ویزارد کامل: فایل اکسل (xlsx) یا CSV/چسباندن متن →
   تطبیق ستون‌ها → اعتبارسنجی → ثبت در کلاس هدف → تاریخچه.
   اکسپورت: دانش‌آموزان / کاربران / کلاس‌ها به فایل اکسل واقعی.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, ClipboardPaste, Download, History, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Play, ArrowLeft, RotateCcw, Users, GraduationCap, BookOpen,
  ClipboardList, CalendarCheck, Wallet,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber, relativeTimeFa, enDigits } from "@/lib/persian";
import { useConfirm } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type ValRow = { row: number; errors: string[]; warnings: string[]; data: Record<string, string> };
type ImportJob = { id: string; kind: string; filename: string; totalRows: number; successRows: number | null; failedRows: number | null; status: string; createdAt: string; user: { firstName: string; lastName: string } };
type ClassOpt = { id: string; name: string; grade: string };

const TARGET_FIELDS: Array<{ key: string; required?: boolean }> = [
  { key: "firstName", required: true },
  { key: "lastName", required: true },
  { key: "nationalId", required: true },
  { key: "studentNumber" },
  { key: "fatherName" },
  { key: "gender" },
  { key: "birthDate" },
  { key: "phone" },
  { key: "address" },
  { key: "previousSchool" },
];

const STAFF_FIELDS: Array<{ key: string; required?: boolean }> = [
  { key: "firstName", required: true },
  { key: "lastName", required: true },
  { key: "nationalId", required: true },
  { key: "role", required: true },
  { key: "phone" },
  { key: "email" },
];

/** تشخیص خودکار ستون‌ها از عنوان‌های فارسی/انگلیسی */
function autoDetect(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  const rules: Array<[string, RegExp]> = [
    ["lastName", /نام\s*خانوادگی|فامیلی|last/i],
    ["firstName", /^نام$|اسم|first/i],
    ["nationalId", /کد\s*ملی|کدملی|national|melli/i],
    ["studentNumber", /شماره\s*دانش|دانش\s*آموزی|student\s*num/i],
    ["fatherName", /نام\s*پدر|father/i],
    ["gender", /جنسیت|gender/i],
    ["birthDate", /تولد|birth/i],
    ["phone", /موبایل|تلفن|همراه|phone|mobile/i],
    ["address", /آدرس|نشانی|address/i],
    ["previousSchool", /مدرسه\s*قبلی|previous/i],
  ];
  for (const [field, re] of rules) {
    const hit = headers.find((h) => re.test(h.trim()));
    if (hit) m[field] = hit.trim();
  }
  return m;
}

const SAMPLE_CSV = `نام,نام خانوادگی,کد ملی,نام پدر,شماره دانش‌آموزی,موبایل
امیر,محمدی,۰۰۱۲۳۴۵۶۷۸,حسن,۴۰۱۱۲۳,۰۹۱۲۳۴۵۶۷۸۹
سارا,احمدی,۰۰۲۲۳۴۵۶۷۸,رضا,۴۰۱۱۲۴,۰۹۳۵۱۲۳۴۵۶۷`;

const IMPORT_FIELD_TKEY: Record<string, string> = {
  firstName: "common.name", lastName: "students.ph.lastName", nationalId: "students.field.nationalId",
  studentNumber: "students.field.studentNumber", fatherName: "students.field.fatherName",
  gender: "students.field.gender", birthDate: "imports.field.birthDate", phone: "students.field.mobile",
  address: "students.field.address", previousSchool: "students.field.previousSchool",
  role: "imports.field.role", email: "users.field.email",
};

export default function ImportsPage() {
  const { t } = useLang();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<{ jobId: string; total: number; valid: number; invalid: number; preview: ValRow[] } | null>(null);
  const [classId, setClassId] = useState("");
  const [entryYear, setEntryYear] = useState("");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(() => {
    apiGet<{ jobs: ImportJob[] }>("/api/imports").then((d) => setJobs(d.jobs ?? [])).catch(() => setJobs([]));
  }, []);
  useEffect(() => {
    load();
    apiGet<{ classes: ClassOpt[] }>("/api/classes").then((d) => setClasses(d.classes ?? [])).catch(() => setClasses([]));
  }, [load]);

  function ingestText(text: string, name: string) {
    if (!text.trim()) { toast.error(t("imports.toast.emptyFile")); return; }
    setCsv(text);
    setSourceName(name);
    setResult(null);
    setValidation(null);
    const firstLine = text.split("\n")[0] ?? "";
    const hs = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^"|"$/g, "")).filter(Boolean);
    setHeaders(hs);
    setMapping(autoDetect(hs));
    toast.success(`${t("imports.toast.fileBefore")} «${name}» ${t("imports.toast.fileAfter")} ${faNumber(hs.length)} ${t("imports.toast.columns")}`);
  }

  async function onFile(file: File) {
    if (/\.xlsx$/i.test(file.name)) {
      setBusy("parse");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/imports/excel", { method: "POST", body: fd });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error?.message ?? t("imports.toast.excelReadFailed"));
        ingestText(json.csv, file.name);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.errorShort"));
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } else if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      ingestText(text, file.name);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      toast.error(t("imports.toast.onlyExcelCsv"));
    }
  }

  async function validate() {
    if (!csv.trim()) { toast.error(t("imports.toast.uploadFirst")); return; }
    setBusy("validate");
    try {
      const d = await apiPost<{ jobId: string; total: number; valid: number; invalid: number; preview: ValRow[] }>("/api/imports", {
        action: "validate",
        csv,
        mapping,
        kind: mode,
      });
      setValidation(d);
      setResult(null);
      if (d.invalid > 0) toast.warning(`${faNumber(d.valid)} ${t("imports.toast.validFrom")} ${faNumber(d.total)} — ${faNumber(d.invalid)} ${t("imports.toast.hasErrors")}`);
      else toast.success(`${t("common.all")} ${faNumber(d.valid)} ${t("imports.toast.allHealthyAfter")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.errorShort"));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    const isStaff = mode === "staff";
    if (!validation || (!isStaff && !classId)) { toast.error(t("imports.toast.selectClass")); return; }
    const ok = await confirm({
      title: isStaff ? `${t("imports.confirm.title")} ${faNumber(validation.valid)} ${t("imports.confirm.staff")}` : `${t("imports.confirm.title")} ${faNumber(validation.valid)} ${t("common.student")}`,
      description: isStaff
        ? <>{t("imports.confirm.staffDesc")}</>
        : <>{t("imports.confirm.studentsDesc")}</>,
      confirmLabel: t("imports.confirm.submit"),
      danger: true,
    });
    if (!ok) return;
    setBusy("commit");
    try {
      const d = await apiPost<{ success: number; failed: number }>("/api/imports", {
        action: "commit",
        importId: validation.jobId,
        csv,
        mapping,
        kind: mode,
        ...(isStaff ? {} : { classId, entryYear: entryYear ? enDigits(entryYear) : undefined }),
      });
      setResult(d);
      setValidation(null);
      setCsv("");
      setHeaders([]);
      setMapping({});
      setSourceName("");
      toast.success(isStaff
        ? `${faNumber(d.success)} ${t("imports.toast.importedStaff")}${d.failed ? ` — ${faNumber(d.failed)} ${t("common.errorShort")}` : ""}.`
        : `${faNumber(d.success)} ${t("imports.toast.importedStudents")}${d.failed ? ` — ${faNumber(d.failed)} ${t("common.errorShort")}` : ""}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.errorShort"));
    } finally {
      setBusy(null);
    }
  }

  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");

  async function exportExcel(type: "students" | "users" | "classes" | "grades" | "attendance" | "fees") {
    setBusy(`export-${type}`);
    try {
      const res = await fetch(`/api/export?type=${type}&format=${exportFormat}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? t("imports.toast.exportFailed"));
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bahar-${type}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(exportFormat === "csv" ? t("imports.toast.csvDownloaded") : t("imports.toast.xlsxDownloaded"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.errorShort"));
    } finally {
      setBusy(null);
    }
  }

  const [mode, setMode] = useState<"students" | "staff">("students");
  const FIELDS = mode === "staff" ? STAFF_FIELDS : TARGET_FIELDS;
  const mappedCount = useMemo(() => Object.values(mapping).filter(Boolean).length, [mapping]);
  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("imports.title")}
        desc={t("imports.desc")}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ═══ ایمپورت ═══ */}
        <section className="b-card p-5 md:p-6 flex flex-col gap-5">
          <h2 className="font-bold text-[16px] flex items-center gap-2">
            <Upload className="w-4.5 h-4.5 text-spring" /> {mode === "staff" ? t("imports.bulk.staff") : t("imports.bulk.students")}
          </h2>
          <div role="tablist" className="flex items-center gap-2" aria-label={t("imports.mode.aria")}>
            {(["students", "staff"] as const).map((md) => (
              <button role="tab" aria-selected={mode === md}
                key={md}
                onClick={() => { setMode(md); setValidation(null); setResult(null); setMapping({}); }}
                className={`b-pill-tab ${mode === md ? "b-pill-tab-active" : ""}`}
              >
                {md === "students" ? t("nav.students") : t("imports.mode.staff")}
              </button>
            ))}
          </div>

          {/* مرحله ۱ — فایل */}
          <div className="flex flex-col gap-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-spring bg-spring-tint" : "border-hairline hover:border-spring/50 hover:bg-spring-tint/40"
              }`}
              role="button"
              aria-label={t("imports.drop.aria")}
            >
              {busy === "parse" ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-spring animate-spin" />
              ) : (
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-spring" />
              )}
              <b className="text-[14px] block">{t("imports.drop.title")}</b>
              <span className="text-[12px] text-steel block mt-1">{t("imports.drop.hint")}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
            </div>
            <details className="b-card-sm !rounded-2xl p-3.5">
              <summary className="text-[12px] font-bold cursor-pointer flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-steel" /> {t("imports.paste.title")}
              </summary>
              <textarea
                value={csv}
                onChange={(e) => ingestText(e.target.value, t("imports.source.pasted"))}
                placeholder={t("imports.placeholder.columns")}
                className="b-input !min-h-[130px] font-mono !text-[12px] mt-3"
                dir="rtl"
              />
              <div className="flex items-center gap-2 mt-2">
                <button className="b-btn b-btn-ghost b-btn-sm !text-[12px]" onClick={() => ingestText(SAMPLE_CSV, t("imports.source.sample"))}>{t("imports.sample.insert")}</button>
                {csv && <button className="b-btn b-btn-ghost b-btn-sm !text-[12px] !text-destructive" onClick={() => { setCsv(""); setHeaders([]); setMapping({}); setValidation(null); setSourceName(""); }}><RotateCcw className="w-3 h-3" /> {t("imports.clear")}</button>}
              </div>
            </details>
            {sourceName && (
              <p className="text-[12px] text-steel flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-spring shrink-0" />
                {t("imports.source.label")} <b className="truncate">{sourceName}</b>
                {headers.length > 0 && <> — {faNumber(headers.length)} {t("imports.source.columns")} {headers.slice(0, 6).join("، ")}{headers.length > 6 ? "…" : ""}</>}
              </p>
            )}
          </div>

          {/* مرحله ۲ — تطبیق ستون‌ها */}
          {headers.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-[14px] flex items-center gap-2">
                {t("imports.mapping.title")}
                <span className="b-badge b-badge-neutral !text-[12px]">{faNumber(mappedCount)}/{faNumber(FIELDS.length)}</span>
                {missingRequired.length > 0 && (
                  <span className="b-badge b-badge-critical !text-[12px]">{t("imports.mapping.missingRequired")} {missingRequired.map((f) => t(IMPORT_FIELD_TKEY[f.key] ?? f.key)).join("، ")}</span>
                )}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">
                      {t(IMPORT_FIELD_TKEY[f.key] ?? f.key)}
                      {f.required && <span className="text-destructive"> *</span>}
                    </span>
                    <Select
                      value={mapping[f.key] ?? ""}
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                      placeholder={t("imports.mapping.none")}
                      options={[
                        { value: "", label: t("imports.mapping.none") },
                        ...headers.map((h) => ({ value: h, label: h })),
                      ]}
                      buttonClassName="!h-10"
                      className="w-full"
                      ariaLabel={`${t("imports.mapping.columnFor")} ${t(IMPORT_FIELD_TKEY[f.key] ?? f.key)}`}
                    />
                  </label>
                ))}
              </div>
              <button className="b-btn b-btn-spring w-fit" onClick={validate} disabled={busy !== null}>
                {busy === "validate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {t("imports.validate.action")}
              </button>
            </div>
          )}

          {/* مرحله ۳ — پیش‌نمایش */}
          {validation && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-[14px]">{t("imports.preview.title")}</h3>
                <span className="b-badge b-badge-spring">{faNumber(validation.valid)} {t("imports.preview.healthy")}</span>
                {validation.invalid > 0 && <span className="b-badge b-badge-critical">{faNumber(validation.invalid)} {t("common.errorShort")}</span>}
                <span className="b-badge b-badge-neutral">{faNumber(validation.total)} {t("imports.preview.rows")}</span>
              </div>
              <div className="max-h-64 overflow-auto b-scroll rounded-2xl border border-hairline-soft">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-cloud/60 dark:bg-forest/30 backdrop-blur">
                    <tr>
                      <th className="text-end py-2 px-3 font-bold w-10">#</th>
                      <th className="text-end py-2 px-3 font-bold">{t("imports.preview.fullName")}</th>
                      <th className="text-end py-2 px-3 font-bold">{t("students.field.nationalId")}</th>
                      <th className="text-end py-2 px-3 font-bold">{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.preview.map((v) => (
                      <tr key={v.row} className="border-t border-hairline-soft/60">
                        <td className="py-2 px-3 text-steel">{faNumber(v.row)}</td>
                        <td className="py-2 px-3">
                          {(v.data[mapping.firstName ?? "firstName"] ?? v.data.firstName) || "—"}{" "}
                          {(v.data[mapping.lastName ?? "lastName"] ?? v.data.lastName) || ""}
                        </td>
                        <td className="py-2 px-3 font-mono" dir="ltr">{v.data[mapping.nationalId ?? "nationalId"] ?? v.data.nationalId ?? "—"}</td>
                        <td className="py-2 px-3">
                          {v.errors.length > 0 ? (
                            <span className="text-destructive flex items-start gap-1" title={v.errors.join("؛ ")}>
                              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {v.errors[0]}
                            </span>
                          ) : v.warnings.length > 0 ? (
                            <span className="text-warning-deep flex items-start gap-1" title={v.warnings.join("؛ ")}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {v.warnings[0]}
                            </span>
                          ) : (
                            <span className="text-spring flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t("imports.preview.healthy")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validation.valid === 0 && (
                <p className="text-[12px] text-destructive">{t("imports.preview.noHealthy")}</p>
              )}

              {/* مرحله ۴ — ثبت */}
              <div className="b-card-sm !rounded-2xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-[12px]">{mode === "staff" ? t("imports.commit.staffTitle") : t("imports.commit.studentsTitle")}</h4>
                {mode === "students" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-bold">{t("imports.commit.targetClass")}</span>
                      <Select
                        value={classId}
                        onChange={setClassId}
                        placeholder={t("imports.commit.selectClass")}
                        searchable
                        options={classes.map((c) => ({ value: c.id, label: `${c.name}${c.grade ? ` — ${c.grade}` : ""}` }))}
                        buttonClassName="!h-10"
                        className="w-full"
                        ariaLabel={t("imports.commit.targetClassAria")}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-bold">{t("imports.commit.entryYear")}</span>
                      <input className="b-input !h-10" dir="ltr" inputMode="numeric" placeholder="1404" value={entryYear} onChange={(e) => setEntryYear(e.target.value.replace(/[^0-9]/g, ""))} />
                    </label>
                  </div>
                )}
                <button className="b-btn b-btn-spring w-fit" onClick={commit} disabled={busy !== null || validation.valid === 0 || (mode === "students" && !classId)}>
                  {busy === "commit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 flip-rtl" />}
                  {t("imports.commit.action")} {faNumber(validation.valid)} {mode === "staff" ? t("imports.commit.staff") : t("common.student")}
                </button>
              </div>
            </div>
          )}

          {/* نتیجه */}
          {result && (
            <div className="b-card-tint p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-spring shrink-0" />
              <p className="text-[12px]">
                <b>{faNumber(result.success)}</b> {t("imports.result.created")}
                {result.failed > 0 && <> — <b className="text-destructive">{faNumber(result.failed)}</b> {t("imports.result.failedRejected")}</>}
                . {t("imports.result.passwordNote")}
              </p>
            </div>
          )}
        </section>

        {/* ═══ اکسپورت + تاریخچه ═══ */}
        <div className="flex flex-col gap-6">
          <section className="b-card p-5 md:p-6 flex flex-col gap-4">
            <h2 className="font-bold text-[16px] flex items-center gap-2">
              <Download className="w-4.5 h-4.5 text-spring" /> {t("imports.export.title")}
            </h2>
            <p className="t-sm text-steel">
              {t("imports.export.desc")}
              {jobs && ` ${t("imports.export.superAdminNote")}`}
            </p>
            <div role="tablist" className="flex items-center gap-2" aria-label={t("imports.export.formatAria")}>
              <span className="t-cap text-steel">{t("imports.export.formatLabel")}</span>
              {(["xlsx", "csv"] as const).map((f) => (
                <button role="tab" aria-selected={exportFormat === f}
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className={`b-pill-tab ${exportFormat === f ? "b-pill-tab-active" : ""}`}
                >
                  {f === "xlsx" ? t("imports.export.xlsx") : "CSV"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { type: "students" as const, icon: GraduationCap, label: t("imports.export.students"), desc: t("imports.export.studentsDesc") },
                { type: "users" as const, icon: Users, label: t("nav.users"), desc: t("imports.export.usersDesc") },
                { type: "classes" as const, icon: BookOpen, label: t("nav.classes"), desc: t("imports.export.classesDesc") },
                { type: "grades" as const, icon: ClipboardList, label: t("nav.grades"), desc: t("imports.export.gradesDesc") },
                { type: "attendance" as const, icon: CalendarCheck, label: t("nav.attendance"), desc: t("imports.export.attendanceDesc") },
                { type: "fees" as const, icon: Wallet, label: t("nav.finance"), desc: t("imports.export.feesDesc") },
              ].map((x) => (
                <button
                  key={x.type}
                  onClick={() => exportExcel(x.type)}
                  disabled={busy !== null}
                  className="b-btn b-btn-ghost b-card-sm !rounded-2xl p-3.5 flex items-center gap-3 text-start hover:border-spring/40 transition-colors group"
                >
                  <span className="w-10 h-10 rounded-2xl bg-spring-tint text-spring-deep flex items-center justify-center shrink-0">
                    <x.icon className="w-5 h-5" />
                  </span>
                  <span className="flex flex-col min-w-0 flex-1">
                    <b className="text-[12px]">{x.label}</b>
                    <span className="text-[12px] text-steel">{x.desc}</span>
                  </span>
                  {busy === `export-${x.type}` ? (
                    <Loader2 className="w-4 h-4 animate-spin text-spring shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 text-stone group-hover:text-spring transition-colors shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* تاریخچه */}
          <section className="b-card p-5 md:p-6 flex flex-col gap-4">
            <h2 className="font-bold text-[16px] flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-spring" /> {t("imports.history.title")}
            </h2>
            {jobs === null ? (
              <LoadingBlock label={t("imports.history.loading")} />
            ) : jobs.length === 0 ? (
              <EmptyState icon={History} title={t("imports.history.emptyTitle")} desc={t("imports.history.emptyDesc")} />
            ) : (
              <div className="max-h-72 overflow-auto b-scroll rounded-2xl border border-hairline-soft">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-cloud/60 dark:bg-forest/30">
                    <tr>
                      <th className="text-end py-2 px-3 font-bold">{t("imports.history.file")}</th>
                      <th className="text-end py-2 px-3 font-bold">{t("imports.history.rows")}</th>
                      <th className="text-end py-2 px-3 font-bold">{t("imports.history.result")}</th>
                      <th className="text-end py-2 px-3 font-bold">{t("imports.history.when")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-t border-hairline-soft/60">
                        <td className="py-2 px-3 truncate max-w-32" title={j.filename}>{j.filename}</td>
                        <td className="py-2 px-3 text-steel">{faNumber(j.totalRows)}</td>
                        <td className="py-2 px-3">
                          {j.status === "DONE" ? (
                            <span className="text-spring">{faNumber(j.successRows ?? 0)} {t("shell.notif.cat.success")}{ j.failedRows ? ` / ${faNumber(j.failedRows)} ${t("common.errorShort")}` : ""}</span>
                          ) : j.status === "RUNNING" ? (
                            <span className="text-warning-deep">{t("imports.history.pending")}</span>
                          ) : (
                            <span className="text-steel">{j.status === "CANCELLED" ? t("imports.history.cancelled") : j.status}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone whitespace-nowrap">{relativeTimeFa(j.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
