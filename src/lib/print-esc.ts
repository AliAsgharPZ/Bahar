// بهار | فرار امن HTML برای جریان‌های چاپ (window.open + document.write)
// هر مقدار DB که داخل سند چاپ می‌رود باید از esc() بگذرد — ضد XSS same-origin
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

/** فرار ویژه برای مقدار داخل attribute (src/href) — بدون شکستن کوتیشن */
export function escAttr(v: unknown): string {
  return esc(v).replace(/\s/g, "%20");
}
