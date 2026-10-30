"use client";
// بهار | انتخاب‌گر زبان — فارسی + بسته‌های زبان فعال
// FIX (راند ۱۸): پاپ‌آپ قبلی با bottom-full بالای دکمه (خارج از صفحه) و بدون
// لنگر افقی باز می‌شد. حالا با OriginPop پایینِ دکمه و مهارشده به صفحه باز می‌شود.
import { useEffect, useRef, useState } from "react";
import { Languages, Check, Loader2, ChevronDown, PlusCircle } from "lucide-react";
import { switchLanguage } from "@/lib/i18n";
import { OriginPop } from "@/components/shared/motion";

interface LangOption {
  code: string;
  name: string;
  nativeName: string;
  direction?: string;
}

export function LanguageSwitcher({ compact = false, restricted = false }: { compact?: boolean; restricted?: boolean }) {
  const [options, setOptions] = useState<LangOption[]>([{ code: "fa", name: "فارسی", nativeName: "فارسی" }]);
  const [current, setCurrent] = useState<string>("fa");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCurrent(document.cookie.match(/(?:^|;\s*)bahar_lang=([^;]+)/)?.[1] || "fa");
    // فهرست زبان‌های فعال — GET عمومی است تا صفحه ورود هم همه زبان‌ها را ببیند
    fetch("/api/languages")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.selectable?.length) {
          setOptions([{ code: "fa", name: "فارسی", nativeName: "فارسی" }, ...d.selectable]);
        }
      })
      .catch(() => {});
  }, []);

  async function pick(code: string) {
    if (code === current || busy) return;
    setBusy(true);
    try {
      await switchLanguage(code);
      window.location.reload();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  const browserCode = typeof navigator !== "undefined" ? (navigator.language || "").split("-")[0].toLowerCase() : "fa";
  // هدر داشبورد: فقط فارسی + انگلیسی + زبان مرورگر (اگر بسته‌اش موجود باشد)
  const shownOptions = restricted
    ? (["fa", "en", browserCode] as const)
        .map((code) => options.find((o) => o.code === code))
        .filter((o): o is LangOption => Boolean(o))
        .filter((o, i, arr) => arr.findIndex((x) => x.code === o.code) === i)
    : options;
  const currentOption = options.find((o) => o.code === current) ?? options[0];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-9 text-[14px] text-steel hover:text-foreground hover:bg-forest/10 dark:hover:bg-forest/20 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="زبان / Language"
      >
        <Languages className="w-4 h-4 shrink-0" />
        {!compact && <span className="truncate max-w-24">{currentOption?.nativeName || "فارسی"}</span>}
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-stone transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
      </button>
      <OriginPop
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="start"
        width={220}
        className="!rounded-2xl p-1.5"
      >
        <div role="listbox" aria-label="انتخاب زبان">
          {shownOptions.map((o) => (
            <button
              key={o.code}
              role="option"
              aria-selected={o.code === current}
              onClick={() => pick(o.code)}
              className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[14px] text-popover-foreground hover:bg-forest/10 dark:hover:bg-forest/20 transition-colors text-start"
            >
              <span className="flex flex-col items-start leading-tight min-w-0">
                <span className="truncate">{o.nativeName}</span>
                <span className="text-[12px] text-stone truncate">
                  {o.name}
                  {o.direction === "ltr" ? " · LTR" : ""}
                </span>
              </span>
              {o.code === current && <Check className="w-4 h-4 text-spring shrink-0" />}
            </button>
          ))}
          <a
            href={restricted ? "/app/settings?tab=languages" : "/languages"}
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] text-steel hover:text-spring hover:bg-forest/5 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            {restricted ? "زبان‌های بیشتر در تنظیمات" : "ساخت زبان جدید / Language kit ↗"}
          </a>
        </div>
      </OriginPop>
    </>
  );
}
