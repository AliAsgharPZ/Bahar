"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LifeBuoy, Plus, Loader2, Send, CheckCircle2, RotateCcw, XCircle, Clock, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatusBadge } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateTimeFa, relativeTimeFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

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

const STATUS_TKEY: Record<string, string> = { OPEN: "dashboard.ticket.open", ANSWERED: "tickets.status.ANSWERED", CLOSED: "dashboard.ticket.closed" };
const PRIORITY_TKEY: Record<string, string> = { LOW: "tickets.priority.LOW", NORMAL: "tickets.priority.NORMAL", HIGH: "dashboard.urgent" };
const CATEGORY_TKEY: Record<string, string> = {
  GENERAL: "settings.general", TECHNICAL: "tickets.category.TECHNICAL", BILLING: "tickets.category.BILLING",
  SUGGESTION: "tickets.category.SUGGESTION",
};

export default function TicketsPage() {
  const { t } = useLang();
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
      toast.success(t("tickets.toast.created"));
      setShowCreate(false);
      setForm({ subject: "", category: "GENERAL", priority: "NORMAL", message: "" });
      setScope("mine");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
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
      if (!res.ok || !json?.tickets) throw new Error(json?.error?.message ?? t("tickets.error.load"));
      const updated = (json.tickets as Ticket[]).find((t) => t.id === openTicket.id);
      if (updated) setOpenTicket({ ...updated, messages: updated.messages });
      refetch();
      toast.success(t("tickets.toast.replySent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setReplying(false);
    }
  }

  async function changeStatus(tk: Ticket, newStatus: string) {
    try {
      await apiPatch(`/api/tickets/${tk.id}`, { status: newStatus });
      toast.success(t("tickets.toast.statusChanged"));
      setOpenTicket(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.tickets")}
        desc={t("tickets.desc")}
        action={
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> {t("tickets.newTicket")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <button className={`b-pill-tab ${scope === "mine" ? "b-pill-tab-active" : ""}`} onClick={() => setScope("mine")}>
          {t("tickets.mine")}
        </button>
        {isStaff && (
          <button className={`b-pill-tab ${scope === "all" ? "b-pill-tab-active" : ""}`} onClick={() => setScope("all")}>
            {t("tickets.queue")}
          </button>
        )}
        <span className="w-px h-6 bg-hairline mx-1" />
        {["", "OPEN", "ANSWERED", "CLOSED"].map((st) => (
          <button
            key={st || "all"}
            className={`b-pill-tab ${status === st ? "b-pill-tab-active" : ""}`}
            onClick={() => setStatus(st)}
          >
            {st ? (STATUS_TKEY[st] ? t(STATUS_TKEY[st]) : st) : t("common.all")}
          </button>
        ))}
        {category && (
          <button className="b-pill-tab b-pill-tab-active" onClick={() => setCategory("")} title={t("tickets.clearCategoryFilter")}>
            {CATEGORY_TKEY[category] ? t(CATEGORY_TKEY[category]) : category} ✕
          </button>
        )}
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.tickets.length === 0 && (
        <EmptyState
          icon={LifeBuoy}
          title={t("dashboard.empty.noTicket")}
          desc={t("tickets.empty.desc")}
          action={<button className="b-btn b-btn-spring b-btn-sm mt-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t("tickets.newTicket")}</button>}
        />
      )}

      {data && data.tickets.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.tickets.map((tk) => (
            <button
              key={tk.id}
              className="b-btn b-btn-ghost b-card-sm p-4 flex flex-wrap items-center gap-3 text-right hover:border-spring/40 transition-colors"
              onClick={() => setOpenTicket({ ...tk, messages: tk.messages })}
            >
              <span className="font-mono text-[12px] text-stone shrink-0" dir="ltr">{tk.code}</span>
              <span className="b-badge b-badge-soft shrink-0">{tk.categoryLabel}</span>
              <b className="text-[13.5px] truncate min-w-0 flex-1">{tk.subject}</b>
              {scope === "all" && tk.requester && (
                <span className="text-[12px] text-steel truncate hidden md:inline">
                  {tk.requester.name}{tk.requester.schoolName ? ` · ${tk.requester.schoolName}` : ""}
                </span>
              )}
              {tk.priority === "HIGH" && <span className="b-badge b-badge-critical shrink-0">{t("dashboard.urgent")}</span>}
              <span className={`b-badge shrink-0 ${tk.status === "OPEN" ? "b-badge-warning" : tk.status === "ANSWERED" ? "b-badge-spring" : "b-badge-neutral"}`}>
                {STATUS_TKEY[tk.status] ? t(STATUS_TKEY[tk.status]) : tk.status}
              </span>
              <span className="text-[12px] text-stone shrink-0">{relativeTimeFa(tk.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ───── ساخت تیکت ───── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-lg b-pop">
            <h2 className="font-bold text-lg mb-1">{t("tickets.newTicket")}</h2>
            <p className="t-sm text-steel mb-6">{t("tickets.threadNote")}</p>
            <form onSubmit={create} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("tickets.field.subject")}</span>
                <input className="b-input" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} required placeholder={t("tickets.placeholder.subject")} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("tickets.field.category")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.category}
                    onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                    options={Object.entries(CATEGORY_TKEY).map(([k, key]) => ({ value: k, label: t(key) }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("tickets.field.priority")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.priority}
                    onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                    options={[{ value: "LOW", label: t("tickets.priority.LOW") }, { value: "NORMAL", label: t("tickets.priority.NORMAL") }, { value: "HIGH", label: t("dashboard.urgent") }]}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">{t("tickets.field.message")}</span>
                <textarea rows={5} className="b-input !rounded-2xl resize-none" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} required placeholder={t("tickets.placeholder.message")} />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} {t("tickets.submit")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)}>{t("common.cancel")}</button>
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
                  <span dir="ltr" className="font-mono">{openTicket.code}</span> · {openTicket.categoryLabel} · {PRIORITY_TKEY[openTicket.priority] ? t(PRIORITY_TKEY[openTicket.priority]) : openTicket.priority}
                  {scope === "all" && openTicket.requester ? ` · ${openTicket.requester.name}` : ""}
                </span>
              </div>
              <span className="flex gap-1 shrink-0">
                <button className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-cloud" aria-label={t("tickets.deleteTicket")}
                  onClick={async () => { if (!window.confirm(t("tickets.deleteConfirm"))) return; try { await apiDelete(`/api/tickets/${openTicket.id}`); toast.success(t("tickets.toast.deleted")); setOpenTicket(null); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:bg-cloud shrink-0" onClick={() => setOpenTicket(null)} aria-label={t("common.close")}>
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
                  <span className="text-[12px] text-stone mt-1 px-1">
                    {m.fromAdmin ? t("tickets.support") : m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : t("dashboard.unit.user")} · {formatDateTimeFa(m.createdAt)}
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
                      placeholder={t("tickets.placeholder.reply")}
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
                    title={t("tickets.closeTicket")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {t("common.close")}
                  </button>
                </>
              ) : (
                <>
                  <span className="b-badge b-badge-neutral">{t("tickets.closedNotice")}</span>
                  <button className="b-btn b-btn-soft b-btn-sm" onClick={() => changeStatus(openTicket, "OPEN")}>
                    <RotateCcw className="w-3.5 h-3.5" /> {t("tickets.reopen")}
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
