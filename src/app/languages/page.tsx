import Link from "next/link";
import Image from "next/image";
import {
  Languages, Download, FileJson, CheckCircle2, AlertTriangle, BookOpen,
  ArrowRight, Upload, RefreshCw, LayoutTemplate, ShieldCheck, Sparkles,
} from "lucide-react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CATALOG, SITE_CATALOG, LONG_CATALOG } from "@/lib/langs";
import { siteStringsFor, longStringsFor, SHIPPED_LANG_PACKS } from "@/lib/langs/shipped";
import { SiteLangSelect } from "@/components/shared/site-lang-select";
import { faDigits } from "@/lib/persian";
import { getActiveCountryPublic } from "@/lib/country/server";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const dynamic = "force-dynamic";

/** متادیتا به زبان سایت بازدیدکننده (کوکی bahar_site_lang) */
export async function generateMetadata() {
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const S = siteStringsFor(siteLang).siteStrings;
  return {
    title: S["site.meta.languages.title"] ?? SITE_CATALOG["site.meta.languages.title"],
    description: S["site.meta.languages.desc"] ?? SITE_CATALOG["site.meta.languages.desc"],
  };
}

const STEPS = [
  {
    icon: Download,
    title: "۱) دانلود تمپلیت",
    desc: "فایل تمپلیت رسمی بهار را دانلود کنید — شامل همه کلیدهای قابل‌ترجمه با ساختار استاندارد JSON و راهنمای داخل فایل.",
  },
  {
    icon: BookOpen,
    title: "۲) ترجمه کلیدها",
    desc: "متن فارسی هر کلید را به زبان مقصد ترجمه کنید. کلیدهایی که ترجمه نمی‌شوند حذف شوند — آن موارد به‌صورت خودکار به فارسی برمی‌گردند و هیچ چیزی خراب نمی‌شود.",
  },
  {
    icon: FileJson,
    title: "۳) تکمیل مشخصات",
    desc: "کد یکتای زبان (مثل en یا kurdish-sorani)، نام فارسی، نام بومی و جهت متن (rtl/ltr) را در فیلدهای بالای فایل بنویسید.",
  },
  {
    icon: Upload,
    title: "۴) بارگذاری در پنل",
    desc: "مدیر کل در تنظیمات → «زبان‌ها و ترجمه» فایل را بارگذاری می‌کند؛ سامانه اعتبارسنجی می‌کند، درصد پوشش را می‌سنجد و بسته را فعال می‌کند.",
  },
  {
    icon: RefreshCw,
    title: "۵) فعال‌سازی برای همه",
    desc: "به‌محض فعال شدن، زبان جدید در انتخاب‌گر زبان همه کاربران (وب، اندروید، ویندوز) ظاهر می‌شود و جهت رابط کاربری خودکار تنظیم می‌شود.",
  },
];

const RULES = [
  { ok: true, k: "site.kit.languages.rule1", text: "کد زبان: ۲ تا ۱۵ نویسه لاتین/عدد/خط تیره — یکتا در کل سامانه (مثال: en، tr، ar، kurdish-sorani، gilaki)" },
  { ok: true, k: "site.kit.languages.rule2", text: "جهت متن: rtl برای راست‌به‌چپ (فارسی، عربی، کردی، اردو…) یا ltr برای چپ‌به‌راست (انگلیسی، ترکی استانبولی…)" },
  { ok: true, k: "site.kit.languages.rule3", text: "هر متن اپ/سایت حداکثر ۳۰۰ نویسه — متن ساده بدون HTML و اسکریپت (متن‌های بلند FAQ و کیت سقف ندارند)" },
  { ok: true, k: "site.kit.languages.rule4", text: "ترجمه ناقص مجاز است — کلید خالی/حذف‌شده = نمایش فارسی پایه" },
  { ok: false, k: "site.kit.languages.rule5", text: "کلیدها را تغییر نام ندهید یا جدید نسازید — کلید ناشناخته نادیده گرفته می‌شود" },
  { ok: false, k: "site.kit.languages.rule6", text: "کد HTML، جاوااسکریپت یا آدرس در متن‌ها مجاز نیست — اعتبارسنجی رد می‌کند" },
  { ok: false, k: "site.kit.languages.rule7", text: "حجم فایل بیش از ۴۰۰KB نباشد" },
];

