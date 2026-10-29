"use client";

import { useLang } from "@/lib/i18n";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, BarChart3, CalendarClock, TrendingUp, Users, NotebookPen, Lock, LockOpen, Undo2, ClipboardList } from "lucide-react";
import { useApi, apiPost, apiPut, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber, enDigits } from "@/lib/persian";

type GradeRecord = { id: string; studentId: string; subjectId: string; term: number; kind: string; score: number; maxScore: number; weight?: number; locked?: boolean; subject: { id: string; name: string } };
type GradeHistoryEntry = { id: string; gradeRecordId: string; oldScore: number | null; newScore: number | null; source: string; createdAt: string };
type MonthRow = {
  key: string; year: number; month: number; monthName: string; title: string;
  gradeCount: number; avg: number | null;
  present: number; absent: number; late: number; excused: number;
  attendanceRate: number | null; assignmentCount: number;
};
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null; children: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }> } };
type ClassRow = { id: string; name: string; grade: string };

const KINDS = ["QUIZ", "MIDTERM", "FINAL", "PROJECT", "ACTIVITY", "BEHAVIOR"];

function scoreColor(score: number, max: number): string {
  const p = (score / max) * 100;
  if (p >= 85) return "text-spring";
  if (p >= 60) return "text-warning-deep";
  return "text-destructive";
}

