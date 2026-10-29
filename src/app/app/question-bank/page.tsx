"use client";

import { useLang } from "@/lib/i18n";

import { useCallback, useEffect, useState } from "react";
import { FileQuestion, Plus, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { esc, escAttr } from "@/lib/print-esc";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Question = { id: string; topic: string; difficulty: string; kind: string; body: string; options: string; answer: string | null; explanation: string | null; imageUrl: string | null; subject: { name: string } | null; createdBy: { firstName: string; lastName: string } | null };
type Subject = { id: string; name: string; grade: string | null };



export default function QuestionBankPage() {
  const { t } = useLang();
  const DIFF: Record<string, { label: string; cls: string }> = {
    EASY: { label: t("enum.difficulty.EASY"), cls: "b-badge-success" }, MEDIUM: { label: t("enum.difficulty.MEDIUM"), cls: "b-badge-warning" }, HARD: { label: t("enum.difficulty.HARD"), cls: "b-badge-critical" },
  };
  const KIND: Record<string, string> = { MULTI: t("enum.questionKind.MULTI"), SHORT: t("enum.questionKind.SHORT"), ESSAY: t("enum.questionKind.ESSAY"), FILL: t("enum.questionKind.FILL") };
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [filters, setFilters] = useState({ subjectId: "", difficulty: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ subjectId: "", topic: "", difficulty: "MEDIUM", kind: "MULTI", body: "", options: ["", "", "", ""], answer: "", explanation: "", imageUrl: "" });

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.subjectId) p.set("subjectId", filters.subjectId);
    if (filters.difficulty) p.set("difficulty", filters.difficulty);
    apiGet<{ questions: Question[]; subjects: Subject[] }>(`/api/question-bank?${p}`)
      .then((d) => { setLoadError(""); setQuestions(d.questions); setSubjects(d.subjects); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t("questionBank.loadError")))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(load, [load]);

  async function submit() {
    if (!form.body.trim() || !form.topic.trim()) { toast.error(t("questionBank.toast.required")); return; }
    try {
      await apiPost("/api/question-bank", {
        ...form,
        subjectId: form.subjectId || undefined,
        options: form.kind === "MULTI" ? form.options.filter(Boolean) : [],
      });
      toast.success(t("questionBank.toast.added"));
      setForm({ subjectId: "", topic: "", difficulty: "MEDIUM", kind: "MULTI", body: "", options: ["", "", "", ""], answer: "", explanation: "", imageUrl: "" });
      setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function remove(id: string) {
    try { await apiDelete(`/api/question-bank?id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function printPaper(mode: "questions" | "answers") {
    const chosen = questions.filter((q) => selected.has(q.id));
    if (!chosen.length) { toast.error(t("questionBank.toast.pick")); return; }
    const w = window.open("", "_blank");
    if (!w) return;
    const items = chosen.map((q, i) => {
      let opts: string[] = [];
      try { opts = JSON.parse(q.options || "[]") as string[]; } catch { opts = []; } // FIX راند ۱۶
      const optHtml = opts.length
        ? `<div class="opts">${opts.map((o, j) => `<span> ${["۱)", "۲)", "۳)", "۴)", "۵)", "۶)"][j] ?? (j + 1) + ")"} ${esc(o)}</span>`).join("")}</div>` : "";
      const ansHtml = mode === "answers"
        ? `<div class="ans"><b>پاسخ:</b> ${esc(q.answer ?? "—")}${q.explanation ? ` — <i>${esc(q.explanation)}</i>` : ""}</div>` : "";
      return `<div class="q"><p class="qnum">${toFa(i + 1)}. ${esc(q.body)}</p>${q.imageUrl ? `<img src="${escAttr(q.imageUrl)}" />` : ""}${optHtml}${ansHtml}</div>`;
    }).join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${mode === "answers" ? "پاسخنامه" : "برگه سوال"}</title>
    <style>
      @page { size: A4; margin: 18mm 16mm; }
      body { font-family: Vazirmatn, Tahoma, sans-serif; color: var(--ink-deep); font-size: 12.5pt; line-height: 1.9; }
      .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid var(--ink-deep); padding-bottom: 8mm; margin-bottom: 6mm; }
      .head h1 { font-size: 14pt; margin: 0; }
      .meta { font-size: 10pt; }
      .meta span { display: inline-block; border: 1px solid var(--ink-deep); padding: 2mm 8mm; margin-left: 3mm; }
      .q { page-break-inside: avoid; margin-bottom: 5mm; }
      .qnum { font-weight: bold; margin: 0 0 1mm; }
      .opts { display: flex; flex-wrap: wrap; gap: 2mm 8mm; padding-right: 8mm; font-size: 11.5pt; }
      .ans { background: var(--cloud); padding: 1.5mm 3mm; border-right: 2pt solid var(--ink-deep); margin-top: 1mm; font-size: 11pt; }
      img { max-width: 60mm; filter: grayscale(1) contrast(1.15); display: block; margin: 2mm 0; }
      .foot { margin-top: 8mm; border-top: 1px solid var(--ink-deep); padding-top: 2mm; font-size: 9.5pt; display: flex; justify-content: space-between; }
    </style></head><body>
    <div class="head"><h1>${mode === "answers" ? "پاسخنامه آزمون" : "برگه سوالات آزمون"}</h1><div class="meta"><span>نام و نام خانوادگی:</span><span>تعداد سوال: ${toFa(chosen.length)}</span><span>تاریخ: ــــــــ</span></div></div>
    ${items}
    <div class="foot"><span>مدرسه ــــــــــــــــ</span><span>نمره کل: ــــــ</span></div>
    <script>setTimeout(() => window.print(), 300);</script>
    </body></html>`);
    w.document.close();
  }
  const toFa = (n: number) => n.toLocaleString("fa-IR");

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title={t("nav.questionBank")}
        desc={`${t("questionBank.descPrefix")} ${faNumber(questions.length)} ${t("questionBank.descUnit")} ${t("questionBank.descSuffix")}`}
        action={
          <div className="flex gap-2">
            <button onClick={() => printPaper("questions")} disabled={!selected.size} className="b-btn b-btn-sm b-btn-ghost"><Printer className="w-4 h-4" /> {t("questionBank.printQuestions")}</button>
            <button onClick={() => printPaper("answers")} disabled={!selected.size} className="b-btn b-btn-sm b-btn-spring"><Printer className="w-4 h-4" /> {t("questionBank.printAnswers")}</button>
            <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-ink"><Plus className="w-4 h-4" /> {t("questionBank.new")}</button>
          </div>
        }
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-2">
          <Select
            value={form.subjectId}
            onChange={(v) => setForm({ ...form, subjectId: v })}
            options={[{ value: "", label: t("questionBank.field.subjectOptional") }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            placeholder={t("questionBank.field.subjectOptional")}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder={t("questionBank.placeholder.topic")} className="b-input" />
          <Select
            value={form.difficulty}
            onChange={(v) => setForm({ ...form, difficulty: v })}
            options={[{ value: "EASY", label: `${t("questionBank.difficultyPrefix")} ${t("enum.difficulty.EASY")}` }, { value: "MEDIUM", label: `${t("questionBank.difficultyPrefix")} ${t("enum.difficulty.MEDIUM")}` }, { value: "HARD", label: `${t("questionBank.difficultyPrefix")} ${t("enum.difficulty.HARD")}` }]}
            className="w-full"
            buttonClassName="!w-full"
          />
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={Object.entries(KIND).map(([k, v]) => ({ value: k, label: v }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t("questionBank.placeholder.body")} className="b-input sm:col-span-2 !min-h-[70px]" />
          {form.kind === "MULTI" && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              {form.options.map((o, i) => (
                <input key={i} value={o} onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm({ ...form, options: opts }); }} placeholder={`${t("questionBank.option")} ${toFa(i + 1)}`} className="b-input !h-10" />
              ))}
            </div>
          )}
          <input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder={t("questionBank.placeholder.answer")} className="b-input" />
          <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder={t("questionBank.placeholder.image")} className="b-input" dir="ltr" />
          <button onClick={submit} className="b-btn b-btn-sm b-btn-spring sm:col-span-2 w-fit">{t("questionBank.submit")}</button>
        </div>
      )}
      <div className="flex gap-1.5 mb-5">
        <Select
          value={filters.subjectId}
          onChange={(v) => setFilters({ ...filters, subjectId: v })}
          options={[{ value: "", label: t("questionBank.filter.allSubjects") }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
          placeholder={t("questionBank.filter.allSubjects")}
          className="!w-40"
          buttonClassName="!h-10 !w-40"
        />
        <Select
          value={filters.difficulty}
          onChange={(v) => setFilters({ ...filters, difficulty: v })}
          options={[{ value: "", label: t("questionBank.filter.allLevels") }, { value: "EASY", label: t("enum.difficulty.EASY") }, { value: "MEDIUM", label: t("enum.difficulty.MEDIUM") }, { value: "HARD", label: t("enum.difficulty.HARD") }]}
          placeholder={t("questionBank.filter.allLevels")}
          className="!w-32"
          buttonClassName="!h-10 !w-32"
        />
        {selected.size > 0 && <span className="b-badge b-badge-spring self-center">{faNumber(selected.size)} {t("common.selected")}</span>}
      </div>
      {questions.length === 0 ? <EmptyState icon={FileQuestion} title={t("questionBank.empty.noQuestion")} desc={t("questionBank.empty.createFirst")} /> : (
        <div className="flex flex-col gap-2.5">
          {questions.map((q) => {
            const opts = JSON.parse(q.options || "[]") as string[];
            return (
              <label key={q.id} className={`b-card-sm p-4 flex items-start gap-3 cursor-pointer transition-colors ${selected.has(q.id) ? "!border-spring bg-spring-tint/30" : "hover:bg-cloud"}`}>
                <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggle(q.id)} className="mt-1 w-4 h-4 accent-spring shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {q.subject && <span className="b-badge b-badge-neutral">{q.subject.name}</span>}
                    <span className={`b-badge ${DIFF[q.difficulty]?.cls ?? "b-badge-neutral"}`}>{DIFF[q.difficulty]?.label}</span>
                    <span className="text-[10.5px] text-stone">{q.topic}</span>
                  </div>
                  <p className="text-[13px] font-bold leading-relaxed">{q.body}</p>
                  {opts.length > 0 && <p className="text-[11.5px] text-steel mt-1">{opts.map((o, j) => `${["۱)", "۲)", "۳)", "۴)"][j] ?? ""} ${o}`).join("   ")}</p>}
                  {q.answer && <p className="text-[12px] text-spring-deep mt-1">{t("questionBank.answer")} {q.answer}</p>}
                </div>
                <button onClick={(e) => { e.preventDefault(); remove(q.id); }} className="b-btn b-btn-ghost text-stone hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
