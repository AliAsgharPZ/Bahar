import Link from "next/link";
import {
  Globe2, Download, FileJson, CheckCircle2, AlertTriangle, BookOpen,
  ArrowRight, Upload, RefreshCw, Map as MapIcon, CalendarDays, ShieldCheck,
  IdCard, Phone, Wallet, GraduationCap, Table2, Sparkles,
} from "lucide-react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { faDigits } from "@/lib/persian";
import { SITE_CATALOG } from "@/lib/langs";
import { siteStringsFor } from "@/lib/langs/shipped";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { CALENDAR_LABELS, ALGORITHM_LABELS } from "@/lib/country/iran";
import { getActiveCountryPublic } from "@/lib/country/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "کشورهای کاستوم | کیت ساخت کشور بهار",
  description: "راهنمای کامل ساخت بسته کشور برای سامانه بهار — تقویم، کد ملی، مناطق، نقشه، ارز و پایه‌های تحصیلی کشور خودتان را اضافه کنید",
};

// ============================================================
// بهار | کیت ساخت کشور — صفحه عمومی راهنما (راند ۱۶)
// همه چیز دقیقاً مثل نسخه ایران مستند شده تا سازنده بسته
// بتواند کشور خودش را با جزئیات کامل بسازد
// ============================================================

const STEPS = [
  {
    icon: Download,
    title: "۱) دانلود قالب (نسخه ایران)",
    desc: "فایل template.json دقیقاً پروفایل ایران است — ۳۱ استان و ۴۲۹ شهرستان، تقویم شمسی، کد ملی mod-11، موبایل ۰۹…، تومان، پایه هفتم تا دوازدهم و هفته شنبه تا چهارشنبه. هر فیلد را با مقادیر کشور خود جایگزین کنید.",
  },
  {
    icon: BookOpen,
    title: "۲) مطالعه راهنمای فیلدها",
    desc: "زیر هر بخش از این صفحه، فیلدها با نوع، محدوده و مثال ایران مستند شده‌اند. فیلد جا‌مانده = رد شدن بسته در اعتبارسنجی (خطای دقیق فارسی می‌گیرید).",
  },
  {
    icon: MapIcon,
    title: "۳) آماده‌سازی مناطق و نقشه",
    desc: "استان‌ها/ایالت‌ها + شهرستان‌ها را در regions بریزید. اگر نقشه SVG هم می‌خواهید، از GeoJSON رسمی کشورتان با ساده‌سازی Douglas-Peucker مسیر بسازید (دستور دقیق پایین صفحه). نقشه اختیاری است — بدون آن فقط دراپ‌داون نمایش داده می‌شود.",
  },
  {
    icon: Upload,
    title: "۴) بارگذاری و اعتبارسنجی",
    desc: "مدیر کل در تنظیمات → تب «کشور» فایل را بارگذاری می‌کند. اعتبارسنجی خشک (؟validate=1) ساختار، تقویم، regexها، مناطق و نقشه را می‌سنجد و آمار می‌دهد — خطاها فارسی و دقیق‌اند.",
  },
  {
    icon: RefreshCw,
    title: "۵) فعال‌سازی",
    desc: "با «فعال‌سازی»، تقویم کل سامانه (نمایش تاریخ‌ها + کلیدهای حضور و غیاب)، اعتبارسنجی کد ملی/موبایل در ورود و ثبت‌نام، دراپ‌داون‌های استان و پایه، واحد پول و هفته کاری همه به کشور جدید می‌روند. بازگشت به ایران همیشه با یک کلیک هست.",
  },
];

