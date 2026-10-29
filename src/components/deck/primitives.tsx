import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Design size of every slide. The player scales this stage to fit the screen. */
export const STAGE_W = 1920;
export const STAGE_H = 1080;
/** Left/right page margin at design size. */
export const PAD_X = 112;
export const CONTENT_W = STAGE_W - 2 * PAD_X;

/**
 * How a slide is being shown.
 * live: on stage; builds and signature transitions may play.
 * static: end state, no motion (reduced motion, presenter thumbnails, print).
 */
export type SlideMode = "live" | "static";

export interface SlideProps {
  mode: SlideMode;
  /** True when the slide was reached from the slide its signature transition starts on. */
  play: boolean;
  /** Build step within the slide (0-based). */
  step: number;
  /** True while presenter thumbnails or print render the slide (no iframes, no live store reads). */
  thumb?: boolean;
  /** s08 only: the zoom into the live app has started. */
  handoff?: boolean;
  /** s08 only: start the zoom into the live app. */
  onHandoff?: () => void;
  /** Footer position, e.g. "4 / 14" or "A3". */
  position: string;
}

/**
 * The slide surface: near-black, 1920x1080, with one quiet footer line (provenance on the left, position on
 * the right). No eyebrows, no logo strip: the headline is the first thing on every slide.
 */
export function SlideFrame({
  children,
  label,
  position,
  className,
  footerClassName,
}: {
  children: ReactNode;
  /** One provenance line per slide, e.g. "Synthetic, illustrative data". */
  label?: ReactNode;
  /** e.g. "4 / 14" or "A3". */
  position?: string;
  className?: string;
  footerClassName?: string;
}) {
  return (
    <div
      className={cn("relative h-[1080px] w-[1920px] overflow-hidden bg-background text-foreground", className)}
      style={{ fontFeatureSettings: '"lnum" 1' }}
    >
      {children}
      {label || position ? (
        <div
          className={cn(
            "absolute inset-x-[112px] bottom-[44px] flex items-baseline justify-between gap-12 text-[18px] leading-[24px] text-subtle",
            footerClassName,
          )}
        >
          <p className="max-w-[1480px]">{label}</p>
          {position ? <p className="num shrink-0 tracking-[0.02em]">{position}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Full-sentence takeaway, sentence case, semi-expanded. */
export function Headline({
  children,
  className,
  size = 64,
  style,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <h2
      className={cn("absolute top-[92px] left-[112px] max-w-[1560px] font-semibold text-foreground", className)}
      style={{
        fontSize: size,
        lineHeight: 1.06,
        fontStretch: "112%",
        letterSpacing: "-0.022em",
        textWrap: "balance",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

/**
 * Gotham-site meta columns: short uppercase lines, each column opened by a 1px vertical rule.
 * Uppercase lives only here (deck content doc, visual rules).
 */
export function MetaColumns({
  cols,
  className,
  colClassName,
}: {
  cols: { top: ReactNode; bottom: ReactNode }[];
  className?: string;
  colClassName?: string;
}) {
  return (
    <dl className={cn("flex items-stretch", className)}>
      {cols.map((c, i) => (
        <div
          key={i}
          className={cn(
            "min-w-0 flex-1 border-l border-border-strong pr-6 pl-5 text-[19px] leading-[24px] tracking-[0.03em] uppercase",
            colClassName,
          )}
        >
          <dt className="text-muted-foreground">{c.top}</dt>
          <dd className="text-foreground">{c.bottom}</dd>
        </div>
      ))}
    </dl>
  );
}

export type Tone = "neutral" | "stuck" | "warn" | "ok" | "phase2" | "live" | "fg";

const FILL: Record<Tone, string> = {
  neutral: "bg-subtle",
  stuck: "bg-stuck",
  warn: "bg-warn",
  ok: "bg-ok",
  phase2: "bg-phase2",
  live: "bg-signal",
  fg: "bg-foreground",
};

const RING: Record<Tone, string> = {
  neutral: "border-subtle",
  stuck: "border-stuck",
  warn: "border-warn",
  ok: "border-ok",
  phase2: "border-phase2",
  live: "border-signal",
  fg: "border-foreground",
};

/** State glyph: a small square (pattern sheet glyph vocabulary). The state is always also in words. */
export function Glyph({ tone = "neutral", hollow, size = 14, className }: { tone?: Tone; hollow?: boolean; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-[2px]", hollow ? cn("border-2", RING[tone]) : FILL[tone], className)}
      style={{ width: size, height: size }}
    />
  );
}

export const INK: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  stuck: "text-stuck",
  warn: "text-warn",
  ok: "text-ok",
  phase2: "text-phase2-ink",
  live: "text-signal",
  fg: "text-foreground",
};

/** Identifiers only (C-MY-00029, G-MY-0002, REQ-1100). */
export function Code({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn("font-mono tracking-normal", className)}
      style={{ fontStretch: "100%", fontVariantLigatures: "none", fontVariantNumeric: "tabular-nums", ...style }}
    >
      {children}
    </span>
  );
}

/** Big semi-expanded figure. */
export function Figure({ children, className, size = 64, style }: { children: ReactNode; className?: string; size?: number; style?: CSSProperties }) {
  return (
    <span
      className={cn("num font-semibold", className)}
      style={{ fontSize: size, lineHeight: 1, fontStretch: "112%", letterSpacing: "-0.02em", ...style }}
    >
      {children}
    </span>
  );
}

/** A readout strip: cells separated by thin vertical rules, no boxes. */
export function ReadoutRow({
  cells,
  className,
}: {
  cells: { value: ReactNode; caption?: ReactNode; flex?: number; className?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-stretch", className)}>
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn("min-w-0 border-l border-border-strong px-8 first:border-l-0 first:pl-0 last:pr-0", c.className)}
          style={{ flex: c.flex ?? 1 }}
        >
          <div className="font-semibold text-foreground" style={{ fontSize: 34, lineHeight: 1.12, fontStretch: "112%", letterSpacing: "-0.015em" }}>
            {c.value}
          </div>
          {c.caption ? <p className="mt-3 text-[24px] leading-[31px] text-muted-foreground">{c.caption}</p> : null}
        </div>
      ))}
    </div>
  );
}
