"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { faDigits, faNumber } from "@/lib/persian";

// ============================================================
// بهار | چارت‌های SVG کاستوم — الهام‌گرفته از زبان طراحی vibefarsi.ir
// منحنی‌های نرم بزیه + گرادیان ناحیه + انیمیشن ترسیم/رشد +
// تولتیپ تعاملی + گوشه‌های گرد — بدون کتابخانه خارجی.
// ============================================================

/* ─── ابزار مشترک ─── */

/** منحنی نرم (Catmull-Rom → cubic bezier) بین نقاط */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function useChartAnim(enabled: boolean) {
  // کاهش حرکت → بدون انیمیشن (زنده و واکنش‌گرا به تغییر تنظیم سیستم)
  const reduce = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
  return enabled && !reduce;
}

/* ═══════════════════════════════════════════════
   LineChart — روند با منحنی نرم + گرادیان + تولتیپ
   ═══════════════════════════════════════════════ */
export function LineChart({
  data,
  height = 130,
  color = "var(--spring)",
  idSuffix = "",
}: {
  data: { label: string; value: number; total?: number }[];
  height?: number;
  color?: string;
  idSuffix?: string;
}) {
  const uid = useId().replace(/[:]/g, "") + idSuffix;
  const [hover, setHover] = useState<number | null>(null);
  const anim = useChartAnim(data.length > 1);

  const pts = useMemo(() => {
    if (data.length === 0) return [];
    const W = 320;
    const H = height;
    const pad = 10;
    const max = Math.max(...data.map((d) => d.total ?? d.value), 1);
    const step = (W - pad * 2) / Math.max(data.length - 1, 1);
    return data.map((d, i) => ({
      x: W - pad - i * step, // RTL — جدیدترین سمت راست
      y: H - pad - (d.value / max) * (H - pad * 2),
      d,
    }));
  }, [data, height]);

  if (data.length === 0) return <p className="t-sm text-steel py-6 text-center">داده‌ای نیست</p>;

  const W = 320;
  const H = height;
  const pad = 10;
  const path = smoothPath(pts);
  const last = pts[pts.length - 1];
  const area = `${path} L${last.x.toFixed(1)} ${H - pad} L${pts[0].x.toFixed(1)} ${H - pad} Z`;
  const pathLen = (data.length - 1) * 120 + 40; // تقریب کافی برای stroke-dasharray

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label="نمودار روند"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`lcg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.30" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* خطوط راهنمای افقی ظریف */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={pad + (H - pad * 2) * f} y2={pad + (H - pad * 2) * f}
            stroke="var(--hairline-soft)" strokeWidth="1" strokeDasharray="3 5" />
        ))}

        {/* ناحیه گرادیانی + منحنی */}
        <path d={area} fill={`url(#lcg-${uid})`} style={anim ? { animation: `bahar-chart-fade .7s var(--ease-decel) backwards` } : undefined} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            anim
              ? { strokeDasharray: pathLen, strokeDashoffset: pathLen, animation: `bahar-chart-draw 1.1s var(--ease-decel) forwards` }
              : undefined
          }
        />

        {/* نقاط + ناحیه لمس/هاور */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3.2} fill="var(--card)" stroke={color} strokeWidth="2.2"
              style={{ transition: "r .18s var(--ease-spring)" }} />
            {/* نوار لمسی عریض برای انتخاب */}
            <rect x={p.x - 14} y={0} width={28} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)} />
            {hover === i && (
              <line x1={p.x} x2={p.x} y1={pad} y2={H - pad} stroke={color} strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
            )}
          </g>
        ))}
      </svg>

      {/* تولتیپ */}
      {hover !== null && pts[hover] && (
        <div
          className="absolute -translate-x-1/2 -top-1 pointer-events-none z-10 b-badge !rounded-lg elev-2 !px-2.5 !py-1.5 !text-[12px] flex-col !items-start gap-0.5 bg-card border border-hairline-soft"
          style={{ left: `${(pts[hover].x / W) * 100}%` }}
        >
          <span className="text-steel !text-[12px]">{pts[hover].d.label}</span>
          <b className="text-ink !text-[12px]">
            {faNumber(pts[hover].d.value)}
            {pts[hover].d.total !== undefined ? ` / ${faNumber(pts[hover].d.total)}` : ""}
          </b>
        </div>
      )}

      {/* برچسب‌های ابتدا/انتهای محور */}
      <div className="flex justify-between text-[12px] text-stone mt-1 px-1">
        <span>{pts[0]?.d.label}</span>
        <span>{data.length > 2 ? pts[Math.floor((data.length - 1) / 2)]?.d.label : ""}</span>
        <span>{pts[pts.length - 1]?.d.label}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   BarChart — میله‌های افقی گرد + انیمیشن رشد
   ═══════════════════════════════════════════════ */
