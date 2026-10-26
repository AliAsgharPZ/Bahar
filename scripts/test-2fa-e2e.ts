// بهار | تست E2E کامل 2FA از طریق HTTP — فراهم می‌کند: setup → enable → login دومرحله‌ای → disable
// حساب دمو مدیر مدرسه (2000000010) — در پایان به حالت اولیه برمی‌گردد
import { totpNow } from "../src/lib/twofactor";

const BASE = "http://localhost:81";
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

async function main() {
  // ① ورود عادی (بدون 2FA)
  const login1 = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "2000000010", password: "demo1234" }),
  });
  const cookie1 = login1.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("ورود عادی (کوکی صادر شد)", login1.ok && cookie1.startsWith("bahar_session="));

  // ② setup
  const setupRes = await fetch(`${BASE}/api/auth/2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie1 },
    body: JSON.stringify({ action: "setup" }),
  });
  const setup = await setupRes.json() as { secret: string; uri: string; qrSvg: string };
  check("setup: رمز + URI + QR", setupRes.ok && /^[A-Z2-7]{32}$/.test(setup.secret) && setup.uri.startsWith("otpauth://") && setup.qrSvg.startsWith("data:image/svg+xml"));

  // ③ enable با کد واقعی
  const code = totpNow(setup.secret);
  const enableRes = await fetch(`${BASE}/api/auth/2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie1 },
    body: JSON.stringify({ action: "enable", code }),
  });
  const enabled = await enableRes.json() as { enabled: boolean; backupCodes: string[] };
  check("enable با کد TOTP درست", enableRes.ok && enabled.enabled === true);
  check("۸ کد بازیابی صادر شد", Array.isArray(enabled.backupCodes) && enabled.backupCodes.length === 8);

  // ④ ورود جدید → باید pendingToken بدهد نه کوکی
  const login2 = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "2000000010", password: "demo1234" }),
  });
  const login2Body = await login2.json() as { ok: boolean; requires2fa?: boolean; pendingToken?: string };
  const noCookie = !login2.headers.get("set-cookie")?.includes("bahar_session=");
  check("ورود: مرحله دوم خواسته شد (بدون کوکی)", login2Body.requires2fa === true && Boolean(login2Body.pendingToken) && noCookie);

  // ⑤ کد نادرست → 401
  const bad2fa = await fetch(`${BASE}/api/auth/login2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken: login2Body.pendingToken, code: "000000" }),
  });
  check("کد نادرست رد (401)", bad2fa.status === 401);

  // ⑥ کد درست → کوکی نشست
  const code3 = totpNow(setup.secret);
  const good2fa = await fetch(`${BASE}/api/auth/login2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken: login2Body.pendingToken, code: code3 }),
  });
  const good2faBody = await good2fa.json() as { ok: boolean; user?: { role: string } };
  const cookie2 = good2fa.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("کد درست → نشست صادر شد", good2fa.ok && good2faBody.user?.role === "MANAGER" && cookie2.startsWith("bahar_session="));

  // ⑦ کوکی جدید کار می‌کند
  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie2 } });
  check("نشست دومرحله‌ای معتبر است", meRes.ok);

  // ⑧ pendingToken منقضی/خراب
  const expired = await fetch(`${BASE}/api/auth/login2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingToken: "eyJzdWIiOiJ4In0.ZmFrZQ", code: "123456" }),
  });
  check("pendingToken خراب رد (401)", expired.status === 401);

  // ⑨ disable (رمز + کد) — بازگرداندن حساب دمو به حالت اولیه
  const code4 = totpNow(setup.secret);
  const disableRes = await fetch(`${BASE}/api/auth/2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie2 },
    body: JSON.stringify({ action: "disable", password: "demo1234", code: code4 }),
  });
  check("disable با رمز+کد", disableRes.ok);

  // ⑩ ورود بعدی بدون 2FA
  const login3 = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "2000000010", password: "demo1234" }),
  });
  const login3Body = await login3.json() as { requires2fa?: boolean };
  check("بعد از disable ورود مستقیم", login3.ok && !login3Body.requires2fa);

  console.log(`\nنتیجه E2E: ${pass} پاس / ${fail} خطا`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
