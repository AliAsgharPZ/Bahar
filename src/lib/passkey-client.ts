/* ============================================================
   بهار | کلاینت Passkey — پل باریک بین JSON سرور و API بومی
   navigator.credentials (بدون وابستگی اضافه): تبدیل‌های
   Base64URL و سریال‌سازی پاسخ اعتبارنامه.
   ============================================================ */

function b64urlToBuffer(s: string): ArrayBuffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function passkeySupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

type Json = Record<string, unknown>;

function serializeCredential(cred: PublicKeyCredential): Json {
  const res = cred.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  const out: Json = {
    id: cred.id,
    rawId: bufferToB64url(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToB64url(res.clientDataJSON),
    },
  };
  if (res.attestationObject) (out.response as Json).attestationObject = bufferToB64url(res.attestationObject);
  if (res.authenticatorData) (out.response as Json).authenticatorData = bufferToB64url(res.authenticatorData);
  if (res.signature) (out.response as Json).signature = bufferToB64url(res.signature);
  if (res.userHandle) (out.response as Json).userHandle = bufferToB64url(res.userHandle);
  return out;
}

async function postJson(url: string, body: Json): Promise<Json> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as Json & { error?: { message?: string } };
  if (!r.ok) throw new Error(j?.error?.message ?? "خطای ناشناخته");
  return j;
}

/** ثبت یک Passkey تازه برای کاربر واردشده */
export async function registerPasskey(label: string): Promise<void> {
  const { options } = await postJson("/api/auth/passkey/register", { phase: "options" }) as unknown as { options: Json };
  const o = options as unknown as {
    challenge: string;
    user: { id: string };
    excludeCredentials?: { id: string; transports?: AuthenticatorTransport[] }[];
  };
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: b64urlToBuffer(o.challenge),
    user: { ...(o.user as unknown as PublicKeyCredentialUserEntity), id: b64urlToBuffer(o.user.id) },
    excludeCredentials: (o.excludeCredentials ?? []).map((c) => ({ id: b64urlToBuffer(c.id), type: "public-key" as const, transports: c.transports })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("ساخت کلید لغو شد.");
  await postJson("/api/auth/passkey/register", { phase: "verify", label, response: serializeCredential(cred) });
}

/** ورود با Passkey — در موفقیت کوکی نشست ست شده و true برمی‌گردد */
export async function loginWithPasskey(nationalId: string): Promise<boolean> {
  const { options, ceremonyId } = await postJson("/api/auth/passkey/login", { phase: "options", nationalId }) as unknown as { options: Json; ceremonyId: string };
  const o = options as unknown as { challenge: string; allowCredentials?: { id: string; transports?: AuthenticatorTransport[] }[] };
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...(options as unknown as PublicKeyCredentialRequestOptions),
    challenge: b64urlToBuffer(o.challenge),
    allowCredentials: (o.allowCredentials ?? []).map((c) => ({ id: b64urlToBuffer(c.id), type: "public-key" as const, transports: c.transports })),
  };
  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("ورود با کلید لغو شد.");
  await postJson("/api/auth/passkey/login", { phase: "verify", ceremonyId, response: serializeCredential(cred) });
  return true;
}
