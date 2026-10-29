"use client";

// ============================================================
// بهار | AvatarBuilder — سازندهٔ آواتار Personas
// پیش‌نمایش زنده + دسته‌بندی تب‌دار + گرید گزینه‌ها + تصادفی + ذخیره
// تغییرات فقط local هستند تا لحظهٔ «ذخیره آواتار».
// ============================================================

import { useMemo, useState } from "react";
import { Dices, Check, X, Loader2 } from "lucide-react";
import {
  type AvatarOptions,
  type AvatarParams,
  AVATAR_CATEGORIES,
  avatarOptionLabel,
  buildAvatarUrl,
  randomAvatar,
} from "@/lib/avatar";

export function AvatarBuilder({
  initial,
  options,
  saving,
  onSave,
  onCancel,
}: {
  initial: AvatarParams;
  options: AvatarOptions;
  saving?: boolean;
  onSave: (params: AvatarParams) => void;
  onCancel: () => void;
}) {
  const [params, setParams] = useState<AvatarParams>(initial);
  const [tab, setTab] = useState(AVATAR_CATEGORIES[0].key);

  const category = useMemo(
    () => AVATAR_CATEGORIES.find((c) => c.key === tab) ?? AVATAR_CATEGORIES[0],
    [tab],
  );

  function set<K extends keyof AvatarParams>(field: K, value: AvatarParams[K]) {
    setParams((p) => ({ ...p, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <b className="text-[15px]">ساخت آواتار</b>
        <button type="button" className="b-btn b-btn-ghost !p-2 !min-h-9" onClick={onCancel} aria-label="بستن سازنده آواتار">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* پیش‌نمایش بزرگ زنده */}
      <div className="flex flex-col items-center gap-2">
        <span className="block w-40 h-40 rounded-full overflow-hidden ring-4 ring-spring/25 bg-cloud">
          { }
          <img
            src={buildAvatarUrl(params, 320)}
            alt="پیش‌نمایش آواتار"
            width={160}
            height={160}
            className="w-full h-full object-cover"
          />
        </span>
        <span className="text-[12px] text-steel">پیش‌نمایش زنده — با هر انتخاب به‌روز می‌شود</span>
      </div>

      {/* تب دسته‌بندی‌ها */}
      <div className="flex gap-1.5 overflow-x-auto b-scroll pb-1 -mx-1 px-1" role="tablist" aria-label="دسته‌بندی‌های آواتار">
        {AVATAR_CATEGORIES.map((c) => (
          <button
            key={c.key}
            role="tab"
            aria-selected={tab === c.key}
            onClick={() => setTab(c.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-[12.5px] font-bold transition-colors ${
              tab === c.key
                ? "bg-spring text-primary-foreground"
                : "bg-spring-tint text-spring-deep hover:bg-spring-tint/70"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* محتوای تب فعال */}
      <div className="flex flex-col gap-5" role="tabpanel">
        {/* گرید سبک‌ها */}
        {category.styleField && category.styleOptions && (
          <div>
            <b className="text-[12.5px] block mb-2.5">{category.styleLabel ?? category.label}</b>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {options[category.styleOptions].map((opt) => {
                const selected = params[category.styleField!] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set(category.styleField!, opt)}
                    aria-pressed={selected}
                    title={avatarOptionLabel(opt)}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-2xl border-2 transition-all ${
                      selected
                        ? "border-spring bg-spring-tint"
                        : "border-transparent bg-cloud/60 hover:bg-cloud"
                    }`}
                  >
                    <span className="block w-14 h-14 rounded-full overflow-hidden bg-cloud">
                      { }
                      <img
                        src={buildAvatarUrl({ ...params, [category.styleField!]: opt }, 96)}
                        alt={avatarOptionLabel(opt)}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </span>
                    <span className={`text-[10.5px] leading-tight text-center truncate w-full ${selected ? "font-bold text-spring-deep" : "text-steel"}`}>
                      {avatarOptionLabel(opt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* گرید رنگ‌ها */}
        {category.colorField && category.colorOptions && (
          <div>
            <b className="text-[12.5px] block mb-2.5">{category.colorLabel ?? category.label}</b>
            <div className="flex flex-wrap gap-2.5">
              {options[category.colorOptions].map((hex) => {
                const selected = params[category.colorField!] === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => set(category.colorField!, hex)}
                    aria-pressed={selected}
                    aria-label={`رنگ ${hex}`}
                    title={`#${hex}`}
                    className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                      selected ? "border-spring scale-110 shadow-md" : "border-hairline hover:scale-105"
                    }`}
                    style={{ backgroundColor: `#${hex}` }}
                  >
                    {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* اکشن‌ها */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          className="b-btn b-btn-ghost"
          onClick={() => setParams(randomAvatar(options))}
          title="ترکیب تصادفی از گزینه‌های معتبر"
        >
          <Dices className="w-4 h-4" /> آواتار تصادفی
        </button>
        <button
          type="button"
          className="b-btn b-btn-spring flex-1 sm:flex-none sm:min-w-40"
          disabled={saving}
          onClick={() => onSave(params)}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} ذخیره آواتار
        </button>
        <button type="button" className="b-btn b-btn-ghost" onClick={onCancel}>انصراف</button>
      </div>
    </div>
  );
}
