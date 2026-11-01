"use client";

/**
 * NumberTicker — Magic UI-style number ticker, rebuilt for Bahar.
 * Original Bahar implementation of the free pattern (Magic UI free
 * components are MIT; Pro was not used).
 *
 * Counts from zero to the target value, formatted with Persian digits.
 * Reduced motion shows the final value immediately. Tabular numerals
 * keep the width stable while counting.
 */

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";

import {
  faCurrency,
  faGrouped,
  faPercent,
} from "@/components/bahar/format";
import { cn } from "@/lib/utils";

export function NumberTicker({
  value,
  suffix = "none",
  duration = 1.2,
  className,
}: {
  value: number;
  suffix?: "toman" | "percent" | "none";
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const format = React.useCallback(
    (v: number) =>
      suffix === "toman"
        ? faCurrency(Math.round(v))
        : suffix === "percent"
          ? faPercent(Math.round(v))
          : faGrouped(Math.round(v)),
    [suffix],
  );
  const [display, setDisplay] = React.useState(() => format(value));

  React.useEffect(() => {
    if (reduce) {
      setDisplay(format(value));
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
  }, [value, duration, format, reduce]);

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}
