"use client";

/**
 * WordBlurText — React Bits-style blur text, rebuilt for Bahar.
 * Original Bahar implementation of the pattern (React Bits is MIT plus
 * Commons Clause; no upstream source was copied).
 *
 * Word level ONLY: the text splits on whitespace, never on letters, so
 * joined Persian letters stay joined. Reduced motion renders plain text.
 * Landing only: headlines, never body copy.
 */

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export function WordBlurText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);

  if (reduce) return <span className={className}>{text}</span>;

  return (
    <span className={cn(className)} aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden="true">
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{
              duration: 0.28,
              ease: "easeOut",
              delay: delay + i * 0.05,
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
