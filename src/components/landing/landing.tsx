"use client";

import { useEffect, useState } from "react";
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
import { SITE_CATALOG, LONG_CATALOG } from "@/lib/langs";

const NAV = [
  { href: "#features", key: "site.nav.features" },
  { href: "#roles", key: "site.nav.roles" },
  { href: "/blog", key: "site.nav.blog", link: true },
  { href: "#faq", key: "site.nav.faq" },
];

const FEATURE_TILES = [
  { icon: Globe, tKey: "site.feat.web.t", dKey: "site.feat.web.d" },
  { icon: Smartphone, tKey: "site.feat.android.t", dKey: "site.feat.android.d" },
  { icon: Monitor, tKey: "site.feat.windows.t", dKey: "site.feat.windows.d" },
  { icon: Lock, tKey: "site.feat.security.t", dKey: "site.feat.security.d" },
];

const MODULES = [
  { icon: Users, key: "students", tKey: "site.mod.students.t", dKey: "site.mod.students.d" },
  { icon: GraduationCap, key: "teachers", tKey: "site.mod.teachers.t", dKey: "site.mod.teachers.d" },
  { icon: School, key: "classes", tKey: "site.mod.classes.t", dKey: "site.mod.classes.d" },
  { icon: CalendarDays, key: "schedule", tKey: "site.mod.schedule.t", dKey: "site.mod.schedule.d" },
  { icon: ClipboardCheck, key: "attendance", tKey: "site.mod.attendance.t", dKey: "site.mod.attendance.d" },
  { icon: BarChart3, key: "grades", tKey: "site.mod.grades.t", dKey: "site.mod.grades.d" },
  { icon: FileText, key: "monthly", tKey: "site.mod.monthly.t", dKey: "site.mod.monthly.d" },
  { icon: BookOpen, key: "assignments", tKey: "site.mod.assignments.t", dKey: "site.mod.assignments.d" },
  { icon: Sparkles, key: "events", tKey: "site.mod.events.t", dKey: "site.mod.events.d" },
  { icon: BellRing, key: "notices", tKey: "site.mod.notices.t", dKey: "site.mod.notices.d" },
  { icon: MessageCircle, key: "messenger", tKey: "site.mod.messenger.t", dKey: "site.mod.messenger.d" },
  { icon: Send, key: "shad", tKey: "site.mod.shad.t", dKey: "site.mod.shad.d" },
  { icon: Globe, key: "site", tKey: "site.mod.site.t", dKey: "site.mod.site.d" },
  { icon: Map, key: "map", tKey: "site.mod.map.t", dKey: "site.mod.map.d" },
  { icon: Sparkles, key: "finance", tKey: "site.mod.finance.t", dKey: "site.mod.finance.d" },
  { icon: Users, key: "support", tKey: "site.mod.support.t", dKey: "site.mod.support.d" },
];

const ROLES = [
  {
    tKey: "site.role.admin.t", tone: "soft" as const, icon: ServerCog,
    capKeys: ["site.role.admin.c1", "site.role.admin.c2", "site.role.admin.c3"],
  },
  {
    tKey: "site.role.manager.t", tone: "spring" as const, icon: School,
    capKeys: ["site.role.manager.c1", "site.role.manager.c2", "site.role.manager.c3", "site.role.manager.c4"],
  },
  {
    tKey: "site.role.deputy.t", tone: "soft" as const, icon: Users,
    capKeys: ["site.role.deputy.c1", "site.role.deputy.c2", "site.role.deputy.c3"],
  },
  {
    tKey: "site.role.teacher.t", tone: "soft" as const, icon: BookOpen,
    capKeys: ["site.role.teacher.c1", "site.role.teacher.c2", "site.role.teacher.c3"],
  },
  {
    tKey: "site.role.student.t", tone: "soft" as const, icon: GraduationCap,
    capKeys: ["site.role.student.c1", "site.role.student.c2", "site.role.student.c3"],
  },
  {
    tKey: "site.role.parent.t", tone: "soft" as const, icon: MessageCircle,
    capKeys: ["site.role.parent.c1", "site.role.parent.c2", "site.role.parent.c3"],
  },
];

