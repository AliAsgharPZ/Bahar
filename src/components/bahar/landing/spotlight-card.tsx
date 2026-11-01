"use client";

/**
 * SpotlightCard — React Bits-style spotlight card, rebuilt for Bahar.
 * Original Bahar implementation of the pattern (React Bits is MIT plus
 * Commons Clause; no upstream source was copied).
 *
 * The glow is a transform-moved overlay, so motion stays transform-only.
 * Reduced motion shows a static soft tint instead of pointer tracking.
 * Landing only.
 */

import * as React from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export function SpotlightCard({
  children,
  title,
  className,
  glow = true,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  glow?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: -480, y: -480 });
  const [hovering, setHovering] = React.useState(false);

  const onMove = (event: React.MouseEvent) => {
    if (!glow || reduce) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: event.clientX - rect.left - 240,
      y: event.clientY - rect.top - 240,
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={cn("b-card relative overflow-hidden p-6", className)}
    >
      {glow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 start-0 transition-transform duration-200 ease-out"
          style={{
            width: 480,
            height: 480,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            background:
              "radial-gradient(circle, var(--spring-tint), transparent 70%)",
            opacity: hovering && !reduce ? 1 : 0,
          }}
        />
      ) : null}
      <div className="relative">
        {title ? (
          <h3 className="mb-2 text-lg font-bold leading-tight text-ink">
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </div>
  );
}
