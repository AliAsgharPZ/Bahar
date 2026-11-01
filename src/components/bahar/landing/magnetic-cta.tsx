"use client";

/**
 * MagneticCta — Kokonut-style magnetic call to action, rebuilt for Bahar.
 * Original Bahar implementation of the free pattern (Kokonut free
 * components are MIT; Pro was not used).
 *
 * The button follows the pointer within a small symmetric range, so the
 * effect is identical in both directions and needs no mirroring.
 * Reduced motion disables the pull. Landing only.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export function MagneticCta({
  children,
  href,
  onClick,
  variant = "spring",
  className,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "spring" | "ink";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  const onMove = (event: React.MouseEvent) => {
    if (reduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    setOffset({
      x: Math.max(-8, Math.min(8, x * 0.2)),
      y: Math.max(-8, Math.min(8, y * 0.2)),
    });
  };

  const buttonClass = cn(
    "b-btn",
    variant === "spring" ? "b-btn-spring" : "b-btn-ink",
    className,
  );

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={reduce ? undefined : { x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      className="inline-block"
    >
      {href ? (
        <a href={href} className={buttonClass}>
          {children}
        </a>
      ) : (
        <button type="button" onClick={onClick} className={buttonClass}>
          {children}
        </button>
      )}
    </motion.div>
  );
}
