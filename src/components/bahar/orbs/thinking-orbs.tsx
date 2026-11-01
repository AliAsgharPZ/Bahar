"use client";

/**
 * ThinkingOrbs — Bahar reimplementation of the dotted-orb idea
 * (upstream: Thinking Orbs, MIT).
 *
 * Original DOM and motion implementation, recolored to spring green.
 * No upstream source was copied. Dots are symmetric, so no direction
 * mirroring is needed. Reduced motion renders a static ring.
 *
 * States: thinking, searching, solving, listening, composing, working.
 * Sizes follow the upstream official sizes: 20 (inline) and 64 (avatar).
 * This is a status indicator, not a button spinner.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export type OrbState =
  | "thinking"
  | "searching"
  | "solving"
  | "listening"
  | "composing"
  | "working";

const DOT_COUNT = 8;

function dotPosition(index: number, size: number, dot: number) {
  const center = size / 2;
  const radius = center - dot;
  const angle = (index / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
  return {
    x: center + radius * Math.cos(angle) - dot / 2,
    y: center + radius * Math.sin(angle) - dot / 2,
  };
}

function dotAnimation(state: OrbState, index: number) {
  switch (state) {
    case "thinking":
      return {
        opacity: [0.25, 1, 0.25],
        scale: [0.7, 1.15, 0.7],
        transition: {
          duration: 1.2,
          repeat: Infinity,
          delay: index * 0.12,
          ease: "easeInOut" as const,
        },
      };
    case "searching":
      return {
        opacity: [0.4, 1, 0.4],
        scale: [0.8, 1.2, 0.8],
        transition: {
          duration: 0.9,
          repeat: Infinity,
          delay: index * 0.08,
          ease: "easeInOut" as const,
        },
      };
    case "solving":
      return {
        opacity: [1, 0.3, 1],
        scale: [1.1, 0.75, 1.1],
        transition: {
          duration: 1.4,
          repeat: Infinity,
          delay: (DOT_COUNT - index) * 0.09,
          ease: "easeInOut" as const,
        },
      };
    case "listening":
      return {
        opacity: [0.55, 1, 0.55],
        scale: [0.85, 1.05, 0.85],
        transition: {
          duration: 1.8,
          repeat: Infinity,
          delay: index * 0.05,
          ease: "easeInOut" as const,
        },
      };
    case "composing":
      return {
        opacity: [0.35, 1, 0.35],
        scale: [0.75, 1.25, 0.75],
        transition: {
          duration: 1.1,
          repeat: Infinity,
          delay: index * 0.14,
          ease: "easeInOut" as const,
        },
      };
    case "working":
    default:
      return {
        opacity: [0.3, 1, 0.3],
        scale: [0.7, 1.2, 0.7],
        transition: {
          duration: 1.0,
          repeat: Infinity,
          delay: index * 0.1,
          ease: "easeInOut" as const,
        },
      };
  }
}

export function ThinkingOrbs({
  state = "thinking",
  size = 64,
  label = "در حال پردازش",
  className,
}: {
  state?: OrbState;
  size?: 20 | 64;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const dot = size === 64 ? 8 : 3;
  const spin = state === "searching" || state === "working";
  const breathe = state === "listening";

  const dots = Array.from({ length: DOT_COUNT }, (_, i) => i);

  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{ display: "inline-block", width: size, height: size }}
    >
      <motion.span
        style={{
          position: "relative",
          display: "block",
          width: size,
          height: size,
        }}
        animate={
          reduce
            ? undefined
            : spin
              ? { rotate: 360 }
              : breathe
                ? { scale: [1, 1.08, 1] }
                : undefined
        }
        transition={
          spin
            ? { duration: 1.6, repeat: Infinity, ease: "linear" }
            : breathe
              ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
              : undefined
        }
      >
        {dots.map((i) => {
          const pos = dotPosition(i, size, dot);
          return (
            <span
              key={i}
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                insetInlineStart: 0,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            >
              <motion.span
                style={{
                  display: "block",
                  width: dot,
                  height: dot,
                  borderRadius: "9999px",
                }}
                className={i % 4 === 0 ? "bg-spring-soft" : "bg-spring"}
                animate={reduce ? undefined : dotAnimation(state, i)}
              />
            </span>
          );
        })}
      </motion.span>
    </span>
  );
}
