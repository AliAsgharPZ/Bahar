"use client";

/* ============================================================
   بهار | کارت OTP (راند ۱۸) — ورود دومرحله‌ای با کد یکبارمصرف
   ایمیل/پیامک. دیفالت خاموش؛ سوپرادمین فعالش می‌کند. حالت تست
   بدون سرویس ارسال کار می‌کند (کد در فرم ورود نمایش داده می‌شود).
   ============================================================ */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Smartphone, Loader2, Save, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { apiGet, apiPut } from "@/lib/client";
import { Select } from "@/components/shared/pickers";

type OtpSettings = {
  otpEnabled: boolean;
  otpChannel: "email" | "sms";
  otpTestMode: boolean;
  otpEmailApiUrl: string;
  otpEmailApiKey: string;
  otpEmailFrom: string;
  otpSmsApiUrl: string;
  otpSmsApiKey: string;
  otpSmsSender: string;
};

const CHANNEL_OPTIONS = [
  { value: "email", label: "ایمیل" },
  { value: "sms", label: "پیامک" },
];

export function OtpCard({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<OtpSettings | null>(null);
  const [emailKeyInput, setEmailKeyInput] = useState("");
  const [smsKeyInput, setSmsKeyInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ settings: OtpSettings }>("/api/settings")
      .then((d) => setForm(d.settings))
      .catch(() => {});
  }, []);

  if (!form) return null;

  const set = <K extends keyof OtpSettings>(k: K, v: OtpSettings[K]) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    setSaving(true);
    try {
      await apiPut("/api/settings", {
        otpEnabled: form.otpEnabled,
        otpChannel: form.otpChannel,
        otpTestMode: form.otpTestMode,
        otpEmailApiUrl: form.otpEmailApiUrl,
        ...(emailKeyInput ? { otpEmailApiKey: emailKeyInput } : {}),
        otpEmailFrom: form.otpEmailFrom,
        otpSmsApiUrl: form.otpSmsApiUrl,
        ...(smsKeyInput ? { otpSmsApiKey: smsKeyInput } : {}),
        otpSmsSender: form.otpSmsSender,
      });
      toast.success("تنظیمات کد یکبارمصرف ذخیره شد.");
      setEmailKeyInput("");
      setSmsKeyInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="b-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-[13.5px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-spring" /> ورود دومرحله‌ای با کد یکبارمصرف (ایمیل/پیامک)
        </b>
        <span className={`b-badge ${form.otpEnabled ? "b-badge-spring" : "b-badge-neutral"} ms-auto`}>
          {form.otpEnabled ? "فعال" : "خاموش (پیش‌فرض)"}
        </span>
      </div>
      <p className="t-sm text-steel leading-relaxed">
        وقتی روشن باشد، پس از رمزِ درست، یک کد ۶ رقمی به ایمیل یا موبایل کاربر ارسال می‌شود و ورود فقط با آن کد کامل می‌شود.
        کد ۵ دقیقه اعتبار دارد. کاربر باید ایمیل یا موبایل ثبت‌شده داشته باشد.
      </p>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => set("otpEnabled", !form.otpEnabled)}
          className={`b-option !items-start !py-3 flex-1 min-w-56 ${form.otpEnabled ? "b-option-selected" : ""}`}
          aria-pressed={form.otpEnabled}
        >
          <span className="flex flex-col items-start gap-0.5">
            <b className="text-[12.5px]">کد یکبارمصرف هنگام ورود</b>
            <span className="text-[10.5px] text-steel leading-relaxed">
              {form.otpEnabled ? "برای همه کاربران هنگام ورود فعال است." : "خاموش — ورود فقط با رمز (و 2FA فردی در صورت فعال‌سازی)."}
            </span>
          </span>
          <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${form.otpEnabled ? "bg-spring" : "bg-cloud"}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.otpEnabled ? "start-5" : "start-1"}`} />
          </span>
        </button>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => set("otpTestMode", !form.otpTestMode)}
          className={`b-option !items-start !py-3 flex-1 min-w-56 ${form.otpTestMode ? "b-option-selected" : ""}`}
          aria-pressed={form.otpTestMode}
        >
          <span className="flex flex-col items-start gap-0.5">
            <b className="text-[12.5px]">حالت تست (بدون سرویس ارسال)</b>
            <span className="text-[10.5px] text-steel leading-relaxed">
              {form.otpTestMode ? "کد در فرم ورود نمایش داده می‌شود — فقط برای آزمایش!" : "کد فقط از طریق سرویس واقعی ارسال می‌شود."}
            </span>
          </span>
          <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${form.otpTestMode ? "bg-warning" : "bg-cloud"}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.otpTestMode ? "start-5" : "start-1"}`} />
          </span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold">کانال ارسال</span>
          <Select
            value={form.otpChannel}
            onChange={(v) => set("otpChannel", v === "sms" ? "sms" : "email")}
            options={CHANNEL_OPTIONS}
            buttonClassName="!w-full"
            className="w-full"
            disabled={!canEdit}
          />
        </label>

        {form.otpChannel === "email" ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-spring" /> آدرس سرویس ایمیل (POST JSON)</span>
              <input className="b-input" dir="ltr" placeholder="https://api.resend.com/emails" value={form.otpEmailApiUrl} disabled={!canEdit} onChange={(e) => set("otpEmailApiUrl", e.target.value)} />
              <span className="text-[12px] text-stone">سازگار با Resend و سرویس‌های مشابه — هدر Authorization: Bearer.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">کلید API ایمیل</span>
              <input className="b-input" dir="ltr" type="password" autoComplete="off" placeholder={form.otpEmailApiKey ? "•••••• (ذخیره شده — برای تغییر وارد کنید)" : "re_…"} value={emailKeyInput} disabled={!canEdit} onChange={(e) => setEmailKeyInput(e.target.value)} />
              <span className="text-[12px] text-stone">خالی = بدون تغییر.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">فرستنده (From)</span>
              <input className="b-input" dir="ltr" placeholder='Bahar <onboarding@resend.dev>' value={form.otpEmailFrom} disabled={!canEdit} onChange={(e) => set("otpEmailFrom", e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-spring" /> آدرس سرویس پیامک (POST JSON)</span>
              <input className="b-input" dir="ltr" placeholder="https://api.sms.ir/v1/send" value={form.otpSmsApiUrl} disabled={!canEdit} onChange={(e) => set("otpSmsApiUrl", e.target.value)} />
              <span className="text-[12px] text-stone">متغیرهای {`{to}`} و {`{code}`} در آدرس هم جایگزین می‌شوند. بدنه JSON شامل to/text است.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">کلید API پیامک</span>
              <input className="b-input" dir="ltr" type="password" autoComplete="off" placeholder={form.otpSmsApiKey ? "•••••• (ذخیره شده — برای تغییر وارد کنید)" : "کلید سرویس پیامک"} value={smsKeyInput} disabled={!canEdit} onChange={(e) => setSmsKeyInput(e.target.value)} />
              <span className="text-[12px] text-stone">خالی = بدون تغییر.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">شماره فرستنده (اختیاری)</span>
              <input className="b-input" dir="ltr" placeholder="3000… " value={form.otpSmsSender} disabled={!canEdit} onChange={(e) => set("otpSmsSender", e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button className="b-btn b-btn-spring" onClick={save} disabled={saving || !canEdit}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره تنظیمات OTP
        </button>
        <span className="text-[12px] text-steel flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          توصیه: اول «حالت تست» را روشن کنید، یک ورود آزمایشی انجام دهید، بعد سرویس واقعی را تنظیم و حالت تست را خاموش کنید.
        </span>
      </div>
    </div>
  );
}
