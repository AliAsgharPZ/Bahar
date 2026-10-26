"use client";

import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { faNumber } from "@/lib/persian";

export function PageHeader({
  title, desc, action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6 md:mb-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl md:text-[28px] font-bold leading-tight">{title}</h1>
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
  const display = typeof value === "number" ? faNumber(value) : value;
  const tones: Record<string, string> = {
    spring: "bg-spring text-primary-foreground",
    ink: "bg-invert text-invert-foreground",
    blossom: "bg-blossom text-blossom-foreground",
    soft: "bg-spring-tint text-spring",
    warning: "bg-warning text-warning-foreground",
  };
  return (
    <div className="b-card-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </span>
      {/* راند ۱۹: برچسب دیگر truncate تک‌خطی نیست — در گرید‌های باریک موبایل نصف متن
          نمایش داده نمی‌شد؛ حالا تا دو خط با word-break می‌شکند و خوانده می‌شود. */}
      <div className="flex flex-col min-w-0">
        <span className="text-[20px] sm:text-[22px] font-bold leading-tight">{display}</span>
        <span className="text-[12px] text-steel leading-snug line-clamp-2 [word-break:break-word]">{label}</span>
        {hint && <span className="text-[10.5px] text-stone truncate">{hint}</span>}
      </div>
    </div>
  );
}

export function LoadingBlock({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-steel">
      <Loader2 className="w-7 h-7 animate-spin text-spring" />
      <span className="t-sm">{label}</span>
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
      <h3 className="font-bold text-[15px]">{title}</h3>
      {desc && <p className="t-sm text-steel max-w-sm">{desc}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="b-card-sm !border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3 text-destructive">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <span className="text-[13.5px] font-medium leading-relaxed">{message}</span>
    </div>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "b-badge-ink",
    ADMIN: "b-badge-ink",
    MANAGER: "b-badge-spring",
    DEPUTY: "b-badge-blossom",
    TEACHER: "b-badge-neutral",
    STUDENT: "b-badge-neutral",
    PARENT: "b-badge-neutral",
  };
  const labels: Record<string, string> = {
    SUPER_ADMIN: "ادمین ارشد",
    ADMIN: "ادمین سرویس",
    MANAGER: "مدیر",
    DEPUTY: "معاون",
    TEACHER: "معلم",
    STUDENT: "دانش‌آموز",
    PARENT: "ولی",
  };
  return <span className={`b-badge ${map[role] ?? "b-badge-neutral"}`}>{labels[role] ?? role}</span>;
}

export function StatusBadge({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return <span className={`b-badge ${ok ? "b-badge-success" : "b-badge-critical"}`}>{ok ? okLabel : badLabel}</span>;
}
