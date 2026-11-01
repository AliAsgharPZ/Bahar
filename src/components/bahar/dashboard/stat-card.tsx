/**
 * StatCard — BoardUI-style stat card, rebuilt for Bahar.
 * Original Bahar implementation of the free-tier pattern (BoardUI free
 * components are MIT; Pro was not used).
 *
 * Bahar customizations: .b-card shell, spring token scale, Persian digits
 * with the currency unit word after the number, logical alignment, and a
 * hand-drawn SVG sparkline (geometry only, never an icon — icons stay
 * lucide-only). Server-safe: no client directive needed.
 */

import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { faCurrency, faGrouped, faPercent } from "@/components/bahar/format";
import { cn } from "@/lib/utils";

export type StatTone = "spring" | "blossom" | "warning" | "info" | "steel";

const TONE_VAR: Record<StatTone, string> = {
  spring: "var(--spring)",
  blossom: "var(--blossom)",
  warning: "var(--warning)",
  info: "var(--info)",
  steel: "var(--steel)",
};

function sparkPoints(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
      const y = 36 - ((v - min) / span) * 32;
      return `${x},${y}`;
    })
    .join(" ");
}

export function StatCard({
  title,
  value,
  suffix = "none",
  delta,
  deltaLabel,
  icon: Icon,
  spark,
  tone = "spring",
  className,
}: {
  title: string;
  value: number | string;
  suffix?: "toman" | "percent" | "none";
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  spark?: number[];
  tone?: StatTone;
  className?: string;
}) {
  const display =
    typeof value === "string"
      ? value
      : suffix === "toman"
        ? faCurrency(value)
        : suffix === "percent"
          ? faPercent(value)
          : faGrouped(value);
  const points = spark ? sparkPoints(spark) : "";
  const area = points ? `${points} 100,40 0,40` : "";

  return (
    <div className={cn("b-card p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm leading-6 text-steel">{title}</p>
          <p className="mt-2 text-2xl font-bold leading-tight text-ink">
            {display}
          </p>
        </div>
        {Icon ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-spring-tint">
            <Icon size={20} className="text-spring-deep" />
          </span>
        ) : null}
      </div>
      {delta !== undefined || deltaLabel ? (
        <div className="mt-4 flex items-center gap-2">
          {delta !== undefined ? (
            <span
              className={cn(
                "b-badge",
                delta >= 0 ? "b-badge-success" : "b-badge-critical",
              )}
            >
              {delta >= 0 ? (
                <TrendingUp size={14} />
              ) : (
                <TrendingDown size={14} />
              )}
              {faPercent(Math.abs(delta))}
            </span>
          ) : null}
          {deltaLabel ? (
            <span className="text-xs leading-5 text-steel">{deltaLabel}</span>
          ) : null}
        </div>
      ) : null}
      {points ? (
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="mt-4 h-10 w-full"
          role="img"
          aria-hidden="true"
        >
          <polygon points={area} fill={TONE_VAR[tone]} opacity={0.12} />
          <polyline
            points={points}
            fill="none"
            stroke={TONE_VAR[tone]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
