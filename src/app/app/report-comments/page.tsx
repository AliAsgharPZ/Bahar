"use client";

import { useLang } from "@/lib/i18n";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, Loader2, Save, Sparkles, Trash2, Plus, Copy } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Template = { id: string; category: string; text: string };
type SavedComment = { id: string; term: number; text: string };
type Data = { templates: Template[]; saved?: SavedComment[]; draft?: string };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };



export default function ReportCommentsPage() {
  const { t } = useLang();
  const CATS = [
    { value: "GENERAL", label: t("settings.general") },
    { value: "POSITIVE", label: t("reportComments.category.positive") },
    { value: "IMPROVE", label: t("reportComments.category.improve") },
    { value: "ATTENDANCE", label: t("reportComments.category.attendance") },
  ];
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [term, setTerm] = useState(1);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [tplText, setTplText] = useState("");
  const [tplCat, setTplCat] = useState("GENERAL");

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data, loading, error, refetch } = useApi<Data>(studentId ? `/api/report-comments?studentId=${studentId}` : "/api/report-comments");
  const templates = data?.templates ?? [];
  const saved = data?.saved?.find((s) => s.term === term);

  function pickStudent(id: string) {
    setStudentId(id);
    setText("");
  }

  async function saveComment() {
    if (!studentId) return;
    setSaving(true);
    try {
      await apiPost("/api/report-comments", { action: "saveComment", studentId, term, text });
      toast.success(t("reportComments.toast.saved"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (tplText.trim().length < 5) return;
    try {
      await apiPost("/api/report-comments", { action: "saveTemplate", text: tplText, category: tplCat });
      setTplText("");
      toast.success(t("reportComments.toast.templateAdded"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await apiPost("/api/report-comments", { action: "deleteTemplate", id });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.reportComments")}
        desc={t("reportComments.desc")}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: t("reportComments.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("reportComments.select.class")} />
            <Select value={studentId} onChange={pickStudent}
              options={[{ value: "", label: t("reportComments.select.student") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("reportComments.select.student")} />
            <div className="flex rounded-full bg-cloud p-1">
              {[1, 2].map((tt) => (
                <button key={tt} onClick={() => { setTerm(tt); setText(""); }} className={`px-3 py-1 rounded-full text-[12px] font-bold ${term === tt ? "bg-white shadow-sm" : "text-steel"}`}>{t("reportComments.term.label")} {tt === 1 ? t("reportComments.term.first") : t("reportComments.term.second")}</button>
              ))}
            </div>
          </div>
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {!studentId && <EmptyState icon={MessageSquareText} title={t("reportComments.empty.selectStudent")} desc={t("reportComments.empty.selectStudentDesc")} />}

      {studentId && data && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          <div className="b-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <b className="text-[16px]">{t("reportComments.textTitle")} {term === 1 ? t("reportComments.term.first") : t("reportComments.term.second")}</b>
              <div className="flex gap-2">
                <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setText(data.draft ?? "")}>
                  <Sparkles className="w-4 h-4" /> {t("reportComments.autoDraft")}
                </button>
                {saved && (
                  <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setText(saved.text)}>
                    <Copy className="w-4 h-4" /> {t("reportComments.savedText")}
                  </button>
                )}
              </div>
            </div>
            {data.draft && !text && (
              <div className="rounded-2xl bg-spring-tint/50 p-4 text-[14px] leading-relaxed">
                <b className="block mb-1 text-[12px]">{t("reportComments.draftHint")}</b>
                {data.draft}
              </div>
            )}
            <textarea className="b-input min-h-40" value={text} onChange={(e) => setText(e.target.value)}
              placeholder={t("reportComments.placeholder.text")} />
            <div className="flex items-center gap-3">
              <button className="b-btn b-btn-spring" disabled={saving || text.trim().length < 5} onClick={saveComment}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("reportComments.saveComment")}
              </button>
              {saved && <span className="text-[12px] text-steel">{t("reportComments.savedNote")}</span>}
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[14px]">{t("reportComments.bank.title")}</b>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto b-scroll">
              {templates.map((tpl) => (
                <div key={tpl.id} className="group rounded-lg bg-cloud p-3 text-[12px] leading-relaxed">
                  <p>{tpl.text}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="b-badge b-badge-spring" onClick={() => setText((x) => (x ? `${x} ${tpl.text}` : tpl.text))}>{t("reportComments.bank.addToText")}</button>
                    <button className="b-badge b-badge-neutral opacity-0 group-hover:opacity-100 max-md:opacity-100" onClick={() => deleteTemplate(tpl.id)}>
                      <Trash2 className="w-3 h-3" /> {t("common.delete")}
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-[12px] text-steel">{t("reportComments.bank.empty")}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Select className="w-full" buttonClassName="!w-full" value={tplCat} onChange={setTplCat} options={CATS} placeholder={t("reportComments.bank.category")} />
              <textarea className="b-input min-h-16" value={tplText} onChange={(e) => setTplText(e.target.value)} placeholder={t("reportComments.placeholder.phrase")} />
              <button className="b-btn b-btn-ghost b-btn-sm self-start" onClick={saveTemplate}><Plus className="w-4 h-4" /> {t("reportComments.bank.addPhrase")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
