"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, ArrowRight, KeyRound, IdCard, Lock, Sprout, Fingerprint } from "lucide-react";
import { loginWithPasskey, passkeySupported } from "@/lib/passkey-client";
import { apiGet, apiPost, ApiClientError } from "@/lib/client";
import { enDigits } from "@/lib/persian";
import { useCountry } from "@/lib/country/client";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LangProvider, useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { CaptchaField, type CaptchaValue } from "@/components/shared/captcha-field";

export default function LoginPage() {
  return (
    <LangProvider>
      <LoginForm />
    </LangProvider>
  );
}

function LoginForm() {
  const router = useRouter();
  const { t } = useLang();
  // شاد فقط بسته ایران — ریجن‌های دیگر هیچ نامی از آن در ورود ندارند
  const { country } = useCountry();
  const shadEnabled = country.modules.shad !== false;
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState("");

  // هویت بصری سفارشی (لوگوی سوپرادمین)
  useEffect(() => {
    apiGet<{ logoUrl: string }>("/api/public/branding")
      .then((d) => setLogoUrl(d.logoUrl || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiGet<{ user?: unknown }>("/api/auth/me")
      .then(() => router.replace("/app"))
      .catch(() => {});
  }, [router]);

  // ── مرحله دوم ورود (2FA) — راند ۱۶ ──
  const [pending2fa, setPending2fa] = useState<string | null>(null);
  const [code2fa, setCode2fa] = useState("");

  // ── مرحلهٔ کد یکبارمصرف (OTP) — راند ۱۸ ──
  const [pendingOtp, setPendingOtp] = useState<{ token: string; maskedTo: string | null; channel: string; devCode?: string } | null>(null);
  const [codeOtp, setCodeOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  // راند ۱۹: کپچای مرحلهٔ OTP — پس از کدهای اشتباه پیاپی (رفتار مشکوک)
  const [otpCaptchaRequired, setOtpCaptchaRequired] = useState(false);

  // ── کپچای امن (راند ۱۷) — پس از تلاش‌های ناموفق ظاهر می‌شود ──
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaValue>({ token: "", answer: "" });
  // با هر خطای کپچا epoch بالا می‌رود → چالش تازه خودکار fetch می‌شود
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const onLoginError = (err: unknown) => {
    if (err instanceof ApiClientError && err.captchaRequired) {
      setCaptchaRequired(true);
      setCaptchaEpoch((e) => e + 1); // چالش قبلی احتمالاً مصرف/منقضی شده — تازه بگیر
    }
    setError(err instanceof Error ? err.message : t("common.error"));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nid = enDigits(nationalId).trim();
    if (!/^\d{10}$/.test(nid)) {
      setError(t("auth.login.error.nationalId"));
      return;
    }
    if (!password) {
      setError(t("auth.login.error.password"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<{ ok: boolean; requires2fa?: boolean; requiresOtp?: boolean; pendingToken?: string; maskedTo?: string | null; channel?: string; devCode?: string }>("/api/auth/login", {
        nationalId: nid,
        password,
        ...(captchaRequired ? { captchaToken: captcha.token, captchaAnswer: enDigits(captcha.answer).replace(/[\s\u200c]/g, "") } : {}),
      });
      if (res.requiresOtp && res.pendingToken) {
        // ورود دومرحله‌ای با کد یکبارمصرف ایمیل/پیامک فعال است
        setPendingOtp({ token: res.pendingToken, maskedTo: res.maskedTo ?? null, channel: res.channel ?? "email", devCode: res.devCode });
        setCodeOtp("");
        setCaptchaRequired(false);
        setOtpCaptchaRequired(false);
        return;
      }
      if (res.requires2fa && res.pendingToken) {
        // حساب دو مرحله‌ای فعال دارد → فرم کد نمایش داده می‌شود
        setPending2fa(res.pendingToken);
        setCode2fa("");
        setCaptchaRequired(false);
        return;
      }
      toast.success("خوش آمدید! ورود موفق بود.");
      router.replace("/app");
    } catch (err) {
      onLoginError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingOtp) return;
    setError(null);
    const clean = enDigits(codeOtp).replace(/[^0-9]/g, "");
    if (clean.length !== 6) {
      setError("کد ۶ رقمی ارسال‌شده را وارد کنید.");
      return;
    }
    setOtpBusy(true);
    try {
      const res = await apiPost<{ ok: boolean; requires2fa?: boolean; pendingToken?: string }>("/api/auth/otp", {
        pendingToken: pendingOtp.token,
        code: clean,
        ...(otpCaptchaRequired ? { captchaToken: captcha.token, captchaAnswer: enDigits(captcha.answer).replace(/[\s\u200c]/g, "") } : {}),
      });
      if (res.requires2fa && res.pendingToken) {
        // OTP تأیید شد و حساب 2FA هم دارد → مرحلهٔ بعد
        setPendingOtp(null);
        setPending2fa(res.pendingToken);
        setCode2fa("");
        setOtpCaptchaRequired(false);
        return;
      }
      toast.success("خوش آمدید! ورود با کد یکبارمصرف موفق بود.");
      router.replace("/app");
    } catch (err) {
      if (err instanceof ApiClientError && err.captchaRequired) {
        setOtpCaptchaRequired(true);
        setCaptchaEpoch((e) => e + 1); // چالش تازه — قبلی احتمالاً مصرف شده
      }
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setOtpBusy(false);
    }
  }

  async function resendOtp() {
    if (!pendingOtp || otpBusy) return;
    setOtpBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ ok: boolean; maskedTo?: string | null; devCode?: string }>("/api/auth/otp", {
        pendingToken: pendingOtp.token,
        resend: true,
      });
      setPendingOtp({ ...pendingOtp, maskedTo: res.maskedTo ?? pendingOtp.maskedTo, devCode: res.devCode });
      setCodeOtp("");
      toast.success("کد جدید ارسال شد.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ارسال مجدد");
    } finally {
      setOtpBusy(false);
    }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = enDigits(code2fa).replace(/[^0-9A-Za-z-]/g, "");
    if (clean.length < 6) {
      setError("کد تأیید ۶ رقمی اپ احرازگر (یا کد بازیابی) را وارد کنید.");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/api/auth/login2fa", {
        pendingToken: pending2fa,
        code: clean,
        ...(captchaRequired ? { captchaToken: captcha.token, captchaAnswer: enDigits(captcha.answer).replace(/[\s\u200c]/g, "") } : {}),
      });
      toast.success("خوش آمدید! ورود دو مرحله‌ای موفق بود.");
      router.replace("/app");
    } catch (err) {
      onLoginError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 md:px-6 h-14 max-w-6xl w-full mx-auto">
        <span className="t-cap text-stone">بهار · سامانه مدیریت مدرسه</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-10 relative overflow-hidden">
        <div className="absolute inset-0 b-hero-grad b-aurora opacity-70" aria-hidden />
        <div className="relative w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-spring mb-6 transition-colors"
          >
            <ArrowRight className="w-4 h-4" /> بازگشت به صفحه اصلی
          </Link>

          <div className="b-card p-8 md:p-10 b-rise">
            <div className="flex flex-col items-center gap-3 mb-8">
              <Image src={logoUrl || "/logo.svg"} alt="بهار" width={52} height={52} />
              <h1 className="text-2xl font-bold b-grad-text">{t("auth.login.title")}</h1>
              <p className="t-sm text-steel text-center">
                {shadEnabled
                  ? t("auth.login.hint")
                  : "نام کاربری همه کاربران «کد ملی» است و رمز عبور به‌صورت تصادفی توسط سامانه ساخته و به شما تحویل داده می‌شود"}
              </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-bold">{t("auth.login.username")}</span>
                <div className="relative">
                  <IdCard className="absolute end-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone" />
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="username"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="b-input pe-10 text-start tracking-widest"
                    placeholder="xxxxxxxxxx"
                    maxLength={12}
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-bold">{t("auth.login.password")}</span>
                <div className="relative">
                  <KeyRound className="absolute end-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone" />
                  <input
                    type="password"
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="b-input pe-10 text-start"
                    placeholder="••••••••"
                  />
                </div>
              </label>

              {error && (
                <div className="b-card-sm !border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-[14px] font-medium">
                  {error}
                </div>
              )}

              {/* ── کپچای امن — فقط پس از تلاش‌های ناموفق (رفتار مشکوک) ── */}
              {captchaRequired && (
                <div className="b-card-sm !rounded-2xl p-4 bg-spring-tint/30 !border-spring/25 b-rise">
                  <CaptchaField key={captchaEpoch} value={captcha} onChange={setCaptcha} />
                </div>
              )}

              <button type="submit" disabled={loading || Boolean(pending2fa) || Boolean(pendingOtp) || (captchaRequired && captcha.answer.trim().length === 0)} className="b-btn b-btn-spring w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("auth.login.submit")}
              </button>

              {/* ── ورود با Passkey (بدون رمز) ── */}
              {passkeySupported() && (
                <button
                  type="button"
                  disabled={passkeyBusy}
                  className="b-btn b-btn-soft w-full"
                  onClick={async () => {
                    const nid = enDigits(nationalId).trim();
                    if (!nid) { setError("برای ورود با کلید عبور، اول کد ملی را بنویسید."); return; }
                    setError(null);
                    setPasskeyBusy(true);
                    try {
                      await loginWithPasskey(nid);
                      toast.success("خوش آمدید! ورود با کلید عبور موفق بود.");
                      router.replace("/app");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "ورود با کلید عبور ناموفق بود.");
                    } finally { setPasskeyBusy(false); }
                  }}
                >
                  {passkeyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
                  ورود با کلید عبور (Passkey)
                </button>
              )}

              {/* ── مرحلهٔ کد یکبارمصرف (راند ۱۸) ── */}
              {pendingOtp && (
                <div className="b-card-sm !rounded-2xl p-4 bg-spring-tint/40 !border-spring/30">
                  <b className="block text-[14px] mb-1 text-spring-deep">
                    کد یکبارمصرف ({pendingOtp.channel === "sms" ? "پیامک" : "ایمیل"})
                  </b>
                  <p className="text-[12px] text-steel leading-relaxed mb-3">
                    رمز درست بود — کد ۶ رقمی را که {pendingOtp.channel === "sms" ? "به موبایل" : "به ایمیل"}
                    {pendingOtp.maskedTo ? <> (<b dir="ltr" className="font-mono">{pendingOtp.maskedTo}</b>)</> : null} ارسال شد وارد کنید.
                    اعتبار کد ۵ دقیقه است.
                  </p>
                  <input
                    className="b-input text-start !font-mono !tracking-[0.35em]"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={codeOtp}
                    onChange={(e) => setCodeOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="- - - - - -"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitOtp(e as unknown as React.FormEvent); } }}
                  />
                  {/* راند ۱۹: کپچای مرحلهٔ OTP — پس از کدهای اشتباه پیاپی */}
                  {otpCaptchaRequired && (
                    <div className="mt-3 b-rise">
                      <CaptchaField key={`otp-${captchaEpoch}`} value={captcha} onChange={setCaptcha} />
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={submitOtp} disabled={otpBusy || codeOtp.length < 6 || (otpCaptchaRequired && captcha.answer.trim().length === 0)} className="b-btn b-btn-spring flex-1">
                      {otpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأیید و ورود"}
                    </button>
                    <button type="button" onClick={resendOtp} disabled={otpBusy} className="b-btn b-btn-soft" title="ارسال مجدد کد">
                      ارسال مجدد
                    </button>
                    <button type="button" onClick={() => { setPendingOtp(null); setCodeOtp(""); setOtpCaptchaRequired(false); setError(null); }} className="b-btn b-btn-ghost">
                      بازگشت
                    </button>
                  </div>
                </div>
              )}

              {/* ── مرحله دوم: کد تأیید 2FA (راند ۱۶) ── */}
              {pending2fa && (
                <div className="b-card-sm !rounded-2xl p-4 bg-spring-tint/40 !border-spring/30">
                  <b className="block text-[14px] mb-1 text-spring-deep">تأیید دو مرحله‌ای</b>
                  <p className="text-[12px] text-steel leading-relaxed mb-3">
                    رمز درست بود — حالا کد ۶ رقمی فعلی را از اپ احرازگر (Google Authenticator / Aegis / …) وارد کنید.
                    اگر به اپ دسترسی ندارید، یکی از «کدهای بازیابی» (XXXX-XXXX) را وارد کنید.
                  </p>
                  <input
                    className="b-input text-start !font-mono !tracking-[0.3em]"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code2fa}
                    onChange={(e) => setCode2fa(e.target.value)}
                    placeholder="------"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit2fa(e as unknown as React.FormEvent); } }}
                  />
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={submit2fa} disabled={loading || code2fa.length < 6} className="b-btn b-btn-spring flex-1">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "تأیید و ورود"}
                    </button>
                    <button type="button" onClick={() => { setPending2fa(null); setCode2fa(""); setError(null); }} className="b-btn b-btn-ghost">
                      بازگشت
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <p className="t-cap text-stone text-center mt-6 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" /> پس از ورود اول، از پروفایل رمز عبور خود را تغییر دهید.
          </p>

          {/* حساب ندارید؟ → صفحه معرفی محصول */}
          <div className="b-card-sm !rounded-2xl mt-4 p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
              <Sprout className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <b className="text-[12px] block">حساب ندارید؟</b>
              <p className="text-[12px] text-steel leading-relaxed">بهار را از نزدیک ببینید؛ همهٔ قابلیت‌ها در یک صفحه.</p>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
