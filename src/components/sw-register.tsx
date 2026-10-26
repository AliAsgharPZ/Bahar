"use client";

import { useEffect } from "react";

/** ثبت سرویس‌ورکر برای نصب‌پذیری PWA (اندروید/ویندوز) */
export function SwRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost" && process.env.NODE_ENV === "development") {
      // در dev فعال می‌کنیم تا پیش‌نمایش نصب هم تست شود
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* نصب PWA بدون SW هم کار می‌کند در برخی مرورگرها */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
