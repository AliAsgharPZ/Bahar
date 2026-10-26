import crypto from "crypto";
import { getSessionSecret } from "@/lib/secret";
import { db } from "@/lib/db";

// ============================================================
// بهار | دروازه شاد — دو حالت کار:
//
// ۱) INTERNAL (شبیه‌سازی داخلی — پیش‌فرض):
//    شبکهٔ شاد داخل خود بهار شبیه‌سازی شده است تا بدون هیچ
//    سرویس جانبی کار کند (API سبک تلگرام):
//      auth.sendCode      → کد تایید ۵ رقمی با مهلت ۵ دقیقه
//      auth.signIn        → ورود با کد و ایجاد نشست AUTHORIZED (۳۰ روز)
//      messages.sendMessage → تحویل داخلی پیام (SENT در صف خروجی)
//    در این حالت کد تایید برای نمایش به مدیر برگردانده می‌شود
//    (معادل «رسیدن کد به اپ شاد مدیر»).
//
// ۲) EXTERNAL (دروازهٔ واقعی — اختیاری):
//    سرویس جانبی پایتون (mini-services/shad-gateway) با کتابخانهٔ
//    shadapi به حساب شاد مدیر وصل می‌شود و این لایه فقط از طریق
//    HTTP با آن صحبت می‌کند (github.com/HoseanRC/shad-api):
//      POST /verify {token,...} → اعتبارسنجی توکن و اطلاعات حساب
//      POST /send   {token,...} → ارسال واقعی پیام به شماره شاد
//    توکن auth حساب مدیر، رمزنگاری‌شده (AES-256-GCM) ذخیره می‌شود.
//    اگر مدیر توکن واقعی وارد کند (shadConnect) نشست EXTERNAL
//    می‌شود و ارسال‌ها از دروازهٔ واقعی می‌گذرند.
// ============================================================

const SESSION_TTL_DAYS = 30;
const CODE_TTL_MS = 5 * 60 * 1000; // ۵ دقیقه
/** حداکثر تلاش برای ورود با هر کد تایید (ضد بروت‌فورس کد ۵ رقمی) */
const CODE_MAX_ATTEMPTS = 5;

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8787";

