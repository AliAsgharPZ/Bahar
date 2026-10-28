"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Settings, HardDriveDownload, Download, Trash2, Upload, Loader2, Palette,
  Shield, CheckCircle2, RefreshCcw, FileJson, Smartphone, Monitor, Languages,
  Globe2 } from "lucide-react";
import { useApi, apiPut, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatusBadge } from "@/components/shared/bits";
import { Markdown } from "@/components/shared/markdown";
import { LanguagesCard } from "@/components/settings/languages-card";
import { CountryCard } from "@/components/settings/country-card";
import { OtpCard } from "@/components/settings/otp-card";
import { TelegramSetupCard } from "@/components/settings/telegram-setup-card";
import { formatDateTimeFa, faNumber, faDigits } from "@/lib/persian";

type Settings = {
  siteTitle: string;
  siteTagline: string;
  supportPhone: string;
  supportEmail: string;
  salesPhone: string;
  salesTelegram: string;
  salesInstagram: string;
  demoEnabled: boolean;
  demoManagerNationalId: string;
  demoStudentNationalId: string;
  demoManagerPassword: string;
  demoStudentPassword: string;
  androidAppUrl: string;
  windowsAppUrl: string;
  logoUrl: string;
  logotypeUrl: string;
  faviconUrl: string;
  autoBackupDays: number;
  sessionDays: number;
  loginMaxAttempts: number;
  shadGatewayUrl: string;
  mainHost: string;
  telegramBotToken?: string;
  telegramBotEnabled?: boolean;
};

type BackupRow = {
  id: string;
  filename: string;
  kind: string;
  sizeBytes: number;
  recordCount: number;
  note: string | null;
  createdAt: string;
};

type SettingsResponse = {
  settings: Settings;
  canEdit: boolean;
  backups: BackupRow[];
  filesOnDisk: number;
  autoCreated: boolean;
};

