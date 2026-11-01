/**
 * MiniChart — small line or bar chart for StatCard and dashboard headers.
 * Hand-drawn SVG geometry only (chart data, never an icon — icons stay
 * lucide-only). Series colors come from the Bahar chart tokens.
 */

import { cn } from "@/lib/utils";

function linePoints(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 50 : (i / (values.length - 1)) * 100;
      const y = 56 - ((v - min) / span) * 48;
      return `${x},${y}`;
    })
    .join(" ");
}

export function MiniChart({
  points,
  kind = "line",
  series = 1,
  label,
  className,
}: {
  points: number[];
  kind?: "line" | "bars";
  series?: 1 | 2 | 3 | 4 | 5;
  label?: string;
  className?: string;
}) {
  const color = `var(--chart-${series})`;
  const line = linePoints(points);
  const area = line ? `${line} 100,64 0,64` : "";
  const max = points.length ? Math.max(...points) : 0;

  return (
    <div className={cn(className)}>
      {label ? (
        <p className="mb-2 text-xs leading-5 text-steel">{label}</p>
      ) : null}
      {kind === "line" ? (
        <svg
          viewBox="0 0 100 64"
          preserveAspectRatio="none"
          className="h-16 w-full"
          role="img"
          aria-label={label ?? "نمودار"}
        >
          <polygon points={area} fill={color} opacity={0.12} />
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 100 64"
          preserveAspectRatio="none"
          className="h-16 w-full"
          role="img"
          aria-label={label ?? "نمودار"}
        >
          {points.map((v, i) => {
            const w = 100 / Math.max(points.length, 1);
            const h = max ? (v / max) * 56 : 0;
            return (
              <rect
                key={i}
                x={i * w + w * 0.15}
                y={64 - h}
                width={w * 0.7}
                height={h}
                rx={2}
                fill={color}
                opacity={0.85}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
