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

type ValRow = { row: number; errors: string[]; warnings: string[]; data: Record<string, string> };
type ImportJob = { id: string; kind: string; filename: string; totalRows: number; successRows: number | null; failedRows: number | null; status: string; createdAt: string; user: { firstName: string; lastName: string } };
type ClassOpt = { id: string; name: string; grade: string };

const TARGET_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "firstName", label: "نام", required: true },
  { key: "lastName", label: "نام خانوادگی", required: true },
  { key: "nationalId", label: "کد ملی", required: true },
  { key: "studentNumber", label: "شماره دانش‌آموزی" },
  { key: "fatherName", label: "نام پدر" },
  { key: "gender", label: "جنسیت" },
  { key: "birthDate", label: "تاریخ تولد" },
  { key: "phone", label: "موبایل" },
  { key: "address", label: "آدرس" },
  { key: "previousSchool", label: "مدرسه قبلی" },
];

const STAFF_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "firstName", label: "نام", required: true },
  { key: "lastName", label: "نام خانوادگی", required: true },
  { key: "nationalId", label: "کد ملی", required: true },
  { key: "role", label: "نقش (مدیر/معاون/معلم/سرایدار)", required: true },
  { key: "phone", label: "موبایل" },
  { key: "email", label: "ایمیل" },
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

