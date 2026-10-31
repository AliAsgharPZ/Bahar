import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * روش‌های ثبت حضور و غیاب — همه اختیاری و قابل‌اتصال؛ هیچ‌کدام اجباری نیست.
 * روش دستی (MANUAL) همیشه فعال است. بقیه را مدیر مدرسه از تنظیمات حضور فعال می‌کند:
 *  - QR: کارت QR روزانهٔ دانش‌آموز که معلم با دستگاه خودش اسکن می‌کند.
 *  - CODE: کد چرخان کلاس که معلم نمایش می‌دهد و دانش‌آموز خودش وارد می‌کند.
 *  - KIOSK: ثبت سریع روی تبلت مشترک مدرسه (برگهٔ لمسی).
 *  - EXTERNAL: سامانه‌های بیرونی (تشخیص چهره، دوربین CCTV، کارت NFC، گیت تردد)
 *    رویداد حضور را با «کلید اتصال» می‌فرستند. بهار خودش هیچ دادهٔ بیومتریکی
 *    را پردازش یا نگه‌داری نمی‌کند — فقط رویداد نهایی حضور را ثبت می‌کند.
 */

export const ATTENDANCE_METHODS = ["MANUAL", "QR", "CODE", "KIOSK", "GEO", "FACE", "CCTV", "NFC", "GATE", "OTHER"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const EXTERNAL_METHODS = ["FACE", "CCTV", "NFC", "GATE", "OTHER"] as const;

const SECRET = process.env.SESSION_SECRET ?? "bahar-dev-secret";

function hmac(input: string): string {
  return createHmac("sha256", SECRET).update(`checkin:${input}`).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/* ───────────── تنظیمات مدرسه ───────────── */

export type CheckinSettings = {
  qrEnabled: boolean;
  codeEnabled: boolean;
  kioskEnabled: boolean;
  externalEnabled: boolean;
  geoEnabled: boolean;
  geoLat: number | null;
  geoLng: number | null;
  geoRadiusM: number;
};

const ALL_OFF: CheckinSettings = {
  qrEnabled: false, codeEnabled: false, kioskEnabled: false, externalEnabled: false,
  geoEnabled: false, geoLat: null, geoLng: null, geoRadiusM: 200,
};

export async function getCheckinSettings(schoolId: string): Promise<CheckinSettings> {
  const row = await db.attendanceSettings.findUnique({ where: { schoolId } });
  if (!row) return { ...ALL_OFF };
  return {
    qrEnabled: row.qrEnabled,
    codeEnabled: row.codeEnabled,
    kioskEnabled: row.kioskEnabled,
    externalEnabled: row.externalEnabled,
    geoEnabled: row.geoEnabled,
    geoLat: row.geoLat,
    geoLng: row.geoLng,
    geoRadiusM: row.geoRadiusM,
  };
}

/* ───────────── توکن QR روزانهٔ دانش‌آموز ─────────────
 * قالب: BAHAR1.<studentId>.<jalaliDate>.<sig16>
 * امضا HMAC روی studentId|date است و فقط همان روز اعتبار دارد. */

export function studentQrPayload(studentId: string, jalaliDate: string): string {
  const sig = hmac(`${studentId}|${jalaliDate}`).slice(0, 16);
  return `BAHAR1.${studentId}.${jalaliDate}.${sig}`;
}

export function parseStudentQr(payload: string, todayJalali: string): { studentId: string } | null {
  const parts = String(payload ?? "").trim().split(".");
  if (parts.length !== 4 || parts[0] !== "BAHAR1") return null;
  const [, studentId, date, sig] = parts;
  if (!studentId || date !== todayJalali) return null;
  const expected = hmac(`${studentId}|${date}`).slice(0, 16);
  if (!safeEq(sig, expected)) return null;
  return { studentId };
}

/* ───────────── توکن QR روزانهٔ مدرسه ─────────────
 * قالب: SCH1.<schoolId>.<jalaliDate>.<sig16>
 * مدرسه هر روز یک QR دارد: روی دیوار ورودی چاپ می‌شود یا روی تگ NFC نوشته
 * می‌شود؛ دانش‌آموز با گوشی خودش اسکن می‌کند، وارد حسابش می‌شود و حضورش
 * ثبت می‌شود. توکن فقط همان روز و همان مدرسه معتبر است. */

export function schoolDailyToken(schoolId: string, jalaliDate: string): string {
  const sig = hmac(`school|${schoolId}|${jalaliDate}`).slice(0, 16);
  return `SCH1.${schoolId}.${jalaliDate}.${sig}`;
}

export function parseSchoolToken(token: string, todayJalali: string): { schoolId: string } | null {
  const parts = String(token ?? "").trim().split(".");
  if (parts.length !== 4 || parts[0] !== "SCH1") return null;
  const [, schoolId, date, sig] = parts;
  if (!schoolId || date !== todayJalali) return null;
  const expected = hmac(`school|${schoolId}|${date}`).slice(0, 16);
  if (!safeEq(sig, expected)) return null;
  return { schoolId };
}

/* ───────────── ژئوفنس ───────────── */

/** فاصلهٔ دو نقطه به متر (هاورساین) */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ───────────── کد چرخان کلاس ─────────────
 * کد ۶ رقمی از HMAC روی classId|date|window ساخته می‌شود؛ window هر ۱۰ دقیقه
 * عوض می‌شود و پنجرهٔ قبلی هم پذیرفته می‌شود تا مرز پنجره‌ها ثبت را خراب نکند. */

const WINDOW_MS = 10 * 60 * 1000;

function codeForWindow(classId: string, jalaliDate: string, windowIdx: number): string {
  const n = parseInt(hmac(`${classId}|${jalaliDate}|${windowIdx}`).slice(0, 8), 16) % 1000000;
  return String(n).padStart(6, "0");
}

export function currentClassCode(classId: string, jalaliDate: string, now = Date.now()): { code: string; windowEndsAt: number } {
  const w = Math.floor(now / WINDOW_MS);
  return { code: codeForWindow(classId, jalaliDate, w), windowEndsAt: (w + 1) * WINDOW_MS };
}

export function verifyClassCode(classId: string, jalaliDate: string, code: string, now = Date.now()): boolean {
  const c = String(code ?? "").trim();
  if (!/^\d{6}$/.test(c)) return false;
  const w = Math.floor(now / WINDOW_MS);
  return safeEq(c, codeForWindow(classId, jalaliDate, w)) || safeEq(c, codeForWindow(classId, jalaliDate, w - 1));
}

/* ───────────── کلید اتصال سامانه‌های بیرونی ───────────── */

export function newIntegrationKey(): { plain: string; hash: string } {
  const plain = `bhr_${randomBytes(24).toString("hex")}`;
  return { plain, hash: hashIntegrationKey(plain) };
}

export function hashIntegrationKey(plain: string): string {
  return createHash("sha256").update(String(plain ?? "")).digest("hex");
}

/* ───────────── ثبت یک رویداد حضور (هستهٔ مشترک همهٔ روش‌ها) ───────────── */

export async function recordCheckin(opts: {
  studentId: string;
  classId: string;
  date: string;
  status?: string;
  method: AttendanceMethod;
  sourceLabel?: string | null;
  recordedById?: string | null;
}): Promise<{ ok: true; created: boolean } | { ok: false }> {
  const status = opts.status && ["PRESENT", "LATE"].includes(opts.status) ? opts.status : "PRESENT";
  const existing = await db.attendance.findUnique({
    where: { studentId_date_period: { studentId: opts.studentId, date: opts.date, period: 0 } },
    select: { id: true },
  });
  // روش‌های خودکار فقط «ایجاد» می‌کنند و هرگز رکورد موجود را بازنویسی نمی‌کنند:
  // اولین ثبتِ روز می‌ماند و اصلاح وضعیت فقط با برگهٔ دستی کارکنان انجام می‌شود.
  if (existing) return { ok: true, created: false };
  await db.attendance.create({
    data: {
      studentId: opts.studentId,
      classId: opts.classId,
      date: opts.date,
      period: 0,
      status,
      method: opts.method,
      sourceLabel: opts.sourceLabel ?? null,
      recordedById: opts.recordedById ?? null,
    },
  });
  return { ok: true, created: true };
}
