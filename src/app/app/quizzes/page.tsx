"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Play, Lock, Undo2, Trash2, ChevronLeft, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type QuizStaff = { id: string; title: string; status: string; durationMin: number; subjectName: string | null; className: string | null; questionCount: number; attempts: number; submittedCount: number; avgScore: number | null; mine: boolean };
type QuizStudent = { id: string; title: string; durationMin: number; questionCount: number; myScore: number | null; submitted: boolean };
type QBank = { id: string; body: string; kind: string; difficulty: string; topic: string; subject: { name: string } | null };
type Subject = { id: string; name: string };
type ClassRow = { id: string; name: string };

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "پیش‌نویس", cls: "b-badge-warning" },
  OPEN: { label: "باز", cls: "b-badge-success" },
  CLOSED: { label: "بسته", cls: "b-badge-critical" },
};
const KIND: Record<string, string> = { MULTI: "چندگزینه‌ای", SHORT: "تشریحی کوتاه", ESSAY: "مقاله‌ای", FILL: "جای خالی" };

export default function QuizzesPage() {
  const [staff, setStaff] = useState<QuizStaff[] | null>(null);
  const [student, setStudent] = useState<QuizStudent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [durationMin, setDurationMin] = useState(20);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [bank, setBank] = useState<QBank[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ quizzes: Array<QuizStaff & QuizStudent> }>("/api/quizzes")
      .then((d) => {
        const list = d.quizzes ?? [];
        if (list.length && "status" in list[0]) { setStaff(list as QuizStaff[]); setStudent(null); }
        else { setStudent(list as QuizStudent[]); setStaff(null); }
        setLoadError("");
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setShowNew(true);
    Promise.all([
      apiGet<{ subjects: Subject[] }>("/api/question-bank").catch(() => ({ subjects: [] })),
      apiGet<{ classes: ClassRow[] }>("/api/classes").catch(() => ({ classes: [] })),
      apiGet<{ questions: QBank[] }>("/api/question-bank").catch(() => ({ questions: [] })),
    ]).then(([s, c, q]) => {
      setSubjects(s.subjects ?? []);
      setClasses(c.classes ?? []);
      setBank(q.questions ?? []);
    });
  }

  async function create() {
    if (title.trim().length < 3) { toast.error("عنوان آزمون را وارد کنید."); return; }
    if (picked.size === 0) { toast.error("حداقل یک سؤال انتخاب کنید."); return; }
    setBusy(true);
    try {
      await apiPost("/api/quizzes", {
        title: title.trim(),
        subjectId: subjectId || null,
        classId: classId || null,
        questionIds: [...picked],
        durationMin,
      });
      toast.success("آزمون ساخته شد (پیش‌نویس) — از فهرست منتشرش کنید.");
      setShowNew(false); setTitle(""); setPicked(new Set());
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function setStatus(q: QuizStaff, status: string) {
    try {
      await apiPatch("/api/quizzes", { id: q.id, status });
      toast.success(status === "OPEN" ? "آزمون منتشر شد." : status === "CLOSED" ? "آزمون بسته شد." : "به پیش‌نویس برگشت.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  async function remove(q: QuizStaff) {
    if (!window.confirm(`آزمون «${q.title}» و همهٔ تلاش‌هایش حذف شود؟`)) return;
    try {
      await apiDelete(`/api/quizzes?id=${q.id}`);
      toast.success("آزمون حذف شد.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <div><PageHeader title="آزمون آنلاین" desc="ساخت آزمون از بانک سؤال و تصحیح خودکار" /><LoadingBlock /></div>;

  // ── نمای دانش‌آموز ──
  if (student) {
    return (
      <div>
        <PageHeader title="آزمون‌های آنلاین" desc="آزمون‌های باز کلاس شما — شروع کنید، پاسخ دهید، نمره را همان لحظه ببینید" />
        {loadError && <ErrorBox message={loadError} />}
        {student.length === 0 ? (
          <EmptyState icon={ClipboardList} title="آزمون بازی نیست" desc="وقتی معلم آزمونی منتشر کند، اینجا می‌بینید." />
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 b-auto-stagger">
            {student.map((q) => (
              <article key={q.id} className="b-card b-card-hover p-4">
                <h3 className="font-extrabold text-[15px] leading-snug mb-2">{q.title}</h3>
                <p className="text-[12px] text-stone mb-4">{faNumber(q.questionCount)} سؤال · {faNumber(q.durationMin)} دقیقه</p>
                {q.submitted ? (
                  <div className="flex items-center gap-2">
                    <span className="b-badge b-badge-success"><CircleCheck className="w-3.5 h-3.5" /> تحویل شده</span>
                    {q.myScore !== null && <span className="font-extrabold text-spring-deep">نمره: {faNumber(q.myScore)} از ۱۰۰</span>}
                    <Link href={`/app/quizzes/${q.id}`} className="b-btn b-btn-ghost b-btn-sm ms-auto">مشاهده پاسخ‌ها <ChevronLeft className="w-4 h-4" /></Link>
                  </div>
                ) : (
                  <Link href={`/app/quizzes/${q.id}`} className="b-btn b-btn-spring w-full">
                    <Play className="w-4 h-4" /> شروع آزمون
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── نمای کادر ──
  return (
    <div>
      <PageHeader
        title="آزمون آنلاین"
        desc="ساخت آزمون از بانک سؤال، انتشار برای کلاس و تصحیح خودکار چندگزینه‌ای و جای‌خالی"
        action={<button className="b-btn b-btn-spring" onClick={openNew}><Plus className="w-4 h-4" /> آزمون جدید</button>}
      />
      {loadError && <ErrorBox message={loadError} />}
      {!staff || staff.length === 0 ? (
        <EmptyState icon={ClipboardList} title="هنوز آزمونی ساخته نشده" desc="با «آزمون جدید» از سؤال‌های بانک سؤال یک آزمون بسازید و برای کلاس منتشر کنید." />
      ) : (
        <div className="b-card p-4 md:p-5">
          <div className="overflow-x-auto">
            <table className="b-table w-full">
              <thead><tr><th>عنوان</th><th>درس / کلاس</th><th>سؤال</th><th>زمان</th><th>وضعیت</th><th>تلاش / تحویل</th><th>میانگین نمره</th><th></th></tr></thead>
              <tbody className="b-rows-in">
                {staff.map((q) => (
                  <tr key={q.id}>
                    <td className="font-semibold"><Link href={`/app/quizzes/${q.id}`} className="hover:text-spring-deep">{q.title}</Link></td>
                    <td>{q.subjectName ?? "—"}{q.className ? ` · ${q.className}` : " · همهٔ کلاس‌ها"}</td>
                    <td>{faNumber(q.questionCount)}</td>
                    <td>{faNumber(q.durationMin)} دقیقه</td>
                    <td><span className={`b-badge ${STATUS[q.status]?.cls}`}>{STATUS[q.status]?.label}</span></td>
                    <td>{faNumber(q.attempts)} / {faNumber(q.submittedCount)}</td>
                    <td>{q.avgScore !== null ? faNumber(q.avgScore) : "—"}</td>
                    <td>
                      <span className="flex gap-1 justify-end">
                        {q.status !== "OPEN" && <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setStatus(q, "OPEN")}><Play className="w-3.5 h-3.5" /> انتشار</button>}
                        {q.status === "OPEN" && <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setStatus(q, "CLOSED")}><Lock className="w-3.5 h-3.5" /> بستن</button>}
                        {q.status === "CLOSED" && <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setStatus(q, "DRAFT")}><Undo2 className="w-3.5 h-3.5" /> پیش‌نویس</button>}
                        <button className="b-btn b-btn-ghost b-icon-btn" title="حذف آزمون" onClick={() => remove(q)}><Trash2 className="w-4 h-4" /></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ساخت آزمون */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="b-card w-full max-w-2xl p-5 b-pop max-h-[92vh] overflow-y-auto">
            <h3 className="font-extrabold text-[16px] mb-4">آزمون جدید از بانک سؤال</h3>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <label className="b-field md:col-span-2"><span>عنوان *</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="b-input" placeholder="مثلاً آزمون فصل ۳ ریاضی" /></label>
              <label className="b-field"><span>درس</span>
                <Select value={subjectId} onChange={setSubjectId} options={[{ value: "", label: "بدون درس مشخص" }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]} />
              </label>
              <label className="b-field"><span>کلاس هدف</span>
                <Select value={classId} onChange={setClassId} options={[{ value: "", label: "همهٔ کلاس‌های مدرسه" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} />
              </label>
              <label className="b-field"><span>مدت (دقیقه)</span><input type="number" min={5} max={180} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 20)} className="b-input" /></label>
              <p className="text-[12px] text-stone self-end pb-2">{faNumber(picked.size)} سؤال انتخاب شده</p>
            </div>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pe-1">
              {bank.map((q) => (
                <label key={q.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[--hairline] cursor-pointer hover:border-[--spring] transition-colors">
                  <input type="checkbox" className="mt-1" checked={picked.has(q.id)} onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(q.id); else next.delete(q.id);
                    setPicked(next);
                  }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium leading-relaxed">{q.body}</span>
                    <span className="block text-[11px] text-stone mt-0.5">{KIND[q.kind] ?? q.kind} · {q.topic}{q.subject ? ` · ${q.subject.name}` : ""}</span>
                  </span>
                </label>
              ))}
              {bank.length === 0 && <p className="text-[12.5px] text-stone p-2">بانک سؤال خالی است — اول از صفحهٔ بانک سؤال، سؤال بسازید.</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="b-btn b-btn-spring flex-1" disabled={busy} onClick={create}>ساخت آزمون (پیش‌نویس)</button>
              <button className="b-btn b-btn-ghost" onClick={() => setShowNew(false)}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