export function BarChart({
  data,
  max = 20,
  suffix,
}: {
  data: { label: string; value: number | null }[];
  max?: number;
  suffix?: string;
}) {
  const anim = useChartAnim(data.length > 0);
  if (data.length === 0) return <p className="t-sm text-steel py-6 text-center">داده‌ای نیست</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => {
        const pct = d.value === null ? 0 : Math.min(100, (d.value / max) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[12px] text-steel w-28 truncate text-left shrink-0" title={d.label}>{d.label}</span>
            <div className="flex-1 h-6 bg-cloud rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full ${d.value === null ? "bg-cloud" : pct >= 70 ? "bg-spring" : pct >= 50 ? "bg-spring-soft" : "bg-warning"}`}
                style={{
                  width: `${Math.max(pct, d.value === null ? 0 : 6)}%`,
                  ...(anim ? { animation: "bahar-chart-grow .8s var(--ease-decel) backwards", animationDelay: `${i * 70}ms` } : {}),
                }}
              />
              {d.value !== null && (
                <span className="absolute inset-y-0 end-2 flex items-center text-[12px] font-bold text-ink-deep/70">
                  {faDigits(d.value.toFixed(1))}{suffix ?? ""}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   VBarChart — میله‌های عمودی گرد (سبک vibefarsi) + تولتیپ
   ═══════════════════════════════════════════════ */
export function VBarChart({
  data,
  height = 150,
  color = "var(--spring)",
  idSuffix = "",
  suffix,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  idSuffix?: string;
  suffix?: string;
}) {
  const uid = useId().replace(/[:]/g, "") + idSuffix;
  const [hover, setHover] = useState<number | null>(null);
  const anim = useChartAnim(data.length > 0);

  if (data.length === 0) return <p className="t-sm text-steel py-6 text-center">داده‌ای نیست</p>;

  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = data.length > 8 ? 4 : 8;
  const barW = Math.max(6, Math.min(26, (320 - gap * (data.length - 1)) / data.length));

  return (
    <div className="relative">
      <svg viewBox={`0 0 320 ${height}`} className="w-full touch-pan-y" role="img" aria-label="نمودار میله‌ای">
        <defs>
          <linearGradient id={`vbg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => (
          <line key={f} x1="4" x2="316" y1={(height - 18) * f} y2={(height - 18) * f}
            stroke="var(--hairline-soft)" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        {data.map((d, i) => {
          const h = Math.max(3, (d.value / max) * (height - 26));
          const x = 320 - (i + 1) * (barW + gap) + gap / 2; // RTL: اولین از راست
          const y = height - 18 - h;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect
                x={x} y={y} width={barW} height={h}
                rx={Math.min(barW / 2, 7)}
                fill={`url(#vbg-${uid})`}
                opacity={hover === null || hover === i ? 1 : 0.45}
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "bottom",
                  transition: "opacity .18s var(--ease-standard)",
                  ...(anim ? { animation: "bahar-chart-rise .75s var(--ease-decel) backwards", animationDelay: `${i * 55}ms` } : {}),
                }}
              />
              <rect x={x - gap / 2} y={0} width={barW + gap} height={height} fill="transparent" />
            </g>
          );
        })}
        {/* خط پایه */}
        <line x1="4" x2="316" y1={height - 18} y2={height - 18} stroke="var(--hairline)" strokeWidth="1.2" />
      </svg>
      {hover !== null && data[hover] && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none b-badge !rounded-lg elev-2 !px-2.5 !py-1 bg-card border border-hairline-soft !text-[12px]">
          <span className="text-steel !text-[12px]">{data[hover].label}: </span>
          <b className="text-ink">{faNumber(data[hover].value)}{suffix ?? ""}</b>
        </div>
      )}
      <div className="flex justify-between text-[12px] text-stone mt-0.5 px-1" dir="rtl">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DonutChart — قطاعات انیمیت‌شده با سرگرد
   ═══════════════════════════════════════════════ */
export function DonutChart({
  parts,
  size = 130,
  centerLabel,
}: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
}) {
  const anim = useChartAnim(parts.length > 0);
  const [hover, setHover] = useState<number | null>(null);
  // FIX (راند ۱۸): قطاع‌های صفر رسم نمی‌شوند (قبلاً با کلاهک گرد به نقطه تبدیل می‌شدند)
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;

  if (visible.length === 0) return <p className="t-sm text-steel py-6 text-center">داده‌ای نیست</p>;

  // FIX (راند ۱۸): درصدهای گردشده با جمعِ دقیق ۱۰۰٪ (روش بزرگ‌ترین باقیمانده)
  const pcts = (() => {
    const raw = visible.map((p) => (p.value / total) * 100);
    const floors = raw.map((x) => Math.floor(x));
    let rest = 100 - floors.reduce((s, x) => s + x, 0);
    const out = [...floors];
    raw.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac).forEach(({ i }) => {
      if (rest > 0) { out[i] += 1; rest -= 1; }
    });
    return out;
  })();
  // فاصلهٔ بین قطاع‌ها — فقط وقتی بیش از یک قطاع باشد
  const gapPx = visible.length > 1 ? Math.min(4, c * 0.012) : 0;

  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="نمودار سهم">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {visible.map((p, i) => {
              const len = (p.value / total) * c;
              const offset = visible.slice(0, i).reduce((s, q) => s + (q.value / total) * c, 0);
              const arcFinal = `${Math.max(len - gapPx, 0.75)} ${c - Math.max(len - gapPx, 0.75)}`;
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={hover === i ? 14 : 12}
                  strokeDasharray={arcFinal}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    transition: "stroke-width .2s var(--ease-spring), opacity .18s var(--ease-standard)",
                    ...(anim
                      ? {
                          ["--arc-final" as string]: arcFinal,
                          animation: "bahar-chart-arc 1s var(--ease-decel) backwards",
                          animationDelay: `${i * 110}ms`,
                        }
                      : {}),
                  }}
                />
              );
            })}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[17px] font-bold text-foreground">{centerLabel ?? faNumber(total)}</span>
          {hover !== null && visible[hover] && (
            <span className="text-[12px] text-steel max-w-[80px] truncate text-center leading-tight mt-0.5">{visible[hover].label}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {visible.map((p, i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 text-[11.5px] rounded-lg px-1.5 py-0.5 transition-colors ${hover === i ? "bg-spring-tint" : ""}`}
          >
            <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: p.color }} />
            <span className="text-steel">{p.label}</span>
            <b>{faNumber(p.value)}</b>
            <span className="text-stone !text-[9.5px]">({faNumber(pcts[i] ?? 0)}٪)</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SparkLine — خط ریز برای کارت‌های آمار
   ═══════════════════════════════════════════════ */
export function SparkLine({
  data,
  width = 96,
  height = 30,
  color = "var(--spring)",
  idSuffix = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  idSuffix?: string;
}) {
  const uid = useId().replace(/[:]/g, "") + idSuffix;
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 3;
  const step = (width - pad * 2) / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: width - pad - i * step, // RTL
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }));
  const path = smoothPath(pts);
  const area = `${path} L${pts[pts.length - 1].x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`spg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spg-${uid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.4" fill={color} />
    </svg>
  );
}

/* ═══════════════════════════════════════════════
   RadialGauge — گیج درصدی (سلامت/وضعیت)
   ═══════════════════════════════════════════════ */
export function RadialGauge({
  value,
  size = 88,
  label,
  color,
}: {
  value: number | null;
  size?: number;
  label?: string;
  color?: string;
}) {
  const anim = useChartAnim(value !== null);
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  const stroke = 9;
  const r = size / 2 - stroke / 2 - 2;
  const c = 2 * Math.PI * r;
  const auto = v === null ? "#93a69c" : v >= 75 ? "#31a24c" : v >= 55 ? "#f2a918" : "#e41e3f";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline-soft)" strokeWidth={stroke} />
        {v !== null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color ?? auto} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(v / 100) * c} ${c}`}
            style={anim ? { animation: `bahar-chart-gauge 1s var(--ease-decel) backwards` } : undefined}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground">{v === null ? "—" : faNumber(v)}</span>
        {label && <span className="text-[9px] text-stone">{label}</span>}
      </div>
    </div>
  );
}
