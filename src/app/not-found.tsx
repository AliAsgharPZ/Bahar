import Link from "next/link";
import Image from "next/image";
import { Sprout, Home, LogIn, Compass } from "lucide-react";

export const metadata = {
  title: "صفحه پیدا نشد | بهار",
};

/** صفحه ۴۰۴ اختصاصی بهار */
export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 b-hero-grad" aria-hidden />

      <header className="relative max-w-6xl mx-auto w-full px-4 h-16 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="بهار">
          <Image src="/logo.svg" alt="لوگوی بهار" width={34} height={34} priority />
          <span className="text-[22px] font-bold">بهار</span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center b-rise">
          {/* عدد بزرگ ۴۰۴ */}
          <div className="flex items-end justify-center gap-2 mb-2 select-none" aria-hidden>
            <span className="text-[110px] md:text-[140px] font-extrabold leading-none text-spring/90">۴۰۴</span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="b-badge b-badge-spring">
              <Sprout className="w-3.5 h-3.5" /> این مسیر هنوز شکوفا نشده
            </span>
          </div>

          <h1 className="text-[24px] md:text-[28px] font-extrabold mb-3">
            صفحه‌ای که دنبالش بودید پیدا نشد
          </h1>
          <p className="text-[14px] text-steel leading-relaxed mb-8">
            ممکن است آدرس تغییر کرده باشد، صفحه حذف شده باشد یا اشتباه تایپی رخ داده باشد.
            از مسیرهای زیر ادامه دهید.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="b-btn b-btn-spring">
              <Home className="w-4 h-4" /> صفحه اصلی
            </Link>
            <Link href="/plans" className="b-btn b-btn-soft">
              <Compass className="w-4 h-4" /> پلن‌ها و اشتراک‌ها
            </Link>
            <Link href="/login" className="b-btn b-btn-ghost">
              <LogIn className="w-4 h-4" /> ورود به حساب
            </Link>
          </div>

          <div className="b-card-sm !rounded-2xl p-4 mt-8 text-right">
            <b className="text-[12.5px] block mb-1">راه‌های دیگر:</b>
            <ul className="text-[12px] text-steel leading-relaxed flex flex-col gap-1">
              <li>· اگر حساب ندارید، صفحه «معرفی بهار» همه قابلیت‌ها را نشان می‌دهد.</li>
              <li>· اگر مدرسه شما از بهار استفاده می‌کند، رمز عبور از مدیر مدرسه‌تان می‌رسد.</li>
              <li>· سایت هر مدرسه از مسیر <b>/s/نام-مدرسه</b> در دسترس است.</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-hairline-soft py-4 t-cap text-stone text-center">
        بهار · سامانه مدیریت مدرسه
      </footer>
    </div>
  );
}
