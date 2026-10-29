"use client";
// بهار | انتخاب‌گر زبان سایت عمومی — همان الگوی لندینگ (کوکی bahar_site_lang + ریلود).
// برای هدر صفحات کیت (کشورها/زبان‌ها) که هدرشان سوییچر نداشت (باگ دیده‌شدن، راند ۳).
import { SITE_LANGS } from "@/lib/langs/shipped";

export function SiteLangSelect({ current }: { current: string }) {
  return (
    <select
      aria-label="زبان / Language"
      value={current}
      onChange={(e) => {
        document.cookie = `bahar_site_lang=${e.target.value}; path=/; max-age=31536000`;
        location.reload();
      }}
      className="b-btn b-btn-ghost b-btn-sm !px-2"
    >
      {SITE_LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.nativeName}
        </option>
      ))}
    </select>
  );
}
