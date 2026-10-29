"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  JALALI_MONTHS,
  calendarParts,
  calendarToDate,
  calendarMonthNames,
  formatJalaliInput,
  parseJalaliInput,
  enDigits,
  faDigits,
  weekdays,
} from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";
import { Select } from "@/components/shared/pickers";

// ============================================================
// بهار | ورودی تاریخ تقویم فعال — متن + تقویم کشویی
// دیفالت ایران: شمسی (مثل قبل). تقویم میلادی: ورودی native date.
// ============================================================

type Props = {
  value: Date | string | null | undefined;
  onChange: (d: Date | null) => void;
  placeholder?: string;
};

export function JalaliDateInput({ value, onChange, placeholder }: Props) {
  const calendar = getCountrySync().calendar;
  const ph = placeholder ?? (calendar === "gregory" ? "2025/01/01" : "۱۴۰۴/۰۱/۰۱");

  // ── تقویم میلادی: ورودی بومی مرورگر (راحت و بدون تبدیل) ──
  if (calendar === "gregory") {
    const iso = value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value
        ? new Date(value).toISOString().slice(0, 10)
        : "";
    return (
      <div className="relative">
        <input
          className="b-input !ps-10"
          dir="ltr"
          type="date"
          value={iso}
          placeholder={ph}
          onChange={(e) => onChange(e.target.value ? new Date(`${e.target.value}T12:00:00Z`) : null)}
        />
        <CalendarDays className="w-4 h-4 text-stone absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
      </div>
    );
  }

  // ── تقویم‌های غیرمیلادی: تقویم کشویی (شمسی/قمری/عبری/…) ──
  return <CalendarPickerInput value={value} onChange={onChange} placeholder={ph} />;
}

function CalendarPickerInput({ value, onChange, placeholder }: Props) {
  const months = calendarMonthNames();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const display = useMemo(() => (value ? formatJalaliInput(value instanceof Date ? value : new Date(value)) : text), [value, text]);

  const initial = useMemo(() => {
    const base = value ? (value instanceof Date ? value : new Date(value)) : new Date();
    return calendarParts(base);
  }, [value]);

  const [view, setView] = useState({ y: initial.y, m: initial.m });

  const isPersian = getCountrySync().calendar === "persian";
  const daysInMonth = !isPersian ? 30 : view.m <= 6 ? 31 : view.m <= 11 ? 30 : isJalaliLeap(view.y) ? 30 : 29;

  // انتخابگرهای ماه/سال کاستوم داخل پاپ‌آپ فوکوس را می‌گیرند —
  // بستن روی blur فقط وقتی فوکوس بیرون از تقویم رفته باشد (و کلید بیرون‌کلیک)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = (y: number, m: number, d: number) => {
    onChange(calendarToDate(y, m, d));
    setOpen(false);
  };

  const onTextChange = (raw: string) => {
    setText(raw);
    const parsed = parseJalaliInput(enDigits(raw));
    if (parsed) {
      const d = calendarToDate(parsed.y, parsed.m, parsed.d);
      onChange(d);
      setView({ y: parsed.y, m: parsed.m });
    } else if (raw.trim() === "") {
      onChange(null);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="relative">
        <input
          className="b-input !ps-10"
          dir="ltr"
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            // اگر فوکوس به عنصری داخل همین تقویم رفت (انتخابگر ماه/سال) باز بماند
            const rt = e.relatedTarget as Node | null;
            if (rt && rootRef.current?.contains(rt)) return;
            setTimeout(() => setOpen(false), 150);
          }}
        />
        <CalendarDays className="w-4 h-4 text-stone absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-40 mt-2 b-card !rounded-2xl p-3 w-[248px] b-pop shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              className="w-7 h-7 rounded-full flex items-center justify-center text-steel hover:bg-cloud"
              onClick={() => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { ...v, m: v.m - 1 }))}
              aria-label="ماه قبل"
            >
              ›
            </button>
            <div className="flex items-center gap-1">
              <Select
                value={String(view.m)}
                onChange={(v) => setView((v2) => ({ ...v2, m: Number(v) }))}
                options={months.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))}
                ariaLabel="ماه"
                className="!w-[92px]"
                buttonClassName="!w-[92px] !h-7 !px-2 !text-[12.5px] !font-bold !rounded-full"
              />
              <Select
                value={String(view.y)}
                onChange={(v) => setView((v2) => ({ ...v2, y: Number(v) }))}
                options={(() => {
                  const nowY = calendarParts(new Date()).y;
                  return Array.from({ length: 101 }, (_, i) => nowY + 50 - i).map((y) => ({ value: String(y), label: faDigits(y) }));
                })()}
                ariaLabel="سال"
                className="!w-[84px]"
                buttonClassName="!w-[84px] !h-7 !px-2 !text-[12.5px] !font-bold !rounded-full"
              />
            </div>
            <button
              type="button"
              className="w-7 h-7 rounded-full flex items-center justify-center text-steel hover:bg-cloud"
              onClick={() => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { ...v, m: v.m + 1 }))}
              aria-label="ماه بعد"
            >
              ‹
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-stone mb-1">
            {weekdays().map((w) => (
              <span key={w.value}>{w.label.slice(0, 2)}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {/* روزهای خالی ابتدای ماه */}
            {Array.from({ length: firstWeekdayOfMonth(view.y, view.m) }).map((_, i) => (
              <span key={`e-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
              const selected = display === `${view.y}/${String(view.m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
              const isToday = (() => {
                const t = calendarParts(new Date());
                return t.y === view.y && t.m === view.m && t.d === d;
              })();
              return (
                <button
                  key={d}
                  type="button"
                  className={`h-7 rounded-full text-[11.5px] font-bold transition-colors ${
                    selected
                      ? "bg-spring text-primary-foreground"
                      : isToday
                        ? "bg-spring-tint text-spring"
                        : "hover:bg-cloud text-ink"
                  }`}
                  onClick={() => commit(view.y, view.m, d)}
                >
                  {faDigits(d)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-hairline-soft">
            <button
              type="button"
              className="text-[12px] text-spring font-bold hover:underline"
              onClick={() => {
                const t = calendarParts(new Date());
                setView({ y: t.y, m: t.m });
                commit(t.y, t.m, t.d);
              }}
            >
              امروز
            </button>
            <button
              type="button"
              className="text-[12px] text-destructive font-bold hover:underline"
              onClick={() => {
                onChange(null);
                setText("");
                setOpen(false);
              }}
            >
              پاک‌کردن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function isJalaliLeap(jy: number): boolean {
  // کبیسه جلالی: باقی‌مانده‌های شناخته‌شده ۳۳ ساله
  const r = jy % 33;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes(r);
}

function firstWeekdayOfMonth(jy: number, jm: number): number {
  // ستون اول تقویم = روز اول هفته پروفایل (ایران: شنبه) — جابه‌جایی ستون‌ها
  const first = calendarToDate(jy, jm, 1);
  // getDay: Sunday=0 ... Saturday=6 ; ستون ۰ = شنبه → (wd + 1) % 7
  return (first.getDay() + 1) % 7;
}
