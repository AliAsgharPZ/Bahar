"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  MapPin, Phone, Clock, Users, BookOpen, GraduationCap, Newspaper, CalendarDays,
  Send, ChevronLeft, Sparkles, Image as ImageIcon, CheckCircle2, Mail,
} from "lucide-react";
import { formatDateFa, faDigits } from "@/lib/persian";
import { UserAvatar } from "@/components/shared/user-avatar";

// ============================================================
// بهار | رندرکننده سایت عمومی مدرسه — ۱۶ تمپلیت در ۱۰ خانواده چیدمان
//
// خانواده‌های چیدمان (ساختار HTML/چیدمان/فوتر کاملاً متفاوت):
//   classic  (کلاسیک)  → تمپلیت‌ها: classic, minimal
//     هیرو دو ستونه + بخش‌های پشته‌ای آرام؛ کارت‌های سفید؛ فوتر تک‌خطی
//   modern   (مدرن)     → تمپلیت‌ها: modern, stem
//     هیرو تمام‌صفحه تیره گرادیانی + نوار آمار؛ گوشه‌های تیز؛ سرتیترهای
//     بخش با نوار لهجه رنگی؛ گرید جدول‌مانند؛ فوتر تیره با خط گرادیانی
//   magazine (مجله‌ای)  → تمپلیت‌ها: academic, royal, nature, art
//     ماست‌هد سرِیف مرکزی روی خطوط ظریف؛ تیتر درشت مرکزی + تصویر تمام‌عرض؛
//     بخش‌های لیستی با خطوط مویی؛ نقل‌قول ادیتوریال؛ فوتر مرکزی
//   playful  (شاد)      → تمپلیت‌ها: playful, sport
//     هیرو نامتقارن با شکل‌های کج/بلاب؛ کارت‌های گرد بزرگ و رنگی؛
//     برچسب‌های چسبی کج؛ فوتر رنگی با گوشه‌های گرد بزرگ
//
// همه خانواده‌ها از پریمیتیوهای مشترک (SectionHead، StatsBlock، NewsItem،
// EventItem، ClassItem، StaffCard، GalleryGrid، FaqItem، ContactBlock،
// AdmissionsForm) استفاده می‌کنند تا جریان داده و API یکی بماند.
// بخش‌ها: hero / stats / about / principal / news / events / classes /
// staff / gallery / faq / admissions / contact
// ============================================================

export type SiteConfig = {
  palette: number;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ctaPrimary: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  principalMessage: string;
  principalPhoto: string;
  gallery: string[];
  faq: { q: string; a: string }[];
  contactHours: string;
  contactPhone: string;
  contactAddress: string;
  sections: Record<string, boolean>;
};

export type SiteData = {
  school: {
    name: string;
    type: string | null;
    motto: string | null;
    logoUrl: string | null;
    province: string | null;
    county: string | null;
    address: string | null;
    phone: string | null;
    establishedYear: number | null;
  };
  stats: { students: number; classes: number; teachers: number };
  classes: Array<{ name: string; grade: string; field: string | null; capacity: number }>;
  staff: Array<{ id: string; firstName: string; lastName: string; education: string | null; fieldOfStudy: string | null; photoUrl: string | null; profileImageType: "upload" | "avatar" | null; avatar: import("@/lib/avatar").AvatarParams | null }>;
  news: Array<{ title: string; body: string; pinned: boolean; createdAt: string }>;
  events: Array<{ title: string; description: string | null; startAt: string; kind: string }>;
};

type Palette = { label: string; primary: string; accent: string; bg: string };

const EVENT_KIND_FA: Record<string, string> = {
  MEETING: "جلسه", CEREMONY: "مراسم", EXAM: "امتحان", HOLIDAY: "تعطیلی",
  TRIP: "گردش", WORKSHOP: "کارگاه", OTHER: "رویداد",
};

/** فونت تیترها — طبق قاعده پروژه */
const headingFont: React.CSSProperties = { fontFamily: "var(--font-heading)" };

// ─────────────── خانواده چیدمان ───────────────

type Family =
  | "classic" | "modern" | "magazine" | "playful"
  | "apple" | "airbnb" | "notion" | "stripe" | "linear" | "spotify";

/** نگاشت ۱۶ تمپلیت روی ۱۰ خانواده چیدمان — شش خانوادهٔ تازه (apple/airbnb/
 *  notion/stripe/linear/spotify) هرکدام چیدمان اختصاصی خودشان را دارند و
 *  از زبان‌های طراحی getdesign.md الهام گرفته‌اند. */
export function familyOf(templateId: string): Family {
  if (templateId === "modern" || templateId === "stem") return "modern";
  if (templateId === "academic" || templateId === "royal" || templateId === "nature" || templateId === "art") return "magazine";
  if (templateId === "playful" || templateId === "sport") return "playful";
  if (templateId === "apple") return "apple";
  if (templateId === "airbnb") return "airbnb";
  if (templateId === "notion") return "notion";
  if (templateId === "stripe") return "stripe";
  if (templateId === "linear") return "linear";
  if (templateId === "spotify") return "spotify";
  return "classic"; // classic + minimal
}

/** تشخیص تیره بودن رنگ پس‌زمینه پالت (مدرن/استم همیشه تیره؛ «طلای مشکی» سلطنتی هم تیره) */
function isDarkColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

type Skin = {
  p: Palette;
  dark: boolean;
  family: Family;
  templateId: string;
  /** رنگ‌های متن */
  text: string;
  sub: string;
  faint: string;
  /** پس‌زمینه کارت */
  card: string;
  /** رنگ خط/حاشیه */
  border: string;
  /** سایه کارت روشن */
  shadow: string;
  /** شعاع‌ها — امضای هر خانواده */
  radius: string;     // کارت
  radiusLg: string;   // تصویر بزرگ
  pill: string;       // دکمه/چیپ
  inputRadius: string;
  /** رنگ متن روی رنگ لهجه/اصلی پالت */
  onAccent: string;
  onPrimary: string;
};

function familyRadius(family: Family, templateId: string) {
  switch (family) {
    case "modern": return { radius: "4px", radiusLg: "6px", pill: "6px", inputRadius: "6px" };
    case "magazine": return { radius: "0px", radiusLg: "0px", pill: "0px", inputRadius: "4px" };
    case "playful": return { radius: "26px", radiusLg: "34px", pill: "999px", inputRadius: "18px" };
    case "apple": return { radius: "28px", radiusLg: "32px", pill: "999px", inputRadius: "12px" };
    case "airbnb": return { radius: "24px", radiusLg: "32px", pill: "999px", inputRadius: "14px" };
    case "notion": return { radius: "10px", radiusLg: "12px", pill: "8px", inputRadius: "8px" };
    case "stripe": return { radius: "16px", radiusLg: "24px", pill: "999px", inputRadius: "10px" };
    case "linear": return { radius: "8px", radiusLg: "12px", pill: "999px", inputRadius: "8px" };
    case "spotify": return { radius: "16px", radiusLg: "24px", pill: "999px", inputRadius: "999px" };
    default: // classic
      return templateId === "minimal"
        ? { radius: "10px", radiusLg: "12px", pill: "10px", inputRadius: "8px" }
        : { radius: "16px", radiusLg: "20px", pill: "999px", inputRadius: "999px" };
  }
}

function makeSkin(templateId: string, p: Palette): Skin {
  const family = familyOf(templateId);
  const dark = isDarkColor(p.bg);
  const r = familyRadius(family, templateId);
  return {
    p, dark, family, templateId,
    text: dark ? "#F2F4F3" : "#0A1E17",
    sub: dark ? "rgba(255,255,255,.68)" : "#5B6B66",
    faint: dark ? "rgba(255,255,255,.45)" : "#8A9691",
    card: dark ? "rgba(255,255,255,.05)" : "#FFFFFF",
    border: dark ? "rgba(255,255,255,.13)" : "rgba(10,30,23,.10)",
    shadow:
      family === "playful" ? "0 10px 26px rgba(10,30,23,.10)"
      : family === "airbnb" ? "0 6px 24px rgba(10,30,23,.10)"
      : family === "apple" ? "0 4px 24px rgba(0,0,0,.07)"
      : family === "stripe" ? "0 10px 34px rgba(83,58,253,.12)"
      : family === "linear" ? "0 0 0 1px rgba(255,255,255,.04)"
      : family === "spotify" ? "0 8px 24px rgba(0,0,0,.45)"
      : "0 2px 16px rgba(10,30,23,.06)",
    ...r,
    onAccent: isDarkColor(p.accent) ? "#FFFFFF" : "#101828",
    onPrimary: isDarkColor(p.primary) ? "#FFFFFF" : "#101828",
  };
}

/** ظاهر کارت خانواده کلاسیک (مینیمال = خط مویی بدون سایه) */
function classicCard(skin: Skin): React.CSSProperties {
  return {
    borderRadius: skin.radius,
    background: skin.card,
    boxShadow: skin.dark ? "none" : skin.shadow,
    border: skin.templateId === "minimal" ? `1px solid ${skin.border}` : undefined,
  };
}

type FamilyProps = {
  skin: Skin;
  config: SiteConfig;
  data: SiteData;
  subdomain: string;
};

