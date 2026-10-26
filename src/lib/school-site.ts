// ============================================================
// بهار | سایت عمومی مدرسه — ۱۶ تمپلیت کامل + پیکربندی قابل ویرایش
// مدیر مدرسه فقط متن/تصویر/رنگ/بخش‌ها را تغییر می‌دهد؛ ساختار قفل است.
// شش تمپلیت تازه (پردهٔ سینمایی، گرم و تصویری، دفتر آرام، گرادیان
// نوین، دقیق و تاریک، موج پرانرژی) هرکدام خانوادهٔ چیدمان اختصاصی
// خودشان را دارند و از زبان‌های طراحی getdesign.md الهام گرفته‌اند.
// ============================================================

export type SiteSectionKey =
  | "stats" | "about" | "principal" | "news" | "events" | "classes"
  | "staff" | "gallery" | "faq" | "contact" | "admissions";

export type SiteConfig = {
  palette: number;
  heroTitle: string; // عنوان بزرگ (پیش‌فرض نام مدرسه)
  heroSubtitle: string; // زیرعنوان
  heroImage: string;
  ctaPrimary: string; // متن دکمه پیش‌ثبت‌نام
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  principalMessage: string;
  principalPhoto: string;
  gallery: string[];
  faq: { q: string; a: string }[];
  contactHours: string;
  contactPhone: string; // بازنویسی شماره (اگر خالی، از مدرسه)
  contactAddress: string; // بازنویسی آدرس
  sections: Record<SiteSectionKey, boolean>;
};

export const SECTION_LABELS: Record<SiteSectionKey, string> = {
  stats: "آمار مدرسه (دانش‌آموز/کلاس/معلم)",
  about: "درباره مدرسه",
  principal: "پیام مدیر",
  news: "اخبار و اطلاعیه‌ها",
  events: "رویدادهای پیش رو",
  classes: "کلاس‌ها و پایه‌ها",
  staff: "کادر آموزشی",
  gallery: "گالری تصاویر",
  faq: "سوالات متداول مدرسه",
  contact: "تماس و مسیر",
  admissions: "پیش‌ثبت‌نام آنلاین",
};

