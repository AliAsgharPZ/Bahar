"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Send, Loader2, CheckCircle2, XCircle, Smartphone, RefreshCw, Eye, EyeOff,
  KeyRound, ChevronDown, ServerCog, ExternalLink, ShieldCheck, Info,
} from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, StatCard, EmptyState } from "@/components/shared/bits";
import { useConfirm } from "@/components/shared/pickers";
import { formatDateTimeFa, faNumber, enDigits } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Status = {
  connected: boolean; status: string; mode: "NONE" | "INTERNAL" | "EXTERNAL";
  phone: string | null; accountName: string | null; expiresAt: string | null;
  gateway?: { online: boolean }; shadEnabled?: boolean;
};
type Outbox = {
  id: string; recipientName: string | null; recipientShadNumber: string;
  body: string; purpose: string; status: string; error: string | null;
  sentAt: string | null; createdAt: string;
};
type Me = {
  user: {
    role: string; permissions: string[]; school: { name: string } | null; schoolName: string | null;
    /** راند ۱۹-a: مدرسهٔ فعال سوپرادمین/ادمین (پنل مدرسه) — برای گیت فرم‌های مدیر */
    actingSchool?: { id: string; name?: string } | null;
  };
};

export default function ShadPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  /* FIX (راند ۱۹-a): سوپرادمین/ادمین داخل «پنل مدرسه» (actingSchool) باید فرم‌های
     مدیریت شاد را ببینند — قبلاً فقط نقش MANAGER می‌دید و نقش سرویسِ درون پنل
     نه فرم اتصال داشت و نه دکمه‌های ارسال/قطع (گزارش کاربر: «شاد درست کار نمی‌کند»). */
  const inSchoolPanel =
    (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN") && !!me?.user.actingSchool;
  const isManager = me?.user.role === "MANAGER" || inSchoolPanel;
  // ارسال اعتبارنامه — مثل API: مدیر (یا نقش سرویس در پنل)، یا معاون با دسترسی send_shad
  const canDeliver =
    isManager ||
    (me?.user.role === "DEPUTY" && (me?.user.permissions ?? []).includes("send_shad"));
  const { data: status, error: statusError, refetch: refetchStatus } = useApi<Status>("/api/shad/status");
  const { data: outbox, error: outboxError, refetch: refetchOutbox } = useApi<{ outbox: Outbox[] }>("/api/shad/outbox");
  const loadError = statusError ?? outboxError ?? "";

  const confirm = useConfirm();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBody, setShowBody] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  /* ── اتصال داخلی: auth.sendCode → نمایش کد → auth.signIn ── */
  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<{ code: string }>("/api/shad/send-code", { phone: enDigits(phone) });
      setSentCode(res.code);
      setStage("code");
      toast.success(t("shad.kd-tayyd-5-rqmy-sadr-shd-mhlt-5-dqyqh"));
      refetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBusy(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/shad/sign-in", { phone: enDigits(phone), code: enDigits(code) });
      toast.success(t("shad.bh-hsab-shad-mdrsh-mtsl-shdyd-arsal-aatbarnamh-faal-ast"));
      setStage("phone");
      setCode("");
      setSentCode(null);
      refetchStatus();
      refetchOutbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setBusy(true);
    try {
      const res = await apiPost<{ code: string }>("/api/shad/send-code", { phone: enDigits(phone) });
      setSentCode(res.code);
      toast.success(t("shad.kd-tayyd-jdyd-sadr-shd"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBusy(false);
    }
  }

  async function bulkDeliver() {
    setBulkBusy(true);
    try {
      const res = await apiPost<{
        results: Array<{ name: string; ok: boolean; error?: string }>;
        sweep?: { sent: number; failed: number; skipped: number; remaining: number } | null;
      }>("/api/shad/deliver", { allPending: true });
      const ok = res.results.filter((r) => r.ok).length + (res.sweep?.sent ?? 0);
      const fail = res.results.length - res.results.filter((r) => r.ok).length;
      const remaining = res.sweep?.remaining ?? 0;
      if (fail > 0 || remaining > 0) {
        toast.warning(
          `${faNumber(ok)} ${t("shad.pyam-arsal-shd")}` +
          (fail > 0 ? ` · ${faNumber(fail)} ${t("dashboard.login.failed")}` : "") +
          (remaining > 0 ? ` · ${faNumber(remaining)} ${t("shad.hmchnan-dr-sf")}` : "")
        );
      } else {
        toast.success(`${faNumber(ok)} ${t("shad.aatbarnamh-arsal-shd")}`);
      }
      refetchOutbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBulkBusy(false);
    }
  }

  async function revoke() {
    if (!(await confirm({ title: t("shad.qta-atsal-shad"), description: t("shad.atsal-hsab-shad-mdrsh-qta-shvd-arsal-rmz-v-pyam-ta-atsal-mjdd-gh"), confirmLabel: t("shad.qta-atsal"), danger: true }))) return;
    setBusy(true);
    try {
      await apiPost("/api/shad/revoke", {});
      toast.success(t("shad.atsal-shad-qta-shd"));
      setStage("phone");
      setSentCode(null);
      refetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBusy(false);
    }
  }

  const sent = outbox?.outbox.filter((o) => o.status === "SENT") ?? [];
  const failed = outbox?.outbox.filter((o) => o.status !== "SENT") ?? [];
  const gatewayOnline = status?.gateway?.online === true;
  const pendingCount = outbox?.outbox.filter((o) => o.status === "QUEUED").length ?? 0;
  const shadDisabled = status?.shadEnabled === false;
  const isInternal = status?.mode === "INTERNAL";
  const isExternal = status?.mode === "EXTERNAL";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.shad")}
        desc={t("shad.arsal-nam-karbry-v-rmz-abvr-karbran-bh-shmarh-shadshan-az-tryq-h")}
      />

      {loadError && <ErrorBox message={loadError} />}
      {!status && !loadError && <LoadingBlock />}

      {/* شاد برای این مدرسه خاموش است (راند ۱۸) */}
      {shadDisabled && (
        <div className="b-card-md p-6 md:p-8 flex items-start gap-3">
          <span className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <ServerCog className="w-6 h-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <b className="text-[16px]">{t("shad.qablyt-shad-dr-ayn-mdrsh-ghyrfaal-ast")}</b>
            <p className="t-sm text-steel leading-7">
              {t("shad.mdyr-my-tvand-an-ra-az-mdars-vyraysh-mdrsh-dvbarh-rvshn-knd-ta-a")}
            </p>
          </div>
        </div>
      )}

      {/* وضعیت اتصال */}
      {!shadDisabled && (
        <div className={`b-card-md p-6 md:p-8 flex flex-col gap-4 ${status?.connected ? "b-card-tint !border-spring/30" : ""}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`w-12 h-12 rounded-full flex items-center justify-center ${status?.connected ? "bg-spring text-primary-foreground" : "bg-destructive/10 text-destructive"}`}>
              <Smartphone className="w-6 h-6" />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-[16px]">
                  {status?.connected ? t("shad.hsab-shad-mdrsh-mtsl-ast") : t("shad.hsab-shad-mtsl-nyst")}
                </b>
                {status?.connected && (
                  <span className={`b-badge ${isInternal ? "b-badge-warning" : "b-badge-success"}`}>
                    {isInternal ? t("shad.shbyh-sazy-dakhly") : t("shad.drvazh-vaqay")}
                  </span>
                )}
              </div>
              <span className="t-sm text-steel">
                {status?.connected
                  ? `${status.accountName ? `${status.accountName} · ` : ""}${status.phone ?? ""}${status.expiresAt ? ` · تا ${formatDateTimeFa(status.expiresAt)}` : ""}`
                  : t("shad.bray-arsal-rmz-v-pyam-mdyr-ba-shmarh-shad-khvd-vard-shvd-kd-tayy")}
              </span>
            </div>
          </div>

          {/* توضیح حالت اتصال */}
          {status?.connected && isInternal && (
            <div className="b-card-sm !rounded-2xl !border-spring/25 bg-spring/5 px-4 py-3 flex items-start gap-2.5">
              <Info className="w-5 h-5 text-spring shrink-0 mt-0.5" />
              <p className="t-sm leading-7">
                {t("shad.shbkh-shad-bh-svrt")} <b>{t("shad.shbyh-sazy-dakhly-bhar")}</b> {t("shad.kar-my-knd")}: {t("shad.pyam-ha-dr-sf-khrvjy-hmyn-ja-thvyl-v-sbt-my-shvnd-v-bh-tlfn-vaqa")}{" "}
                <span dir="ltr" className="font-mono">mini-services/shad-gateway</span>{" "}
                {t("shad.ra-rvy-srvr-ajra-knyd-v-ba-tvkn-web-shad-ir-vsl-shvyd")}
              </p>
            </div>
          )}

          {/* فرم اتصال داخلی (فقط مدیر) */}
          {isManager && !status?.connected && stage === "phone" && (
            <>
              <div className="b-divider" />
              <form onSubmit={requestCode} className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("shad.shmarh-shad-mdyr-mdrsh")}</span>
                  <input
                    className="b-input !w-44"
                    dir="ltr"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09…"
                    required
                  />
                </label>
                <button type="submit" disabled={busy} className="b-btn b-btn-spring">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} {t("shad.dryaft-kd-tayyd")}
                </button>
                <p className="t-sm text-steel basis-full">
                  {t("shad.kd-tayyd-5-rqmy-ba-mhlt-5-dqyqh-sadr-my-shvd-v-hmyn-ja-bh-shma-n")}
                </p>
              </form>
            </>
          )}

          {isManager && !status?.connected && stage === "code" && (
            <>
              <div className="b-divider" />
              <form onSubmit={signIn} className="flex flex-col gap-3">
                <div className="b-card-tint !rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                  <KeyRound className="w-5 h-5 text-spring shrink-0" />
                  {sentCode ? (
                    <p className="t-sm">
                      {t("shad.kd-tayyd")} ({t("shad.arsal-shdh-bh-ap-shad-shma")}):{" "}
                      <b dir="ltr" className="font-mono text-[16px] tracking-[0.3em]">{sentCode}</b>
                    </p>
                  ) : (
                    <p className="t-sm">{t("shad.kd-tayyd-ra-kh-pysh-tr-grftyd-vard-knyd-agr-kd-ra-ndaryd-dvbarh")}</p>
                  )}
                  <button type="button" onClick={resendCode} disabled={busy} className="b-btn b-btn-ghost b-btn-sm ms-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> {t("shad.kd-jdyd")}
                  </button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">{t("shad.kd-tayyd-5-rqmy")}</span>
                    <input
                      className="b-input !w-36 text-center font-mono tracking-[0.3em]"
                      dir="ltr"
                      inputMode="numeric"
                      maxLength={5}
                      value={code}
                      onChange={(e) => setCode(enDigits(e.target.value).replace(/\D/g, "").slice(0, 5))}
                      placeholder={t("shad.5-rqm")}
                      required
                    />
                  </label>
                  <button type="submit" disabled={busy || code.length !== 5} className="b-btn b-btn-spring">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t("shad.vrvd-v-atsal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStage("phone"); setSentCode(null); setCode(""); }}
                    className="b-btn b-btn-ghost b-btn-sm"
                  >
                    {t("shad.tghyyr-shmarh")}
                  </button>
                </div>
              </form>
            </>
          )}

          {canDeliver && status?.connected && (
            <div className="flex flex-wrap items-center gap-3">
              <button className="b-btn b-btn-soft b-btn-sm" onClick={bulkDeliver} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {t("shad.arsal-aatbarnamh-hay-dr-antzar")}
                {pendingCount > 0 && ` (${faNumber(pendingCount)})`}
              </button>
              {isManager && (
                <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={revoke} disabled={busy}>
                  <XCircle className="w-4 h-4" /> {t("shad.qta-atsal")}
                </button>
              )}
              <p className="t-sm text-steel basis-full">
                {t("shad.ba-sakht-hr-karbr-jdyd-daray-shmarh-shad-aatbarnamh-ash")} ({t("students.table.nationalId")} + {t("shad.rmz-tsadfy")}) {t("shad.bh-tvr-khvdkar-arsal-my-shvd")}
              </p>
            </div>
          )}

          {!canDeliver && (
            <p className="t-sm text-steel">
              {t("shad.atsal-v-mdyryt-hsab-shad-br-ahdh-mdyr-mdrsh-ast-shma-my-tvanyd-g")}
            </p>
          )}

          {/* دروازهٔ واقعی — فقط وقتی دروازه روی سرور اجرا می‌شود */}
          {isManager && !status?.connected && gatewayOnline && <RealGatewayForm onConnected={() => { refetchStatus(); refetchOutbox(); }} />}
        </div>
      )}

      {/* آمار — تک‌ستونه در موبایل (همان الگوی راند ۱۹-b) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CheckCircle2} label={t("shad.arsal-mvfq")} value={sent.length} tone="spring" />
        <StatCard icon={XCircle} label={t("shad.namvfq-dr-antzar")} value={failed.length} tone="blossom" />
        <StatCard icon={Send} label={t("shad.mjmva-pyam-ha")} value={outbox?.outbox.length ?? 0} tone="ink" />
      </div>

      {/* گزارش ارسال */}
      <div>
        <h3 className="font-bold text-[16px] mb-3">{t("shad.gzarsh-pyam-hay-shad")}</h3>
        {loadError && <ErrorBox message={loadError} />}
        {!outbox && !loadError && <LoadingBlock />}
        {outbox && outbox.outbox.length === 0 && (
          <EmptyState icon={Send} title={t("shad.pyamy-arsal-nshdh")} desc={t("shad.ps-az-atsal-hsab-shad-aatbarnamh-ha-aynja-sbt-my-shvnd")} />
        )}
        {outbox && outbox.outbox.length > 0 && (
          <div className="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto b-scroll">
            {outbox.outbox.map((o) => (
              <div key={o.id} className="b-card-sm !rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`b-badge ${o.status === "SENT" ? "b-badge-success" : o.status === "QUEUED" ? "b-badge-warning" : "b-badge-critical"} shrink-0`}>
                      {o.status === "SENT" ? t("shad.arsal-shdh") : o.status === "QUEUED" ? t("dashboard.meeting.pending") : t("dashboard.login.failed")}
                    </span>
                    <b className="text-[14px] truncate">{o.recipientName ?? "—"}</b>
                    <span dir="ltr" className="font-mono text-[12px] text-steel">{o.recipientShadNumber}</span>
                  </div>
                  <button
                    className="b-btn b-btn-ghost !p-0 w-8 h-8 !min-h-8"
                    onClick={() => setShowBody(showBody === o.id ? null : o.id)}
                    aria-label={t("shad.mtn-pyam")}
                  >
                    {showBody === o.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {showBody === o.id && (
                  <pre className="t-sm text-steel whitespace-pre-wrap font-[inherit] mt-3 b-card-tint !rounded-2xl p-3.5 leading-relaxed" dir="rtl">
                    {o.body}
                  </pre>
                )}
                <div className="text-[12px] text-stone mt-2">
                  {o.sentAt ? formatDateTimeFa(o.sentAt) : formatDateTimeFa(o.createdAt)}
                  {o.error ? ` ${t("shad.khta")} ${o.error}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- اتصال واقعی با توکن web.shad.ir (اختیاری — وقتی دروازه اجرا می‌شود) ---------- */

function RealGatewayForm({ onConnected }: { onConnected: () => void }) {
  const { t } = useLang();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<{ account: { name: string; phone: string } }>("/api/shad/connect", {
        phone: enDigits(phone),
        token: token.trim(),
      });
      toast.success(`${t("shad.bh-hsab-shad-vaqay")} ${res.account.name || res.account.phone} ${t("shad.mtsl-shdyd")}`);
      setToken("");
      setPhone("");
      onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="b-divider" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="b-btn b-btn-ghost flex items-center gap-1.5 text-[12px] font-bold text-spring self-start"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        {t("shad.atsal-vaqay-ba-tvkn-shad")} ({t("shad.akhtyary-bray-arsal-bh-tlfn-hay-vaqay")})
      </button>
      {open && (
        <form onSubmit={connect} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("shad.shmarh-shad-mdyr-mdrsh")}</span>
              <input
                className="b-input !w-44"
                dir="ltr"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09…"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
              <span className="text-[12px] font-bold">{t("shad.tvkn-hsab-shad")} (auth)</span>
              <div className="relative">
                <input
                  className="b-input pr-10 pl-10 !font-mono !text-[12px]"
                  dir="ltr"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t("shad.az-web-shad-ir-kpy-knyd")}
                  autoComplete="off"
                  required
                />
                <button
                  type="button"
                  className="b-btn b-btn-ghost absolute left-3 top-1/2 -translate-y-1/2 text-stone hover:text-steel"
                  onClick={() => setShowToken((s) => !s)}
                  aria-label={t("shad.nmaysh-mkhfy-tvkn")}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
            <button type="submit" disabled={busy} className="b-btn b-btn-soft">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />} {t("shad.atsal-vaqay")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="b-btn b-btn-ghost flex items-center gap-1.5 text-[12px] font-bold text-spring self-start"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
            {t("shad.tvkn-shad-ra-chtvr-bgyrm")}
          </button>
          {guideOpen && (
            <ol className="b-card-tint !rounded-2xl p-4 flex flex-col gap-2 t-sm list-decimal list-inside leading-7">
              <li>
                {t("shad.rvy-kampyvtr-vard")}{" "}
                <a href="https://web.shad.ir" target="_blank" rel="noreferrer" className="text-spring underline underline-offset-4 inline-flex items-center gap-1">
                  web.shad.ir <ExternalLink className="w-3 h-3" />
                </a>{" "}
                {t("shad.shvyd")}
              </li>
              <li>{t("shad.klyd")} <b>F12</b> ({t("shad.ya-ctrl")}+Shift+I) {t("shad.ra-bznyd-ta-pnjrh-developer-tools-baz-shvd")}</li>
              <li>{t("shad.bh-tb")} <b>Network</b> {t("shad.brvyd")}</li>
              <li>{t("shad.dakhl-shad-yk-cht-ra-baz-knyd-ya-pyamy-bfrstyd-ta-drkhvast-ha-sb")}</li>
              <li>{t("shad.az-lyst-drkhvasty-ba-damnh")} <b>shadmessenger…</b> {t("shad.ra-antkhab-knyd")}</li>
              <li>{t("shad.dr-tb")} <b>Request</b> {t("shad.mqdar-fyld")} <b>auth</b> {t("shad.ra-kpy-v-hmyn-ja-jay-gzary-knyd")}</li>
            </ol>
          )}
        </form>
      )}
    </>
  );
}
