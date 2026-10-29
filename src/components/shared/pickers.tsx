"use client";

/* ============================================================
   بهار | انتخاب‌گرهای کاستوم — جایگزین کامل پاپ‌آپ‌های مرورگر
   Select: لیست‌باکس پاپ‌آپ (به‌جای <select> بومی)
   ConfirmProvider/useConfirm: دیالوگ تأیید/هشدار (به‌جای confirm/alert)
   هیچ پاپ‌آپ بومی مرورگر استفاده نمی‌شود — همه سفارشی‌اند.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search, AlertTriangle, Info } from "lucide-react";
import { OriginPop } from "./motion";

/* ────────────────────────────────────────────
   Select — لیست‌باکس سفارشی با لنگرِ OriginPop
   ──────────────────────────────────────────── */
export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean };

export function Select({
  value,
  onChange,
  options,
  placeholder = "انتخاب کنید…",
  className = "",
  buttonClassName = "",
  searchable,
  disabled,
  emptyLabel = "گزینه‌ای نیست",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** کلاس اضافه‌ی قاب بیرونی (عرض و…) */
  className?: string;
  /** کلاس اضافه‌ی دکمه‌یトリگر (ارتفاع و…) */
  buttonClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [popWidth, setPopWidth] = useState(220);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length > 9;

  const filtered = useMemo(() => {
    if (!q.trim()) return options;
    const needle = q.trim();
    return options.filter(
      (o) => o.label.includes(needle) || o.value.includes(needle) || (o.hint ?? "").includes(needle)
    );
  }, [options, q]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
  }, [open]);

  return (
    <div className={`relative inline-flex min-w-0 ${className}`} dir="rtl">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setQ("");
            // عرض پاپ‌آپ = عرض دکمه‌ی تریگر (خواندن ref فقط در هندلر رویداد)
            setPopWidth(Math.max(200, btnRef.current?.offsetWidth ?? 220));
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label ?? placeholder}` : undefined}
        className={`b-input !px-3.5 flex items-center justify-between gap-2 text-start cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName} ${
          open ? "!border-spring" : ""
        }`}
      >
        <span className={`truncate ${selected ? "" : "text-stone"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-steel transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <OriginPop
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        align="start"
        width={popWidth}
        className="!rounded-2xl p-1.5 overflow-hidden"
      >
        {showSearch && (
          <div className="flex items-center gap-2 px-2.5 pb-1.5 mb-1 border-b border-hairline-soft">
            <Search className="w-3.5 h-3.5 text-stone shrink-0" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو…"
              className="flex-1 bg-transparent outline-none text-[13px] py-1.5 placeholder:text-stone min-w-0"
            />
          </div>
        )}
        <div className="max-h-[280px] overflow-y-auto b-scroll" role="listbox">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-[12px] text-steel text-center">{emptyLabel}</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              disabled={o.disabled}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-start transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                o.value === value
                  ? "bg-spring-tint text-spring-deep font-bold"
                  : "text-ink hover:bg-forest/5 dark:hover:bg-forest/15"
              }`}
            >
              <span className="flex-1 min-w-0 truncate">{o.label}</span>
              {o.hint && <span className="text-[10.5px] text-stone shrink-0">{o.hint}</span>}
              {o.value === value && <Check className="w-4 h-4 shrink-0" />}
            </button>
          ))}
        </div>
      </OriginPop>
    </div>
  );
}

/* ────────────────────────────────────────────
   ConfirmProvider + useConfirm — دیالوگ کاستوم
   جایگزین window.confirm / window.alert
   ──────────────────────────────────────────── */
type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** حالت هشدار: فقط دکمه تأیید دارد (جایگزین alert) */
  alert?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm باید داخل ConfirmProvider استفاده شود");
  return fn;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { id: number; resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setState((prev) => {
        // اگر دیالوگ باز است، قبلی را لغو کن
        prev?.resolve(false);
        return { ...opts, id: Date.now(), resolve };
      });
    });
  }, []);

  const settle = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const Icon = state?.danger ? AlertTriangle : Info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-ink-deep/45"
            onClick={() => !state.alert && settle(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 480, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-label={state.title}
              className="w-full max-w-sm b-card !rounded-[24px] p-5 elev-3"
            >
              <div className="flex items-start gap-3.5">
                <span
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    state.danger ? "bg-destructive/10 text-destructive" : "bg-spring-tint text-spring-deep"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-[14.5px] font-bold leading-snug">{state.title}</h3>
                  {state.description && (
                    <div className="text-[12.5px] text-steel mt-1 leading-relaxed">{state.description}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end mt-5">
                {!state.alert && (
                  <button type="button" className="b-btn b-btn-ghost !min-h-[40px]" onClick={() => settle(false)}>
                    {state.cancelLabel ?? "انصراف"}
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  className={`b-btn !min-h-[40px] ${state.danger ? "b-btn-destructive" : "b-btn-spring"}`}
                  onClick={() => settle(true)}
                >
                  {state.confirmLabel ?? (state.alert ? "متوجه شدم" : "تأیید")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
