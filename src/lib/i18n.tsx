"use client";
// ============================================================
// بهار | Provider زبان کاستوم — فراهم‌کننده t() برای کل اپ
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CATALOG } from "@/lib/langs";

export interface ActiveLang {
  code: string;
  name: string;
  nativeName: string;
  direction: "rtl" | "ltr";
  strings: Record<string, string>;
}

const FA: ActiveLang = { code: "fa", name: "فارسی", nativeName: "فارسی", direction: "rtl", strings: {} };

const LangCtx = createContext<{
  lang: ActiveLang;
  t: (key: string) => string;
  ready: boolean;
}>({ lang: FA, t: (k) => CATALOG[k] ?? k, ready: false });

/** کش سمت کلاینت بسته‌های بارگذاری‌شده (به‌ازای هر سشن) */
const packCache = new Map<string, ActiveLang>();

export function LangProvider({
  children,
  initialCode,
}: {
  children: React.ReactNode;
  initialCode?: string | null;
}) {
  const [lang, setLang] = useState<ActiveLang>(FA);
  const [ready, setReady] = useState(false);

  // بارگذاری اولیه — از کوکی مرورگر یا ترجیح کاربر
  useEffect(() => {
    let cancelled = false;
    const browserCode = typeof navigator !== "undefined" ? (navigator.language || "").split("-")[0].toLowerCase() : "";
    const code = (initialCode || document.cookie.match(/(?:^|;\s*)bahar_lang=([^;]+)/)?.[1] || browserCode || "fa").trim();
    const apply = (pack: ActiveLang) => {
      if (cancelled) return;
      setLang(pack);
      setReady(true);
      document.documentElement.lang = pack.code;
      document.documentElement.dir = pack.direction;
    };
    if (!code || code === "fa") {
      apply(FA);
      return () => { cancelled = true; };
    }
    const cached = packCache.get(code);
    if (cached) {
      apply(cached);
      return () => { cancelled = true; };
    }
    fetch(`/api/languages/pack?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d: ActiveLang & { strings?: Record<string, string> }) => {
        const pack: ActiveLang = {
          code: d.code || "fa",
          name: d.name || "فارسی",
          nativeName: d.nativeName || "فارسی",
          direction: d.direction === "ltr" ? "ltr" : "rtl",
          strings: d.strings || {},
        };
        packCache.set(code, pack);
        apply(pack);
      })
      .catch(() => apply(FA));
    return () => { cancelled = true; };
  }, [initialCode]);

  // ترجمه با fallback فارسی
  const t = useCallback(
    (key: string): string => {
      const custom = lang.strings[key];
      if (typeof custom === "string" && custom.trim().length > 0) return custom;
      return CATALOG[key] ?? key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, t, ready }), [lang, t, ready]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

/** هوک استفاده در کلاینت */
export function useLang() {
  return useContext(LangCtx);
}

/** انتخاب زبان — کوکی + (در صورت لاگین) ذخیره در پروفایل */
export async function switchLanguage(code: string): Promise<void> {
  document.cookie = `bahar_lang=${encodeURIComponent(code)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  packCache.clear();
  try {
    await fetch(`/api/languages/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-my-language", status: code }),
    });
  } catch { /* کاربر لاگین نیست — فقط کوکی کافی است */ }
}
