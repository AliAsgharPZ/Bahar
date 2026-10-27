import Link from "next/link";
import Image from "next/image";
import {
  GraduationCap, BookOpen, ClipboardCheck, BarChart3, NotebookPen, BellRing,
  MessageCircle, Globe, Wallet, ShieldCheck, KeyRound, DatabaseBackup,
  LifeBuoy, Newspaper, Smartphone, Map, Check, Minus, FileText, Sprout, Crown,
} from "lucide-react";
import { db } from "@/lib/db";
import { PLANS, PLAN_ORDER, PLAN_FEATURE_LABELS, RECOMMENDED_PLAN, type PlanFeature } from "@/lib/plans";
import { faDigits } from "@/lib/persian";
import { getSettings } from "@/lib/settings";
import { getActiveCountryPublic } from "@/lib/country/server";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ContactDemo } from "./contact-demo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "پلن‌ها و اشتراک‌ها | سامانه مدیریت مدارس بهار",
  description: "اشتراک‌های سامانه بهار — نقره‌ای، طلایی و الماسی؛ همه قابلیت‌ها، مقایسه پلن‌ها و حساب دموی رایگان برای مدیران مدارس",
};

// شاد فقط ایران — در ریجن‌های دیگر متن خنثی بدون هیچ نامی از شاد
const FEATURES: Array<{
  icon: typeof GraduationCap;
  title: string;
  desc: string;
  titleNoShad?: string;
  descNoShad?: string;
}> = [
  { icon: GraduationCap, title: "مدیریت کامل دانش‌آموزان", desc: "پرونده کامل دانش‌آموز + اولیا، انتقال، سلامت، پیشینه تحصیلی" },
  { icon: BookOpen, title: "کلاس‌ها، درس‌ها و برنامه هفتگی", desc: "چیدمان زنگ‌ها، معلم هر درس، ظرفیت و سال تحصیلی" },
  { icon: ClipboardCheck, title: "حضور و غیاب روزانه شمسی", desc: "ثبت سریع با تقویم جلالی، گزارش غیبت و تاخیر" },
  { icon: BarChart3, title: "نمرات و کارنامه", desc: "کوئیز تا پایان‌ترم، میانگین وزنی، کارنامه کامل" },
  { icon: FileText, title: "کارنامه ماهانه", desc: "خلاصه عملکرد هر ماه: نمرات، غیبت و تکالیف همان ماه" },
  { icon: NotebookPen, title: "تکالیف و رویدادها", desc: "تکلیف با مهلت شمسی، تقویم امتحانات و مراسم" },
  { icon: BellRing, title: "اطلاعیه هوشمند", desc: "هدف‌گیری بر اساس نوع کاربر و نقشه ایران (استان/شهرستان)" },
  { icon: MessageCircle, title: "پیام‌رسان داخلی + شاد", desc: "پیام کوتاه در سامانه، ارسال رمز و اطلاعیه با شاد", titleNoShad: "پیام‌رسان داخلی", descNoShad: "پیام کوتاه و سبک برای ارتباط مدرسه و اولیا" },
  { icon: Globe, title: "سایت اختصاصی مدرسه", desc: "۱۶ تمپلیت آماده با آدرس اختصاصی، ویرایش متن/عکس توسط مدیر" },
  { icon: Wallet, title: "شهریه و امور مالی", desc: "ثبت گروهی برای کلاس، پیگیری پرداخت و معافیت" },
  { icon: ShieldCheck, title: "دسترسی‌های ریز", desc: "از کلی‌ترین تا جزئی‌ترین سطح دسترسی برای معاون، معلم و ادمین" },
  { icon: KeyRound, title: "ورود با کد ملی", desc: "نام کاربری = کد ملی، رمز تصادفی امن، ارسال با شاد", descNoShad: "نام کاربری = کد ملی، رمز تصادفی امن" },
  { icon: DatabaseBackup, title: "بکاپ خودکار ماهانه", desc: "پشتیبان‌گیری کامل + بازیابی آپلودی یک‌کلیکی" },
  { icon: LifeBuoy, title: "پشتیبانی تیکتی", desc: "تیکت مستقیم به تیم پشتیبانی با پاسخ‌گویی سریع" },
  { icon: Newspaper, title: "بلاگ و محتوا", desc: "بلاگ سرویس با نظرات کنترل‌شده" },
  { icon: Smartphone, title: "اپ اندروید و ویندوز", desc: "اپ اختصاصی مدرسه + PWA روی همه دستگاه‌ها" },
  { icon: Map, title: "انتخاب شهرستان از نقشه", desc: "۳۱ استان و همه شهرستان‌های ایران روی نقشه تعاملی" },
];

