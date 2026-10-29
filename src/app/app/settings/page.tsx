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
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
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
      if (!res.ok) throw new Error(json?.error?.message ?? t("settings.toast.uploadFailed"));
      await apiPut("/api/settings", { [field]: json.url });
      toast.success(t("settings.toast.brandUploaded"));
      refetch();
      setForm((f) => (f ? { ...f, [field]: json.url } : f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
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
      if (!res.ok) throw new Error(json?.error?.message ?? t("settings.toast.uploadFailed"));
      const field = kind === "android" ? "androidAppUrl" : "windowsAppUrl";
      await apiPut("/api/settings", { [field]: json.url });
      toast.success(`${t("settings.upload.file")} ${kind === "android" ? t("settings.upload.appAndroid") : t("settings.upload.appWindows")} ${t("settings.upload.done")}`);
      refetch();
      setForm((f) => (f ? { ...f, [field]: json.url } : f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setUploadingApp(null);
    }
  }

  const { data: designData, error: designApiError } = useApi<{ markdown: string }>("/api/settings/design-language");
  if (designData?.markdown && designMd === null) setDesignMd(designData.markdown);
  // خطای سند زبان طراحی — قبلاً برای همیشه روی «در حال بارگذاری» می‌ماند
  if (designApiError && !designError) setDesignError(designApiError);

  if (loading) return <LoadingBlock label={t("settings.loading")} />;
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
      toast.success(t("settings.toast.saved"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  async function backupNow() {
    setBackingUp(true);
    try {
      const res = await apiPut<{ backup: { filename: string; recordCount: number } }>("/api/settings", { action: "backup" });
      toast.success(`${t("settings.backup.created")} ${res.backup.recordCount.toLocaleString("fa-IR")} ${t("settings.backup.records")}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setBackingUp(false);
    }
  }

  async function deleteBackup(b: BackupRow) {
    if (!confirm(`${t("settings.backup.deleteBefore")} «${b.filename}» ${t("settings.backup.deleteAfter")}`)) return;
    try {
      await apiDelete(`/api/settings/backup/${b.id}`);
      toast.success(t("settings.toast.backupDeleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
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
      if (!res.ok) throw new Error(json?.error?.message ?? t("settings.toast.restoreFailed"));
      toast.success(`${t("settings.restore.done")} ${json.total?.toLocaleString("fa-IR")} ${t("settings.restore.records")}`);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("settings.toast.invalidFile"));
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tabs = [
    { id: "general", label: t("settings.general"), icon: Settings },
    { id: "languages", label: t("settings.languages"), icon: Languages },
    { id: "country", label: t("settings.tab.country"), icon: Globe2 },
    { id: "backup", label: t("settings.backup"), icon: HardDriveDownload },
    { id: "design", label: t("settings.tab.design"), icon: Palette },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("shell.systemSettings")}
        desc={t("settings.header.desc")}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button key={tb.id} className={`b-pill-tab ${tab === tb.id ? "b-pill-tab-active" : ""}`} onClick={() => setTab(tb.id)}>
            <tb.icon className="w-3.5 h-3.5 inline ml-1" />
            {tb.label}
          </button>
        ))}
      </div>

      {/* ───── عمومی ───── */}
      {tab === "general" && form && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Settings className="w-4 h-4 text-spring" /> {t("settings.card.identity")}</b>
            {[
              { k: "siteTitle", l: t("settings.field.siteTitle") },
              { k: "siteTagline", l: t("settings.field.siteTagline") },
            ].map((f) => (
              <label key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{f.l}</span>
                <input className="b-input" value={form[f.k as keyof Settings] as string} disabled={!data.canEdit} onChange={(e) => set(f.k as keyof Settings, e.target.value)} />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("settings.field.mainHost")}</span>
              <input className="b-input" dir="ltr" placeholder="bahar.school" value={form.mainHost} disabled={!data.canEdit} onChange={(e) => set("mainHost", e.target.value)} />
              <span className="text-[10.5px] text-stone">{t("settings.field.mainHostHint")}</span>
            </label>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Shield className="w-4 h-4 text-spring" /> {t("settings.card.contact")}</b>
            {[
              { k: "supportPhone", l: t("settings.field.supportPhone") },
              { k: "supportEmail", l: t("settings.field.supportEmail") },
              { k: "salesPhone", l: t("settings.field.salesPhone") },
              { k: "salesTelegram", l: t("settings.field.salesTelegram") },
              { k: "salesInstagram", l: t("settings.field.salesInstagram") },
            ].map((f) => (
              <label key={f.k} className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{f.l}</span>
                <input className="b-input" dir={["supportEmail", "salesTelegram", "salesInstagram"].includes(f.k) ? "ltr" : "rtl"} value={form[f.k as keyof Settings] as string} disabled={!data.canEdit} onChange={(e) => set(f.k as keyof Settings, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px]">{t("settings.card.demo")}</b>
            <label className="b-option !py-3 items-center gap-3">
              <input type="checkbox" className="accent-spring w-4 h-4" checked={form.demoEnabled} onChange={(e) => set("demoEnabled", e.target.checked)} />
              <span className="flex flex-col">
                <b className="text-[12.5px]">{t("settings.demo.show")}</b>
                <span className="text-[10.5px] text-steel">{t("settings.demo.hint")}</span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.demoManagerNationalId")}</span>
                <input className="b-input" dir="ltr" value={form.demoManagerNationalId} disabled={!data.canEdit} onChange={(e) => set("demoManagerNationalId", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.demoStudentNationalId")}</span>
                <input className="b-input" dir="ltr" value={form.demoStudentNationalId} disabled={!data.canEdit} onChange={(e) => set("demoStudentNationalId", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.demoManagerPassword")}</span>
                <input className="b-input" dir="ltr" value={form.demoManagerPassword} disabled={!data.canEdit} onChange={(e) => set("demoManagerPassword", e.target.value)} />
                <span className="text-[10px] text-stone">{t("settings.demo.passwordHint")}</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.demoStudentPassword")}</span>
                <input className="b-input" dir="ltr" value={form.demoStudentPassword} disabled={!data.canEdit} onChange={(e) => set("demoStudentPassword", e.target.value)} />
              </label>
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Palette className="w-4 h-4 text-spring" /> {t("settings.card.branding")}</b>
            <p className="text-[11.5px] text-steel leading-relaxed">
              {t("settings.branding.desc")}
            </p>
            {([
              { field: "logoUrl" as const, label: t("settings.brand.logo"), hint: t("settings.brand.logoHint"), accept: "image/png,image/svg+xml,image/webp" },
              { field: "logotypeUrl" as const, label: t("settings.brand.logotype"), hint: t("settings.brand.logotypeHint"), accept: "image/png,image/svg+xml,image/webp" },
              { field: "faviconUrl" as const, label: t("settings.brand.favicon"), hint: t("settings.brand.faviconHint"), accept: "image/png,image/svg+xml,image/webp" },
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
                  {form[b.field] ? t("settings.brand.replace") : t("settings.brand.upload")}
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
                    title={t("settings.brand.deleteTitle")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Smartphone className="w-4 h-4 text-spring" /> {t("settings.card.apps")}</b>
            <p className="text-[11.5px] text-steel leading-relaxed">
              {t("settings.apps.desc")}
            </p>
            {([
              { kind: "android" as const, icon: Smartphone, label: t("settings.apps.android"), field: "androidAppUrl", accept: ".apk" },
              { kind: "windows" as const, icon: Monitor, label: t("settings.apps.windows"), field: "windowsAppUrl", accept: ".exe,.msi,.zip" },
            ]).map((a) => (
              <div key={a.kind} className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
                <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
                  <a.icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[12.5px] block">{a.label}</b>
                  {form[a.field] ? (
                    <a href={form[a.field]} target="_blank" rel="noreferrer" className="text-[10.5px] text-spring font-bold hover:underline flex items-center gap-1">
                      <Download className="w-3 h-3" /> {t("settings.apps.downloadActive")}
                    </a>
                  ) : (
                    <span className="text-[10.5px] text-stone">{t("settings.apps.noFile")}</span>
                  )}
                </div>
                <label className="b-btn b-btn-soft b-btn-sm cursor-pointer">
                  {uploadingApp === a.kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {form[a.field] ? t("settings.apps.replaceFile") : t("settings.apps.uploadFile")}
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
            <b className="text-[13.5px]">{t("settings.card.security")}</b>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.sessionDays")}</span>
                <input className="b-input" dir="ltr" type="number" min={1} max={90} value={form.sessionDays} disabled={!data.canEdit} onChange={(e) => set("sessionDays", Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.loginMaxAttempts")}</span>
                <input className="b-input" dir="ltr" type="number" min={3} max={20} value={form.loginMaxAttempts} disabled={!data.canEdit} onChange={(e) => set("loginMaxAttempts", Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("settings.field.autoBackupDays")}</span>
                <input className="b-input" dir="ltr" type="number" min={1} max={365} value={form.autoBackupDays} disabled={!data.canEdit} onChange={(e) => set("autoBackupDays", Number(e.target.value))} />
                <span className="text-[10px] text-stone">{t("settings.field.autoBackupDaysHint")}</span>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("settings.field.shadGateway")}</span>
              <input className="b-input" dir="ltr" value={form.shadGatewayUrl} disabled={!data.canEdit} onChange={(e) => set("shadGatewayUrl", e.target.value)} />
              <span className="text-[10.5px] text-stone">{t("settings.field.shadGatewayHint")}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">{t("settings.field.telegramToken")}</span>
              <input
                className="b-input"
                dir="ltr"
                type="password"
                autoComplete="off"
                placeholder={form.telegramBotToken ? t("settings.placeholder.tokenSaved") : t("settings.placeholder.tokenExample")}
                disabled={!data.canEdit}
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
              />
              <span className="text-[10.5px] text-stone">{t("settings.field.telegramTokenHint")}</span>
            </label>
            <label className="flex items-center gap-2.5 select-none cursor-pointer w-fit">
              <input
                type="checkbox"
                className="accent-[var(--color-spring)] w-4 h-4"
                checked={!!form.telegramBotEnabled}
                disabled={!data.canEdit || !form.telegramBotToken}
                onChange={(e) => set("telegramBotEnabled", e.target.checked)}
              />
              <span className="text-[12px] font-bold">{t("settings.telegram.enable")}</span>
              {!form.telegramBotToken && <span className="text-[10.5px] text-stone">{t("settings.telegram.tokenFirst")}</span>}
            </label>
            {/* راند ۱۹: اتصال وب‌هوک مستقیم از پنل — بدون پروسهٔ جدا */}
            <TelegramSetupCard tokenSaved={!!form.telegramBotToken} />
          </div>

          <div className="lg:col-span-2">
            <OtpCard canEdit={data.canEdit} />
          </div>

          <div className="lg:col-span-2 flex items-center gap-3">
            <button className="b-btn b-btn-spring" onClick={save} disabled={saving || !data.canEdit}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {t("settings.save.action")}
            </button>
            {!data.canEdit && (
              <span className="text-[11.5px] text-warning-deep">{t("settings.save.readOnly")}</span>
            )}
            <button className="b-btn b-btn-ghost" onClick={() => setForm(data.settings)} disabled={!data.canEdit}>{t("settings.save.reset")}</button>
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
              <b className="text-[13.5px] flex items-center gap-2 block mb-1"><HardDriveDownload className="w-4 h-4 text-spring" /> {t("settings.backup.title")}</b>
              <p className="text-[12px] text-steel leading-relaxed">
                {t("settings.backup.desc")}
                {t("settings.backup.autoBefore")} {faDigits(data.settings.autoBackupDays)} {t("settings.backup.autoAfter")}
                {data.autoCreated && <b className="text-spring"> {t("settings.backup.autoJustCreated")}</b>}
              </p>
            </div>
            <button className="b-btn b-btn-spring b-btn-sm" onClick={backupNow} disabled={backingUp}>
              {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />} {t("settings.backup.manual")}
            </button>
          </div>

          <div className="b-card p-5">
            <b className="text-[13.5px] flex items-center gap-2 block mb-4"><Upload className="w-4 h-4 text-spring" /> {t("settings.restore.title")}</b>
            {confirmRestore ? (
              <div className="b-card-sm !rounded-xl p-4 !border-destructive/30 !bg-destructive/5">
                <p className="text-[12.5px] text-destructive font-bold mb-2">
                  {t("settings.restore.warning")}
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
                  <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setConfirmRestore(false)}>{t("common.cancel")}</button>
                </div>
              </div>
            ) : (
              <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setConfirmRestore(true)} disabled={restoring}>
                {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t("settings.restore.upload")}
              </button>
            )}
          </div>

          <div className="b-card-sm overflow-hidden">
            <div className="p-4 border-b border-hairline-soft flex items-center justify-between">
              <b className="text-[13.5px]">{t("settings.backup.existing")} ({faNumber(data.backups.length)})</b>
              <button className="b-btn b-btn-ghost b-btn-sm !text-steel" onClick={() => refetch()}>
                <RefreshCcw className="w-3.5 h-3.5" /> {t("settings.backup.refresh")}
              </button>
            </div>
            {data.backups.length === 0 ? (
              <p className="t-sm text-steel text-center py-8">{t("settings.backup.empty")}</p>
            ) : (
              <div className="overflow-x-auto b-scroll">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-hairline-soft text-steel text-[11px]">
                      <th className="text-right py-2.5 px-4 font-bold">{t("settings.backup.table.file")}</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden md:table-cell">{t("settings.backup.table.kind")}</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden md:table-cell">{t("settings.backup.table.records")}</th>
                      <th className="text-right py-2.5 px-4 font-bold">{t("settings.backup.table.size")}</th>
                      <th className="text-right py-2.5 px-4 font-bold hidden sm:table-cell">{t("settings.backup.table.time")}</th>
                      <th className="text-right py-2.5 px-4 font-bold">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.backups.map((b) => (
                      <tr key={b.id} className="b-row border-b border-hairline-soft/50 last:border-0">
                        <td className="py-2.5 px-4"><span dir="ltr" className="font-mono text-[11px] block truncate max-w-[220px]">{b.filename}</span></td>
                        <td className="py-2.5 px-4 hidden md:table-cell">
                          <span className={`b-badge ${b.kind === "AUTO" ? "b-badge-neutral" : "b-badge-spring"}`}>{b.kind === "AUTO" ? t("settings.backup.kindAuto") : t("settings.backup.kindManual")}</span>
                        </td>
                        <td className="py-2.5 px-4 hidden md:table-cell">{faNumber(b.recordCount)}</td>
                        <td className="py-2.5 px-4 text-steel">{faNumber(Math.round(b.sizeBytes / 1024))} {t("dashboard.unit.kb")}</td>
                        <td className="py-2.5 px-4 text-steel text-[11px] hidden sm:table-cell">{formatDateTimeFa(b.createdAt)}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1">
                            <a href={`/api/settings/backup/${b.id}`} className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring" title={t("common.download")}>
                              <Download className="w-4 h-4" />
                            </a>
                            <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteBackup(b)} title={t("common.delete")}>
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
              <b className="text-[14px] block">{t("settings.design.title")}</b>
              <span className="text-[11.5px] text-steel">{t("settings.design.subtitle")}</span>
            </div>
            <span className="ms-auto b-badge b-badge-neutral">Read-only</span>
          </div>
          <div className="border-t border-hairline-soft pt-4 mt-2 max-h-[70vh] overflow-y-auto b-scroll">
            {designMd ? (
              <Markdown source={designMd} />
            ) : designError ? (
              <ErrorBox message={designError} />
            ) : (
              <p className="t-sm text-steel py-8 text-center">{t("settings.design.loading")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
