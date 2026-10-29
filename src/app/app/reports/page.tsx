"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileBarChart, Upload, Download, History, CheckCircle2, XCircle, AlertTriangle, CalendarClock, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type ImportJob = { id: string; kind: string; filename: string; totalRows: number; successRows: number; failedRows: number; status: string; createdAt: string; user: { firstName: string; lastName: string } };
type ClassOpt = { id: string; name: string };
type ValRow = { row: number; errors: string[]; warnings: string[] };
type StudentRow = { id: string; user: { firstName: string; lastName: string; nationalId: string }; class: { name: string; grade: string } | null; studentNumber: string; tags: string[] };
type ScheduleRow = { id: string; kind: string; kindLabel: string; schedule: string; dayOfWeek: number | null; hour: number; audience: string; active: boolean; lastRunAt: string | null; nextRunAt: string | null };
type KindOpt = { key: string; label: string };

const DAY_KEYS = ["reports.day.sat", "reports.day.sun", "reports.day.mon", "reports.day.tue", "reports.day.wed", "reports.day.thu", "reports.day.fri"];

const SAMPLE_CSV = `نام,نام خانوادگی,کد ملی,نام پدر,شماره دانش‌آموزی,موبایل
علی,رضایی,1234567890,محمد,1404001,09121234567
زهرا,احمدی,1234567891,حسین,1404002,09121234568`;

