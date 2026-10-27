import { NextRequest } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson } from "@/lib/api";
import { rpInfo, saveChallenge, takeChallenge, b64urlEncode } from "@/lib/passkey";

/* ============================================================
   بهار | Passkey — مدیریت کلیدهای کاربر واردشده:
   GET فهرست، POST ثبت کلید تازه (options/verify)، DELETE حذف.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const keys = await db.passkeyCredential.findMany({
      where: { userId: me.id },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return apiOk({ keys });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { rpID, origin } = rpInfo(req);
    const body = await readJson<{ phase?: string; response?: never; label?: string }>(req);
    const raw = body as unknown as { phase?: string; response?: Record<string, unknown>; label?: string };

    if (body.phase === "options") {
      const user = await db.user.findUnique({ where: { id: me.id }, select: { nationalId: true } });
      const existing = await db.passkeyCredential.findMany({ where: { userId: me.id }, select: { credentialId: true, transports: true } });
      const options = await generateRegistrationOptions({
        rpName: "بهار",
        rpID,
        userID: new TextEncoder().encode(me.id),
        userName: user?.nationalId ?? me.id,
        attestationType: "none",
        excludeCredentials: existing.map((c) => ({
          id: c.credentialId,
          transports: c.transports ? (JSON.parse(c.transports) as never[]) : undefined,
        })),
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      });
      await saveChallenge(`reg:${me.id}`, { challenge: options.challenge });
      return apiOk({ options });
    }

    if (body.phase === "verify") {
      const saved = await takeChallenge<{ challenge: string }>(`reg:${me.id}`);
      if (!saved) return apiErr(400, "نشست ثبت کلید منقضی شده است؛ دوباره تلاش کنید.", "CHALLENGE_GONE");
      const verification = await verifyRegistrationResponse({
        response: raw.response as never,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return apiErr(400, "تأیید کلید ناموفق بود.", "VERIFY_FAILED");
      }
      const cred = verification.registrationInfo.credential;
      await db.passkeyCredential.create({
        data: {
          userId: me.id,
          credentialId: cred.id,
          publicKey: b64urlEncode(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports ? JSON.stringify(cred.transports) : null,
          deviceLabel: (body.label ?? "Passkey").trim().slice(0, 60) || "Passkey",
        },
      });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_PHASE");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    await db.passkeyCredential.deleteMany({ where: { id, userId: me.id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
