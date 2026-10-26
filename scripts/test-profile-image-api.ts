// تست API تصویر پروفایل — تمام مسیرها + امنیت
const BASE = "http://localhost:3000";
const NID = "2000000010"; // مدیر مدرسه دمو
const PASS = "demo1234";

async function login(nid: string, pass: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: nid, password: pass }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { ok: res.ok, cookie, cookie2: "" };
}

async function main() {
  const other = await login("2000000029", "demo1234"); // معاون
  const me = await login(NID, PASS);
  if (!me.ok) { console.log("✗ لاگین مدیر شکست خورد"); return; }

  // ── 1. GET وضعیت اولیه ──
  let r = await fetch(`${BASE}/api/profile/image`, { headers: { cookie: me.cookie } });
  let d = await r.json();
  console.log(`1. GET اولیه: ${r.status} → type=${d.profileImageType} upload=${JSON.stringify(d.upload)} avatar=${d.avatar ? "set" : "null"}`);

  // ── 2. گزینه‌های آواتار (پروکسی کش‌شده) ──
  r = await fetch(`${BASE}/api/profile/avatar-options`, { headers: { cookie: me.cookie } });
  d = await r.json();
  console.log(`2. avatar-options: ${r.status} → hairStyles=${d.options?.hairStyles?.length ?? "?"} live=${d.live}`);

  // ── 3. ذخیرهٔ آواتار معتبر ──
  r = await fetch(`${BASE}/api/profile/image`, {
    method: "PUT", headers: { cookie: me.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "avatar",
      avatar: {
        hair: "Beanie", facialHair: "None", body: "Round", eyes: "Hearts", mouth: "Smirk",
        nose: "Smallround", accessories: "Earrings", skinColor: "F2AD9B", hairColor: "6C4545",
        facialHairColor: "F2C94C", bodyColor: "68C9F2", accessoriesColor: "456DFF", bgColor: "89E6E4",
        // تزریق مقادیر نامعتبر — باید حذف/جایگزین شوند
        evil: "<script>", hairX: "DROP TABLE",
      },
    }),
  });
  d = await r.json();
  console.log(`3. PUT آواتار (با پارامترهای تزریقی): ${r.status} → type=${d.profileImageType} hair=${d.avatar?.hair} evil=${d.avatar?.evil ?? "حذف شد ✓"}`);

  // ── 4. آواتار کاملاً نامعتبر باید رد شود ──
  r = await fetch(`${BASE}/api/profile/image`, {
    method: "PUT", headers: { cookie: me.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "avatar", avatar: { hair: "HACKED", evil: 1 } }),
  });
  console.log(`4. PUT آواتار نامعتبر: ${r.status} (انتظار 422)`);

  // ── 5. احراز هویت — بدون کوکی ──
  r = await fetch(`${BASE}/api/profile/image`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "avatar" }) });
  console.log(`5. بدون لاگین: ${r.status} (انتظار 401)`);

  // ── 6. آپلود فایل جعلی (متن با ادعای image/png) ──
  const fakeFd = new FormData();
  fakeFd.append("file", new File([Buffer.from("this is not an image at all!!")], "evil.png", { type: "image/png" }));
  r = await fetch(`${BASE}/api/profile/image`, { method: "POST", headers: { cookie: me.cookie }, body: fakeFd });
  console.log(`6. آپلود فایل جعلی: ${r.status} (انتظار 415)`);

  // ── 7. آپلود PNG واقعی ۱×۱ (کوچک‌تر از حد) ──
  const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const tinyFd = new FormData();
  tinyFd.append("file", new File([tinyPng], "tiny.png", { type: "image/png" }));
  r = await fetch(`${BASE}/api/profile/image`, { method: "POST", headers: { cookie: me.cookie }, body: tinyFd });
  console.log(`7. آپلود PNG واقعی ریز: ${r.status} (انتظار 400 — زیر حداقل)`);

  // ── 8. auth/me باید فیلدهای آواتار را برگرداند ──
  r = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: me.cookie } });
  d = await r.json();
  console.log(`8. auth/me: type=${d.user?.profileImageType} avatar.hair=${d.user?.avatar?.hair ?? "-"} photoUrl=${d.user?.photoUrl ?? "-"}`);

  // ── 9. کاربر دیگر نباید بتواند وضعیت من را تغییر دهد (بدنه به نام دیگری) ──
  r = await fetch(`${BASE}/api/profile/image`, {
    method: "PUT", headers: { cookie: other.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "avatar", avatar: { hair: "Mohawk" } }),
  });
  d = await r.json();
  // این درخواست «حساب خود معاون» را تغییر می‌دهد (بدون پارامتر userId) — چک کنیم مدیر دست‌نخورده مانده:
  const mgr = await (await fetch(`${BASE}/api/profile/image`, { headers: { cookie: me.cookie } })).json();
  console.log(`9. جداسازی حساب‌ها: معاون type=${d.profileImageType} · مدیر هنوز hair=${mgr.avatar?.hair} ✓`);

  // ── 10. بازگشت به آواتار قبلی بدون ارسال بدنه (فقط type) ──
  r = await fetch(`${BASE}/api/profile/image`, {
    method: "PUT", headers: { cookie: me.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "avatar", avatar: { hair: "Mohawk" } }),
  });
  r = await fetch(`${BASE}/api/profile/image`, {
    method: "PUT", headers: { cookie: me.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "avatar" }),
  });
  d = await r.json();
  console.log(`10. بازیابی آواتار ذخیره‌شده: ${r.status} hair=${d.avatar?.hair} (انتظار Mohawk)`);

  // ── 11. حذف کامل ──
  r = await fetch(`${BASE}/api/profile/image`, { method: "DELETE", headers: { cookie: me.cookie } });
  d = await r.json();
  console.log(`11. DELETE: ${r.status} → type=${d.profileImageType} upload=${d.upload} avatar=${d.avatar} (انتظار همه null)`);

  console.log("\n✓ تست API کامل شد");
}

main().catch((e) => { console.error("خطا:", e); process.exit(1); });