const FIELD_DOCS: Array<{
  icon: typeof Globe2;
  title: string;
  fields: Array<{ name: string; type: string; iran: string; rule: string }>;
}> = [
  {
    icon: Globe2,
    title: "هویت کشور",
    fields: [
      { name: "code", type: "string — ۲ تا ۴ حرف بزرگ لاتین", iran: '"IR"', rule: "یکتا در کل سامانه؛ برای کشورهای تركی: TR، امارات: AE، عراق: IQ…" },
      { name: "name", type: "string ≤ ۶۰", iran: '"ایران"', rule: "نام کشور به فارسی — نمایش مدیریتی در پنل" },
      { name: "nativeName", type: "string ≤ ۶۰", iran: '"Iran"', rule: "نام بومی کشور (Türkiye، UAE…)" },
      { name: "locale", type: "string قالب xx-XX", iran: '"fa-IR"', rule: "locale نمایش تاریخ و اعداد — مثل tr-TR یا ar-SA؛ باید Intl آن معتبر باشد" },
      { name: "direction", type: '"rtl" | "ltr"', iran: '"rtl"', rule: "جهت رابط کاربری کل سامانه" },
      { name: "timezone", type: "string IANA", iran: '"Asia/Tehran"', rule: "منطقه زمانی رسمی — مثل Europe/Istanbul یا Asia/Dubai؛ همه محاسبات زمانی/زمان‌بند با آن" },
      { name: "digits", type: '"native" | "latin"', iran: '"native"', rule: "native = ارقام بومی (فارسی/عربی)؛ latin = ارقام لاتین" },
      { name: "calendar", type: "enum تقویم", iran: '"persian"', rule: `یکی از: ${Object.keys(CALENDAR_LABELS).join("، ")} — تقویم نمایش تاریخ‌ها و کلید روزانه حضور و غیاب` },
    ],
  },
  {
    icon: IdCard,
    title: "شناسه ملی (nationalId)",
    fields: [
      { name: "label", type: "string", iran: '"کد ملی"', rule: "برچسب فیلد در ورود/ثبت‌نام — مثلاً «شماره TC» یا «شناسه ملی»" },
      { name: "algorithm", type: "enum", iran: '"iran-mod11"', rule: `یکی از: ${Object.keys(ALGORITHM_LABELS).join("، ")}` },
      { name: "pattern", type: "regex source ≤ ۲۰۰ نویسه", iran: '"^\\\\d{10}$"', rule: "الگوی کلی شناسه — مثل TC ترکیه: \"^[1-9][0-9]{10}$\"" },
      { name: "placeholder", type: "string", iran: '"۰۰۱۲۳۴۵۶۷۸"', rule: "نمونه خام داخل فیلد ورود" },
      { name: "example", type: "string", iran: '"۰۰۱۲۳۴۵۶۷۸"', rule: "یک شناسه معتبر واقعی — اعتبارسنجی با الگوریتمش چک می‌شود!" },
      { name: "invalidMessage", type: "string? ≤ ۲۰۰", iran: "حذف", rule: "پیام خطای اختصاصی (اختیاری — پیش‌فرض فارسی ساخته می‌شود)" },
    ],
  },
  {
    icon: Phone,
    title: "موبایل (phone)",
    fields: [
      { name: "pattern", type: "regex source", iran: '"^09\\\\d{9}$"', rule: "موبایل کشور — ترکیه: \"^\\\\+?9\\\\d{10}$\" یا ساده: \"^5\\\\d{9}$\"" },
      { name: "placeholder", type: "string", iran: '"۰۹۱۲۳۴۵۶۷۸۹"', rule: "راهنمای داخل فیلد" },
      { name: "example", type: "string", iran: '"09123456789"', rule: "نمونه معتبر — اعتبارسنجی با pattern چک می‌شود (عدم تطابق = هشدار)" },
    ],
  },
  {
    icon: Wallet,
    title: "واحد پول (currency)",
    fields: [
      { name: "label", type: "string", iran: '"تومان"', rule: "واحد نمایشی — لیر/درهم/دینار… در همه صفحات مالی" },
      { name: "code", type: "۳ حرف بزرگ ISO", iran: '"IRR"', rule: "TRY / AED / IQD…" },
      { name: "minAmount", type: "number ≥ 0", iran: "1000", rule: "کف مبلغ قسط شهریه" },
      { name: "maxAmount", type: "number ≤ 10¹²", iran: "5000000000", rule: "سقف مبلغ قسط شهریه" },
    ],
  },
  {
    icon: CalendarDays,
    title: "هفته کاری (week)",
    fields: [
      { name: "workDays", type: "number[] — ۱ تا ۷", iran: "[1,2,3,4,5]", rule: "روزهای مدرسه: ۱=شنبه … ۷=جمعه. ترکیه/امارات معمولاً [2,3,4,5,6] (یکشنبه تا پنجشنبه)" },
      { name: "labels", type: "string[8] — [0]=\"\"", iran: '["", "شنبه", …, "جمعه"]', rule: "برچسب ۷ روز — اندیس ۱ تا ۷؛ ستون‌های برنامه هفتگی و انتخابگر تاریخ" },
    ],
  },
  {
    icon: GraduationCap,
    title: "ساختار آموزشی",
    fields: [
      { name: "gradeLevels", type: "string[] ۱ تا ۱۰۰ مورد", iran: '["هفتم", …, "دوازدهم"]', rule: "پایه‌های dropdown کلاس — ترکیه: [\"9. Sınıf\", \"10. Sınıf\", …] یا فارسیِ محلی" },
      { name: "fields", type: "string[]", iran: '["عمومی", "ریاضی", "تجربی", "انسانی", "فنی"]', rule: "رشته‌های تحصیلی" },
      { name: "schoolTypes", type: "string[]", iran: '["دولتی", "غیرانتفاعی", …]', rule: "انواع مدرسه در فرم مدرسه" },
      { name: "academicYearExample", type: "string ≤ ۲۰", iran: '"1404-1405"', rule: "نمونه سال تحصیلی — برای میلادی: \"2025-2026\"" },
      { name: "grading.maxScore", type: "number ۵ تا ۲۰۰", iran: "20", rule: "نمره کامل — ۱۰۰ برای اغلب کشورها" },
      { name: "grading.terms", type: "number ۱ تا ۴", iran: "2", rule: "تعداد نیمسال" },
      { name: "grading.termLabels", type: "string[] طول terms+1", iran: '["", "نیمسال اول", "نیمسال دوم"]', rule: "برچسب نیمسال‌ها" },
    ],
  },
  {
    icon: MapIcon,
    title: "مناطق و نقشه",
    fields: [
      { name: "regions[].name", type: "string ≤ ۶۰ یکتا", iran: '"تهران"', rule: "استان/ایالت — مقدار ذخیره‌شده در DB مدرسه‌ها" },
      { name: "regions[].center", type: "string", iran: '"تهران"', rule: "مرکز استان (راهنمای فرم)" },
      { name: "regions[].counties[]", type: "string[] ≤ ۱۵۰", iran: '["تهران", "کرج", …]', rule: "شهرستان‌های هر استان — با نام استان اعتبارسنجی می‌شود" },
      { name: "map (اختیاری)", type: "object", iran: "داخلی — در قالب هست", rule: "viewBox + مسیر SVG هر استان؛ بدون آن فقط دراپ‌داون. ساخت: پایین صفحه" },
      { name: "modules.shad", type: "boolean", iran: "true", rule: "شبکه شاد فقط ایران — برای هر کشور دیگری false بگذارید (منوی شاد مخفی می‌شود)" },
    ],
  },
];

