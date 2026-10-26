// بهار | ساخت قالب بسته کشور — از IRAN_PROFILE واقعی (دقیقاً نسخه ایران)
// خروجی: public/countries/template.json — مرجع سازندگان بسته‌های کشور
import { IRAN_PROFILE } from "../src/lib/country/iran";
import { IRAN_PROVINCE_PATHS, IRAN_MAP_VIEWBOX } from "../src/lib/iran-map";
import { writeFileSync, mkdirSync } from "fs";

const template = {
  // ─────────────────────────────────────────────────────────────
  // بهار | قالب بسته کشور (Country Pack Template)
  // این فایل «دقیقاً نسخه ایران» است — هر فیلد را با مقادیر کشور خود
  // عوض کنید و طبق راهنمای /countries پیش بروید.
  // بدون فیلد اضافه بارگذاری کنید؛ فیلدهای یادداشت ( _comment) حذف می‌شوند.
  // ─────────────────────────────────────────────────────────────
  ...IRAN_PROFILE,

  // نقشه SVG کشور (اختیاری) — نقشه ایران داخلی است و در قالب نمی‌آید
  // برای کشور خودتان: از GeoJSON با ساده‌سازی Douglas-Peucker مسیر بسازید (راهنما در /countries)
  map: {
    viewBox: IRAN_MAP_VIEWBOX,
    provinces: IRAN_PROVINCE_PATHS.map((p) => ({ name: p.fa, d: p.d, cx: p.cx, cy: p.cy })),
  },

  notes: "قالب رسمی بهار — نسخه ایران (مرجع). مقادیر را با کشور خود جایگزین کنید.",
  version: "1.0.0",
};

mkdirSync("public/countries", { recursive: true });
writeFileSync("public/countries/template.json", JSON.stringify(template, null, 2), "utf8");
console.log("template.json written:", (JSON.stringify(template).length / 1024).toFixed(1), "KB");
