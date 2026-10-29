"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Send, MessageCircle, ArrowRight, Search, Loader2, ExternalLink, Smartphone, ChevronDown,
} from "lucide-react";
import { useApi, usePolling, apiPost, ApiClientError } from "@/lib/client";
import { LoadingBlock, EmptyState, RoleBadge, ErrorBox } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useShellUser } from "@/components/app-shell/app-shell";
import type { AvatarParams } from "@/lib/avatar";
import { relativeTimeFa, formatTimeFa, formatDateFa, faNumber, enDigits } from "@/lib/persian";
import { ROLE_ORDER } from "@/lib/roles";
import { useLang } from "@/lib/i18n";

const ROLE_TKEY: Record<string, string> = { SUPER_ADMIN: "enum.role.SUPER_ADMIN", ADMIN: "enum.role.ADMIN", MANAGER: "enum.role.MANAGER", DEPUTY: "enum.role.DEPUTY", TEACHER: "enum.role.TEACHER", CUSTODIAN: "enum.role.CUSTODIAN", STUDENT: "enum.role.STUDENT", PARENT: "enum.role.PARENT" };

type AvatarFields = {
  profileImageType?: "upload" | "avatar" | null;
  photoUrl?: string | null;
  avatar?: AvatarParams | null;
};

type Thread = {
  partner: { id: string; firstName: string; lastName: string; role: string } & AvatarFields;
  lastMessage: { body: string; sentAt: string; mine: boolean } | null;
  unread: number;
};
type Contact = { id: string; firstName: string; lastName: string; role: string; shadNumber?: string | null; schoolName?: string | null } & AvatarFields;
type Msg = { id: string; senderId: string; recipientId: string; body: string; sentAt: string; readAt: string | null };

const SHAD_URL = "https://web.shad.ir";
const MAX_LEN = 400;

