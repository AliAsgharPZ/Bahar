"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, Trash2, Lock, LockOpen, X } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] };
type FormRow = {
  id: string; title: string; description: string | null; audience: string; status: string;
  deadline: string | null; createdAt: string; fields: Field[];
  _count?: { submissions: number }; submittedStudentIds?: string[];
};
type Data = { staff: boolean; forms: FormRow[]; myStudentIds?: string[] };

type DraftField = { label: string; type: string; required: boolean; options: string };
const TYPE_OPTIONS = [
  { value: "text", tkey: "forms.fieldType.text" },
  { value: "textarea", tkey: "forms.fieldType.textarea" },
  { value: "select", tkey: "forms.fieldType.select" },
  { value: "checkbox", tkey: "forms.fieldType.checkbox" },
  { value: "number", tkey: "forms.fieldType.number" },
];

export default function FormsPage() {
  const { t } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [audience, setAudience] = useState("PARENTS");
  const [deadline, setDeadline] = useState("");
  const [fields, setFields] = useState<DraftField[]>([{ label: "", type: "text", required: true, options: "" }]);

  const load = useCallback(() => { apiGet<Data>("/api/forms").then(setData).catch(() => setData({ staff: false, forms: [] })); }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    const clean = fields.filter((f) => f.label.trim());
    if (!title.trim()) { toast.error(t("forms.anvan-frm-ra-bnvysyd")); return; }
    if (!clean.length) { toast.error(t("forms.hdaql-yk-fyld-lazm-ast")); return; }
    setBusy("create");
    try {
      await apiPost("/api/forms", {
        title, description: desc || undefined, audience,
        deadline: deadline || undefined,
        fields: clean.map((f, i) => ({
          key: `f${i + 1}`,
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          options: f.type === "select" ? f.options.split("\n").map((o) => o.trim()).filter(Boolean) : undefined,
        })),
      });
      toast.success(t("forms.frm-sakhth-v-mntshr-shd"));
      setOpen(false); setTitle(""); setDesc(""); setDeadline("");
      setFields([{ label: "", type: "text", required: true, options: "" }]);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function toggle(f: FormRow) {
    setBusy(f.id);
    try { await apiPatch("/api/forms", { id: f.id, status: f.status === "OPEN" ? "CLOSED" : "OPEN" }); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function remove(f: FormRow) {
    if (!confirm(`${t("forms.frm")}${f.title}${t("forms.v-hmh-paskh-haysh-hzf-shvd")}`)) return;
    setBusy(f.id);
    try { await apiDelete(`/api/forms?id=${encodeURIComponent(f.id)}`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label={t("forms.frm-ha")} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.forms")}
        desc={data.staff ? t("forms.frm-anlayn-bsazyd-rzayt-namh-ardv-sbt-nam-nzrsnjy-v-paskh-ha-ra") : t("forms.frm-hayy-kh-bayd-tkmyl-knyd")}
        action={data.staff ? <button className="b-btn b-btn-spring" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> {t("forms.frm-jdyd")}</button> : undefined}
      />
      {data.forms.length === 0
        ? <EmptyState icon={ClipboardList} title={t("forms.frmy-nyst")} desc={data.staff ? t("forms.avlyn-frm-ra-bsazyd") : t("forms.frm-bazy-bray-shma-vjvd-ndard")} />
        : <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
            {data.forms.map((f) => (
              <div key={f.id} className="b-card b-card-hover p-5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <b className="text-[15px]">{f.title}</b>
                  <span className={`b-badge ${f.status === "OPEN" ? "b-badge-spring" : "b-badge-neutral"}`}>{f.status === "OPEN" ? t("dashboard.ticket.open") : t("dashboard.ticket.closed")}</span>
                </div>
                {f.description && <p className="t-sm text-steel line-clamp-2">{f.description}</p>}
                <p className="t-cap text-steel">
                  {t("forms.mkhatb")}: {f.audience === "PARENTS" ? t("students.table.parents") : f.audience === "STUDENTS" ? t("nav.students") : t("common.all")}
                  {f.deadline ? ` ${t("forms.mhlt")} ${f.deadline}` : ""}
                  {data.staff ? ` · ${faNumber(f._count?.submissions ?? 0)} ${t("forms.paskh")}` : ""}
                  {!data.staff && f.submittedStudentIds ? ` ${t("forms.tkmyl-shdh-bray")} ${faNumber(f.submittedStudentIds.length)} ${t("dashboard.unit.person")}` : ""}
                </p>
                <div className="flex gap-2 mt-1">
                  <Link className="b-btn b-btn-soft b-btn-sm" href={`/app/forms/${f.id}`}>{data.staff ? t("forms.paskh-ha-v-jzyyat") : t("forms.tkmyl-frm")}</Link>
                  {data.staff && (
                    <>
                      <button className="b-btn b-btn-ghost b-btn-sm" disabled={busy === f.id} onClick={() => toggle(f)}>
                        {f.status === "OPEN" ? <><Lock className="w-3.5 h-3.5" /> {t("common.close")}</> : <><LockOpen className="w-3.5 h-3.5" /> {t("forms.bazkrdn")}</>}
                      </button>
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === f.id} onClick={() => remove(f)}><Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="b-card w-full max-w-xl p-6 flex flex-col gap-3 max-h-[92vh] overflow-y-auto b-scroll" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{t("forms.frm-jdyd")}</h3>
            <input className="b-input" placeholder={t("forms.anvan-msla-rzayt-namh-ardvy-almy")} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="b-input !min-h-[70px]" placeholder={t("forms.tvzyh-akhtyary")} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={audience} onChange={setAudience} options={[{ value: "PARENTS", label: t("students.table.parents") }, { value: "STUDENTS", label: t("nav.students") }, { value: "ALL", label: t("common.all") }]} ariaLabel={t("forms.mkhatb")} />
              <input className="b-input" placeholder={t("forms.mhlt-shmsy-akhtyary")} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <b className="text-[13px]">{t("forms.fyldha")}</b>
              {fields.map((f, i) => (
                <div key={i} className="b-card-sm !rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input className="b-input flex-1" placeholder={t("forms.anvan-fyld-msla-nam-v-nam-khanvadgy-vly")} value={f.label} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <button className="b-btn b-btn-ghost text-destructive shrink-0" onClick={() => setFields(fields.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-44">
                      <Select value={f.type} onChange={(v) => setFields(fields.map((x, j) => j === i ? { ...x, type: v } : x))} options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.tkey) }))} ariaLabel={t("forms.nva-fyld")} />
                    </div>
                    <label className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="checkbox" checked={f.required} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))} /> {t("forms.alzamy")}
                    </label>
                  </div>
                  {f.type === "select" && (
                    <textarea className="b-input !min-h-[56px]" placeholder={t("forms.gzynh-ha-hr-gzynh-dr-yk-str")} value={f.options} onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, options: e.target.value } : x))} />
                  )}
                </div>
              ))}
              <button className="b-btn b-btn-ghost b-btn-sm w-fit" onClick={() => setFields([...fields, { label: "", type: "text", required: false, options: "" }])}><Plus className="w-3.5 h-3.5" /> {t("forms.fyld-dygr")}</button>
            </div>
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "create"} onClick={create}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("forms.antshar-frm")}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