export default function ImportsPage() {
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
    if (!text.trim()) { toast.error("محتوای فایل خالی است."); return; }
    setCsv(text);
    setSourceName(name);
    setResult(null);
    setValidation(null);
    const firstLine = text.split("\n")[0] ?? "";
    const hs = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^"|"$/g, "")).filter(Boolean);
    setHeaders(hs);
    setMapping(autoDetect(hs));
    toast.success(`فایل «${name}» خوانده شد — ${faNumber(hs.length)} ستون.`);
  }

  async function onFile(file: File) {
    if (/\.xlsx$/i.test(file.name)) {
      setBusy("parse");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/imports/excel", { method: "POST", body: fd });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error?.message ?? "خطا در خواندن فایل اکسل");
        ingestText(json.csv, file.name);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "خطا");
      } finally {
        setBusy(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } else if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      ingestText(text, file.name);
      if (fileRef.current) fileRef.current.value = "";
    } else {
      toast.error("فقط فایل‌های اکسل (.xlsx) و CSV پذیرفته می‌شوند.");
    }
  }

  async function validate() {
    if (!csv.trim()) { toast.error("اول فایل را بارگذاری یا محتوا را بچسبانید."); return; }
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
      if (d.invalid > 0) toast.warning(`${faNumber(d.valid)} سطر سالم از ${faNumber(d.total)} — ${faNumber(d.invalid)} سطر خطا دارد.`);
      else toast.success(`همه ${faNumber(d.valid)} سطر سالم هستند.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    const isStaff = mode === "staff";
    if (!validation || (!isStaff && !classId)) { toast.error("کلاس هدف را انتخاب کنید."); return; }
    const ok = await confirm({
      title: isStaff ? `ثبت ${faNumber(validation.valid)} کارمند` : `ثبت ${faNumber(validation.valid)} دانش‌آموز`,
      description: isStaff
        ? <>کارکنان سالم با نقش مشخص‌شده و رمز موقت ساخته می‌شوند؛ در اولین ورود باید رمز را عوض کنند. سطرهای خطادار رد می‌شوند.</>
        : <>دانش‌آموزان سالم در کلاس انتخابی ساخته می‌شوند؛ سطرهای خطادار رد می‌شوند. این عمل قابل بازگشت نیست (حذف از صفحه «دانش‌آموزان» ممکن است).</>,
      confirmLabel: "ثبت نهایی",
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
        ? `${faNumber(d.success)} کارمند ایمپورت شد${d.failed ? ` — ${faNumber(d.failed)} خطا` : ""}.`
        : `${faNumber(d.success)} دانش‌آموز ایمپورت شد${d.failed ? ` — ${faNumber(d.failed)} خطا` : ""}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
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
        throw new Error(json?.error?.message ?? "خطا در تولید فایل");
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bahar-${type}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(exportFormat === "csv" ? "فایل CSV دانلود شد." : "فایل اکسل دانلود شد.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
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
        title="ایمپورت و اکسپورت انبوه"
        desc="دسته‌ای از دانش‌آموزان را با فایل اکسل (xlsx) یا CSV وارد کنید و داده‌های مدرسه را به اکسل خروجی بگیرید."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ═══ ایمپورت ═══ */}
        <section className="b-card p-5 md:p-6 flex flex-col gap-5">
          <h2 className="font-bold text-[15px] flex items-center gap-2">
            <Upload className="w-4.5 h-4.5 text-spring" /> {mode === "staff" ? "ورود انبوه کارکنان" : "ورود انبوه دانش‌آموزان"}
          </h2>
          <div className="flex items-center gap-2" role="group" aria-label="نوع ایمپورت">
            {(["students", "staff"] as const).map((md) => (
              <button
                key={md}
                onClick={() => { setMode(md); setValidation(null); setResult(null); setMapping({}); }}
                className={`b-pill-tab ${mode === md ? "b-pill-tab-active" : ""}`}
              >
                {md === "students" ? "دانش‌آموزان" : "کارکنان (مدیر/معاون/معلم/سرایدار)"}
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
              aria-label="بارگذاری فایل اکسل"
            >
              {busy === "parse" ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-spring animate-spin" />
              ) : (
                <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-spring" />
              )}
              <b className="text-[13px] block">فایل اکسل را اینجا رها کنید یا کلیک کنید</b>
              <span className="text-[11px] text-steel block mt-1">xlsx / xls (تا ۵ مگابایت) — یا CSV با کدگذاری UTF-8</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
            </div>
            <details className="b-card-sm !rounded-xl p-3.5">
              <summary className="text-[12px] font-bold cursor-pointer flex items-center gap-1.5">
                <ClipboardPaste className="w-3.5 h-3.5 text-steel" /> یا متن CSV را بچسبانید / نمونه ببینید
              </summary>
              <textarea
                value={csv}
                onChange={(e) => ingestText(e.target.value, "چسباندن متن")}
                placeholder="ستون‌ها: نام، نام خانوادگی، کد ملی، نام پدر، شماره دانش‌آموزی، موبایل، آدرس…"
                className="b-input !min-h-[130px] font-mono !text-[12px] mt-3"
                dir="rtl"
              />
              <div className="flex items-center gap-2 mt-2">
                <button className="b-btn b-btn-ghost b-btn-sm !text-[11px]" onClick={() => ingestText(SAMPLE_CSV, "نمونه")}>درج نمونه</button>
                {csv && <button className="b-btn b-btn-ghost b-btn-sm !text-[11px] !text-destructive" onClick={() => { setCsv(""); setHeaders([]); setMapping({}); setValidation(null); setSourceName(""); }}><RotateCcw className="w-3 h-3" /> پاک‌کردن</button>}
              </div>
            </details>
            {sourceName && (
              <p className="text-[11.5px] text-steel flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-spring shrink-0" />
                منبع: <b className="truncate">{sourceName}</b>
                {headers.length > 0 && <> — {faNumber(headers.length)} ستون: {headers.slice(0, 6).join("، ")}{headers.length > 6 ? "…" : ""}</>}
              </p>
            )}
          </div>

          {/* مرحله ۲ — تطبیق ستون‌ها */}
          {headers.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-[13px] flex items-center gap-2">
                تطبیق ستون‌ها
                <span className="b-badge b-badge-neutral !text-[10px]">{faNumber(mappedCount)}/{faNumber(FIELDS.length)}</span>
                {missingRequired.length > 0 && (
                  <span className="b-badge b-badge-critical !text-[10px]">اجباری خالی: {missingRequired.map((f) => f.label).join("، ")}</span>
                )}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[11.5px] font-bold">
                      {f.label}
                      {f.required && <span className="text-destructive"> *</span>}
                    </span>
                    <Select
                      value={mapping[f.key] ?? ""}
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                      placeholder="— بدون تطبیق —"
                      options={[
                        { value: "", label: "— بدون تطبیق —" },
                        ...headers.map((h) => ({ value: h, label: h })),
                      ]}
                      buttonClassName="!h-10"
                      className="w-full"
                      ariaLabel={`تطبیق ستون ${f.label}`}
                    />
                  </label>
                ))}
              </div>
              <button className="b-btn b-btn-spring w-fit" onClick={validate} disabled={busy !== null}>
                {busy === "validate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                اعتبارسنجی داده‌ها
              </button>
            </div>
          )}

          {/* مرحله ۳ — پیش‌نمایش */}
          {validation && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-[13px]">پیش‌نمایش</h3>
                <span className="b-badge b-badge-spring">{faNumber(validation.valid)} سالم</span>
                {validation.invalid > 0 && <span className="b-badge b-badge-critical">{faNumber(validation.invalid)} خطا</span>}
                <span className="b-badge b-badge-neutral">{faNumber(validation.total)} سطر</span>
              </div>
              <div className="max-h-64 overflow-y-auto b-scroll rounded-2xl border border-hairline-soft">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-cloud/60 dark:bg-forest/30 backdrop-blur">
                    <tr>
                      <th className="text-right py-2 px-3 font-bold w-10">#</th>
                      <th className="text-right py-2 px-3 font-bold">نام و نام خانوادگی</th>
                      <th className="text-right py-2 px-3 font-bold">کد ملی</th>
                      <th className="text-right py-2 px-3 font-bold">وضعیت</th>
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
                            <span className="text-spring flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> سالم</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validation.valid === 0 && (
                <p className="text-[12px] text-destructive">هیچ سطر سالمی نیست — تطبیق ستون‌ها را اصلاح کنید.</p>
              )}

              {/* مرحله ۴ — ثبت */}
              <div className="b-card-sm !rounded-2xl p-4 flex flex-col gap-3">
                <h4 className="font-bold text-[12.5px]">{mode === "staff" ? "ثبت نهایی کارکنان" : "ثبت نهایی در کلاس هدف"}</h4>
                {mode === "students" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11.5px] font-bold">کلاس هدف *</span>
                      <Select
                        value={classId}
                        onChange={setClassId}
                        placeholder="انتخاب کلاس…"
                        searchable
                        options={classes.map((c) => ({ value: c.id, label: `${c.name}${c.grade ? ` — ${c.grade}` : ""}` }))}
                        buttonClassName="!h-10"
                        className="w-full"
                        ariaLabel="کلاس هدف ایمپورت"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11.5px] font-bold">سال ورود (اختیاری)</span>
                      <input className="b-input !h-10" dir="ltr" inputMode="numeric" placeholder="1404" value={entryYear} onChange={(e) => setEntryYear(e.target.value.replace(/[^0-9]/g, ""))} />
                    </label>
                  </div>
                )}
                <button className="b-btn b-btn-spring w-fit" onClick={commit} disabled={busy !== null || validation.valid === 0 || (mode === "students" && !classId)}>
                  {busy === "commit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 flip-rtl" />}
                  ثبت {faNumber(validation.valid)} {mode === "staff" ? "کارمند" : "دانش‌آموز"}
                </button>
              </div>
            </div>
          )}

          {/* نتیجه */}
          {result && (
            <div className="b-card-tint p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-spring shrink-0" />
              <p className="text-[12.5px]">
                <b>{faNumber(result.success)}</b> دانش‌آموز با موفقیت ساخته شد
                {result.failed > 0 && <> — <b className="text-destructive">{faNumber(result.failed)}</b> سطر خطادار رد شد</>}
                . رمز اولیه هر کاربر از صفحه «کاربران» قابل بازنشانی و کپی است.
              </p>
            </div>
          )}
        </section>

        {/* ═══ اکسپورت + تاریخچه ═══ */}
        <div className="flex flex-col gap-6">
          <section className="b-card p-5 md:p-6 flex flex-col gap-4">
            <h2 className="font-bold text-[15px] flex items-center gap-2">
              <Download className="w-4.5 h-4.5 text-spring" /> خروجی داده‌ها
            </h2>
            <p className="t-sm text-steel">
              فایل با سطر عنوان فارسی، آمادهٔ بازکردن در Excel / LibreOffice / Google Sheets.
              {jobs && ` سوپرادمین بدون پنل مدرسه، خروجی کاربران کل سامانه را می‌گیرد.`}
            </p>
            <div className="flex items-center gap-2" role="group" aria-label="قالب خروجی">
              <span className="t-cap text-steel">قالب فایل:</span>
              {(["xlsx", "csv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className={`b-pill-tab ${exportFormat === f ? "b-pill-tab-active" : ""}`}
                >
                  {f === "xlsx" ? "اکسل (xlsx)" : "CSV"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { type: "students" as const, icon: GraduationCap, label: "دانش‌آموزان مدرسه", desc: "پرونده کامل + اولیا" },
                { type: "users" as const, icon: Users, label: "کاربران", desc: "نقش‌ها، تماس، وضعیت" },
                { type: "classes" as const, icon: BookOpen, label: "کلاس‌ها", desc: "پایه، رشته، معلم راهنما" },
                { type: "grades" as const, icon: ClipboardList, label: "نمرات", desc: "همه ارزیابی‌ها با درس و نوبت" },
                { type: "attendance" as const, icon: CalendarCheck, label: "حضور و غیاب", desc: "سوابق روزانه و زنگی" },
                { type: "fees" as const, icon: Wallet, label: "امور مالی", desc: "شهریه‌ها و وضعیت پرداخت" },
              ].map((x) => (
                <button
                  key={x.type}
                  onClick={() => exportExcel(x.type)}
                  disabled={busy !== null}
                  className="b-btn b-btn-ghost b-card-sm !rounded-xl p-3.5 flex items-center gap-3 text-start hover:border-spring/40 transition-colors group"
                >
                  <span className="w-10 h-10 rounded-xl bg-spring-tint text-spring-deep flex items-center justify-center shrink-0">
                    <x.icon className="w-5 h-5" />
                  </span>
                  <span className="flex flex-col min-w-0 flex-1">
                    <b className="text-[12.5px]">{x.label}</b>
                    <span className="text-[10.5px] text-steel">{x.desc}</span>
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
            <h2 className="font-bold text-[15px] flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-spring" /> تاریخچه ایمپورت‌ها
            </h2>
            {jobs === null ? (
              <LoadingBlock label="تاریخچه…" />
            ) : jobs.length === 0 ? (
              <EmptyState icon={History} title="ایمپورتی ثبت نشده" desc="اولین ورود انبوه را از فرم روبه‌رو انجام دهید." />
            ) : (
              <div className="max-h-72 overflow-y-auto b-scroll rounded-2xl border border-hairline-soft">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-cloud/60 dark:bg-forest/30">
                    <tr>
                      <th className="text-right py-2 px-3 font-bold">فایل</th>
                      <th className="text-right py-2 px-3 font-bold">سطرها</th>
                      <th className="text-right py-2 px-3 font-bold">نتیجه</th>
                      <th className="text-right py-2 px-3 font-bold">موقع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id} className="border-t border-hairline-soft/60">
                        <td className="py-2 px-3 truncate max-w-32" title={j.filename}>{j.filename}</td>
                        <td className="py-2 px-3 text-steel">{faNumber(j.totalRows)}</td>
                        <td className="py-2 px-3">
                          {j.status === "DONE" ? (
                            <span className="text-spring">{faNumber(j.successRows ?? 0)} موفق{ j.failedRows ? ` / ${faNumber(j.failedRows)} خطا` : ""}</span>
                          ) : j.status === "RUNNING" ? (
                            <span className="text-warning-deep">در انتظار ثبت</span>
                          ) : (
                            <span className="text-steel">{j.status === "CANCELLED" ? "لغوشده" : j.status}</span>
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
