"use client";

import { useCallback, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, Search, Bell, LogOut, KeyRound, Sparkles,
  DoorOpen, PanelRightClose, PanelRightOpen, Menu, X, UserRound, Settings, Printer,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { ROLE_LABELS } from "@/lib/roles";
import { faNumber, relativeTimeFa, formatDateFa } from "@/lib/persian";
import type { AvatarParams } from "@/lib/avatar";
import { NAV, NAV_GROUPS, navItemsFor, type NavItem } from "@/lib/nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserAvatar } from "@/components/shared/user-avatar";
import { OriginPop, springRubber } from "@/components/shared/motion";
import { LangProvider, useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ConfirmProvider } from "@/components/shared/pickers";
import { useCountry } from "@/lib/country/client";
import { AccessibilityProvider, SkipLink } from "@/lib/accessibility";

export type ShellUser = {
  id: string;
  nationalId: string;
  role: string;
  permissions: string[];
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  schoolName: string | null;
  actingSchoolId: string | null;
  langCode: string | null;
  profileImageType: "upload" | "avatar" | null;
  photoUrl: string | null;
  avatar: AvatarParams | null;
  /** راند ۱۸: ماژول‌های مدرسهٔ مؤثر — شاد/سرایدار قابل خاموش‌کردن برای هر مدرسه */
  schoolModules: { shadEnabled: boolean; custodianEnabled: boolean } | null;
};

/* ─── بافت کاربر پوسته — لانچر موبایلِ داشبورد هم به نقش/دسترسی/نشان‌ها دسترسی دارد ─── */
type ShellBadges = { unread: number; approvals: number; tickets: number };
const ShellUserContext = createContext<{ user: ShellUser; badges: ShellBadges } | null>(null);

/** دسترسی لانچر داشبورد (app-screen موبایل) به کاربر پوسته — نقش/دسترسی‌ها/نشان‌ها */
export function useShellUser(): { user: ShellUser; badges: ShellBadges } {
  const v = useContext(ShellUserContext);
  if (!v) throw new Error("useShellUser باید داخل AppShell استفاده شود");
  return v;
}

type SearchResults = Array<{ type: string; title: string; subtitle: string | null; href: string }>;
type NotifItem = { id: string; category: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  // فراهم‌کننده زبان — ترجیح کاربر (langCode) یا کوکی مرورگر
  // + ConfirmProvider: دیالوگ‌های تأیید/هشدار کاستوم (بدون alert/confirm مرورگر)
  return (
    <LangProvider initialCode={user.langCode}>
      <ConfirmProvider>
        <AccessibilityProvider><AppShellInner user={user}>{children}</AppShellInner></AccessibilityProvider>
      </ConfirmProvider>
    </LangProvider>
  );
}

/** تشخیص دسکتاپ برای رندر تک‌نسخه‌ای مرکز اعلان‌ها (جلوگیری از دو بار fetch) */
function useIsDesktop(): boolean {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return is;
}

function AppShellInner({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLang();
  const [unread, setUnread] = useState(0);
  const [mobileUnread, setMobileUnread] = useState(0);
  const [approvals, setApprovals] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [brand, setBrand] = useState<{ logoUrl: string; logotypeUrl: string }>({ logoUrl: "", logotypeUrl: "" });

  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const isDesktop = useIsDesktop();
  const { country } = useCountry();

  const inSchoolPanel = !!user.actingSchoolId;
  const isManagerish = user.role === "MANAGER" || (inSchoolPanel && ["SUPER_ADMIN", "ADMIN"].includes(user.role));

  /* راند ۱۸: شاد کاملاً اختیاری — فقط وقتی دیده می‌شود که هم
     بستهٔ کشور فعال ماژولش را روشن کرده باشد (ایران) و هم مدرسهٔ مؤثر */
  const shadVisible = country.modules.shad !== false && (user.schoolModules?.shadEnabled !== false);
  /* راند ۱۸: نقش سرایدار در این مدرسه غیرفعال شده است؟ */
  const custodianDisabled = user.role === "CUSTODIAN" && user.schoolModules?.custodianEnabled === false;

  // بارگذاری وضعیت جمع‌شده سایدبار
  useEffect(() => {
    const saved = localStorage.getItem("bahar-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);
  // هویت بصری سرویس (لوگو/لوگوتایپ سفارشی سوپرادمین)
  useEffect(() => {
    let alive = true;
    apiGet<{ logoUrl: string; logotypeUrl: string; siteTitle: string }>("/api/public/branding")
      .then((d) => { if (alive && d) setBrand({ logoUrl: d.logoUrl || "", logotypeUrl: d.logotypeUrl || "" }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    localStorage.setItem("bahar-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      apiGet<{ threads: Array<{ unread: number }> }>("/api/messages/threads")
        .then((d) => {
          if (alive) setUnread(d.threads.reduce((s, t) => s + t.unread, 0));
        })
        .catch(() => {});
      if (isManagerish) {
        apiGet<{ requests: unknown[] }>("/api/profile-requests?scope=inbox")
          .then((d) => {
            if (alive) setApprovals(d.requests.length);
          })
          .catch(() => {});
      }
      if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
        apiGet<{ tickets: Array<{ status: string }> }>("/api/tickets?scope=all")
          .then((d) => {
            if (alive) setTickets(d.tickets.filter((t) => t.status === "OPEN").length);
          })
          .catch(() => {});
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pathname, isManagerish, user.role]);

  const items = useMemo(
    () => navItemsFor(user.role, user.permissions, inSchoolPanel).filter(
      (n) => n.href !== "/app/shad" || shadVisible
    ),
    [user.role, user.permissions, inSchoolPanel, shadVisible]
  );

  /* گروه‌بندی ناوبری — سایدبار دسکتاپ و منوی همبرگری موبایل از همین منبع تغذیه می‌شوند */
  const groupedItems = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({ ...g, items: items.filter((n) => n.group === g.key) })).filter(
        (g) => g.items.length > 0
      ),
    [items]
  );

  // با هر جابه‌جایی بین صفحه‌ها، منوی موبایل بسته می‌شود
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // وقتی منوی موبایل باز است، اسکرول بدنه قفل می‌شود
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // عنوان بخش جاری — هدر موبایل صفحات داخلی (به‌جای منوی همبرگری حذف‌شده)
  const activeSection = useMemo(
    () => NAV.find((n) => (n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href))),
    [pathname]
  );

  /* ⌘K / Ctrl+K برای جستجوی سراسری */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    await apiPost("/api/auth/logout").catch(() => {});
    toast.success("خارج شدید؛ به امید دیدار!");
    router.replace("/login");
  }

  async function exitSchoolPanel() {
    setExiting(true);
    try {
      await apiPost(`/api/schools/${user.actingSchoolId}/enter`, { exit: true });
      toast.success("از پنل مدرسه خارج شدید.");
      router.replace("/app/schools");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setExiting(false);
    }
  }

  const badges = { unread, approvals, tickets };
  const avatarUser = {
    id: user.id, firstName: user.firstName, lastName: user.lastName,
    profileImageType: user.profileImageType, photoUrl: user.photoUrl, avatar: user.avatar,
  };

  /* ─── آیتم سایدبار با کپسول shared-layout ─── */
  const renderNavIcon = (n: NavItem, active: boolean) => {
    const badge = n.badgeKey ? badges[n.badgeKey] : 0;
    return (
      <>
        <n.icon className="w-[18px] h-[18px] shrink-0" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.14 }}
              className="flex-1 text-start truncate"
            >
              {n.tKey ? t(n.tKey) : n.label}
            </motion.span>
          )}
        </AnimatePresence>
        {badge > 0 && !collapsed && (
          <span className="b-badge b-badge-critical !px-2 !py-0.5 !text-[10.5px]">{faNumber(badge)}</span>
        )}
        {badge > 0 && collapsed && (
          <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-destructive" />
        )}
      </>
    );
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-2.5 h-16 shrink-0 border-b border-hairline-soft ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Link href="/app" className="flex items-center gap-2.5 min-w-0">
          <Image src={brand.logoUrl || "/logo.svg"} alt="بهار" width={30} height={30} className="shrink-0" />
          {!collapsed && (
            brand.logotypeUrl ? (
              <Image src={brand.logotypeUrl} alt="بهار" width={96} height={30} className="h-7 w-auto object-contain" />
            ) : (
              <span className="flex flex-col leading-none min-w-0">
                <span className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>بهار</span>
                <span className="text-[9.5px] text-steel truncate">{user.schoolName ?? "سرویس بهار"}</span>
              </span>
            )
          )}
        </Link>
      </div>

      <ScrollFade className={`py-4 flex flex-col gap-1 ${collapsed ? "px-2.5" : "px-3"}`} watch={[collapsed, items.length, pathname]}>
        {groupedItems.map((g, gi) => (
          <div key={g.key} className="flex flex-col gap-1">
            {collapsed ? (
              gi > 0 && <div className="mx-3 my-2 border-t border-hairline-soft" aria-hidden />
            ) : (
              <div
                className={`flex items-center gap-1.5 px-4 ${gi === 0 ? "pt-1 pb-1.5" : "pt-4 pb-1.5"}`}
                aria-hidden
              >
                <g.icon className="w-3.5 h-3.5 text-stone" />
                <span className="text-[10.5px] font-bold tracking-wide text-stone">{g.label}</span>
              </div>
            )}
            {g.items.map((n) => {
              const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={collapsed ? (n.tKey ? t(n.tKey) : n.label) : undefined}
                  className={`relative flex items-center gap-3 rounded-full ${collapsed ? "justify-center py-2.5 px-0" : "py-2.5 px-4"} text-[13.5px] font-bold z-[1] transition-colors duration-200 ${
                    active
                      ? "text-invert-foreground"
                      : "text-ink hover:bg-spring-tint dark:hover:bg-spring-tint hover:text-spring-deep"
                  }`}
                  style={{ isolation: "isolate" }}
                >
                  <AnimatePresence initial={false}>
                    {active && (
                      <motion.span
                        layoutId="sidebar-capsule"
                        className="absolute inset-0 rounded-full bg-invert"
                        transition={springRubber}
                        style={{ zIndex: -1 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      />
                    )}
                  </AnimatePresence>
                  {renderNavIcon(n, active)}
                </Link>
              );
            })}
          </div>
        ))}
      </ScrollFade>

      <div className={`p-3 border-t border-hairline-soft shrink-0 ${collapsed ? "px-2" : ""}`}>
        {inSchoolPanel && !collapsed && (
          <button
            onClick={exitSchoolPanel}
            disabled={exiting}
            className="b-promo b-promo-spring w-full mb-2 !justify-start"
            title="خروج از پنل مدرسه"
          >
            <DoorOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">پنل {user.schoolName}</span>
            <span className="ms-auto text-[10px] font-bold shrink-0">خروج</span>
          </button>
        )}
        {/* راند ۱۹: کارت کاربر دو ردیفه — قبلاً نام/نقش (min-w-0) بین آواتار و ردیف کنترل‌ها
            فشرده می‌شد و نام.setVisible=۰ می‌شد؛ خروج هم از سایدبار بیرون می‌زد.
            حالا: ردیف ۱ هویت (آواتار + نام + نقش)، ردیف ۲ تنظیمات سریع (زبان/تم/خروج).
            div های scale-90 حذف شدند — transform:scale روی والد، position:fixed پاپ‌آپ زبان را
            می‌شکست (containing-block) و پاپ‌آپ پایینِ صفحه رندر می‌شد. */}
        <div className={`b-card-sm !rounded-2xl p-3 flex flex-col ${collapsed ? "items-center" : "gap-2"}`}>
          <div className={`flex items-center gap-3 w-full ${collapsed ? "justify-center" : ""}`}>
            <UserAvatar user={avatarUser} size={40} />
            {!collapsed && (
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-[13px] font-bold truncate">{user.firstName} {user.lastName}</span>
                <span className="text-[11px] text-steel truncate">{ROLE_LABELS[user.role] ?? user.role}</span>
              </span>
            )}
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1 pt-2 border-t border-hairline-soft w-full">
              <LanguageSwitcher compact />
              <ThemeToggle />
              <button
                onClick={logout}
                className="ms-auto w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="خروج از حساب"
                aria-label="خروج"
              >
                <LogOut className="w-5 h-5 flip-rtl" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <ShellUserContext.Provider value={{ user, badges }}>
    <div className="min-h-screen bg-background flex flex-col">
      <SkipLink />
      {/* هدر موبایل — بدون همبرگر؛ ناوبری موبایل = لانچر app-screen داخل داشبورد */}
      <header className="lg:hidden sticky top-0 z-40 bg-background border-b border-hairline-soft flex items-center justify-between gap-1 px-3 h-16 no-print">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-ink hover:bg-spring-tint transition-colors shrink-0"
            aria-label="منوی بخش‌ها"
            title="منوی بخش‌ها"
          >
            <Menu className="w-5 h-5" />
          </button>
          {pathname === "/app" ? (
            <Link href="/app" className="flex items-center gap-2 min-w-0">
              <Image src={brand.logoUrl || "/logo.svg"} alt="بهار" width={28} height={28} className="shrink-0" />
              {brand.logotypeUrl ? (
                <Image src={brand.logotypeUrl} alt="بهار" width={88} height={28} className="h-6 w-auto object-contain" />
              ) : (
                <span className="font-bold text-lg truncate" style={{ fontFamily: "var(--font-heading)" }}>بهار</span>
              )}
            </Link>
          ) : (
            <>
              <Link
                href="/app"
                className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:text-spring hover:bg-spring-tint transition-colors shrink-0"
                aria-label="بازگشت به داشبورد"
                title="بازگشت به داشبورد"
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
              <span className="text-[14px] font-bold truncate" style={{ fontFamily: "var(--font-heading)" }}>
                {activeSection ? (activeSection.tKey ? t(activeSection.tKey) : activeSection.label) : "بهار"}
              </span>
            </>
          )}
          {/* راند ۱۸: چیپ «پنل مدرسه» در هدر موبایل — سوپرادمین/ادمین داخل پنل مدرسه، با خروج فوری */}
          {inSchoolPanel && (
            <button
              onClick={exitSchoolPanel}
              disabled={exiting}
              className="flex items-center gap-1 rounded-full bg-spring-tint text-spring-deep text-[10.5px] font-bold px-2 h-7 max-w-36 shrink-0 ms-1"
              title={`خروج از پنل ${user.schoolName ?? ""}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-spring animate-pulse shrink-0" />
              <span className="truncate">{user.schoolName}</span>
              <DoorOpen className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => window.print()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint transition-colors"
            aria-label="چاپ / خروجی PDF این صفحه"
            title="چاپ / خروجی PDF"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint transition-colors"
            aria-label="جستجو"
          >
            <Search className="w-5 h-5" />
          </button>
          <Link
            href="/app/profile"
            className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint transition-colors"
            aria-label="پروفایل"
            title="پروفایل"
          >
            <UserRound className="w-5 h-5" />
          </Link>
          {items.some((n) => n.href === "/app/settings") && (
            <Link
              href="/app/settings"
              className="w-10 h-10 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint transition-colors"
              aria-label="تنظیمات سامانه"
              title="تنظیمات سامانه"
            >
              <Settings className="w-5 h-5" />
            </Link>
          )}
          <ThemeToggle />
          <LanguageSwitcher compact />
          <span className="relative">
            {!isDesktop && (
              <NotificationCenter
                buttonRef={notifBtnRef}
                open={notifOpen}
                setOpen={setNotifOpen}
                onCount={setMobileUnread}
              />
            )}
            {mobileUnread > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blossom text-white text-[9.5px] font-bold flex items-center justify-center" aria-label={`${mobileUnread} اعلان خوانده‌نشده`}>
                {mobileUnread > 9 ? "۹+" : faNumber(mobileUnread)}
              </span>
            )}
          </span>
        </div>
      </header>

      {/* بنر تغییر رمز */}
      {custodianDisabled && (
        <div className="b-promo !bg-warning/10 !text-warning-deep no-print">
          <DoorOpen className="w-4 h-4 shrink-0" />
          <span className="truncate">نقش سرایدار در این مدرسه موقتاً غیرفعال شده است؛ برای فعال‌سازی با مدیر مدرسه تماس بگیرید.</span>
        </div>
      )}
      {user.mustChangePassword && (
        <div className="b-promo b-promo-spring no-print">
          <KeyRound className="w-4 h-4 shrink-0" />
          <span className="truncate">برای امنیت حساب، رمز عبور تصادفی اولیه را تغییر دهید.</span>
          <Link href="/app/profile?change=1" className="underline underline-offset-4 shrink-0 font-bold">
            تغییر رمز
          </Link>
        </div>
      )}

      <div className="flex-1 flex">
        {/* سایدبار دسکتاپ — جمع‌شونده با افکت rubber band */}
        <motion.aside
          className="hidden lg:block shrink-0 border-l border-hairline-soft bg-background sticky top-0 h-screen overflow-hidden no-print"
          animate={{ width: collapsed ? 76 : 248 }}
          transition={{ type: "spring", stiffness: 480, damping: 30, mass: 0.9 }}
          initial={false}
        >
          <div className="relative h-full" style={{ minWidth: collapsed ? 76 : 248 }}>
            {SidebarContent}
            {/* دکمه جمع‌کردن سایدبار — کنار لبه */}
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="absolute -left-3 top-20 z-10 w-6 h-6 rounded-full bg-card border border-hairline-soft shadow-sm flex items-center justify-center text-steel hover:text-spring hover:border-spring transition-colors"
              title={collapsed ? "بازکردن سایدبار" : "جمع‌کردن سایدبار"}
              aria-label={collapsed ? "بازکردن سایدبار" : "جمع‌کردن سایدبار"}
            >
              {collapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.aside>

        {/* محتوا — ستون عمودی: هدر دسکتاپ + صفحه */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* هدر دسکتاپ (راند ۱۸) — چیپ پنل مدرسه + جستجو + زنگ اعلان‌ها */}
          <header className="hidden lg:flex sticky top-0 z-40 h-14 shrink-0 items-center gap-2 px-6 bg-background border-b border-hairline-soft no-print">
            {inSchoolPanel && (
              <button
                onClick={exitSchoolPanel}
                disabled={exiting}
                className="b-promo b-promo-spring !min-h-0 !py-1.5 max-w-72"
                title="خروج از پنل مدرسه"
              >
                <DoorOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">پنل {user.schoolName}</span>
                <span className="ms-auto text-[10px] font-bold shrink-0">خروج</span>
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-9 px-3.5 rounded-full text-steel hover:text-foreground hover:bg-spring-tint transition-colors text-[13px]"
            >
              <Search className="w-4 h-4" />
              <span className="hidden xl:inline">جستجو در همه‌جا…</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-cloud text-steel border border-hairline font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 h-9 px-3.5 rounded-full text-steel hover:text-foreground hover:bg-spring-tint transition-colors text-[13px]"
              title="چاپ / خروجی PDF این صفحه"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden xl:inline">چاپ</span>
            </button>
            {isDesktop && (
              <NotificationCenter
                buttonRef={notifBtnRef}
                open={notifOpen}
                setOpen={setNotifOpen}
                onCount={setMobileUnread}
              />
            )}
          </header>
          <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 pb-10 lg:pb-8 w-full">
            <div className="max-w-6xl mx-auto b-page-in" key={pathname}>
              {/* سربرگ رسمی چاپ — فقط روی کاغذ/PDF دیده می‌شود */}
              <div className="print-only b-print-head" aria-hidden>
                <div>
                  <div className="ph-school">{user.schoolName ?? "سامانه مدیریت مدرسه بهار"}</div>
                  <div className="ph-title">
                    {pathname === "/app" ? "داشبورد" : activeSection ? (activeSection.tKey ? t(activeSection.tKey) : activeSection.label) : "گزارش"}
                    {" · "}{user.firstName} {user.lastName}
                  </div>
                </div>
                <div className="ph-date">تاریخ چاپ: {formatDateFa(new Date())}</div>
              </div>
              {children}
              <div className="print-only b-print-foot" aria-hidden>
                این گزارش به‌صورت خودکار از سامانه مدیریت مدرسه بهار تولید شده است · bahar
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* منوی همبرگری موبایل — دسته‌بندی‌شده، جایگزین لانچر مربعی داشبورد */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: "106%" }}
              animate={{ x: 0 }}
              exit={{ x: "106%" }}
              transition={springRubber}
              className="fixed inset-y-0 start-0 z-50 w-[86vw] max-w-[340px] bg-background shadow-2xl flex flex-col lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="منوی بخش‌های بهار"
            >
              <div className="flex items-center gap-2.5 h-16 px-4 border-b border-hairline-soft shrink-0">
                <Image src={brand.logoUrl || "/logo.svg"} alt="بهار" width={28} height={28} className="shrink-0" />
                <span className="font-bold text-[17px] flex-1 truncate" style={{ fontFamily: "var(--font-heading)" }}>
                  بهار
                </span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint transition-colors shrink-0"
                  aria-label="بستن منو"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto b-scroll px-3 py-3">
                {groupedItems.map((g) => (
                  <div key={g.key} className="mb-4">
                    <div className="flex items-center gap-1.5 px-2 pt-1 pb-2" aria-hidden>
                      <g.icon className="w-3.5 h-3.5 text-stone" />
                      <span className="text-[11px] font-bold tracking-wide text-stone">{g.label}</span>
                      <span className="text-[10px] text-stone/70">({faNumber(g.items.length)})</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {g.items.map((n) => {
                        const active = n.href === "/app" ? pathname === "/app" : pathname.startsWith(n.href);
                        const badge = n.badgeKey ? badges[n.badgeKey] : 0;
                        return (
                          <Link
                            key={n.href}
                            href={n.href}
                            onClick={() => setMobileNavOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 text-[13.5px] font-bold transition-colors ${
                              active
                                ? "bg-spring-tint text-spring-deep"
                                : "text-ink hover:bg-spring-tint/60"
                            }`}
                          >
                            <n.icon className={`w-5 h-5 shrink-0 ${active ? "text-spring-deep" : "text-steel"}`} />
                            <span className="flex-1 truncate">{n.tKey ? t(n.tKey) : n.label}</span>
                            {badge > 0 && (
                              <span className="b-badge b-badge-critical !px-2 !py-0.5 !text-[10.5px]">{faNumber(badge)}</span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-hairline-soft shrink-0">
                <div className="b-card-sm !rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3 w-full">
                    <UserAvatar user={avatarUser} size={40} />
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-bold truncate">{user.firstName} {user.lastName}</span>
                      <span className="text-[11px] text-steel truncate">{ROLE_LABELS[user.role] ?? user.role}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-hairline-soft w-full">
                    <LanguageSwitcher compact />
                    <ThemeToggle />
                    <button
                      onClick={logout}
                      className="ms-auto w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="خروج از حساب"
                      aria-label="خروج"
                    >
                      <LogOut className="w-5 h-5 flip-rtl" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* جستجوی سراسری (⌘K) */}
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
    </ShellUserContext.Provider>
  );
}

/* ============================================================
   ScrollFade — قاب اسکرول با محوشدگی تدریجی بالا/پایین (سایدبار)
   گرادیان‌ها فقط وقتی ظاهر می‌شوند که محتوا در آن سمت ادامه دارد.
   ============================================================ */
function ScrollFade({
  className = "",
  children,
  watch = [],
}: {
  className?: string;
  children: React.ReactNode;
  watch?: React.DependencyList;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 10);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 10);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
    // پس از تغییر چیدمان (جمع‌شدن سایدبار / تغییر فهرست) دوباره بسنج
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...watch]);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={ref} onScroll={update} className={`h-full overflow-y-auto b-scroll ${className}`}>
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute top-0 inset-x-0 h-7 transition-opacity duration-300 ${fadeTop ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: "linear-gradient(to bottom, var(--background), transparent)" }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute bottom-0 inset-x-0 h-7 transition-opacity duration-300 ${fadeBottom ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundImage: "linear-gradient(to top, var(--background), transparent)" }}
      />
    </div>
  );
}

