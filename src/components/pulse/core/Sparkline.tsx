import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  values: number[];
  /** Index where the "current" period starts; earlier points draw in the quiet ink. */
  splitAt?: number;
  /** CSS colour for the current-period line. Defaults to the foreground ink. */
  color?: string;
  /** Show a soft wash under the current period. */
  area?: boolean;
  height?: number;
  className?: string;
  /** Accessible summary, e.g. "24 months of orders, Oct 2024 to Sep 2026". */
  label?: string;
}

const W = 120;

/** 24-month trend line. Fixed internal width, stretches to its container; strokes don't scale. */
export function Sparkline({ values, splitAt, color = "var(--foreground)", area = false, height = 28, className, label }: SparklineProps) {
  const gradId = useId();
  if (values.length < 2) return <div style={{ height }} className={className} />;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pad = 2.5;
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => [i * step, pad + (1 - (v - min) / span) * (height - pad * 2)] as const);
  const path = (from: number, to: number) =>
    pts
      .slice(from, to + 1)
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
  const split = splitAt != null && splitAt > 0 && splitAt < values.length ? splitAt : 0;
  const last = pts[pts.length - 1];
  const currentPath = path(Math.max(0, split - (split ? 1 : 0)), pts.length - 1);
  const areaStart = Math.max(0, split - (split ? 1 : 0));
  const areaPath = `${currentPath} L${last[0].toFixed(2)},${height} L${pts[areaStart][0].toFixed(2)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block w-full overflow-visible", className)}
      style={{ height }}
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
        </>
      ) : null}
      {split ? (
        <path
          d={path(0, split - 1)}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeOpacity={0.55}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={currentPath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
