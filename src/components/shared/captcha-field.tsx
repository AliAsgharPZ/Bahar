"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { apiGet } from "@/lib/client";
import { enDigits } from "@/lib/persian";

// ============================================================
// بهار | فیلد کپچای امن — تصویر SVG اعوجاج‌دار + پاسخ + تازه‌سازی
// برای لاگین (پس از تلاش‌های ناموفق) و نقاط حساس با رفتار مشکوک.
// ============================================================

export type CaptchaValue = { token: string; answer: string };

export function CaptchaField({
  value,
  onChange,
  autoFocus,
}: {
  value: CaptchaValue;
  onChange: (v: CaptchaValue) => void;
  autoFocus?: boolean;
}) {
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const d = await apiGet<{ token: string; image: string }>("/api/captcha");
      setImage(d.image);
      onChange({ token: d.token, answer: "" });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, image]);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-[13px] font-bold">
        <ShieldCheck className="w-4 h-4 text-spring" />
        کد امنیتی
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="relative shrink-0 rounded-lg overflow-hidden border border-hairline bg-card elev-1 hover:border-spring transition-colors"
          title="کد جدید"
          aria-label="تازه‌سازی کد امنیتی"
        >
          {image ? (
            <img src={image} alt="کد امنیتی" width={150} height={50} className="block w-[150px] h-[50px] select-none" draggable={false} />
          ) : (
            <span className="w-[150px] h-[50px] flex items-center justify-center text-[11px] text-stone">
              {loading ? "در حال دریافت…" : failed ? "خطا — دوباره بزنید" : "…"}
            </span>
          )}
          <span className="absolute inset-0 bg-spring-tint/0 hover:bg-spring-tint/20 transition-colors flex items-center justify-center">
            <RefreshCw className={`w-4 h-4 text-steel opacity-0 group-hover:opacity-100 max-md:opacity-100 ${loading ? "animate-spin opacity-100" : ""}`} />
          </span>
        </button>
        <input
          ref={inputRef}
          className="b-input flex-1 min-w-0 text-center !tracking-[0.25em] font-bold"
          dir="ltr"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={value.answer}
          onChange={(e) => onChange({ ...value, answer: e.target.value })}
          placeholder="پاسخ"
          maxLength={8}
        />
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-stone">
        <span>حروف و ارقام انگلیسی تصویر را وارد کنید</span>
        <button type="button" onClick={refresh} className="font-bold text-spring-deep hover:underline shrink-0">
          کد جدید
        </button>
      </div>
    </div>
  );
}

/** نرمال‌سازی ساده پاسخ قبل از ارسال (ارقام فارسی→انگلیسی) */
export function normalizeAnswer(a: string): string {
  return enDigits(a).replace(/[\s\u200c]/g, "");
}
