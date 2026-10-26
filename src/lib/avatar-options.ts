// ============================================================
// بهار | گزینه‌های معتبر آواتار Personas — کش سرور با fallback
// نتیجهٔ API یک‌بار دریافت و ۱ ساعت در حافظه کش می‌شود؛
// در قطع شبکه از آخرین مقدار سالم (یا مجموعهٔ داخلی) استفاده می‌شود.
// ============================================================

import { FALLBACK_OPTIONS, PERSONAS_OPTIONS_URL, type AvatarOptions } from "@/lib/avatar";

const CACHE_TTL_MS = 60 * 60 * 1000; // ۱ ساعت

type CacheEntry = { data: AvatarOptions; at: number; live: boolean };

// حافظهٔ ماژول — بین requestهای همان پروسه زنده می‌ماند
let cache: CacheEntry | null = null;
let inflight: Promise<AvatarOptions> | null = null;

/** اعتبارسنجی پاسخ API — ساختار و آرایه‌های غیرخالی */
function validateOptions(raw: unknown): AvatarOptions | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<AvatarOptions> = {};
  const keys: Array<keyof AvatarOptions> = [
    "skinStyles", "hairStyles", "facialHairStyles", "bodyStyles", "eyeStyles", "mouthStyles",
    "noseStyles", "accessoryStyles", "bgStyles", "skinColors", "hairColors", "facialHairColors",
    "bodyColors", "accessoryColors", "bgColors",
  ];
  for (const k of keys) {
    const v = r[k];
    if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === "string" && x.length > 0 && x.length < 64)) {
      return null;
    }
    out[k] = v as string[];
  }
  return out as AvatarOptions;
}

async function fetchLive(): Promise<AvatarOptions> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(PERSONAS_OPTIONS_URL, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const validated = validateOptions(json);
    if (!validated) throw new Error("BAD_SHAPE");
    return validated;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * گزینه‌های معتبر آواتار — با کش ۱ ساعته.
 * اولویت: کش تازه ← آخرین پاسخ سالم ← مجموعهٔ داخلی.
 * هرگز fail نمی‌شود (UI آواتار بدون شبکه هم کار می‌کند).
 */
export async function getAvatarOptions(): Promise<AvatarOptions> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const live = await fetchLive();
      cache = { data: live, at: Date.now(), live: true };
      return live;
    } catch {
      // شبکه قطع/کند — از آخرین دادهٔ سالم یا مجموعهٔ داخلی استفاده کن
      if (cache) {
        // مُهر زمان را جلو می‌بریم تا در هر request دوباره امتحان نشود
        cache = { ...cache, at: Date.now() };
        return cache.data;
      }
      return FALLBACK_OPTIONS;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** آیا دادهٔ فعلی از API زنده آمده است؟ (برای پاسخ API و دیباگ) */
export function avatarOptionsIsLive(): boolean {
  return cache?.live ?? false;
}
