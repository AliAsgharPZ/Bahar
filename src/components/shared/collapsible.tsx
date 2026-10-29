"use client";
// بهار | بخش کشویی — اول فقط تیتر دیده می‌شود، با کلیک باز می‌شود
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="b-card-sm !rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 min-h-[44px] text-[13px] font-bold hover:bg-forest/5 dark:hover:bg-forest/10 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-stone transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 flex flex-col gap-4">{children}</div>}
    </div>
  );
}
