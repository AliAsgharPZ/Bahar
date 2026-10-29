import Link from "next/link";
import Image from "next/image";
import { Sprout, Home, LogIn, Compass } from "lucide-react";

export const metadata = {
  title: "صفحه پیدا نشد | بهار",
};

/** صفحه ۴۰۴ اختصاصی بهار — الگوی آمادهٔ «عدد گرادیانی + شکل‌های شناور» با زبان طراحی بهار */
export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 b-hero-grad b-aurora" aria-hidden />
      {/* شکل‌های شناور تزئینی */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <span className="b-float absolute top-[16%] right-[10%] w-14 h-14 rounded-3xl bg-spring/15 rotate-12" />
        <span className="b-float-slow absolute top-[64%] right-[16%] w-8 h-8 rounded-2xl bg-blossom/20 -rotate-6" />
        <span className="b-float-slow absolute top-[24%] left-[12%] w-10 h-10 rounded-full bg-blossom/15" />
        <span className="b-float absolute top-[70%] left-[8%] w-16 h-16 rounded-[28px] bg-spring/10 rotate-45" />
        <span className="b-float absolute top-[42%] left-[22%] w-5 h-5 rounded-lg bg-spring/25" />
      </div>

      <header className="relative max-w-6xl mx-auto w-full px-4 h-16 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="بهار">
          <Image src="/logo.svg" alt="لوگوی بهار" width={34} height={34} priority />
          <span className="text-[22px] font-bold">بهار</span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center b-rise">
          {/* عدد بزرگ ۴۰۴ با گرادیان برند */}
          <div className="flex items-end justify-center gap-2 mb-2 select-none" aria-hidden>
            <span className="text-[120px] md:text-[160px] font-extrabold leading-none b-grad-text drop-shadow-sm">۴۰۴</span>
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
            
            <Link href="/login" className="b-btn b-btn-ghost">
              <LogIn className="w-4 h-4" /> ورود به حساب
            </Link>
          </div>

          <div className="b-card-sm b-grad-border !rounded-2xl p-4 mt-8 text-right">
            <b className="text-[12px] block mb-1">راه‌های دیگر:</b>
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
