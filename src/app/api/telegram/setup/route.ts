import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { telegramApi, telegramWebhookSecret } from "@/lib/telegram-core";
import { requireUser, apiOk, handleApiError, ApiError, readJson, audit, rateLimit, ipOf, demoWriteBlock} from "@/lib/api";

/* ============================================================
   بهار | راه‌انداز وب‌هوک ربات تلگرام (راند ۱۹)
   GET  /api/telegram/setup             → وضعیت اتصال (getMe + getWebhookInfo)
   POST /api/telegram/setup { op: "connect" }    → ثبت وب‌هوک روی همین سایت
   POST /api/telegram/setup { op: "disconnect" } → حذف وب‌هوک
   فقط سوپرادمین. راز وب‌هوک از توکن ربات مشتق می‌شود و در
   هدر x-telegram-bot-api-secret-token به تلگرام معرفی شده —
   هر درخواست وب‌هوکِ بدون این راز رد می‌شود.
   ============================================================ */

function maskToken(token: string): string {
  if (token.length <= 8) return "•".repeat(token.length);
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

async function statusOf(token: string) {
  const [me, hook] = await Promise.all([
    telegramApi(token, "getMe"),
    telegramApi(token, "getWebhookInfo"),
  ]);
  const hookInfo = (hook.result ?? {}) as {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
    last_error_date?: number;
  };
  return {
    botOk: me.ok,
    bot: me.ok
      ? {
          username: (me.result as { username?: string } | undefined)?.username ?? null,
          firstName: (me.result as { first_name?: string } | undefined)?.first_name ?? null,
        }
      : null,
    botError: me.ok ? null : (me.description ?? "خطای شبکه در رسیدن به تلگرام"),
    webhook: {
      url: hookInfo.url ?? null,
      pendingUpdates: hookInfo.pending_update_count ?? 0,
      lastError: hookInfo.last_error_message ?? null,
      lastErrorAt: hookInfo.last_error_date ? new Date(hookInfo.last_error_date * 1000).toISOString() : null,
    },
    tokenMasked: maskToken(token),
  };
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    if (!rateLimit(`tgsetup:${ipOf(req)}:${me.id}`, 20, 60_000)) {
      throw new ApiError(429, "RATE_LIMITED", "درخواست‌های زیاد — کمی صبر کنید.");
    }
    const settings = await getSettings();
    if (!settings.telegramBotToken) {
      return apiOk({
        configured: false,
        enabled: false,
        botOk: false,
        bot: null,
        botError: null,
        webhook: { url: null, pendingUpdates: 0, lastError: null, lastErrorAt: null },
        tokenMasked: null,
      });
    }
    return apiOk({ configured: true, enabled: settings.telegramBotEnabled, ...(await statusOf(settings.telegramBotToken)) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    if (!rateLimit(`tgsetup:${ipOf(req)}:${me.id}`, 10, 60_000)) {
      throw new ApiError(429, "RATE_LIMITED", "درخواست‌های زیاد — کمی صبر کنید.");
    }
    const settings = await getSettings();
    if (!settings.telegramBotToken) {
      throw new ApiError(400, "NO_TOKEN", "ابتدا توکن ربات را از BotFather بگیرید و در همین صفحه ذخیره کنید.");
    }
    if (!settings.telegramBotEnabled) {
      throw new ApiError(400, "BOT_DISABLED", "ابتدا کلید «فعال‌سازی ربات تلگرام» را روشن کنید.");
    }

    const body = await readJson<{ op?: "connect" | "disconnect" }>(req).catch(() => ({}) as { op?: "connect" | "disconnect" });
    const op = body.op ?? "connect";
    const origin = req.nextUrl.origin;

    if (op === "disconnect") {
      const r = await telegramApi(settings.telegramBotToken, "deleteWebhook", { drop_pending_updates: false });
      if (!r.ok) throw new ApiError(502, "TG_ERROR", `حذف وب‌هوک ناموفق بود: ${r.description ?? "خطای شبکه"}`);
      await audit({ user: me, action: "TELEGRAM_WEBHOOK_DELETE", entityType: "SYSTEM" });
      return apiOk({ ok: true, disconnected: true, ...(await statusOf(settings.telegramBotToken)) });
    }

    // ── connect: ثبت وب‌هوک روی همین سایت ──
    const hookUrl = `${origin}/api/telegram/webhook`;
    const secret = telegramWebhookSecret(settings.telegramBotToken);
    const r = await telegramApi(settings.telegramBotToken, "setWebhook", {
      url: hookUrl,
      secret_token: secret,
      drop_pending_updates: true,
      allowed_updates: ["message"],
    });
    if (!r.ok) {
      throw new ApiError(502, "TG_ERROR", `ثبت وب‌هوک ناموفق بود: ${r.description ?? "خطای شبکه در رسیدن به تلگرام"}`);
    }
    await audit({ user: me, action: "TELEGRAM_WEBHOOK_SET", entityType: "SYSTEM", meta: { url: hookUrl } });
    return apiOk({ ok: true, connected: true, webhookUrl: hookUrl, ...(await statusOf(settings.telegramBotToken)) });
  } catch (e) {
    return handleApiError(e);
  }
}
