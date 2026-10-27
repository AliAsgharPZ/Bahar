"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Sparkles, Users, MessageCircle, Smartphone, Monitor, Globe,
  GraduationCap, ChevronDown, School, BookOpen, CalendarDays, ClipboardCheck,
  BarChart3, BellRing, Send, Lock, Check, Menu, FileText, Map, Download,
  ServerCog, DatabaseBackup,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

const NAV = [
  { href: "#features", label: "امکانات" },
  { href: "#roles", label: "نقش‌ها" },
  { href: "/blog", label: "بلاگ", link: true },
  { href: "#faq", label: "سوالات متداول" },
];

const FEATURE_TILES = [
  { icon: Globe, title: "وب", desc: "پنل کامل در مرورگر" },
  { icon: Smartphone, title: "اندروید", desc: "نصب از وب، تجربه اپ" },
  { icon: Monitor, title: "ویندوز", desc: "نصب روی دسکتاپ" },
  { icon: Lock, title: "امنیت", desc: "کد ملی + رمز تصادفی" },
];

const MODULES = [
  { icon: Users, title: "دانش‌آموزان و اولیا", desc: "پرونده کامل با اطلاعات اولیا" },
  { icon: GraduationCap, title: "معلمان و معاونین", desc: "دسترسی‌سنجی دقیق توسط مدیر" },
  { icon: School, title: "کلاس‌ها و درس‌ها", desc: "مدیریت پایه، رشته و تخصیص معلم" },
  { icon: CalendarDays, title: "برنامه هفتگی", desc: "چیدمان زنگ‌ها و معلم‌ها" },
  { icon: ClipboardCheck, title: "حضور و غیاب", desc: "ثبت روزانه و گزارش غیبت" },
  { icon: BarChart3, title: "نمرات و کارنامه", desc: "دفتر نمرات و میانگین‌ها" },
  { icon: FileText, title: "کارنامه ماهانه", desc: "خلاصه عملکرد هر ماه به تفکیک" },
  { icon: BookOpen, title: "تکالیف", desc: "ایجاد و پیگیری مهلت‌ها" },
  { icon: Sparkles, title: "رویدادها", desc: "جلسات، امتحان، گردش علمی" },
  { icon: BellRing, title: "اطلاعیه هدفمند", desc: "بر اساس نقش و نقشه ایران" },
  { icon: MessageCircle, title: "پیام‌رسان داخلی", desc: "کوتاه و سبک داخل مدرسه" },
  { icon: Send, title: "ارسال با شاد", desc: "ارسال رمز و اطلاع‌رسانی" },
  { icon: Globe, title: "سایت مدرسه", desc: "۱۶ تمپلیت آماده با آدرس اختصاصی" },
  { icon: Map, title: "نقشه ایران", desc: "انتخاب استان و شهرستان روی نقشه" },
  { icon: Sparkles, title: "شهریه و مالی", desc: "پیگیری پرداخت دانش‌آموزان" },
  { icon: Users, title: "تیکت پشتیبانی", desc: "پاسخ مستقیم تیم بهار" },
];

const ROLES = [
  {
    title: "ادمین سرویس", tone: "soft" as const, icon: ServerCog,
    caps: ["مدیریت کل سرویس و همه مدارس", "اشتراک‌ها، بکاپ و ایمنی سامانه", "بلاگ، تیکت‌ها و ادمین‌های سرویس"],
  },
  {
    title: "مدیر مدرسه", tone: "spring" as const, icon: School,
    caps: ["مدیریت معلمان، دانش‌آموزان و کلاس‌ها", "معاونین، رویدادها و اعلان‌ها", "تعیین دسترسی معاون و معلم", "ارسال رمز کاربران با شاد"],
  },
  {
    title: "معاون", tone: "soft" as const, icon: Users,
    caps: ["دسترسی‌ها توسط مدیر تعیین می‌شود", "نمرات، حضورغیاب، رویداد و…", "بر اساس مجوزهای دریافتی"],
  },
  {
    title: "معلم", tone: "soft" as const, icon: BookOpen,
    caps: ["ثبت نمرات و حضورغیاب کلاس‌ها", "تکالیف و پیام به اولیا", "برنامه هفتگی شخصی"],
  },
  {
    title: "دانش‌آموز", tone: "soft" as const, icon: GraduationCap,
    caps: ["نمرات و کارنامه من", "کارنامه ماهانه و برنامه کلاسم", "پیام به معلمان و مدیر"],
  },
  {
    title: "ولی", tone: "soft" as const, icon: MessageCircle,
    caps: ["کارنامه و غیبت فرزند", "رویدادها و اطلاعیه‌ها", "ارتباط با معلم و مدیر"],
  },
];

