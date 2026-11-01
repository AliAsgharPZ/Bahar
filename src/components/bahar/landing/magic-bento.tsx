/**
 * MagicBento — Magic UI-style bento grid, rebuilt for Bahar.
 * Original Bahar implementation of the free pattern (Magic UI free
 * components are MIT; Pro sections and templates were not used).
 *
 * Grid collapses 3 columns to 2 to 1. Cells read in inline direction.
 * Landing only.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function MagicBento({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoCell({
  children,
  title,
  description,
  icon: Icon,
  span = "1",
  className,
}: {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  span?: "1" | "2";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "b-card p-5",
        span === "2" ? "sm:col-span-2" : undefined,
        className,
      )}
    >
      {title || Icon ? (
        <div className="mb-2 flex items-center gap-4">
          {Icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-spring-tint">
              <Icon size={20} className="text-spring-deep" />
            </span>
          ) : null}
          {title ? (
            <h3 className="text-base font-bold leading-tight text-ink">
              {title}
            </h3>
          ) : null}
        </div>
      ) : null}
      {description ? (
        <p className="text-sm leading-6 text-steel">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
