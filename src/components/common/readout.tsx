import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Stats as readouts (pattern sheet A): the Gotham meta columns. Each figure is a cell with a hairline
 * rule on its left, a muted sentence-case label, a big semi-expanded figure and one line of meaning.
 * No box, no rail, no icon, no chip. State is the figure's colour.
 *
 *   <ReadoutStrip footnote={<IllustrativeMarker />}>
 *     <Readout lead tone="stuck" label="Stuck demand" marker={<LiveMark />} value="S$345,800" caption="…" />
 *     <Readout label="Waiting for MDM's final check" value={2} caption="…" />
 *     <Readout label="Median time to SAP B1" value={<>3<ReadoutUnit>business days</ReadoutUnit></>} />
 *   </ReadoutStrip>
 */

export type ReadoutTone = "default" | "stuck" | "warn" | "ok";

const VALUE_TONE: Record<ReadoutTone, string> = {
  default: "text-foreground",
  stuck: "text-stuck",
  warn: "text-warn-ink",
  ok: "text-ok-ink",
};

/** Figure size. "md" is the standard readout; "lg" the one number a strip leads with; "sm" a quieter second tier. */
export type ReadoutSize = "sm" | "md" | "lg";

const VALUE_SIZE: Record<ReadoutSize, string> = {
  sm: "text-[1.5rem] @min-[17rem]:text-[1.75rem]",
  md: "text-[1.75rem] @min-[17rem]:text-[2.25rem]",
  lg: "text-[2.25rem] @min-[20rem]:text-[3rem]",
};

/** Layout of the strip on wide screens. "auto" = one ruled row (cells share the width, a lead cell gets more). */
export type ReadoutColumns = "auto" | 2 | 3 | 4;

const COLUMNS: Record<ReadoutColumns, string> = {
  auto: "sm:grid-cols-2 lg:flex lg:[&>*]:min-w-0 lg:[&>*]:flex-1 lg:[&>[data-lead]]:flex-[1.45]",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export interface ReadoutStripProps extends HTMLAttributes<HTMLElement> {
  /** "auto" (default): one row at lg. A number: a ruled grid, e.g. 3 for six readouts in two rows. */
  columns?: ReadoutColumns;
  /** The strip's one quiet line under the cells: source, provenance (<IllustrativeMarker />), caveat. */
  footnote?: ReactNode;
  /** Render as a <section> (give it an aria-label) or a plain <div> (default). */
  as?: "div" | "section";
  /** Classes for the grid of cells itself (className goes on the outer element). */
  gridClassName?: string;
}

/**
 * A row of readouts. Below sm they stack, at sm two per row, at lg one row (or `columns` per row).
 * Every cell carries its own left rule, so wrapped rows and wrapper divs still read as columns.
 */
export function ReadoutStrip({
  columns = "auto",
  footnote,
  as: Tag = "div",
  className,
  gridClassName,
  children,
  ...rest
}: ReadoutStripProps) {
  return (
    <Tag className={className} {...rest}>
      <div className={cn("grid grid-cols-1 gap-y-7", COLUMNS[columns], gridClassName)}>{children}</div>
      {footnote ? <div className="mt-4 text-xs leading-4 text-subtle">{footnote}</div> : null}
    </Tag>
  );
}

export interface ReadoutProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  label: ReactNode;
  value: ReactNode;
  /** One line under the figure: what the number means */
  caption?: ReactNode;
  /** Small print under the caption: source or assumption reference */
  footnote?: ReactNode;
  /** The figure's colour. Neutral numbers stay "default": colour is state, never decoration. */
  tone?: ReadoutTone;
  /** One quiet marker at the right of the label row: <LiveMark /> or a short text. Never a chip. */
  marker?: ReactNode;
  /** The number that matters most: first in the strip and wider (auto layout). */
  lead?: boolean;
  /** Figure size: "md" (default), "lg" for the strip's headline number, "sm" for a supporting tier. */
  size?: ReadoutSize;
  /** The whole cell becomes the link: label brightens and a small arrow shows; no background change. */
  href?: string;
  className?: string;
}