export default async function CountriesPage() {
  const [packs, active] = await Promise.all([
    db.countryPack.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: { code: true, name: true, nativeName: true, status: true, version: true },
    }).catch(() => []),
    getActiveCountryPublic().catch(() => null),
  ]);
  // شاد فقط بسته ایران — در ریجن‌های فعال دیگر هیچ نامی از آن نیست
  const shadEnabled = active?.modules.shad ?? true;
  // عنوان گام‌های کیت به زبان سایت بازدیدکننده (شرح گام‌ها مستندات فارسی می‌مانند)
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const S = siteStringsFor(siteLang).siteStrings;
  const st = (k: string): string => S[k] ?? SITE_CATALOG[k] ?? k;

  return (
    <div className="min-h-screen bg-background">
      {/* هدر */}
      <header className="border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-[15px] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-spring text-primary-foreground flex items-center justify-center text-[13px]">ب</span>
            بهار
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/languages" className="t-sm font-bold text-steel hover:text-spring flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" /> کیت زبان
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        {/* قهرمان */}
        <section className="text-center max-w-3xl mx-auto mb-14">
          <span className="b-badge b-badge-success mb-4 inline-flex">
            <Globe2 className="w-3.5 h-3.5" /> دیفالت: ایران — قابل تعویض
          </span>
          <h1 className="text-2xl md:text-4xl font-black leading-[1.4] mb-4">
            کیت ساخت <span className="text-spring">کشور</span> بهار
          </h1>
          <p className="t-md text-steel leading-[2]">
            همه ویژگی‌های وابسته به ملیت — تقویم، شناسه ملی، موبایل، استان‌ها و شهرستان‌ها، نقشه،
            واحد پول، پایه‌های تحصیلی و هفته کاری — در یک فایل JSON.
            کشور پیش‌فرض <b>ایران</b> است؛ با بارگذاری بسته کشور، کل سامانه با جزئیات کشور شما کار می‌کند.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <a href="/countries/template.json" download className="b-btn b-btn-spring">
              <Download className="w-4 h-4" /> دانلود قالب — دقیقاً نسخه ایران
            </a>
            <a href="#guide" className="b-btn b-btn-soft">
              <BookOpen className="w-4 h-4" /> راهنمای کامل فیلدها
            </a>
          </div>
          <p className="t-cap text-stone mt-4">
            فعال فعلی سامانه: <b className="text-spring">{active?.name ?? "ایران"}</b>
            {active && active.code !== "IR" ? ` (${active.nativeName} — تقویم ${CALENDAR_LABELS[active.calendar] ?? active.calendar})` : " — تقویم شمسی، کد ملی mod-11، تومان"}
          </p>
        </section>

        {/* بسته‌های موجود */}
        <section className="mb-14">
          <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2"><FileJson className="w-5 h-5 text-spring" /> بسته‌های کشور</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="b-card !rounded-2xl p-4 text-center">
              <Globe2 className="w-6 h-6 text-spring mx-auto mb-2" />
              <b className="block text-[13px]">ایران</b>
              <span className="t-cap text-stone">پیش‌فرض داخلی</span>
              <span className="b-badge b-badge-success mt-2 inline-flex">{active?.code === "IR" || !active ? "فعال" : "آماده"}</span>
            </div>
            {packs.map((p) => (
              <div key={p.code} className="b-card !rounded-2xl p-4 text-center">
                <Globe2 className="w-6 h-6 text-steel mx-auto mb-2" />
                <b className="block text-[13px]">{p.name}</b>
                <span className="t-cap text-stone">{p.nativeName}</span>
                <span className={`b-badge mt-2 inline-flex ${p.status === "ACTIVE" ? "b-badge-success" : "b-badge-neutral"}`}>
                  {p.status === "ACTIVE" ? "فعال" : p.status === "DISABLED" ? "غیرفعال" : "پیش‌نویس"}
                </span>
              </div>
            ))}
            {packs.length === 0 && (
              <div className="b-card !rounded-2xl p-4 text-center col-span-2 md:col-span-3 border-dashed">
                <p className="t-sm text-steel">هنوز بسته کشور کاستومی بارگذاری نشده — اولین نفر باشید!</p>
              </div>
            )}
          </div>
        </section>

        {/* مراحل */}
        <section id="guide" className="mb-14 scroll-mt-24">
          <h2 className="font-bold text-[16px] mb-5 flex items-center gap-2"><Sparkles className="w-5 h-5 text-spring" /> پنج قدم تا کشور شما</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="b-card !rounded-2xl p-5">
                <s.icon className="w-6 h-6 text-spring mb-3" />
                <b className="block text-[13.5px] mb-2">{st(`site.kit.countries.s${i + 1}`)}</b>
                <p className="t-sm text-steel leading-[1.9]">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* مستند فیلدها */}
        <section className="mb-14">
          <h2 className="font-bold text-[16px] mb-2 flex items-center gap-2">
            <Table2 className="w-5 h-5 text-spring" /> مرجع کامل فیلدها — با مقدار ایران
          </h2>
          <p className="t-sm text-steel mb-5 leading-[1.9]">
            هر جدول زیر یک بخش از فایل JSON است. ستون «مقدار ایران» همان چیزی است که در قالب می‌بینید —
            الگوبرداری کنید و ستون «قاعده» را برای کشور خود رعایت کنید.
          </p>
          <div className="flex flex-col gap-4">
            {FIELD_DOCS.map((doc) => (
              <div key={doc.title} className="b-card !rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b border-hairline-soft bg-cloud/30">
                  <doc.icon className="w-5 h-5 text-spring" />
                  <b className="text-[13.5px]">{doc.title}</b>
                </div>
                <div className="overflow-x-auto b-scroll">
                  <table className="w-full text-[12px] min-w-[680px]">
                    <thead>
                      <tr className="border-b border-hairline-soft text-steel text-[11px]">
                        <th className="text-right py-2.5 px-4 font-bold w-[26%]">فیلد</th>
                        <th className="text-right py-2.5 px-4 font-bold w-[22%]">نوع</th>
                        <th className="text-right py-2.5 px-4 font-bold w-[20%]">مقدار ایران</th>
                        <th className="text-right py-2.5 px-4 font-bold">قاعده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.fields
                        .filter((f) => shadEnabled || f.name !== "modules.shad")
                        .map((f) => (
                        <tr key={f.name} className="border-b border-hairline-soft/50 last:border-0">
                          <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-spring-deep" dir="ltr">{f.name}</td>
                          <td className="py-2.5 px-4 text-steel">{f.type}</td>
                          <td className="py-2.5 px-4 font-mono text-[10.5px] text-ink" dir="ltr">{f.iran}</td>
                          <td className="py-2.5 px-4 text-steel leading-relaxed">{f.rule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* تقویم‌ها */}
        <section className="mb-14">
          <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-spring" /> تقویم‌های پشتیبانی‌شده</h2>
          <div className="b-card !rounded-2xl p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(CALENDAR_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[12.5px]">
                  <code className="font-mono text-[11px] text-spring-deep bg-spring-tint rounded px-1.5 py-0.5" dir="ltr">{k}</code>
                  <span className="text-steel">{v}</span>
                  {k === "persian" && <span className="b-badge b-badge-success !text-[9.5px]">ایران</span>}
                </div>
              ))}
            </div>
            <p className="t-sm text-steel leading-[1.9] mt-4">
              <b>مهم:</b> کلیدهای تاریخ حضور و غیاب با تقویم فعال ذخیره می‌شوند (ایران: «1404-07-10» شمسی؛ میلادی: «2025-10-08»).
              بسته کشوری را <b>قبل از شروع سال تحصیلی</b> فعال کنید تا کلیدها از همان ابتدا یکدست باشند.
              تبدیل خودکار داده‌های تقویمیِ موجود انجام نمی‌شود (مستندسازی صریح این محدودیت).
            </p>
          </div>
        </section>

        {/* الگوریتم‌های شناسه */}
        <section className="mb-14">
          <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-spring" /> الگوریتم‌های اعتبارسنجی شناسه ملی</h2>
          <div className="b-card !rounded-2xl p-5 flex flex-col gap-3">
            {Object.entries(ALGORITHM_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2.5 text-[12.5px]">
                <code className="font-mono text-[11px] text-spring-deep bg-spring-tint rounded px-1.5 py-0.5 shrink-0" dir="ltr">{k}</code>
                <div className="text-steel leading-relaxed">
                  <b className="text-ink">{v}</b>
                  {k === "iran-mod11" && " — رقم کنترل: مجموع ارقام × وزن نزولی ۱۰ تا ۲، باقیمانده بر ۱۱ (رمز رسمی کد ملی ایران)."}
                  {k === "luhn" && " — برای کشورهایی که شناسه/کارت با Luhn کنترل می‌شود."
                  }
                  {k === "digits" && " — فقط تطابق الگو؛ مثلاً TC ترکیه: pattern \"^[1-9][0-9]{10}$\"."
                  }
                  {k === "none" && " — هر رشته ۴ تا ۳۲ نویسه؛ برای کشورهای بدون شناسه استاندارد."}
                </div>
              </div>
            ))}
            <div className="t-sm text-steel leading-[1.9] border-t border-hairline-soft pt-3">
              <AlertTriangle className="w-4 h-4 inline text-warning-deep" /> فیلد <code className="font-mono text-[11px]" dir="ltr">example</code> باید واقعاً از الگوریتم رد شود —
              اعتبارسنجی بسته آن را می‌سنجد (کد ملی جعلی = رد بسته).
            </div>
          </div>
        </section>

        {/* ساخت نقشه */}
        <section className="mb-14">
          <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2"><MapIcon className="w-5 h-5 text-spring" /> ساخت نقشه SVG کشور (اختیاری)</h2>
          <div className="b-card !rounded-2xl p-5">
            <p className="t-sm text-steel leading-[2] mb-3">
              نقشه ایرانِ بهار از <b>GADM 4.1</b> با ساده‌سازی <b>Douglas-Peucker</b> ساخته شده — همین خط تولید را برای کشور خود اجرا کنید:
            </p>
            <ol className="t-sm text-steel leading-[2.2] list-decimal ps-6 mb-3">
              <li>GeoJSON مرز استان‌های کشورتان را از GADM / Natural Earth / OSM دانلود کنید (سطح ADM1).</li>
              <li>با <code className="font-mono text-[11px]" dir="ltr">mapshaper.org</code> یا اسکریپت ساده‌سازی، هر استان را به مسیر SVG سبک (زیر ۳۰KB) تبدیل کنید.</li>
              <li>برای هر استان: <code className="font-mono text-[11px]" dir="ltr">{"{ name, d, cx, cy }"}</code> — d مسیر SVG (شروع با M)، cx/cy مرکز برای برچسب hover.</li>
              <li><code className="font-mono text-[11px]" dir="ltr">viewBox</code> را بر اساس bounds کلی تنظیم کنید (مثل ایران: ۷۶۰×۶۸۸).</li>
              <li>بخش <code className="font-mono text-[11px]" dir="ltr">map</code> را به JSON اضافه کنید — اگر name هر استان با regions نام‌های یکی باشد، دکمه نقشه همان استان را انتخاب می‌کند.</li>
            </ol>
            <div className="t-cap text-stone leading-relaxed bg-cloud/40 rounded-xl p-3">
              نقشه در قالب ایران داخل فایل هست (مرجع) — ببینید، الگو بگیرید. بدون نقشه هم همه‌چیز کار می‌کند؛ فقط انتخاب منطقه با دراپ‌داون است.
            </div>
          </div>
        </section>

        {/* نکات */}
        <section className="mb-6">
          <h2 className="font-bold text-[16px] mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-spring" /> قواعد و نکات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[
              { ok: true, text: "حجم بسته حداکثر ۶۰۰KB (نقشه سنگین = هشدار؛ ساده‌سازی بیشتر کنید)" },
              { ok: true, text: "کد کشور ۲ تا ۴ حرف بزرگ — یکتا؛ بارگذاری دوباره همان کد = به‌روزرسانی بسته" },
              { ok: true, text: "شاد (شبکه ملی ایران) فقط برای IR — بقیه false" },
              { ok: true, text: "دیتای موجود (مدرسه‌ها، دانش‌آموزان) دست‌نخورده می‌ماند — فقط قواعد جدید اعمال می‌شود" },
              { ok: false, text: "تغییر تقویم بعد از ثبت داده — کلیدهای حضور قدیمی به تقویم قبلی‌اند؛ سال تحصیلی تازه شروع کنید" },
              { ok: false, text: "regexهای سنگین/تودرتو — بیش از ۲۰۰ نویسه رد می‌شوند (ReDoS)" },
              { ok: false, text: "نقشه با name ناهماهنگ با regions — استان قابل کلیک نیست (هشدار اعتبارسنجی)" },
            ]
              .filter((r) => shadEnabled || !r.text.includes("شاد"))
              .map((r, i) => (
              <div key={i} className="b-card-sm !rounded-xl p-3.5 flex items-start gap-2.5">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-spring shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-warning-deep shrink-0 mt-0.5" />}
                <span className="t-sm text-steel leading-relaxed">{r.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA پایانی */}
        <section className="b-card !rounded-3xl p-8 text-center bg-spring-tint/30">
          <h3 className="font-black text-[18px] mb-2">کشورتان را به بهار بیاورید 🌍</h3>
          <p className="t-sm text-steel leading-[1.9] max-w-xl mx-auto mb-5">
            قالب را دانلود کنید، فیلدها را با مقادیر کشور خود پر کنید و در تنظیمات → تب «کشور» بارگذاری کنید.
            اعتبارسنجی دقیق فارسی راهنمایان است. بازگشت به ایران همیشه یک کلیک فاصله دارد.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="/countries/template.json" download className="b-btn b-btn-spring">
              <Download className="w-4 h-4" /> دانلود قالب ایران (۵۳KB)
            </a>
            <Link href="/languages" className="b-btn b-btn-soft">
              <BookOpen className="w-4 h-4" /> زبان رابط کاربری هم می‌سازید؟ کیت زبان
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline-soft py-8 text-center">
        <p className="t-cap text-stone">بهار — سامانه جامع مدیریت مدارس · کیت کشور نسخه {faDigits(1)}</p>
      </footer>
    </div>
  );
}
