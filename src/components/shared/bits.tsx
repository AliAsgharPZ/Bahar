"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

/** شمارندهٔ متحرک اعداد (الگوی NumberTicker) — از صفر تا مقدار با شتاب‌نرم */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<number>(0);
  useEffect(() => {
    const from = ref.current;
    const to = value;
    if (from === to) { setShown(to); return; }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(from + (to - from) * eased);
      setShown(cur);
      if (p < 1) raf = requestAnimationFrame(tick);
      else ref.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{faNumber(shown)}</>;
}

export function PageHeader({
  title, desc, action, grad = false,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  grad?: boolean;
}) {
  return (
    <div className="b-rise no-print flex flex-wrap items-start justify-between gap-4 mb-6 md:mb-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] md:text-[36px] font-bold leading-[1.28]">{grad ? <span className="b-grad-text">{title}</span> : title}</h1>
        {desc && <p className="t-sm text-steel max-w-2xl">{desc}</p>}
      </div>
      {action && <div className="flex items-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon, label, value, tone = "spring", hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: "spring" | "ink" | "blossom" | "soft" | "warning";
  hint?: string;
}) {
  const display = typeof value === "number" ? <CountUp value={value} /> : value;
  const tones: Record<string, string> = {
    spring: "bg-spring text-primary-foreground",
    ink: "bg-invert text-invert-foreground",
    blossom: "bg-blossom text-blossom-foreground",
    soft: "bg-spring-tint text-spring",
    warning: "bg-warning text-warning-foreground",
  };
  return (
    <div className="b-card-sm b-rise b-card-hover p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </span>
      {/* راند ۱۹: برچسب دیگر truncate تک‌خطی نیست — در گرید‌های باریک موبایل نصف متن
          نمایش داده نمی‌شد؛ حالا تا دو خط با word-break می‌شکند و خوانده می‌شود. */}
      <div className="flex flex-col min-w-0">
        <span className="text-[20px] sm:text-[22px] font-bold leading-tight">{display}</span>
        <span className="text-[12px] text-steel leading-snug line-clamp-2 [word-break:break-word]">{label}</span>
        {hint && <span className="text-[12px] text-stone truncate">{hint}</span>}
      </div>
    </div>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useLang();
  const text = label ?? t("common.loading");
  return (
    <div className="flex flex-col gap-4 py-6" role="status" aria-label={text}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="b-card-sm p-5 flex items-center gap-4">
            <span className="w-11 h-11 rounded-full b-shimmer shrink-0" />
            <span className="flex flex-col gap-2 flex-1">
              <span className="h-4 w-2/3 rounded-md b-shimmer" />
              <span className="h-3 w-1/2 rounded-md b-shimmer" />
            </span>
          </div>
        ))}
      </div>
      <div className="b-card-sm p-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-4 rounded-md b-shimmer" style={{ width: `${88 - i * 14}%` }} />
        ))}
      </div>
      <span className="flex items-center justify-center gap-2 text-steel t-sm">
        <Loader2 className="w-4 h-4 animate-spin text-spring" /> {text}
      </span>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox, title, desc, action,
}: {
  icon?: LucideIcon;
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="b-card-sm p-10 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-full bg-spring-tint text-spring flex items-center justify-center">
        <Icon className="w-7 h-7" />
      </span>
      <h3 className="font-bold text-[16px]">{title}</h3>
      {desc && <p className="t-sm text-steel max-w-sm">{desc}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="b-card-sm !border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3 text-destructive">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <span className="text-[14px] font-medium leading-relaxed">{message}</span>
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const { t } = useLang();
  const map: Record<string, string> = {
    SUPER_ADMIN: "b-badge-ink",
    ADMIN: "b-badge-ink",
    MANAGER: "b-badge-spring",
    DEPUTY: "b-badge-blossom",
    TEACHER: "b-badge-neutral",
    CUSTODIAN: "b-badge-neutral",
    STUDENT: "b-badge-neutral",
    PARENT: "b-badge-neutral",
  };
  const labels: Record<string, string> = {
    SUPER_ADMIN: t("role.badge.superAdmin"),
    ADMIN: t("role.badge.admin"),
    MANAGER: t("role.badge.manager"),
    DEPUTY: t("role.badge.deputy"),
    TEACHER: t("role.badge.teacher"),
    CUSTODIAN: t("role.badge.custodian"),
    STUDENT: t("role.badge.student"),
    PARENT: t("role.badge.parent"),
  };
  return <span className={`b-badge ${map[role] ?? "b-badge-neutral"}`}>{labels[role] ?? role}</span>;
}

export function StatusBadge({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return <span className={`b-badge ${ok ? "b-badge-success" : "b-badge-critical"}`}>{ok ? okLabel : badLabel}</span>;
}
