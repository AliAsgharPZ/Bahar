"use client";

import { useEffect, useRef } from "react";

/**
 * ثبت بازدید از مسیر POST اختصاصی — رندر صفحه (GET) هیچ شمارنده‌ای را تغییر نمی‌دهد.
 * فقط یک بار در هر نمایش صفحه اجرا می‌شود؛ خطا بی‌صدا نادیده گرفته می‌شود.
 */
export function ViewPing({ url }: { url: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch(url, { method: "POST", keepalive: true }).catch(() => { /* شمارنده نباید تجربهٔ بازدید را خراب کند */ });
  }, [url]);
  return null;
}
