"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2, Send } from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };
type Form = { id: string; title: string; description: string | null; status: string; audience: string; fields: Field[] };
type Submission = {
  id: string; studentId: string | null; answers: Record<string, string>; createdAt: string;
  student?: { user: { firstName: string; lastName: string }; class: { name: string } | null } | null;
};
type StaffData = { staff: true; form: Form; submissions: Submission[] };
type AudienceData = { staff: false; form: Form; mine: Submission[] };

export default function FormDetailPage() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<StaffData | AudienceData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [children, setChildren] = useState<Array<{ value: string; label: string }>>([]);
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<StaffData | AudienceData>(`/api/forms/${params.id}`).then(setData).catch(() => setData(null));
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  // برای ولی: فهرست فرزندان از پاسخ‌های قبلی/مجوزها — ساده‌ترین منبع: فرم‌های من
  useEffect(() => {
    apiGet<{ myStudents?: Array<{ id: string; user: { firstName: string; lastName: string } }> }>("/api/gate-passes")
      .then((d) => {
        if (d.myStudents?.length) {
          setChildren(d.myStudents.map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}` })));
          setStudentId(d.myStudents[0].id);
        }
      })
      .catch(() => setChildren([]));
  }, []);

  // پرکردن پاسخ قبلی همان فرزند
  useEffect(() => {
    if (!data || data.staff) return;
    const prev = data.mine.find((m) => m.studentId === studentId) ?? data.mine[0];
    setAnswers(prev ? { ...prev.answers } : {});
  }, [data, studentId]);

  async function submit() {
    if (!data || data.staff) return;
    setBusy(true);
    try {
      await apiPost(`/api/forms/${params.id}`, { studentId: studentId || undefined, answers });
      toast.success(t("forms.paskh-shma-sbt-shd"));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(false); }
  }

  if (!data) return <LoadingBlock label={t("forms.frm-2")} />;
  const form = data.form;

  if (data.staff) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={form.title} desc={form.description ?? undefined} />
        <p className="t-sm text-steel">{data.submissions.length} {t("forms.paskh-sbt-shdh-ast")}</p>
        {data.submissions.length === 0
          ? <EmptyState icon={ClipboardList} title={t("forms.paskhy-nyst")} desc={t("forms.hnvz-ksy-ayn-frm-ra-tkmyl-nkrdh-ast")} />
          : <section className="b-card p-5 md:p-6 overflow-x-auto b-scroll">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-steel">
                    <th className="p-2 text-start">{t("common.student")}</th>
                    {form.fields.map((f) => <th key={f.key} className="p-2 text-start">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody className="b-rows-in">
                  {data.submissions.map((s) => (
                    <tr key={s.id} className="border-t border-hairline-soft">
                      <td className="p-2 font-bold whitespace-nowrap">{s.student ? `${s.student.user.firstName} ${s.student.user.lastName}` : "—"}</td>
                      {form.fields.map((f) => <td key={f.key} className="p-2">{s.answers[f.key] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>}
      </div>
    );
  }

  const closed = form.status !== "OPEN";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={form.title} desc={form.description ?? undefined} />
      {children.length > 1 && (
        <div className="w-64">
          <Select value={studentId} onChange={setStudentId} options={children} ariaLabel={t("forms.frznd")} />
        </div>
      )}
      <section className="b-card p-5 md:p-6 flex flex-col gap-4 max-w-2xl">
        {form.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
            {f.type === "textarea" ? (
              <textarea className="b-input !min-h-[90px]" disabled={closed} value={answers[f.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} />
            ) : f.type === "select" ? (
              <Select value={answers[f.key] ?? ""} onChange={(v) => setAnswers({ ...answers, [f.key]: v })} placeholder={t("forms.antkhab-knyd")} options={(f.options ?? []).map((o) => ({ value: o, label: o }))} ariaLabel={f.label} />
            ) : f.type === "checkbox" ? (
              <span className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" disabled={closed} checked={answers[f.key] === "بله"} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.checked ? t("common.yes") : t("common.no") })} />
                {t("forms.t-yyd-my-knm")}
              </span>
            ) : (
              <input className="b-input" type={f.type === "number" ? "number" : "text"} disabled={closed} value={answers[f.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
        {closed
          ? <p className="t-sm text-destructive">{t("forms.ayn-frm-bsth-shdh-ast")}</p>
          : <button className="b-btn b-btn-spring w-fit" disabled={busy} onClick={submit}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t("forms.sbt-paskh")}</button>}
      </section>
    </div>
  );
}