/* ============================================================
   مرکز اعلان‌ها — دسته‌بندی بر اساس اهمیت
   ============================================================ */
function NotificationCenter({
  buttonRef,
  open,
  setOpen,
  onCount,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  setOpen: (v: boolean) => void;
  onCount: (n: number) => void;
}) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({ URGENT: 0, IMPORTANT: 0, INFO: 0, SUCCESS: 0 });
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet<{ notifications: NotifItem[]; counts: Record<string, number>; unreadTotal: number }>(
        `/api/notifications${filter ? `?category=${filter}` : ""}`
      );
      setItems(d.notifications);
      setCounts(d.counts);
      onCount(d.unreadTotal);
    } catch { /* خالی */ } finally {
      setLoading(false);
    }
  }, [filter, onCount]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // periodic refresh
  useEffect(() => {
    const id = setInterval(() => { load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const CATS: Array<{ key: string; label: string; dot: string }> = [
    { key: "URGENT", label: "فوری", dot: "bg-destructive" },
    { key: "IMPORTANT", label: "مهم", dot: "bg-warning" },
    { key: "INFO", label: "اطلاع", dot: "bg-info" },
    { key: "SUCCESS", label: "موفق", dot: "bg-success" },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-steel hover:text-spring hover:bg-spring-tint transition-colors"
        aria-label="اعلان‌ها"
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springRubber}
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center"
          >
            {faNumber(total)}
          </motion.span>
        )}
      </button>
      <OriginPop
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        align="end"
        width={340}
        className="!rounded-[28px] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-hairline-soft">
          <span className="font-bold text-[15px]" style={{ fontFamily: "var(--font-heading)" }}>اعلان‌ها</span>
          <button
            onClick={async () => {
              await apiPost("/api/notifications", { all: true }).catch(() => {});
              load();
            }}
            className="text-[11.5px] font-bold text-spring-deep hover:underline"
          >
            خواندن همه
          </button>
        </div>
        <div className="flex gap-1.5 px-3 py-2.5 border-b border-hairline-soft overflow-x-auto b-scroll">
          <button
            onClick={() => setFilter(null)}
            className={`b-pill-tab !text-[11px] !py-1 !px-3 ${!filter ? "b-pill-tab-active" : ""}`}
          >
            همه
          </button>
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`b-pill-tab !text-[11px] !py-1 !px-3 ${filter === c.key ? "b-pill-tab-active" : ""}`}
            >
              <span className={`b-dot ${c.dot}`} />
              {c.label}
              {counts[c.key] > 0 && <span className="opacity-70">({faNumber(counts[c.key])})</span>}
            </button>
          ))}
        </div>
        <div className="max-h-[46vh] overflow-y-auto b-scroll">
          {loading && items.length === 0 && (
            <div className="p-4 space-y-2">
              <div className="h-14 rounded-2xl b-shimmer" />
              <div className="h-14 rounded-2xl b-shimmer" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="py-10 text-center text-steel text-[13px]">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              اعلانی نیست
            </div>
          )}
          {items.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "/app"}
              onClick={async () => {
                setOpen(false);
                if (!n.readAt) {
                  await apiPost("/api/notifications", { id: n.id }).catch(() => {});
                }
              }}
              className={`flex gap-3 px-4 py-3 border-b border-hairline-soft/60 hover:bg-spring-tint/50 transition-colors ${!n.readAt ? "bg-spring-tint/30" : ""}`}
            >
              <span className={`b-dot mt-1.5 shrink-0 cat-${n.category}`} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[12.5px] font-bold truncate">{n.title}</span>
                  {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-spring shrink-0" />}
                </span>
                <span className="block text-[11.5px] text-steel line-clamp-2 leading-relaxed">{n.body}</span>
                <span className="block text-[10px] text-stone mt-0.5">{relativeTimeFa(n.createdAt)}</span>
              </span>
            </Link>
          ))}
        </div>
      </OriginPop>
    </>
  );
}

