"use client";
// ============================================================
// بهار | Provider پروفایل کشور — هیدراته‌کردن کش سمت کلاینت
// بعد از mount بسته فعال از /api/countries/active خوانده می‌شود؛
// تا آن لحظه همه توابع همگام (persian.ts و…) دیفالت ایران را
// برمی‌گردانند — یعنی SSR و اولین رندر دقیقاً مثل قبل است.
// ============================================================
import { createContext, useContext, useEffect, useState } from "react";
import { getCountrySync, setCountryCache } from "./cache";
import type { CountryProfile } from "./types";

const CountryCtx = createContext<{ country: CountryProfile; ready: boolean }>({
  country: getCountrySync(),
  ready: false,
});

export function CountryProvider({
  children,
  initialProfile,
}: {
  children: React.ReactNode;
  /** از سرور (layout) پاس داده شود → بدون فلشِ رندر */
  initialProfile?: CountryProfile | null;
}) {
  const [country, setCountry] = useState<CountryProfile>(() => {
    if (initialProfile) {
      setCountryCache(initialProfile);
      return initialProfile;
    }
    return getCountrySync();
  });
  const [ready, setReady] = useState(Boolean(initialProfile));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { profile?: CountryProfile } | null) => {
        if (cancelled || !d?.profile) {
          setReady(true);
          return;
        }
        setCountryCache(d.profile);
        setCountry(d.profile);
        setReady(true);
        // جهت سند — بسته زبان هم همین کار را می‌کند؛ اینجا فقط همگام‌سازی اطمینانی
        document.documentElement.dir = d.profile.direction;
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return <CountryCtx.Provider value={{ country, ready }}>{children}</CountryCtx.Provider>;
}

/** هوک دسترسی به پروفایل کشور فعال (کلاینت) */
export function useCountry() {
  return useContext(CountryCtx);
}
