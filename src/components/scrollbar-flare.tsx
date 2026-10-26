"use client";

/* ============================================================
   بهار | ScrollbarFlare (راند ۱۹)
   اسکرول‌بار غیب‌شونده: هنگام اسکرول (هر ظرفی — capture) ویژگی
   data-scrolling روی <html> ست می‌شود و پس از ~۹۰۰ms بی‌حرکتی
   پاک می‌گردد؛ CSS فقط در این حالت دستهٔ اسکرول‌بار را نشان
   می‌دهد (شبیه overlay scrollbar های macOS/اندروید).
   ============================================================ */

import { useEffect } from "react";

export function ScrollbarFlare() {
  useEffect(() => {
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = () => {
      root.setAttribute("data-scrolling", "");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => root.removeAttribute("data-scrolling"), 900);
    };

    // capture: رویداد scroll از هر ظرف داخلی هم بالاآمده گرفته می‌شود
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      if (timer) clearTimeout(timer);
      root.removeAttribute("data-scrolling");
    };
  }, []);

  return null;
}
