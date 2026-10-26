import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, audit, readJson, isDemoUser } from "@/lib/api";
import { createBackup, ensureAutoBackup, listBackupFiles } from "@/lib/backup";
import { getSettings, saveSettings } from "@/lib/settings";
import { hasPermission } from "@/lib/roles";

/** GET /api/settings — تنظیمات (سوپرادمین کامل؛ ادمین با view_settings فقط مشاهده) + بکاپ خودکار چک */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isSuper = me.role === "SUPER_ADMIN";
    const canView = isSuper || (me.role === "ADMIN" && hasPermission(me, "view_settings"));
    if (!canView) return apiErr(403, "دسترسی به تنظیمات ندارید.", "FORBIDDEN");

    const settings = await getSettings();
    // بکاپ خودکار دوره‌ای (هر ۳۰ روز) — با هر بازدید از تنظیمات چک می‌شود
    let autoCreated = false;
    if (isSuper || me.role === "ADMIN") {
      try {
        autoCreated = await ensureAutoBackup(settings.autoBackupDays);
      } catch { /* خالی */ }
    }

    const backups = await db.backup.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    const files = await listBackupFiles();

    // ⚠ امنیت: توکن ربات و رمز حساب‌های دمو فقط برای سوپرادمین — نسخه ادمین این فیلدها را نمی‌بیند
    const { telegramBotToken: _tbt, demoManagerPassword: _dmp, demoStudentPassword: _dsp, otpEmailApiKey: _oek, otpSmsApiKey: _osk, ...safeSettings } = settings;
    return apiOk({
      settings: isSuper ? settings : safeSettings,
      canEdit: isSuper,
      backups,
      filesOnDisk: files.length,
      autoCreated,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/settings — ذخیره تنظیمات (سوپرادمین) + ساخت بکاپ دستی با action=backup */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN") {
      return apiErr(403, "تنها مدیر کل سامانه می‌تواند تنظیمات را تغییر دهد.", "FORBIDDEN");
    }
    const body = await readJson<Record<string, unknown>>(req);

    if (body.action === "backup") {
      const result = await createBackup({ kind: "MANUAL", userId: me.id, note: String(body.note ?? "بکاپ دستی") });
      await audit({ user: me, action: "CREATE_BACKUP", entityType: "BACKUP", entityId: result.id, meta: result });
      return apiOk({ ok: true, backup: result });
    }

    const patch: Record<string, unknown> = {};
    const strFields = [
      "siteTitle", "siteTagline", "supportPhone", "supportEmail", "salesPhone",
      "salesTelegram", "salesInstagram", "shadGatewayUrl", "mainHost",
      "demoManagerNationalId", "demoStudentNationalId",
      "demoManagerPassword", "demoStudentPassword", "androidAppUrl", "windowsAppUrl",
      "logoUrl", "logotypeUrl", "faviconUrl", "telegramBotToken",
      "otpEmailApiUrl", "otpEmailApiKey", "otpEmailFrom", "otpSmsApiUrl", "otpSmsApiKey", "otpSmsSender",
    ] as const;
    for (const f of strFields) {
      if (body[f] !== undefined) patch[f] = String(body[f]).trim();
    }
    if (body.demoEnabled !== undefined) patch.demoEnabled = Boolean(body.demoEnabled);
    if (body.telegramBotEnabled !== undefined) patch.telegramBotEnabled = Boolean(body.telegramBotEnabled);
    // ── OTP (راند ۱۸) — ورود دومرحله‌ای با کد یکبارمصرف ──
    if (body.otpEnabled !== undefined) patch.otpEnabled = Boolean(body.otpEnabled);
    if (body.otpTestMode !== undefined) patch.otpTestMode = Boolean(body.otpTestMode);
    if (body.otpChannel !== undefined) patch.otpChannel = body.otpChannel === "sms" ? "sms" : "email";
    // کلید خالی یعنی «بدون تغییر» (مثل توکن تلگرام اما بدون خاموش‌کردن)
    if (patch.otpEmailApiKey === "") delete patch.otpEmailApiKey;
    if (patch.otpSmsApiKey === "") delete patch.otpSmsApiKey;
    if (body.autoBackupDays !== undefined) patch.autoBackupDays = Math.max(1, Math.min(365, Number(body.autoBackupDays) || 30));
    if (body.sessionDays !== undefined) patch.sessionDays = Math.max(1, Math.min(90, Number(body.sessionDays) || 14));
    if (body.loginMaxAttempts !== undefined) patch.loginMaxAttempts = Math.max(3, Math.min(20, Number(body.loginMaxAttempts) || 5));

    // توکن خالی یعنی حذف اتصال ربات
    if (patch.telegramBotToken === "") patch.telegramBotEnabled = false;

    const next = await saveSettings(patch);
    // توکن‌ها هرگز در پاسخ برنمی‌گردند (فقط در GET سوپرادمین)
    const { telegramBotToken: _hide, otpEmailApiKey: _oek2, otpSmsApiKey: _osk2, ...safeNext } = next;
    await audit({ user: me, action: "UPDATE_SETTINGS", entityType: "SETTINGS", meta: { fields: Object.keys(patch) } });
    return apiOk({ ok: true, settings: safeNext });
  } catch (e) {
    return handleApiError(e);
  }
}
