"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/* ============================================================
   بهار | دسترس‌پذیری به‌عنوان قابلیت محصول
   تنظیم‌ها روی همین دستگاه ذخیره می‌شوند (localStorage) و با
   data-attribute روی <html> به کل سامانه اعمال می‌شوند تا هیچ
   صفحه‌ای جدا از این سیستم نباشد:
   - اندازهٔ متن: کوچک / معمولی / بزرگ / خیلی‌بزرگ
   - کنتراست بالا: متن و حاشیه‌ها تیره‌تر و خواناتر
   - حالت کم‌حواس‌پرتی: سایه‌ها و عناصر تزئینی متحرک پنهان
   - کاهش حرکت: همهٔ انیمیشن/ترنزیشن‌ها خاموش
   میان‌برهای صفحه‌کلید سراسری: / یا ⌘K برای جستجو (از قبل در
   پوسته بود)، Tab برای حرکت، و لینک «پرش به محتوا» در بالای
   هر صفحهٔ داخل پوسته.
   ============================================================ */

export type A11ySize = "small" | "normal" | "large" | "xlarge";
export type A11ySettings = {
  size: A11ySize;
  highContrast: boolean;
  lowDistraction: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_A11Y: A11ySettings = { size: "normal", highContrast: false, lowDistraction: false, reduceMotion: false };
const STORAGE_KEY = "bahar_a11y";

export function applyA11y(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.a11ySize = s.size;
  el.dataset.a11yContrast = s.highContrast ? "high" : "normal";
  el.dataset.a11yDistraction = s.lowDistraction ? "on" : "off";
  el.dataset.a11yMotion = s.reduceMotion ? "reduce" : "auto";
}

function loadA11y(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_A11Y;
    const parsed = JSON.parse(raw) as Partial<A11ySettings>;
    return {
      size: ["small", "normal", "large", "xlarge"].includes(String(parsed.size)) ? (parsed.size as A11ySize) : "normal",
      highContrast: Boolean(parsed.highContrast),
      lowDistraction: Boolean(parsed.lowDistraction),
      reduceMotion: Boolean(parsed.reduceMotion),
    };
  } catch {
    return DEFAULT_A11Y;
  }
}

const A11yContext = createContext<{ settings: A11ySettings; update: (patch: Partial<A11ySettings>) => void }>({
  settings: DEFAULT_A11Y,
  update: () => {},
});

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULT_A11Y);
  useEffect(() => {
    const loaded = loadA11y();
    setSettings(loaded);
    applyA11y(loaded);
  }, []);
  const update = (patch: Partial<A11ySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ذخیرهٔ محلی در دسترس نیست */ }
      applyA11y(next);
      return next;
    });
  };
  return <A11yContext.Provider value={{ settings, update }}>{children}</A11yContext.Provider>;
}

export function useAccessibility() {
  return useContext(A11yContext);
}

/** لینک «پرش به محتوا» — اولین عنصر قابل فوکوس هر صفحهٔ داخل پوسته. */
export function SkipLink() {
  return (
    <a href="#main-content" className="b-skip-link">
      پرش به محتوای اصلی
    </a>
  );
}
