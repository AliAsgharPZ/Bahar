"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LifeBuoy, Plus, Loader2, Send, CheckCircle2, RotateCcw, XCircle, Clock, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatusBadge } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateTimeFa, relativeTimeFa, faNumber } from "@/lib/persian";

type Ticket = {
  id: string;
  code: string;
  subject: string;
  category: string;
  categoryLabel: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  requester: { name: string; role: string; schoolName: string | null } | null;
  messageCount: number;
  lastReply: { body: string; fromAdmin: boolean; createdAt: string; sender: { firstName: string; lastName: string; role: string } | null } | null;
  messages: Array<{ id: string; body: string; fromAdmin: boolean; createdAt: string; sender: { firstName: string; lastName: string; role: string } | null }>;
};

const STATUS_LABELS: Record<string, string> = { OPEN: "باز", ANSWERED: "پاسخ داده‌شده", CLOSED: "بسته" };
const PRIORITY_LABELS: Record<string, string> = { LOW: "کم", NORMAL: "معمولی", HIGH: "فوری" };
const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "عمومی", TECHNICAL: "مشکل فنی", BILLING: "پرداخت و مالی",
  SUGGESTION: "پیشنهاد",
};

export default function TicketsPage() {
  const params = useSearchParams();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<string>("");
  // لینک عمیق دسته‌بندی (مثلاً از هشدارهای پنل: ?category=BILLING)
  const [category, setCategory] = useState<string>(params.get("category") ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "GENERAL", priority: "NORMAL", message: "" });
  const [saving, setSaving] = useState(false);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  const url = `/api/tickets?scope=${scope}${status ? `&status=${status}` : ""}${category ? `&category=${category}` : ""}`;
  const { data, loading, error, refetch } = useApi<{ tickets: Ticket[]; isStaff: boolean }>(url, [scope, status, category]);

  const isStaff = data?.isStaff ?? false;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/tickets", form);
      toast.success("تیکت ثبت شد؛ پشتیبانی بهار پاسخ می‌دهد.");
      setShowCreate(false);
      setForm({ subject: "", category: "GENERAL", priority: "NORMAL", message: "" });
      setScope("mine");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    if (!openTicket || !reply.trim()) return;
    setReplying(true);
    try {
      await apiPost(`/api/tickets/${openTicket.id}`, { body: reply });
      setReply("");
      const res = await fetch(`/api/tickets?scope=${scope}${category ? `&category=${category}` : ""}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.tickets) throw new Error(json?.error?.message ?? "خطا در دریافت تیکت");
      const updated = (json.tickets as Ticket[]).find((t) => t.id === openTicket.id);
      if (updated) setOpenTicket({ ...updated, messages: updated.messages });
      refetch();
      toast.success("پیام ارسال شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setReplying(false);
    }
  }

  async function changeStatus(t: Ticket, newStatus: string) {
    try {
      await apiPatch(`/api/tickets/${t.id}`, { status: newStatus });
      toast.success("وضعیت تیکت تغییر کرد.");
      setOpenTicket(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="پشتیبانی"
        desc="تیکت خود را ثبت کنید تا ادمین‌های سرویس بهار پاسخ دهند — از مشکل فنی تا درخواست مالی."
        action={
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> تیکت جدید
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button className={`b-pill-tab ${scope === "mine" ? "b-pill-tab-active" : ""}`} onClick={() => setScope("mine")}>
          تیکت‌های من
        </button>
        {isStaff && (
          <button className={`b-pill-tab ${scope === "all" ? "b-pill-tab-active" : ""}`} onClick={() => setScope("all")}>
            صف پشتیبانی
          </button>
        )}
        <span className="w-px h-6 bg-hairline mx-1" />
        {["", "OPEN", "ANSWERED", "CLOSED"].map((st) => (
          <button
            key={st || "all"}
            className={`b-pill-tab ${status === st ? "b-pill-tab-active" : ""}`}
            onClick={() => setStatus(st)}
          >
            {st ? STATUS_LABELS[st] : "همه"}
          </button>
        ))}
        {category && (
          <button className="b-pill-tab b-pill-tab-active" onClick={() => setCategory("")} title="حذف فیلتر دسته">
            {CATEGORY_LABELS[category] ?? category} ✕
          </button>
        )}
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.tickets.length === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title="تیکتی نیست"
          desc="تیکتی ثبت نشده است؛ هر وقت لازم شد تیکت جدید بزنید."
          action={<button className="b-btn b-btn-spring b-btn-sm mt-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> تیکت جدید</button>}
        />
      )}

      {data && data.tickets.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.tickets.map((t) => (
            <button
              key={t.id}
              className="b-card-sm p-4 flex flex-wrap items-center gap-3 text-right hover:border-spring/40 transition-colors"
              onClick={() => setOpenTicket({ ...t, messages: t.messages })}
            >
              <span className="font-mono text-[11px] text-stone shrink-0" dir="ltr">{t.code}</span>
              <span className="b-badge b-badge-soft shrink-0">{t.categoryLabel}</span>
              <b className="text-[13.5px] truncate min-w-0 flex-1">{t.subject}</b>
              {scope === "all" && t.requester && (
                <span className="text-[11px] text-steel truncate hidden md:inline">
                  {t.requester.name}{t.requester.schoolName ? ` · ${t.requester.schoolName}` : ""}
                </span>
              )}
              {t.priority === "HIGH" && <span className="b-badge b-badge-critical shrink-0">فوری</span>}
              <span className={`b-badge shrink-0 ${t.status === "OPEN" ? "b-badge-warning" : t.status === "ANSWERED" ? "b-badge-spring" : "b-badge-neutral"}`}>
                {STATUS_LABELS[t.status]}
              </span>
              <span className="text-[10.5px] text-stone shrink-0">{relativeTimeFa(t.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ───── ساخت تیکت ───── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-lg b-pop">
            <h2 className="font-bold text-lg mb-1">تیکت جدید</h2>
            <p className="t-sm text-steel mb-6">پاسخ در گفتگوی همین تیکت نمایش داده می‌شود.</p>
            <form onSubmit={create} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">موضوع *</span>
                <input className="b-input" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required placeholder="مثلا: خطا در ثبت حضور و غیاب" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">دسته</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">فوریت</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.priority}
                    onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                    options={[{ value: "LOW", label: "کم" }, { value: "NORMAL", label: "معمولی" }, { value: "HIGH", label: "فوری" }]}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">شرح *</span>
                <textarea rows={5} className="b-input !rounded-2xl resize-none" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} required placeholder="مشکل یا درخواست خود را کامل توضیح دهید…" />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} ثبت تیکت
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── گفتگوی تیکت ───── */}
      {openTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setOpenTicket(null)} aria-hidden />
          <div className="relative b-card p-0 w-full max-w-2xl max-h-[90vh] overflow-hidden b-pop flex flex-col">
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-hairline-soft">
              <div className="min-w-0">
                <b className="block text-[15px] truncate">{openTicket.subject}</b>
                <span className="text-[11.5px] text-steel">
                  <span dir="ltr" className="font-mono">{openTicket.code}</span> · {openTicket.categoryLabel} · {PRIORITY_LABELS[openTicket.priority]}
                  {scope === "all" && openTicket.requester ? ` · ${openTicket.requester.name}` : ""}
                </span>
              </div>
              <span className="flex gap-1 shrink-0">
                <button className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-cloud" aria-label="حذف تیکت"
                  onClick={async () => { if (!window.confirm("این تیکت و کل گفتگویش حذف شود؟")) return; try { await apiDelete(`/api/tickets/${openTicket.id}`); toast.success("تیکت حذف شد."); setOpenTicket(null); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}>
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:bg-cloud shrink-0" onClick={() => setOpenTicket(null)} aria-label="بستن">
                  <XCircle className="w-5 h-5" />
                </button>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto b-scroll p-5 flex flex-col gap-3 min-h-[240px]">
              {openTicket.messages.map((m) => (
                <div key={m.id} className={`flex flex-col max-w-[80%] ${m.fromAdmin ? "self-start items-start" : "self-end items-end"}`}>
                  <div className={`px-4 py-2.5 text-[13px] leading-relaxed ${m.fromAdmin ? "bubble-them !bg-spring-tint" : "bubble-me"}`}>
                    {m.body.split("\n").map((line, i) => (
                      <span key={i} className="block">{line || "‌"}</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-stone mt-1 px-1">
                    {m.fromAdmin ? "پشتیبانی بهار" : m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : "کاربر"} · {formatDateTimeFa(m.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-hairline-soft p-4 flex flex-wrap items-center gap-3">
              {openTicket.status !== "CLOSED" ? (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <textarea
                      rows={1}
                      className="b-input !min-h-11 resize-none"
                      placeholder="پاسخ خود را بنویسید…"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                  </div>
                  <button className="b-btn b-btn-spring !min-h-11" onClick={sendReply} disabled={replying || !reply.trim()}>
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />}
                  </button>
                  <button
                    className="b-btn b-btn-ghost b-btn-sm !text-steel"
                    onClick={() => changeStatus(openTicket, "CLOSED")}
                    title="بستن تیکت"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> بستن
                  </button>
                </>
              ) : (
                <>
                  <span className="b-badge b-badge-neutral">این تیکت بسته شده است</span>
                  <button className="b-btn b-btn-soft b-btn-sm" onClick={() => changeStatus(openTicket, "OPEN")}>
                    <RotateCcw className="w-3.5 h-3.5" /> بازگشایی
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
