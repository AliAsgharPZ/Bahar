import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { verifyToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { hasPermission, parsePermissions } from "@/lib/roles";
import { getSettings } from "@/lib/settings";

// ============================================================
// بهار | گارد API + ابزار پاسخ + ثبت رخداد
// ============================================================

export type SessionUser = {
  id: string;
  nationalId: string;
  role: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  schoolId: string | null;
  /** راند ۱۹: مدرسهٔ فعال سوپرادمین/ادمین (پنل مدرسه) — پس از ادغام در schoolId */
  actingSchoolId?: string | null;
  mustChangePassword: boolean;
  isActive: boolean;
  shadNumber: string | null;
  impersonatedBy?: string | null; // سوپرادمین در حال مشاهده به عنوان این کاربر
};

/**
 * مسیرهای مجاز برای کاربرِ در انتظار تغییر رمز اولیه —
 * خودِ فرایند تغییر رمز، خروج و شخصی‌سازی تصویر پروفایل.
 */
const WRITE_ALLOWLIST_TEMP_PASSWORD = [
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/profile/image",
  "/api/profile/avatar-options",
];

/** بلوک مرکزی نوشتن — در getSessionUser اعمال می‌شود تا هیچ مسیری نتواند دورش بزند:
 *  ۱) مشاهده‌جانشینی سوپرادمین فقط-خواندنی است (حتی PATCH /api/auth/me و PUT /api/telegram).
 *  ۲) کاربر با رمز اولیه (mustChangePassword) تا تغییر رمز اجازه تغییردهنده ندارد. */
function assertWriteAllowed(req: NextRequest, user: SessionUser): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const path = req.nextUrl.pathname;
  if (user.impersonatedBy) {
    throw new ApiError(403, "IMPERSONATION_READONLY", "در حالت مشاهده‌جانشینی فقط خواندن مجاز است؛ عملیات تغییردهنده غیرفعال است.");
  }
  if (user.mustChangePassword && !WRITE_ALLOWLIST_TEMP_PASSWORD.some((p) => path.startsWith(p))) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "برای امنیت حساب، ابتدا رمز عبور اولیه را تغییر دهید (پروفایل ← تغییر رمز).");
  }
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || typeof payload.sub !== "string") return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, nationalId: true, role: true, permissions: true,
      firstName: true, lastName: true, schoolId: true,
      mustChangePassword: true, isActive: true, shadNumber: true,
      tokenVersion: true,
    },
  });
  if (!user || !user.isActive) return null;
  // ابطال نشست‌ها با tokenVersion (خروج اجباری همه دستگاه‌ها)
  if (typeof payload.tv === "number" && payload.tv !== user.tokenVersion) return null;
  const sessionUser: SessionUser = {
    ...user,
    permissions: parsePermissions(user.permissions),
    impersonatedBy: typeof payload.imp === "string" ? payload.imp : null,
  };

  /* راند ۱۹ — ادغام مدرسهٔ فعال در schoolId:
     سوپرادمین/ادمینِ بدون مدرسه وقتی وارد «پنل مدرسه» شده‌اند (کوکی
     bahar_acting_school از مسیر /api/schools/[id]/enter ست می‌شود)،
     schoolId مؤثر همان مدرسهٔ فعال می‌شود تا همهٔ مسیرهایی که از
     requireSchoolId/me.schoolId استفاده می‌کنند بی‌دردسر کار کنند.
     امنیت: کوکی فقط برای نقش سرویسِ دارای مجوز enter_school_panel
     معتبر است، هرگز schoolId کاربران مدرسه‌ای را دور نمی‌زند و
     وجود/فعال‌بودن مدرسه در هر درخواست سمت سرور اعتبارسنجی می‌شود. */
  if (!sessionUser.schoolId) {
    const actingCookie = req.cookies.get("bahar_acting_school")?.value;
    if (
      actingCookie &&
      (sessionUser.role === "SUPER_ADMIN" ||
        (sessionUser.role === "ADMIN" && hasPermission(sessionUser, "enter_school_panel")))
    ) {
      const acting = await db.school.findUnique({
        where: { id: actingCookie },
        select: { id: true, isActive: true },
      });
      if (acting?.isActive) {
        sessionUser.schoolId = acting.id;
        sessionUser.actingSchoolId = acting.id;
      }
    }
  }

  assertWriteAllowed(req, sessionUser);
  return sessionUser;
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** الزام ورود — به‌اختیاری با نقش‌های مجاز */
export async function requireUser(req: NextRequest, roles?: string[]): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "برای این عملیات باید وارد شوید.");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "برای این عملیات دسترسی ندارید.");
  }
  return user;
}

