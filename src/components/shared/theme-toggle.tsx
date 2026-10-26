"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/** الگوی hydration-safe بدون setState داخل effect (قانون جدید react-hooks) */
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * بهار | دکمه تغییر تم — فقط روشن ⇄ تاریک (cross-fade + چرخش نرم)
 * تم پیش‌فرض «سیستم» است (خودکار)؛ این دکمه override می‌کند.
 */
export function ThemeToggle({ size = "sm" }: { size?: "sm" | "md" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";
  const dim = size === "sm" ? "w-[18px] h-[18px]" : "w-5 h-5";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "تم تاریک — کلیک برای روشن" : "تم روشن — کلیک برای تاریک"}
      aria-label={isDark ? "تغییر به تم روشن" : "تغییر به تم تاریک"}
      className={
        size === "sm"
          ? "w-10 h-10 rounded-full flex items-center justify-center text-steel hover:text-spring hover:bg-spring-tint dark:hover:bg-spring-tint transition-colors cursor-pointer"
          : "b-btn b-btn-ghost b-btn-sm"
      }
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex"
        >
          {isDark ? <Moon className={dim} /> : <Sun className={dim} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** نمایش وضعیت واقعی تم */
export function ResolvedThemeDot() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  if (!mounted) return null;
  return (
    <span
      className="b-dot"
      style={{ background: "var(--spring)" }}
      aria-hidden
    />
  );
}