// FAQ — شاد فقط ایران: shadOnly = آیتم کاملاً مخفی، aNoShad = پاسخ بدون شاد
const FAQS: Array<{
  q: string;
  a: string;
  shadOnly?: boolean;
  aNoShad?: string;
}> = [
  {
    q: "چطور وارد حسابم می‌شوم؟",
    a: "نام کاربری شما «کد ملی» است و رمز عبور به‌صورت تصادفی توسط سامانه ساخته می‌شود و از طریق پیام‌رسان شاد به شماره ثبت‌شده شما ارسال می‌گردد. برای همه کاربران — از مدیر مدرسه تا دانش‌آموز — روش ورود یکسان است. بعد از ورود اول، از بخش پروفایل رمز خود را تغییر دهید؛ این کار برای امنیت حساب الزامی است.",
    aNoShad:
      "نام کاربری شما «کد ملی» است و رمز عبور به‌صورت تصادفی توسط سامانه ساخته می‌شود و مدیر مدرسه آن را به شما تحویل می‌دهد. برای همه کاربران — از مدیر مدرسه تا دانش‌آموز — روش ورود یکسان است. بعد از ورود اول، از بخش پروفایل رمز خود را تغییر دهید؛ این کار برای امنیت حساب الزامی است.",
  },
  {
    q: "رمزم را فراموش کردم، چه کار کنم؟",
    a: "با مدیر مدرسه خود تماس بگیرید. مدیر از پنل کاربران می‌تواند برای شما رمز جدید تصادفی بسازد و آن را از طریق شاد برایتان ارسال کند. رمزها به‌صورت رمزنگاری‌شده ذخیره می‌شوند و هیچ‌کس — حتی مدیر — رمز فعلی شما را نمی‌بیند؛ فقط امکان ساخت رمز جدید وجود دارد.",
    aNoShad:
      "با مدیر مدرسه خود تماس بگیرید. مدیر از پنل کاربران می‌تواند برای شما رمز جدید تصادفی بسازد و آن را به شما تحویل دهد. رمزها به‌صورت رمزنگاری‌شده ذخیره می‌شوند و هیچ‌کس — حتی مدیر — رمز فعلی شما را نمی‌بیند؛ فقط امکان ساخت رمز جدید وجود دارد.",
  },
  {
    q: "چرا پیام‌رسان بهار محدود است؟",
    a: "پیام‌رسان داخلی فقط برای پیام‌های کوتاه و سبک طراحی شده تا سرور سامانه همیشه سریع بماند. برای ارسال فایل، عکس و محتوای حجیم، از پیام‌رسان شاد استفاده کنید؛ بهار در پیام‌رسان داخلی همین نکته را به شما یادآوری می‌کند.",
    aNoShad:
      "پیام‌رسان داخلی فقط برای پیام‌های کوتاه و سبک طراحی شده تا سرور سامانه همیشه سریع بماند. برای ارسال فایل، عکس و محتوای حجیم، از ابزارهای ارتباطی رایج استفاده کنید؛ بهار در پیام‌رسان داخلی همین نکته را به شما یادآوری می‌کند.",
  },
  {
    q: "بهار روی چه پلتفرم‌هایی کار می‌کند؟",
    a: "نسخه وب در همه مرورگرها اجرا می‌شود و همین نسخه به‌صورت اپلیکیشن روی اندروید و ویندوز نصب می‌شود؛ یعنی یک حساب، سه پلتفرم. نسخه اندروید همچنین به‌صورت فایل APK مستقل در اختیار مدرسه قرار می‌گیرد.",
  },
  {
    q: "رمز عبور تصادفی چقدر امن است؟",
    a: "رمزها با مولد امن رمزنگاری ساخته و به‌صورت هش ذخیره می‌شوند. بعد از چند تلاش ناموفق، حساب موقتاً قفل می‌شود و تغییر رمز پس از ورود اول الزامی است. بهار هیچ رمزی را به‌صورت متن ساده نگه نمی‌دارد.",
  },
  {
    q: "اطلاعات دانش‌آموز و ولی در پرونده چه چیزهایی است؟",
    a: "پرونده دانش‌آموز شامل اطلاعات کامل خود او و همچنین اطلاعات کامل ولی (نام، کد ملی، شماره تماس و شماره شاد) است. پرونده معلمان، معاونین و مدیران نیز اطلاعات کامل خودشان را دارد. دسترسی به هر پرونده فقط برای نقش‌های مجاز انجام می‌شود.",
    aNoShad:
      "پرونده دانش‌آموز شامل اطلاعات کامل خود او و همچنین اطلاعات کامل ولی (نام، کد ملی و شماره تماس) است. پرونده معلمان، معاونین و مدیران نیز اطلاعات کامل خودشان را دارد. دسترسی به هر پرونده فقط برای نقش‌های مجاز انجام می‌شود.",
  },
  {
    q: "دسترسی معاون و معلم چگونه تعیین می‌شود؟",
    a: "مدیر مدرسه هنگام ساخت یا ویرایش هر معاون و معلم، دقیقاً مشخص می‌کند به چه بخش‌هایی دسترسی داشته باشد؛ مثل ثبت نمرات، حضور و غیاب، مدیریت دانش‌آموزان یا رویدادها. هر تغییر دسترسی بلافاصله اعمال می‌شود و در گزارش فعالیت ثبت می‌گردد.",
  },
  {
    q: "ارسال رمز با شاد چگونه انجام می‌شود؟",
    a: "مدیر مدرسه یک‌بار حساب شاد خود را به سامانه متصل می‌کند؛ از آن پس بهار نام کاربری و رمز هر کاربر جدید را به شماره شاد ثبت‌شده او می‌فرستد. این فقط یک امکان جانبی برای راحتی کار است و در صورت عدم اتصال، مدیر رمز را از راه دیگری به کاربر می‌رساند.",
    shadOnly: true,
  },
  {
    q: "آیا امکان نصب نسخه اندروید به‌صورت APK وجود دارد؟",
    a: "بله. علاوه بر نصب مستقیم از مرورگر، فایل پروژه اندرویدی بهار در اختیار مدرسه قرار می‌گیرد که با اندروید استودیو به‌راحتی به APK تبدیل می‌شود؛ بدون نیاز به گوگل‌پلی.",
  },
  {
    q: "کارنامه ماهانه چیست؟",
    a: "در کنار کارنامه نهایی، بهار هر ماه یک خلاصه عملکرد برای هر دانش‌آموز می‌سازد: میانگین نمرات همان ماه، روزهای حضور و غیبت و تکالیف آن ماه. این خلاصه برای دانش‌آموز و ولی در بخش نمرات نمایش داده می‌شود تا روند پیشرفت ماه‌به‌ماه دیده شود.",
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="b-card-sm p-5 md:p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-right cursor-pointer"
        aria-expanded={open}
      >
        <span className="font-bold text-[15px] md:text-base">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-steel shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] pt-3" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="t-sm text-steel">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function Landing({
  isLoggedIn,
  androidUrl,
  windowsUrl,
  shadEnabled = true,
}: {
  isLoggedIn: boolean;
  androidUrl?: string | null;
  windowsUrl?: string | null;
  /** شاد فقط برای بسته ایران — سایر ریجن‌ها هیچ نامی از آن ندارند */
  shadEnabled?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // شاد خاموش → ماژول جایگزین خنثی (شبکه ۱۶تایی و عنوان بخش دست‌نخورده)
  const modules = shadEnabled
    ? MODULES
    : MODULES.map((m) =>
        m.title === "ارسال با شاد"
          ? { icon: DatabaseBackup, title: "بکاپ خودکار ماهانه", desc: "پشتیبان‌گیری کامل و بازیابی سریع" }
          : m
      );

  // شاد خاموش → حذف سوال اختصاصی شاد و جایگزینی پاسخ‌های دارای شاد
  const faqs = shadEnabled
    ? FAQS
    : FAQS.filter((f) => !f.shadOnly).map((f) => (f.aNoShad ? { ...f, a: f.aNoShad } : f));

  const platformLink = (url?: string | null) => (url && url.startsWith("http") ? url : "/introduce");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="بهار">
            <Image src="/logo.svg" alt="لوگوی بهار" width={34} height={34} priority />
            <span className="flex flex-col leading-none">
              <span className="text-[22px] font-bold tracking-tight">بهار</span>
              <span className="text-[10px] text-steel font-medium hidden sm:block">سامانه مدیریت مدرسه</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {NAV.map((n) =>
              n.href.startsWith("/") ? (
                <Link key={n.href} href={n.href} className="b-pill-tab">{n.label}</Link>
              ) : (
                <a key={n.href} href={n.href} className="b-pill-tab">{n.label}</a>
              )
            )}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href={isLoggedIn ? "/app" : "/login"} className="b-btn b-btn-ink b-btn-sm">
              {isLoggedIn ? "ورود به پنل" : "ورود"}
            </Link>
            {/* منو: فقط موبایل */}
            <button
              className="b-only-mobile md:hidden b-btn b-btn-ghost !p-0 w-10 h-10 !min-h-10"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="منو"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <ChevronDown className="w-5 h-5 rotate-180" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-hairline-soft px-4 py-3 flex flex-col gap-2 bg-background">
            {NAV.map((n) =>
              n.href.startsWith("/") ? (
                <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="b-pill-tab justify-center">{n.label}</Link>
              ) : (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="b-pill-tab justify-center">{n.label}</a>
              )
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 b-hero-grad" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-14 md:pt-20 pb-14 md:pb-20">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              <div className="b-rise">
                <span className="b-badge b-badge-spring mb-5">
                  <Sparkles className="w-3.5 h-3.5" /> یک حساب · سه پلتفرم
                </span>
                <h1 className="t-hero font-medium">
                  مدرسه‌ات را
                  <br />
                  مثل <span className="text-spring">بهار</span>، شکوفا کن
                </h1>
                <p className="t-sub mt-5 max-w-lg">
                  سامانه یکپارچه مدیریت مدرسه: دانش‌آموزان و اولیا، معلمان و معاونین، کلاس‌ها،
                  نمرات، حضور و غیاب، رویدادها و پیام‌رسان داخلی — همه در یک جای امن و سریع.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <Link href="/introduce" className="b-btn b-btn-ink b-btn-lg">
                    معرفی بهار
                  </Link>
                  {isLoggedIn && (
                    <Link href="/app" className="b-btn b-btn-outline">
                      ورود به پنل
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-8 t-sm text-steel">
                  <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> وب</span>
                  <a
                    href={platformLink(androidUrl)}
                    className="flex items-center gap-1.5 hover:text-spring transition-colors font-bold"
                    {...(androidUrl ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <Smartphone className="w-4 h-4" /> اندروید
                    {androidUrl && <Download className="w-3 h-3" />}
                  </a>
                  <a
                    href={platformLink(windowsUrl)}
                    className="flex items-center gap-1.5 hover:text-spring transition-colors font-bold"
                    {...(windowsUrl ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <Monitor className="w-4 h-4" /> ویندوز
                    {windowsUrl && <Download className="w-3 h-3" />}
                  </a>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative"
              >
                <div className="b-card overflow-hidden p-0 b-shadow-rail">
                  <Image
                    src="/img/hero-classroom.png"
                    alt="کلاس درخشان مدرسه با نور بهاری"
                    width={1344}
                    height={768}
                    priority
                    className="w-full h-auto aspect-[7/4] object-cover"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Feature tiles */}
        <section id="features" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURE_TILES.map((f) => (
              <div key={f.title} className="b-card-sm p-5 md:p-6 flex flex-col gap-3">
                <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </span>
                <div className="t-h3 font-semibold">{f.title}</div>
                <p className="t-sm text-steel">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Photographic cards */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 grid md:grid-cols-2 gap-6">
          {[
            {
              img: "/img/manager-desk.png",
              alt: "مدیر مدرسه در حال بررسی داشبورد بهار",
              kicker: "برای مدیر مدرسه",
              title: "کنترل کامل، یک نگاه",
              desc: shadEnabled
                ? "داشبورد زنده مدرسه، تعیین دسترسی معاون و معلم، ساخت حساب کاربران و ارسال رمز با شاد."
                : "داشبورد زنده مدرسه، تعیین دسترسی معاون و معلم و ساخت حساب کاربران.",
              flip: false,
            },
            {
              img: "/img/parent-phone.png",
              alt: "ولی دانش‌آموز در حال مشاهده کارنامه در بهار",
              kicker: "برای اولیا",
              title: "کارنامه فرزند، همیشه همراه",
              desc: "نمرات، کارنامه ماهانه، حضور و غیاب، تکالیف و رویدادها — در نسخه موبایل، هر لحظه در جیب شما.",
              flip: true,
            },
          ].map((c) => (
            <div key={c.title} className={`b-card overflow-hidden ${c.flip ? "md:flex-row-reverse" : ""} md:flex p-0`}>
              <div className="md:w-1/2">
                <Image
                  src={c.img}
                  alt={c.alt}
                  width={1152}
                  height={864}
                  className="w-full h-56 md:h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-7 md:p-9 flex flex-col gap-3 justify-center">
                <span className="b-badge b-badge-blossom self-start">{c.kicker}</span>
                <h3 className="t-h2 font-medium">{c.title}</h3>
                <p className="t-body text-steel">{c.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Roles */}
        <section id="roles" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-display font-medium text-center">هر نقش، به اندازه‌ی خودش</h2>
          <p className="t-sub text-center mt-4 max-w-2xl mx-auto">
            دسترسی دانش‌آموز و ولی فقط به اندازه نیاز است؛ دسترسی معاون و معلم را مدیر مدرسه
            تعیین می‌کند و مدیریت کل سرویس بر عهده ادمین سرویس است.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-10">
            {ROLES.map((r) => (
              <div
                key={r.title}
                className={r.tone === "spring" ? "b-card-tint p-6 md:p-7" : "b-card-md p-6 md:p-7"}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      r.tone === "spring" ? "bg-background/70 text-spring" : "bg-spring-tint text-spring"
                    }`}
                  >
                    <r.icon className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-bold">{r.title}</h3>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {(shadEnabled ? r.caps : r.caps.filter((c) => !c.includes("شاد"))).map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[13.5px] leading-relaxed">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                      <span className={r.tone === "spring" ? "" : "text-steel"}>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-display font-medium text-center">کامل‌ترین سامانه مدیریت مدرسه</h2>
          <p className="t-sub text-center mt-4">۱۶ ماژول به‌هم‌پیوسته، از پرونده دانش‌آموز تا سایت اختصاصی مدرسه</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-10">
            {modules.map((m) => (
              <div key={m.title} className="b-card-sm p-5 flex flex-col gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
                  <m.icon className="w-5 h-5" />
                </span>
                <div className="font-bold text-[14.5px]">{m.title}</div>
                <p className="t-sm text-steel">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-h1 font-medium text-center">سوالات متداول</h2>
          <div className="flex flex-col gap-3 mt-8">
            {faqs.map((f) => (
              <Faq key={f.q} {...f} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
          <div className="b-card-tint p-8 md:p-14 text-center flex flex-col items-center gap-5">
            <Image src="/logo.svg" alt="بهار" width={56} height={56} />
            <h2 className="t-h1 font-medium">آماده شکوفایی مدرسه‌تان هستید؟</h2>
            <p className="t-sub max-w-xl">
              همه قابلیت‌ها، اشتراک‌ها و حساب دمو را در یک صفحه ببینید؛ سپس مدرسه‌تان را به
              بهار تبدیل کنید — از ثبت نمره تا کارنامه، از حضور و غیاب تا اطلاع‌رسانی.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/introduce" className="b-btn b-btn-spring b-btn-lg">
                معرفی بهار
              </Link>
              <Link href={isLoggedIn ? "/app" : "/login"} className="b-btn b-btn-soft b-btn-lg">
                {isLoggedIn ? "ورود به پنل" : "ورود به حساب"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline-soft bg-background mt-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="بهار" width={28} height={28} />
              <span className="text-lg font-bold">بهار</span>
            </div>
            <p className="t-sm text-steel">
              سامانه جامع مدیریت مدرسه — وب، اندروید و ویندوز؛ با زبان طراحی متا و رنگ‌های اختصاصی بهار.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">ماژول‌ها</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li>دانش‌آموزان و اولیا</li>
              <li>نمرات و کارنامه</li>
              <li>کارنامه ماهانه</li>
              <li>حضور و غیاب</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">نقش‌ها</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li>ادمین سرویس</li>
              <li>مدیر مدرسه</li>
              <li>معاون و معلم</li>
              <li>دانش‌آموز و ولی</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">لینک‌ها</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li><Link href="/introduce" className="hover:text-spring">معرفی بهار</Link></li>
              <li><Link href="/blog" className="hover:text-spring">بلاگ بهار</Link></li>
              <li><Link href="/languages" className="hover:text-spring">کیت ساخت زبان</Link></li>
              <li><Link href="/login" className="hover:text-spring">ورود</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">پلتفرم‌ها</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> نسخه وب</li>
              <li>
                <a href={platformLink(androidUrl)} {...(androidUrl ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-1.5 hover:text-spring transition-colors">
                  <Smartphone className="w-3.5 h-3.5" /> اندروید {androidUrl && <Download className="w-3 h-3" />}
                </a>
              </li>
              <li>
                <a href={platformLink(windowsUrl)} {...(windowsUrl ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-1.5 hover:text-spring transition-colors">
                  <Monitor className="w-3.5 h-3.5" /> ویندوز {windowsUrl && <Download className="w-3 h-3" />}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-hairline-soft py-4 t-cap text-stone text-center">
          بهار · سامانه مدیریت مدرسه
        </div>
      </footer>
    </div>
  );
}
