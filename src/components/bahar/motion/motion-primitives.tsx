"use client";

/**
 * Bahar motion primitives (Motion core, MIT, via the installed
 * framer-motion package — the Motion lineage).
 *
 * Rules enforced here:
 * - Durations stay in the 150-300ms band.
 * - Transform and opacity only (plus the BlurText filter effect, which
 *   lives in its own landing component and is the effect itself).
 * - Reduced motion renders the static final state.
 * - Directional motion mirrors by document direction: entering from the
 *   start side comes from the inline-start edge.
 */

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function isRtlDocument(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dir !== "ltr";
}

/** Offset for entering from the inline-start edge (mirrored in RTL). */
export function startSideOffset(magnitude = 24): number {
  return isRtlDocument() ? magnitude : -magnitude;
}

export function BaharPage({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: startSideOffset(24), y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function BaharModal({
  open,
  onClose,
  title,
  children,
  closeLabel = "بستن",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-overlay opacity-60"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="b-card relative w-full max-w-lg p-6"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold leading-tight text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="b-btn b-btn-ghost min-h-11 min-w-11"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function BaharStagger({
  children,
  className,
  step = 0.06,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function BaharStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.24, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
