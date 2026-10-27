import { NextRequest } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, audit } from "@/lib/api";
import { signToken, sessionCookie } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { rpInfo, saveChallenge, takeChallenge, newCeremonyId, b64urlDecode } from "@/lib/passkey";

/* ============================================================
   بهار | ورود با Passkey — بدون رمز: کد ملی ⇒ گزینه‌های
   WebAuthn با کلیدهای ثبت‌شدهٔ همان کاربر ⇒ تأیید امضا و
   شمارنده ⇒ صدور همان نشست استاندارد سامانه.
   ============================================================ */

export async function POST(req: NextRequest) {
  try {
    const { rpID, origin } = rpInfo(req);
    const body = await readJson<{ phase?: string; nationalId?: string; ceremonyId?: string }>(req);
    const raw = body as unknown as { phase?: string; nationalId?: string; ceremonyId?: string; response?: Record<string, unknown> & { id?: string } };

    if (body.phase === "options") {
      const nationalId = (body.nationalId ?? "").trim();
      const user = await db.user.findUnique({
        where: { nationalId },
        select: { id: true, isActive: true, passkeys: { select: { credentialId: true, transports: true } } },
      });
      if (!user || !user.isActive || user.passkeys.length === 0) {
        return apiErr(400, "برای این حساب کلید عبوری ثبت نشده است؛ اول با رمز وارد شوید و از پروفایل کلید بسازید.", "NO_PASSKEY");
      }
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: user.passkeys.map((c) => ({
          id: c.credentialId,
          transports: c.transports ? (JSON.parse(c.transports) as never[]) : undefined,
        })),
        userVerification: "preferred",
      });
      const ceremonyId = newCeremonyId();
      await saveChallenge(`auth:${ceremonyId}`, { challenge: options.challenge, userId: user.id });
      return apiOk({ options, ceremonyId });
    }

    if (body.phase === "verify") {
      const ceremonyId = String(body.ceremonyId ?? "");
      const saved = await takeChallenge<{ challenge: string; userId: string }>(`auth:${ceremonyId}`);
      if (!saved) return apiErr(400, "نشست ورود منقضی شده است؛ دوباره تلاش کنید.", "CHALLENGE_GONE");
      const credentialId = String(raw.response?.id ?? "");
      const cred = await db.passkeyCredential.findUnique({ where: { credentialId } });
      if (!cred || cred.userId !== saved.userId) return apiErr(400, "کلید ناشناخته است.", "UNKNOWN_CRED");
      const verification = await verifyAuthenticationResponse({
        response: raw.response as never,
        expectedChallenge: saved.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId,
          publicKey: b64urlDecode(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports ? (JSON.parse(cred.transports) as never[]) : undefined,
        },
      });
      if (!verification.verified) return apiErr(401, "تأیید کلید ناموفق بود.", "VERIFY_FAILED");
      await db.passkeyCredential.update({
        where: { id: cred.id },
        data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
      });
      const user = await db.user.findUnique({ where: { id: cred.userId } });
      if (!user || !user.isActive) return apiErr(403, "حساب غیرفعال است.", "INACTIVE");
      const settings = await getSettings();
      const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion }, settings.sessionDays);
      const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await db.loginEvent.create({
        data: { userId: user.id, nationalId: user.nationalId ?? "", ip: ip ?? "", userAgent: req.headers.get("user-agent") ?? "", status: "SUCCESS" },
      }).catch(() => {});
      await audit({
        user: {
          id: user.id, role: user.role, permissions: [],
          firstName: user.firstName, lastName: user.lastName,
          schoolId: user.schoolId, nationalId: user.nationalId,
          mustChangePassword: user.mustChangePassword, isActive: user.isActive, shadNumber: user.shadNumber,
        },
        action: "LOGIN_PASSKEY",
        entityType: "USER",
        entityId: user.id,
        ip,
      });
      const res = apiOk({ ok: true, role: user.role });
      res.headers.append("Set-Cookie", sessionCookie(token, settings.sessionDays));
      return res;
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_PHASE");
  } catch (e) {
    return handleApiError(e);
  }
}