// ─────────────── فرم پیش‌ثبت‌نام (مشترک — رفتار POST دست‌نخورده) ───────────────
function AdmissionsForm({ skin, subdomain }: { skin: Skin; subdomain: string }) {
  const [form, setForm] = useState({ name: "", parentName: "", phone: "", grade: "", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      // ⚠ مسیر صحیح: API عمومی سایت مدرسه — نه آدرس صفحه (که POST ندارد و 405 می‌دهد)
      const res = await fetch(`/api/public/school/${encodeURIComponent(subdomain)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message ?? "خطا در ارسال");
      setDone(true);
      toast.success("درخواست پیش‌ثبت‌نام ثبت شد؛ مدرسه با شما تماس می‌گیرد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="p-8 text-center" style={{ borderRadius: skin.radius, background: `${skin.p.primary}12` }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: skin.p.primary }} />
        <b className="block text-[16px] mb-1" style={{ color: skin.text }}>درخواست شما ثبت شد</b>
        <p className="text-[13px]" style={{ color: skin.sub }}>کارشناسان مدرسه به‌زودی با شما تماس می‌گیرند.</p>
      </div>
    );
  }

  const labelColor = skin.dark ? "rgba(255,255,255,.8)" : "#0A1E17";
  const inputStyle = (): React.CSSProperties => ({
    borderColor: skin.dark ? "rgba(255,255,255,.18)" : "#DFE3E0",
    background: skin.dark ? "rgba(255,255,255,.07)" : "#fff",
    color: skin.dark ? "#fff" : "#0A1E17",
    borderRadius: skin.inputRadius,
  });

  const formChrome: React.CSSProperties =
    skin.family === "modern" ? { background: skin.card, border: `1px solid ${skin.border}`, borderRadius: skin.radius }
    : skin.family === "magazine" ? { background: skin.card, border: `1px solid ${skin.border}`, borderRadius: skin.radius }
    : skin.family === "playful" ? { background: skin.dark ? skin.card : "#fff", border: `2px solid ${skin.p.primary}26`, borderRadius: skin.radius, boxShadow: skin.dark ? "none" : skin.shadow }
    : { background: skin.dark ? skin.card : "#fff", borderRadius: skin.radius, boxShadow: skin.dark ? "none" : skin.shadow };

  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 p-6" style={formChrome}>
      {[
        { k: "name", l: "نام دانش‌آموز *", ph: "نام و نام خانوادگی" },
        { k: "parentName", l: "نام ولی", ph: "نام پدر/مادر" },
        { k: "phone", l: "موبایل *", ph: "09xxxxxxxxx", ltr: true },
        { k: "grade", l: "پایه موردنظر", ph: "مثلا هفتم" },
      ].map((f) => (
        <label key={f.k} className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold" style={{ color: labelColor }}>{f.l}</span>
          <input
            className="h-11 px-4 text-[13px] outline-none border transition-colors focus:border-current"
            style={inputStyle()}
            dir={f.ltr ? "ltr" : "rtl"}
            value={form[f.k as keyof typeof form]}
            onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
            placeholder={f.ph}
            required={f.k === "name" || f.k === "phone"}
            inputMode={f.ltr ? "numeric" : undefined}
          />
        </label>
      ))}
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-[12px] font-bold" style={{ color: labelColor }}>توضیحات</span>
        <textarea
          rows={3}
          className="px-4 py-3 text-[13px] outline-none border resize-none"
          style={{ ...inputStyle(), borderRadius: skin.family === "playful" ? "22px" : skin.inputRadius }}
          value={form.message}
          onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
          placeholder="سوال یا توضیح خاص…"
        />
      </label>
      <div className="sm:col-span-2 flex justify-center">
        <button
          type="submit"
          disabled={sending}
          className="h-12 px-8 text-[14px] font-bold flex items-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-60"
          style={{ borderRadius: skin.pill, background: skin.p.primary, color: "#fff" }}
        >
          <Send className="w-4 h-4" />
          {sending ? "در حال ارسال…" : "ثبت درخواست پیش‌ثبت‌نام"}
        </button>
      </div>
    </form>
  );
}

// ─────────────── پریمیتیوهای مشترک بخش‌ها ───────────────

/** پوشش بخش — عرض/فاصله هر خانواده متفاوت */
function Section({ skin, id, narrow, className = "", style, children }: {
  skin: Skin; id?: string; narrow?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const width = narrow ? "max-w-3xl" : skin.family === "magazine" ? "max-w-5xl" : "max-w-6xl";
  const pad = skin.family === "magazine" ? "py-12 md:py-16" : "py-10 md:py-12";
  return (
    <section id={id} className={`${width} mx-auto px-4 ${pad} ${className}`} style={style}>{children}</section>
  );
}

/** سرتیتر بخش — امضای بصری هر خانواده */
function SectionHead({ skin, icon: Icon, title, kicker, center }: {
  skin: Skin; icon?: LucideIcon; title: string; kicker?: string; center?: boolean;
}) {
  const f = skin.family;
  if (f === "modern") {
    return (
      <div className="mb-8">
        {kicker && <p className="text-[12px] font-bold mb-1.5" style={{ color: skin.p.accent }}>{kicker}</p>}
        <h2 className="text-[22px] md:text-[27px] font-extrabold" style={{ ...headingFont, color: skin.text, borderInlineStart: `4px solid ${skin.p.accent}`, paddingInlineStart: "14px" }}>
          {title}
        </h2>
      </div>
    );
  }
  if (f === "magazine") {
    return (
      <div className={`mb-8 ${center ? "text-center" : ""}`}>
        {kicker && <p className="text-[11.5px] mb-2" style={{ color: skin.p.primary }}>{kicker}</p>}
        <h2 className="text-[24px] md:text-[30px] font-bold inline-block" style={{ ...headingFont, color: skin.text, borderBottom: `1px solid ${skin.border}`, paddingBottom: "10px" }}>
          {title}
        </h2>
      </div>
    );
  }
  if (f === "playful") {
    const sport = skin.templateId === "sport";
    return (
      <div className={`mb-8 ${center ? "text-center" : ""}`}>
        <h2 className="text-[24px] md:text-[30px] font-extrabold inline-flex items-center gap-3" style={{ ...headingFont, color: skin.text }}>
          {Icon && (
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: skin.p.primary }}>
              <Icon className="w-5 h-5" />
            </span>
          )}
          {title}
        </h2>
        <span
          className={`block mt-2.5 h-2.5 rounded-full ${center ? "mx-auto" : ""}`}
          style={{ width: 78, background: skin.p.accent, transform: sport ? "skewX(-12deg)" : undefined }}
          aria-hidden="true"
        />
      </div>
    );
  }
  // کلاسیک
  return (
    <h2 className="text-[20px] md:text-[24px] font-bold mb-6 flex items-center gap-2" style={{ ...headingFont, color: skin.text }}>
      {Icon && <Icon className="w-5 h-5" style={{ color: skin.p.primary }} />}
      {title}
    </h2>
  );
}

/** آمار — چهار چیدمان: کارت (کلاسیک) / نوار تمام‌عرض (مدرن) / خطوط مویی (مجله) / کارت‌های رنگی (شاد) */
function StatsBlock({ skin, stats }: { skin: Skin; stats: SiteData["stats"] }) {
  const items = [
    { icon: GraduationCap, l: "دانش‌آموز", v: stats.students },
    { icon: BookOpen, l: "کلاس", v: stats.classes },
    { icon: Users, l: "معلم", v: stats.teachers },
  ];
  const f = skin.family;

  if (f === "modern") {
    return (
      <section className="border-y" style={{ borderColor: skin.border, background: `${skin.p.primary}16` }}>
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-3">
          {items.map((x, i) => (
            <div key={i} className={`py-7 md:py-9 text-center ${i > 0 ? "border-s" : ""}`} style={{ borderColor: skin.border }}>
              <x.icon className="w-5 h-5 mx-auto mb-2" style={{ color: skin.p.accent }} />
              <b className="block text-[26px] md:text-[36px] font-extrabold" style={{ ...headingFont, color: "#fff" }}>{faDigits(x.v)}</b>
              <span className="text-[11px] md:text-[12px]" style={{ color: skin.faint }}>{x.l}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (f === "magazine") {
    return (
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-3 border-y" style={{ borderColor: skin.border }}>
          {items.map((x, i) => (
            <div key={i} className={`py-7 text-center ${i > 0 ? "border-s" : ""}`} style={{ borderColor: skin.border }}>
              <b className="block text-[26px] md:text-[34px] font-bold" style={{ ...headingFont, color: skin.p.primary }}>{faDigits(x.v)}</b>
              <span className="text-[11px]" style={{ color: skin.faint }}>{x.l}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (f === "playful") {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((x, i) => (
          <div key={i} className="p-6 text-center" style={{ borderRadius: skin.radius, background: i === 1 ? `${skin.p.accent}1C` : `${skin.p.primary}12` }}>
            <span
              className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: i === 1 ? skin.p.accent : skin.p.primary, color: i === 1 ? skin.onAccent : skin.onPrimary }}
            >
              <x.icon className="w-6 h-6" />
            </span>
            <b className="block text-[28px] md:text-[34px] font-extrabold" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
            <span className="text-[12px]" style={{ color: skin.sub }}>{x.l}</span>
          </div>
        ))}
      </section>
    );
  }
  // کلاسیک
  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-3 gap-3 p-5 md:p-6" style={classicCard(skin)}>
        {items.map((x, i) => (
          <div key={i} className="text-center">
            <x.icon className="w-6 h-6 mx-auto mb-2" style={{ color: skin.p.primary }} />
            <b className="block text-[22px] md:text-[30px]" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
            <span className="text-[11.5px]" style={{ color: skin.sub }}>{x.l}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** خبر — کارت (کلاسیک/مدرن/شاد) یا سطر لیست مجله‌ای (lead = خبر نخست درشت‌تر) */
function NewsItem({ skin, n, i = 0, lead = false, className = "" }: {
  skin: Skin; n: SiteData["news"][number]; i?: number; lead?: boolean; className?: string;
}) {
  const f = skin.family;
  const date = formatDateFa(n.createdAt);

  if (f === "magazine") {
    return (
      <article className={`${lead ? "pb-6 mb-2" : "py-5"} border-b last:border-b-0`} style={{ borderColor: skin.border }}>
        {n.pinned && (
          <span className="text-[10.5px] font-bold px-2 py-0.5 me-2 align-middle" style={{ color: skin.p.primary, border: `1px solid ${skin.p.primary}55` }}>مهم</span>
        )}
        <b className={`block ${lead ? "text-[19px] md:text-[23px]" : "text-[15px]"} font-bold leading-snug`} style={{ ...headingFont, color: skin.text }}>{n.title}</b>
        <p className={`mt-2 leading-[1.9] ${lead ? "line-clamp-4 text-[13.5px]" : "line-clamp-2 text-[12.5px]"}`} style={{ color: skin.sub }}>{n.body}</p>
        <span className="block mt-3 text-[11px]" style={{ color: skin.faint }}>{date}</span>
      </article>
    );
  }
  if (f === "modern") {
    return (
      <article className={`p-5 ${className}`} style={{ borderRadius: skin.radius, background: skin.card, borderTop: `3px solid ${skin.p.accent}` }}>
        {n.pinned && <span className="text-[10px] font-bold px-2.5 py-0.5 inline-block mb-2" style={{ background: `${skin.p.accent}22`, color: skin.p.accent }}>مهم</span>}
        <b className="block text-[14px] mb-2 leading-snug" style={{ color: skin.text }}>{n.title}</b>
        <p className="text-[12px] leading-relaxed line-clamp-3" style={{ color: skin.sub }}>{n.body}</p>
        <span className="text-[10.5px] block mt-3" style={{ color: skin.faint }}>{date}</span>
      </article>
    );
  }
  if (f === "playful") {
    return (
      <article className={`p-5 ${className}`} style={{ borderRadius: skin.radius, background: skin.card, boxShadow: skin.shadow, borderTop: `6px solid ${i % 2 ? skin.p.accent : skin.p.primary}` }}>
        {n.pinned && (
          <span className="text-[10px] font-bold px-3 py-1 inline-block mb-2" style={{ borderRadius: 999, background: skin.p.accent, color: skin.onAccent, transform: "rotate(-3deg)" }}>مهم!</span>
        )}
        <b className="block text-[14px] mb-2 leading-snug" style={{ color: skin.text }}>{n.title}</b>
        <p className="text-[12px] leading-relaxed line-clamp-3" style={{ color: skin.sub }}>{n.body}</p>
        <span className="text-[10.5px] block mt-3" style={{ color: skin.faint }}>{date}</span>
      </article>
    );
  }
  // کلاسیک
  return (
    <article className={`p-5 ${className}`} style={classicCard(skin)}>
      {n.pinned && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-2 inline-block" style={{ background: `${skin.p.primary}15`, color: skin.p.primary }}>مهم</span>}
      <b className="block text-[14px] mb-2 leading-snug" style={{ color: skin.text }}>{n.title}</b>
      <p className="text-[12px] leading-relaxed line-clamp-3" style={{ color: skin.sub }}>{n.body}</p>
      <span className="text-[10.5px] block mt-3" style={{ color: skin.faint }}>{date}</span>
    </article>
  );
}

/** رویداد — سطر کارت (کلاسیک) / سطر جدولی (مدرن) / سطر تقویم (مجله) / کپسول گرد (شاد) */
function EventItem({ skin, e }: { skin: Skin; e: SiteData["events"][number] }) {
  const f = skin.family;
  const kind = EVENT_KIND_FA[e.kind] ?? e.kind;
  const date = formatDateFa(e.startAt);

  if (f === "modern") {
    return (
      <div className="flex items-center gap-4 py-4 border-b last:border-b-0" style={{ borderColor: skin.border }}>
        <span className="text-[11px] font-bold px-2.5 py-1 shrink-0" style={{ border: `1px solid ${skin.p.accent}66`, color: skin.p.accent, borderRadius: 4 }}>{kind}</span>
        <div className="min-w-0 flex-1">
          <b className="text-[13.5px] block truncate" style={{ color: skin.text }}>{e.title}</b>
          {e.description && <p className="text-[11.5px] truncate" style={{ color: skin.faint }}>{e.description}</p>}
        </div>
        <span className="text-[11px] shrink-0" style={{ color: skin.p.accent }}>{date}</span>
      </div>
    );
  }
  if (f === "magazine") {
    return (
      <div className="py-5 border-b last:border-b-0 grid md:grid-cols-[110px_1fr] gap-1 md:gap-6 items-start">
        <span className="text-[11px] md:pt-1" style={{ color: skin.p.primary }}>{date}</span>
        <div>
          <b className="text-[14.5px] font-bold block leading-snug" style={{ ...headingFont, color: skin.text }}>{e.title}</b>
          {e.description && <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: skin.sub }}>{e.description}</p>}
          <span className="text-[10.5px] mt-1.5 inline-block" style={{ color: skin.faint }}>{kind}</span>
        </div>
      </div>
    );
  }
  if (f === "playful") {
    return (
      <div className="flex items-center gap-3 p-4" style={{ borderRadius: skin.radius, background: skin.card, boxShadow: skin.shadow }}>
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: skin.p.accent }} aria-hidden="true" />
        <span className="text-[11px] font-bold px-3 py-1 rounded-full shrink-0" style={{ background: skin.p.primary, color: skin.onPrimary }}>{kind}</span>
        <div className="min-w-0 flex-1">
          <b className="text-[13.5px] block truncate" style={{ color: skin.text }}>{e.title}</b>
          {e.description && <p className="text-[11.5px] truncate" style={{ color: skin.sub }}>{e.description}</p>}
        </div>
        <span className="text-[11px] shrink-0" style={{ color: skin.faint }}>{date}</span>
      </div>
    );
  }
  // کلاسیک
  return (
    <div className="flex items-center gap-4 p-4" style={classicCard(skin)}>
      <span className="text-[10.5px] font-bold px-3 py-1 rounded-full shrink-0" style={{ background: `${skin.p.accent}18`, color: skin.dark ? skin.p.accent : "#9C3B62" }}>{kind}</span>
      <div className="min-w-0 flex-1">
        <b className="text-[13.5px] block truncate" style={{ color: skin.text }}>{e.title}</b>
        {e.description && <p className="text-[11.5px] truncate" style={{ color: skin.sub }}>{e.description}</p>}
      </div>
      <span className="text-[11px] shrink-0" style={{ color: skin.faint }}>{date}</span>
    </div>
  );
}

/** کلاس — کارت مرکز‌چین (کلاسیک) / خانه جدول (مدرن) / سطر فهرست (مجله) / قرص رنگی (شاد) */
function ClassItem({ skin, c }: { skin: Skin; c: SiteData["classes"][number] }) {
  const f = skin.family;
  const cap = `ظرفیت ${faDigits(c.capacity)}`;
  const grade = `${c.grade}${c.field ? ` · ${c.field}` : ""}`;

  if (f === "modern") {
    return (
      <div className="p-4 text-center" style={{ background: skin.dark ? "rgba(255,255,255,.04)" : "#fff" }}>
        <b className="block text-[13.5px]" style={{ color: skin.text }}>{c.name}</b>
        <span className="text-[11px] block mt-1" style={{ color: skin.faint }}>{grade}</span>
        <span className="text-[10.5px] block mt-2 font-bold" style={{ color: skin.p.accent }}>{cap}</span>
      </div>
    );
  }
  if (f === "magazine") {
    return (
      <div className="flex items-baseline justify-between gap-3 py-3.5 border-b" style={{ borderColor: skin.border }}>
        <b className="text-[13.5px] font-bold shrink-0" style={{ ...headingFont, color: skin.text }}>{c.name}</b>
        <span className="text-[11.5px] text-end" style={{ color: skin.sub }}>{grade} — {cap}</span>
      </div>
    );
  }
  if (f === "playful") {
    return (
      <div className="flex items-center justify-between gap-2 px-5 py-3" style={{ borderRadius: 999, background: skin.card, border: `2px solid ${skin.p.primary}22`, boxShadow: skin.shadow }}>
        <b className="text-[13px] shrink-0" style={{ color: skin.text }}>{c.name}</b>
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] truncate" style={{ color: skin.sub }}>{grade}</span>
          <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: skin.p.primary, color: skin.onPrimary }}>{faDigits(c.capacity)}</span>
        </span>
      </div>
    );
  }
  // کلاسیک
  return (
    <div className="p-4 text-center" style={classicCard(skin)}>
      <b className="block text-[13.5px] mb-1" style={{ color: skin.text }}>{c.name}</b>
      <span className="text-[11px]" style={{ color: skin.sub }}>{grade}</span>
      <span className="text-[10.5px] block mt-2" style={{ color: skin.p.primary }}>{cap}</span>
    </div>
  );
}

/** کارت معلم — کارت (کلاسیک/مدرن) / سطر دفترچه (مجله) / کارت گرد رنگی (شاد) */
function StaffCard({ skin, st, i = 0 }: { skin: Skin; st: SiteData["staff"][number]; i?: number }) {
  const f = skin.family;
  const name = `${st.firstName} ${st.lastName}`;
  const role = st.education ?? st.fieldOfStudy ?? "دبیر";

  if (f === "magazine") {
    return (
      <div className="flex items-center gap-3.5 py-3.5 border-b" style={{ borderColor: skin.border }}>
        <UserAvatar user={st} size={44} rounded="full" />
        <div className="min-w-0">
          <b className="block text-[13.5px] font-bold truncate" style={{ ...headingFont, color: skin.text }}>{name}</b>
          <span className="text-[11px]" style={{ color: skin.faint }}>{role}</span>
        </div>
      </div>
    );
  }
  if (f === "modern") {
    return (
      <div className="p-5 text-center" style={{ borderRadius: skin.radius, background: skin.card, border: `1px solid ${skin.border}` }}>
        <span className="block mx-auto mb-3 w-fit"><UserAvatar user={st} size={64} rounded="xl" /></span>
        <b className="block text-[13px]" style={{ color: skin.text }}>{name}</b>
        <span className="text-[10.5px]" style={{ color: skin.faint }}>{role}</span>
      </div>
    );
  }
  if (f === "playful") {
    return (
      <div className="p-5 text-center transition-transform hover:-rotate-2" style={{ borderRadius: skin.radius, background: i % 2 ? `${skin.p.accent}16` : `${skin.p.primary}12` }}>
        <span className="block mx-auto mb-3 w-fit"><UserAvatar user={st} size={68} rounded="full" /></span>
        <b className="block text-[13px]" style={{ color: skin.text }}>{name}</b>
        <span className="text-[10.5px]" style={{ color: skin.sub }}>{role}</span>
      </div>
    );
  }
  // کلاسیک
  return (
    <div className="p-5 text-center" style={classicCard(skin)}>
      <span className="block mx-auto mb-3 w-fit"><UserAvatar user={st} size={64} rounded="xl" /></span>
      <b className="block text-[13px]" style={{ color: skin.text }}>{name}</b>
      <span className="text-[10.5px]" style={{ color: skin.sub }}>{role}</span>
    </div>
  );
}

/** گالری — گرید ساده (کلاسیک/مدرن) / موزاییک سرمقاله‌ای (مجله) / قاب‌های کج (شاد) */
function GalleryGrid({ skin, images }: { skin: Skin; images: string[] }) {
  const f = skin.family;

  if (f === "magazine") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((g, i) => (
          <img
            key={i} src={g} alt={`تصویر ${i + 1} از گالری مدرسه`}
            className={`w-full object-cover hover:opacity-90 transition-opacity ${i === 0 ? "col-span-2 aspect-video" : "aspect-[4/3]"}`}
            style={{ borderRadius: skin.radius, border: `1px solid ${skin.border}` }}
          />
        ))}
      </div>
    );
  }
  if (f === "playful") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        {images.map((g, i) => (
          <img
            key={i} src={g} alt={`تصویر ${i + 1} از گالری مدرسه`}
            className={`w-full aspect-[4/3] object-cover hover:rotate-0 transition-transform ${i % 2 ? "md:rotate-[1.2deg]" : "md:-rotate-[1.2deg]"}`}
            style={{ borderRadius: skin.radius, border: `4px solid ${skin.dark ? "rgba(255,255,255,.9)" : "#fff"}`, boxShadow: skin.shadow }}
          />
        ))}
      </div>
    );
  }
  if (f === "modern") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((g, i) => (
          <img
            key={i} src={g} alt={`تصویر ${i + 1} از گالری مدرسه`}
            className="w-full aspect-[4/3] object-cover hover:opacity-80 transition-opacity"
            style={{ borderRadius: skin.radius, border: `1px solid ${skin.border}` }}
          />
        ))}
      </div>
    );
  }
  // کلاسیک
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {images.map((g, i) => (
        <img
          key={i} src={g} alt={`تصویر ${i + 1} از گالری مدرسه`}
          className="w-full aspect-[4/3] object-cover hover:opacity-90 transition-opacity"
          style={skin.templateId === "minimal" ? { borderRadius: skin.radius, border: `1px solid ${skin.border}` } : { borderRadius: skin.radius }}
        />
      ))}
    </div>
  );
}

/** سوال متداول — details کارت (کلاسیک/مدرن/شاد) / ستون پرسش‌وپاسخ مجله‌ای */
function FaqItem({ skin, fq }: { skin: Skin; fq: { q: string; a: string } }) {
  const f = skin.family;

  if (f === "magazine") {
    return (
      <div className="py-5 border-b last:border-b-0" style={{ borderColor: skin.border }}>
        <div className="flex items-start gap-3">
          <span className="w-7 h-7 shrink-0 flex items-center justify-center text-[12px] font-bold" style={{ background: `${skin.p.primary}12`, color: skin.p.primary }}>س</span>
          <b className="text-[14px] font-bold leading-snug" style={{ ...headingFont, color: skin.text }}>{fq.q}</b>
        </div>
        <p className="text-[12.5px] leading-[2] mt-3 md:ps-10" style={{ color: skin.sub }}>{fq.a}</p>
      </div>
    );
  }

  const chrome: React.CSSProperties =
    f === "modern" ? { borderRadius: skin.radius, background: skin.card, border: `1px solid ${skin.border}` }
    : f === "playful" ? { borderRadius: skin.radius, background: skin.card, boxShadow: skin.shadow, border: `2px solid ${skin.p.primary}1A` }
    : classicCard(skin);

  return (
    <details className="p-4" style={chrome}>
      <summary className="text-[13.5px] font-bold cursor-pointer list-none flex items-center gap-2" style={{ color: skin.text }}>
        {f === "playful" ? (
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: skin.p.accent, color: skin.onAccent }}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: f === "modern" ? skin.p.accent : skin.p.primary }} />
        )}
        {fq.q}
      </summary>
      <p className="text-[12.5px] leading-relaxed mt-3 me-6" style={{ color: skin.sub }}>{fq.a}</p>
    </details>
  );
}

/** تماس — کارت آیکونی (کلاسیک/مدرن/شاد) / متن دو ستونه مجله‌ای */
function ContactBlock({ skin, phone, address, hours }: { skin: Skin; phone: string; address: string; hours: string }) {
  const f = skin.family;
  const rows = [
    { icon: Phone, l: "تلفن", v: phone || "—", ltr: true },
    { icon: MapPin, l: "آدرس", v: address, ltr: false },
    { icon: Clock, l: "ساعات کاری", v: hours, ltr: false },
  ];

  if (f === "magazine") {
    return (
      <div className="max-w-2xl mx-auto border-t" style={{ borderColor: skin.border }}>
        {rows.map((x, i) => (
          <div key={i} className="flex items-baseline justify-between gap-6 py-4 border-b last:border-b-0" style={{ borderColor: skin.border }}>
            <span className="text-[11.5px] shrink-0" style={{ color: skin.p.primary }}>{x.l}</span>
            <span className="text-[13.5px] leading-relaxed text-end" style={{ color: skin.text }} dir={x.ltr ? "ltr" : "rtl"}>{x.v}</span>
          </div>
        ))}
      </div>
    );
  }
  if (f === "modern") {
    return (
      <div className="grid md:grid-cols-3 gap-4 p-6" style={{ borderRadius: skin.radius, background: skin.card, border: `1px solid ${skin.border}` }}>
        {rows.map((x, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="w-10 h-10 flex items-center justify-center shrink-0" style={{ background: skin.p.accent, color: skin.onAccent, borderRadius: 4 }}>
              <x.icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <b className="text-[12.5px] block" style={{ color: skin.text }}>{x.l}</b>
              <span className="text-[11.5px] leading-relaxed" style={{ color: skin.sub }} dir={x.ltr ? "ltr" : "rtl"}>{x.v}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (f === "playful") {
    return (
      <div className="grid sm:grid-cols-3 gap-4">
        {rows.map((x, i) => (
          <div key={i} className="p-6 text-center" style={{ borderRadius: skin.radius, background: i === 1 ? `${skin.p.accent}16` : `${skin.p.primary}10` }}>
            <span
              className="w-11 h-11 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: i === 1 ? skin.p.accent : skin.p.primary, color: i === 1 ? skin.onAccent : skin.onPrimary }}
            >
              <x.icon className="w-5 h-5" />
            </span>
            <b className="text-[12.5px] block mb-1" style={{ color: skin.text }}>{x.l}</b>
            <span className="text-[11.5px] leading-relaxed" style={{ color: skin.sub }} dir={x.ltr ? "ltr" : "rtl"}>{x.v}</span>
          </div>
        ))}
      </div>
    );
  }
  // کلاسیک
  return (
    <div className="grid md:grid-cols-3 gap-4 p-6" style={classicCard(skin)}>
      {rows.map((x, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: i === 1 ? skin.p.accent : skin.p.primary, color: i === 1 ? skin.onAccent : "#fff" }}>
            <x.icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <b className="text-[12.5px] block" style={{ color: skin.text }}>{x.l}</b>
            <span className="text-[11.5px] leading-relaxed" style={{ color: skin.sub }} dir={x.ltr ? "ltr" : "rtl"}>{x.v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** نوار/ماست‌هد بالای سایت — چهار چیدمان متفاوت */
function SiteHeader({ skin, school, cta }: { skin: Skin; school: SiteData["school"]; cta: string }) {
  const f = skin.family;

  if (f === "magazine") {
    // ماست‌هد مجله‌ای — نام مرکزی روی خطوط مویی + ناوبری لینکی
    return (
      <header style={{ background: skin.dark ? skin.p.bg : "#fff", borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-5xl mx-auto px-4 pt-9 pb-6 text-center">
          <p className="text-[11px] mb-3" style={{ color: skin.faint }}>
            {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}{school.establishedYear ? ` · از سال ${faDigits(school.establishedYear)}` : ""}
          </p>
          <b className="block text-[28px] md:text-[38px] font-bold leading-tight" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
          {school.motto && <p className="mt-3 text-[12px]" style={{ color: skin.sub }}>{school.motto}</p>}
          <div className="mt-6 border-t" style={{ borderColor: skin.border }} />
        </div>
        <nav className="border-t" style={{ borderColor: skin.border }} aria-label="ناوبری سایت مدرسه">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-center gap-4 sm:gap-6 flex-wrap text-[12px]">
            {[
              ["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"],
              ["کادر", "#staff"], ["گالری", "#gallery"], ["تماس", "#contact"],
            ].map(([l, h]) => (
              <a key={h} href={h} className="hover:underline" style={{ color: skin.sub }}>{l}</a>
            ))}
            <a href="#admissions" className="font-bold hover:underline" style={{ color: skin.p.primary }}>{cta}</a>
          </div>
        </nav>
      </header>
    );
  }
  if (f === "playful") {
    // نوار رنگی پرانرژی
    return (
      <header className="sticky top-0 z-30" style={{ background: skin.p.primary }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-10 h-10 rounded-full object-cover border-2 border-white/60" />
          ) : (
            <span className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center font-bold" style={{ color: skin.onPrimary }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[15px]" style={{ ...headingFont, color: skin.onPrimary }}>{school.name}</b>
          <span className="hidden sm:inline text-[11px] opacity-70" style={{ color: skin.onPrimary }}>{school.type}</span>
          <a href="#admissions" className="ms-auto h-10 px-5 flex items-center text-[12.5px] font-bold transition-transform hover:scale-105" style={{ borderRadius: 999, background: skin.p.accent, color: skin.onAccent }}>
            {cta}
          </a>
        </div>
      </header>
    );
  }
  if (f === "modern") {
    // نوار تیره تیز
    return (
      <header className="sticky top-0 z-30" style={{ background: skin.p.bg, borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-10 h-10 object-cover" style={{ borderRadius: 6 }} />
          ) : (
            <span className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ background: skin.p.primary, borderRadius: 6 }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[15px]" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
          <span className="hidden sm:inline text-[11px]" style={{ color: skin.faint }}>{school.type}</span>
          <a href="#admissions" className="ms-auto h-10 px-5 flex items-center text-[12.5px] font-bold transition-transform hover:scale-105" style={{ borderRadius: skin.pill, background: skin.p.accent, color: skin.onAccent }}>
            {cta}
          </a>
        </div>
      </header>
    );
  }
  // کلاسیک — نوار سفید آرام
  return (
    <header className="sticky top-0 z-30 border-b" style={{ background: skin.dark ? skin.p.bg : "#fff", borderColor: skin.border }}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
        {school.logoUrl ? (
          <img src={school.logoUrl} alt={school.name} className="w-10 h-10 object-cover" style={{ borderRadius: skin.family === "classic" ? 12 : 8 }} />
        ) : (
          <span className="w-10 h-10 flex items-center justify-center font-bold text-white" style={{ background: skin.p.primary, borderRadius: 12 }}>{school.name[0] ?? "ب"}</span>
        )}
        <b className="text-[15px]" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
        <span className="hidden sm:inline text-[11px]" style={{ color: skin.faint }}>{school.type}</span>
        <a href="#admissions" className="ms-auto h-10 px-5 flex items-center text-[12.5px] font-bold text-white transition-transform hover:scale-105" style={{ borderRadius: skin.pill, background: skin.p.primary }}>
          {cta}
        </a>
      </div>
    </header>
  );
}

/** بخش پیش‌ثبت‌نام — چهار چیدمان */
function AdmissionsSection({ skin, config, subdomain }: { skin: Skin; config: SiteConfig; subdomain: string }) {
  const f = skin.family;
  const hint = "فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.";

  if (f === "modern") {
    return (
      <section id="admissions" className="py-16" style={{ background: `${skin.p.primary}14` }}>
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-center text-[12px] font-bold mb-2" style={{ color: skin.p.accent }}>پیش‌ثبت‌نام آنلاین</p>
          <h2 className="text-center text-[24px] md:text-[30px] font-extrabold mb-2" style={{ ...headingFont, color: skin.text }}>{config.ctaPrimary}</h2>
          <p className="text-center text-[13px] mb-8" style={{ color: skin.sub }}>{hint}</p>
          <AdmissionsForm skin={skin} subdomain={subdomain} />
        </div>
      </section>
    );
  }
  if (f === "magazine") {
    return (
      <section id="admissions" className="py-14 md:py-16">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-8">
            <p className="text-[11.5px] mb-2" style={{ color: skin.p.primary }}>پیش‌ثبت‌نام آنلاین</p>
            <h2 className="text-[24px] md:text-[30px] font-bold" style={{ ...headingFont, color: skin.text }}>{config.ctaPrimary}</h2>
            <p className="text-[12.5px] mt-3" style={{ color: skin.sub }}>{hint}</p>
          </div>
          <AdmissionsForm skin={skin} subdomain={subdomain} />
        </div>
      </section>
    );
  }
  if (f === "playful") {
    return (
      <section id="admissions" className="relative overflow-hidden py-16" style={{ background: `${skin.p.primary}0D` }}>
        <span className="absolute -top-10 -start-10 w-44 h-44 rounded-full opacity-15" style={{ background: skin.p.accent }} aria-hidden="true" />
        <span className="absolute -bottom-12 -end-12 w-56 h-56 rounded-full opacity-10" style={{ background: skin.p.primary }} aria-hidden="true" />
        <div className="relative max-w-3xl mx-auto px-4">
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 text-[11px] font-bold mb-4 -rotate-2" style={{ borderRadius: 999, background: skin.p.accent, color: skin.onAccent }}>پیش‌ثبت‌نام آنلاین</span>
            <h2 className="text-[26px] md:text-[32px] font-extrabold mb-2" style={{ ...headingFont, color: skin.text }}>{config.ctaPrimary}</h2>
            <p className="text-[13px] mb-8" style={{ color: skin.sub }}>{hint}</p>
          </div>
          <AdmissionsForm skin={skin} subdomain={subdomain} />
        </div>
      </section>
    );
  }
  // کلاسیک
  return (
    <section id="admissions" className="py-14" style={{ background: skin.dark ? `${skin.p.primary}12` : `${skin.p.primary}08` }}>
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-[22px] md:text-[26px] font-bold mb-2 text-center" style={{ ...headingFont, color: skin.text }}>{config.ctaPrimary}</h2>
        <p className="text-[13px] text-center mb-8" style={{ color: skin.sub }}>{hint}</p>
        <AdmissionsForm skin={skin} subdomain={subdomain} />
      </div>
    </section>
  );
}

/** فوتر — چهار چیدمان متفاوت */
function SiteFooter({ skin, school }: { skin: Skin; school: SiteData["school"] }) {
  const f = skin.family;

  if (f === "modern") {
    return (
      <footer className="mt-10" style={{ background: skin.p.bg }}>
        <div style={{ height: 3, background: `linear-gradient(to left, ${skin.p.primary}, ${skin.p.accent})` }} aria-hidden="true" />
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <b className="text-[19px] md:text-[22px] font-extrabold block mb-1" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
              <span className="text-[11.5px]" style={{ color: skin.faint }}>{school.type ?? "مدرسه"} — ساخته‌شده با سامانه بهار</span>
            </div>
            <a href="/" className="text-[12px] font-bold flex items-center gap-1.5 hover:underline" style={{ color: skin.p.accent }}>
              <Mail className="w-4 h-4" /> بهار؛ سامانه جامع مدارس
            </a>
          </div>
        </div>
      </footer>
    );
  }
  if (f === "magazine") {
    return (
      <footer className="mt-14 border-t" style={{ borderColor: skin.border }}>
        <div className="max-w-5xl mx-auto px-4 py-10 text-center">
          <b className="block text-[18px] md:text-[22px] font-bold mb-2" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
          <span className="block text-[11.5px] mb-4" style={{ color: skin.faint }}>ساخته‌شده با سامانه بهار</span>
          <a href="/" className="text-[12px] font-bold hover:underline" style={{ color: skin.p.primary }}>بهار؛ سامانه جامع مدارس</a>
        </div>
      </footer>
    );
  }
  if (f === "playful") {
    return (
      <footer className="mt-14 pt-12 pb-10 text-center" style={{ background: skin.p.primary, borderRadius: "44px 44px 0 0", color: skin.onPrimary }}>
        <b className="block text-[18px] md:text-[22px] font-extrabold mb-2" style={{ ...headingFont }}>{school.name}</b>
        <span className="block text-[11.5px] opacity-70 mb-5">ساخته‌شده با سامانه بهار</span>
        <a href="/" className="inline-flex items-center gap-1.5 text-[12px] font-bold hover:underline" style={{ color: skin.onPrimary }}>
          <Mail className="w-4 h-4" /> بهار؛ سامانه جامع مدارس
        </a>
      </footer>
    );
  }
  // کلاسیک
  return (
    <footer className="mt-8 py-8 border-t" style={{ borderColor: skin.border }}>
      <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: skin.p.primary }} />
          <span className="text-[12px]" style={{ color: skin.sub }}>{school.name} — ساخته‌شده با سامانه بهار</span>
        </div>
        <a href="/" className="text-[11.5px] font-bold flex items-center gap-1 hover:underline" style={{ color: skin.sub }}>
          <Mail className="w-3.5 h-3.5" /> بهار؛ سامانه جامع مدارس
        </a>
      </div>
    </footer>
  );
}

// ─────────────── تیتر هایلایت‌دار خانواده شاد ───────────────
function HighlightedTitle({ text, accent }: { text: string; accent: string }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const last = words[words.length - 1];
  const rest = words.slice(0, -1);
  return (
    <>
      {rest.length > 0 ? `${rest.join(" ")} ` : ""}
      <span style={{ background: `${accent}33`, borderRadius: 12, padding: "2px 8px" }}>{last}</span>
    </>
  );
}

// ============================================================
// خانواده ۱ — کلاسیک (تمپلیت‌های classic و minimal)
// هیرو دو ستونه آرام + بخش‌های پشته‌ای؛ مینیمال = فاصله بیشتر و
// خطوط مویی به‌جای سایه.
// ============================================================
function ClassicFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const minimal = skin.templateId === "minimal";
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="classic" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      <SiteHeader skin={skin} school={school} cta={config.ctaPrimary} />

      {/* هیرو دو ستونه */}
      <section style={{ background: skin.dark ? p.bg : "#fff" }}>
        <div className={`max-w-6xl mx-auto px-4 ${minimal ? "py-16 md:py-24" : "py-14 md:py-20"} grid md:grid-cols-2 gap-10 items-center`}>
          <div>
            {minimal ? (
              <p className="text-[11.5px] mb-4" style={{ color: p.primary }}>
                {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
              </p>
            ) : (
              <span className="inline-block px-4 py-1.5 mb-4 text-[11px] font-bold" style={{ borderRadius: 999, background: `${p.primary}15`, color: skin.dark ? p.accent : p.primary }}>
                {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
              </span>
            )}
            <h1 className="text-[34px] md:text-[48px] font-extrabold leading-[1.25] mb-4" style={{ ...headingFont, color: skin.dark ? "#fff" : "#0A1E17" }}>
              {config.heroTitle}
            </h1>
            <p className="text-[14.5px] md:text-[16.5px] leading-relaxed mb-8" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
            <div className="flex gap-3 flex-wrap">
              <a href="#admissions" className="h-12 px-7 inline-flex items-center text-[13.5px] font-bold text-white transition-transform hover:scale-[1.02]" style={{ borderRadius: skin.pill, background: p.primary }}>
                {config.ctaPrimary}
              </a>
              <a href="#about" className="h-12 px-7 inline-flex items-center text-[13.5px] font-bold" style={{ borderRadius: skin.pill, border: `1px solid ${skin.border}`, color: skin.text }}>
                درباره مدرسه
              </a>
            </div>
          </div>
          {config.heroImage && (
            <img
              src={config.heroImage} alt={`تصویر ${school.name}`}
              className="w-full aspect-[4/3] object-cover"
              style={{ borderRadius: skin.radiusLg, boxShadow: minimal ? "none" : "0 12px 32px rgba(10,30,23,.12)", border: minimal ? `1px solid ${skin.border}` : undefined }}
            />
          )}
        </div>
      </section>

      {s.stats && <StatsBlock skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg }} />
            )}
            <div>
              <SectionHead skin={skin} title={config.aboutTitle} />
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="grid md:grid-cols-[180px_1fr] gap-6 items-center p-6 md:p-8" style={{ borderRadius: skin.radius, background: skin.dark ? skin.card : `${p.primary}08` }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[140px] h-[140px] object-cover mx-auto" style={{ borderRadius: minimal ? skin.radius : 999 }} />
            )}
            <div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full inline-block mb-3" style={{ background: `${p.accent}20`, color: skin.dark ? p.accent : "#9C3B62" }}>
                پیام مدیر مدرسه
              </span>
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.dark ? "rgba(255,255,255,.8)" : "#3d4a45" }}>
                «{config.principalMessage}»
              </p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <SectionHead skin={skin} icon={Newspaper} title="اخبار و اطلاعیه‌ها" />
          <div className="grid md:grid-cols-3 gap-4">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <SectionHead skin={skin} icon={CalendarDays} title="رویدادهای پیش رو" />
          <div className="flex flex-col gap-3">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <SectionHead skin={skin} icon={BookOpen} title="کلاس‌ها و پایه‌ها" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <SectionHead skin={skin} icon={Users} title="کادر آموزشی" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <SectionHead skin={skin} icon={ImageIcon} title="گالری" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <SectionHead skin={skin} title="سوالات متداول" center />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && <AdmissionsSection skin={skin} config={config} subdomain={subdomain} />}

      {s.contact && (
        <Section skin={skin} id="contact">
          <SectionHead skin={skin} icon={Phone} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۲ — مدرن (تمپلیت‌های modern و stem)
// هیرو تمام‌صفحه تیره گرادیانی + نوار آمار چسبیده به هیرو؛ گوشه‌های
// تیز؛ سرتیتر بخش با نوار لهجه؛ گرید جدول‌مانند کلاس‌ها؛ فوتر تیره.
// ============================================================
function ModernFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="modern" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      <SiteHeader skin={skin} school={school} cta={config.ctaPrimary} />

      {/* هیرو تمام‌صفحه گرادیانی */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.bg} 0%, ${p.primary}55 100%)` }}>
        {config.heroImage && (
          <div className="absolute inset-0 opacity-20 bg-cover bg-center" style={{ backgroundImage: `url(${config.heroImage})` }} aria-hidden="true" />
        )}
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
          <p className="text-[12px] font-bold mb-4" style={{ color: p.accent }}>
            {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}{school.establishedYear ? ` · از سال ${faDigits(school.establishedYear)}` : ""}
          </p>
          <h1 className="text-[40px] md:text-[60px] font-extrabold leading-[1.12] mb-5" style={{ ...headingFont, color: "#fff" }}>
            {config.heroTitle}
          </h1>
          <p className="text-[15px] md:text-[17px] max-w-2xl mx-auto leading-relaxed mb-9" style={{ color: "rgba(255,255,255,.72)" }}>
            {config.heroSubtitle}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="#admissions" className="h-12 px-8 flex items-center text-[14px] font-bold transition-transform hover:scale-[1.02]" style={{ borderRadius: skin.pill, background: p.accent, color: skin.onAccent }}>
              {config.ctaPrimary}
            </a>
            <a href="#contact" className="h-12 px-8 flex items-center text-[14px] font-bold" style={{ borderRadius: skin.pill, border: "1px solid rgba(255,255,255,.3)", color: "#fff" }}>
              تماس با ما
            </a>
          </div>
        </div>
      </section>

      {s.stats && <StatsBlock skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative">
              {config.aboutImage && (
                <>
                  <span className="absolute inset-0" style={{ border: `2px solid ${p.accent}`, borderRadius: skin.radiusLg, transform: "translate(-12px, -12px)" }} aria-hidden="true" />
                  <img src={config.aboutImage} alt="درباره مدرسه" className="relative w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg }} />
                </>
              )}
            </div>
            <div>
              <SectionHead skin={skin} title={config.aboutTitle} kicker="معرفی مدرسه" />
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="grid md:grid-cols-[180px_1fr] gap-6 items-center p-6 md:p-8" style={{ borderRadius: skin.radius, background: skin.card, borderInlineStart: `4px solid ${p.accent}` }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[140px] h-[140px] object-cover mx-auto" style={{ borderRadius: skin.radius }} />
            )}
            <div>
              <p className="text-[11px] font-bold mb-3" style={{ color: p.accent }}>پیام مدیر مدرسه</p>
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: "rgba(255,255,255,.82)" }}>
                «{config.principalMessage}»
              </p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <SectionHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" />
          <div className="grid md:grid-cols-3 gap-4">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <SectionHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم مدرسه" />
          <div className="p-2 md:p-4" style={{ borderRadius: skin.radius, background: skin.card, border: `1px solid ${skin.border}` }}>
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <SectionHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="پایه‌های تحصیلی" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden" style={{ background: skin.border, borderRadius: skin.radius }}>
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <SectionHead skin={skin} title="کادر آموزشی" kicker="همکاران ما" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <SectionHead skin={skin} title="گالری" kicker="نگاه‌ها" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <SectionHead skin={skin} title="سوالات متداول" kicker="پرسش‌های شما" />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && <AdmissionsSection skin={skin} config={config} subdomain={subdomain} />}

      {s.contact && (
        <Section skin={skin} id="contact">
          <SectionHead skin={skin} title="تماس و مسیر" kicker="ارتباط" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۳ — مجله‌ای (تمپلیت‌های academic، royal، nature، art)
// ماست‌هد مرکزی روی خطوط مویی؛ تیتر درشت + تصویر تمام‌عرض؛ بخش‌های
// لیستی ادیتوریال؛ نقل‌قول بزرگ مدیر؛ فوتر مرکزی.
// ============================================================
function MagazineFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="magazine" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      <SiteHeader skin={skin} school={school} cta={config.ctaPrimary} />

      {/* تیتر درشت مرکزی + تصویر تمام‌عرض */}
      <section className="pt-12 md:pt-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-[11.5px] mb-4" style={{ color: p.primary }}>
            {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
          </p>
          <h1 className="text-[36px] md:text-[56px] font-bold leading-[1.22] mb-5" style={{ ...headingFont, color: skin.text }}>
            {config.heroTitle}
          </h1>
          <p className="text-[14.5px] md:text-[16.5px] leading-loose max-w-2xl mx-auto mb-8" style={{ color: skin.sub }}>
            {config.heroSubtitle}
          </p>
          <a href="#admissions" className="h-12 px-9 inline-flex items-center text-[13px] font-bold" style={{ border: `1.5px solid ${skin.dark ? "#fff" : "#0A1E17"}`, color: skin.text }}>
            {config.ctaPrimary}
          </a>
        </div>
        {config.heroImage && (
          <div className="max-w-6xl mx-auto px-4 mt-12">
            <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[16/9] md:aspect-[21/9] object-cover" />
            <div className="flex items-center justify-between gap-4 mt-3 mb-2 text-[11px]" style={{ color: skin.faint }}>
              <span className="truncate">{school.motto ?? school.name}</span>
              {school.establishedYear ? <span className="shrink-0">از سال {faDigits(school.establishedYear)}</span> : null}
            </div>
          </div>
        )}
      </section>

      {s.stats && <StatsBlock skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-[7fr_5fr] gap-8 md:gap-10 items-center">
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" />
            )}
            <div>
              <SectionHead skin={skin} title={config.aboutTitle} kicker="معرفی مدرسه" />
              <p className="text-[13.5px] md:text-[15px] leading-[2.2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <figure className="max-w-3xl mx-auto text-center">
            <span className="block text-[64px] leading-none mb-1 font-bold" style={{ ...headingFont, color: `${p.primary}55` }} aria-hidden="true">«</span>
            <blockquote className="text-[15px] md:text-[18px] leading-[2.1]" style={{ ...headingFont, color: skin.text }}>
              {config.principalMessage}
            </blockquote>
            <figcaption className="mt-6 flex flex-col items-center gap-2">
              {config.principalPhoto && (
                <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-16 h-16 rounded-full object-cover" style={{ border: `2px solid ${skin.border}` }} />
              )}
              <span className="text-[11px]" style={{ color: skin.faint }}>پیام مدیر مدرسه</span>
            </figcaption>
          </figure>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <SectionHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌های مدرسه" />
          <div className="border-t" style={{ borderColor: skin.border }}>
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} lead={i === 0} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <SectionHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم مدرسه" />
          <div className="border-t" style={{ borderColor: skin.border }}>
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <SectionHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="پایه‌های تحصیلی" />
          <div className="grid md:grid-cols-2 gap-x-12 border-t" style={{ borderColor: skin.border }}>
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <SectionHead skin={skin} title="کادر آموزشی" kicker="در یک نگاه" />
          <div className="grid md:grid-cols-2 gap-x-12 border-t" style={{ borderColor: skin.border }}>
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <SectionHead skin={skin} title="گالری" kicker="نگاه به مدرسه" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <SectionHead skin={skin} title="سوالات متداول" kicker="پرسش و پاسخ" center />
          <div className="border-t" style={{ borderColor: skin.border }}>
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && <AdmissionsSection skin={skin} config={config} subdomain={subdomain} />}

      {s.contact && (
        <Section skin={skin} id="contact">
          <SectionHead skin={skin} title="تماس و مسیر" kicker="ارتباط با مدرسه" center />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۴ — شاد و بازیگوش (تمپلیت‌های playful و sport)
// هیرو نامتقارن با شکل‌های کج/بلاب و تصویر قاب کج؛ برچسب‌های چسبی؛
// کارت‌های گرد بزرگ؛ ورزشی = نوارهای مورب به‌جای بلاب.
// ============================================================
function PlayfulFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const sport = skin.templateId === "sport";
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="playful" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      <SiteHeader skin={skin} school={school} cta={config.ctaPrimary} />

      {/* هیرو نامتقارن */}
      <section className="relative overflow-hidden">
        {sport ? (
          <>
            <span className="absolute -top-6 start-[8%] w-56 h-12 -rotate-6 opacity-20" style={{ background: p.accent }} aria-hidden="true" />
            <span className="absolute top-28 end-[-4%] w-64 h-10 rotate-[5deg] opacity-15" style={{ background: p.primary }} aria-hidden="true" />
            <span className="absolute bottom-10 start-[12%] w-44 h-44 rounded-full opacity-10" style={{ background: p.accent }} aria-hidden="true" />
          </>
        ) : (
          <>
            <span className="absolute -top-20 -end-20 w-72 h-72 rounded-full opacity-[.18]" style={{ background: p.primary }} aria-hidden="true" />
            <span className="absolute top-32 start-2 w-28 h-28 opacity-25" style={{ background: p.accent, borderRadius: "42% 58% 62% 38% / 45% 42% 58% 55%" }} aria-hidden="true" />
            <span className="absolute bottom-10 end-1/3 w-20 h-20 rounded-full opacity-20" style={{ background: p.accent }} aria-hidden="true" />
            <span className="absolute bottom-16 start-6 w-36 h-28 opacity-[.15]" style={{ backgroundImage: `radial-gradient(${p.primary} 2.5px, transparent 2.5px)`, backgroundSize: "18px 18px" }} aria-hidden="true" />
          </>
        )}
        <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-[1.05fr_.95fr] gap-10 md:gap-12 items-center">
          <div>
            <span className="inline-block px-4 py-1.5 text-[11px] font-bold mb-5 -rotate-2" style={{ borderRadius: 999, background: sport ? p.primary : p.accent, color: sport ? skin.onPrimary : skin.onAccent }}>
              {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
            </span>
            <h1 className="text-[36px] md:text-[52px] font-extrabold leading-[1.3] mb-5" style={{ ...headingFont, color: skin.text }}>
              <HighlightedTitle text={config.heroTitle} accent={p.accent} />
            </h1>
            <p className="text-[14.5px] md:text-[16px] leading-relaxed mb-8 max-w-lg" style={{ color: skin.sub }}>
              {config.heroSubtitle}
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <a href="#admissions" className="h-[52px] px-8 inline-flex items-center gap-2 text-[14px] font-bold text-white transition-transform hover:scale-105 hover:-rotate-1" style={{ borderRadius: 999, background: p.primary, boxShadow: `0 10px 22px ${p.primary}40` }}>
                <Sparkles className="w-5 h-5" />
                {config.ctaPrimary}
              </a>
              <a href="#contact" aria-label="تماس با ما" className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform hover:rotate-12" style={{ background: p.accent, color: skin.onAccent }}>
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="relative">
            {config.heroImage && (
              <img
                src={config.heroImage} alt={`تصویر ${school.name}`}
                className="w-full aspect-[4/3] object-cover rotate-[2deg] transition-transform hover:rotate-0"
                style={{ borderRadius: sport ? 22 : 34, border: "5px solid #fff", boxShadow: `12px 14px 0 ${p.accent}59` }}
              />
            )}
            {school.establishedYear && (
              <span className="absolute -bottom-5 -start-3 w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center -rotate-6" style={{ boxShadow: skin.shadow }}>
                <span className="text-[9.5px]" style={{ color: skin.sub }}>از سال</span>
                <b className="text-[14px]" style={{ ...headingFont, color: p.primary }}>{faDigits(school.establishedYear)}</b>
              </span>
            )}
          </div>
        </div>
      </section>

      {s.stats && <StatsBlock skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative">
              {config.aboutImage && (
                <>
                  <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover -rotate-2 transition-transform hover:rotate-0" style={{ borderRadius: skin.radiusLg, border: "5px solid #fff", boxShadow: skin.shadow }} />
                  <span className="absolute -top-4 -end-3 px-4 py-1.5 text-[11px] font-bold rotate-6" style={{ borderRadius: 999, background: p.accent, color: skin.onAccent }}>درباره ما</span>
                </>
              )}
            </div>
            <div>
              <SectionHead skin={skin} title={config.aboutTitle} />
              <p className="text-[13.5px] md:text-[15px] leading-[2.1]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className={`relative max-w-3xl mx-auto ${config.principalPhoto ? "pt-12" : ""}`}>
            <div className="p-6 md:p-8 text-center" style={{ borderRadius: 30, background: skin.card, border: `3px solid ${p.primary}2E`, boxShadow: skin.shadow }}>
              {config.principalPhoto && (
                <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-24 h-24 rounded-full object-cover mx-auto -mt-16 mb-4 rotate-3" style={{ border: "4px solid #fff", boxShadow: skin.shadow }} />
              )}
              <span className="inline-block px-4 py-1.5 text-[11px] font-bold mb-4 rotate-2" style={{ borderRadius: 999, background: p.primary, color: skin.onPrimary }}>پیام مدیر مدرسه</span>
              <p className="text-[13.5px] md:text-[15px] leading-[2.1]" style={{ color: skin.sub }}>
                «{config.principalMessage}»
              </p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <SectionHead skin={skin} icon={Newspaper} title="اخبار و اطلاعیه‌ها" />
          <div className="grid md:grid-cols-3 gap-5">
            {data.news.map((n, i) => (
              <NewsItem key={i} skin={skin} n={n} i={i} className={i % 2 ? "md:rotate-[0.6deg]" : "md:-rotate-[0.6deg]"} />
            ))}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <SectionHead skin={skin} icon={CalendarDays} title="رویدادهای پیش رو" />
          <div className="flex flex-col gap-3.5">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <SectionHead skin={skin} icon={BookOpen} title="کلاس‌ها و پایه‌ها" />
          <div className="grid sm:grid-cols-2 gap-3.5">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <SectionHead skin={skin} icon={Users} title="کادر آموزشی" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <SectionHead skin={skin} icon={ImageIcon} title="گالری" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <SectionHead skin={skin} title="سوالات متداول" center />
          <div className="flex flex-col gap-3.5">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && <AdmissionsSection skin={skin} config={config} subdomain={subdomain} />}

      {s.contact && (
        <Section skin={skin} id="contact">
          <SectionHead skin={skin} icon={Phone} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده‌های تازه — شش زبان طراحی از getdesign.md
// هر خانواده هدر، هیرو، سرتیتر و آمارِ امضادار خودش را دارد؛
// بلوک‌های داده (خبر/رویداد/کلاس/کادر/گالری/پرسش/تماس/فرم) مشترک‌اند
// تا جریان داده و API یکی بماند.
// ============================================================

/** سرتیتر بخش برای خانواده‌های تازه — امضای هر زبان طراحی */
function FamHead({ skin, title, kicker, center }: { skin: Skin; title: string; kicker?: string; center?: boolean }) {
  const f = skin.family;
  if (f === "apple") {
    return (
      <div className="mb-10 text-center">
        {kicker && <p className="text-[13px] font-semibold mb-2" style={{ color: skin.p.primary }}>{kicker}</p>}
        <h2 className="text-[30px] md:text-[40px] font-extrabold leading-[1.2]" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      </div>
    );
  }
  if (f === "airbnb") {
    return (
      <div className="mb-8">
        {kicker && <p className="text-[12px] font-bold mb-1.5" style={{ color: skin.p.primary }}>{kicker}</p>}
        <h2 className="text-[24px] md:text-[30px] font-bold leading-snug" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      </div>
    );
  }
  if (f === "notion") {
    return (
      <div className="mb-7">
        {kicker && (
          <span className="inline-block px-2.5 py-1 text-[11px] font-semibold mb-3" style={{ borderRadius: 6, background: `${skin.p.accent}14`, color: skin.p.accent }}>
            {kicker}
          </span>
        )}
        <h2 className="text-[24px] md:text-[28px] font-semibold leading-snug" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      </div>
    );
  }
  if (f === "stripe") {
    return (
      <div className={`mb-9 ${center ? "text-center" : ""}`}>
        {kicker && (
          <p className="text-[12px] font-bold mb-2" style={{ background: `linear-gradient(90deg, ${skin.p.primary}, ${skin.p.accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {kicker}
          </p>
        )}
        <h2 className="text-[26px] md:text-[34px] font-semibold leading-[1.25]" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      </div>
    );
  }
  if (f === "linear") {
    return (
      <div className="mb-8 pb-4" style={{ borderBottom: `1px solid ${skin.border}` }}>
        {kicker && <p className="text-[11px] font-semibold mb-1.5 tracking-wide" style={{ color: skin.p.accent }}>{kicker}</p>}
        <h2 className="text-[20px] md:text-[24px] font-semibold" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      </div>
    );
  }
  // spotify — درشت و جسور با نوار لهجه
  return (
    <div className="mb-8">
      {kicker && <p className="text-[12px] font-bold mb-1.5" style={{ color: skin.p.accent }}>{kicker}</p>}
      <h2 className="text-[26px] md:text-[34px] font-extrabold" style={{ ...headingFont, color: skin.text }}>{title}</h2>
      <span className="block mt-3 h-1 w-14 rounded-full" style={{ background: skin.p.primary }} aria-hidden="true" />
    </div>
  );
}

/** آمار برای خانواده‌های تازه */
function FamStats({ skin, stats }: { skin: Skin; stats: SiteData["stats"] }) {
  const items = [
    { icon: GraduationCap, l: "دانش‌آموز", v: stats.students },
    { icon: BookOpen, l: "کلاس", v: stats.classes },
    { icon: Users, l: "معلم", v: stats.teachers },
  ];
  const f = skin.family;

  if (f === "apple") {
    return (
      <section style={{ background: skin.dark ? "rgba(255,255,255,.04)" : "#F5F5F7" }}>
        <div className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-3">
          {items.map((x, i) => (
            <div key={i} className="text-center px-2">
              <b className="block text-[34px] md:text-[48px] font-extrabold leading-none" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
              <span className="block mt-2 text-[12px] md:text-[13px]" style={{ color: skin.sub }}>{x.l} فعال</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (f === "airbnb") {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((x, i) => (
          <div key={i} className="flex items-center gap-4 p-5" style={{ borderRadius: skin.radius, background: skin.card, boxShadow: skin.shadow, border: `1px solid ${skin.border}` }}>
            <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${skin.p.primary}14`, color: skin.p.primary }}>
              <x.icon className="w-6 h-6" />
            </span>
            <span>
              <b className="block text-[24px] font-bold leading-none" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
              <span className="text-[12px]" style={{ color: skin.sub }}>{x.l}</span>
            </span>
          </div>
        ))}
      </section>
    );
  }
  if (f === "notion") {
    return (
      <section className="max-w-3xl mx-auto px-4 py-10">
        <div className="grid grid-cols-3 border-y" style={{ borderColor: skin.border }}>
          {items.map((x, i) => (
            <div key={i} className={`py-6 text-center ${i > 0 ? "border-s" : ""}`} style={{ borderColor: skin.border }}>
              <b className="block text-[26px] md:text-[32px] font-semibold" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
              <span className="text-[11.5px]" style={{ color: skin.sub }}>{x.l}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (f === "stripe") {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-3 p-6 md:p-8" style={{ borderRadius: skin.radiusLg, background: skin.card, boxShadow: skin.shadow, border: `1px solid ${skin.border}` }}>
          {items.map((x, i) => (
            <div key={i} className="text-center px-2">
              <b className="block text-[28px] md:text-[38px] font-semibold leading-none" style={{ ...headingFont, background: `linear-gradient(120deg, ${skin.p.primary}, ${skin.p.accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{faDigits(x.v)}</b>
              <span className="block mt-2 text-[12px]" style={{ color: skin.sub }}>{x.l}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (f === "linear") {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-3 border" style={{ borderColor: skin.border, borderRadius: skin.radiusLg, background: skin.card }}>
          {items.map((x, i) => (
            <div key={i} className={`py-6 px-4 text-center ${i > 0 ? "border-s" : ""}`} style={{ borderColor: skin.border }}>
              <b className="block text-[24px] md:text-[30px] font-semibold" style={{ ...headingFont, color: skin.text }}>{faDigits(x.v)}</b>
              <span className="text-[11px]" style={{ color: skin.faint }}>{x.l}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  // spotify
  return (
    <section className="max-w-6xl mx-auto px-4 py-10 md:py-14 grid grid-cols-3 gap-4">
      {items.map((x, i) => (
        <div key={i} className="text-center p-5 md:p-7" style={{ borderRadius: skin.radiusLg, background: skin.card }}>
          <b className="block text-[30px] md:text-[44px] font-extrabold leading-none" style={{ ...headingFont, color: skin.p.accent }}>{faDigits(x.v)}</b>
          <span className="block mt-2 text-[12px] font-semibold" style={{ color: skin.sub }}>{x.l}</span>
        </div>
      ))}
    </section>
  );
}

// ============================================================
// خانواده ۵ — «پردهٔ سینمایی» (apple): تایپ غول‌پیکر مرکزی،
// نوارهای خاکستری روشن یکی‌درمیان، تصویر تمام‌عرض، فضای سفید زیاد.
// ============================================================
function AppleFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";
  const soft = skin.dark ? "rgba(255,255,255,.04)" : "#F5F5F7";

  return (
    <div data-family="apple" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر باریک نیمه‌شفاف */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: skin.dark ? "rgba(0,0,0,.72)" : "rgba(255,255,255,.78)", borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: p.primary }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[13.5px] font-semibold" style={{ color: skin.text }}>{school.name}</b>
          <nav className="hidden md:flex items-center gap-6 ms-8 text-[12.5px]" aria-label="ناوبری سایت مدرسه">
            {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["کادر", "#staff"], ["گالری", "#gallery"], ["تماس", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:opacity-70 transition-opacity" style={{ color: skin.sub }}>{l}</a>
            ))}
          </nav>
          <a href="#admissions" className="ms-auto h-8 px-4 inline-flex items-center text-[12px] font-semibold text-white transition-transform hover:scale-[1.03]" style={{ borderRadius: 999, background: p.primary }}>
            {config.ctaPrimary}
          </a>
        </div>
      </header>

      {/* هیرو مرکزی */}
      <section className="max-w-4xl mx-auto px-4 pt-16 md:pt-24 pb-12 text-center">
        <p className="text-[13px] font-semibold mb-4" style={{ color: p.primary }}>
          {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}{school.establishedYear ? ` · از سال ${faDigits(school.establishedYear)}` : ""}
        </p>
        <h1 className="text-[40px] md:text-[64px] font-extrabold leading-[1.15] mb-5" style={{ ...headingFont, color: skin.text }}>{config.heroTitle}</h1>
        <p className="text-[16px] md:text-[20px] leading-relaxed max-w-2xl mx-auto mb-9" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
        <div className="flex items-center justify-center gap-5 flex-wrap">
          <a href="#admissions" className="h-12 px-8 inline-flex items-center text-[14px] font-semibold text-white transition-transform hover:scale-[1.03]" style={{ borderRadius: 999, background: p.primary }}>
            {config.ctaPrimary}
          </a>
          <a href="#about" className="text-[14.5px] font-medium hover:underline" style={{ color: p.primary }}>درباره مدرسه ←</a>
        </div>
      </section>

      {config.heroImage && (
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[16/9] md:aspect-[21/9] object-cover" style={{ borderRadius: skin.radiusLg }} />
        </div>
      )}

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <FamHead skin={skin} title={config.aboutTitle} kicker="درباره ما" center />
          <p className="text-center text-[15px] md:text-[17px] leading-[2] max-w-3xl mx-auto" style={{ color: skin.sub }}>{config.aboutText}</p>
          {config.aboutImage && (
            <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[16/8] object-cover mt-10" style={{ borderRadius: skin.radiusLg }} />
          )}
        </Section>
      )}

      {s.principal && (
        <section style={{ background: soft }}>
          <div className="max-w-3xl mx-auto px-4 py-14 md:py-16 text-center">
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[104px] h-[104px] rounded-full object-cover mx-auto mb-6" />
            )}
            <p className="text-[16px] md:text-[19px] leading-[2] font-medium" style={{ color: skin.text }}>«{config.principalMessage}»</p>
            <p className="mt-5 text-[12.5px] font-semibold" style={{ color: p.primary }}>پیام مدیر مدرسه</p>
          </div>
        </section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" center />
          <div className="grid md:grid-cols-3 gap-4">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <section style={{ background: soft }}>
          <div className="max-w-3xl mx-auto px-4 py-12 md:py-14">
            <FamHead skin={skin} title="رویدادهای پیش رو" center />
            <div className="flex flex-col gap-3">
              {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
            </div>
          </div>
        </section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" center />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <FamHead skin={skin} title="کادر آموزشی" center />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <FamHead skin={skin} title="گالری" center />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <FamHead skin={skin} title="سوالات متداول" center />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && (
        <section id="admissions" style={{ background: soft }}>
          <div className="max-w-2xl mx-auto px-4 py-14 md:py-16">
            <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" center />
            <p className="text-center text-[13.5px] -mt-5 mb-8" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
            <AdmissionsForm skin={skin} subdomain={subdomain} />
          </div>
        </section>
      )}

      {s.contact && (
        <Section skin={skin} id="contact">
          <FamHead skin={skin} title="تماس و مسیر" center />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۶ — «گرم و تصویری» (airbnb): کارت‌های تصویری بزرگ با
// گوشه‌های خیلی نرم، سایه‌های لطیف و چیدمان مهمان‌نوازانه.
// ============================================================
function AirbnbFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="airbnb" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر سفید با دکمهٔ کپسولی */}
      <header className="sticky top-0 z-30" style={{ background: skin.dark ? p.bg : "#fff", borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ background: p.primary }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[15.5px] font-bold" style={{ ...headingFont, color: p.primary }}>{school.name}</b>
          <nav className="hidden md:flex items-center gap-6 ms-6 text-[13px] font-medium" aria-label="ناوبری سایت مدرسه">
            {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["کلاس‌ها", "#classes"], ["گالری", "#gallery"], ["تماس", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:underline" style={{ color: skin.sub }}>{l}</a>
            ))}
          </nav>
          <a href="#admissions" className="ms-auto h-11 px-6 inline-flex items-center text-[13px] font-bold text-white transition-transform hover:scale-[1.03]" style={{ borderRadius: 999, background: p.primary, boxShadow: "0 4px 14px rgba(0,0,0,.14)" }}>
            {config.ctaPrimary}
          </a>
        </div>
      </header>

      {/* هیرو دو ستونه با تصویر بزرگِ نرم */}
      <section className="max-w-6xl mx-auto px-4 pt-10 md:pt-16 pb-4 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        <div>
          <span className="inline-block px-3.5 py-1.5 mb-5 text-[11.5px] font-bold" style={{ borderRadius: 999, background: `${p.accent}18`, color: skin.dark ? p.accent : skin.text }}>
            {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
          </span>
          <h1 className="text-[34px] md:text-[46px] font-bold leading-[1.3] mb-4" style={{ ...headingFont, color: skin.text }}>{config.heroTitle}</h1>
          <p className="text-[14.5px] md:text-[16px] leading-relaxed mb-8" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
          <div className="flex gap-3 flex-wrap">
            <a href="#admissions" className="h-12 px-7 inline-flex items-center text-[13.5px] font-bold text-white transition-transform hover:scale-[1.02]" style={{ borderRadius: 999, background: p.primary }}>
              {config.ctaPrimary}
            </a>
            <a href="#gallery" className="h-12 px-7 inline-flex items-center text-[13.5px] font-bold" style={{ borderRadius: 999, border: `1px solid ${skin.border}`, color: skin.text }}>
              دیدن مدرسه
            </a>
          </div>
        </div>
        {config.heroImage && (
          <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, boxShadow: skin.shadow }} />
        )}
      </section>

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <FamHead skin={skin} title={config.aboutTitle} kicker="درباره ما" />
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, boxShadow: skin.shadow }} />
            )}
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="p-6 md:p-9 grid md:grid-cols-[150px_1fr] gap-6 items-center" style={{ borderRadius: skin.radiusLg, background: `${p.primary}0D`, border: `1px solid ${skin.border}` }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[128px] h-[128px] rounded-full object-cover mx-auto" />
            )}
            <div>
              <p className="text-[11.5px] font-bold mb-2.5" style={{ color: p.primary }}>پیام مدیر مدرسه</p>
              <p className="text-[14px] md:text-[15.5px] leading-[2]" style={{ color: skin.text }}>«{config.principalMessage}»</p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌های مدرسه" />
          <div className="grid md:grid-cols-3 gap-4">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <FamHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم مدرسه" />
          <div className="p-4 md:p-5 flex flex-col gap-3" style={{ borderRadius: skin.radiusLg, background: skin.card, border: `1px solid ${skin.border}`, boxShadow: skin.shadow }}>
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="برنامه آموزشی" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <FamHead skin={skin} title="کادر آموزشی" kicker="تیم ما" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <FamHead skin={skin} title="گالری" kicker="از نزدیک ببینید" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <FamHead skin={skin} title="سوالات متداول" />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && (
        <section id="admissions" className="py-14" style={{ background: `${p.primary}0A` }}>
          <div className="max-w-2xl mx-auto px-4">
            <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" />
            <p className="text-[13px] -mt-4 mb-7" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
            <div className="p-5 md:p-6" style={{ borderRadius: skin.radiusLg, background: skin.card, boxShadow: skin.shadow }}>
              <AdmissionsForm skin={skin} subdomain={subdomain} />
            </div>
          </div>
        </section>
      )}

      {s.contact && (
        <Section skin={skin} id="contact">
          <FamHead skin={skin} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۷ — «دفتر آرام» (notion): ستون باریک سندگونه، خطوط مویی
// به‌جای کارت، سطوح گرم و تیترهای آغازچینِ خوانا.
// ============================================================
function NotionFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="notion" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر سادهٔ سندگونه */}
      <header className="sticky top-0 z-30" style={{ background: p.bg, borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2.5">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-8 h-8 object-cover" style={{ borderRadius: 8 }} />
          ) : (
            <span className="w-8 h-8 flex items-center justify-center font-bold text-white text-[13px]" style={{ background: p.accent, borderRadius: 8 }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[14px] font-semibold" style={{ color: skin.text }}>{school.name}</b>
          <nav className="hidden md:flex items-center gap-5 ms-6 text-[12.5px]" aria-label="ناوبری سایت مدرسه">
            {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["کادر", "#staff"], ["تماس", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:underline" style={{ color: skin.sub }}>{l}</a>
            ))}
          </nav>
          <a href="#admissions" className="ms-auto h-9 px-4 inline-flex items-center text-[12.5px] font-semibold text-white transition-opacity hover:opacity-85" style={{ borderRadius: 8, background: p.accent }}>
            {config.ctaPrimary}
          </a>
        </div>
      </header>

      {/* هیرو سندگونه — آغازچین و آرام */}
      <section className="max-w-3xl mx-auto px-4 pt-14 md:pt-20 pb-8">
        <p className="text-[12px] font-medium mb-4" style={{ color: skin.faint }}>
          {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}{school.establishedYear ? ` · بنیان‌گذاری ${faDigits(school.establishedYear)}` : ""}
        </p>
        <h1 className="text-[34px] md:text-[46px] font-semibold leading-[1.3] mb-4" style={{ ...headingFont, color: skin.text }}>{config.heroTitle}</h1>
        <p className="text-[15px] md:text-[16.5px] leading-[1.9] mb-8" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
        <div className="flex gap-2.5 flex-wrap">
          <a href="#admissions" className="h-10 px-5 inline-flex items-center text-[13px] font-semibold text-white transition-opacity hover:opacity-85" style={{ borderRadius: 8, background: p.accent }}>
            {config.ctaPrimary}
          </a>
          <a href="#about" className="h-10 px-5 inline-flex items-center text-[13px] font-medium" style={{ borderRadius: 8, border: `1px solid ${skin.border}`, color: skin.text }}>
            خواندن درباره مدرسه
          </a>
        </div>
        {config.heroImage && (
          <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[16/9] object-cover mt-10" style={{ borderRadius: skin.radiusLg, border: `1px solid ${skin.border}` }} />
        )}
      </section>

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <section id="about" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title={config.aboutTitle} kicker="درباره" />
          <p className="text-[14px] md:text-[15px] leading-[2.05]" style={{ color: skin.sub }}>{config.aboutText}</p>
          {config.aboutImage && (
            <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[16/9] object-cover mt-7" style={{ borderRadius: skin.radiusLg, border: `1px solid ${skin.border}` }} />
          )}
        </section>
      )}

      {s.principal && (
        <section className="max-w-3xl mx-auto px-4 py-8">
          <div className="p-6 md:p-7 flex gap-5 items-start" style={{ borderRadius: skin.radiusLg, background: `${p.accent}0A`, border: `1px solid ${skin.border}` }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[72px] h-[72px] rounded-full object-cover shrink-0" />
            )}
            <div>
              <p className="text-[11.5px] font-semibold mb-2" style={{ color: p.accent }}>پیام مدیر مدرسه</p>
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.text }}>«{config.principalMessage}»</p>
            </div>
          </div>
        </section>
      )}

      {s.news && data.news.length > 0 && (
        <section id="news" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" />
          <div className="flex flex-col gap-3">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </section>
      )}

      {s.events && data.events.length > 0 && (
        <section id="events" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم" />
          <div className="flex flex-col gap-3">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </section>
      )}

      {s.classes && data.classes.length > 0 && (
        <section id="classes" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="آموزش" />
          <div className="grid grid-cols-2 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </section>
      )}

      {s.staff && data.staff.length > 0 && (
        <section id="staff" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="کادر آموزشی" kicker="تیم" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <section id="gallery" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="گالری" kicker="تصاویر" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </section>
      )}

      {s.faq && config.faq.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="سوالات متداول" />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </section>
      )}

      {s.admissions && (
        <section id="admissions" className="max-w-3xl mx-auto px-4 py-12">
          <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" />
          <p className="text-[13px] -mt-3 mb-6" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
          <AdmissionsForm skin={skin} subdomain={subdomain} />
        </section>
      )}

      {s.contact && (
        <section id="contact" className="max-w-3xl mx-auto px-4 py-10">
          <FamHead skin={skin} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۸ — «گرادیان نوین» (stripe): هیروی گرادیانیِ مورب،
// کارت آمار شناور، سایه‌های رنگی لطیف و تایپ سبک و شیک.
// ============================================================
function StripeFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";
  const grad = `linear-gradient(115deg, ${p.primary} 0%, ${p.accent} 100%)`;

  return (
    <div data-family="stripe" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر روی گرادیان */}
      <div style={{ background: grad }}>
        <header>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
            {school.logoUrl ? (
              <img src={school.logoUrl} alt={school.name} className="w-9 h-9 rounded-full object-cover border-2 border-white/50" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">{school.name[0] ?? "ب"}</span>
            )}
            <b className="text-[15px] font-semibold text-white" style={{ ...headingFont }}>{school.name}</b>
            <nav className="hidden md:flex items-center gap-6 ms-6 text-[13px] text-white/85" aria-label="ناوبری سایت مدرسه">
              {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["کادر", "#staff"], ["گالری", "#gallery"], ["تماس", "#contact"]].map(([l, h]) => (
                <a key={h} href={h} className="hover:text-white transition-colors">{l}</a>
              ))}
            </nav>
            <a href="#admissions" className="ms-auto h-10 px-5 inline-flex items-center text-[12.5px] font-bold bg-white transition-transform hover:scale-[1.03]" style={{ borderRadius: 999, color: p.primary }}>
              {config.ctaPrimary}
            </a>
          </div>
        </header>

        {/* هیرو گرادیانی */}
        <section className="max-w-6xl mx-auto px-4 pt-12 md:pt-16 pb-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[12px] font-bold text-white/80 mb-4">
              {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
            </p>
            <h1 className="text-[36px] md:text-[52px] font-semibold leading-[1.25] text-white mb-5" style={{ ...headingFont }}>{config.heroTitle}</h1>
            <p className="text-[14.5px] md:text-[16.5px] leading-relaxed text-white/85 mb-8">{config.heroSubtitle}</p>
            <div className="flex gap-3 flex-wrap">
              <a href="#admissions" className="h-12 px-7 inline-flex items-center text-[13.5px] font-bold bg-white transition-transform hover:scale-[1.02]" style={{ borderRadius: 999, color: p.primary }}>
                {config.ctaPrimary}
              </a>
              <a href="#about" className="h-12 px-7 inline-flex items-center text-[13.5px] font-semibold text-white" style={{ borderRadius: 999, border: "1.5px solid rgba(255,255,255,.55)" }}>
                درباره مدرسه
              </a>
            </div>
          </div>
          {config.heroImage && (
            <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, boxShadow: "0 24px 48px rgba(20,10,60,.28)" }} />
          )}
        </section>
      </div>

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-9 items-center">
            <div>
              <FamHead skin={skin} title={config.aboutTitle} kicker="درباره ما" />
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, boxShadow: skin.shadow }} />
            )}
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="relative overflow-hidden p-7 md:p-10" style={{ borderRadius: skin.radiusLg, background: grad }}>
            <div className="relative grid md:grid-cols-[140px_1fr] gap-6 items-center">
              {config.principalPhoto && (
                <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[120px] h-[120px] rounded-full object-cover mx-auto border-[3px] border-white/60" />
              )}
              <div>
                <p className="text-[11.5px] font-bold text-white/75 mb-2.5">پیام مدیر مدرسه</p>
                <p className="text-[14.5px] md:text-[16px] leading-[2] text-white">«{config.principalMessage}»</p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" />
          <div className="grid md:grid-cols-3 gap-4">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <FamHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم" />
          <div className="flex flex-col gap-3">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="آموزش" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <FamHead skin={skin} title="کادر آموزشی" kicker="تیم ما" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <FamHead skin={skin} title="گالری" kicker="تصاویر" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <FamHead skin={skin} title="سوالات متداول" center />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && (
        <section id="admissions" className="py-14" style={{ background: `linear-gradient(180deg, transparent, ${p.primary}0D)` }}>
          <div className="max-w-2xl mx-auto px-4">
            <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" center />
            <p className="text-center text-[13px] -mt-5 mb-8" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
            <div className="p-5 md:p-7" style={{ borderRadius: skin.radiusLg, background: skin.card, boxShadow: skin.shadow, border: `1px solid ${skin.border}` }}>
              <AdmissionsForm skin={skin} subdomain={subdomain} />
            </div>
          </div>
        </section>
      )}

      {s.contact && (
        <Section skin={skin} id="contact">
          <FamHead skin={skin} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۹ — «دقیق و تاریک» (linear): نزدیک‌به‌مشکی، خطوط مویی،
// درخشش ملایم لهجه پشت هیرو و گریدهای فشرده و دقیق.
// ============================================================
function LinearFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="linear" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر فشرده با محو پس‌زمینه */}
      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ background: skin.dark ? "rgba(8,9,10,.75)" : "rgba(255,255,255,.8)", borderBottom: `1px solid ${skin.border}` }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-7 h-7 object-cover" style={{ borderRadius: 7 }} />
          ) : (
            <span className="w-7 h-7 flex items-center justify-center font-bold text-white text-[12px]" style={{ background: p.primary, borderRadius: 7 }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[13.5px] font-semibold" style={{ color: skin.text }}>{school.name}</b>
          <nav className="hidden md:flex items-center gap-5 ms-7 text-[12.5px]" aria-label="ناوبری سایت مدرسه">
            {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["کلاس‌ها", "#classes"], ["کادر", "#staff"], ["تماس", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:opacity-75 transition-opacity" style={{ color: skin.sub }}>{l}</a>
            ))}
          </nav>
          <a href="#admissions" className="ms-auto h-8 px-4 inline-flex items-center text-[12px] font-semibold text-white transition-opacity hover:opacity-85" style={{ borderRadius: 999, background: p.primary }}>
            {config.ctaPrimary}
          </a>
        </div>
      </header>

      {/* هیرو با هالهٔ نور لهجه */}
      <section className="relative overflow-hidden">
        <span className="absolute -top-32 start-1/3 w-[480px] h-[480px] rounded-full pointer-events-none" style={{ background: `radial-gradient(closest-side, ${p.primary}30, transparent)`, filter: "blur(10px)" }} aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 text-[11px] font-medium mb-6" style={{ borderRadius: 999, border: `1px solid ${skin.border}`, color: skin.sub }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} aria-hidden="true" />
              {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
            </span>
            <h1 className="text-[34px] md:text-[50px] font-semibold leading-[1.25] mb-5" style={{ ...headingFont, color: skin.text }}>{config.heroTitle}</h1>
            <p className="text-[14px] md:text-[15.5px] leading-[1.95] mb-8 max-w-lg" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
            <div className="flex gap-2.5 flex-wrap">
              <a href="#admissions" className="h-10 px-5 inline-flex items-center text-[13px] font-semibold text-white transition-opacity hover:opacity-85" style={{ borderRadius: 8, background: p.primary }}>
                {config.ctaPrimary}
              </a>
              <a href="#about" className="h-10 px-5 inline-flex items-center text-[13px] font-medium" style={{ borderRadius: 8, border: `1px solid ${skin.border}`, color: skin.text }}>
                درباره مدرسه
              </a>
            </div>
          </div>
          {config.heroImage && (
            <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, border: `1px solid ${skin.border}` }} />
          )}
        </div>
      </section>

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-9 items-center">
            <div>
              <FamHead skin={skin} title={config.aboutTitle} kicker="درباره" />
              <p className="text-[13.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg, border: `1px solid ${skin.border}` }} />
            )}
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="p-6 md:p-8 flex gap-5 items-start" style={{ borderRadius: skin.radiusLg, background: skin.card, border: `1px solid ${skin.border}` }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[76px] h-[76px] rounded-full object-cover shrink-0" />
            )}
            <div>
              <p className="text-[11px] font-semibold mb-2" style={{ color: p.accent }}>پیام مدیر مدرسه</p>
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.text }}>«{config.principalMessage}»</p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <Section skin={skin} id="news">
          <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" />
          <div className="grid md:grid-cols-3 gap-3">
            {data.news.map((n, i) => <NewsItem key={i} skin={skin} n={n} i={i} />)}
          </div>
        </Section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <FamHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم" />
          <div className="flex flex-col gap-2.5">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="آموزش" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <FamHead skin={skin} title="کادر آموزشی" kicker="تیم" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <Section skin={skin} id="gallery">
          <FamHead skin={skin} title="گالری" kicker="تصاویر" />
          <GalleryGrid skin={skin} images={config.gallery} />
        </Section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <FamHead skin={skin} title="سوالات متداول" />
          <div className="flex flex-col gap-2.5">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && (
        <Section skin={skin} id="admissions">
          <div className="max-w-2xl mx-auto">
            <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" />
            <p className="text-[13px] -mt-4 mb-7" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
            <AdmissionsForm skin={skin} subdomain={subdomain} />
          </div>
        </Section>
      )}

      {s.contact && (
        <Section skin={skin} id="contact">
          <FamHead skin={skin} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ============================================================
// خانواده ۱۰ — «موج پرانرژی» (spotify): مشکی جسور، تایپ اکسترا
// درشت، موتیف‌های دایره‌ای و ردیف‌های افقی اسکرولی.
// ============================================================
function SpotifyFamily({ skin, config, data, subdomain }: FamilyProps) {
  const p = skin.p;
  const s = config.sections;
  const school = data.school;
  const contactPhone = config.contactPhone || school.phone || "";
  const contactAddress = config.contactAddress || school.address || "";

  return (
    <div data-family="spotify" className="min-h-screen font-sans" style={{ background: p.bg, color: skin.text }}>
      {/* هدر مشکی با دکمهٔ سبز کپسولی */}
      <header className="sticky top-0 z-30" style={{ background: skin.dark ? "rgba(10,10,10,.88)" : "#fff", borderBottom: `1px solid ${skin.border}`, backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span className="w-10 h-10 rounded-full flex items-center justify-center font-extrabold" style={{ background: p.primary, color: skin.onPrimary }}>{school.name[0] ?? "ب"}</span>
          )}
          <b className="text-[15.5px] font-extrabold" style={{ ...headingFont, color: skin.text }}>{school.name}</b>
          <nav className="hidden md:flex items-center gap-6 ms-6 text-[13px] font-semibold" aria-label="ناوبری سایت مدرسه">
            {[["درباره", "#about"], ["اخبار", "#news"], ["رویدادها", "#events"], ["گالری", "#gallery"], ["تماس", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="hover:opacity-75 transition-opacity" style={{ color: skin.sub }}>{l}</a>
            ))}
          </nav>
          <a href="#admissions" className="ms-auto h-11 px-6 inline-flex items-center text-[13px] font-extrabold transition-transform hover:scale-[1.04]" style={{ borderRadius: 999, background: p.primary, color: skin.onPrimary }}>
            {config.ctaPrimary}
          </a>
        </div>
      </header>

      {/* هیرو جسور با تصویر دایره‌ای */}
      <section className="relative overflow-hidden">
        <span className="absolute -bottom-24 -start-24 w-72 h-72 rounded-full opacity-20 pointer-events-none" style={{ background: p.primary }} aria-hidden="true" />
        <span className="absolute top-10 -end-16 w-52 h-52 rounded-full opacity-15 pointer-events-none" style={{ background: p.accent }} aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 pt-14 md:pt-20 pb-16 grid md:grid-cols-[1.25fr_1fr] gap-10 items-center">
          <div>
            <p className="text-[12.5px] font-bold mb-4" style={{ color: p.accent }}>
              {school.type ?? "مدرسه"}{school.county ? ` · ${school.county}` : ""}
            </p>
            <h1 className="text-[38px] md:text-[58px] font-extrabold leading-[1.2] mb-5" style={{ ...headingFont, color: skin.text }}>{config.heroTitle}</h1>
            <p className="text-[14.5px] md:text-[16.5px] leading-relaxed mb-9 max-w-xl" style={{ color: skin.sub }}>{config.heroSubtitle}</p>
            <div className="flex gap-3 flex-wrap items-center">
              <a href="#admissions" className="h-[52px] px-9 inline-flex items-center text-[14px] font-extrabold transition-transform hover:scale-[1.04]" style={{ borderRadius: 999, background: p.primary, color: skin.onPrimary }}>
                {config.ctaPrimary}
              </a>
              <a href="#news" className="h-[52px] px-8 inline-flex items-center text-[13.5px] font-bold" style={{ borderRadius: 999, border: `1.5px solid ${skin.border}`, color: skin.text }}>
                تازه‌های مدرسه
              </a>
            </div>
          </div>
          {config.heroImage && (
            <div className="relative mx-auto w-full max-w-[380px]">
              <img src={config.heroImage} alt={`تصویر ${school.name}`} className="w-full aspect-square object-cover rounded-full" style={{ border: `6px solid ${p.primary}` }} />
              <span className="absolute -bottom-3 start-6 px-4 py-2 text-[11.5px] font-extrabold rounded-full" style={{ background: p.accent, color: skin.onAccent }}>
                {school.establishedYear ? `از سال ${faDigits(school.establishedYear)}` : "بهارِ یادگیری"}
              </span>
            </div>
          )}
        </div>
      </section>

      {s.stats && <FamStats skin={skin} stats={data.stats} />}

      {s.about && (
        <Section skin={skin} id="about">
          <div className="grid md:grid-cols-2 gap-9 items-center">
            {config.aboutImage && (
              <img src={config.aboutImage} alt="درباره مدرسه" className="w-full aspect-[4/3] object-cover" style={{ borderRadius: skin.radiusLg }} />
            )}
            <div>
              <FamHead skin={skin} title={config.aboutTitle} kicker="درباره ما" />
              <p className="text-[13.5px] md:text-[14.5px] leading-[2]" style={{ color: skin.sub }}>{config.aboutText}</p>
            </div>
          </div>
        </Section>
      )}

      {s.principal && (
        <Section skin={skin}>
          <div className="p-7 md:p-9 grid md:grid-cols-[130px_1fr] gap-6 items-center" style={{ borderRadius: skin.radiusLg, background: skin.card }}>
            {config.principalPhoto && (
              <img src={config.principalPhoto} alt="مدیر مدرسه" className="w-[110px] h-[110px] rounded-full object-cover mx-auto" style={{ border: `3px solid ${p.primary}` }} />
            )}
            <div>
              <p className="text-[11.5px] font-extrabold mb-2.5" style={{ color: p.accent }}>پیام مدیر مدرسه</p>
              <p className="text-[14px] md:text-[15.5px] leading-[2] font-medium" style={{ color: skin.text }}>«{config.principalMessage}»</p>
            </div>
          </div>
        </Section>
      )}

      {s.news && data.news.length > 0 && (
        <section id="news" className="py-10 md:py-12">
          <div className="max-w-6xl mx-auto px-4">
            <FamHead skin={skin} title="اخبار و اطلاعیه‌ها" kicker="تازه‌ها" />
          </div>
          <div className="max-w-6xl mx-auto ps-4">
            <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x pb-2 pe-4">
              {data.news.map((n, i) => (
                <div key={i} className="snap-start shrink-0 w-[270px] md:w-[320px]">
                  <NewsItem skin={skin} n={n} i={i} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {s.events && data.events.length > 0 && (
        <Section skin={skin} id="events">
          <FamHead skin={skin} title="رویدادهای پیش رو" kicker="تقویم" />
          <div className="flex flex-col gap-3">
            {data.events.map((e, i) => <EventItem key={i} skin={skin} e={e} />)}
          </div>
        </Section>
      )}

      {s.classes && data.classes.length > 0 && (
        <Section skin={skin} id="classes">
          <FamHead skin={skin} title="کلاس‌ها و پایه‌ها" kicker="آموزش" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.classes.map((c, i) => <ClassItem key={i} skin={skin} c={c} />)}
          </div>
        </Section>
      )}

      {s.staff && data.staff.length > 0 && (
        <Section skin={skin} id="staff">
          <FamHead skin={skin} title="کادر آموزشی" kicker="تیم ما" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.staff.map((st, i) => <StaffCard key={i} skin={skin} st={st} i={i} />)}
          </div>
        </Section>
      )}

      {s.gallery && config.gallery.length > 0 && (
        <section id="gallery" className="py-10 md:py-12">
          <div className="max-w-6xl mx-auto px-4">
            <FamHead skin={skin} title="گالری" kicker="تصاویر" />
          </div>
          <div className="max-w-6xl mx-auto ps-4">
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-2 pe-4">
              {config.gallery.map((src, i) => (
                <img key={i} src={src} alt={`تصویر گالری ${faDigits(i + 1)}`} className="snap-start shrink-0 w-[240px] md:w-[300px] aspect-[4/3] object-cover" style={{ borderRadius: skin.radius }} loading="lazy" />
              ))}
            </div>
          </div>
        </section>
      )}

      {s.faq && config.faq.length > 0 && (
        <Section skin={skin} narrow>
          <FamHead skin={skin} title="سوالات متداول" />
          <div className="flex flex-col gap-3">
            {config.faq.map((fq, i) => <FaqItem key={i} skin={skin} fq={fq} />)}
          </div>
        </Section>
      )}

      {s.admissions && (
        <section id="admissions" className="py-14" style={{ background: `${p.primary}14` }}>
          <div className="max-w-2xl mx-auto px-4">
            <FamHead skin={skin} title={config.ctaPrimary} kicker="پیش‌ثبت‌نام آنلاین" />
            <p className="text-[13px] -mt-4 mb-7" style={{ color: skin.sub }}>فرم را تکمیل کنید؛ مدرسه برای تکمیل پرونده با شما تماس می‌گیرد.</p>
            <div className="p-5 md:p-6" style={{ borderRadius: skin.radiusLg, background: skin.card, boxShadow: skin.shadow }}>
              <AdmissionsForm skin={skin} subdomain={subdomain} />
            </div>
          </div>
        </section>
      )}

      {s.contact && (
        <Section skin={skin} id="contact">
          <FamHead skin={skin} title="تماس و مسیر" />
          <ContactBlock skin={skin} phone={contactPhone} address={contactAddress} hours={config.contactHours} />
        </Section>
      )}

      <SiteFooter skin={skin} school={school} />
    </div>
  );
}

// ─────────────── رندرکننده اصلی (API دست‌نخورده) ───────────────
export function SchoolSiteRenderer({
  templateId,
  palette,
  config,
  data,
  subdomain,
}: {
  templateId: string;
  palette: Palette;
  config: SiteConfig;
  data: SiteData;
  subdomain: string;
}) {
  const skin = makeSkin(templateId, palette);
  const props: FamilyProps = { skin, config, data, subdomain };

  switch (skin.family) {
    case "modern": return <ModernFamily {...props} />;
    case "magazine": return <MagazineFamily {...props} />;
    case "playful": return <PlayfulFamily {...props} />;
    case "apple": return <AppleFamily {...props} />;
    case "airbnb": return <AirbnbFamily {...props} />;
    case "notion": return <NotionFamily {...props} />;
    case "stripe": return <StripeFamily {...props} />;
    case "linear": return <LinearFamily {...props} />;
    case "spotify": return <SpotifyFamily {...props} />;
    default: return <ClassicFamily {...props} />;
  }
}
