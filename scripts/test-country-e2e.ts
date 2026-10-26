// بهار | تست E2E سیستم کشور — بارگذاری بسته ترکیه‌مانند، فعال‌سازی، تغییر رفتار، بازگشت به ایران
// SUPER_ADMIN (1000000011) — در پایان به ایران برمی‌گردد
import { writeFileSync, unlinkSync } from "fs";

const BASE = "http://localhost:81";
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra = "") {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

// بسته کشور آزمایشی — میلادی/ترکیه‌مانند (TC ۱۱ رقمی)
const TR_PACK = {
  code: "TST",
  name: "آزمایشیستان",
  nativeName: "Testland",
  locale: "tr-TR",
  direction: "ltr",
  timezone: "Europe/Istanbul",
  calendar: "gregory",
  digits: "latin",
  nationalId: { label: "شماره TC", algorithm: "digits", pattern: "^[1-9][0-9]{10}$", placeholder: "12345678901", example: "12345678901" },
  phone: { pattern: "^[1-9][0-9]{9}$", placeholder: "5xx xxx xx xx", example: "5321234567" },
  currency: { label: "لیر آزمایشی", code: "TRY", minAmount: 100, maxAmount: 100000000 },
  week: { workDays: [2, 3, 4, 5, 6], labels: ["", "Cumartesi", "Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"] },
  gradeLevels: ["9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf"],
  fields: ["Fen", "Sosyal", "Sayısal", "Sözel"],
  schoolTypes: ["Devlet", "Özel"],
  regions: [
    { name: "İstanbul", center: "İstanbul", counties: ["Kadıköy", "Beşiktaş", "Üsküdar", "Şişli"] },
    { name: "Ankara", center: "Ankara", counties: ["Çankaya", "Keçiören", "Yenimahalle"] },
  ],
  grading: { maxScore: 100, terms: 2, termLabels: ["", "Dönem 1", "Dönem 2"] },
  academicYearExample: "2025-2026",
  modules: { shad: false },
  version: "1.0.0",
};

async function main() {
  // ① ورود سوپرادمین
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "1000000011", password: "demo1234" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("ورود سوپرادمین", login.ok && cookie.length > 0);

  // ② اعتبارسنجی خشک — بسته معتبر
  const dry = await fetch(`${BASE}/api/countries?validate=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(TR_PACK),
  });
  const dryBody = await dry.json() as { validation: { ok: boolean; errors: string[]; stats: { regions: number; counties: number } } };
  check("اعتبارسنجی خشک: بسته معتبر", dry.ok && dryBody.validation.ok, JSON.stringify(dryBody.validation?.errors?.slice(0, 3)));

  // ③ اعتبارسنجی خشک — بسته خراب (کد ملی الکی)
  const bad = await fetch(`${BASE}/api/countries?validate=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ...TR_PACK, calendar: "klingon", nationalId: { ...TR_PACK.nationalId, algorithm: "iran-mod11", example: "1111111111" } }),
  });
  const badBody = await bad.json() as { validation: { ok: boolean; errors: string[] } };
  check("اعتبارسنجی خشک: بسته خراب رد (خطای فارسی)", bad.ok && !badBody.validation.ok && badBody.validation.errors.some((e) => e.includes("calendar") || e.includes("تقویم")));

  // ④ بارگذاری واقعی
  const upload = await fetch(`${BASE}/api/countries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(TR_PACK),
  });
  const uploadBody = await upload.json() as { pack?: { code: string; id: string } };
  check("بارگذاری بسته", upload.ok && uploadBody.pack?.code === "TST");

  // ⑤ وضعیت ایران قبل از فعال‌سازی
  const activeBefore = await fetch(`${BASE}/api/countries/active`).then((r) => r.json()) as { profile: { code: string; calendar: string } };
  check("قبل: ایران/شمسی فعال", activeBefore.profile.code === "IR" && activeBefore.profile.calendar === "persian");

  // ⑥ فعال‌سازی بسته TST
  const list = await fetch(`${BASE}/api/countries`, { headers: { Cookie: cookie } }).then((r) => r.json()) as { packs: Array<{ id: string; code: string }> };
  const tst = list.packs.find((p) => p.code === "TST");
  check("بسته در فهرست", Boolean(tst));
  const activate = await fetch(`${BASE}/api/countries/${tst!.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "activate" }),
  });
  check("فعال‌سازی", activate.ok);

  // ⑦ رفتار جدید: بسته فعال + اعتبارسنجی کد ملی جدید
  const activeAfter = await fetch(`${BASE}/api/countries/active`).then((r) => r.json()) as { profile: { code: string; calendar: string; nationalId: { algorithm: string }; direction: string; modules: { shad: boolean } } };
  check("بعد: TST/میلادی فعال", activeAfter.profile.code === "TST" && activeAfter.profile.calendar === "gregory");
  check("جهت ltr", activeAfter.profile.direction === "ltr");
  check("الگوریتم کد ملی جدید", activeAfter.profile.nationalId.algorithm === "digits");
  check("شاد خاموش", activeAfter.profile.modules.shad === false);

  // ⑧ ورود با شناسه ۱۱ رقمی (TC) — قبلاً 400 می‌شد
  const tcLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "12345678901", password: "x" }),
  });
  check("شناسه ۱۱ رقمی پذیرفته (رمز غلط = 401 نه 400)", tcLogin.status === 401, `got ${tcLogin.status}`);

  // ⑨ کد ملی ۱۰ رقمی ایرانی حالا رد می‌شود
  const irLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "1000000011", password: "demo1234" }),
  });
  check("کد ملی ۱۰ رقمی حالا 400 (الگوی جدید)", irLogin.status === 400, `got ${irLogin.status}`);

  // ⑩ بازگشت به ایران
  const deactivate = await fetch(`${BASE}/api/countries/${tst!.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "disable" }),
  });
  check("غیرفعال‌سازی → ایران", deactivate.ok);

  // ⑪ حذف بسته آزمایشی
  const del = await fetch(`${BASE}/api/countries/${tst!.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ action: "delete" }),
  });
  check("حذف بسته آزمایشی", del.ok);

  // ⑫ ورود دوباره با کد ملی ایران کار می‌کند
  const backLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "1000000011", password: "demo1234" }),
  });
  check("بازگشت کامل به ایران (ورود کد ملی)", backLogin.ok);

  console.log(`\nنتیجه E2E کشور: ${pass} پاس / ${fail} خطا`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
