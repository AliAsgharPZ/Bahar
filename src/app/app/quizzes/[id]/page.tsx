"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Play, Send, Timer, CircleCheck, CircleX, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";

type QStaff = { id: string; body: string; kind: string; difficulty: string; options: string[]; answer: string | null; explanation: string | null; imageUrl: string | null };
type QStudent = { id: string; body: string; kind: string; difficulty: string; options: string[]; imageUrl: string | null; myAnswer?: string; correctAnswer?: string | null; explanation?: string | null; correct?: boolean | null };
type AttemptRow = { id: string; studentName: string; className: string; score: number | null; submittedAt: string | null; startedAt: string };
type Detail = {
  quiz: { id: string; title: string; status: string; durationMin: number };
  questions: Array<QStaff & QStudent>;
  attempts?: AttemptRow[];
  attempt?: { startedAt: string; submittedAt: string | null; score: number | null; answers: Record<string, string> } | null;
};

const KIND: Record<string, string> = { MULTI: "چندگزینه‌ای", SHORT: "تشریحی کوتاه", ESSAY: "مقاله‌ای", FILL: "جای خالی" };

export default function QuizDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [remain, setRemain] = useState<number | null>(null);
  const submittedRef = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<Detail>(`/api/quizzes/${id}`)
      .then((d) => { setData(d); setLoadError(""); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const attempt = data?.attempt ?? null;
  const inProgress = !!attempt && !attempt.submittedAt;
  const submitted = !!attempt?.submittedAt;

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    try {
      const res = await apiPost<{ attempt: { score: number | null } }>(`/api/quizzes/${id}`, { action: "submit", answers });
      toast.success(auto ? "زمان تمام شد و آزمون خودکار تحویل داده شد." : "آزمون تحویل داده شد.");
      if (res.attempt.score !== null) toast.success(`نمرهٔ شما: ${faNumber(res.attempt.score)} از ۱۰۰`);
      load();
    } catch (e) {
      submittedRef.current = false;
      toast.error(e instanceof Error ? e.message : "خطا در تحویل");
    } finally { setBusy(false); }
  }, [answers, id, load]);

  // شمارش معکوس از لحظهٔ شروع
  useEffect(() => {
    if (!inProgress || !data) { setRemain(null); return; }
    const deadline = new Date(attempt!.startedAt).getTime() + data.quiz.durationMin * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemain(left);
      if (left <= 0 && !submittedRef.current) void submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [inProgress, data, attempt, submit]);

  async function start() {
    setBusy(true);
    try {
      await apiPost(`/api/quizzes/${id}`, { action: "start" });
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  }

  const remainText = useMemo(() => {
    if (remain === null) return "";
    const m = Math.floor(remain / 60);
    const s = remain % 60;
    return `${faNumber(m)}:${String(s).padStart(2, "0")}`;
  }, [remain]);

  if (loading && !data) return <div><PageHeader title="آزمون آنلاین" /><LoadingBlock /></div>;
  if (loadError) return <div><PageHeader title="آزمون آنلاین" /><ErrorBox message={loadError} /></div>;
  if (!data) return null;

  const isStaff = Array.isArray(data.attempts);

  return (
    <div>
      <PageHeader
        title={data.quiz.title}
        desc={isStaff ? "جزئیات آزمون، پاسخ‌نامه و نتایج دانش‌آموزان" : `${faNumber(data.questions.length)} سؤال · ${faNumber(data.quiz.durationMin)} دقیقه`}
        action={<Link href="/app/quizzes" className="b-btn b-btn-ghost"><ArrowRight className="w-4 h-4" /> همهٔ آزمون‌ها</Link>}
      />

      {/* ── نمای کادر ── */}
      {isStaff && (
        <>
          <section className="b-card p-4 md:p-5 mb-5 no-print">
            <h2 className="font-extrabold text-[15px] mb-3">سؤال‌ها و پاسخ‌نامه</h2>
            <div className="flex flex-col gap-3">
              {data.questions.map((q, i) => (
                <div key={q.id} className="rounded-xl border border-[--hairline] p-3.5">
                  <p className="font-semibold text-[13.5px] leading-relaxed">{faNumber(i + 1)}. {q.body}</p>
                  {q.options.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[12.5px] text-stone">
                      {q.options.map((o, oi) => <li key={oi}>· {o}</li>)}
                    </ul>
                  )}
                  <p className="text-[12px] mt-2"><span className="text-spring-deep font-bold">پاسخ: {q.answer ?? "—"}</span>{q.explanation ? <span className="text-stone"> — {q.explanation}</span> : null}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="b-card p-4 md:p-5 no-print">
            <h2 className="font-extrabold text-[15px] mb-3">نتایج دانش‌آموزان</h2>
            {data.attempts!.length === 0 ? (
              <p className="text-[13px] text-stone">هنوز دانش‌آموزی شرکت نکرده است.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="b-table w-full">
                  <thead><tr><th>دانش‌آموز</th><th>کلاس</th><th>وضعیت</th><th>نمره از ۱۰۰</th></tr></thead>
                  <tbody className="b-rows-in">
                    {data.attempts!.map((a) => (
                      <tr key={a.id}>
                        <td className="font-semibold">{a.studentName}</td>
                        <td>{a.className}</td>
                        <td>{a.submittedAt ? <span className="b-badge b-badge-success">تحویل‌شده</span> : <span className="b-badge b-badge-warning">در حال پاسخ</span>}</td>
                        <td className="font-bold">{a.score !== null ? faNumber(a.score) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── بستهٔ چاپ معلم: برگهٔ سؤال (بدون پاسخ) + پاسخ‌نامه + نتایج — فقط در چاپ ── */}
          <div className="print-only">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <span>نام و نام خانوادگی: ……………………</span>
              <span>کلاس: ……………</span>
              <span>تاریخ: ……………</span>
              <span>زمان: {faNumber(data.quiz.durationMin)} دقیقه · {faNumber(data.questions.length)} سؤال</span>
            </div>
            <div className="flex flex-col gap-4">
              {data.questions.map((q, i) => (
                <div key={q.id} className="b-print-keep">
                  <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.9 }}>{faNumber(i + 1)}. {q.body}</p>
                  {q.options.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 24px", fontSize: 12, marginTop: 4 }}>
                      {q.options.map((o, oi) => (
                        <span key={oi}>{["الف", "ب", "ج", "د", "ه"][oi] ?? oi + 1}) {o}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ borderBottom: "1px dotted #8a9b92", height: 26 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="print-only" style={{ pageBreakBefore: "always" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>پاسخ‌نامه — {data.quiz.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px 20px", fontSize: 12 }}>
              {data.questions.map((q, i) => (
                <span key={q.id}>{faNumber(i + 1)}. {q.answer ?? "—"}</span>
              ))}
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: "20px 0 10px" }}>نتایج دانش‌آموزان</h2>
            <table>
              <thead><tr><th>دانش‌آموز</th><th>کلاس</th><th>وضعیت</th><th>نمره از ۱۰۰</th></tr></thead>
              <tbody>
                {data.attempts!.map((a) => (
                  <tr key={a.id}>
                    <td>{a.studentName}</td><td>{a.className}</td>
                    <td>{a.submittedAt ? "تحویل‌شده" : "در حال پاسخ"}</td>
                    <td>{a.score !== null ? faNumber(a.score) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── نمای دانش‌آموز: پیش از شروع ── */}
      {!isStaff && !attempt && (
        <div className="b-card p-6 md:p-8 text-center max-w-xl mx-auto">
          <ClipboardList className="w-10 h-10 mx-auto text-spring mb-3" />
          <h2 className="font-extrabold text-[18px] mb-2">{data.quiz.title}</h2>
          <p className="text-[13px] text-stone leading-relaxed mb-6">
            این آزمون {faNumber(data.questions.length)} سؤال و {faNumber(data.quiz.durationMin)} دقیقه زمان دارد.
            با زدن «شروع»، زمان‌سنج فعال می‌شود و فقط یکبار می‌توانید پاسخ‌ها را تحویل دهید.
          </p>
          <button className="b-btn b-btn-spring" disabled={busy} onClick={start}>
            <Play className="w-4 h-4" /> شروع آزمون
          </button>
        </div>
      )}

      {/* ── نمای دانش‌آموز: در حال پاسخ یا نتیجه ── */}
      {!isStaff && attempt && (
        <>
          {inProgress && (
            <div className={`sticky top-16 z-20 mb-4 rounded-xl px-4 py-2.5 flex items-center gap-2 font-extrabold text-[14px] ${remain !== null && remain < 60 ? "bg-[--critical-soft] text-[--critical]" : "bg-[--spring-tint] text-spring-deep"}`}>
              <Timer className="w-4.5 h-4.5" />
              زمان باقی‌مانده: <span dir="ltr">{remainText}</span>
              <span className="ms-auto text-[11.5px] font-medium opacity-80">با پایان زمان، آزمون خودکار تحویل می‌شود</span>
            </div>
          )}
          {submitted && (
            <div className="b-card p-5 mb-5 text-center">
              <CircleCheck className="w-9 h-9 mx-auto text-spring mb-2" />
              <p className="font-extrabold text-[16px]">آزمون تحویل داده شد</p>
              {attempt.score !== null
                ? <p className="text-spring-deep font-extrabold text-[22px] mt-1">نمره: {faNumber(attempt.score)} از ۱۰۰</p>
                : <p className="text-[12.5px] text-stone mt-1">این آزمون سؤال تشریحی دارد و نمره‌اش بعد از تصحیح معلم اعلام می‌شود.</p>}
            </div>
          )}
          <div className="flex flex-col gap-3.5">
            {data.questions.map((q, i) => (
              <section key={q.id} className="b-card p-4 md:p-5">
                <p className="font-semibold text-[14px] leading-relaxed mb-3">
                  {faNumber(i + 1)}. {q.body}
                  <span className="b-badge ms-2">{KIND[q.kind] ?? q.kind}</span>
                  {submitted && q.correct === true && <span className="b-badge b-badge-success ms-1"><CircleCheck className="w-3 h-3" /> درست</span>}
                  {submitted && q.correct === false && <span className="b-badge b-badge-critical ms-1"><CircleX className="w-3 h-3" /> نادرست</span>}
                </p>
                {q.imageUrl && <img src={q.imageUrl} alt="تصویر سؤال" className="max-h-56 rounded-lg border border-[--hairline] mb-3" />}
                {q.kind === "MULTI" && q.options.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {q.options.map((o, oi) => {
                      const chosen = submitted ? q.myAnswer === o : answers[q.id] === o;
                      const isAnswer = submitted && q.correctAnswer === o;
                      return (
                        <label key={oi} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${isAnswer ? "border-[--spring] bg-[--spring-tint]" : chosen ? "border-[--spring]" : "border-[--hairline]"} ${inProgress ? "cursor-pointer hover:border-[--spring]" : ""}`}>
                          <input type="radio" name={`q-${q.id}`} disabled={!inProgress} checked={chosen}
                            onChange={() => setAnswers({ ...answers, [q.id]: o })} />
                          <span className="text-[13.5px]">{o}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : q.kind === "FILL" || q.kind === "SHORT" ? (
                  submitted
                    ? <p className="text-[13px]">پاسخ شما: <b>{q.myAnswer || "—"}</b>{q.correctAnswer ? <span className="text-spring-deep"> · پاسخ درست: <b>{q.correctAnswer}</b></span> : null}</p>
                    : <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="b-input w-full" placeholder="پاسختان را بنویسید…" />
                ) : (
                  submitted
                    ? <p className="text-[13px]">پاسخ شما: <b>{q.myAnswer || "—"}</b></p>
                    : <textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="b-input w-full min-h-24" placeholder="پاسخ تشریحی…" />
                )}
                {submitted && q.explanation && <p className="text-[12px] text-stone mt-2.5">توضیح: {q.explanation}</p>}
              </section>
            ))}
          </div>
          {inProgress && (
            <button className="b-btn b-btn-spring w-full mt-5" disabled={busy} onClick={() => void submit(false)}>
              <Send className="w-4 h-4" /> تحویل نهایی آزمون
            </button>
          )}
        </>
      )}

      {!isStaff && !attempt && data.questions.length === 0 && (
        <EmptyState icon={ClipboardList} title="سؤالی نیست" desc="این آزمون هنوز سؤالی ندارد." />
      )}
    </div>
  );
}
