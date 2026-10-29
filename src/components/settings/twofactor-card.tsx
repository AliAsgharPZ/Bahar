"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Smartphone, Loader2, KeyRound, Copy, Check } from "lucide-react";
import { apiPost } from "@/lib/client";
import { toast } from "sonner";
import { faDigits } from "@/lib/persian";

// ============================================================
// بهار | کارت امنیت پروفایل — ورود دو مرحله‌ای (TOTP)
// راه‌اندازی: تولید رمز → اسکن QR با اپ احرازگر → تأیید اولین کد
// ۸ کد بازیابی فقط یک‌بار نمایش داده می‌شوند
// ============================================================

type Status = { enabled: boolean; hasSecret: boolean; backupRemaining: number };
type SetupData = { secret: string; uri: string; qrSvg: string };

export function TwoFactorCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"idle" | "setup" | "enabled">("idle");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const d = await apiPost<{ enabled: boolean; hasSecret: boolean; backupRemaining: number }>("/api/auth/2fa", { action: "status" });
      setStatus(d);
      setPhase(d.enabled ? "enabled" : "idle");
    } catch { /* ساکت */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const startSetup = useCallback(async () => {
    setBusy(true);
    try {
      const d = await apiPost<SetupData>("/api/auth/2fa", { action: "setup" });
      setSetup(d);
      setPhase("setup");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmEnable = useCallback(async () => {
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) return;
    setBusy(true);
    try {
      const d = await apiPost<{ enabled: boolean; backupCodes: string[] }>("/api/auth/2fa", { action: "enable", code: clean });
      setBackupCodes(d.backupCodes);
      setPhase("enabled");
      setCode("");
      setSetup(null);
      loadStatus();
    } catch (e) {
      window.dispatchEvent(new CustomEvent("bahar-toast-error", { detail: e instanceof Error ? e.message : "کد نادرست است" }));
    } finally {
      setBusy(false);
    }
  }, [code, loadStatus]);

  const disable = useCallback(async () => {
    if (!disablePassword || disableCode.length < 6) return;
    setBusy(true);
    try {
      await apiPost("/api/auth/2fa", { action: "disable", password: disablePassword, code: disableCode.replace(/\D/g, "") });
      setPhase("idle");
      setDisablePassword("");
      setDisableCode("");
      setBackupCodes(null);
      loadStatus();
      toast.success("ورود دو مرحله‌ای غیرفعال شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }, [disablePassword, disableCode, loadStatus]);

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    }).catch(() => {});
  }, []);

  return (
    <div className="b-card-md p-6 md:p-8">
      <h3 className="font-bold text-[16px] mb-2 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-spring" /> ورود دو مرحله‌ای (2FA)
      </h3>
      <p className="t-sm text-steel mb-5">
        با فعال‌سازی، بعد از رمز عبور یک کد ۶ رقمی از اپ احرازگر (Google Authenticator، Aegis، Microsoft Authenticator…) خواسته می‌شود.
        حساب شما حتی در صورت لو رفتن رمز، امن می‌ماند.
      </p>

      {/* وضعیت */}
      {status && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`b-badge ${status.enabled ? "b-badge-success" : "b-badge-neutral"}`}>
            {status.enabled ? "فعال" : "غیرفعال"}
          </span>
          {status.enabled && (
            <span className="b-badge b-badge-neutral">کدهای بازیابی باقی‌مانده: {faDigits(status.backupRemaining)}</span>
          )}
        </div>
      )}

      {/* مرحله راه‌اندازی */}
      {phase === "idle" && (
        <button className="b-btn b-btn-spring" onClick={startSetup} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} راه‌اندازی دو مرحله‌ای
        </button>
      )}

      {phase === "setup" && setup && (
        <div className="grid md:grid-cols-[auto_1fr] gap-5 items-start">
          {/* QR */}
          <div className="b-card-sm !rounded-2xl p-3 bg-white w-fit mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrSvg} alt="QR برای اپ احرازگر" className="w-44 h-44" />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[12px] text-steel leading-relaxed">
              ۱. اپ احرازگر را باز کنید و «افزودن حساب» → «اسکن کد QR» را بزنید.<br />
              ۲. کد ۶ رقمی نمایش‌داده‌شده در اپ را زیر وارد کنید.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">اگر QR خوانده نشد — رمز دستی:</span>
              <div className="flex gap-2">
                <code className="b-input !font-mono text-[12px] flex-1" dir="ltr">{setup.secret}</code>
                <button type="button" className="b-btn b-btn-soft b-btn-sm" onClick={() => copy(setup.secret, "secret")}>
                  {copied === "secret" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">کد تأیید *</span>
              <div className="flex gap-2">
                <input
                  className="b-input text-start !font-mono !tracking-[0.3em] flex-1"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="------"
                />
                <button type="button" className="b-btn b-btn-spring" onClick={confirmEnable} disabled={busy || code.replace(/\D/g, "").length !== 6}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} فعال‌سازی
                </button>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* کدهای بازیابی — فقط یک‌بار */}
      {backupCodes && (
        <div className="b-card-sm !rounded-2xl p-4 !border-warning/40 bg-warning/5 mt-4">
          <b className="block text-[14px] mb-1 text-warning-deep">کدهای بازیابی — همین حالا ذخیره کنید!</b>
          <p className="text-[12px] text-steel mb-3">
            اگر اپ احرازگر را گم کردید، با هرکدام از این ۸ کد می‌توانید یک‌بار وارد شوید. این کدها <b>دیگر هرگز نمایش داده نمی‌شوند</b>.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {backupCodes.map((c) => (
              <div key={c} className="flex items-center gap-1.5">
                <code className="b-input !font-mono !text-[12px] flex-1 text-center" dir="ltr">{c}</code>
                <button type="button" className="b-btn b-btn-soft b-btn-sm !min-h-[40px]" onClick={() => copy(c, c)}>
                  {copied === c ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
          <button className="b-btn b-btn-ghost b-btn-sm mt-3" onClick={() => setBackupCodes(null)}>ذخیره کردم — بستن</button>
        </div>
      )}

      {/* غیرفعال‌سازی */}
      {phase === "enabled" && (
        <div className="b-card-sm !rounded-2xl p-4 mt-2">
          <b className="block text-[14px] mb-3 flex items-center gap-2"><KeyRound className="w-4 h-4" /> غیرفعال‌سازی دو مرحله‌ای</b>
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">رمز عبور *</span>
              <input type="password" dir="ltr" className="b-input" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} autoComplete="current-password" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">کد فعلی احرازگر *</span>
              <input className="b-input text-start !font-mono" dir="ltr" inputMode="numeric" value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="------" />
            </label>
            <button className="b-btn b-btn-ghost !text-destructive" onClick={disable} disabled={busy || !disablePassword || disableCode.length < 6}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "غیرفعال‌سازی"}
            </button>
          </div>
          <p className="text-[12px] text-stone mt-2">برای امنیت، غیرفعال‌سازی هم رمز و هم یک کد معتبر می‌خواهد.</p>
        </div>
      )}
    </div>
  );
}