/** آدرس دروازه شاد — متغیر محیطی اولویت دارد؛ وگرنه از تنظیمات سامانه (settings.shadGatewayUrl) */
async function gatewayUrl(): Promise<string> {
  if (process.env.SHAD_GATEWAY_URL) return process.env.SHAD_GATEWAY_URL;
  try {
    const { getSettings } = await import("@/lib/settings");
    const s = await getSettings();
    if (s.shadGatewayUrl && /^https?:\/\//.test(s.shadGatewayUrl)) return s.shadGatewayUrl;
  } catch { /* خالی — تنظیمات در دسترس نیست */ }
  return DEFAULT_GATEWAY_URL;
}
const SESSION_SECRET = getSessionSecret();

export class ShadApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** حالت اتصال نشست شاد مدرسه */
export type ShadMode = "NONE" | "INTERNAL" | "EXTERNAL";

/* ---------- AES-256-GCM برای ذخیره امن توکن (حالت EXTERNAL) ---------- */

function aesKey(): Buffer {
  return crypto.scryptSync(SESSION_SECRET, "bahar-shad-token", 32);
}

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

function decryptToken(payload: string): string | null {
  try {
    const [ivB, tagB, dataB] = payload.split(".");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      aesKey(),
      Buffer.from(ivB, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64url")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/* ---------- هش کد تایید (auth.sendCode / auth.signIn) ---------- */

function hashCode(code: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`shad-code:${code}`)
    .digest("hex");
}

/* ---------- فراخوانی دروازه (فقط حالت EXTERNAL) ---------- */

async function gatewayCall<T>(
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${await gatewayUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok && res.status >= 500) {
      throw new ShadApiError("GATEWAY_ERROR", `خطای دروازه شاد (${res.status})`);
    }
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
    if (!res.ok) {
      throw new ShadApiError(
        data?.code ?? "GATEWAY_ERROR",
        data?.error ?? `خطای دروازه شاد (${res.status})`
      );
    }
    return data;
  } catch (e) {
    if (e instanceof ShadApiError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ShadApiError("GATEWAY_TIMEOUT", "پاسخی از دروازه شاد دریافت نشد (مهلت تمام شد).");
    }
    throw new ShadApiError("GATEWAY_OFFLINE", "دروازه شاد در دسترس نیست؛ سرویس shad-gateway را اجرا کنید.");
  } finally {
    clearTimeout(t);
  }
}

/* سلامت دروازهٔ واقعی — با کش ۶۰ ثانیه‌ای تا هر بارِ دیدن صفحهٔ شاد
   ۲.۵ ثانیه منتظر timeout نمانیم (وقتی دروازه نصب نشده باشد) */
let gatewayHealthCache: { at: number; value: { online: boolean; version?: string } } | null = null;

export async function gatewayHealth(force = false): Promise<{
  online: boolean;
  version?: string;
}> {
  if (!force && gatewayHealthCache && Date.now() - gatewayHealthCache.at < 60_000) {
    return gatewayHealthCache.value;
  }
  let value: { online: boolean; version?: string };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${await gatewayUrl()}/health`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (res.ok) {
      const d = (await res.json().catch(() => ({}))) as { version?: string };
      value = { online: true, version: d.version };
    } else {
      value = { online: false };
    }
  } catch {
    value = { online: false };
  }
  gatewayHealthCache = { at: Date.now(), value };
  return value;
}

/* ---------- auth.sendCode — ارسال کد تایید به شماره شاد مدیر (شبیه‌سازی داخلی) ---------- */

/**
 * ارسال کد تایید ۵ رقمی برای شماره شاد مدیر مدرسه.
 * کد هش می‌شود و با مهلت ۵ دقیقه در نشست ذخیره می‌شود.
 * خروجی code فقط برای «نمایش به مدیر» برگردانده می‌شود (معادل
 * رسیدن کد به اپ شاد او در نسخهٔ واقعی).
 */
export async function shadSendCode(
  schoolId: string,
  phone: string,
  authorizedBy: string
): Promise<{ phoneCodeHash: string; code: string; expiresAt: Date }> {
  const code = String(crypto.randomInt(10000, 99999));
  const phoneCodeHash = crypto.randomBytes(16).toString("hex");
  const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.shadSession.upsert({
    where: { schoolId },
    create: {
      schoolId,
      phone,
      verificationCodeHash: hashCode(code),
      codeExpiresAt,
      codeSentAt: new Date(),
      codeAttempts: 0,
      status: "PENDING",
      authorizedBy,
    },
    update: {
      phone,
      verificationCodeHash: hashCode(code),
      codeExpiresAt,
      codeSentAt: new Date(),
      codeAttempts: 0,
      status: "PENDING",
      apiSessionId: null,
      authorizedAt: null,
      expiresAt: null,
      authorizedBy,
    },
  });

  return { phoneCodeHash, code, expiresAt: codeExpiresAt };
}

/* ---------- auth.signIn — ورود به حساب شاد مدیر با کد تایید ---------- */

export async function shadSignIn(
  schoolId: string,
  phone: string,
  code: string,
  accountName?: string
): Promise<{ apiSessionId: string }> {
  const session = await db.shadSession.findUnique({ where: { schoolId } });
  if (!session || session.phone !== phone) {
    throw new ShadApiError("PHONE_NUMBER_UNOCCUPIED", "شماره شاد یافت نشد؛ ابتدا کد تایید بگیرید.");
  }
  if (!session.verificationCodeHash || !session.codeExpiresAt) {
    throw new ShadApiError("PHONE_CODE_EMPTY", "کد تاییدی صادر نشده است.");
  }
  if (session.codeExpiresAt.getTime() < Date.now()) {
    throw new ShadApiError("PHONE_CODE_EXPIRED", "کد تایید منقضی شده است. دوباره کد بگیرید.");
  }
  if (session.codeAttempts >= CODE_MAX_ATTEMPTS) {
    throw new ShadApiError("PHONE_CODE_EXPIRED", "تلاش‌های ناموفق زیاد بود؛ کد تایید جدید بگیرید.");
  }
  if (session.verificationCodeHash !== hashCode(code.trim())) {
    await db.shadSession.update({
      where: { schoolId },
      data: { codeAttempts: { increment: 1 } },
    });
    const left = CODE_MAX_ATTEMPTS - (session.codeAttempts + 1);
    throw new ShadApiError(
      "PHONE_CODE_INVALID",
      left > 0
        ? `کد تایید نادرست است (${left} تلاش باقی مانده).`
        : "کد تایید نادرست است؛ کد تایید جدید بگیرید."
    );
  }

  const apiSessionId = crypto.randomBytes(20).toString("hex");
  await db.shadSession.update({
    where: { schoolId },
    data: {
      status: "AUTHORIZED",
      apiSessionId,
      authorizedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000),
      // نشست داخلی توکن واقعی ندارد — حالت INTERNAL
      authTokenEnc: null,
      accountGuid: null,
      accountName: accountName?.trim() || null,
      verificationCodeHash: null,
      codeExpiresAt: null,
      codeSentAt: null,
      codeAttempts: 0,
    },
  });
  return { apiSessionId };
}

/* ---------- اتصال حساب مدیر (حالت EXTERNAL با توکن web.shad.ir) ---------- */

type VerifyResult = {
  ok: boolean;
  guid: string;
  name: string;
  phone: string;
};

/** اتصال حساب شاد مدیر با توکن auth (از web.shad.ir) — دروازهٔ واقعی */
export async function shadConnect(
  schoolId: string,
  phone: string,
  token: string,
  authorizedBy: string
) {
  const clean = token.trim();
  if (clean.length < 20) {
    throw new ShadApiError("BAD_TOKEN", "توکن شاد نامعتبر است.");
  }

  // اعتبارسنجی توکن توسط دروازه (فراخوانی واقعی شبکه شاد)
  // FIX (راند ۱۹-a): شماره شاد مدیر هم فرستاده می‌شود — دروازه بدون آن
  // خطای BAD_PHONE می‌دهد و اتصال واقعی هرگز موفق نمی‌شد.
  const info = await gatewayCall<VerifyResult>("/verify", { token: clean, phone }, 55000);

  const apiSessionId = crypto.randomBytes(20).toString("hex");
  await db.shadSession.upsert({
    where: { schoolId },
    create: {
      schoolId,
      phone: info.phone,
      authTokenEnc: encryptToken(clean),
      accountGuid: info.guid,
      accountName: info.name,
      status: "AUTHORIZED",
      apiSessionId,
      authorizedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000),
      authorizedBy,
    },
    update: {
      phone: info.phone,
      authTokenEnc: encryptToken(clean),
      accountGuid: info.guid,
      accountName: info.name,
      status: "AUTHORIZED",
      apiSessionId,
      authorizedAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000),
      authorizedBy,
      verificationCodeHash: null,
      codeExpiresAt: null,
      codeSentAt: null,
      codeAttempts: 0,
    },
  });

  return { apiSessionId, account: { guid: info.guid, name: info.name, phone: info.phone } };
}

/** وضعیت نشست شاد مدرسه + حالت اتصال (INTERNAL/EXTERNAL) */
export async function shadStatus(schoolId: string) {
  const s = await db.shadSession.findUnique({ where: { schoolId } });
  const connected =
    !!s &&
    s.status === "AUTHORIZED" &&
    !!s.expiresAt &&
    s.expiresAt.getTime() > Date.now();
  const mode: ShadMode = !s
    ? "NONE"
    : s.authTokenEnc
      ? "EXTERNAL"
      : "INTERNAL";
  return {
    connected,
    status: s?.status ?? "NONE",
    mode,
    phone: s?.phone ?? null,
    accountName: s?.accountName ?? null,
    expiresAt: s?.expiresAt ?? null,
    authorizedAt: s?.authorizedAt ?? null,
    /** کد تایید در جریان است؟ (فرم ورود کد را نشان بده) */
    pendingCode: !!s && s.status !== "AUTHORIZED" && !!s.verificationCodeHash,
  };
}

/** قطع اتصال حساب شاد مدرسه */
export async function shadRevoke(schoolId: string) {
  await db.shadSession.updateMany({
    where: { schoolId },
    data: {
      status: "REVOKED",
      authTokenEnc: null,
      accountGuid: null,
      accountName: null,
      apiSessionId: null,
      expiresAt: null,
      verificationCodeHash: null,
      codeExpiresAt: null,
      codeSentAt: null,
      codeAttempts: 0,
    },
  });
}

/* ---------- messages.sendMessage — ارسال پیام ---------- */

/** آیا نشستِ AUTHORIZED واقعی است (توکن دروازه دارد)؟ */
function isExternalSession(session: {
  status: string;
  expiresAt: Date | null;
  authTokenEnc: string | null;
}): boolean {
  return (
    session.status === "AUTHORIZED" &&
    !!session.expiresAt &&
    session.expiresAt.getTime() > Date.now() &&
    !!session.authTokenEnc
  );
}

/** آیا نشستِ AUTHORIZED داخلی است (شبیه‌سازی — بدون توکن)؟ */
function isInternalSession(session: {
  status: string;
  expiresAt: Date | null;
  authTokenEnc: string | null;
}): boolean {
  return (
    session.status === "AUTHORIZED" &&
    !!session.expiresAt &&
    session.expiresAt.getTime() > Date.now() &&
    !session.authTokenEnc
  );
}

/** ارسال پیام متنی به شماره شاد کاربر (از طریق حساب مدیر) */
export async function shadSendMessage(params: {
  schoolId: string;
  toShadNumber: string;
  body: string;
  purpose?: string;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientFirstName?: string | null;
}): Promise<{ ok: boolean; id: string; status: string; error?: string }> {
  const session = await db.shadSession.findUnique({ where: { schoolId: params.schoolId } });
  const ext = session ? isExternalSession(session) : false;
  const int = session ? isInternalSession(session) : false;
  const authorized = ext || int;

  const entry = await db.shadOutbox.create({
    data: {
      schoolId: params.schoolId,
      sessionId: session?.id ?? null,
      recipientUserId: params.recipientUserId ?? null,
      recipientName: params.recipientName ?? null,
      recipientShadNumber: params.toShadNumber,
      body: params.body,
      purpose: params.purpose ?? "CREDENTIALS",
      status: "QUEUED",
      attempts: 0,
    },
  });

  if (!authorized) {
    // شاد متصل نیست → پیام در صف می‌ماند تا اتصال مدیر و ارسال گروهی
    const queued = await db.shadOutbox.update({
      where: { id: entry.id },
      data: { status: "QUEUED", error: "NO_SESSION" },
    });
    return { ok: false, id: queued.id, status: "QUEUED", error: "NO_AUTHORIZED_SESSION" };
  }

  /* حالت INTERNAL — شبکهٔ شبیه‌سازی‌شدهٔ بهار: پیام تحویل می‌شود */
  if (!ext) {
    const sent = await db.shadOutbox.update({
      where: { id: entry.id },
      data: { status: "SENT", sentAt: new Date(), error: null, attempts: { increment: 1 } },
    });
    return { ok: true, id: sent.id, status: "SENT" };
  }

  /* حالت EXTERNAL — ارسال واقعی از طریق دروازه */
  const token = decryptToken(session!.authTokenEnc!);
  if (!token) {
    const failed = await db.shadOutbox.update({
      where: { id: entry.id },
      data: { status: "FAILED", error: "TOKEN_DECRYPT_FAILED" },
    });
    return { ok: false, id: failed.id, status: "FAILED", error: "TOKEN_DECRYPT_FAILED" };
  }

  try {
    await gatewayCall(
      "/send",
      {
        token,
        phone: params.toShadNumber,
        first_name: params.recipientFirstName ?? params.recipientName ?? "",
        text: params.body,
      },
      35000
    );
    const sent = await db.shadOutbox.update({
      where: { id: entry.id },
      data: { status: "SENT", sentAt: new Date(), error: null, attempts: { increment: 1 } },
    });
    return { ok: true, id: sent.id, status: "SENT" };
  } catch (e) {
    const code = e instanceof ShadApiError ? e.code : "SEND_FAILED";
    const msg = e instanceof Error ? e.message : "SEND_FAILED";
    const failed = await db.shadOutbox.update({
      where: { id: entry.id },
      data: { status: "FAILED", error: `${code}: ${msg}`.slice(0, 300), attempts: { increment: 1 } },
    });
    return { ok: false, id: failed.id, status: "FAILED", error: code };
  }
}

/** قالب پیام اعتبارنامه بهار (ارسال با شاد) */
export function credentialsMessage(params: {
  schoolName: string;
  nationalId: string;
  password: string;
  roleLabel: string;
  fullName: string;
}): string {
  return [
    "بهار | سامانه مدیریت مدرسه",
    `مدرسه: ${params.schoolName}`,
    "",
    `${params.fullName} عزیز (${params.roleLabel})،`,
    "حساب کاربری شما ایجاد شد:",
    `نام کاربری (کد ملی): ${params.nationalId}`,
    `رمز عبور: ${params.password}`,
    "",
    "برای امنیت بیشتر، پس از ورود اول رمز عبور را تغییر دهید.",
  ].join("\n");
}

/** ارسال اعتبارنامه یک کاربر به شماره شاد ثبت‌شده‌اش */
export async function deliverCredentials(user: {
  id: string;
  nationalId: string;
  tempPassword: string | null;
  firstName: string;
  lastName: string;
  role: string;
  shadNumber: string | null;
  schoolId: string | null;
}, schoolName: string, roleLabel: string) {
  if (!user.shadNumber || !user.tempPassword || !user.schoolId) {
    return { ok: false, id: "", status: "FAILED", error: "NO_SHAD_NUMBER_OR_PASSWORD" } as const;
  }
  const body = credentialsMessage({
    schoolName,
    nationalId: user.nationalId,
    password: user.tempPassword,
    roleLabel,
    fullName: `${user.firstName} ${user.lastName}`,
  });
  return shadSendMessage({
    schoolId: user.schoolId,
    toShadNumber: user.shadNumber,
    body,
    purpose: "CREDENTIALS",
    recipientUserId: user.id,
    recipientName: `${user.firstName} ${user.lastName}`,
    recipientFirstName: user.firstName,
  });
}

/* ---------- صف خروجی: ارسال مجدد پیام‌های QUEUED ---------- */

/** حداکثر تلاش برای هر پیام صف‌شده قبل از FAILED شدن دائمی */
const OUTBOX_MAX_ATTEMPTS = 10;

/**
 * ارسال مجدد پیام‌های صف‌شده یک مدرسه — وقتی حساب شاد مدیر متصل است.
 * توسط زمان‌بند (هر ۱۵ دقیقه) و دکمه «ارسال گروهی» صدا زده می‌شود.
 * نشست داخلی → تحویل شبیه‌سازی‌شده؛ نشست واقعی → ارسال از دروازه
 * (پیام‌هایی که پیام‌رسان قبول نکند FAILED می‌شوند؛ خطای شبکه/موقت
 * پیام را در صف نگه می‌دارد؛ توکن منقضی کل جارو را متوقف می‌کند).
 */
export async function retryQueuedOutboxForSchool(
  schoolId: string,
  limit = 50
): Promise<{ sent: number; failed: number; skipped: number; remaining: number }> {
  const session = await db.shadSession.findUnique({ where: { schoolId } });
  const external = session ? isExternalSession(session) : false;
  const internal = session ? isInternalSession(session) : false;
  if (!external && !internal) {
    const remaining = await db.shadOutbox.count({ where: { schoolId, status: "QUEUED" } });
    return { sent: 0, failed: 0, skipped: 0, remaining };
  }

  const queued = await db.shadOutbox.findMany({
    where: { schoolId, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  /* نشست داخلی: شبکهٔ شبیه‌سازی‌شده همهٔ صف را تحویل می‌دهد */
  if (internal) {
    let sent = 0;
    for (const msg of queued) {
      if (msg.attempts >= OUTBOX_MAX_ATTEMPTS) {
        await db.shadOutbox.update({
          where: { id: msg.id },
          data: { status: "FAILED", error: `MAX_ATTEMPTS (${OUTBOX_MAX_ATTEMPTS})` },
        });
        continue;
      }
      await db.shadOutbox.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), error: null, attempts: { increment: 1 } },
      });
      sent++;
    }
    const remaining = await db.shadOutbox.count({ where: { schoolId, status: "QUEUED" } });
    return { sent, failed: 0, skipped: 0, remaining };
  }

  /* نشست واقعی (EXTERNAL) */
  const token = decryptToken(session!.authTokenEnc!);
  if (!token) {
    const remaining = await db.shadOutbox.count({ where: { schoolId, status: "QUEUED" } });
    return { sent: 0, failed: 0, skipped: 0, remaining };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deadSession = false;

  for (const msg of queued) {
    if (msg.attempts >= OUTBOX_MAX_ATTEMPTS) {
      await db.shadOutbox.update({
        where: { id: msg.id },
        data: { status: "FAILED", error: `MAX_ATTEMPTS (${OUTBOX_MAX_ATTEMPTS})` },
      });
      skipped++;
      continue;
    }
    try {
      await gatewayCall(
        "/send",
        {
          token,
          phone: msg.recipientShadNumber,
          first_name: msg.recipientName ?? "",
          text: msg.body,
        },
        35000
      );
      await db.shadOutbox.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), error: null, attempts: { increment: 1 } },
      });
      sent++;
    } catch (e) {
      const code = e instanceof ShadApiError ? e.code : "SEND_FAILED";
      const errMsg = (e instanceof Error ? e.message : "SEND_FAILED").slice(0, 280);
      // خطای گیرنده/توکن دائمی است → FAILED؛ خطای شبکه/موقت → در صف بماند
      const permanent =
        code === "BAD_TOKEN" || code === "INVALID_AUTH" || code === "BAD_PHONE" ||
        code === "BAD_TEXT" || code === "PHONE_NOT_ON_SHAD";
      await db.shadOutbox.update({
        where: { id: msg.id },
        data: {
          status: permanent ? "FAILED" : "QUEUED",
          error: `${code}: ${errMsg}`,
          attempts: { increment: 1 },
        },
      });
      if (code === "BAD_TOKEN" || code === "INVALID_AUTH") {
        deadSession = true; // توکن مدیر منقضی شده — ادامه بی‌فایده است
        break;
      }
      if (!permanent) failed++;
      else skipped++;
    }
    // مکث کوتاه برای احترام به محدودیت نرخ شاد
    await new Promise((r) => setTimeout(r, 300));
  }

  // توکن منقضی شد → وضعیت نشست را هم به‌روز کن تا UI درست نشان دهد
  if (deadSession && session) {
    await db.shadSession.update({
      where: { id: session.id },
      data: { status: "REVOKED", authTokenEnc: null },
    }).catch(() => { /* خالی */ });
  }

  const remaining = await db.shadOutbox.count({ where: { schoolId, status: "QUEUED" } });
  return { sent, failed, skipped, remaining };
}