// FAQ — شاد فقط ایران: shadOnly = آیتم کاملاً مخفی، aNoShad = پاسخ بدون شاد
// پرسش‌ها از کاتالوگ سایت و پاسخ‌های بلند از کاتالوگ LONG ترجمه می‌شوند (fallback فارسی).
const FAQS: Array<{
  q: string;
  qKey: string;
  a: string;
  aKey: string;
  shadOnly?: boolean;
  aNoShad?: string;
  aNoShadKey?: string;
}> = [
  {
    q: "چطور وارد حسابم می‌شوم؟",
    qKey: "site.faq.q1",
    aKey: "long.faq.a1",
    a: "نام کاربری شما «کد ملی» است و رمز عبور به‌صورت تصادفی توسط سامانه ساخته می‌شود و از طریق پیام‌رسان شاد به شماره ثبت‌شده شما ارسال می‌گردد. برای همه کاربران — از مدیر مدرسه تا دانش‌آموز — روش ورود یکسان است. بعد از ورود اول، از بخش پروفایل رمز خود را تغییر دهید؛ این کار برای امنیت حساب الزامی است.",
    aNoShadKey: "long.faq.a1NoShad",
    aNoShad:
      "نام کاربری شما «کد ملی» است و رمز عبور به‌صورت تصادفی توسط سامانه ساخته می‌شود و مدیر مدرسه آن را به شما تحویل می‌دهد. برای همه کاربران — از مدیر مدرسه تا دانش‌آموز — روش ورود یکسان است. بعد از ورود اول، از بخش پروفایل رمز خود را تغییر دهید؛ این کار برای امنیت حساب الزامی است.",
  },
  {
    q: "رمزم را فراموش کردم، چه کار کنم؟",
    qKey: "site.faq.q2",
    aKey: "long.faq.a2",
    a: "با مدیر مدرسه خود تماس بگیرید. مدیر از پنل کاربران می‌تواند برای شما رمز جدید تصادفی بسازد و آن را از طریق شاد برایتان ارسال کند. رمزها به‌صورت رمزنگاری‌شده ذخیره می‌شوند و هیچ‌کس — حتی مدیر — رمز فعلی شما را نمی‌بیند؛ فقط امکان ساخت رمز جدید وجود دارد.",
    aNoShadKey: "long.faq.a2NoShad",
    aNoShad:
      "با مدیر مدرسه خود تماس بگیرید. مدیر از پنل کاربران می‌تواند برای شما رمز جدید تصادفی بسازد و آن را به شما تحویل دهد. رمزها به‌صورت رمزنگاری‌شده ذخیره می‌شوند و هیچ‌کس — حتی مدیر — رمز فعلی شما را نمی‌بیند؛ فقط امکان ساخت رمز جدید وجود دارد.",
  },
  {
    q: "چرا پیام‌رسان بهار محدود است؟",
    qKey: "site.faq.q3",
    aKey: "long.faq.a3",
    a: "پیام‌رسان داخلی فقط برای پیام‌های کوتاه و سبک طراحی شده تا سرور سامانه همیشه سریع بماند. برای ارسال فایل، عکس و محتوای حجیم، از پیام‌رسان شاد استفاده کنید؛ بهار در پیام‌رسان داخلی همین نکته را به شما یادآوری می‌کند.",
    aNoShadKey: "long.faq.a3NoShad",
    aNoShad:
      "پیام‌رسان داخلی فقط برای پیام‌های کوتاه و سبک طراحی شده تا سرور سامانه همیشه سریع بماند. برای ارسال فایل، عکس و محتوای حجیم، از ابزارهای ارتباطی رایج استفاده کنید؛ بهار در پیام‌رسان داخلی همین نکته را به شما یادآوری می‌کند.",
  },
  {
    q: "بهار روی چه پلتفرم‌هایی کار می‌کند؟",
    qKey: "site.faq.q4",
    aKey: "long.faq.a4",
    a: "نسخه وب در همه مرورگرها اجرا می‌شود و همین نسخه به‌صورت اپلیکیشن روی اندروید و ویندوز نصب می‌شود؛ یعنی یک حساب، سه پلتفرم. نسخه اندروید همچنین به‌صورت فایل APK مستقل در اختیار مدرسه قرار می‌گیرد.",
  },
  {
    q: "رمز عبور تصادفی چقدر امن است؟",
    qKey: "site.faq.q5",
    aKey: "long.faq.a5",
    a: "رمزها با مولد امن رمزنگاری ساخته و به‌صورت هش ذخیره می‌شوند. بعد از چند تلاش ناموفق، حساب موقتاً قفل می‌شود و تغییر رمز پس از ورود اول الزامی است. بهار هیچ رمزی را به‌صورت متن ساده نگه نمی‌دارد.",
  },
  {
    q: "اطلاعات دانش‌آموز و ولی در پرونده چه چیزهایی است؟",
    qKey: "site.faq.q6",
    aKey: "long.faq.a6",
    a: "پرونده دانش‌آموز شامل اطلاعات کامل خود او و همچنین اطلاعات کامل ولی (نام، کد ملی، شماره تماس و شماره شاد) است. پرونده معلمان، معاونین و مدیران نیز اطلاعات کامل خودشان را دارد. دسترسی به هر پرونده فقط برای نقش‌های مجاز انجام می‌شود.",
    aNoShadKey: "long.faq.a6NoShad",
    aNoShad:
      "پرونده دانش‌آموز شامل اطلاعات کامل خود او و همچنین اطلاعات کامل ولی (نام، کد ملی و شماره تماس) است. پرونده معلمان، معاونین و مدیران نیز اطلاعات کامل خودشان را دارد. دسترسی به هر پرونده فقط برای نقش‌های مجاز انجام می‌شود.",
  },
  {
    q: "دسترسی معاون و معلم چگونه تعیین می‌شود؟",
    qKey: "site.faq.q7",
    aKey: "long.faq.a7",
    a: "مدیر مدرسه هنگام ساخت یا ویرایش هر معاون و معلم، دقیقاً مشخص می‌کند به چه بخش‌هایی دسترسی داشته باشد؛ مثل ثبت نمرات، حضور و غیاب، مدیریت دانش‌آموزان یا رویدادها. هر تغییر دسترسی بلافاصله اعمال می‌شود و در گزارش فعالیت ثبت می‌گردد.",
  },
  {
    q: "ارسال رمز با شاد چگونه انجام می‌شود؟",
    qKey: "site.faq.q8",
    aKey: "long.faq.a8",
    a: "مدیر مدرسه یک‌بار حساب شاد خود را به سامانه متصل می‌کند؛ از آن پس بهار نام کاربری و رمز هر کاربر جدید را به شماره شاد ثبت‌شده او می‌فرستد. این فقط یک امکان جانبی برای راحتی کار است و در صورت عدم اتصال، مدیر رمز را از راه دیگری به کاربر می‌رساند.",
    shadOnly: true,
  },
  {
    q: "آیا امکان نصب نسخه اندروید به‌صورت APK وجود دارد؟",
    qKey: "site.faq.q9",
    aKey: "long.faq.a9",
    a: "بله. علاوه بر نصب مستقیم از مرورگر، فایل پروژه اندرویدی بهار در اختیار مدرسه قرار می‌گیرد که با اندروید استودیو به‌راحتی به APK تبدیل می‌شود؛ بدون نیاز به گوگل‌پلی.",
  },
  {
    q: "کارنامه ماهانه چیست؟",
    qKey: "site.faq.q10",
    aKey: "long.faq.a10",
    a: "در کنار کارنامه نهایی، بهار هر ماه یک خلاصه عملکرد برای هر دانش‌آموز می‌سازد: میانگین نمرات همان ماه، روزهای حضور و غیبت و تکالیف آن ماه. این خلاصه برای دانش‌آموز و ولی در بخش نمرات نمایش داده می‌شود تا روند پیشرفت ماه‌به‌ماه دیده شود.",
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="b-card-sm p-5 md:p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-end cursor-pointer"
        aria-expanded={open}
      >
        <span className="font-bold text-[16px] md:text-base">{q}</span>
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
  siteLang = "fa",
  browserLang = "fa",
  siteDir = "rtl",
  siteStrings = {},
  longStrings = {},
  siteLangs = [{ code: "fa", nativeName: "فارسی", direction: "rtl" as const }],
}: {
  isLoggedIn: boolean;
  androidUrl?: string | null;
  windowsUrl?: string | null;
  /** شاد فقط برای بسته ایران — سایر ریجن‌ها هیچ نامی از آن ندارند */
  shadEnabled?: boolean;
  /** زبان سایت عمومی (کوکی bahar_site_lang) + جملات آن + فهرست زبان‌ها */
  siteLang?: string;
  /** زبان مرورگر از Accept-Language — برای هدر لندینگ: فقط فارسی + انگلیسی + مرورگر */
  browserLang?: string;
  siteDir?: "rtl" | "ltr";
  siteStrings?: Record<string, string>;
  longStrings?: Record<string, string>;
  siteLangs?: { code: string; nativeName: string; direction: "rtl" | "ltr" }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // جملهٔ سایت: ترجمهٔ بسته، وگرنه فارسی پایه، وگرنه خودِ کلید
  const t = (key: string): string => siteStrings[key] ?? SITE_CATALOG[key] ?? key;
  const lt = (key: string): string | undefined => longStrings[key] ?? LONG_CATALOG[key];

  useEffect(() => {
    document.documentElement.lang = siteLang;
    document.documentElement.dir = siteDir;
  }, [siteLang, siteDir]);

  function changeSiteLang(code: string) {
    document.cookie = `bahar_site_lang=${code}; path=/; max-age=31536000`;
    location.reload();
  }

  // شاد خاموش → ماژول جایگزین خنثی (شبکه ۱۶تایی و عنوان بخش دست‌نخورده)
  const modules = shadEnabled
    ? MODULES
    : MODULES.map((m) =>
        m.key === "shad"
          ? { icon: DatabaseBackup, key: "backup", tKey: "site.mod.backup.t", dKey: "site.mod.backup.d" }
          : m
      );

  // شاد خاموش → حذف سوال اختصاصی شاد و جایگزینی پاسخ‌های دارای شاد
  const faqs = shadEnabled
    ? FAQS
    : FAQS.filter((f) => !f.shadOnly).map((f) => (f.aNoShad ? { ...f, a: f.aNoShad, aKey: f.aNoShadKey ?? f.aKey } : f));

  const platformLink = (url?: string | null) => (url && url.startsWith("http") ? url : "/introduce");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="بهار">
            <Image src="/logo.svg" alt={t("site.footer.logoAlt")} width={34} height={34} priority />
            <span className="flex flex-col leading-none">
              <span className="text-[22px] font-bold tracking-tight">بهار</span>
              <span className="text-[12px] text-steel font-medium hidden sm:block">{t("site.brand.tagline")}</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            {NAV.map((n) =>
              n.href.startsWith("/") ? (
                <Link key={n.href} href={n.href} className="b-pill-tab">{t(n.key)}</Link>
              ) : (
                <a key={n.href} href={n.href} className="b-pill-tab">{t(n.key)}</a>
              )
            )}
          </nav>

          <div className="flex items-center gap-1.5">
            <select
              aria-label={t("site.lang")}
              value={siteLang}
              onChange={(e) => changeSiteLang(e.target.value)}
              className="b-btn b-btn-ghost b-btn-sm !px-2"
            >
              {siteLangs.filter((l) => l.code === "fa" || l.code === "en" || l.code === browserLang || l.code === siteLang).map((l) => (
                <option key={l.code} value={l.code}>{l.nativeName}</option>
              ))}
            </select>
            <a href="/languages" className="b-btn b-btn-ghost b-btn-sm !px-2">{t("site.lang.more") ?? "بیشتر"}</a>
            <ThemeToggle />
            <Link href={isLoggedIn ? "/app" : "/login"} className="b-btn b-btn-ink b-btn-sm">
              {isLoggedIn ? t("site.panel") : t("site.login")}
            </Link>
            {/* منو: فقط موبایل */}
            <button
              className="b-only-mobile md:hidden b-btn b-btn-ghost !p-0 w-10 h-10 !min-h-10"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={t("site.nav.menu")}
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
                <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="b-pill-tab justify-center">{t(n.key)}</Link>
              ) : (
                <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className="b-pill-tab justify-center">{t(n.key)}</a>
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
                  <Sparkles className="w-3.5 h-3.5" /> {t("site.hero.badge")}
                </span>
                <h1 className="t-hero font-medium">
                  {t("site.hero.title")}
                </h1>
                <p className="t-sub mt-5 max-w-lg">
                  {t("site.hero.sub")}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <Link href="/introduce" className="b-btn b-btn-ink b-btn-lg">
                    {t("site.intro")}
                  </Link>
                  {isLoggedIn && (
                    <Link href="/app" className="b-btn b-btn-outline">
                      {t("site.panel")}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-8 t-sm text-steel">
                  <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> {t("site.hero.web")}</span>
                  <a
                    href={platformLink(androidUrl)}
                    className="flex items-center gap-1.5 hover:text-spring transition-colors font-bold"
                    {...(androidUrl ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <Smartphone className="w-4 h-4" /> {t("site.hero.android")}
                    {androidUrl && <Download className="w-3 h-3" />}
                  </a>
                  <a
                    href={platformLink(windowsUrl)}
                    className="flex items-center gap-1.5 hover:text-spring transition-colors font-bold"
                    {...(windowsUrl ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <Monitor className="w-4 h-4" /> {t("site.hero.windows")}
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
                    alt={t("site.hero.imgAlt")}
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
              <div key={f.tKey} className="b-card-sm p-5 md:p-6 flex flex-col gap-3">
                <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
                  <f.icon className="w-5 h-5" />
                </span>
                <div className="t-h3 font-semibold">{t(f.tKey)}</div>
                <p className="t-sm text-steel">{t(f.dKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Photographic cards */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 grid md:grid-cols-2 gap-6">
          {[
            {
              img: "/img/manager-desk.png",
              altKey: "site.show.manager.alt",
              kickerKey: "site.show.manager.kicker",
              titleKey: "site.show.manager.title",
              descKey: shadEnabled ? "site.show.manager.desc" : "site.show.manager.descNoShad",
              flip: false,
            },
            {
              img: "/img/parent-phone.png",
              altKey: "site.show.parent.alt",
              kickerKey: "site.show.parent.kicker",
              titleKey: "site.show.parent.title",
              descKey: "site.show.parent.desc",
              flip: true,
            },
          ].map((c) => (
            <div key={c.titleKey} className={`b-card overflow-hidden ${c.flip ? "md:flex-row-reverse" : ""} md:flex p-0`}>
              <div className="md:w-1/2">
                <Image
                  src={c.img}
                  alt={t(c.altKey)}
                  width={1152}
                  height={864}
                  className="w-full h-56 md:h-full object-cover"
                />
              </div>
              <div className="md:w-1/2 p-7 md:p-9 flex flex-col gap-3 justify-center">
                <span className="b-badge b-badge-blossom self-start">{t(c.kickerKey)}</span>
                <h3 className="t-h2 font-medium">{t(c.titleKey)}</h3>
                <p className="t-body text-steel">{t(c.descKey)}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Roles */}
        <section id="roles" className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-display font-medium text-center">{t("site.roles.heading")}</h2>
          <p className="t-sub text-center mt-4 max-w-2xl mx-auto">
            {t("site.roles.sub")}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-10">
            {ROLES.map((r) => (
              <div
                key={r.tKey}
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
                  <h3 className="text-lg font-bold">{t(r.tKey)}</h3>
                </div>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {(shadEnabled ? r.capKeys : r.capKeys.filter((c) => c !== "site.role.manager.c4")).map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[14px] leading-relaxed">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                      <span className={r.tone === "spring" ? "" : "text-steel"}>{t(c)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Modules */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-display font-medium text-center">{t("site.modules.heading")}</h2>
          <p className="t-sub text-center mt-4">{t("site.modules.sub")}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-10">
            {modules.map((m) => (
              <div key={m.key} className="b-card-sm p-5 flex flex-col gap-2.5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center">
                  <m.icon className="w-5 h-5" />
                </span>
                <div className="font-bold text-[14px]">{t(m.tKey)}</div>
                <p className="t-sm text-steel">{t(m.dKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <h2 className="t-h1 font-medium text-center">{t("site.faq.heading")}</h2>
          <div className="flex flex-col gap-3 mt-8">
            {faqs.map((f) => (
              <Faq key={f.qKey} q={t(f.qKey)} a={lt(f.aKey) ?? f.a} />
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-16 md:pb-24">
          <div className="b-card-tint p-8 md:p-14 text-center flex flex-col items-center gap-5">
            <Image src="/logo.svg" alt="بهار" width={56} height={56} />
            <h2 className="t-h1 font-medium">{t("site.cta.heading")}</h2>
            <p className="t-sub max-w-xl">
              {t("site.cta.sub")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/introduce" className="b-btn b-btn-spring b-btn-lg">
                {t("site.intro")}
              </Link>
              <Link href={isLoggedIn ? "/app" : "/login"} className="b-btn b-btn-soft b-btn-lg">
                {isLoggedIn ? t("site.panel") : t("site.account")}
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
              <Image src="/logo.svg" alt={t("site.footer.logoAlt")} width={28} height={28} />
              <span className="text-lg font-bold">بهار</span>
            </div>
            <p className="t-sm text-steel">
              {t("site.footer.about")}
            </p>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">{t("site.footer.modules")}</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li>{t("site.mod.students.t")}</li>
              <li>{t("site.mod.grades.t")}</li>
              <li>{t("site.mod.monthly.t")}</li>
              <li>{t("site.mod.attendance.t")}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">{t("site.footer.roles")}</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li>{t("site.role.admin.t")}</li>
              <li>{t("site.role.manager.t")}</li>
              <li>{t("site.footer.r3")}</li>
              <li>{t("site.footer.r4")}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">{t("site.footer.links")}</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li><Link href="/introduce" className="hover:text-spring">{t("site.intro")}</Link></li>
              <li><Link href="/blog" className="hover:text-spring">{t("site.blogTitle")}</Link></li>
              <li><Link href="/languages" className="hover:text-spring">{t("site.langKit")}</Link></li>
              <li><Link href="/login" className="hover:text-spring">{t("site.login")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3">{t("site.footer.platforms")}</h4>
            <ul className="flex flex-col gap-2 t-sm text-steel">
              <li className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {t("site.footer.p1")}</li>
              <li>
                <a href={platformLink(androidUrl)} {...(androidUrl ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-1.5 hover:text-spring transition-colors">
                  <Smartphone className="w-3.5 h-3.5" /> {t("site.hero.android")} {androidUrl && <Download className="w-3 h-3" />}
                </a>
              </li>
              <li>
                <a href={platformLink(windowsUrl)} {...(windowsUrl ? { target: "_blank", rel: "noreferrer" } : {})} className="flex items-center gap-1.5 hover:text-spring transition-colors">
                  <Monitor className="w-3.5 h-3.5" /> {t("site.hero.windows")} {windowsUrl && <Download className="w-3 h-3" />}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-hairline-soft py-4 t-cap text-stone text-center">
          {t("site.footer.bottom")}
        </div>
      </footer>
    </div>
  );
}