/** One readout cell: label, figure, caption, footnote. Use inside a ReadoutStrip. */
export function Readout({
  label,
  value,
  caption,
  footnote,
  tone = "default",
  marker,
  lead,
  size = "md",
  href,
  className,
  ...rest
}: ReadoutProps) {
  const body = (
    <dl className="flex h-full flex-col">
      <dt className="flex min-h-5 items-center gap-2 text-[0.8125rem] leading-5 text-muted-foreground transition-colors group-hover/ro:text-foreground">
        <span className="min-w-0">{label}</span>
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-subtle transition-colors group-hover/ro:text-foreground"
            strokeWidth={2}
          />
        ) : null}
        {marker ? (
          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center text-xs text-subtle",
              // Callers' old chips render as quiet text here: no border, fill or padding.
              "[&>*]:h-auto [&>*]:border-0 [&>*]:bg-transparent [&>*]:px-0 [&>*]:py-0",
            )}
          >
            {marker}
          </span>
        ) : null}
      </dt>
      <dd
        className={cn(
          "num font-wide mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 leading-none font-semibold",
          VALUE_SIZE[size],
          VALUE_TONE[tone],
        )}
      >
        {value}
      </dd>
      {caption ? (
        <dd className="mt-3 max-w-[44ch] text-sm leading-snug text-secondary-foreground">{caption}</dd>
      ) : null}
      {footnote ? <dd className="mt-auto pt-3 text-xs leading-4 text-subtle">{footnote}</dd> : null}
    </dl>
  );

  const cls = cn(
    "group/ro @container relative block min-w-0 border-l border-border-strong pr-5 pl-4",
    href &&
      "rounded-none outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    className,
  );

  return href ? (
    <Link href={href} {...rest} className={cls} data-lead={lead ? "" : undefined}>
      {body}
    </Link>
  ) : (
    <div {...rest} className={cls} data-lead={lead ? "" : undefined}>
      {body}
    </div>
  );
}

/** A unit after a figure ("business days", "h / month", "per 100"): normal width, base size, muted. */
export function ReadoutUnit({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "ml-1 text-base font-medium tracking-normal text-muted-foreground [font-stretch:100%]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A change shown inline after the figure, no box: e.g. the "−S$70,000" release on Stuck demand. */
export function ReadoutDelta({
  children,
  tone = "ok",
  className,
}: {
  children: ReactNode;
  tone?: "ok" | "stuck" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num text-base font-semibold tracking-normal [font-stretch:100%]",
        tone === "ok" ? "text-ok-ink" : tone === "stuck" ? "text-stuck-ink" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Live data marker: a teal square and the word, quiet. Replaces the coral "Live" chip. */
export function LiveMark({ label = "Live", className }: { label?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs leading-4 text-subtle", className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-[1px] bg-signal" />
      {label}
    </span>
  );
}

/**
 * A 2px part-of-whole bar under a caption. Only when the figure really is a part of a known whole
 * (e.g. stuck of open orders). Decorative: the numbers must also be in words.
 */
export function ProportionBar({
  part,
  whole,
  tone = "default",
  className,
}: {
  part: number;
  whole: number;
  tone?: ReadoutTone | "neutral";
  className?: string;
}) {
  const pct = whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;
  const fill =
    tone === "stuck" ? "bg-stuck" : tone === "warn" ? "bg-warn" : tone === "ok" ? "bg-ok" : "bg-muted-foreground";
  return (
    <span aria-hidden className={cn("mt-3 block h-0.5 w-full max-w-[36ch] bg-border", className)}>
      <span className={cn("block h-full", fill)} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * A 24px sparkline for a series the component already has (never an invented one): 1.25px stroke in
 * subtle ink, no fill, no axis, the last point a 3px dot in the figure's colour.
 */
export function Sparkline({
  values,
  tone = "default",
  width = 96,
  height = 24,
  className,
}: {
  values: number[];
  tone?: ReadoutTone;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("mt-3 block overflow-visible text-subtle", className)}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(values[last])} r={1.5} className={cn("fill-current", VALUE_TONE[tone])} />
    </svg>
  );
}
