// تست آپلود واقعی + magic bytes + پاک‌سازی نهایی
import { PrismaClient } from "../src/generated/prisma/client";
import { deflateSync } from "zlib";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

// ساخت PNG واقعی بزرگ (فراتر از 1KB): هدر صحیح + چانک‌های معتبر
function makeRealPng(): Buffer {
  function crc32(buf: Buffer): number {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return ~c >>> 0;
  }
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]));
  const comment = Buffer.concat([Buffer.from("Comment", "ascii"), Buffer.from([0]), Buffer.alloc(2000, 0x61)]);
  const text = chunk("tEXt", comment);
  const idat = chunk("IDAT", deflateSync(Buffer.from([0, 0])));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, text, idat, iend]);
}

async function main() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId: "2000000010", password: "demo1234" }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";

  // ── آپلود PNG معتبر > 1KB ──
  const png = makeRealPng();
  const fd = new FormData();
  fd.append("file", new File([png], "profile.png", { type: "image/png" }));
  let r = await fetch(`${BASE}/api/profile/image`, { method: "POST", headers: { cookie }, body: fd });
  let d = await r.json();
  console.log(`آپلود PNG معتبر (${png.length}B): ${r.status} → type=${d.profileImageType} url=${d.upload?.url}`);

  // فایل واقعاً ذخیره و ارائه شده؟
  if (d.upload?.url) {
    const m = await fetch(`${BASE}${d.upload.url}`);
    console.log(`دریافت از media: ${m.status} type=${m.headers.get("content-type")} size=${(await m.arrayBuffer()).byteLength}`);
  }

  // ── فایل جعلی بزرگ (متنی ~2KB با ادعای PNG) — باید 415 بگیرد ──
  const fake = Buffer.from("x".repeat(2048));
  const fd2 = new FormData();
  fd2.append("file", new File([fake], "evil.png", { type: "image/png" }));
  r = await fetch(`${BASE}/api/profile/image`, { method: "POST", headers: { cookie }, body: fd2 });
  d = await r.json();
  console.log(`فایل جعلی بزرگ: ${r.status} → ${d.error?.message ?? ""} (انتظار 415)`);

  // ── SVG ممنوع ──
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${"<text>x</text>".repeat(100)}</svg>`);
  const fd3 = new FormData();
  fd3.append("file", new File([svg], "evil.svg", { type: "image/svg+xml" }));
  r = await fetch(`${BASE}/api/profile/image`, { method: "POST", headers: { cookie }, body: fd3 });
  d = await r.json();
  console.log(`SVG: ${r.status} → ${d.error?.message ?? ""} (انتظار 415)`);

  // ── پاک‌سازی نهایی: مدیر + معاون به حالت اولیه (بدون تصویر) ──
  for (const nid of ["2000000010", "2000000029"]) {
    await prisma.user.update({ where: { nationalId: nid }, data: { profileImageType: null, photoUrl: null, avatarConfig: null } });
  }
  const dir = path.join(process.cwd(), "db", "uploads");
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("pfp-")) {
      fs.rmSync(path.join(dir, f));
      removed++;
    }
  }
  console.log(`پاک‌سازی: ۲ کاربر دمو ریست، ${removed} فایل تستی حذف شد`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
