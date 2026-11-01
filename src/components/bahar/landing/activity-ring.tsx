/**
 * ActivityRing — Kokonut-style activity ring card, rebuilt for Bahar.
 * Original Bahar implementation of the free pattern (Kokonut free
 * components are MIT; Pro was not used).
 *
 * SVG circles carry chart geometry only (never icons — icons stay
 * lucide-only). Ring colors are Bahar token variables passed by the
 * caller; the default is spring. Center content and legend come from
 * props, so callers format numbers and dates themselves.
 *
 * Server-safe: no client directive needed.
 */

import { cn } from "@/lib/utils";

export type ActivityRingItem = {
  value: number;
  label: string;
  color?: string;
};

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

export function ActivityRing({
  rings,
  size = 120,
  thickness = 10,
  centerValue,
  centerLabel,
  className,
}: {
  rings: ActivityRingItem[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
  className?: string;
}) {
  const center = 60;
  const gap = 6;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 120 120"
          className="h-full w-full"
          role="img"
          aria-label={centerLabel ?? "حلقه فعالیت"}
        >
          {rings.map((ring, i) => {
            const radius = 52 - i * (thickness + gap);
            if (radius <= 0) return null;
            const circumference = 2 * Math.PI * radius;
            const filled = (clamp(ring.value) / 100) * circumference;
            return (
              <g key={ring.label}>
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke="var(--hairline-soft)"
                  strokeWidth={thickness}
                />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={ring.color ?? "var(--spring)"}
                  strokeWidth={thickness}
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${circumference}`}
                  transform={`rotate(-90 ${center} ${center})`}
                />
              </g>
            );
          })}
        </svg>
        {centerValue || centerLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue ? (
              <span className="text-lg font-bold leading-tight text-ink">
                {centerValue}
              </span>
            ) : null}
            {centerLabel ? (
              <span className="text-xs leading-5 text-steel">
                {centerLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-4">
        {rings.map((ring) => (
          <li
            key={ring.label}
            className="flex items-center gap-2 text-xs leading-5 text-steel"
          >
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: ring.color ?? "var(--spring)" }}
            />
            {ring.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