/** جداکننده روز بین پیام‌ها */
function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <span className="flex-1 h-px bg-hairline-soft" />
      <span className="text-[12px] text-stone bg-cloud rounded-full px-3 py-1">{formatDateFa(iso)}</span>
      <span className="flex-1 h-px bg-hairline-soft" />
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useLang();
  const [active, setActive] = useState<Contact | null>(null);
  const { user: shellUser } = useShellUser();
  // راند ۱۸: شاد اختیاری — لینک‌های شاد فقط وقتی دیده می‌شوند که ماژول فعال باشد
  const shadVisible = shellUser.schoolModules ? shellUser.schoolModules.shadEnabled !== false : true;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [q, setQ] = useState("");
  /** جستجوی داخل دیالوگ «گفتگوی جدید» (راند ۱۸) */
  const [contactQ, setContactQ] = useState("");
  /** گروه‌های جمع‌شده در دیالوگ مخاطبین */
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [showJump, setShowJump] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: threadsData, error: threadsError, refetch: refetchThreads } = usePolling<{ threads: Thread[] }>("/api/messages/threads", 6000);
  const { data: contactsData, error: contactsError } = useApi<{ contacts: Contact[] }>("/api/messages/contacts");
  const { data: chatData, error: chatError, refetch: refetchChat, setData: setChatData } = usePolling<{ messages: Msg[]; other: Contact; maxLen: number }>(
    active ? `/api/messages?withUserId=${active.id}` : null,
    5000
  );

  const threads = threadsData?.threads ?? [];
  const contacts = (contactsData?.contacts ?? []).filter((c) =>
    q ? `${c.firstName} ${c.lastName}`.includes(q) : true
  );
  const messages = chatData?.messages ?? [];

  /* راند ۱۸: دسته‌بندی مخاطبین دیالوگ «گفتگوی جدید» بر اساس نقش + جستجو */
  const contactGroups = useMemo(() => {
    const needle = contactQ.trim();
    const filtered = (contactsData?.contacts ?? []).filter((c) =>
      needle
        ? `${c.firstName} ${c.lastName}`.includes(needle) ||
          (ROLE_TKEY[c.role] ? t(ROLE_TKEY[c.role]) : "").includes(needle) ||
          (c.schoolName ?? "").includes(needle)
        : true
    );
    const groups: Array<{ key: string; label: string; items: typeof filtered }> = [];
    for (const role of ROLE_ORDER) {
      const items = filtered.filter((c) => c.role === role);
      if (items.length > 0) groups.push({ key: role, label: ROLE_TKEY[role] ? t(ROLE_TKEY[role]) : role, items });
    }
    // نقش‌های خارج از فهرست (مثل سرایدار جدید) هم دیده شوند
    for (const c of filtered) {
      if (!ROLE_ORDER.includes(c.role) && !groups.some((g) => g.key === c.role)) {
        const items = filtered.filter((x) => x.role === c.role);
        groups.push({ key: c.role, label: ROLE_TKEY[c.role] ? t(ROLE_TKEY[c.role]) : c.role, items });
      }
    }
    return groups;
  }, [contactsData, contactQ]);

  // اسکرول به پایین
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: messages.length > 30 ? "auto" : "smooth" });
    }
  }, [chatData?.messages?.length, active?.id]);

  useEffect(() => {
    if (active && chatData?.other) {
      setActive(chatData.other);
    }
  }, [chatData?.other, active]);

  // دکمه پرش به پایین وقتی کاربر بالا اسکرول کرده
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const far = el.scrollHeight - el.scrollTop - el.clientHeight > 300;
      setShowJump(far);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [chatData]);

  function pickContact(c: Contact) {
    setActive(c);
    setShowContacts(false);
    setText("");
    refetchThreads();
  }

  async function send() {
    if (!active || !text.trim()) return;
    const value = text.trim();
    if (value.length > MAX_LEN) {
      toast.custom((_toast) => (
        <div className="b-card-md !rounded-2xl p-4 max-w-sm">
          <b className="text-[13px] block mb-1">{t("messages.tooLong.before")} {faNumber(MAX_LEN)} {t("messages.tooLong.after")}</b>
          <p className="t-sm text-steel">{t("messages.lightNote")}</p>
          {shadVisible && (
            <a href={SHAD_URL} target="_blank" rel="noreferrer" className="b-btn b-btn-soft b-btn-sm mt-3">
              <Smartphone className="w-3.5 h-3.5" /> {t("messages.goToShad")}
            </a>
          )}
        </div>
      ));
      return;
    }
    setSending(true);
    try {
      await apiPost("/api/messages", { recipientId: active.id, body: value });
      setText("");
      refetchChat();
      refetchThreads();
    } catch (err) {
      if (err instanceof ApiClientError && err.shad) {
        toast.custom(() => (
          <div className="b-card-md !rounded-2xl p-4 max-w-sm">
            <b className="text-[13px] block mb-1">{t("messages.heavyContent")}</b>
            <p className="t-sm text-steel">{err.message}</p>
            {shadVisible && (
              <a href={SHAD_URL} target="_blank" rel="noreferrer" className="b-btn b-btn-soft b-btn-sm mt-3">
                <Smartphone className="w-3.5 h-3.5" /> {t("messages.goToShad")}
              </a>
            )}
          </div>
        ));
      } else {
        toast.error(err instanceof Error ? err.message : t("messages.error.send"));
      }
    } finally {
      setSending(false);
    }
  }

  // گروه‌بندی پیام‌ها بر اساس روز
  const dayGroups = useMemo(() => {
    const groups: Array<{ day: string; items: Msg[] }> = [];
    for (const m of messages) {
      const day = formatDateFa(m.sentAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  const totalUnread = threads.reduce((s, th) => s + th.unread, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* هدر ثابت صفحه (بدون ارتفاع ثابت کلی — رفع باگ اسکرول) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {t("messages.title")}
            {totalUnread > 0 && <span className="b-badge b-badge-critical">{faNumber(totalUnread)} {t("messages.unread")}</span>}
          </h1>
          <p className="t-sm text-steel">{t("messages.headerDesc")}{shadVisible ? t("messages.headerDesc.shad") : t("messages.headerDesc.internal")}.</p>
        </div>
        <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowContacts(true)}>
          <MessageCircle className="w-4 h-4" /> {t("messages.newChat")}
        </button>
      </div>

      {/* چیدمان دو ستونه — ارتفاع بر اساس ویوپورت با حداقل مطمئن */}
      <div className="flex gap-4 b-card-sm !p-0 overflow-hidden h-[calc(100vh-13rem)] min-h-[460px]">
        {/* فهرست گفتگوها */}
        <div className={`flex flex-col w-full sm:w-80 shrink-0 border-l border-hairline-soft ${active ? "hidden sm:flex" : "flex"}`}>
          <div className="p-3 border-b border-hairline-soft shrink-0">
            <div className="b-search-pill">
              <Search className="w-4 h-4 shrink-0" />
              <input className="b-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("messages.searchThreads")} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto b-scroll">
            {threadsError ? (
              <div className="p-4 text-center text-[12px] text-destructive">{threadsError}</div>
            ) : threads.length === 0 && (
              <p className="t-sm text-steel text-center py-10 px-4 leading-relaxed">
                {t("messages.noThreads.before")} «{t("messages.newChat")}» {t("messages.noThreads.after")}
              </p>
            )}
            {threads.map((th) => (
              <button
                key={th.partner.id}
                onClick={() => pickContact(th.partner)}
                className={`b-btn b-btn-ghost w-full text-right px-4 py-3.5 flex items-center gap-3 border-b border-hairline-soft/50 transition-colors ${
                  active?.id === th.partner.id ? "bg-spring-tint" : "hover:bg-cloud"
                }`}
              >
                <UserAvatar user={th.partner} size={40} />
                <span className="flex flex-col min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <b className="text-[13px] truncate">{th.partner.firstName} {th.partner.lastName}</b>
                    {th.lastMessage && <span className="text-[12px] text-stone shrink-0">{relativeTimeFa(th.lastMessage.sentAt)}</span>}
                  </span>
                  <span className={`text-[11.5px] truncate ${th.unread > 0 ? "text-ink font-bold" : "text-steel"}`}>
                    {th.lastMessage ? `${th.lastMessage.mine ? `${t("messages.you")} ` : ""}${th.lastMessage.body}` : "—"}
                  </span>
                </span>
                {th.unread > 0 && <span className="b-badge b-badge-critical !px-2 !text-[12px] shrink-0">{faNumber(th.unread)}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* گفتگو */}
        <div className={`flex-1 flex-col min-w-0 ${active ? "flex" : "hidden sm:flex"}`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState
                icon={MessageCircle}
                title={t("messages.empty.title")}
                desc={`${t("messages.emptyDesc.before")} «${t("messages.newChat")}» ${t("messages.emptyDesc.after")}`}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-hairline-soft shrink-0">
                <button className="sm:hidden b-btn b-btn-ghost !p-0 w-9 h-9 !min-h-9" onClick={() => setActive(null)} aria-label={t("common.back")}>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <UserAvatar user={active} size={40} />
                <span className="flex flex-col min-w-0">
                  <b className="text-[14px] truncate">{active.firstName} {active.lastName}</b>
                  <span className="text-[12px] text-steel">{ROLE_TKEY[active.role] ? t(ROLE_TKEY[active.role]) : active.role}</span>
                </span>
                {shadVisible && active.shadNumber && (
                  <a
                    href={SHAD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="b-btn b-btn-ghost b-btn-sm ms-auto !text-[12px] !min-h-9"
                    title={t("messages.shadChat")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> شاد
                  </a>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto b-scroll p-4 md:p-6 flex flex-col gap-1">
                {!chatData && !chatError && <LoadingBlock label={t("messages.loading")} />}
                {chatError && (
                  <div className="py-8 px-4">
                    <ErrorBox message={typeof chatError === "string" ? chatError : t("messages.error.load")} />
                    <button className="b-btn b-btn-sm b-btn-ghost mt-2" onClick={() => refetchChat()}>{t("common.retry")}</button>
                  </div>
                )}
                {chatData?.messages.length === 0 && (
                  <p className="t-sm text-steel text-center py-8">{t("messages.sendFirst")}</p>
                )}
                {chatData && dayGroups.map((g) => (
                  <div key={g.day} className="flex flex-col gap-2.5">
                    <DaySeparator iso={g.items[0].sentAt} />
                    {g.items.map((m) => {
                      const mine = m.senderId !== chatData.other.id;
                      return (
                        <div key={m.id} className={`flex flex-col max-w-[78%] sm:max-w-[70%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
                          <div className={`px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-line break-words ${mine ? "bubble-me" : "bubble-them"}`}>
                            {m.body}
                          </div>
                          <span className="text-[12px] text-stone mt-1 px-1 flex items-center gap-1">
                            {formatTimeFa(m.sentAt)}
                            {mine && !m.readAt && <span className="text-spring">· {t("messages.sent")}</span>}
                            {mine && m.readAt && <span className="text-spring">· {t("messages.read")}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />

                {showJump && (
                  <button
                    className="sticky bottom-2 ms-auto me-2 w-10 h-10 rounded-full bg-invert text-invert-foreground flex items-center justify-center shadow-lg b-pop"
                    onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
                    aria-label={t("messages.jumpToLatest")}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-3 md:p-4 border-t border-hairline-soft flex items-end gap-2.5 shrink-0">
                <div className="flex-1 flex flex-col gap-1">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={MAX_LEN + 50}
                    placeholder={t("messages.placeholder")}
                    className="b-input !min-h-11 resize-none"
                  />
                  <div className="flex items-center justify-between px-1">
                    {shadVisible ? (
                      <Link href={SHAD_URL} target="_blank" className="text-[12px] text-spring flex items-center gap-1 hover:underline">
                        <Smartphone className="w-3 h-3" /> {t("messages.longToShad")}
                      </Link>
                    ) : <span />}
                    <span className={`text-[12px] ${text.length > MAX_LEN ? "text-destructive font-bold" : "text-stone"}`}>
                      {faNumber(text.length)}/{faNumber(MAX_LEN)}
                    </span>
                  </div>
                </div>
                <button className="b-btn b-btn-spring !min-h-11 w-11 !px-0" onClick={send} disabled={sending || !text.trim()} aria-label={t("messages.send")}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* انتخاب مخاطب — راند ۱۸: جستجو + دسته‌بندی نقش‌محور */}
      {showContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setShowContacts(false)} aria-hidden />
          <div className="relative b-card p-0 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col b-pop">
            <div className="p-5 pb-3 shrink-0">
              <h2 className="font-bold text-lg mb-1">{t("messages.newChat")}</h2>
              <p className="t-sm text-steel mb-3">{t("messages.contactsNote")}</p>
              <div className="flex items-center gap-2 b-input !rounded-full !h-10 !px-4">
                <Search className="w-4 h-4 text-stone shrink-0" />
                <input
                  autoFocus
                  value={contactQ}
                  onChange={(e) => setContactQ(e.target.value)}
                  placeholder={t("messages.searchContacts")}
                  className="b-input flex-1 bg-transparent outline-none text-[13px] min-w-0"
                />
                {contactQ && (
                  <button onClick={() => setContactQ("")} className="b-btn b-btn-ghost text-stone hover:text-foreground text-[16px] leading-none shrink-0" aria-label={t("messages.clearSearch")}>
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto b-scroll px-5 pb-5">
              {contactsError && <p className="b-card-sm p-3 text-[12px] text-warning-deep">{t("messages.contactsLoadError")}: {contactsError}</p>}
              {contactGroups.length === 0 && !contactsError && (
                <p className="t-sm text-steel py-8 text-center">
                  {contactQ ? t("messages.noContactFound") : t("messages.noContacts")}
                </p>
              )}
              {contactGroups.map((g) => {
                const collapsed = collapsedGroups.includes(g.key);
                return (
                  <div key={g.key} className="mb-3">
                    <button
                      onClick={() =>
                        setCollapsedGroups((prev) =>
                          prev.includes(g.key) ? prev.filter((x) => x !== g.key) : [...prev, g.key]
                        )
                      }
                      className="b-btn b-btn-ghost w-full flex items-center gap-2 py-1.5 mb-1 text-start group"
                      aria-expanded={!collapsed}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-stone transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
                      />
                      <b className="text-[12.5px]">{g.label}</b>
                      <span className="b-badge b-badge-neutral !text-[12px] !px-1.5 !py-0">{faNumber(g.items.length)}</span>
                      <span className="flex-1 h-px bg-hairline-soft" />
                    </button>
                    {!collapsed && (
                      <div className="flex flex-col gap-2">
                        {g.items.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => pickContact(c)}
                            className="b-btn b-btn-ghost b-card-sm !rounded-xl p-3.5 flex items-center gap-3 text-right hover:border-spring/40 transition-colors"
                          >
                            <UserAvatar user={c} size={40} />
                            <span className="flex flex-col min-w-0 flex-1">
                              <b className="text-[13px] truncate">{c.firstName} {c.lastName}</b>
                              {c.schoolName && <span className="text-[12px] text-stone truncate">{c.schoolName}</span>}
                            </span>
                            <RoleBadge role={c.role} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
