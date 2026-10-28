"use client";

import { useAccessibility, type A11ySize } from "@/lib/accessibility";
import { PageHeader } from "@/components/shared/bits";
import { Accessibility, Eye, Keyboard, Zap } from "lucide-react";

const SIZES: Array<{ value: A11ySize; label: string }> = [
  { value: "small", label: "کوچک" },
  { value: "normal", label: "معمولی" },
  { value: "large", label: "بزرگ" },
  { value: "xlarge", label: "خیلی بزرگ" },
];

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 border-b border-hairline last:border-0 cursor-pointer">
      <span><b className="text-[14px] block">{label}</b><span className="text-[12.5px] text-steel">{desc}</span></span>
      <input type="checkbox" className="w-5 h-5 mt-1 accent-[var(--spring)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function AccessibilityPage() {
  const { settings, update } = useAccessibility();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="دسترس‌پذیری" desc="اندازهٔ متن، کنتراست بالا، حالت کم‌حواس‌پرتی و کاهش حرکت — برای همه، روی همین دستگاه ذخیره می‌شود." />
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Eye className="w-4 h-4" /> اندازهٔ متن</b>
        <span className="flex gap-2 flex-wrap">
          {SIZES.map((s) => (
            <button key={s.value} className={`b-btn ${settings.size === s.value ? "b-btn-spring" : "b-btn-soft"}`} onClick={() => update({ size: s.value })}>{s.label}</button>
          ))}
        </span>
        <p className="text-[12.5px] text-steel">تغییر اندازه بلافاصله روی کل سامانه اعمال می‌شود؛ نمونهٔ همین متن هم بزرگ/کوچک می‌شود.</p>
      </div>
      <div className="b-card p-6 flex flex-col">
        <b className="text-[14px] flex items-center gap-2 mb-1"><Accessibility className="w-4 h-4" /> نمایش</b>
        <Toggle label="کنتراست بالا" desc="متن مشکی، پس‌زمینه سفید و حاشیه‌های پررنگ‌تر برای خوانایی بیشتر." checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
        <Toggle label="حالت کم‌حواس‌پرتی" desc="سایه‌ها و انیمیشن‌های تزئینی خاموش می‌شوند تا تمرکز روی محتوا بماند." checked={settings.lowDistraction} onChange={(v) => update({ lowDistraction: v })} />
        <Toggle label="کاهش حرکت" desc="همهٔ انیمیشن‌ها و ترنزیشن‌های سامانه خاموش می‌شوند (علاوه بر تنظیم مرورگر)." checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
      </div>
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Keyboard className="w-4 h-4" /> ناوبری با صفحه‌کلید</b>
        <ul className="text-[13px] text-steel flex flex-col gap-1.5 list-disc ps-5">
          <li>کلید Tab برای حرکت بین عناصر، و حلقهٔ فوکوس پررنگ دور عنصر فعال.</li>
          <li>لینک «پرش به محتوای اصلی» با اولین Tab در هر صفحه ظاهر می‌شود.</li>
          <li>کلیدهای / یا ⌘K جستجوی سراسری را باز می‌کنند (از قبل در پوسته بود).</li>
          <li>همهٔ دکمه‌های اصلی پوسته برچسب خوانا برای صفحه‌خوان دارند.</li>
        </ul>
        <p className="text-[12.5px] text-steel flex items-center gap-2"><Zap className="w-4 h-4" /> کاهش حرکت مرورگر (prefers-reduced-motion) هم از قبل در سامانه رعایت می‌شد؛ تنظیم بالا آن را برای همهٔ کاربران، بدون وابستگی به مرورگر، فعال می‌کند.</p>
      </div>
    </div>
  );
}
