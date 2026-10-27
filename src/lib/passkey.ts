import { randomBytes } from "crypto";
import { db } from "@/lib/db";

/* ============================================================
   بهار | Passkey (WebAuthn) — چالش‌های یک‌بارمصرف در جدول
   Setting نگه داشته می‌شوند (الگوی همان OTP): کلید یکتا +
   انقضای ۵ دقیقه‌ای + حذف هنگام مصرف (ضد بازپخش).
   ============================================================ */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function rpInfo(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  return { rpID: url.hostname, origin: url.origin };
}

export async function saveChallenge(scope: string, data: Record<string, unknown>): Promise<void> {
  const value = JSON.stringify({ ...data, exp: Date.now() + CHALLENGE_TTL_MS });
  await db.setting.upsert({
    where: { key: `webauthn:${scope}` },
    create: { key: `webauthn:${scope}`, value },
    update: { value },
  });
}

/** چالش را می‌خواند و همان‌جا حذف می‌کند (مصرف یک‌باره)؛ منقضی/غایب ⇒ null */
export async function takeChallenge<T extends Record<string, unknown>>(scope: string): Promise<T | null> {
  const key = `webauthn:${scope}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return null;
  await db.setting.delete({ where: { key } }).catch(() => {});
  try {
    const parsed = JSON.parse(row.value) as T & { exp?: number };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function newCeremonyId(): string {
  return randomBytes(16).toString("hex");
}

export function b64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const buf = Buffer.from(s, "base64url");
  const out = new Uint8Array(new ArrayBuffer(buf.byteLength));
  out.set(buf);
  return out;
}
