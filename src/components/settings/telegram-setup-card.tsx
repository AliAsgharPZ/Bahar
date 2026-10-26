"use client";

/* ============================================================
   بهار | کارت راه‌اندازی ربات تلگرام (راند ۱۹)
   اتصال وب‌هوک مستقیم از پنل — دیگر نیازی به اجرای پروسهٔ
   جدا نیست؛ تلگرام خودش /api/telegram/webhook سایت را صدا
   می‌زند. وضعیت زنده: نام ربات، آدرس وب‌هوک، صف پیام‌ها،
   آخرین خطا.
   ============================================================ */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, PlugZap, Unplug, RefreshCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { faDigits } from "@/lib/persian";

type TgStatus = {
  configured: boolean;
  enabled: boolean;
  botOk: boolean;
  bot: { username: string | null; firstName: string | null } | null;
  botError: string | null;
  webhook: {
    url: string | null;
    pendingUpdates: number;
    lastError: string | null;
    lastErrorAt: string | null;
  };
  tokenMasked?: string | null;
};

export function TelegramSetupCard({ tokenSaved }: { tokenSaved: boolean }) {
  const [status, setStatus] = useState<TgStatus | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "connect" | "disconnect">("");

  const load = useCallback(async () => {
    setBusy("check");
    try {
      const d = await apiGet<TgStatus>("/api/telegram/setup");
      setStatus(d);
    } catch {
      setStatus(null);
    } finally {
      setBusy("");
    }
  }, []);

  // بارگذاری وضعیت وقتی توکن ذخیره‌شده در دسترس است
  useEffect(() => {
    if (tokenSaved) load();
  }, [tokenSaved, load]);

  async function connect() {
    setBusy("connect");
    try {
      const d = await apiPost<TgStatus & { ok?: boolean; webhookUrl?: string }>("/api/telegram/setup", { op: "connect" });
      setStatus(d);
      toast.success(`وب‌هوک ربات روی ${d.webhookUrl ?? "سایت"} ثبت شد. حالا در تلگرام /start بفرستید.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ثبت وب‌هوک ناموفق بود.");
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const d = await apiPost<TgStatus>("/api/telegram/setup", { op: "disconnect" });
      setStatus(d);
      toast.success("وب‌هوک حذف شد؛ ربات پیام‌ها را نمی‌گیرد (توکن و فعال‌بودن دست‌نخورده ماند).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حذف وب‌هوک ناموفق بود.");
    } finally {
      setBusy("");
    }
  }

  if (!tokenSaved) return null;

  const connected = !!status?.webhook?.url && status?.webhook.url.includes("/api/telegram/webhook");

  return (
    <div className="b-card-sm !rounded-2xl p-4 flex flex-col gap-3 bg-cloud/40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <b className="text-[12.5px] flex items-center gap-1.5">
          <Send className="w-4 h-4 text-spring" />
          اتصال ربات (وب‌هوک)
        </b>
        <div className="flex items-center gap-2">
          {status?.bot?.username && (
            <span className="b-badge b-badge-neutral !text-[10px]" dir="ltr">@{status.bot.username}</span>
          )}
          {connected ? (
            <span className="b-badge !bg-spring-tint !text-spring-deep !text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> متصل
            </span>
          ) : status ? (
            <span className="b-badge b-badge-warning !text-[10px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> قطع
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-[11px] text-steel leading-relaxed">
        با ثبت وب‌هوک، تلگرام مستقیم همین سایت را صدا می‌زند و نیازی به اجرای پروسهٔ جدا نیست.
        کاربران از پروفایل بهار «کد پیوند تلگرام» می‌گیرند و در تلگرام <b dir="ltr">/start کد</b> می‌فرستند.
      </p>

      {status?.botError && (
        <div className="b-promo !bg-warning/10 !text-warning-deep !text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="min-w-0">تلگرام پاسخ نداد: {status.botError} — اگر سرور در ایران است، دسترسی به api.telegram.org ممکن است مسدود باشد.</span>
        </div>
      )}
      {status?.webhook?.lastError && (
        <div className="b-promo !bg-destructive/10 !text-destructive !text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="min-w-0">آخرین خطای وب‌هوک: {status.webhook.lastError}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className="b-btn b-btn-spring !text-[12px]" onClick={connect} disabled={busy !== ""}>
          {busy === "connect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
          ثبت/به‌روزرسانی وب‌هوک
        </button>
        {connected && (
          <button className="b-btn b-btn-soft !text-[12px]" onClick={disconnect} disabled={busy !== ""}>
            {busy === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
            قطع وب‌هوک
          </button>
        )}
        <button className="b-btn b-btn-ghost !text-[12px]" onClick={load} disabled={busy !== ""}>
          {busy === "check" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          بررسی وضعیت
        </button>
        {status?.webhook && status.webhook.pendingUpdates > 0 && (
          <span className="text-[10.5px] text-stone">{faDigits(status.webhook.pendingUpdates)} پیام در صف تلگرام</span>
        )}
      </div>

      {status?.webhook?.url && (
        <p className="text-[10px] text-stone break-all" dir="ltr">{status.webhook.url}</p>
      )}
    </div>
  );
}
