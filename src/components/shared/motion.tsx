"use client";

/* ============================================================
   بهار | Motion Library
   Capsule shared-layout pills, origin-aware pop-ins, stagger,
   cross-fade, rubber-band — powered by framer-motion
   following M3 motion principles + emilkowalski-style micro-UX.
   ============================================================ */

import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* M3-style spring — overshoot for playful settle (rubber band) */
export const springRubber: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 32,
  mass: 0.9,
};
/* M3 emphasized spring — no overshoot, confident */
export const springSnap: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 38,
  mass: 0.8,
};

/* ------------------------------------------------------------
   OriginPop — origin-aware pop-in container for dropdowns/menus.
   content pops out FROM the trigger direction (scale + fade),
   exactly like M3 menus / emilkowalski vaul-style sheets.
   ------------------------------------------------------------ */
export function OriginPop({
  open,
  onClose,
  anchorRef,
  children,
  align = "start",
  width,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "start" | "end" | "center";
  width?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right?: number; left?: number; w: number; maxH?: number } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    let cancelled = false;
    const compute = () => {
    if (cancelled) return;
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    // FIX (راند ۱۸): عرض مهارشده به صفحه — روی موبایل‌های باریک از صفحه بیرون نمی‌زند
    const w = Math.max(180, Math.min(width ?? Math.max(rect.width, 200), window.innerWidth - 16));
    let left: number | undefined;
    let right: number | undefined;
    if (align === "end") {
      // FIX (راند ۱۸): قبلاً همیشه به لبه فیزیکی راست می‌چسبید و از دکمه دور می‌افتاد.
      // حالا اول از لبه منطقیِ «پایان» لنگر می‌گیرد؛ اگر جا نبود طرف مقابل، و در آخر مهار به صفحه.
      right = window.innerWidth - rect.right;
      if (right + w > window.innerWidth - 8) {
        right = undefined;
        left = rect.left;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      }
    } else if (align === "center") {
      left = rect.left + rect.width / 2 - w / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    } else {
      left = rect.left;
      if (left + w > window.innerWidth - 8) {
        left = undefined;
        right = window.innerWidth - rect.right;
        if (right + w > window.innerWidth - 8) right = 8;
      }
    }
    if (left !== undefined && left < 8) left = 8;
    if (right !== undefined && right < 8) right = 8;
    // FIX (راند ۱۹): بازشدن رو-به-بالا — قبلاً با «ارتفاع تخمینی ۷۰٪ صفحه» حدس می‌زد و
    // پاپ‌آپ با فاصلهٔ معلق دور از دکمه رندر می‌شد. حالا با CSS bottom دقیقاً لنگر می‌شود
    // (لبهٔ پایین پاپ‌آپ بالای دکمه) و maxHeight فضای موجود را مهار می‌کند (اسکرول داخلی).
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let top: number | undefined;
    let bottom: number | undefined;
    let maxH: number | undefined;
    if (spaceBelow >= 140) {
      top = rect.bottom + margin;
      maxH = Math.max(160, Math.floor(spaceBelow - margin));
    } else if (spaceAbove >= 140) {
      bottom = window.innerHeight - rect.top + margin;
      maxH = Math.max(160, Math.floor(spaceAbove - margin));
    } else if (spaceBelow >= spaceAbove) {
      top = rect.bottom + margin;
      maxH = Math.max(120, Math.floor(spaceBelow - margin));
    } else {
      bottom = window.innerHeight - rect.top + margin;
      maxH = Math.max(120, Math.floor(spaceAbove - margin));
    }
    // مهار نهایی: اگر لنگر بین کلیک و rAF از viewport خارج شده باشد (اسکرول/کیبورد موبایل)،
    // پاپ‌آپ هرگز بیرون از صفحه نمی‌رود — به لبهٔ viewport چسبیده و قابل دسترس می‌ماند.
    if (top !== undefined) top = Math.max(8, Math.min(top, window.innerHeight - 120));
    if (bottom !== undefined) bottom = Math.max(8, Math.min(bottom, window.innerHeight - 120));
    setPos({ top, bottom, left, right, w, maxH });
    };
    const id = requestAnimationFrame(compute);
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [open, anchorRef, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          ref={ref}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
          transition={springRubber}
          style={{
            position: "fixed",
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            right: pos.right,
            width: pos.w,
            maxHeight: pos.maxH,
            overflowY: pos.maxH !== undefined ? "auto" : undefined,
            transformOrigin: pos.bottom !== undefined
              ? pos.right !== undefined ? "bottom right" : pos.left !== undefined ? "bottom left" : "bottom center"
              : pos.right !== undefined ? "top right" : pos.left !== undefined ? "top left" : "top center",
          }}
          className={`z-[70] rounded-3xl border border-hairline-soft bg-popover shadow-2xl ${className}`}
          role="menu"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------
   StaggerGroup + StaggerItem — cascading entrance
   ------------------------------------------------------------ */
export function StaggerGroup({
  children,
  className = "",
  delay = 0,
  step = 45,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  step?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step / 1000, delayChildren: delay / 1000 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  y = 14,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.05, 0.7, 0.1, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------
   CrossFade — content swap with fade (buttons, tab labels)
   ------------------------------------------------------------ */
export function CrossFade<T extends string>({
  value,
  items,
  className = "",
}: {
  value: T;
  items: Record<T, ReactNode>;
  className?: string;
}) {
  return (
    <span className={`relative inline-grid ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, filter: "blur(3px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(3px)", position: "absolute" }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
        >
          {items[value]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------
   RubberBox — rubber-band scale wrapper (drag/snap feel)
   ------------------------------------------------------------ */
export function RubberBox({
  children,
  className = "",
  from = 1,
  to = 0.97,
}: {
  children: ReactNode;
  className?: string;
  from?: number;
  to?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { scale: to === 0.97 ? 1.015 : to }}
      whileTap={reduce ? undefined : { scale: to }}
      transition={springRubber}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------
   CountUp — animated number counter for dashboards
   ------------------------------------------------------------ */
export function CountUp({
  value,
  format,
  duration = 0.9,
  className = "",
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) { const id = requestAnimationFrame(() => setDisplay(value)); return () => cancelAnimationFrame(id); }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);
  return <span className={className}>{format ? format(display) : Math.round(display).toLocaleString("fa-IR")}</span>;
}

/* ------------------------------------------------------------
   PageTransition — route content fade/slide (app main)
   ------------------------------------------------------------ */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------
   Toast-like in-page celebration (badge award etc.)
   ------------------------------------------------------------ */
export function CelebrationPop({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 20 }}
          animate={{ scale: [0.6, 1.12, 1], opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