export default function GradesPage() {
  const { t } = useLang();
  const kindLabels: Record<string, string> = {
    QUIZ: t("enum.gradeKind.QUIZ"), MIDTERM: t("enum.gradeKind.MIDTERM"), FINAL: t("enum.gradeKind.FINAL"),
    PROJECT: t("enum.gradeKind.PROJECT"), ACTIVITY: t("enum.gradeKind.ACTIVITY"), BEHAVIOR: t("enum.gradeKind.BEHAVIOR"),
  };
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role;
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه رابط ورود نمره می‌بیند (قبلاً دکمه‌های مرده → 403)
  const inPanel = Boolean(me?.user.actingSchool);
  const canEnter = role === "MANAGER" || (inPanel && (role === "SUPER_ADMIN" || role === "ADMIN")) || Boolean(me?.user.permissions.includes("enter_grades"));

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState(1);
  const [kind, setKind] = useState("QUIZ");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [childId, setChildId] = useState("");

  const { data: classesData } = useApi<{ classes: ClassRow[] }>(canEnter ? "/api/classes" : null);
  const { data: teachingData } = useApi<{ assignments: Array<{ id: string; class: { id: string; name: string }; subject: { id: string; name: string } }> }>(
    canEnter && role === "TEACHER" ? "/api/teaching" : null
  );
  const { data: subjectsData } = useApi<{ subjects: Array<{ id: string; name: string }> }>(
    canEnter && role !== "TEACHER" ? "/api/subjects" : null
  );

  useEffect(() => {
    if (canEnter && role !== "TEACHER" && classesData?.classes?.length && !classId) {
      setClassId(classesData.classes[0].id);
    }
    // معلم: اولین کلاسِ تدریس‌شده به‌صورت پیش‌فرض انتخاب شود
    if (canEnter && role === "TEACHER" && teachingData?.assignments?.length && !classId) {
      setClassId(teachingData.assignments[0].class.id);
    }
  }, [canEnter, role, classesData, teachingData, classId]);

  const { data: meFull } = useApi<{ user: { children: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }> } }>(isParent ? "/api/auth/me" : null);
  useEffect(() => {
    if (isParent && meFull?.user.children?.length && !childId) setChildId(meFull.user.children[0].student.id);
  }, [isParent, meFull, childId]);

  const bookUrl = canEnter && classId && subjectId ? `/api/grades?classId=${classId}&subjectId=${subjectId}&term=${term}` : null;
  const { data: bookData, loading: bookLoading, error: bookError, refetch: refetchBook } = useApi<{ students: Array<{ id: string; user: { firstName: string; lastName: string } }>; grades: GradeRecord[]; history: GradeHistoryEntry[] }>(bookUrl, [classId, subjectId, term]);

  const reportUrl = isStudent ? "/api/grades" : isParent && childId ? `/api/grades?studentId=${childId}` : null;
  const { data: reportData, loading: reportLoading, error: reportError } = useApi<{ records: GradeRecord[] }>(reportUrl, [childId]);

  // ─── کارنامه ماهانه ───
  const monthlyUrl = isStudent ? "/api/grades/monthly" : isParent && childId ? `/api/grades/monthly?studentId=${childId}` : null;
  const { data: monthlyData, loading: monthlyLoading, error: monthlyError } = useApi<{ months: MonthRow[]; student: { name: string; className: string | null } | null }>(monthlyUrl, [childId]);

  useEffect(() => {
    if (!bookData) return;
    const s: Record<string, string> = {};
    for (const g of bookData.grades.filter((x) => x.kind === kind)) {
      s[g.studentId] = String(g.score);
    }
    setScores(s);
  }, [bookData, kind]);

  /** نمره معتبر؟ (۰ تا ۲۰ — اعشار مجاز، ارقام فارسی پذیرفته می‌شود) */
  const parseScore = (raw: string | undefined): number | null => {
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(enDigits(raw.trim()));
    if (Number.isNaN(n)) return null;
    if (n < 0 || n > 20) return null;
    return n;
  };

  async function save() {
    if (!bookData) return;
    const invalid: string[] = [];
    const records: Array<{ studentId: string; score: number }> = [];
    for (const st of bookData.students) {
      const raw = scores[st.id];
      if (raw === undefined || raw.trim() === "") continue;
      const val = parseScore(raw);
      if (val === null) {
        invalid.push(`${st.user.firstName} ${st.user.lastName}`);
      } else {
        records.push({ studentId: st.id, score: val });
      }
    }
    if (invalid.length > 0) {
      toast.error(`${t("grades.toast.invalidPrefix")} ${invalid.slice(0, 3).join("، ")}${invalid.length > 3 ? t("grades.toast.invalidSuffix") : ""}`);
      return;
    }
    if (records.length === 0) {
      toast.error(t("grades.toast.noScores"));
      return;
    }
    setSaving(true);
    try {
      const res = await apiPost<{ saved: number; skippedInvalid?: number; skippedLocked?: number; total?: number }>("/api/grades", { classId, subjectId, term, kind, records });
      const skipped = (res.skippedInvalid ?? 0) + (res.skippedLocked ?? 0);
      if (skipped > 0) {
        toast.warning(`${faNumber(res.saved)} ${t("grades.toast.savedCount")} — ${faNumber(skipped)} ${t("grades.toast.skippedCount")}${res.skippedLocked ? ` ${t("grades.toast.skippedLocked")}` : ` ${t("grades.toast.skippedInvalid")}`}.`);
      } else {
        toast.success(`${faNumber(res.saved)} ${t("grades.toast.savedCount")}.`);
      }
      refetchBook();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  /** قفل/بازگشایی نمرات درس-کلاس (مدیر/معاون) */
  const canLock = role === "MANAGER" || role === "DEPUTY" || role === "SUPER_ADMIN";
  async function toggleLock() {
    if (!classId || !subjectId) return;
    const grades = bookData?.grades ?? [];
    const anyUnlocked = grades.some((g) => !g.locked);
    const lockNow = anyUnlocked; // اگر حتی یک نمره باز است → قفل کن
    try {
      const res = await apiPut<{ count: number }>("/api/grades", { classId, subjectId, term, locked: lockNow });
      toast.success(lockNow ? `${faNumber(res.count)} ${t("grades.toast.locked")}` : `${faNumber(res.count)} ${t("grades.toast.unlocked")}`);
      refetchBook();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  /** Undo آخرین تغییر یک نمره */
  async function undoGrade(historyId: string) {
    try {
      const res = await apiPatch<{ restored: number | null }>("/api/grades", { historyId });
      toast.success(res.restored !== null && res.restored !== undefined ? `${t("grades.toast.restoredPrefix")} ${faNumber(res.restored)} ${t("grades.toast.restoredSuffix")}` : t("grades.toast.restoredPlain"));
      refetchBook();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  const subjectOptions = useMemo(() => {
    if (role === "TEACHER") {
      const forClass = (teachingData?.assignments ?? []).filter((a) => a.class.id === classId);
      return forClass.map((a) => a.subject);
    }
    return subjectsData?.subjects ?? [];
  }, [role, teachingData, classId, subjectsData]);

  // ─── دفتر نمرات (کارکنان) ───
  if (canEnter) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("grades.title")}
          desc={t("grades.desc")}
          action={
            <button className="b-btn b-btn-spring b-btn-sm" onClick={save} disabled={saving || !bookData?.students.length}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("grades.save")}
            </button>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("grades.filter.class")}
            <Select
              value={classId}
              onChange={(v) => { setClassId(v); setSubjectId(""); }}
              options={
                role === "TEACHER"
                  ? [...new Map((teachingData?.assignments ?? []).map((a) => [a.class.id, a.class])).values()].map((c) => ({ value: c.id, label: c.name }))
                  : (classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("grades.filter.subject")}
            <Select
              value={subjectId}
              onChange={(v) => setSubjectId(v)}
              options={[{ value: "", label: t("grades.select.subject") }, ...subjectOptions.map((s) => ({ value: s.id, label: s.name }))]}
              placeholder={t("grades.select.subject")}
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("grades.filter.term")}
            <Select
              value={String(term)}
              onChange={(v) => setTerm(Number(v))}
              options={[{ value: "1", label: t("grades.term.1") }, { value: "2", label: t("grades.term.2") }]}
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("grades.filter.kind")}
            <Select
              value={kind}
              onChange={(v) => setKind(v)}
              options={KINDS.map((k) => ({ value: k, label: kindLabels[k] }))}
            />
          </label>
          {canLock && classId && subjectId && (bookData?.grades?.length ?? 0) > 0 && (
            <button
              className={`b-btn b-btn-sm ms-auto ${(bookData?.grades ?? []).every((g) => g.locked) ? "b-btn-soft" : "b-btn-ghost"}`}
              onClick={toggleLock}
            >
              {(bookData?.grades ?? []).every((g) => g.locked) ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {(bookData?.grades ?? []).every((g) => g.locked) ? t("grades.unlock") : t("grades.lock")}
            </button>
          )}
        </div>

        {classId && !subjectId && <EmptyState icon={BarChart3} title={t("grades.empty.selectSubject")} desc={t("grades.empty.selectSubjectDesc")} />}
        {bookError && classId && subjectId && <ErrorBox message={bookError} />}
        {bookLoading && classId && subjectId && <LoadingBlock />}
        {bookData && classId && subjectId && bookData.students.length === 0 && (
          <EmptyState icon={BarChart3} title={t("grades.empty.noStudent")} />
        )}
        {bookData && classId && subjectId && bookData.students.length > 0 && (
          <div className="b-card-sm overflow-hidden">
            <div className="max-h-[520px] overflow-auto b-scroll">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-hairline-soft text-steel text-[11.5px]">
                    <th className="text-right py-3 px-4 font-bold">{t("common.student")}</th>
                    <th className="text-right py-3 px-4 font-bold w-32">{t("grades.table.score")}</th>
                    <th className="text-right py-3 px-4 font-bold hidden md:table-cell">{t("grades.table.recorded")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookData.students.map((st) => {
                    const all = bookData.grades.filter((g) => g.studentId === st.id);
                    return (
                      <tr key={st.id} className="b-row border-b border-hairline-soft/60 last:border-0">
                        <td className="py-3 px-4">
                          <b>{st.user.firstName} {st.user.lastName}</b>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            className={`b-input !h-10 !w-24 text-center font-bold ${scores[st.id] !== undefined && scores[st.id].trim() !== "" && parseScore(scores[st.id]) === null ? "!border-destructive" : ""}`}
                            dir="ltr"
                            inputMode="decimal"
                            value={scores[st.id] ?? ""}
                            onChange={(e) => setScores((s) => ({ ...s, [st.id]: e.target.value }))}
                            placeholder="—"
                          />
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {all.map((g) => {
                              const h = (bookData?.history ?? []).find((x) => x.gradeRecordId === g.id);
                              const canUndo = h && (h.oldScore !== null || h.source === "UNDO") && h.source !== "INITIAL";
                              return (
                                <span key={g.id} className="b-badge b-badge-neutral inline-flex items-center gap-1">
                                  {kindLabels[g.kind]}: <b className={scoreColor(g.score, g.maxScore)}>{faNumber(g.score)}</b>
                                  {g.locked && <Lock className="w-3 h-3 text-warning-deep" />}
                                  {canUndo && (
                                    <button
                                      className="b-btn b-btn-ghost text-steel hover:text-spring transition-colors"
                                      onClick={() => undoGrade(h.id)}
                                      title={`${t("grades.undo.prefix")} ${h.oldScore !== null ? faNumber(h.oldScore) : "—"}`}
                                    >
                                      <Undo2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                            {!all.length && <span className="text-stone text-[11px]">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── کارنامه (دانش‌آموز/ولی) ───
  const records = reportData?.records ?? [];
  const bySubject = new Map<string, { name: string; items: GradeRecord[]; avg: number }>();
  for (const g of records) {
    const cur = bySubject.get(g.subjectId) ?? { name: g.subject.name, items: [], avg: 0 };
    cur.items.push(g);
    bySubject.set(g.subjectId, cur);
  }
  for (const v of bySubject.values()) {
    // FIX (راند ۱۶): میانگین وزن‌دار مثل داشبورد/۳۶۰ — قبلاً بدون وزن بود و معدل دو جا فرق می‌کرد
    const wSum = v.items.reduce((s, g) => s + (g.weight || 1), 0);
    v.avg = v.items.length && wSum > 0
      ? +(v.items.reduce((s, g) => s + (g.score / g.maxScore) * 20 * (g.weight || 1), 0) / wSum).toFixed(2)
      : v.items.length ? +(v.items.reduce((s, g) => s + (g.score / g.maxScore) * 20, 0) / v.items.length).toFixed(2) : 0;
  }
  const gpa = bySubject.size
    ? +([...bySubject.values()].reduce((s, v) => s + v.avg, 0) / bySubject.size).toFixed(2)
    : null;

  // ─── کارمند بدون دسترسی ثبت نمره ───
  if (!canEnter && !isStudent && !isParent) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("grades.report.title")} desc={t("grades.report.desc")} />
        <EmptyState
          icon={ClipboardList}
          title={t("grades.noAccess.title")}
          desc={t("grades.noAccess.desc")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("grades.report.title")} desc={isParent ? t("grades.report.descParent") : t("grades.report.descStudent")} />

      {isParent && (meFull?.user.children?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
          {meFull!.user.children.map((c) => (
            <button key={c.student.id} onClick={() => setChildId(c.student.id)} className={`b-pill-tab ${childId === c.student.id ? "b-pill-tab-active" : ""}`}>
              {c.student.user.firstName} {c.student.user.lastName}
            </button>
          ))}
        </div>
      )}

      {reportLoading && <LoadingBlock />}
      {reportError && <ErrorBox message={reportError} />}
      {reportData && records.length === 0 && <EmptyState icon={BarChart3} title={t("grades.empty.noGrades")} />}
      {reportData && records.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={BarChart3} label={t("grades.stat.gpa")} value={gpa !== null ? faNumber(gpa) : "—"} tone="spring" hint={t("grades.stat.outOf20")} />
            <StatCard icon={BarChart3} label={t("grades.stat.subject")} value={bySubject.size} tone="ink" />
            <StatCard icon={BarChart3} label={t("grades.stat.recorded")} value={records.length} />
            <StatCard icon={BarChart3} label={t("grades.stat.highest")} value={faNumber(Math.max(...[...bySubject.values()].map((v) => v.avg)))} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[...bySubject.entries()].map(([id, v]) => (
              <div key={id} className="b-card-md p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <b className="text-[15px]">{v.name}</b>
                  <span className={`text-[20px] font-bold ${scoreColor(v.avg, 20)}`}>{faNumber(v.avg)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-cloud overflow-hidden mb-4">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v.avg / 20) * 100)}%`, background: "var(--spring)" }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {v.items.map((g) => (
                    <span key={g.id} className="b-badge b-badge-neutral">
                      {kindLabels[g.kind]} {t("grades.termShort")}{faNumber(g.term)}: <b className={scoreColor(g.score, g.maxScore)}>{faNumber(g.score)}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── کارنامه ماهانه ─── */}
      <div className="b-card-md p-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </span>
          <div>
            <b className="text-[16px] block">{t("grades.monthly.title")}</b>
            <span className="text-[11.5px] text-steel">{t("grades.monthly.desc")}</span>
          </div>
        </div>

        {monthlyLoading && <LoadingBlock label={t("grades.monthly.loading")} />}
        {monthlyError && <ErrorBox message={monthlyError} />}
        {monthlyData && monthlyData.months.length === 0 && (
          <p className="t-sm text-steel py-4">{t("grades.monthly.empty")}</p>
        )}
        {monthlyData && monthlyData.months.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {monthlyData.months.map((m) => (
              <div key={m.key} className="b-card-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[13.5px]">{m.title}</b>
                  <span className="b-badge b-badge-spring !text-[10px]">
                    <TrendingUp className="w-3 h-3" />
                    {m.avg !== null ? `${t("grades.monthly.avg")} ${faNumber(m.avg)}` : t("grades.monthly.noGrade")}
                  </span>
                </div>

                {m.avg !== null && (
                  <div className="h-2 rounded-full bg-cloud overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (m.avg / 20) * 100)}%`, background: m.avg >= 12 ? "var(--spring)" : "var(--destructive)" }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-cloud/70 py-1.5">
                    <b className="text-[12.5px] block text-spring">{faNumber(m.present)}</b>
                    <span className="text-[9.5px] text-steel flex items-center justify-center gap-0.5"><Users className="w-2.5 h-2.5" /> {t("dashboard.mini.attendance")}</span>
                  </div>
                  <div className="rounded-lg bg-cloud/70 py-1.5">
                    <b className="text-[12.5px] block text-destructive">{faNumber(m.absent)}</b>
                    <span className="text-[9.5px] text-steel">{t("dashboard.mini.absence")}</span>
                  </div>
                  <div className="rounded-lg bg-cloud/70 py-1.5">
                    <b className="text-[12.5px] block text-warning-deep">{faNumber(m.late)}</b>
                    <span className="text-[9.5px] text-steel">{t("grades.monthly.late")}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10.5px] text-steel pt-1 border-t border-hairline-soft">
                  <span className="flex items-center gap-1"><NotebookPen className="w-3 h-3" /> {faNumber(m.assignmentCount)} {t("grades.monthly.assignments")}</span>
                  {m.attendanceRate !== null && <span>{t("grades.monthly.attendanceRate")} {faNumber(m.attendanceRate)}٪</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
