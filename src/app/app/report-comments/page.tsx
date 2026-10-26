"use client";

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

const CATS = [
  { value: "GENERAL", label: "عمومی" },
  { value: "POSITIVE", label: "نقاط قوت" },
  { value: "IMPROVE", label: "قابل بهبود" },
  { value: "ATTENDANCE", label: "حضور و انضباط" },
];

export default function ReportCommentsPage() {
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
      toast.success("کامنت کارنامه ذخیره شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (tplText.trim().length < 5) return;
    try {
      await apiPost("/api/report-comments", { action: "saveTemplate", text: tplText, category: tplCat });
      setTplText("");
      toast.success("به بانک عبارات اضافه شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function deleteTemplate(id: string) {
    try {
      await apiPost("/api/report-comments", { action: "deleteTemplate", id });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="کامنت کارنامه"
        desc="پیش‌نویس خودکار از روی نمره، حضور و رفتار هر دانش‌آموز + بانک عبارات فارسی — معلم بازبینی، ویرایش و ذخیره می‌کند."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="انتخاب کلاس" />
            <Select value={studentId} onChange={pickStudent}
              options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="انتخاب دانش‌آموز" />
            <div className="flex rounded-full bg-cloud p-1">
              {[1, 2].map((t) => (
                <button key={t} onClick={() => { setTerm(t); setText(""); }} className={`px-3 py-1 rounded-full text-[12px] font-bold ${term === t ? "bg-white shadow-sm" : "text-steel"}`}>ترم {t === 1 ? "اول" : "دوم"}</button>
              ))}
            </div>
          </div>
        }
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {!studentId && <EmptyState icon={MessageSquareText} title="دانش‌آموزی را انتخاب کنید" desc="پیش‌نویس کارنامه و بانک عبارات اینجا ساخته می‌شود." />}

      {studentId && data && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
          <div className="b-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <b className="text-[15px]">متن کارنامه — ترم {term === 1 ? "اول" : "دوم"}</b>
              <div className="flex gap-2">
                <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setText(data.draft ?? "")}>
                  <Sparkles className="w-4 h-4" /> پیش‌نویس خودکار
                </button>
                {saved && (
                  <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setText(saved.text)}>
                    <Copy className="w-4 h-4" /> متن ذخیره‌شده
                  </button>
                )}
              </div>
            </div>
            {data.draft && !text && (
              <div className="rounded-xl bg-spring-tint/50 p-4 text-[13px] leading-relaxed">
                <b className="block mb-1 text-[12px]">پیش‌نویس از روی دادهٔ واقعی:</b>
                {data.draft}
              </div>
            )}
            <textarea className="b-input min-h-40" value={text} onChange={(e) => setText(e.target.value)}
              placeholder="متن نهایی کارنامه را اینجا بنویسید یا از پیش‌نویس و بانک عبارات بسازید…" />
            <div className="flex items-center gap-3">
              <button className="b-btn b-btn-spring" disabled={saving || text.trim().length < 5} onClick={saveComment}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیرهٔ کامنت
              </button>
              {saved && <span className="text-[11.5px] text-steel">برای این ترم کامنت ذخیره‌شده دارید.</span>}
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[14px]">بانک عبارات</b>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto b-scroll">
              {templates.map((t) => (
                <div key={t.id} className="group rounded-lg bg-cloud p-3 text-[12.5px] leading-relaxed">
                  <p>{t.text}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="b-badge b-badge-spring" onClick={() => setText((x) => (x ? `${x} ${t.text}` : t.text))}>افزودن به متن</button>
                    <button className="b-badge b-badge-neutral opacity-0 group-hover:opacity-100" onClick={() => deleteTemplate(t.id)}>
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-[12px] text-steel">هنوز عبارتی ثبت نشده.</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Select className="w-full" buttonClassName="!w-full" value={tplCat} onChange={setTplCat} options={CATS} placeholder="دسته" />
              <textarea className="b-input min-h-16" value={tplText} onChange={(e) => setTplText(e.target.value)} placeholder="عبارت جدید برای بانک…" />
              <button className="b-btn b-btn-ghost b-btn-sm self-start" onClick={saveTemplate}><Plus className="w-4 h-4" /> افزودن عبارت</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
