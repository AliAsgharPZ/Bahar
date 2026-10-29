"use client";

/* ============================================================
   بهار | لانچر موبایل — app-screen اندرویدی دسته‌بندی‌شده (راند ۱۸)
   هر گروه = یک ردیف افقی اسکرول‌شونده با scroll-fade و دکمه
   «نمایش همه» که همان گروه را به گرید کامل باز می‌کند.
   جای لانچر: بعد از بخش نمودارهای داشبورد.
   ============================================================ */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { navItemsFor, NAV_GROUPS, type NavItem, type NavGroupKey } from "@/lib/nav";
import { useShellUser } from "./app-shell";
import { useLang } from "@/lib/i18n";
import { useCountry } from "@/lib/country/client";
import { faNumber } from "@/lib/persian";
import { LayoutGrid, ChevronsUpDown } from "lucide-react";

/** چرخه رنگ آیکون‌ها — شبیه adaptive icon های اندروید */
const TINTS = [
  { bg: "bg-spring-tint", fg: "text-spring-deep" },
  { bg: "bg-blossom-tint", fg: "text-blossom" },
  { bg: "bg-warning/15", fg: "text-warning-deep" },
  { bg: "bg-cloud", fg: "text-ink" },
];

export function AppLauncher() {
  const pathname = usePathname();
  const { user, badges } = useShellUser();
  const { t } = useLang();
  const { country } = useCountry();
  // راند ۱۸: شاد فقط برای بستهٔ کشور فعال + مدرسهٔ روشن‌کرنده نمایش داده می‌شود
  const shadVisible = country.modules.shad !== false && (user.schoolModules?.shadEnabled !== false);
  const items = navItemsFor(user.role, user.permissions, !!user.actingSchoolId).filter(
    (n) => n.href !== "/app/shad" || shadVisible
  );
  /** گروهی که با «نمایش همه» به گرید کامل باز شده */
  const [expanded, setExpanded] = useState<NavGroupKey | null>(null);

  // گروه‌ها به ترتیب تعریف NAV_GROUPS — فقط گروه‌های دارای آیتم
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: items.filter((n) => n.group === g.key) }))
    .filter((g) => g.items.length > 0);

  if (items.length === 0) return null;

  return (
    <section className="lg:hidden" aria-label="بخش‌های بهار">
      <div className="flex items-center gap-2 mb-4 px-0.5">
        <LayoutGrid className="w-4 h-4 text-spring shrink-0" />
        <h2 className="text-[16px] font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          بخش‌های بهار
        </h2>
        <span className="b-badge b-badge-neutral !text-[12px] !px-2 !py-0.5">{faNumber(items.length)}</span>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => {
          const isOpen = expanded === g.key;
          return (
            <div key={g.key}>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <h3 className="text-[14px] font-bold flex items-center gap-1.5">
                  <g.icon className="w-3.5 h-3.5 text-spring" />
                  {g.label}
                  <span className="text-[12px] text-stone font-normal">({faNumber(g.items.length)})</span>
                </h3>
                {g.items.length > 4 && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : g.key)}
                    className="flex items-center gap-1 text-[12px] font-bold text-spring-deep rounded-full px-2 py-0.5 hover:bg-spring-tint transition-colors"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? "نمایش کمتر" : "نمایش همه"}
                    <ChevronsUpDown className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isOpen ? (
                /* حالت باز — گرید کامل همان گروه */
                <div className="grid grid-cols-4 gap-x-1 gap-y-3.5">
                  {g.items.map((n, i) => (
                    <LauncherItem key={n.href} n={n} i={i} pathname={pathname} badges={badges} t={t} />
                  ))}
                </div>
              ) : (
                /* حالت پیش‌فرض — ردیف افقی اسکرول‌شونده با محوشدگی لبه‌ها */
                <HScrollRow>
                  {g.items.map((n, i) => (
                    <LauncherItem key={n.href} n={n} i={i} pathname={pathname} badges={badges} t={t} fixed />
                  ))}
                </HScrollRow>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── یک آیتم لانچر (squircle رنگی + برچسب) ─── */
function LauncherItem({
  n,
  i,
  pathname,
  badges,
  t,
  fixed,
}: {
  n: NavItem;
  i: number;
  pathname: string;
  badges: { unread: number; approvals: number; tickets: number };
  t: (k: string) => string;
  fixed?: boolean;
}) {
  const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
  const badge = n.badgeKey ? badges[n.badgeKey] : 0;
  const tint = TINTS[(n.tint ?? i) % 4];
  const Icon = n.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.028, 0.7), type: "spring", stiffness: 460, damping: 26, mass: 0.85 }}
      className={fixed ? "shrink-0 w-[74px]" : ""}
    >
      <Link
        href={n.href}
        aria-current={active ? "page" : undefined}
        className="group flex flex-col items-center gap-1.5 select-none"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span className="relative">
          <span
            className={`w-[54px] h-[54px] rounded-[17px] flex items-center justify-center transition-all duration-200 group-active:scale-88 group-active:rounded-[13px] ${tint.bg} ${
              active ? "ring-2 ring-spring ring-offset-2 ring-offset-background" : "elev-1"
            }`}
          >
            <Icon className={`w-[25px] h-[25px] ${tint.fg}`} strokeWidth={2.1} />
          </span>
          {badge > 0 && (
            <span className="absolute -top-1.5 -start-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[12px] font-bold flex items-center justify-center border-2 border-background">
              {badge > 99 ? "۹۹+" : faNumber(badge)}
            </span>
          )}
        </span>
        <span className="text-[12px] font-bold text-ink text-center leading-[1.35] line-clamp-2 w-full px-0.5 [word-break:break-word]">
          {n.tKey ? t(n.tKey) : n.label}
        </span>
      </Link>
    </motion.div>
  );
}

/* ─── ردیف اسکرول افقی + محوشدگی دو لبه (فقط وقتی محتوا ادامه دارد) ─── */
function HScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeStart, setFadeStart] = useState(false);
  const [fadeEnd, setFadeEnd] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // RTL و LTR یکسان: scrollLeft=۰ یعنی ابتدای محتوا
    const sl = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth;
    setFadeStart(Math.abs(sl) > 8);
    setFadeEnd(max > 8 && Math.abs(Math.abs(sl) - max) > 8);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={update}
        className="flex gap-1 overflow-x-auto no-scrollbar snap-x snap-mandatory [scroll-padding-inline-start:4px] pb-1"
      >
        {children}
      </div>
      {/* محوشدگی ابتدای ردیف (سمت راست در RTL) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 start-0 w-8 transition-opacity duration-300 ${fadeStart ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: "linear-gradient(to left, var(--background), transparent)" }}
      />
      {/* محوشدگی انتهای ردیف (سمت چپ در RTL) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 end-0 w-8 transition-opacity duration-300 ${fadeEnd ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: "linear-gradient(to right, var(--background), transparent)" }}
      />
    </div>
  );
}