/* ============================================================
   جستجوی سراسری — پالت ⌘K با origin-aware ورود
   ============================================================ */
function UniversalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const d = await apiGet<{ results: SearchResults }>(`/api/search?q=${encodeURIComponent(q.trim())}`);
        setResults(d.results);
      } catch { /* خالی */ } finally {
        setLoading(false);
      }
    }, 240);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-ink-deep/45"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={springRubber}
            style={{ transformOrigin: "top center" }}
            className="w-full max-w-xl b-card !rounded-[28px] overflow-hidden elev-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="جستجوی سراسری"
          >
            <div className="flex items-center gap-3 px-5 h-16 border-b border-hairline-soft">
              <Search className="w-5 h-5 text-steel shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجو در همه‌جا… (دانش‌آموز، کلاس، درس، رویداد)"
                className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-stone"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-cloud text-steel border border-hairline font-mono">Esc</kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto b-scroll">
              {loading && (
                <div className="p-4 space-y-2">
                  <div className="h-12 rounded-2xl b-shimmer" />
                  <div className="h-12 rounded-2xl b-shimmer" />
                </div>
              )}
              {!loading && q.trim().length >= 2 && results.length === 0 && (
                <div className="py-10 text-center text-steel text-[13px]">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  نتیجه‌ای پیدا نشد
                </div>
              )}
              {results.map((r, i) => (
                <motion.button
                  key={`${r.href}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  onClick={() => {
                    onClose();
                    router.push(r.href);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-spring-tint/60 transition-colors text-start"
                >
                  <span className="b-badge b-badge-spring shrink-0">{r.type}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-bold truncate">{r.title}</span>
                    {r.subtitle && <span className="block text-[11.5px] text-steel truncate">{r.subtitle}</span>}
                  </span>
                </motion.button>
              ))}
              {q.trim().length < 2 && (
                <div className="p-6 text-center text-steel text-[12.5px]">
                  حداقل ۲ حرف بنویسید — دانش‌آموز، کلاس، درس، کاربر، رویداد، اعلان و بلاگ جستجو می‌شوند
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