/** الزام دسترسی ریز (مثلاً enter_grades) */
export async function requirePermission(req: NextRequest, key: string): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "برای این عملیات باید وارد شوید.");
  if (!hasPermission(user, key)) {
    throw new ApiError(403, "FORBIDDEN", "دسترسی «" + key + "» برای شما فعال نیست.");
  }
  return user;
}

/** کاربر باید به مدرسه‌ای متصل باشد */
export function requireSchoolId(user: SessionUser): string {
  if (!user.schoolId) {
    throw new ApiError(400, "NO_SCHOOL", "کاربر به مدرسه‌ای متصل نیست.");
  }
  return user.schoolId;
}

/**
 * مدرسه فعال سوپرادمین/ادمین (کوکی bahar_acting_school) — با اعتبارسنجی سمت سرور.
 * کوکی از سمت کلاینت قابل جعل است؛ فقط برای نقش سرویسِ دارای مجوز enter_school_panel معتبر است
 * و هرگز نباید schoolId کاربران مدرسه‌ای (مدیر/معاون/معلم) را دور بزند.
 */
export function actingSchoolIdFor(req: NextRequest, me: SessionUser): string | null {
  const cookie = req.cookies.get("bahar_acting_school")?.value ?? null;
  if (!cookie) return null;
  if (me.role === "SUPER_ADMIN") return cookie;
  if (me.role === "ADMIN" && hasPermission(me, "enter_school_panel")) return cookie;
  return null;
}

export function apiOk(data: unknown = { ok: true }): NextResponse {
  return NextResponse.json(data as Record<string, unknown>);
}

export function apiErr(status: number, message: string, code = "ERROR", extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: { code, message, ...(extra ?? {}) } }, { status });
}

/** تبدیل خطا به پاسخ JSON */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof ApiError) return apiErr(e.status, e.message, e.code);
  if (e instanceof Error) {
    // خطاهای یکتایی پرایسما
    if (e.message.includes("Unique constraint")) {
      return apiErr(409, "رکورد تکراری است؛ مقدار یکتا (کد ملی/شماره) قبلاً ثبت شده.", "DUPLICATE");
    }
    console.error("[API]", e.message);
    return apiErr(500, "خطای داخلی سرور رخ داد.", "INTERNAL");
  }
  return apiErr(500, "خطای ناشناخته.", "INTERNAL");
}

/** ثبت رخداد در گزارش فعالیت */
export async function audit(params: {
  user?: SessionUser | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  schoolId?: string | null;
  ip?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.user?.id ?? null,
        userName: params.user ? `${params.user.firstName} ${params.user.lastName}` : null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        meta: params.meta ? JSON.stringify(params.meta) : null,
        schoolId: params.schoolId ?? params.user?.schoolId ?? null,
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    console.error("[AUDIT]", e);
  }
}

/** کد یکتای تیکت — رمزنگارانه تصادفی با فضای ۶ رقمی و retry در برابر تصادم */
export async function uniqueTicketCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = `BK-${crypto.randomInt(100000, 1000000)}`;
    const exists = await db.ticket.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  // FIX: پشتیبان هم از randomUUID مشتق می‌شود — مثل قبل بر پایهٔ زمان نیست تا در همان میلی‌ثانیه تصادم نگیرد
  for (let i = 0; i < 8; i++) {
    const candidate = `BK-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const exists = await db.ticket.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return `BK-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/** خواندن بدنه JSON با مدیریت خطا */
export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "BAD_JSON", "بدنه درخواست نامعتبر است.");
  }
}

