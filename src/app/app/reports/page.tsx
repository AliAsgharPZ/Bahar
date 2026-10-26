"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileBarChart, Upload, Download, History, CheckCircle2, XCircle, AlertTriangle, CalendarClock, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type ImportJob = { id: string; kind: string; filename: string; totalRows: number; successRows: number; failedRows: number; status: string; createdAt: string; user: { firstName: string; lastName: string } };
type ClassOpt = { id: string; name: string };
type ValRow = { row: number; errors: string[]; warnings: string[] };
type StudentRow = { id: string; user: { firstName: string; lastName: string; nationalId: string }; class: { name: string; grade: string } | null; studentNumber: string; tags: string[] };
type ScheduleRow = { id: string; kind: string; kindLabel: string; schedule: string; dayOfWeek: number | null; hour: number; audience: string; active: boolean; lastRunAt: string | null; nextRunAt: string | null };
type KindOpt = { key: string; label: string };

const DAYS_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

const SAMPLE_CSV = `نام,نام خانوادگی,کد ملی,نام پدر,شماره دانش‌آموزی,موبایل
علی,رضایی,1234567890,محمد,1404001,09121234567
زهرا,احمدی,1234567891,حسین,1404002,09121234568`;

function ReportsInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState(sp.get("tab") ?? "import");
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [csv, setCsv] = useState("");
  const [classId, setClassId] = useState("");
  const [validation, setValidation] = useState<{ jobId: string; total: number; valid: number; invalid: number; preview: ValRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [kinds, setKinds] = useState<KindOpt[]>([]);
  const [schedForm, setSchedForm] = useState({ kind: "DAILY_DIGEST", schedule: "DAILY", dayOfWeek: 0, hour: 8, audience: "MANAGERS" });
  const [schedBusy, setSchedBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<{ jobs: ImportJob[] }>("/api/imports").then((d) => setJobs(d.jobs)).catch(() => { /* داده ثانویه — بی‌صدا */ });
    apiGet<{ classes: ClassOpt[] }>("/api/classes").then((d) => setClasses(d.classes ?? [])).catch(() => { /* داده ثانویه — بی‌صدا */ });
    setLoading(false);
  }, []);
  useEffect(load, [load]);

  async function validate() {
    if (!csv.trim()) { toast.error("محتوای CSV را بچسبانید"); return; }
    setBusy(true);
    try {
      const d = await apiPost<{ jobId: string; total: number; valid: number; invalid: number; preview: ValRow[] }>("/api/imports", { action: "validate", csv });
      setValidation(d);
      toast[d.invalid > 0 ? "warning" : "success"](`${faNumber(d.valid)} سطر سالم از ${faNumber(d.total)}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  }
  async function commit() {
    if (!validation || !classId) { toast.error("کلاس هدف را انتخاب کنید"); return; }
    setBusy(true);
    try {
      const d = await apiPost<{ success: number; failed: number }>("/api/imports", { action: "commit", importId: validation.jobId, csv, classId });
      toast.success(`${faNumber(d.success)} دانش‌آموز ایمپورت شد${d.failed ? ` — ${faNumber(d.failed)} خطا` : ""}`);
      setValidation(null); setCsv(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(false); }
  }
  async function exportStudents() {
    try {
      const d = await apiGet<{ students: StudentRow[] }>("/api/students");
      const rows = (d.students ?? []).map((s) => [s.user.firstName, s.user.lastName, s.user.nationalId, s.class?.name ?? "", s.class?.grade ?? "", s.studentNumber, (s.tags ?? []).join("|")]);
      const csvOut = "\uFEFF" + ["نام", "نام خانوادگی", "کد ملی", "کلاس", "پایه", "شماره دانش‌آموزی", "تگ‌ها"].join(",") + "\n" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvOut], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `bahar-students-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      toast.success("خروجی CSV دانلود شد");
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  const loadSchedules = useCallback(() => {
    apiGet<{ reports: ScheduleRow[]; kinds: KindOpt[] }>("/api/reports/schedule")
      .then((d) => { setSchedules(d.reports); setKinds(d.kinds); })
      .catch(() => {});
  }, []);
  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  async function createSchedule() {
    setSchedBusy(true);
    try {
      await apiPost("/api/reports/schedule", schedForm);
      toast.success("گزارش زمان‌بندی‌شده فعال شد.");
      loadSchedules();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setSchedBusy(false); }
  }
  async function toggleSchedule(id: string, active: boolean) {
    try { await apiPatch("/api/reports/schedule", { id, active }); loadSchedules(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function runSchedule(id: string) {
    try {
      await apiPatch("/api/reports/schedule", { id, action: "run" });
      toast.success("اجرا شد — اگر داده امروز موجود باشد، اعلان ارسال شد.");
      loadSchedules();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function deleteSchedule(id: string) {
    try { await apiDelete(`/api/reports/schedule?id=${id}`); loadSchedules(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title="گزارش‌ها و داده" desc="ایمپورت/اکسپورت دانش‌آموزان با اعتبارسنجی کامل" />
      {/* راند ۱۹: اسکرول افقی در موبایل — ۴ تب از عرض ۳۹۰px بیرون می‌زد (۶۲px overflow صفحه) */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        <button onClick={() => setTab("import")} className={`b-pill-tab ${tab === "import" ? "b-pill-tab-active" : ""}`}><Upload className="w-3.5 h-3.5" /> ایمپورت</button>
        <button onClick={() => setTab("history")} className={`b-pill-tab ${tab === "history" ? "b-pill-tab-active" : ""}`}><History className="w-3.5 h-3.5" /> تاریخچه</button>
        <button onClick={() => setTab("export")} className={`b-pill-tab ${tab === "export" ? "b-pill-tab-active" : ""}`}><Download className="w-3.5 h-3.5" /> اکسپورت</button>
        <button onClick={() => setTab("scheduled")} className={`b-pill-tab ${tab === "scheduled" ? "b-pill-tab-active" : ""}`}><CalendarClock className="w-3.5 h-3.5" /> زمان‌بندی‌شده</button>
      </div>

      {tab === "import" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="b-card-md p-5 flex flex-col gap-3">
            <h3 className="font-bold">۱) محتوای CSV را بچسبانید</h3>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="ستون‌ها: نام، نام خانوادگی، کد ملی، نام پدر، شماره دانش‌آموزی، موبایل، آدرس" className="b-input !min-h-[180px] font-mono !text-[12px]" dir="rtl" />
            <button onClick={() => setCsv(SAMPLE_CSV)} className="b-btn b-btn-sm b-btn-ghost w-fit !text-[11px]">درج نمونه</button>
            <button onClick={validate} disabled={busy} className="b-btn b-btn-spring b-btn-sm w-fit">اعتبارسنجی</button>
          </div>
          <div className="b-card-md p-5 flex flex-col gap-3">
            <h3 className="font-bold">۲) بررسی و ثبت</h3>
            {validation ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-cloud text-center"><p className="text-[10px] text-steel">کل</p><p className="text-lg font-bold">{faNumber(validation.total)}</p></div>
                  <div className="p-3 rounded-2xl bg-spring-tint/50 text-center"><p className="text-[10px] text-steel">سالم</p><p className="text-lg font-bold text-spring-deep">{faNumber(validation.valid)}</p></div>
                  <div className="p-3 rounded-2xl bg-destructive/10 text-center"><p className="text-[10px] text-steel">خطادار</p><p className="text-lg font-bold text-destructive">{faNumber(validation.invalid)}</p></div>
                </div>
                <div className="max-h-52 overflow-y-auto b-scroll flex flex-col gap-1.5">
                  {validation.preview.map((v) => (
                    <div key={v.row} className={`p-2.5 rounded-xl text-[11.5px] flex items-start gap-2 ${v.errors.length ? "bg-destructive/10" : "bg-cloud"}`}>
                      <span className="font-bold shrink-0">سطر {faNumber(v.row)}:</span>
                      {v.errors.length > 0 ? <span className="text-destructive">{v.errors.join("؛ ")}</span> : v.warnings.length > 0 ? <span className="text-warning-deep">{v.warnings.join("؛ ")}</span> : <span className="text-spring-deep">سالم</span>}
                    </div>
                  ))}
                </div>
                <Select
                  value={classId}
                  onChange={(v) => setClassId(v)}
                  options={[{ value: "", label: "کلاس هدف *" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
                  placeholder="کلاس هدف *"
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <button onClick={commit} disabled={busy || !classId || validation.valid === 0} className="b-btn b-btn-spring b-btn-sm w-fit">
                  ثبت {faNumber(validation.valid)} دانش‌آموز در کلاس
                </button>
              </>
            ) : <p className="t-sm text-steel">اول محتوا را اعتبارسنجی کنید — هیچ داده‌ای قبل از تأیید شما ذخیره نمی‌شود.</p>}
          </div>
        </div>
      )}

      {tab === "history" && (jobs.length === 0 ? <EmptyState icon={History} title="ایمپورتی انجام نشده" /> : (
        <div className="flex flex-col gap-2.5">
          {jobs.map((j) => (
            <div key={j.id} className="b-card-sm p-4 flex items-center gap-3 flex-wrap">
              {j.status === "DONE" ? <CheckCircle2 className="w-5 h-5 text-spring shrink-0" /> : <AlertTriangle className="w-5 h-5 text-warning shrink-0" />}
              <span className="text-[13px] font-bold">{j.user.firstName} {j.user.lastName}</span>
              <span className="text-[11.5px] text-steel">{formatDateFa(j.createdAt)}</span>
              <span className="b-badge b-badge-success">{faNumber(j.successRows)} موفق</span>
              {j.failedRows > 0 && <span className="b-badge b-badge-critical">{faNumber(j.failedRows)} ناموفق</span>}
              <span className="text-[10.5px] text-stone ms-auto">{faNumber(j.totalRows)} سطر</span>
            </div>
          ))}
        </div>
      ))}

      {tab === "export" && (
        <div className="b-card-md p-5 max-w-lg">
          <h3 className="font-bold mb-2">خروجی دانش‌آموزان</h3>
          <p className="t-sm text-steel mb-4">فایل CSV با کدگذاری UTF-8 (سازگار با اکسل فارسی) شامل نام، کد ملی، کلاس، پایه و تگ‌ها.</p>
          <button onClick={exportStudents} className="b-btn b-btn-spring"><Download className="w-4 h-4" /> دانلود CSV</button>
        </div>
      )}

      {tab === "scheduled" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="b-card-md p-5 flex flex-col gap-3 sticky top-4">
              <h3 className="font-bold">گزارش زمان‌بندی‌شده جدید</h3>
              <Select
                value={schedForm.kind}
                onChange={(v) => setSchedForm({ ...schedForm, kind: v })}
                options={kinds.map((k) => ({ value: k.key, label: k.label }))}
                className="w-full"
                buttonClassName="!w-full"
              />
              <div className="flex gap-2">
                <Select
                  value={schedForm.schedule}
                  onChange={(v) => setSchedForm({ ...schedForm, schedule: v, dayOfWeek: 0 })}
                  options={[{ value: "DAILY", label: "هر روز" }, { value: "WEEKLY", label: "هفتگی" }]}
                  className="!w-32"
                  buttonClassName="!w-32"
                />
                {schedForm.schedule === "WEEKLY" && (
                  <Select
                    value={String(schedForm.dayOfWeek ?? 0)}
                    onChange={(v) => setSchedForm({ ...schedForm, dayOfWeek: Number(v) })}
                    options={DAYS_FA.map((d, i) => ({ value: String(i), label: d }))}
                    className="!w-32"
                    buttonClassName="!w-32"
                  />
                )}
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-[12px] text-steel shrink-0">ساعت</span>
                <input type="number" min={5} max={22} value={schedForm.hour} onChange={(e) => setSchedForm({ ...schedForm, hour: Number(e.target.value) })} className="b-input !w-20" dir="ltr" />
                <Select
                  value={schedForm.audience}
                  onChange={(v) => setSchedForm({ ...schedForm, audience: v })}
                  options={[{ value: "MANAGERS", label: "مدیران و معاونین" }, { value: "TEACHERS", label: "معلمان" }]}
                  className="flex-1"
                  buttonClassName="!w-full"
                />
              </div>
              <button onClick={createSchedule} disabled={schedBusy} className="b-btn b-btn-spring"><CalendarClock className="w-4 h-4" /> فعال‌سازی گزارش</button>
              <p className="text-[10.5px] text-stone leading-relaxed">گزارش‌ها به‌صورت اعلان در مرکز اعلان‌ها ارسال می‌شوند؛ ساعت‌ها بر پایه تهران است.</p>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            {schedules.length === 0 ? <EmptyState icon={CalendarClock} title="گزارش زمان‌بندی‌شده‌ای فعال نیست" desc="خلاصه‌های دوره‌ای را خودکار کنید." /> : schedules.map((r) => (
              <div key={r.id} className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${!r.active ? "opacity-60" : ""}`}>
                <CalendarClock className={`w-5 h-5 shrink-0 ${r.active ? "text-spring" : "text-stone"}`} />
                <div className="min-w-0 flex-1">
                  <b className="text-[13px] block">{r.kindLabel}</b>
                  <span className="text-[11px] text-steel">
                    {r.schedule === "DAILY" ? "هر روز" : `هر ${DAYS_FA[r.dayOfWeek ?? 0]}`} · ساعت {faNumber(r.hour)} · {r.audience === "TEACHERS" ? "معلمان" : "مدیران و معاونین"}
                    {r.lastRunAt ? ` · آخرین اجرا: ${formatDateFa(r.lastRunAt)}` : " · هنوز اجرا نشده"}
                  </span>
                </div>
                <button onClick={() => runSchedule(r.id)} className="b-btn b-btn-ghost b-btn-sm" title="اجرای فوری"><Play className="w-3.5 h-3.5" /> اجرا</button>
                <button onClick={() => toggleSchedule(r.id, !r.active)} className={`b-btn b-btn-sm ${r.active ? "b-btn-soft" : "b-btn-spring"}`}>{r.active ? "غیرفعال" : "فعال"}</button>
                <button onClick={() => deleteSchedule(r.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-stone hover:text-blossom hover:bg-blossom/10 transition-colors" title="حذف"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return <Suspense fallback={<LoadingBlock />}><ReportsInner /></Suspense>;
}