const ALL_PLAN_FEATURES = ["core", "events", "announcements", "messenger", "shad", "finance", "website", "custom_domain", "advanced_reports"] as PlanFeature[];

/** صفحه پلن‌ها و اشتراک‌ها — انتخاب اشتراک توسط مدیران مدارس */
export default async function PlansPage() {
  const settings = await getSettings();
  const [schoolCount, studentCount, country] = await Promise.all([
    db.school.count({ where: { isActive: true } }),
    db.student.count(),
    getActiveCountryPublic(),
  ]);
  // شاد فقط بسته ایران — ردیف/کارت‌های شاد برای سایر ریجن‌ها کاملاً مخفی
  const shadEnabled = country.modules.shad;
  const features = shadEnabled
    ? FEATURES
    : FEATURES.map((f) =>
        f.titleNoShad || f.descNoShad
          ? { ...f, title: f.titleNoShad ?? f.title, desc: f.descNoShad ?? f.desc }
          : f
      );
  const planFeatures = shadEnabled ? ALL_PLAN_FEATURES : ALL_PLAN_FEATURES.filter((f) => f !== "shad");

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col text-foreground">
      <header className="sticky top-0 z-30 bg-background border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="بهار" width={30} height={30} />
            <b className="text-[16px]">بهار</b>
          </Link>
          <span className="text-[11px] text-steel hidden sm:inline">پلن‌ها و اشتراک‌ها</span>
          <div className="ms-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/login" className="b-btn b-btn-soft b-btn-sm">ورود</Link>
          </div>
          <Link href="/#faq" className="b-btn b-btn-ghost b-btn-sm hidden sm:inline-flex">سوالات متداول</Link>
        </div>
      </header>

      {/* هیرو — تمرکز روی انتخاب پلن */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 b-hero-grad" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20 text-center">
          <span className="b-badge b-badge-spring mb-5 inline-block">
            <Sprout className="w-3.5 h-3.5" /> اشتراک‌های بهار
          </span>
          <h1 className="text-[32px] md:text-[46px] font-extrabold leading-[1.25] mb-5 max-w-3xl mx-auto">
            پلن مناسب مدرسه‌تان را <span className="text-spring">انتخاب کنید</span>
          </h1>
          <p className="text-[14.5px] md:text-[16px] text-steel leading-relaxed max-w-2xl mx-auto mb-8">
            سه اشتراک نقره‌ای، طلایی و الماسی — همه شامل پنل مدیریت، اپ اندروید/ویندوز و پشتیبانی؛
            هر مدرسه هر زمان می‌تواند پلن خود را ارتقا دهد.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="#pricing" className="b-btn b-btn-spring">مقایسه پلن‌ها</a>
            <a href="#demo" className="b-btn b-btn-soft">دموی رایگان</a>
          </div>
          <div className="flex items-center justify-center gap-8 mt-10 flex-wrap">
            {[
              { v: schoolCount, l: "مدرسه فعال" },
              { v: studentCount, l: "دانش‌آموز" },
              { v: 16, l: "ماژول کامل" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <b className="text-[26px] text-spring block">{faDigits(s.v)}</b>
                <span className="text-[11.5px] text-steel">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* پلن‌ها — بخش اصلی صفحه */}
      <section id="pricing" className="py-14 bg-cloud/60 border-y border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-[24px] md:text-[30px] font-extrabold mb-3 text-center">اشتراک مدارس</h2>
          <p className="text-[13.5px] text-steel text-center mb-10">همه اشتراک‌ها شامل پنل مدیریت، اپ و پشتیبانی هستند؛ تفاوت در قابلیت‌هاست.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PLAN_ORDER.map((key) => {
              const p = PLANS[key];
              const isBest = key === RECOMMENDED_PLAN;
              return (
                <div key={key} className={`b-card !rounded-3xl p-6 flex flex-col ${isBest ? "ring-2 ring-spring/50 !border-spring/50 shadow-lg" : ""}`}>
                  {isBest && (
                    <span className="b-badge b-badge-spring mb-3 self-start">
                      <Crown className="w-3 h-3" /> پیشنهاد ما
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${p.color}22` }}>
                      <span className="w-4 h-4 rounded-full" style={{ background: p.color }} />
                    </span>
                    <b className={`text-[17px] ${isBest ? "text-[19px] font-extrabold" : ""}`}>اشتراک {p.label}</b>
                    {isBest && <span className="b-badge b-badge-blossom !text-[9.5px]">کامل‌ترین</span>}
                  </div>
                  <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                    {planFeatures.map((f) => {
                      const has = p.features.includes(f);
                      return (
                        <li key={f} className={`text-[11.5px] flex items-start gap-2 ${has ? "text-ink" : "text-stone"}`}>
                          {has ? (
                            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-spring font-bold" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 mt-0.5 shrink-0 text-stone" />
                          )}
                          <span className={has ? "" : "line-through"}>{PLAN_FEATURE_LABELS[f]}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <a href="#demo" className={`b-btn b-btn-sm w-full justify-center ${isBest ? "b-btn-spring" : "b-btn-soft"}`}>
                    شروع با {p.label}
                  </a>
                </div>
              );
            })}
          </div>
          <p className="text-[11.5px] text-stone text-center mt-6 leading-relaxed">
            برای اطلاع از شرایط و تعرفه هر اشتراک با ما تماس بگیرید؛ برای مدارس دولتی و خیریه شرایط ویژه دارد.
          </p>
        </div>
      </section>

      {/* همه قابلیت‌ها */}
      <section className="max-w-6xl mx-auto px-4 py-14 w-full" id="features">
        <h2 className="text-[24px] md:text-[30px] font-extrabold mb-3 text-center">همه قابلیت‌های بهار</h2>
        <p className="text-[13.5px] text-steel text-center mb-10">هر آنچه یک مدرسه مدرن لازم دارد — بدون نصب، بدون کاغذ.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f) => (
            <div key={f.title} className="b-card !rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5" />
              </span>
              <b className="text-[13.5px] block mb-1.5">{f.title}</b>
              <p className="text-[11.5px] text-steel leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* دمو و تماس */}
      <section id="demo" className="max-w-6xl mx-auto px-4 py-14 w-full">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="b-card !rounded-3xl p-6 md:p-8">
            <h2 className="text-[20px] font-extrabold mb-2">حساب دموی رایگان</h2>
            <p className="text-[13px] text-steel leading-relaxed mb-5">
              با حساب دمو، پنل مدیر مدرسه و دانش‌آموز را با داده نمونه ببینید — بدون ثبت‌نام و هزینه.
              برای حفظ سلامت داده‌ها، امکان ویرایش اطلاعات در حساب دمو غیرفعال است.
            </p>
            {settings.demoEnabled ? (
              <div className="b-card-sm !rounded-2xl p-5">
                <b className="text-[12.5px] block mb-3">ورود دمو (نام کاربری = کد ملی):</b>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="b-card-sm !rounded-xl p-3.5">
                    <span className="text-[10.5px] text-steel block">مدیر مدرسه دمو</span>
                    <b dir="ltr" className="font-mono text-[13px]">{settings.demoManagerNationalId}</b>
                    <span className="text-[10px] text-steel block mt-1">
                      رمز: <b dir="ltr" className="font-mono text-spring">{settings.demoManagerPassword}</b>
                    </span>
                  </div>
                  <div className="b-card-sm !rounded-xl p-3.5">
                    <span className="text-[10.5px] text-steel block">دانش‌آموز دمو</span>
                    <b dir="ltr" className="font-mono text-[13px]">{settings.demoStudentNationalId}</b>
                    <span className="text-[10px] text-steel block mt-1">
                      رمز: <b dir="ltr" className="font-mono text-spring">{settings.demoStudentPassword}</b>
                    </span>
                  </div>
                </div>
                <a href="/login" className="b-btn b-btn-spring b-btn-sm mt-4 w-full justify-center">ورود به صفحه ورود</a>
              </div>
            ) : (
              <p className="text-[12.5px] text-stone">حساب دمو موقتا غیرفعال است؛ فرم تماس را تکمیل کنید.</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-hairline-soft">
              <div>
                <b className="text-[12px] block">راه‌های ارتباط:</b>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[12.5px]">
                  <a href={`tel:${settings.salesPhone}`} className="text-spring font-bold hover:underline" dir="ltr">{settings.salesPhone}</a>
                  <a href={settings.salesTelegram} target="_blank" rel="noreferrer" className="text-spring font-bold hover:underline">تلگرام</a>
                  <a href={settings.salesInstagram} target="_blank" rel="noreferrer" className="text-spring font-bold hover:underline">اینستاگرام</a>
                </div>
              </div>
            </div>
          </div>

          <ContactDemo />
        </div>
      </section>

      <footer className="mt-4 py-8 border-t border-hairline-soft bg-background">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-[12px] text-steel">بهار — سامانه جامع مدیریت مدارس ایران</span>
          <div className="flex items-center gap-4 text-[12px] font-bold">
            <Link href="/" className="hover:text-spring">خانه</Link>
            <Link href="/blog" className="hover:text-spring">بلاگ</Link>
            <Link href="/login" className="hover:text-spring">ورود</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
