"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudRainWind, Home, RotateCcw } from "lucide-react";

/** صفحهٔ خطای اختصاصی بهار — وقتی رندر یک صفحه با خطا روبه‌رو می‌شود */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // خطا در کنسول ثبت می‌شود تا در محیط توسعه قابل ردیابی باشد
    console.error(error);
  }, [error]);

  return (
    <div dir="rtl" className="min-h-[70vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <span className="b-float absolute top-[14%] right-[12%] w-12 h-12 rounded-3xl bg-blossom/15 rotate-12" />
        <span className="b-float-slow absolute top-[62%] left-[10%] w-14 h-14 rounded-[26px] bg-spring/10 rotate-45" />
        <span className="b-float absolute top-[30%] left-[24%] w-6 h-6 rounded-full bg-blossom/20" />
      </div>
      <div className="relative max-w-md w-full text-center b-rise">
        <div className="flex items-end justify-center mb-2 select-none" aria-hidden>
          <span className="text-[110px] md:text-[140px] font-extrabold leading-none b-grad-text">۵۰۰</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="b-badge b-badge-blossom">
            <CloudRainWind className="w-3.5 h-3.5" /> یک ابر گذری رد شد
          </span>
        </div>
        <h1 className="text-[24px] md:text-[28px] font-extrabold mb-3">مشکلی پیش آمد</h1>
        <p className="text-[14px] text-steel leading-relaxed mb-8">
          این صفحه نتوانست کامل بارگذاری شود. معمولاً با یک تلاش دوباره درست می‌شود؛
          اگر ادامه پیدا کرد، چند دقیقهٔ دیگر برگردید.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={reset} className="b-btn b-btn-spring">
            <RotateCcw className="w-4 h-4" /> تلاش دوباره
          </button>
          <Link href="/app" className="b-btn b-btn-soft">
            <Home className="w-4 h-4" /> داشبورد
          </Link>
        </div>
        {error.digest && (
          <p className="t-cap text-stone mt-8" dir="ltr">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
