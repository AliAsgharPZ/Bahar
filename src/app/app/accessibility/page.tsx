"use client";

import { useAccessibility, type A11ySize } from "@/lib/accessibility";
import { PageHeader } from "@/components/shared/bits";
import { Accessibility, Eye, Keyboard, Zap } from "lucide-react";
import { useLang } from "@/lib/i18n";

const SIZES: Array<{ value: A11ySize; label: string }> = [
  { value: "small", label: "accessibility.size.small" },
  { value: "normal", label: "accessibility.size.normal" },
  { value: "large", label: "accessibility.size.large" },
  { value: "xlarge", label: "accessibility.size.xlarge" },
];

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 border-b border-hairline last:border-0 cursor-pointer">
      <span><b className="text-[14px] block">{label}</b><span className="text-[12.5px] text-steel">{desc}</span></span>
      <input type="checkbox" className="b-check mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function AccessibilityPage() {
  const { t } = useLang();
  const { settings, update } = useAccessibility();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.accessibility")} desc={t("accessibility.desc")} />
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Eye className="w-4 h-4" /> {t("accessibility.textSize")}</b>
        <span className="flex gap-2 flex-wrap">
          {SIZES.map((s) => (
            <button key={s.value} className={`b-btn ${settings.size === s.value ? "b-btn-spring" : "b-btn-soft"}`} onClick={() => update({ size: s.value })}>{t(s.label)}</button>
          ))}
        </span>
        <p className="text-[12.5px] text-steel">{t("accessibility.textSizeNote")}</p>
      </div>
      <div className="b-card p-6 flex flex-col">
        <b className="text-[14px] flex items-center gap-2 mb-1"><Accessibility className="w-4 h-4" /> {t("accessibility.display")}</b>
        <Toggle label={t("accessibility.highContrast")} desc={t("accessibility.highContrastDesc")} checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
        <Toggle label={t("accessibility.lowDistraction")} desc={t("accessibility.lowDistractionDesc")} checked={settings.lowDistraction} onChange={(v) => update({ lowDistraction: v })} />
        <Toggle label={t("accessibility.reduceMotion")} desc={t("accessibility.reduceMotionDesc")} checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
      </div>
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Keyboard className="w-4 h-4" /> {t("accessibility.keyboardNav")}</b>
        <ul className="text-[13px] text-steel flex flex-col gap-1.5 list-disc ps-5">
          <li>{t("accessibility.kb.tab")}</li>
          <li>{t("accessibility.kb.skip")}</li>
          <li>{t("accessibility.kb.search")}</li>
          <li>{t("accessibility.kb.labels")}</li>
        </ul>
        <p className="text-[12.5px] text-steel flex items-center gap-2"><Zap className="w-4 h-4" /> {t("accessibility.reducedMotionNote")}</p>
      </div>
    </div>
  );
}
