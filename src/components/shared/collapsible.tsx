"use client";
// بهار | بخش کشویی — اول فقط تیتر دیده می‌شود، با کلیک و انیمیشن ارتفاع باز می‌شود
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;
    const measure = () => setHeight(innerRef.current?.scrollHeight ?? 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div className="b-card-sm !rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 min-h-[44px] text-[14px] font-bold hover:bg-forest/5 dark:hover:bg-forest/10 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-stone transition-transform duration-300 ease-in-out ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        style={{ maxHeight: open ? `${height}px` : "0px", opacity: open ? 1 : 0 }}
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
      >
        <div ref={innerRef} className="px-3 pb-3 pt-1 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}