/** صفحه کیت ساخت زبان — گایدلاین عمومی + دانلود تمپلیت */
export default async function LanguagesPage() {
  const activePacks = await db.languagePack.findMany({
    where: { status: "ACTIVE" },
    select: { code: true, name: true, nativeName: true, direction: true, keyCount: true, coverage: true },
    orderBy: { updatedAt: "desc" },
  }).catch(() => []);

  // شاد فقط بسته ایران — کلیدهای دارای شاد برای ریجن‌های دیگر مخفی‌اند
  const shadEnabled = ((await getActiveCountryPublic().catch(() => null))?.modules.shad) ?? true;
  const catalogKeys = Object.entries(CATALOG).filter(
    ([k, v]) => shadEnabled || !/شاد|shad/i.test(`${k} ${v}`)
  );
  // گام‌ها، قواعد، متن‌های بلند و کاتالوگ کیت به زبان سایت بازدیدکننده (fallback فارسی)
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const S = siteStringsFor(siteLang).siteStrings;
  const st = (k: string): string => S[k] ?? SITE_CATALOG[k] ?? k;
  const L = longStringsFor(siteLang).longStrings;
  const tx = (k: string, fb: string): string => L[k] ?? S[k] ?? fb;
  const siteKeys = Object.entries(SITE_CATALOG).filter(([k, v]) => shadEnabled || !/شاد|shad/i.test(`${k} ${v}`));
  const longKeys = Object.entries(LONG_CATALOG).filter(([k, v]) => shadEnabled || !/شاد|shad/i.test(`${k} ${v}`));

  return (
    <div dir="rtl" className="min-h-screen bg-background flex flex-col text-foreground">
      <header className="sticky top-0 z-30 bg-background border-b border-hairline-soft">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="بهار" width={30} height={30} />
            <b className="text-[16px]">بهار</b>
          </Link>
          <span className="text-[12px] text-steel hidden sm:inline">{tx("site.kit.languages.kitLabel", "کیت ساخت زبان")}</span>
          <div className="flex-1" />
          <SiteLangSelect current={siteLang} />
          <Link href="/login" className="b-btn b-btn-soft b-btn-sm">{tx("site.kit.languages.login", "ورود")}</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 md:py-14">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-spring/40 bg-forest/10 text-spring px-4 py-1.5 text-xs font-medium mb-5">
            <Languages className="w-3.5 h-3.5" />
            Bahar Language Kit — {tx("site.kit.languages.kitLabel", "کیت ساخت زبان بهار")}
          </span>
          <h1 className="t-hero mb-4">
            {tx("site.kit.languages.heroA", "سامانه بهار را به")} <span className="text-spring">{tx("site.kit.languages.heroB", "زبان خودتان")}</span> {tx("site.kit.languages.heroC", "بیاورید")}
          </h1>
          <p className="text-steel leading-8">{tx("long.kit.languages.hero", "رابط کاربری بهار به‌صورت پیش‌فرض فارسی است — اما با «بسته زبان» می‌توانید کل پنل را به هر زبانی ترجمه کنید: انگلیسی، عربی، ترکی، کردی، گیلکی، بلوچی یا زبان محلی مدرسه شما. ساختار JSON ساده است، ترجمه ناقص هم مجاز است و کلیدهای ترجمه‌نشده به فارسی برمی‌گردند. برای شروع سریع، بسته آماده انگلیسی (۲۰۰ کلید اپ؛ جملات سایت و متن‌های بلند در دست تکمیل) را دانلود کنید و به‌عنوان الگو استفاده کنید.")}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <a href="/langs/template.json" download className="b-btn b-btn-spring">
              <Download className="w-4 h-4" /> {tx("site.kit.languages.btn.template", "دانلود تمپلیت زبان")}
            </a>
            <a href="/langs/english.json" download className="b-btn b-btn-soft">
              <Download className="w-4 h-4" /> {tx("site.kit.languages.btn.english", "بسته آماده انگلیسی")}
            </a>
            <a href="#guide" className="b-btn b-btn-soft">{tx("site.kit.languages.btn.guide", "راهنمای گام‌به‌گام")}</a>
            <a href="#catalog" className="b-btn b-btn-ghost">{tx("site.kit.languages.btn.catalog", "فهرست کامل کلیدها")}</a>
          </div>
        </section>

        {/* زبان‌های فعال */}
        <section className="mb-14">
          <h2 className="t-h2 mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-spring" /> {tx("site.kit.languages.h.active", "زبان‌های موجود در این سرویس")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="b-card !rounded-2xl p-4 text-center">
              <div className="text-2xl mb-1">فارسی</div>
              <div className="text-[12px] text-steel">{tx("site.kit.languages.baseLang", "زبان پایه · ۱۰۰٪ پوشش")}</div>
            </div>
            {activePacks.map((p) => (
              <div key={p.code} className="b-card !rounded-2xl p-4 text-center">
                <div className="text-lg font-bold truncate">{p.nativeName}</div>
                <div className="text-[12px] text-steel mb-1">{p.name} · {p.direction === "ltr" ? tx("site.kit.languages.dirLtr", "چپ‌به‌راست") : tx("site.kit.languages.dirRtl", "راست‌به‌چپ")}</div>
                <span className="b-badge b-badge-spring">
                  {faDigits(p.coverage)}٪ {tx("site.kit.languages.wCoverage", "پوشش")}
                </span>
              </div>
            ))}
            {activePacks.length === 0 && (
              <div className="b-card !rounded-2xl p-4 text-center col-span-2 md:col-span-3 border-dashed">
                <div className="text-sm text-steel leading-7">
                  {tx("site.kit.languages.noCustom", "هنوز بسته زبان کاستومی فعال نیست — اولین نفر باشید! تمپلیت را دانلود کنید، ترجمه کنید و به مدیر سامانه بدهید.")}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* بسته‌های همراه سامانه — قبلاً این فهرست اصلاً رندر نمی‌شد و بازدیدکننده
            فقط فارسی + جای خالی کاستوم را می‌دید (باگ دیده‌شدن، راند ۳). پوشش
            صادقانهٔ هر بسته: کلیدهای اپ + جملات سایت، جداگانه. */}
        <section className="mb-14">
          <h2 className="t-h2 mb-4 flex items-center gap-2"><Languages className="w-5 h-5 text-spring" /> {tx("site.kit.shippedHeading", "بسته‌های همراه سامانه")}</h2>
          <p className="text-steel text-sm mb-4 leading-7">
            {tx("site.kit.languages.shippedIntro", "این بسته‌ها با خود سامانه می‌آیند و نیاز به بارگذاری ندارند.")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SHIPPED_LANG_PACKS.map((p) => (
              <div key={p.code} className="b-card !rounded-2xl p-4 text-center">
                <div className="text-lg font-bold truncate">{p.nativeName}</div>
                <div className="text-[12px] text-steel mb-1">{p.name} · {p.direction === "ltr" ? tx("site.kit.languages.dirLtr", "چپ‌به‌راست") : tx("site.kit.languages.dirRtl", "راست‌به‌چپ")}</div>
                <span className="b-badge b-badge-spring">
                  {tx("site.kit.languages.wApp", "اپ")} {faDigits(p.coverage)}٪ · {tx("site.kit.languages.wSite", "سایت")} {faDigits(p.siteCoverage)}٪ · {tx("site.kit.languages.wLong", "بلند")} {faDigits(p.longCoverage)}٪
                </span>
                <div className="text-[12px] text-stone mt-1">{tx("site.kit.shippedBadge", "همراه سامانه")}</div>
              </div>
            ))}
          </div>
        </section>

        {/* راهنمای گام‌به‌گام */}
        <section id="guide" className="mb-14 scroll-mt-24">
          <h2 className="t-h2 mb-6 flex items-center gap-2"><BookOpen className="w-5 h-5 text-spring" /> {tx("site.kit.languages.h.guide", "راهنمای ساخت بسته زبان")}</h2>
          <div className="grid md:grid-cols-5 gap-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="b-card !rounded-2xl p-5">
                <s.icon className="w-6 h-6 text-spring mb-3" />
                <h3 className="font-bold text-sm mb-2">{st(`site.kit.languages.s${i + 1}`)}</h3>
                <p className="text-xs text-steel leading-6">{tx(`long.kit.languages.step${i + 1}`, s.desc)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ساختار فایل */}
        <section className="mb-14 grid lg:grid-cols-2 gap-4">
          <div className="b-card !rounded-3xl p-6">
            <h3 className="t-h3 mb-3 flex items-center gap-2"><LayoutTemplate className="w-5 h-5 text-spring" /> {tx("site.kit.languages.h.structure", "ساختار فایل بسته")}</h3>
            <pre dir="ltr" className="text-[12px] leading-5 bg-forest/5 dark:bg-forest/10 rounded-2xl p-4 overflow-x-auto text-start" style={{fontFamily: "monospace"}}>
{`{
  "code": "en",              // کد یکتا (۲-۱۵ نویسه)
  "name": "انگلیسی",          // نام فارسی
  "nativeName": "English",   // نام بومی
  "direction": "ltr",        // rtl یا ltr
  "author": "نام شما",
  "version": "1.0.0",
  "notes": "توضیح اختیاری",
  "strings": {
    "shell.dashboard": "Dashboard",
    "nav.students": "Students",
    "nav.grades": "Grades",
    "common.save": "Save",
    "common.cancel": "Cancel"
  },
  "siteStrings": {
    "site.hero.title": "Let your school bloom like spring",
    "site.faq.q1": "How do I sign in?"
  },
  "longStrings": {
    "long.faq.a1": "Your username is your national ID; the system generates a random password for you.",
    "long.kit.languages.cta": "Download the template, translate it, and ask your system admin to activate it."
  }
}`}
            </pre>
          </div>
          <div className="b-card !rounded-3xl p-6">
            <h3 className="t-h3 mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-spring" /> {tx("site.kit.languages.h.rules", "قواعد و محدودیت‌ها")}</h3>
            <ul className="space-y-2.5">
              {RULES.map((r) => (
                <li key={r.text} className="flex items-start gap-2 text-sm leading-7">
                  {r.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-spring shrink-0 mt-1.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-1.5" />
                  )}
                  <span className="text-steel">{tx(r.k, r.text)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-2xl bg-forest/5 dark:bg-forest/10 p-4 text-xs text-steel leading-6">{tx("long.kit.languages.structureNote", "بسته‌ها قبل از ذخیره اعتبارسنجی می‌شوند (نوع فیلدها، طول متن‌ها، نبودِ کد اجرایی) و فقط مدیر کل سامانه می‌تواند آن‌ها را بارگذاری و فعال کند. نمایش متن‌ها همیشه با فرار امن HTML انجام می‌شود.")}</div>
          </div>
        </section>

        {/* کاتالوگ کلیدها */}
        <section id="catalog" className="mb-14 scroll-mt-24">
          <h2 className="t-h2 mb-2 flex items-center gap-2"><FileJson className="w-5 h-5 text-spring" /> {tx("site.kit.languages.h.catalog", "فهرست کامل کلیدهای قابل‌ترجمه")}</h2>
          <p className="text-steel text-sm mb-5 leading-7">
            {tx("site.kit.languages.catalogIntro1", "{n} کلید در {m} دامنه {domains}.").replace("{n}", faDigits(catalogKeys.length)).replace("{m}", faDigits(new Set(catalogKeys.map(([k]) => k.split(".")[0])).size)).replace("{domains}", tx("site.kit.languages.catalogIntroDomains", "(پوسته، ناوبری، عملیات عمومی، ورود، داشبورد، زبان‌ها، تنظیمات)"))}
            {tx("site.kit.languages.catalogIntro2", "همین فهرست داخل تمپلیت دانلودی هم با متن فارسی پایه موجود است.")}
          </p>
          <h3 className="t-h3 mb-3">{tx("site.kit.languages.catApp", "کلیدهای اپ")}</h3>
          <div className="b-card !rounded-3xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-forest/10 dark:bg-forest/20 text-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium w-[220px]">{tx("site.kit.languages.th.key", "کلید")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{tx("site.kit.languages.th.base", "متن فارسی پایه")}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogKeys.map(([key, value]) => (
                    <tr key={key} className="border-t border-hairline-soft">
                      <td dir="ltr" className="px-4 py-2 font-mono text-[12px] text-spring text-start align-top">{key}</td>
                      <td className="px-4 py-2 text-steel">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <h3 className="t-h3 mt-8 mb-3">{tx("site.kit.languages.catSite", "جملات سایت")}</h3>
          <div className="b-card !rounded-3xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-forest/10 dark:bg-forest/20 text-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium w-[220px]">{tx("site.kit.languages.th.key", "کلید")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{tx("site.kit.languages.th.base", "متن فارسی پایه")}</th>
                  </tr>
                </thead>
                <tbody>
                  {siteKeys.map(([key, value]) => (
                    <tr key={key} className="border-t border-hairline-soft">
                      <td dir="ltr" className="px-4 py-2 font-mono text-[12px] text-spring text-start align-top">{key}</td>
                      <td className="px-4 py-2 text-steel">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <h3 className="t-h3 mt-8 mb-3">{tx("site.kit.languages.catLong", "متن‌های بلند")}</h3>
          <div className="b-card !rounded-3xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-forest/10 dark:bg-forest/20 text-foreground">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-medium w-[220px]">{tx("site.kit.languages.th.key", "کلید")}</th>
                    <th className="text-start px-4 py-2.5 font-medium">{tx("site.kit.languages.th.base", "متن فارسی پایه")}</th>
                  </tr>
                </thead>
                <tbody>
                  {longKeys.map(([key, value]) => (
                    <tr key={key} className="border-t border-hairline-soft">
                      <td dir="ltr" className="px-4 py-2 font-mono text-[12px] text-spring text-start align-top">{key}</td>
                      <td className="px-4 py-2 text-steel">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="b-promo-spring !rounded-3xl p-8 text-center">
          <h3 className="text-xl font-bold mb-2">{tx("site.kit.languages.h.cta", "آماده‌اید زبان خودتان را بسازید؟")}</h3>
          <p className="text-sm text-primary-foreground/85 mb-5 leading-7">{tx("long.kit.languages.cta", "تمپلیت را دانلود کنید، ترجمه کنید و از طریق مدیر سامانه فعال کنید — همه کاربران شما بلافاصله زبان جدید را انتخاب می‌کنند.")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/langs/template.json" download className="b-btn bg-white text-spring hover:bg-white/90">
              <Download className="w-4 h-4" /> {tx("site.kit.languages.btn.template2", "دانلود تمپلیت")}
            </a>
            <Link href="/login" className="b-btn b-btn-ghost text-primary-foreground hover:bg-white/15">
              {tx("site.kit.languages.btn.login", "ورود به پنل مدیریت")} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-hairline-soft py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-steel">
          <span>{tx("site.blog.footer2", "بهار — سامانه جامع مدیریت مدارس")}</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-spring transition-colors">{tx("site.kit.languages.homeLink", "صفحه اصلی")}</Link>
            
            <Link href="/blog" className="hover:text-spring transition-colors">{tx("site.blog.label", "بلاگ")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