export type SiteTemplate = {
  id: string;
  name: string;
  desc: string;
  palettes: { label: string; primary: string; accent: string; bg: string }[];
};

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "classic",
    name: "بهار کلاسیک",
    desc: "سفید و سبز بهاری، هیرو تصویری، بخش‌های منظم — مناسب مدارس عمومی",
    palettes: [
      { label: "سبز بهاری", primary: "#00825E", accent: "#E5548B", bg: "#F4F8F6" },
      { label: "نیلی آرام", primary: "#2C5F8A", accent: "#D98E32", bg: "#F3F6FA" },
      { label: "زرشکی مدرسه‌ای", primary: "#A62639", accent: "#F2A65A", bg: "#FAF3F4" },
    ],
  },
  {
    id: "modern",
    name: "مدرن شهری",
    desc: "هیرو تیره گرادیانی، تایپوگرافی درشت — برای مدارس هوشمند و غیرانتفاعی",
    palettes: [
      { label: "شب شهری", primary: "#00825E", accent: "#53E3B0", bg: "#0E1512" },
      { label: "کهربایی", primary: "#B4632B", accent: "#FFC773", bg: "#151009" },
      { label: "بنفش متالیک", primary: "#6D4AFF", accent: "#9AE6FF", bg: "#100D1A" },
    ],
  },
  {
    id: "academic",
    name: "آکادمیک",
    desc: "کرم و سرمه‌ای با حس کتاب و کتابخانه — مناسب مدارس با سابقه و نمونه",
    palettes: [
      { label: "کتابخانه", primary: "#1F3A5F", accent: "#C9971C", bg: "#FAF6EC" },
      { label: "سبز دانشگاهی", primary: "#154734", accent: "#B7A36A", bg: "#F6F4E9" },
      { label: "آجری", primary: "#7A2E2E", accent: "#D9B47C", bg: "#F9F2ED" },
    ],
  },
  {
    id: "playful",
    name: "کودکانه",
    desc: "رنگ‌های شاد و گوشه‌های گرد — برای دبستان و پیش‌دبستانی",
    palettes: [
      { label: "شادی نارنجی", primary: "#F0803C", accent: "#5BC0BE", bg: "#FFF4EC" },
      { label: "صورتی بازی", primary: "#E5548B", accent: "#FFC94D", bg: "#FFF0F5" },
      { label: "سبز چمن", primary: "#3FA34D", accent: "#F2C14E", bg: "#F0FAF1" },
    ],
  },
  {
    id: "royal",
    name: "سلطنتی",
    desc: "طلایی و عمیق با حس مدرسه خاص — برای مدارس گران‌قیمت و بین‌المللی",
    palettes: [
      { label: "طلای مشکی", primary: "#C9971C", accent: "#EFE0B8", bg: "#121212" },
      { label: "یشمی", primary: "#0E6E5C", accent: "#E3C566", bg: "#F2EFE6" },
      { label: "ارغوانی", primary: "#5B2A86", accent: "#E0B0FF", bg: "#F7F2FD" },
    ],
  },
  {
    id: "minimal",
    name: "مینیمال",
    desc: "سفید خالص، خطوط نازک و فضای خالی زیاد — برای مدارس مدرن و مونتسوری",
    palettes: [
      { label: "ذغالی", primary: "#1F2937", accent: "#00825E", bg: "#FFFFFF" },
      { label: "نقره‌ای سرد", primary: "#334155", accent: "#0EA5E9", bg: "#FAFBFC" },
      { label: "گرم مینیمال", primary: "#44403C", accent: "#D97706", bg: "#FEFCFA" },
    ],
  },
  {
    id: "sport",
    name: "ورزشی",
    desc: "پرانرژی با نوارهای رنگی و تایپ درشت — برای مدارس با تمرکز ورزشی",
    palettes: [
      { label: "پرچم باشگاه", primary: "#1D4ED8", accent: "#F97316", bg: "#F5F7FF" },
      { label: "سبز زمین", primary: "#15803D", accent: "#FACC15", bg: "#F4FBF5" },
      { label: "سرخ قهرمانی", primary: "#B91C1C", accent: "#111827", bg: "#FDF5F5" },
    ],
  },
  {
    id: "stem",
    name: "فناوری (STEM)",
    desc: "تیره با درخشش فیروزه‌ای و حس آزمایشگاه — برای مدارس هوشمند و робاتیک",
    palettes: [
      { label: "آزمایشگاه", primary: "#06B6D4", accent: "#8B5CF6", bg: "#0B1220" },
      { label: "مدار آبی", primary: "#3B82F6", accent: "#22D3EE", bg: "#0A0F1E" },
      { label: "نئون بنفش", primary: "#8B5CF6", accent: "#2DD4BF", bg: "#0F0A1E" },
    ],
  },
  {
    id: "nature",
    name: "طبیعت",
    desc: "سبزهای آرام و کاغذ کرم — برای مدارس روستایی، باغ‌کودک و اکولوژیک",
    palettes: [
      { label: "باغ بهار", primary: "#3F6212", accent: "#CA8A04", bg: "#F7F6EF" },
      { label: "جنگل", primary: "#14532D", accent: "#84CC16", bg: "#F4F7F2" },
      { label: "خاک و گیاه", primary: "#57534E", accent: "#65A30D", bg: "#FAF9F5" },
    ],
  },
  {
    id: "art",
    name: "هنری",
    desc: "کرم گالری با لهجه بنفش/سرخابی و حس خلاقانه — برای هنرستان و مدارس هنر",
    palettes: [
      { label: "گالری", primary: "#7C3AED", accent: "#EC4899", bg: "#FAF7F2" },
      { label: "آبرنگ", primary: "#DB2777", accent: "#0891B2", bg: "#FDF7FA" },
      { label: "نقاشی مدرن", primary: "#4F46E5", accent: "#F59E0B", bg: "#F8F7FD" },
    ],
  },
  {
    id: "apple",
    name: "پردهٔ سینمایی",
    desc: "تایپوگرافی غول‌پیکرِ مرکزی، فضای سفید و نوارهای خاکستری یکی‌درمیان — الهام از زبان طراحی Apple، برای مدارس خاص و مدرن",
    palettes: [
      { label: "سفید و آبی", primary: "#0066CC", accent: "#2997FF", bg: "#FFFFFF" },
      { label: "خاکستری روشن", primary: "#1D1D1F", accent: "#0066CC", bg: "#F5F5F7" },
      { label: "مشکی سینمایی", primary: "#2997FF", accent: "#A1A1A6", bg: "#000000" },
      { label: "سبز آموزشی", primary: "#00825E", accent: "#2997FF", bg: "#FFFFFF" },
    ],
  },
  {
    id: "airbnb",
    name: "گرم و تصویری",
    desc: "کارت‌های تصویری بزرگ با گوشه‌های خیلی نرم و سایه‌های لطیف — الهام از زبان طراحی Airbnb، صمیمی برای اولیا و دانش‌آموزان",
    palettes: [
      { label: "مرجانی", primary: "#FF385C", accent: "#00A699", bg: "#FFFFFF" },
      { label: "فیروزه‌ای", primary: "#00A699", accent: "#FF385C", bg: "#F7F7F7" },
      { label: "آلویی گرم", primary: "#92174D", accent: "#FFC24B", bg: "#FFF9F5" },
      { label: "جنگلی", primary: "#2E7D5B", accent: "#FF8A5C", bg: "#FAFAF7" },
    ],
  },
  {
    id: "notion",
    name: "دفتر آرام",
    desc: "ستون باریکِ سندگونه با خطوط مویی و سطوح گرم؛ آرام، خوانا و بی‌ادا — الهام از زبان طراحی Notion، مناسب مدارس فکری و پژوهشی",
    palettes: [
      { label: "مرکب و آبی", primary: "#37352F", accent: "#0075DE", bg: "#FFFFFF" },
      { label: "یادداشت قرمز", primary: "#37352F", accent: "#E03E3E", bg: "#FFFFFF" },
      { label: "نعنایی آرام", primary: "#1F3D33", accent: "#0F7B6C", bg: "#FBFCFB" },
      { label: "بنفش ملایم", primary: "#2E2A47", accent: "#7B61C9", bg: "#FCFBFE" },
    ],
  },
  {
    id: "stripe",
    name: "گرادیان نوین",
    desc: "هیروی گرادیانی، کارت‌های شناور با سایهٔ رنگی و تایپ سبک و شیک — الهام از زبان طراحی Stripe، برای مدارس فناور و استارتاپی",
    palettes: [
      { label: "بنفش امضا", primary: "#533AFD", accent: "#00D4FF", bg: "#FFFFFF" },
      { label: "آبی اقیانوس", primary: "#0A5CFF", accent: "#533AFD", bg: "#F6F9FC" },
      { label: "نعنایی تازه", primary: "#00B37D", accent: "#533AFD", bg: "#FFFFFF" },
      { label: "غروب صورتی", primary: "#E5548B", accent: "#FFB86B", bg: "#FFFBF7" },
    ],
  },
  {
    id: "linear",
    name: "دقیق و تاریک",
    desc: "نزدیک‌به‌مشکی با خطوط مویی، درخشش ملایم لهجه و گریدهای فشرده — الهام از زبان طراحی Linear، برای مدارس نخبه و فناور",
    palettes: [
      { label: "بنفش خطی", primary: "#5E6AD2", accent: "#8A93E8", bg: "#08090A" },
      { label: "آبی یخی", primary: "#4EA7E8", accent: "#9CC8F0", bg: "#0A0C10" },
      { label: "سبز دقیق", primary: "#3ECF8E", accent: "#8CE8BB", bg: "#070A08" },
      { label: "روشن دقیق", primary: "#5E6AD2", accent: "#8A93E8", bg: "#FBFBFD" },
    ],
  },
  {
    id: "spotify",
    name: "موج پرانرژی",
    desc: "مشکیِ جسور با تایپ اکسترادرشت، تصویر دایره‌ای و ردیف‌های افقی — الهام از زبان طراحی Spotify، برای مدارس پرانرژی و جوان‌پسند",
    palettes: [
      { label: "سبز موج", primary: "#1DB954", accent: "#1ED760", bg: "#121212" },
      { label: "آبی شب", primary: "#2D5BFF", accent: "#7A9BFF", bg: "#0B0F1A" },
      { label: "صورتی پاپ", primary: "#E5548B", accent: "#FF8FBF", bg: "#160A12" },
      { label: "نارنجی انرژی", primary: "#F0803C", accent: "#FFB37A", bg: "#14100C" },
    ],
  },
];

