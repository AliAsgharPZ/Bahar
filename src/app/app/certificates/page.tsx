"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Plus, Trash2, QrCode, Ban, Printer, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { qrSvg } from "@/lib/qr";
import { faNumber, formatDateFa } from "@/lib/persian";
import { esc } from "@/lib/print-esc";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";

type Template = { id: string; kind: string; title: string; bodyTemplate: string; footerNote: string | null };
type Cert = { id: string; title: string; body: string; serial: string; verifyCode: string; issuedAt: string; revokedAt: string | null; kind: string; student: { user: { firstName: string; lastName: string; nationalId: string }; class: { name: string } | null } };
type CertsData = { templates: unknown[]; certs: Cert[]; students: unknown[]; canRevoke?: boolean };
type StudentOpt = { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };

/** QR کوچک چاپی برای استعلام گواهی */
function qrSvgHtml(text: string): string {
  return qrSvg(text, { ecl: "MEDIUM", scale: 3 });
}

const KINDS: Record<string, string> = { ENROLLMENT: "گواهی تحصیل", BONAFIDE: "اشتغال به تحصیل", ACHIEVEMENT: "گواهی افتخار", TRANSFER: "انتقال", CUSTOM: "سفارشی" };

export default function CertificatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [kindLabels, setKindLabels] = useState<Record<string, string>>({});
  const [canRevoke, setCanRevoke] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"issue" | "list" | "templates">("issue");
  const [issueForm, setIssueForm] = useState({ studentId: "", templateId: "", body: "" });
  const [tplForm, setTplForm] = useState({ kind: "ENROLLMENT", title: "", bodyTemplate: "مدیر محترم مدرسه محل، certify می‌نماید دانش‌آموز {{student_name}} فرزند {{father_name}} به شماره ملی {{national_id}} و شماره دانش‌آموزی {{student_number}} در سال تحصیلی جاری در پایه {{grade}} کلاس {{class_name}} در این مدرسه مشغول به تحصیل است.", footerNote: "" });
  const confirm = useConfirm();

  const load = useCallback(() => {
    apiGet<{ templates: Template[]; certs: Cert[]; students: StudentOpt[]; kindLabels: Record<string, string>; canRevoke?: boolean }>("/api/certificates")
      .then((d) => { setLoadError(""); setTemplates(d.templates); setCerts(d.certs); setStudents(d.students); setKindLabels(d.kindLabels); setCanRevoke(Boolean(d.canRevoke)); })
      .catch((e) => { setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری گواهی‌ها"); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function issue() {
    if (!issueForm.studentId) { toast.error("دانش‌آموز را انتخاب کنید"); return; }
    if (!issueForm.templateId && !issueForm.body.trim()) { toast.error("قالب را انتخاب کنید یا متن دستی بنویسید"); return; }
    try {
      const d = await apiPost<{ certificate: Cert; verifyUrl: string }>("/api/certificates", {
        action: "issue", studentId: issueForm.studentId,
        // FIX (راند ۱۶): اگر کاربر متن دستی نوشته، متن او ملاک است (قالب نادیده گرفته می‌شود)
        templateId: !issueForm.body.trim() ? issueForm.templateId || undefined : undefined,
        body: issueForm.body || undefined,
        kind: templates.find((t) => t.id === issueForm.templateId)?.kind ?? "CUSTOM",
        title: templates.find((t) => t.id === issueForm.templateId)?.title ?? "گواهی",
      });
      toast.success(`گواهی صادر شد — کد استعلام: ${d.certificate.verifyCode}`);
      setIssueForm({ studentId: "", templateId: "", body: "" }); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function addTemplate() {
    if (!tplForm.title.trim() || !tplForm.bodyTemplate.trim()) { toast.error("عنوان و متن قالب لازم است"); return; }
    try {
      await apiPost("/api/certificates", { action: "template", ...tplForm });
      toast.success("قالب ساخته شد");
      setTplForm({ ...tplForm, title: "" }); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function revoke(id: string) {
    try { await apiPatch("/api/certificates", { id, revoke: true }); toast.success("گواهی باطل شد"); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  function printCert(c: Cert) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><title>${esc(c.title)}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: Vazirmatn, Tahoma, sans-serif; text-align: center; color: #0b1416; }
      .frame { border: 3px double #00825e; border-radius: 12px; padding: 18mm 14mm; margin: 6mm; position: relative; }
      h1 { font-size: 20pt; color: #006749; margin-bottom: 2mm; }
      .school { font-size: 13pt; margin-bottom: 10mm; }
      .serial { position: absolute; top: 6mm; left: 8mm; font-size: 9pt; direction: ltr; }
      .body { font-size: 13.5pt; line-height: 2.2; text-align: justify; }
      .sign { margin-top: 16mm; display: flex; justify-content: space-around; font-size: 11pt; }
      .qr { margin-top: 8mm; font-size: 9pt; color: #5d6f66; }
    </style></head><body>
    <div class="frame">
      <span class="serial">${esc(c.serial)}</span>
      <div class="school">مدیریت محترم مدرسه</div>
      <h1>${esc(c.title)}</h1>
      <div class="body">${esc(c.body).replace(/\n/g, "<br/>")}</div>
      <div class="sign"><span>مهر و امضای مدیر</span><span>تاریخ صدور: ${new Date(c.issuedAt).toLocaleDateString("fa-IR")}</span></div>
      <div class="qr"><div style="display:inline-block">${qrSvgHtml(`${location.origin}/verify/${c.verifyCode}`)}</div><br/>کد استعلام اصالت: <b dir="ltr">${esc(c.verifyCode)}</b></div>
    </div>
    <script>setTimeout(() => window.print(), 300);</script>
    </body></html>`);
    w.document.close();
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader title="گواهی‌ها" desc="صدور گواهی تحصیل/افتخار/انتقال با کد استعلام QR" />
      {/* راند ۱۹: مهار موبایل — مثل reports، تب‌ها با اسکرول افقی جای overflow صفحه */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        <button onClick={() => setTab("issue")} className={`b-pill-tab ${tab === "issue" ? "b-pill-tab-active" : ""}`}>صدور</button>
        <button onClick={() => setTab("list")} className={`b-pill-tab ${tab === "list" ? "b-pill-tab-active" : ""}`}>صادرشده‌ها ({faNumber(certs.length)})</button>
        <button onClick={() => setTab("templates")} className={`b-pill-tab ${tab === "templates" ? "b-pill-tab-active" : ""}`}>قالب‌ها ({faNumber(templates.length)})</button>
      </div>

      {tab === "issue" && (
        <div className="b-card-md p-5 grid gap-3 max-w-2xl">
          <Select
            value={issueForm.studentId}
            onChange={(v) => setIssueForm({ ...issueForm, studentId: v })}
            options={[{ value: "", label: "دانش‌آموز *" }, ...students.map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}${s.class ? ` (${s.class.name})` : ""}` }))]}
            placeholder="دانش‌آموز *"
            className="w-full"
            buttonClassName="!w-full"
          />
          <Select
            value={issueForm.templateId}
            onChange={(v) => setIssueForm({ ...issueForm, templateId: v, body: "" })}
            options={[{ value: "", label: "قالب…" }, ...templates.map((t) => ({ value: t.id, label: `${t.title} (${KINDS[t.kind]})` }))]}
            placeholder="قالب…"
            className="w-full"
            buttonClassName="!w-full"
          />
          <textarea value={issueForm.body} onChange={(e) => setIssueForm({ ...issueForm, body: e.target.value })} placeholder="متن گواهی — یا قالب انتخاب کنید (متغیرها: {{student_name}} {{father_name}} {{national_id}} {{student_number}} {{class_name}} {{grade}} {{school_name}})" className="b-input !min-h-[120px]" />
          <button onClick={issue} className="b-btn b-btn-spring w-fit"><Award className="w-4 h-4" /> صدور گواهی</button>
        </div>
      )}

      {tab === "list" && (certs.length === 0 ? <EmptyState icon={Award} title="گواهی صادر نشده" /> : (
        <div className="flex flex-col gap-2.5">
          {certs.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`b-card-sm p-4 flex items-center gap-3 flex-wrap ${c.revokedAt ? "opacity-50" : ""}`}>
              <FileCheck2 className="w-5 h-5 text-spring shrink-0" />
              <span className="text-[13px] font-bold">{c.title}</span>
              <span className="text-[12px] text-steel">{c.student.user.firstName} {c.student.user.lastName}</span>
              <span className="text-[10.5px] text-stone" dir="ltr">{c.serial}</span>
              <span className="text-[10.5px] text-stone">{formatDateFa(c.issuedAt)}</span>
              {c.revokedAt && <span className="b-badge b-badge-critical">باطل‌شده</span>}
              <span className="flex items-center gap-1.5 ms-auto">
                <span className="b-badge b-badge-spring" dir="ltr">QR: {c.verifyCode}</span>
                <button onClick={() => printCert(c)} className="b-btn b-btn-sm b-btn-ghost !min-h-[28px] !text-[10px] !px-2 !py-0"><Printer className="w-3.5 h-3.5" /> چاپ</button>
                {!c.revokedAt && canRevoke && <button onClick={() => revoke(c.id)} className="b-btn b-btn-sm b-btn-ghost !min-h-[28px] !text-[10px] !px-2 !py-0 !text-destructive"><Ban className="w-3.5 h-3.5" /> ابطال</button>}
              </span>
            </motion.div>
          ))}
        </div>
      ))}

      {tab === "templates" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="b-card-md p-5 flex flex-col gap-3">
            <h3 className="font-bold">قالب جدید</h3>
            <Select
              value={tplForm.kind}
              onChange={(v) => setTplForm({ ...tplForm, kind: v })}
              options={Object.entries(KINDS).map(([k, v]) => ({ value: k, label: v }))}
              className="w-full"
              buttonClassName="!w-full"
            />
            <input value={tplForm.title} onChange={(e) => setTplForm({ ...tplForm, title: e.target.value })} placeholder="عنوان قالب *" className="b-input" />
            <textarea value={tplForm.bodyTemplate} onChange={(e) => setTplForm({ ...tplForm, bodyTemplate: e.target.value })} placeholder="متن قالب با متغیرها" className="b-input !min-h-[160px]" />
            <button onClick={addTemplate} className="b-btn b-btn-sm b-btn-spring w-fit"><Plus className="w-4 h-4" /> افزودن قالب</button>
          </div>
          <div className="flex flex-col gap-2.5">
            {templates.map((t) => (
              <div key={t.id} className="b-card-sm p-4 group">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="b-badge b-badge-spring">{KINDS[t.kind]}</span>
                  <span className="text-[13px] font-bold flex-1">{t.title}</span>
                  <button onClick={async () => { if (!(await confirm({ title: "حذف قالب گواهی", description: "این قالب گواهی حذف شود؟", confirmLabel: "حذف", danger: true }))) return; apiDelete(`/api/certificates?template=${t.id}`).then(load).catch((e) => toast.error(e instanceof Error ? e.message : "خطا در حذف قالب")); }} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 text-stone hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
                <p className="text-[11px] text-steel line-clamp-3 leading-relaxed">{t.bodyTemplate}</p>
              </div>
            ))}
            {templates.length === 0 && <p className="t-sm text-steel">قالبی ساخته نشده — متن پیش‌فرض آماده است.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
