/**
 * Bahar — Round 18 E2E tests
 * Covers: search rewrite, badges (SA-only define), polls acting-school, automation
 * acting-school, school-site publish/subdomain, custodian role + toggles, shad
 * per-school toggle + credential alternative, excel export/import, country &
 * language builders, OTP login flow, login captcha escalation.
 */
import { PrismaClient } from "../src/generated/prisma-node/client";

const BASE = "http://localhost:3000";
const db = new PrismaClient();

let cookie = "";
let actingCookie = "";

async function api(path: string, init: RequestInit = {}, useCookie = true): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...((init.headers as Record<string, string>) ?? {}) };
  const c = [...(useCookie ? [cookie] : []), ...(actingCookie ? [actingCookie] : [])].filter(Boolean).join("; ");
  if (c) headers.Cookie = c;
  const res = await fetch(BASE + path, { ...init, headers });
  let body: any = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) body = await res.json().catch(() => null);
  else body = await res.arrayBuffer().catch(() => null);
  const sc = res.headers.get("set-cookie");
  if (sc) {
    if (path === "/api/auth/login" || path === "/api/auth/otp") {
      cookie = sc.split(";")[0];
      if (!actingCookie) actingCookie = "";
    }
    if (path.includes("/enter")) {
      actingCookie = sc.split(";")[0];
    }
  }
  return { status: res.status, body, headers: res.headers };
}

const results: Array<[string, boolean, string]> = [];

/** تولید کد ملی معتبر ایرانی (mod-11) برای تست‌ها */
function validNid(seed: number): string {
  const base = String(seed % 1_000_000_000).padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(base[i]) * (10 - i);
  const r = sum % 11;
  const check = r < 2 ? r : 11 - r;
  return base + String(check);
}

function check(name: string, ok: boolean, detail = "") {
  results.push([name, ok, detail]);
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(nationalId: string, password: string): Promise<{ status: number; body: any }> {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId, password }),
  });
  const body = await res.json().catch(() => null);
  const sc = res.headers.get("set-cookie");
  return { status: res.status, body, ...(sc ? { setCookie: sc } : {}) } as any;
}