function ReportsInner() {
  const { t } = useLang();
  const sp = useSearchParams();
  const DAYS_FA = DAY_KEYS.map((k) => t(k));
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
    if (!csv.trim()) { toast.error(t("reports.toast.pasteCsv")); return; }
    setBusy(true);
    try {
      const d = await apiPost<{ jobId: string; total: number; valid: number; invalid: number; preview: ValRow[] }>("/api/imports", { action: "validate", csv });
      setValidation(d);
      toast[d.invalid > 0 ? "warning" : "success"](`${faNumber(d.valid)} ${t("reports.toast.validRows")} ${faNumber(d.total)}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(false); }
  }
  async function commit() {
    if (!validation || !classId) { toast.error(t("reports.toast.selectClass")); return; }
    setBusy(true);
    try {
      const d = await apiPost<{ success: number; failed: number }>("/api/imports", { action: "commit", importId: validation.jobId, csv, classId });
      toast.success(`${faNumber(d.success)} ${t("reports.toast.imported")}${d.failed ? ` — ${faNumber(d.failed)} ${t("common.errorShort")}` : ""}`);
      setValidation(null); setCsv(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(false); }
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
      toast.success(t("reports.toast.csvDownloaded"));
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
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
      toast.success(t("reports.toast.scheduleActivated"));
      loadSchedules();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
    finally { setSchedBusy(false); }
  }
  async function toggleSchedule(id: string, active: boolean) {
    try { await apiPatch("/api/reports/schedule", { id, active }); loadSchedules(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function runSchedule(id: string) {
    try {
      await apiPatch("/api/reports/schedule", { id, action: "run" });
      toast.success(t("reports.toast.scheduleRan"));
      loadSchedules();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function deleteSchedule(id: string) {
    try { await apiDelete(`/api/reports/schedule?id=${id}`); loadSchedules(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  return (
    <div>
      <PageHeader title={t("nav.reports")} desc={t("reports.header.desc")} />
      {/* راند ۱۹: اسکرول افقی در موبایل — ۴ تب از عرض ۳۹۰px بیرون می‌زد (۶۲px overflow صفحه) */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        <button onClick={() => setTab("import")} className={`b-pill-tab ${tab === "import" ? "b-pill-tab-active" : ""}`}><Upload className="w-3.5 h-3.5" /> {t("reports.tab.import")}</button>
        <button onClick={() => setTab("history")} className={`b-pill-tab ${tab === "history" ? "b-pill-tab-active" : ""}`}><History className="w-3.5 h-3.5" /> {t("reports.tab.history")}</button>
        <button onClick={() => setTab("export")} className={`b-pill-tab ${tab === "export" ? "b-pill-tab-active" : ""}`}><Download className="w-3.5 h-3.5" /> {t("reports.tab.export")}</button>
        <button onClick={() => setTab("scheduled")} className={`b-pill-tab ${tab === "scheduled" ? "b-pill-tab-active" : ""}`}><CalendarClock className="w-3.5 h-3.5" /> {t("reports.tab.scheduled")}</button>
      </div>

      {tab === "import" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="b-card-md p-5 flex flex-col gap-3">
            <h3 className="font-bold">{t("reports.import.step1")}</h3>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={t("reports.placeholder.columns")} className="b-input !min-h-[180px] font-mono !text-[12px]" dir="rtl" />
            <button onClick={() => setCsv(SAMPLE_CSV)} className="b-btn b-btn-sm b-btn-ghost w-fit !text-[11px]">{t("reports.sample.insert")}</button>
            <button onClick={validate} disabled={busy} className="b-btn b-btn-spring b-btn-sm w-fit">{t("reports.validate.action")}</button>
          </div>
          <div className="b-card-md p-5 flex flex-col gap-3">
            <h3 className="font-bold">{t("reports.import.step2")}</h3>
            {validation ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-2xl bg-cloud text-center"><p className="text-[10px] text-steel">{t("reports.stats.total")}</p><p className="text-lg font-bold">{faNumber(validation.total)}</p></div>
                  <div className="p-3 rounded-2xl bg-spring-tint/50 text-center"><p className="text-[10px] text-steel">{t("reports.stats.healthy")}</p><p className="text-lg font-bold text-spring-deep">{faNumber(validation.valid)}</p></div>
                  <div className="p-3 rounded-2xl bg-destructive/10 text-center"><p className="text-[10px] text-steel">{t("reports.stats.invalid")}</p><p className="text-lg font-bold text-destructive">{faNumber(validation.invalid)}</p></div>
                </div>
                <div className="max-h-52 overflow-y-auto b-scroll flex flex-col gap-1.5">
                  {validation.preview.map((v) => (
                    <div key={v.row} className={`p-2.5 rounded-xl text-[11.5px] flex items-start gap-2 ${v.errors.length ? "bg-destructive/10" : "bg-cloud"}`}>
                      <span className="font-bold shrink-0">{t("reports.row.label")} {faNumber(v.row)}:</span>
                      {v.errors.length > 0 ? <span className="text-destructive">{v.errors.join("؛ ")}</span> : v.warnings.length > 0 ? <span className="text-warning-deep">{v.warnings.join("؛ ")}</span> : <span className="text-spring-deep">{t("reports.row.healthy")}</span>}
                    </div>
                  ))}
                </div>
                <Select
                  value={classId}
                  onChange={(v) => setClassId(v)}
                  options={[{ value: "", label: t("reports.targetClass") }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
                  placeholder={t("reports.targetClass")}
                  className="w-full"
                  buttonClassName="!w-full"
                />
                <button onClick={commit} disabled={busy || !classId || validation.valid === 0} className="b-btn b-btn-spring b-btn-sm w-fit">
                  {t("reports.commit.action")} {faNumber(validation.valid)} {t("reports.commit.studentsInClass")}
                </button>
              </>
            ) : <p className="t-sm text-steel">{t("reports.validate.hint")}</p>}
          </div>
        </div>
      )}

      {tab === "history" && (jobs.length === 0 ? <EmptyState icon={History} title={t("reports.history.empty")} /> : (
        <div className="flex flex-col gap-2.5">
          {jobs.map((j) => (
            <div key={j.id} className="b-card-sm p-4 flex items-center gap-3 flex-wrap">
              {j.status === "DONE" ? <CheckCircle2 className="w-5 h-5 text-spring shrink-0" /> : <AlertTriangle className="w-5 h-5 text-warning shrink-0" />}
              <span className="text-[13px] font-bold">{j.user.firstName} {j.user.lastName}</span>
              <span className="text-[11.5px] text-steel">{formatDateFa(j.createdAt)}</span>
              <span className="b-badge b-badge-success">{faNumber(j.successRows)} {t("shell.notif.cat.success")}</span>
              {j.failedRows > 0 && <span className="b-badge b-badge-critical">{faNumber(j.failedRows)} {t("dashboard.login.failed")}</span>}
              <span className="text-[10.5px] text-stone ms-auto">{faNumber(j.totalRows)} {t("reports.job.rows")}</span>
            </div>
          ))}
        </div>
      ))}

      {tab === "export" && (
        <div className="b-card-md p-5 max-w-lg">
          <h3 className="font-bold mb-2">{t("reports.export.title")}</h3>
          <p className="t-sm text-steel mb-4">{t("reports.export.desc")}</p>
          <button onClick={exportStudents} className="b-btn b-btn-spring"><Download className="w-4 h-4" /> {t("reports.export.downloadCsv")}</button>
        </div>
      )}

      {tab === "scheduled" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="b-card-md p-5 flex flex-col gap-3 sticky top-4">
              <h3 className="font-bold">{t("reports.schedule.new")}</h3>
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
                  options={[{ value: "DAILY", label: t("reports.schedule.daily") }, { value: "WEEKLY", label: t("reports.schedule.weekly") }]}
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
                <span className="text-[12px] text-steel shrink-0">{t("common.time")}</span>
                <input type="number" min={5} max={22} value={schedForm.hour} onChange={(e) => setSchedForm({ ...schedForm, hour: Number(e.target.value) })} className="b-input !w-20" dir="ltr" />
                <Select
                  value={schedForm.audience}
                  onChange={(v) => setSchedForm({ ...schedForm, audience: v })}
                  options={[{ value: "MANAGERS", label: t("reports.schedule.audienceManagers") }, { value: "TEACHERS", label: t("dashboard.teachers") }]}
                  className="flex-1"
                  buttonClassName="!w-full"
                />
              </div>
              <button onClick={createSchedule} disabled={schedBusy} className="b-btn b-btn-spring"><CalendarClock className="w-4 h-4" /> {t("reports.schedule.activate")}</button>
              <p className="text-[10.5px] text-stone leading-relaxed">{t("reports.schedule.note")}</p>
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-2.5">
            {schedules.length === 0 ? <EmptyState icon={CalendarClock} title={t("reports.schedule.emptyTitle")} desc={t("reports.schedule.emptyDesc")} /> : schedules.map((r) => (
              <div key={r.id} className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${!r.active ? "opacity-60" : ""}`}>
                <CalendarClock className={`w-5 h-5 shrink-0 ${r.active ? "text-spring" : "text-stone"}`} />
                <div className="min-w-0 flex-1">
                  <b className="text-[13px] block">{r.kindLabel}</b>
                  <span className="text-[11px] text-steel">
                    {r.schedule === "DAILY" ? t("reports.schedule.daily") : `${t("reports.schedule.every")} ${DAYS_FA[r.dayOfWeek ?? 0]}`} · {t("common.time")} {faNumber(r.hour)} · {r.audience === "TEACHERS" ? t("dashboard.teachers") : t("reports.schedule.audienceManagers")}
                    {r.lastRunAt ? <> · {t("reports.schedule.lastRun")} {formatDateFa(r.lastRunAt)}</> : <> · {t("reports.schedule.neverRun")}</>}
                  </span>
                </div>
                <button onClick={() => runSchedule(r.id)} className="b-btn b-btn-ghost b-btn-sm" title={t("reports.schedule.runNow")}><Play className="w-3.5 h-3.5" /> {t("reports.schedule.run")}</button>
                <button onClick={() => toggleSchedule(r.id, !r.active)} className={`b-btn b-btn-sm ${r.active ? "b-btn-soft" : "b-btn-spring"}`}>{r.active ? t("common.inactive") : t("common.active")}</button>
                <button onClick={() => deleteSchedule(r.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-stone hover:text-blossom hover:bg-blossom/10 transition-colors" title={t("common.delete")}><Trash2 className="w-4 h-4" /></button>
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