// ============================================================
// اعتبارسنج‌های مشترک ورودی — تاریخ/عدد (راند ۱۶)
// قبلاً هر مسیر new Date(...) و Number(...) بدون گارد داشت → 500
// ============================================================

/** تبدیل امن به Date — null یعنی نامعتبر (400 با پیام فارسی) */
export function toDate(v: unknown, name = "تاریخ"): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v);
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** تبدیل امن به عدد صحیح محدوده‌دار — null یعنی نامعتبر */
export function toInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[٬,\s]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n);
}

/** کد وضعیت/enum مجاز — رشته خام را در برابر فهرست سفید می‌سنجد */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback?: T): T | null {
  if (typeof v !== "string") return fallback ?? null;
  const hit = allowed.find((a) => a === v);
  return hit ?? fallback ?? null;
}

// ============================================================
// حساب دمو — محدودیت نوشتن (سلامت داده‌ها و سرور)
// ============================================================

/** آیا کاربر جاری یکی از حساب‌های دموی عمومی است؟ */
export async function isDemoUser(user: { nationalId: string } | null | undefined): Promise<boolean> {
  if (!user) return false;
  try {
    const s = await getSettings();
    if (!s.demoEnabled) return false;
    return user.nationalId === s.demoManagerNationalId || user.nationalId === s.demoStudentNationalId;
  } catch {
    return false;
  }
}

const DEMO_BLOCK_MSG = "این قابلیت در حساب دمو غیرفعال است تا داده نمونه سالم بماند؛ برای تست کامل، مدرسه خود را ثبت کنید.";

/**
 * گارد نوشتن برای حساب دمو — در ابتدای همه APIهای تغییردهنده صدا بزنید.
 * اگر کاربر دمو بود، پاسخ 403 برمی‌گرداند؛ در غیر این صورت null.
 */
export async function demoWriteBlock(user: { nationalId: string } | null | undefined): Promise<NextResponse | null> {
  if (await isDemoUser(user)) {
    return NextResponse.json({ error: { code: "DEMO_READONLY", message: DEMO_BLOCK_MSG } }, { status: 403 });
  }
  return null;
}

// ============================================================
// محدودساز نرخ (in-memory) — مقاوم‌سازی در برابر Brute-force و اسپم
// ============================================================

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** true یعنی مجاز؛ false یعنی بیش از حد مجاز (429) */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  if (b.count > limit) return false;
  return true;
}

/** کلید نرخ بر اساس IP (پشت پروکسی هم درست کار می‌کند) */
export function ipOf(req: NextRequest): string {
  return (
    // Set by the Cloudflare edge and not spoofable by clients — prefer it
    // over X-Forwarded-For, whose first hop a client can claim freely.
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

/** شمارش شکست‌های ثبت‌شده برای یک کلید — بدون افزایش (برای تصمیم تشدید کپچا) */
export function failGet(key: string): number {
  const b = buckets.get(key);
  if (!b || b.resetAt < Date.now()) return 0;
  return b.count;
}

/** ثبت یک شکست (مثلاً رمز/کد نادرست) — شمارنده تشدید کپچا؛ خروجی: تعداد فعلی */
export function failIncr(key: string, windowMs = 15 * 60_000): number {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  b.count += 1;
  return b.count;
}

/** پاکسازی شمارنده شکست (پس از موفقیت) */
export function failReset(key: string): void {
  buckets.delete(key);
}

/** پاکسازی دوره‌ای باکت‌های منقضی (جلوگیری از نشت حافظه) — فقط Node؛
 *  روی Workers تایمر ماژول‌پایدار نیست و با هر ایزوله بی‌اثر/گمراه‌کننده است. */
if (typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair === "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }, 60_000).unref?.();
}