export default function SettingsPage() {
  const { data, loading, error, refetch } = useApi<SettingsResponse>("/api/settings");
  const [tab, setTab] = useState<"general" | "backup" | "design" | "languages" | "country">("general");
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [designMd, setDesignMd] = useState<string | null>(null);
  const [designError, setDesignError] = useState("");
  // توکن ربات فقط وقتی کاربر چیزی وارد کند ارسال می‌شود (خالی = بدون تغییر)
  const [botTokenInput, setBotTokenInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingApp, setUploadingApp] = useState<"android" | "windows" | null>(null);
  const [uploadingBrand, setUploadingBrand] = useState<"logoUrl" | "logotypeUrl" | "faviconUrl" | null>(null);

  async function uploadBrand(field: "logoUrl" | "logotypeUrl" | "faviconUrl", file: File) {
    setUploadingBrand(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا در آپلود");
      await apiPut("/api/settings", { [field]: json.url });
      toast.success("تصویر آپلود و اعمال شد.");
      refetch();
      setForm((f) => (f ? { ...f, [field]: json.url } : f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setUploadingBrand(null);
    }
  }

  async function uploadApp(kind: "android" | "windows", file: File) {
    setUploadingApp(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "app");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا در آپلود");
      const field = kind === "android" ? "androidAppUrl" : "windowsAppUrl";
      await apiPut("/api/settings", { [field]: json.url });
      toast.success(`فایل ${kind === "android" ? "اندروید" : "ویندوز"} آپلود شد و لینک دانلود فعال شد.`);
      refetch();
      setForm((f) => (f ? { ...f, [field]: json.url } : f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setUploadingApp(null);
    }
  }

  const { data: designData, error: designApiError } = useApi<{ markdown: string }>("/api/settings/design-language");
  if (designData?.markdown && designMd === null) setDesignMd(designData.markdown);
  // خطای سند زبان طراحی — قبلاً برای همیشه روی «در حال بارگذاری» می‌ماند
  if (designApiError && !designError) setDesignError(designApiError);

  if (loading) return <LoadingBlock label="تنظیمات…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  if (form === null) setForm(data.settings);

  function set(k: keyof Settings, v: string | number | boolean) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // توکن ربات: ورودی خالی یعنی بدون تغییر؛ پر یعنی به‌روزرسانی
      if (botTokenInput.trim() !== "") payload.telegramBotToken = botTokenInput.trim();
      else delete payload.telegramBotToken;
      await apiPut("/api/settings", payload);
      setBotTokenInput("");
      toast.success("تنظیمات ذخیره شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function backupNow() {
    setBackingUp(true);
    try {
      const res = await apiPut<{ backup: { filename: string; recordCount: number } }>("/api/settings", { action: "backup" });
      toast.success(`بکاپ ساخته شد — ${res.backup.recordCount.toLocaleString("fa-IR")} رکورد.`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setBackingUp(false);
    }
  }

  async function deleteBackup(b: BackupRow) {
    if (!confirm(`نسخه «${b.filename}» حذف شود؟`)) return;
    try {
      await apiDelete(`/api/settings/backup/${b.id}`);
      toast.success("نسخه حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function restoreFile(file: File) {
    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/settings/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, confirm: true }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا در بازیابی");
      toast.success(`بازیابی انجام شد — ${json.total?.toLocaleString("fa-IR")} رکورد بازگردانده شد.`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فایل نامعتبر است");
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tabs = [
    { id: "general", label: "عمومی", icon: Settings },
    { id: "languages", label: "زبان‌ها", icon: Languages },
    { id: "country", label: "کشور", icon: Globe2 },
    { id: "backup", label: "پشتیبان‌گیری", icon: HardDriveDownload },
    { id: "design", label: "زبان طراحی", icon: Palette },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تنظیمات سامانه"
        desc="این بخش فقط برای مدیر کل سامانه است — تنظیمات سراسری، پشتیبان‌گیری و سند زبان طراحی."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} className={`b-pill-tab ${tab === t.id ? "b-pill-tab-active" : ""}`} onClick={() => setTab(t.id)}>
            <t.icon className="w-3.5 h-3.5 inline ml-1" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── عمومی ───── */}
      {tab === "general" && form && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Settings className="w-4 h-4 text-spring" /> هویت سرویس</b>
            {[
              { k: "siteTitle", l: "عنوان سایت" },
              { k: "siteTagline", l: "شعار سایت" },
            ].map((f) => (
              <label key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{f.l}</span>
                <input className="b-input" value={form[f.k as keyof Settings] as string} disabled={!data.canEdit} onChange={(e) => set(f.k as keyof Settings, e.target.value)} />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">دامنه اصلی (اطلاعاتی)</span>
              <input className="b-input" dir="ltr" placeholder="bahar.school" value={form.mainHost} disabled={!data.canEdit} onChange={(e) => set("mainHost", e.target.value)} />
              <span className="text-[10.5px] text-stone">سایت هر مدرسه به‌صورت صفحه اختصاصی در مسیر /s/نام-مدرسه در دسترس است.</span>
            </label>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Shield className="w-4 h-4 text-spring" /> تماس و فروش</b>
            {[
              { k: "supportPhone", l: "تلفن پشتیبانی" },
              { k: "supportEmail", l: "ایمیل پشتیبانی" },
              { k: "salesPhone", l: "تلفن فروش" },
              { k: "salesTelegram", l: "لینک تلگرام فروش" },
              { k: "salesInstagram", l: "لینک اینستاگرام" },
            ].map((f) => (
              <label key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{f.l}</span>
                <input className="b-input" dir={["supportEmail", "salesTelegram", "salesInstagram"].includes(f.k) ? "ltr" : "rtl"} value={form[f.k as keyof Settings] as string} disabled={!data.canEdit} onChange={(e) => set(f.k as keyof Settings, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px]">حساب دمو (صفحه معرفی)</b>
            <label className="b-option !py-3 items-center gap-3">
              <input type="checkbox" className="accent-[#00825e] w-4 h-4" checked={form.demoEnabled} onChange={(e) => set("demoEnabled", e.target.checked)} />
              <span className="flex flex-col">
                <b className="text-[12.5px]">نمایش حساب دمو در صفحه معرفی</b>
                <span className="text-[10.5px] text-steel">برای تست مدیران مدارس جدید — کدملی و رمز دمو روی همان صفحه نمایش داده می‌شود.</span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">کدملی مدیر دمو</span>
                <input className="b-input" dir="ltr" value={form.demoManagerNationalId} disabled={!data.canEdit} onChange={(e) => set("demoManagerNationalId", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">کدملی دانش‌آموز دمو</span>
                <input className="b-input" dir="ltr" value={form.demoStudentNationalId} disabled={!data.canEdit} onChange={(e) => set("demoStudentNationalId", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">رمز مدیر دمو</span>
                <input className="b-input" dir="ltr" value={form.demoManagerPassword} disabled={!data.canEdit} onChange={(e) => set("demoManagerPassword", e.target.value)} />
                <span className="text-[10px] text-stone">برای اعمال، رمز کاربر دمو در بانک باید همسان باشد (seed همین کار را می‌کند).</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">رمز دانش‌آموز دمو</span>
                <input className="b-input" dir="ltr" value={form.demoStudentPassword} disabled={!data.canEdit} onChange={(e) => set("demoStudentPassword", e.target.value)} />
              </label>
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Palette className="w-4 h-4 text-spring" /> هویت بصری سرویس</b>
            <p className="text-[11.5px] text-steel leading-relaxed">
              لوگو، لوگوتایپ و فاوآیکون دلخواه را آپلود کنید؛ در صفحه ورود، پنل کاربری و تب مرورگر اعمال می‌شود (اندازه پیشنهادی: لوگو مربعی ۵۱۲×۵۱۲، فاوآیکون ۱۹۲×۱۹۲).
            </p>
            {([
              { field: "logoUrl" as const, label: "لوگوی سرویس", hint: "نمایش‌داده‌شده در سایدبار پنل و صفحه ورود", accept: "image/png,image/svg+xml,image/webp" },
              { field: "logotypeUrl" as const, label: "لوگوتایپ (نسخه تصویری نام)", hint: "جایگزین نوشته «بهار» کنار لوگو", accept: "image/png,image/svg+xml,image/webp" },
              { field: "faviconUrl" as const, label: "فاوآیکون", hint: "آیکون تب مرورگر و صفحه اصلی موبایل", accept: "image/png,image/svg+xml,image/webp" },
            ]).map((b) => (
              <div key={b.field} className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
                <span className="w-11 h-11 rounded-2xl bg-spring-tint flex items-center justify-center shrink-0 overflow-hidden">
                  {form[b.field] ? (
                    <img src={form[b.field]} alt={b.label} className="w-full h-full object-contain" />
                  ) : (
                    <Palette className="w-4 h-4 text-spring" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[12.5px] block">{b.label}</b>
                  <span className="text-[10.5px] text-stone">{b.hint}</span>
                </div>
                <label className="b-btn b-btn-soft b-btn-sm cursor-pointer">
                  {uploadingBrand === b.field ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {form[b.field] ? "جایگزینی" : "آپلود"}
                  <input
                    type="file"
                    accept={b.accept}
                    className="hidden"
                    disabled={uploadingBrand !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBrand(b.field, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {form[b.field] && (
                  <button
                    className="b-btn b-btn-ghost b-btn-sm !text-destructive"
                    onClick={() => { set(b.field, ""); }}
                    title="حذف (پس از ذخیره اعمال می‌شود)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Smartphone className="w-4 h-4 text-spring" /> فایل‌های دانلود اپ‌ها</b>
            <p className="text-[11.5px] text-steel leading-relaxed">
              فایل APK اندروید یا EXE ویندوز را آپلود کنید؛ لینک دانلود در صفحه اصلی (متن‌های «اندروید/ویندوز») فعال می‌شود.
            </p>
            {([
              { kind: "android" as const, icon: Smartphone, label: "اپ اندروید (APK)", field: "androidAppUrl", accept: ".apk" },
              { kind: "windows" as const, icon: Monitor, label: "اپ ویندوز (EXE/MSI/ZIP)", field: "windowsAppUrl", accept: ".exe,.msi,.zip" },
            ]).map((a) => (
              <div key={a.kind} className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
                <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
                  <a.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[12.5px] block">{a.label}</b>
                  {form[a.field] ? (
                    <a href={form[a.field]} target="_blank" rel="noreferrer" className="text-[10.5px] text-spring font-bold hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> دانلود فعال است
                    </a>
                  ) : (
                    <span className="text-[10.5px] text-stone">فایلی آپلود نشده — لینک به صفحه معرفی می‌رود</span>
                  )}
                </div>
                <label className="b-btn b-btn-soft b-btn-sm cursor-pointer">
                  {uploadingApp === a.kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {form[a.field] ? "جایگزینی فایل" : "آپلود فایل"}
                  <input
                    type="file"
                    accept={a.accept}
                    className="hidden"
                    disabled={uploadingApp !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadApp(a.kind, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px]">امنیت و دروازه شاد</b>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">طول نشست (روز)</span>
                <input className="b-input" dir="ltr" type="number" min={1} max={90} value={form.sessionDays} disabled={!data.canEdit} onChange={(e) => set("sessionDays", Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">حداکثر تلاش ورود</span>
                <input className="b-input" dir="ltr" type="number" min={3} max={20} value={form.loginMaxAttempts} disabled={!data.canEdit} onChange={(e) => set("loginMaxAttempts", Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">دوره بکاپ خودکار</span>
                <input className="b-input" dir="ltr" type="number" min={1} max={365} value={form.autoBackupDays} disabled={!data.canEdit} onChange={(e) => set("autoBackupDays", Number(e.target.value))} />
                <span className="text-[10px] text-stone">روز — پیش‌فرض ۳۰</span>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">آدرس دروازه شاد (سرویس جانبی)</span>
              <input className="b-input" dir="ltr" value={form.shadGatewayUrl} disabled={!data.canEdit} onChange={(e) => set("shadGatewayUrl", e.target.value)} />
              <span className="text-[10.5px] text-stone">سرویس python جانبی که با حساب شاد مدیر به پیام‌رسان شاد وصل می‌شود.</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">توکن ربات تلگرام (BotFather)</span>
              <input
                className="b-input"
                dir="ltr"
                type="password"
                autoComplete="off"
                placeholder={form.telegramBotToken ? "•••••••••••• (ذخیره شده — برای تغییر وارد کنید)" : "مثلاً ۱۲۳۴۵۶:ABC-DEF..."}
                disabled={!data.canEdit}
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
              />
              <span className="text-[10.5px] text-stone">برای اتصال ربات اطلاع‌رسانی؛ خالی بگذارید تا بدون تغییر بماند.</span>
            </label>
            <label className="flex items-center gap-2.5 select-none cursor-pointer w-fit">
              <input
                type="checkbox"
                className="accent-[var(--color-spring)] w-4 h-4"
                checked={!!form.telegramBotEnabled}
                disabled={!data.canEdit || !form.telegramBotToken}
                onChange={(e) => set("telegramBotEnabled", e.target.checked)}
              />
              <span className="text-[12px] font-bold">فعال‌سازی ربات تلگرام</span>
              {!form.telegramBotToken && <span className="text-[10.5px] text-stone">(ابتدا توکن را ذخیره کنید)</span>}
            </label>
            {/* راند ۱۹: اتصال وب‌هوک مستقیم از پنل — بدون پروسهٔ جدا */}
            <TelegramSetupCard tokenSaved={!!form.telegramBotToken} />
          </div>

          <div className="lg:col-span-2">
            <OtpCard canEdit={data.canEdit} />
          </div>

          <div className="lg:col-span-2 flex items-center gap-3">
            <button className="b-btn b-btn-spring" onClick={save} disabled={saving || !data.canEdit}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} ذخیره تنظیمات
            </button>
            {!data.canEdit && (
              <span className="text-[11.5px] text-warning-deep">مشاهده‌ای — ویرایش تنظیمات فقط برای مدیر کل سامانه</span>
            )}
            <button className="b-btn b-btn-ghost" onClick={() => setForm(data.settings)} disabled={!data.canEdit}>بازگردانی مقادیر</button>
          </div>
        </div>
      )}

      {/* ───── زبان‌ها ───── */}
      {tab === "languages" && <LanguagesCard />}
      {tab === "country" && <CountryCard />}

      {/* ───── پشتیبان‌گیری ───── */}
      {tab === "backup" && (
        <div className="flex flex-col gap-4">
          <div className="b-card p-5 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <b className="text-[13.5px] flex items-center gap-2 block mb-1"><HardDriveDownload className="w-4 h-4 text-spring" /> نسخه پشتیبان کامل</b>
              <p className="text-[12px] text-steel leading-relaxed">
                همه داده‌ها (کاربران، مدارس، نمرات، حضور، مالی و…) در یک فایل JSON ذخیره می‌شود.
                بکاپ خودکار هر {faDigits(data.settings.autoBackupDays)} روز یک‌بار توسط زمان‌بند سامانه انجام می‌شود؛
                {data.autoCreated && <b className="text-spring"> (بکاپ خودکار همین حالا ساخته شد)</b>}
              </p>
            </div>
            <button className="b-btn b-btn-spring b-btn-sm" onClick={backupNow} disabled={backingUp}>
              {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />} بکاپ دستی
            </button>
          </div>

          <div className="b-card p-5">
            <b className="text-[13.5px] flex items-center gap-2 block mb-4"><Upload className="w-4 h-4 text-spring" /> بازیابی از فایل بکاپ</b>
            {confirmRestore ? (
              <div className="b-card-sm !rounded-xl p-4 !border-destructive/30 !bg-destructive/5">
                <p className="text-[12.5px] text-destructive font-bold mb-2">
                  هشدار: بازیابی، همه داده‌های فعلی را پاک و با فایل بکاپ جایگزین می‌کند. مطمئن هستید؟
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="text-[12px]"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) restoreFile(f);
                    }}
                  />
                  <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setConfirmRestore(false)}>انصراف</button>
                </div>
              </div>
            ) : (
              <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setConfirmRestore(true)} disabled={restoring}>
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} آپلود فایل بکاپ برای بازیابی
              </button>
            )}
          </div>

          <div className="b-card-sm overflow-hidden">
            <div className="p-4 border-b border-hairline-soft flex items-center justify-between">
              <b className="text-[13.5px]">نسخه‌های موجود ({faNumber(data.backups.length)})</b>
              <button className="b-btn b-btn-ghost b-btn-sm !text-steel" onClick={() => refetch()}>
                <RefreshCcw className="w-3.5 h-3.5" /> بروزرسانی
              </button>
            </div>
            {data.backups.length === 0 ? (
              <p className="t-sm text-steel text-center py-8">هنوز نسخه‌ای ثبت نشده است.</p>
            ) : (
              <div className="overflow-x-auto b-scroll">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-hairline-soft text-steel text-[11px]">
                      <th className="text-right py-2.5 px-4 font-bold">فایل</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden md:table-cell">نوع</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden md:table-cell">رکورد</th>
                      <th className="text-right py-2.5 px-4 font-bold">حجم</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden sm:table-cell">زمان</th>
                      <th className="text-right py-2.5 px-4 font-bold">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.backups.map((b) => (
                      <tr key={b.id} className="b-row border-b border-hairline-soft/50 last:border-0">
                        <td className="py-2.5 px-4"><span dir="ltr" className="font-mono text-[11px] block truncate max-w-[220px]">{b.filename}</span></td>
                        <td className="py-2.5 px-4 hidden md:table-cell">
                          <span className={`b-badge ${b.kind === "AUTO" ? "b-badge-neutral" : "b-badge-spring"}`}>{b.kind === "AUTO" ? "خودکار" : "دستی"}</span>
                        </td>
                        <td className="py-2.5 px-4 hidden md:table-cell">{faNumber(b.recordCount)}</td>
                        <td className="py-2.5 px-4 text-steel">{faNumber(Math.round(b.sizeBytes / 1024))} کیلوبایت</td>
                        <td className="py-2.5 px-4 text-steel text-[11px] hidden sm:table-cell">{formatDateTimeFa(b.createdAt)}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1">
                            <a href={`/api/settings/backup/${b.id}`} className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring" title="دانلود">
                              <Download className="w-4 h-4" />
                            </a>
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteBackup(b)} title="حذف">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───── زبان طراحی ───── */}
      {tab === "design" && (
        <div className="b-card p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </span>
            <div>
              <b className="text-[14px] block">سند زبان طراحی بهار</b>
              <span className="text-[11.5px] text-steel">فقط-خواندنی — برای انسان و هوش مصنوعی — نسخه ۳</span>
            </div>
            <span className="ms-auto b-badge b-badge-neutral">Read-only</span>
          </div>
          <div className="border-t border-hairline-soft pt-4 mt-2 max-h-[70vh] overflow-y-auto b-scroll">
            {designMd ? (
              <Markdown source={designMd} />
            ) : designError ? (
              <ErrorBox message={designError} />
            ) : (
              <p className="t-sm text-steel py-8 text-center">سند در حال بارگذاری…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
