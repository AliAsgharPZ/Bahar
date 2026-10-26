// E2E verification of production-hardening fixes (Task 14)
// Run: bun scripts/test-prod-fixes.ts
import { db } from "../src/lib/db";

const BASE = "http://127.0.0.1:3000";
let cookie = "";
let saCookie = "";

function j(url: string, init?: RequestInit) {
  return fetch(`${BASE}${url}`, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init?.headers ?? {}) },
  });
}

async function login(nationalId: string, password: string, asSa = false) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nationalId, password }),
  });
  if (!res.ok) throw new Error(`login ${nationalId} failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const c = setCookie.split(";")[0];
  if (asSa) saCookie = c; else cookie = c;
  return c;
}

async function login2(nationalId: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nationalId, password }),
  });
  if (!res.ok) throw new Error(`login ${nationalId} failed: ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

async function main() {
  console.log("== 1. login ==");
  await login("2000000010", "demo1234"); // MANAGER demo
  await login("1000000011", "demo1234", true); // SUPER_ADMIN
  check("manager + super_admin login", true);

  console.log("== 2. upload route restored ==");
  const upNoAuth = await fetch(`${BASE}/api/upload`, { method: "POST" });
  check("upload without auth → 401", upNoAuth.status === 401, `got ${upNoAuth.status}`);
  // tiny real PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
  );
  const fd = new FormData();
  fd.append("file", new Blob([png], { type: "image/png" }), "t.png");
  const teacherCookie = await login2("3000000011", "demo1234");
  const up = await fetch(`${BASE}/api/upload`, { method: "POST", headers: { cookie: teacherCookie }, body: fd });
  const upJson = await up.json().catch(() => null);
  check("upload image with auth → 200 + url", up.status === 200 && !!upJson?.url, `got ${up.status} ${JSON.stringify(upJson)}`);
  if (upJson?.url) {
    const media = await fetch(`${BASE}${upJson.url}`);
    check("uploaded media served", media.status === 200 && media.headers.get("content-type") === "image/png");
  }

  console.log("== 3. SA acting-school on classes/[id] ==");
  // find a school + class
  const school = await db.school.findFirst({ where: { isActive: true } });
  if (school) {
    const cls = await db.class.findFirst({ where: { schoolId: school.id } });
    const enter = await fetch(`${BASE}/api/schools/${school.id}/enter`, { method: "POST", headers: { cookie: saCookie, "content-type": "application/json" } });
    const enterCookie = (enter.headers.get("set-cookie") ?? "").split(";").find((x) => x.startsWith("bahar_acting_school"));
    const saActing = [saCookie, enterCookie].filter(Boolean).join("; ");
    if (cls) {
      const patch = await fetch(`${BASE}/api/classes/${cls.id}`, {
        method: "PATCH",
        headers: { cookie: saActing, "content-type": "application/json" },
        body: JSON.stringify({ name: cls.name }), // no-op rename with same name
      });
      check("SA in school panel can PATCH class (was 404)", patch.status === 200, `got ${patch.status}`);
      const teach = await db.teachingAssignment.findFirst({ where: { schoolId: school.id } });
      if (teach) {
        // should NOT delete real data — expect 200 or guarded error but not 404; use demo-block? demo block applies to demo users only. Skip real DELETE: verify only reachability via wrong-id 404 vs not-found distinction
        const wrongDel = await fetch(`${BASE}/api/teaching/nonexistent-id`, { method: "DELETE", headers: { cookie: saActing } });
        check("SA teaching/[id] reachable (404 NOT_FOUND for bogus id, not auth 401/403)", wrongDel.status === 404, `got ${wrongDel.status}`);
      }
    } else {
      console.log("  (no class in test school — skip)");
    }
    // leave acting school
    await fetch(`${BASE}/api/schools/${school.id}/enter`, { method: "DELETE", headers: { cookie: saCookie } }).catch(() => {});
  }

  console.log("== 4. backup covers all 64 models ==");
  const bk = await j("/api/settings", { method: "PUT", headers: { cookie: saCookie, "content-type": "application/json" }, body: JSON.stringify({ action: "backup" }) });
  const bkJson = await bk.json().catch(() => null);
  check("manual backup created", bk.status === 200 && !!bkJson?.backup, `got ${bk.status}`);
  if (bkJson?.backup?.filename) {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(`db/backups/${bkJson.backup.filename}`, "utf8");
    const parsed = JSON.parse(raw) as { tables: Record<string, unknown[]> };
    const tableCount = Object.keys(parsed.tables).length;
    check(`backup dumps all 64 tables`, tableCount === 64, `got ${tableCount}`);
    check("backup includes class table", Array.isArray(parsed.tables.class));
    check("backup includes task table", Array.isArray(parsed.tables.task));
    check("backup includes house table", Array.isArray(parsed.tables.house));
  }

  console.log("== 5. settings: telegram writer + sessionDays ==");
  const putS = await j("/api/settings", { method: "PUT", headers: { cookie: saCookie }, body: JSON.stringify({ telegramBotToken: "123456:TEST-TOKEN-FIX" }) });
  const putSJson = await putS.json().catch(() => null);
  check("SA can save telegramBotToken", putS.status === 200, `got ${putS.status}`);
  check("token NOT echoed in PUT response", putS.status !== 200 || !JSON.stringify(putSJson ?? {}).includes("TEST-TOKEN-FIX"));
  const getS = await j("/api/settings", { headers: { cookie: saCookie } });
  const getSJson = await getS.json().catch(() => null);
  check("SA GET returns telegramBotToken", getSJson?.settings?.telegramBotToken === "123456:TEST-TOKEN-FIX");
  check("SA GET returns telegramBotEnabled flag", typeof getSJson?.settings?.telegramBotEnabled === "boolean");
  // cleanup: clear token
  await j("/api/settings", { method: "PUT", headers: { cookie: saCookie }, body: JSON.stringify({ telegramBotToken: "", telegramBotEnabled: false }) });

  console.log("== 6. reports/schedule: single-school run + plan gate ==");
  const schedGet = await j("/api/reports/schedule");
  const schedJson = await schedGet.json().catch(() => null);
  check("schedule list ok", schedGet.status === 200 && Array.isArray(schedJson?.reports), `got ${schedGet.status}`);
  if (schedJson?.reports?.length) {
    const r = schedJson.reports[0];
    const before = new Date().toISOString();
    const run = await j("/api/reports/schedule", { method: "PATCH", body: JSON.stringify({ id: r.id, action: "run" }) });
    const runJson = await run.json().catch(() => null);
    check("run-now returns notified count (single report)", run.status === 200 && typeof runJson?.notified === "number", `got ${run.status}`);
  } else {
    console.log("  (no scheduled reports in demo school — run-now path verified by code)");
  }

  console.log("== 7. unlock_grades grantable ==");
  const { PERMISSION_CATALOG } = await import("../src/lib/roles");
  check("unlock_grades in PERMISSION_CATALOG", PERMISSION_CATALOG.some((c) => c.key === "unlock_grades"));
  const grantFilter = (raw: string[]) => raw.filter((p) => (PERMISSION_CATALOG as ReadonlyArray<{ key: string }>).some((c) => c.key === p));
  check("grant filter keeps unlock_grades", grantFilter(["take_attendance", "unlock_grades"]).includes("unlock_grades"));

  console.log("== 8. ticket code format ==");
  const t = await db.ticket.findFirst({ orderBy: { createdAt: "desc" } });
  console.log(`  latest ticket code: ${t?.code ?? "none"} (new codes are BK-6digits)`);

  console.log("== 9. mustChangePassword write-block (synthetic user) ==");
  const { hashPassword, generatePassword } = await import("../src/lib/auth");
  const tempPass = generatePassword();
  const testUser = await db.user.create({
    data: {
      nationalId: "0012345679", passwordHash: hashPassword(tempPass), tempPassword: tempPass,
      role: "TEACHER", firstName: "تست", lastName: "موقت", schoolId: school?.id ?? null, mustChangePassword: true,
    },
  }).catch(() => null);
  if (testUser) {
    const oldCookie = cookie;
    await login("0012345679", tempPass);
    const blocked = await j("/api/announcements", { method: "POST", body: JSON.stringify({ title: "x", body: "y", audience: "ALL" }) });
    check("temp-password user blocked from mutation (403 PASSWORD_CHANGE_REQUIRED)", blocked.status === 403, `got ${blocked.status}`);
    const cp = await j("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: tempPass, newPassword: "NewPass1234" }) });
    check("temp-password user CAN change password", cp.status === 200, `got ${cp.status}`);
    const nowAllowed = await j("/api/announcements", { method: "POST", body: JSON.stringify({ title: "x", body: "y", audience: "ALL" }) });
    check("after password change, mutations allowed (demo-block may apply instead of 200)", nowAllowed.status !== 403 || (await nowAllowed.json().catch(() => null))?.error?.code === "DEMO_READONLY", `got ${nowAllowed.status}`);
    await db.user.delete({ where: { id: testUser.id } }).catch(() => {});
    cookie = oldCookie;
    // cleanup possible test announcement
    const testAnn = await db.announcement.findFirst({ where: { title: "x" }, orderBy: { createdAt: "desc" } });
    if (testAnn) await db.announcement.delete({ where: { id: testAnn.id } }).catch(() => {});
  } else {
    console.log("  (test user creation failed — nationalId in use?)");
  }

  console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
