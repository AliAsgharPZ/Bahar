"use client";

import { useEffect } from "react";

/**
 * فعال‌ساز حالت دیباگ slow-mo — انیمیشن‌های CSS را ~۵۰ برابر کند می‌کند
 * تا در بازرسی ریز صفحه‌ها، لحظه‌های میانی انیمیشن (هم‌پوشانی، خروج ناقص،
 * جابجایی چیدمان) قابل مشاهده و عکس‌برداری شوند.
 *
 * فعال‌سازی فقط دستی و موقت: افزودن ?slowmo=50 به URL (عدد = ضریب کندشدن).
 * بدون پارامتر، کاملاً خاموش و حالت نرمال است — تولید تحت تأثیر قرار نمی‌گیرد.
 */
export function SlowMoDebug() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("slowmo");
      if (!q) return;
      const factor = Math.min(Math.max(parseInt(q, 10) || 50, 2), 200);
      const root = document.documentElement;
      root.style.setProperty("--sm", String(factor));
      root.classList.add("bahar-slowmo");
      // علامت بصری کوچک برای تشخیص حالت دیباگ
      const tag = document.createElement("div");
      tag.id = "bahar-slowmo-badge";
      tag.textContent = `SLOW-MO ×${factor}`;
      tag.setAttribute("style", [
        "position:fixed", "bottom:8px", "left:8px", "z-index:9999",
        "background:#e41e3f", "color:#fff", "font:bold 11px Vazirmatn,sans-serif",
        "padding:4px 10px", "border-radius:999px", "pointer-events:none",
        "direction:ltr",
      ].join(";"));
      document.body.appendChild(tag);
      return () => {
        root.classList.remove("bahar-slowmo");
        root.style.removeProperty("--sm");
        tag.remove();
      };
    } catch {
      /* حالت دیباگ اختیاری است */
    }
  }, []);
  return null;
}
