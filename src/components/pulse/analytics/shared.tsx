"use client";

import type { ReactNode } from "react";
import { COUNTRIES, type CountryCode, type ProductGroup } from "@/lib/types";
import { SyntheticBadge } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * Chart colours come from the shell's tokens so light and dark mode follow the theme.
 * Roles are fixed: "ours" is always teal, "today's method" always amber, context series slate.
 * Coral (chart-2) is reserved for stuck demand and at-risk, so no analytics series uses it.
 */
export const VIZ = {
  ours: "var(--chart-1)",
  today: "var(--chart-3)",
  context: "var(--chart-5)",
  ink: "var(--foreground)",
  muted: "var(--muted-foreground)",
  grid: "var(--border)",
  axis: "var(--border-strong)",
  surface: "var(--card)",
  gain: "var(--chart-1)",
  loss: "var(--chart-3)",
  total: "var(--chart-5)",
} as const;

export const COUNTRY_NAME: Record<CountryCode, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c.name]),
) as Record<CountryCode, string>;

export const COUNTRY_CODES: CountryCode[] = COUNTRIES.map((c) => c.code);
export const PRODUCTS: ProductGroup[] = ["A", "B", "C"];
export const PRODUCT_SHORT: Record<ProductGroup, string> = {
  A: "A · Reagents & test kits",
  B: "B · Lab consumables",
  C: "C · Instruments",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" → "Sep 26" */
export function monthShort(m: string): string {
  const [y, mm] = m.split("-");
  const i = Number(mm) - 1;
  return `${MONTHS[i] ?? mm} ${y?.slice(2) ?? ""}`;
}

/** "2026-09" → "Sep 2026" */
export function monthLong(m: string): string {
  const [y, mm] = m.split("-");
  return `${MONTHS[Number(mm) - 1] ?? mm} ${y}`;
}

/** "2026-03" + 1 → "2026-04" */
export function addMonths(m: string, n: number): string {
  const [y, mm] = m.split("-").map(Number);
  const idx = y * 12 + (mm - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** Signed percent: +3.1% / −2.0% */
export function signedPct(v: number, digits = 1): string {
  const s = (Math.abs(v) * 100).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s}%`;
}

/** Signed points: −2.5 pts / +1.0 pts */
export function signedPts(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${s} pts`;
}

/** WAPE as "N per 100" */
export function per100(w: number): number {
  return Math.round(w * 100);
}

export function units(n: number): string {
  return Math.round(n).toLocaleString("en-SG");
}

export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** Plain-language bias, verb chosen per sign */
export function biasWords(b: number): string {
  const v = Math.abs(Math.round(b * 1000) / 10);
  if (v < 0.5) return "has almost no lean either way";
  return `tends to ${b > 0 ? "over" : "under"}-forecast by ${v}%`;
}

/** Card frame shared by every analytics panel: title row, synthetic badge, body. */
export function PanelFrame({
  id,
  testId,
  title,
  subtitle,
  actions,
  badges,
  children,
  className,
}: {
  id?: string;
  testId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-testid={testId}
      className={cn("rounded-xl border bg-card shadow-raised", className)}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <header className="flex flex-col gap-3 border-b px-5 pt-4 pb-3.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.0625rem] leading-tight font-semibold tracking-[-0.01em]">{title}</h2>
            <SyntheticBadge />
            {badges}
          </div>
          {subtitle ? <p className="max-w-[78ch] text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Small rounded segmented control (buttons, not radios, so it records cleanly). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  testIdPrefix,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  testIdPrefix?: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-lg bg-muted p-[3px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={active}
            data-testid={testIdPrefix ? `${testIdPrefix}-${o.value}` : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-md px-2.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Tooltip shell for Recharts custom content. */
export function TipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-float">
      <div className="mb-1.5 font-semibold">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TipRow({ color, label, value, dashed }: { color?: string; label: ReactNode; value: ReactNode; dashed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color ? <Swatch color={color} dashed={dashed} /> : null}
        {label}
      </span>
      <span className="num font-medium text-foreground">{value}</span>
    </div>
  );
}

export function Swatch({ color, dashed, kind = "line" }: { color: string; dashed?: boolean; kind?: "line" | "block" }) {
  if (kind === "block") {
    return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-block h-0 w-3.5 shrink-0"
      style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
    />
  );
}

/** A short "what this means" line in plain words. */
export function PlainLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[0.9375rem] leading-snug text-secondary-foreground", className)}>{children}</p>;
}