async function main() {
  /* ═══ 0) ورود سوپرادمین ═══ */
  const sa = await login("1000000011", "demo1234");
  check("login SUPER_ADMIN", sa.status === 200, `status=${sa.status}`);
  cookie = (sa as any).setCookie?.split(";")[0] ?? "";

  /* ═══ 1) جستجوی بازنویسی‌شده ═══ */
  let r = await api("/api/search?q=" + encodeURIComponent("دبیرستان"));
  const schoolHits = (r.body?.results ?? []).filter((x: any) => x.type === "مدرسه");
  check("search SA sees schools", r.status === 200 && schoolHits.length > 0, `${schoolHits.length} مدرسه`);

  r = await api("/api/search?q=" + encodeURIComponent("بهار"));
  check("search multi-type", r.status === 200 && (r.body?.results ?? []).length > 0, `${(r.body?.results ?? []).length} نتیجه`);

  // وایلدکارد نباید همه‌چیز را برگرداند
  r = await api("/api/search?q=" + encodeURIComponent("%%__"));
  check("search wildcard neutralized", (r.body?.results ?? []).length === 0, `${(r.body?.results ?? []).length} نتیجه`);

  /* ═══ 2) بج — تعریف فقط سوپرادمین ═══ */
  r = await api("/api/badges");
  check("badges list has starters", (r.body?.badges ?? []).length >= 5, `${(r.body?.badges ?? []).length} بج`);

  const defineBody = {
    action: "define",
    badge: { key: `r18-test-${Date.now() % 100000}`, title: "بج آزمایشی راند ۱۸", description: "تست", icon: "Star", tier: "BRONZE", points: 5, effectKind: "NONE" },
  };
  r = await api("/api/badges", { method: "POST", body: JSON.stringify(defineBody) });
  check("badge define by SUPER_ADMIN (global)", r.status === 200 && r.body?.badge?.schoolId === null, `status=${r.status}`);
  const testBadgeId = r.body?.badge?.id;
  if (testBadgeId) await db.badge.delete({ where: { id: testBadgeId } }).catch(() => {});

  // معاون نباید بتواند بج تعریف کند
  const depLogin = await login("2000000029", "demo1234");
  if (depLogin.status === 200) {
    const depCookie = (depLogin as any).setCookie?.split(";")[0];
    const depRes = await fetch(BASE + "/api/badges", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: depCookie },
      body: JSON.stringify(defineBody),
    });
    check("badge define FORBIDDEN for DEPUTY", depRes.status === 403, `status=${depRes.status}`);
  } else {
    check("badge define FORBIDDEN for DEPUTY", true, "skip — no deputy account");
  }

  /* ═══ 3) ورود به پنل مدرسه (acting) ═══ */
  const schools = await api("/api/schools");
  const school = (schools.body?.schools ?? [])[0];
  check("schools list", !!school, school?.name ?? "");
  r = await api(`/api/schools/${school.id}/enter`, { method: "POST", body: JSON.stringify({}) });
  check("enter school panel", r.status === 200, `status=${r.status}`);

  /* ═══ 4) جستجو در پنل مدرسه (acting scope) ═══ */
  r = await api("/api/search?q=" + encodeURIComponent("ریاضی"));
  check("search inside school panel", r.status === 200 && (r.body?.results ?? []).length > 0, `${(r.body?.results ?? []).length} نتیجه`);

  /* ═══ 5) نظرسنجی — acting school ═══ */
  const pollBody = {
    action: "create-poll",
    question: "نظرسنجی آزمایشی راند ۱۸؟",
    options: ["بله", "خیر"],
    audience: "ALL",
    anonymous: true,
  };
  r = await api("/api/engagement", { method: "POST", body: JSON.stringify(pollBody) });
  check("poll create in school panel", r.status === 200 && !!r.body?.poll?.id, `status=${r.status}`);
  const pollId = r.body?.poll?.id;
  if (pollId) {
    await api("/api/engagement", { method: "POST", body: JSON.stringify({ action: "close-poll", id: pollId }) });
    await db.poll.delete({ where: { id: pollId } }).catch(async () => {
      await db.pollOption.deleteMany({ where: { pollId } });
      await db.pollVote.deleteMany({ where: { pollId } });
      await db.poll.delete({ where: { id: pollId } });
    });
  }

  /* ═══ 6) اتوماسیون — acting school ═══ */
  r = await api("/api/automation", { method: "POST", body: JSON.stringify({ name: "قانون آزمایشی ر۱۸", trigger: "BIRTHDAY", action: "NOTIFY", active: false }) });
  check("automation create by SUPER_ADMIN in panel", r.status === 200 && !!r.body?.rule?.id, `status=${r.status} ${r.body?.error?.message ?? ""}`);
  const ruleId = r.body?.rule?.id;
  if (ruleId) {
    r = await api("/api/automation", { method: "PATCH", body: JSON.stringify({ id: ruleId, active: true }) });
    check("automation PATCH", r.status === 200, `status=${r.status}`);
    r = await api(`/api/automation?id=${ruleId}`, { method: "DELETE" });
    check("automation DELETE", r.status === 200, `status=${r.status}`);
  }

  /* ═══ 7) سایت مدرسه — انتشار + subdomain ═══ */
  const siteGet = await api("/api/school-site");
  const originalSub = siteGet.body?.site?.subdomain;
  r = await api("/api/school-site", {
    method: "PUT",
    body: JSON.stringify({ subdomain: "bahar-r18-test", published: true }),
  });
  check("school-site publish + slug response", r.status === 200 && r.body?.subdomain === "bahar-r18-test", `subdomain=${r.body?.subdomain}`);
  const page = await fetch(BASE + "/s/bahar-r18-test");
  const html = await page.text();
  check("published site 200", page.status === 200 && html.length > 2000, `status=${page.status}`);
  // بازگشت به وضعیت قبل
  await api("/api/school-site", { method: "PUT", body: JSON.stringify({ subdomain: originalSub, published: false }) });

  /* ═══ 8) سرایدار — ساخت + كلید روشن/خاموش ═══ */
  const custNid = validNid(Date.now());
  r = await api("/api/users", {
    method: "POST",
    body: JSON.stringify({
      role: "CUSTODIAN",
      nationalId: custNid,
      firstName: "سرایدار",
      lastName: "آزمایشی",
      password: undefined,
    }),
  });
  check("custodian created", r.status === 200 && r.body?.user?.role === "CUSTODIAN", `status=${r.status} ${r.body?.error?.message ?? ""}`);
  const custUserId = r.body?.user?.id;
  const custPassword = r.body?.password;

  // خاموش‌کردن ماژول سرایدار → ساخت باید 403 بدهد
  await api(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ custodianEnabled: false }) });
  const custNid2 = validNid(Date.now() - 1);
  r = await api("/api/users", {
    method: "POST",
    body: JSON.stringify({ role: "CUSTODIAN", nationalId: custNid2, firstName: "سما", lastName: "تست" }),
  });
  check("custodian blocked when disabled", r.status === 403 && r.body?.error?.code === "CUSTODIAN_DISABLED", `status=${r.status}`);
  await api(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ custodianEnabled: true }) });

  // ورود سرایدار (باید mustChangePassword بدهد ولی نشست می‌گیرد)
  if (custUserId && custPassword) {
    const cl = await login(custNid, custPassword);
    check("custodian can login", cl.status === 200, `status=${cl.status}`);
  }

  /* ═══ 9) شاد — کلید مدرسه + اعتبارنامه جایگزین ═══ */
  await api(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ shadEnabled: false }) });
  r = await api("/api/shad/connect", { method: "POST", body: JSON.stringify({ token: "x".repeat(30), phone: "09123456789" }) });
  check("shad connect blocked for non-MANAGER / off", r.status === 403, `status=${r.status} code=${r.body?.error?.code ?? ""}`);

  // ساخت کاربر با شماره شاد وقتی شاد خاموش است → SHAD_DISABLED + رمز قابل کپی
  const parentNid = validNid(Date.now() - 2);
  r = await api("/api/users", {
    method: "POST",
    body: JSON.stringify({ role: "PARENT", nationalId: parentNid, firstName: "ولی", lastName: "آزمایشی", shadNumber: "09123456789" }),
  });
  check(
    "credential alternative when shad off",
    r.status === 200 && r.body?.shadDelivery?.error === "SHAD_DISABLED" && typeof r.body?.password === "string",
    `delivery=${JSON.stringify(r.body?.shadDelivery)}`
  );
  const parentUserId = r.body?.user?.id;
  await api(`/api/schools/${school.id}`, { method: "PATCH", body: JSON.stringify({ shadEnabled: true }) });

  /* ═══ 10) اکسل — اکسپورت ═══ */
  r = await api("/api/export?type=students");
  const ab = r.body as unknown as ArrayBuffer;
  const isXlsx = r.headers.get("content-type")?.includes("spreadsheetml") && (ab as any).byteLength > 800;
  check("xlsx export students", r.status === 200 && isXlsx, `type=${r.headers.get("content-type")} bytes=${(ab as any)?.byteLength}`);
  r = await api("/api/export?type=users");
  check("xlsx export users", r.status === 200 && (r.body as any).byteLength > 800, `bytes=${(r.body as any)?.byteLength}`);

  /* ═══ 11) اکسل — ایمپورت ═══ */
  // ساخت فایل xlsx آزمایشی
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    ["نام", "نام خانوادگی", "کد ملی", "نام پدر", "شماره دانش‌آموزی"],
    ["آزمون", "ایمپورت", validNid(Date.now() - 4), "علی", `9${Date.now() % 100000}`],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const fd = new FormData();
  fd.append("file", new Blob([xlsxBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "test-import.xlsx");
  const exRes = await fetch(BASE + "/api/imports/excel", { method: "POST", headers: { Cookie: [cookie, actingCookie].filter(Boolean).join("; ") }, body: fd });
  const exJson = await exRes.json().catch(() => null);
  check("excel parse endpoint", exRes.status === 200 && typeof exJson?.csv === "string" && exJson.csv.includes("ایمپورت"), `status=${exRes.status}`);

  if (exJson?.csv) {
    // اعتبارسنجی + ثبت در کلاس اول
    const classes = await api("/api/classes");
    const cls = (classes.body?.classes ?? [])[0];
    r = await api("/api/imports", { method: "POST", body: JSON.stringify({ action: "validate", csv: exJson.csv }) });
    check("import validate from excel csv", r.status === 200 && r.body?.valid === 1, `valid=${r.body?.valid}/${r.body?.total}`);
    if (cls && r.body?.valid === 1) {
      r = await api("/api/imports", {
        method: "POST",
        body: JSON.stringify({ action: "commit", importId: r.body.jobId, csv: exJson.csv, classId: cls.id }),
      });
      check("import commit from excel", r.status === 200 && r.body?.success === 1, `success=${r.body?.success}`);
    }
  }

  /* ═══ 12) فرم ساخت کشور (builder payload) ═══ */
  const countryPayload = {
    code: "TT",
    name: "تست‌لند",
    nativeName: "Testland",
    locale: "tt-TT",
    direction: "ltr",
    timezone: "UTC",
    calendar: "gregory",
    digits: "latin",
    nationalId: { label: "ID", algorithm: "digits", pattern: "^\\d{9}$", placeholder: "9 digits", example: "123456789" },
    phone: { pattern: "^\\d{9}$", placeholder: "9 digits", example: "501234567" },
    currency: { label: "تستو", code: "TTD", minAmount: 0, maxAmount: 1000000 },
    week: { workDays: [1, 2, 3, 4, 5], labels: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
    gradeLevels: ["G9", "G10"],
    fields: ["General"],
    schoolTypes: ["Public"],
    regions: [{ name: "Region A", center: "Capital", counties: ["C1", "C2"] }],
    grading: { maxScore: 100, terms: 2, termLabels: ["", "T1", "T2"] },
    academicYearExample: "2025-2026",
    modules: { shad: false },
    notes: "r18 test",
  };
  r = await api("/api/countries?validate=1", { method: "POST", body: JSON.stringify(countryPayload) });
  check("country builder payload valid", r.status === 200 && r.body?.valid !== false, JSON.stringify(r.body?.errors ?? "").slice(0, 120));
  r = await api("/api/countries", { method: "POST", body: JSON.stringify(countryPayload) });
  const ttPackId = r.body?.pack?.id;
  check("country builder created", r.status === 200 && !!ttPackId, `status=${r.status}`);
  if (ttPackId) {
    await api(`/api/countries/${ttPackId}`, { method: "PATCH", body: JSON.stringify({ action: "delete" }) });
  }

  /* ═══ 13) فرم ساخت زبان ═══ */
  const langPayload = {
    code: "tt",
    name: "تستی",
    nativeName: "Testish",
    direction: "ltr",
    strings: { "shell.dashboard": "Dashboard", "nav.students": "Students" },
  };
  r = await api("/api/languages", { method: "POST", body: JSON.stringify(langPayload) });
  const ttLangId = r.body?.pack?.id;
  check("language builder created", r.status === 200 && !!ttLangId, `status=${r.status}`);
  if (ttLangId) {
    await fetch(BASE + `/api/languages/${ttLangId}`, { method: "DELETE", headers: { Cookie: cookie } });
  }

  /* ═══ 14) OTP — فعال‌سازی، ورود، خاموش‌سازی ═══ */
  // ایمیل آزمایشی برای سوپرادمین
  await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ email: "sa-test@bahar.test" }) });
  await api("/api/settings", { method: "PUT", body: JSON.stringify({ otpEnabled: true, otpTestMode: true, otpChannel: "email" }) });
  // logout (کوکی قبلی معتبر می‌ماند؛ ورود جدید مسیر OTP را تست می‌کند)
  const otpLogin = await login("1000000011", "demo1234");
  check(
    "login returns OTP step",
    otpLogin.status === 200 && otpLogin.body?.requiresOtp === true && typeof otpLogin.body?.devCode === "string",
    `requiresOtp=${otpLogin.body?.requiresOtp} devCode=${otpLogin.body?.devCode ? "yes" : "no"}`
  );
  if (otpLogin.body?.pendingToken && otpLogin.body?.devCode) {
    const otpRes = await fetch(BASE + "/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken: otpLogin.body.pendingToken, code: otpLogin.body.devCode }),
    });
    const otpJson = await otpRes.json().catch(() => null);
    check("OTP verify issues session", otpRes.status === 200 && otpJson?.ok === true, `status=${otpRes.status}`);
    // کد اشتباه باید رد شود (کد یکبارمصرف قبلاً مصرف شد → EXPIRED/WRONG)
    const bad = await fetch(BASE + "/api/auth/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pendingToken: otpLogin.body.pendingToken, code: "000000" }),
    });
    check("OTP code single-use", bad.status !== 200, `status=${bad.status}`);
  }
  // خاموش‌کردن OTP + پاک‌کردن ایمیل آزمایشی
  await api("/api/settings", { method: "PUT", body: JSON.stringify({ otpEnabled: false, otpTestMode: false }) });
  r = await api("/api/auth/me");
  check("session healthy after OTP round", r.status === 200 && r.body?.user?.role === "SUPER_ADMIN", `status=${r.status}`);

  /* ═══ 15) تشدید کپچا پس از شکست‌ها (throwaway user) ═══ */
  const throwNid = validNid(Date.now() - 3);
  r = await api("/api/users", { method: "POST", body: JSON.stringify({ role: "PARENT", nationalId: throwNid, firstName: "قربانی", lastName: "تست" }) });
  const throwId = r.body?.user?.id;
  const throwPass = r.body?.password;
  if (throwId && throwPass) {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ nationalId: throwNid, password: "wrong-pass-1" }) }, false);
    const l2 = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ nationalId: throwNid, password: "wrong-pass-2" }) }, false);
    // پاسخ دوم باید captchaRequired داشته باشد (آستانهٔ حساب = ۲)
    check("captcha escalation after 2 fails", l2.body?.error?.extra?.captchaRequired === true || l2.body?.error?.captchaRequired === true, JSON.stringify(l2.body?.error ?? {}).slice(0, 100));
  }

  /* ═══ پاک‌سازی ═══ */
  const cleanIds = [custUserId, parentUserId, throwId].filter(Boolean) as string[];
  for (const id of cleanIds) {
    await db.user.delete({ where: { id } }).catch(() => {});
  }
  await db.user.update({ where: { nationalId: "1000000011" }, data: { email: null, failedAttempts: 0 } }).catch(() => {});

  /* ═══ خلاصه ═══ */
  const fails = results.filter((x) => !x[1]);
  console.log("\n════════════════════════════");
  console.log(`${results.length - fails.length}/${results.length} PASS`);
  if (fails.length) {
    console.log("FAILURES:");
    fails.forEach((f) => console.log(`  ✗ ${f[0]} — ${f[2]}`));
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error("SCRIPT ERROR:", e); process.exit(1); })
  .finally(() => db.$disconnect());