export function templateOf(id: string): SiteTemplate {
  return SITE_TEMPLATES.find((t) => t.id === id) ?? SITE_TEMPLATES[0];
}

/** پیکربندی پیش‌فرض از روی داده مدرسه */
export function defaultSiteConfig(school: {
  name: string; motto: string | null; about: string | null; address: string | null; phone: string | null;
}): SiteConfig {
  return {
    palette: 0,
    heroTitle: school.name,
    heroSubtitle: school.motto || "مدرسه‌ای برای رشد، درخشش و آینده‌ای بهارگونه",
    heroImage: "/img/hero-classroom.png",
    ctaPrimary: "پیش‌ثبت‌نام ۱۴۰۵",
    aboutTitle: `درباره ${school.name}`,
    aboutText:
      school.about ||
      `${school.name} با کادری مجرب و برنامه آموزشی نوین، محیطی امن و شکوفا برای رشد علمی و اخلاقی دانش‌آموزان فراهم کرده است. ما باور داریم هر دانش‌آموز یک بهار تازه است.`,
    aboutImage: "/img/manager-desk.png",
    principalMessage:
      "آموزش ما بر پایه احترام، کنجکاوی و تلاش بنا شده است. درِ مدرسه به روی شما باز است؛ بیایید با هم بهترین فصل زندگی فرزندان‌تان را بسازیم.",
    principalPhoto: "/img/parent-phone.png",
    gallery: [
      "/img/hero-classroom.png",
      "/img/manager-desk.png",
      "/img/devices-flatlay.png",
      "/img/parent-phone.png",
      "/img/hero-classroom.png",
      "/img/manager-desk.png",
    ],
    faq: [
      { q: "شرایط ثبت‌نام چیست؟", a: "پیش‌ثبت‌نام آنلاین را تکمیل کنید؛ کارشناسان مدرسه برای تکمیل پرونده با شما تماس می‌گیرند." },
      { q: "آیا سرویس رفت‌وآمد دارید؟", a: "بله، سرویس ویژه دانش‌آموزان در محدوده شهرستان فعال است." },
      { q: "امکان تست رایگان کلاس وجود دارد؟", a: "یک جلسه حضور آزمایشی برای دانش‌آموزان جدید در نظر گرفته شده است." },
    ],
    contactHours: "شنبه تا چهارشنبه ۷:۳۰ تا ۱۴:۰۰ — پنجشنبه ۸:۰۰ تا ۱۲:۰۰",
    contactPhone: "",
    contactAddress: "",
    sections: {
      stats: true, about: true, principal: true, news: true, events: true,
      classes: true, staff: true, gallery: true, faq: true, contact: true, admissions: true,
    },
  };
}

export function parseSiteConfig(json: string | null | undefined): Partial<SiteConfig> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Partial<SiteConfig>;
  } catch {
    return {};
  }
}
