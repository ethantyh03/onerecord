"use client";

import type { ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";
import { StateGlyph } from "@/components/common";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Mark } from "./business-case";

/**
 * A number whose formula and source appear on hover or keyboard focus. The dotted underline (Blueprint's
 * tooltip indicator) is kept faint so a page full of figures does not read as a page full of links; it
 * brightens on hover and focus.
 */
export function Figure({
  children,
  formula,
  className,
  testId,
}: {
  children: ReactNode;
  formula: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            data-testid={testId}
            className={cn(
              "num cursor-help underline decoration-border-strong decoration-dotted underline-offset-[5px] outline-none hover:decoration-muted-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent className="block max-w-sm px-3 py-2 text-left text-[0.8125rem] leading-snug">{formula}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A ruled section title on the open page (osiris SectionTitle): title in the semi-expanded width, a
 * hairline running to the right edge, extras at the end; one muted line under it.
 */
export function SectionHeading({
  title,
  subtitle,
  aside,
  id,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={id} className="font-wide shrink-0 scroll-mt-24 text-[1.0625rem] leading-6 font-semibold text-foreground">
          {title}
        </h2>
        <span aria-hidden className="h-px min-w-6 flex-1 bg-border" />
        {aside ? <div className="flex shrink-0 flex-wrap items-center gap-3">{aside}</div> : null}
      </div>
      {subtitle ? <p className="mt-1 max-w-[80ch] text-sm leading-snug text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

/**
 * Console panel with a header bar: title (and an optional one-line description) left, controls right,
 * hairline under it. `flush` drops the body padding for edge-to-edge tables and lists.
 */
export function Panel({
  title,
  titleId,
  description,
  action,
  footer,
  children,
  flush,
  level = 2,
  className,
  headerClassName,
  bodyClassName,
  testId,
  as: Tag = "section",
}: {
  title: ReactNode;
  titleId?: string;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
  level?: 2 | 3;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  testId?: string;
  as?: "section" | "div" | "aside" | "figure";
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <Tag
      aria-labelledby={titleId}
      data-testid={testId}
      className={cn("panel relative flex min-w-0 flex-col overflow-hidden", className)}
    >
      <header className={cn("panel-header flex-wrap py-2.5", headerClassName)}>
        <div className="min-w-0">
          <H id={titleId} className="panel-title scroll-mt-24">
            {title}
          </H>
          {description ? <p className="mt-0.5 max-w-[84ch] text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </header>
      {children !== undefined ? <div className={cn("min-w-0 flex-1", flush ? null : "p-4", bodyClassName)}>{children}</div> : null}
      {footer ? <footer className="border-t border-border px-4 py-2.5 text-xs leading-5 text-muted-foreground">{footer}</footer> : null}
    </Tag>
  );
}

/**
 * In-text link. Primary is monochrome in the dark console (light grey, like body text), so links carry a quiet
 * underline that brightens on hover; in the light theme primary is the ink teal.
 */
export const LINK =
  "rounded-sm text-primary underline decoration-primary/35 decoration-1 underline-offset-4 outline-none transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Shared table styles for the story tables (they wrap prose, unlike the dense ui Table default). */
export const T = {
  table: "w-full text-sm [font-variant-numeric:lining-nums_tabular-nums]",
  head: "h-9 px-4 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground",
  headRow: "border-b border-border-strong",
  row: "border-b border-border last:border-b-0",
  cell: "px-4 py-2.5 align-top",
} as const;

/** Bare marks, no box: the shape says it (✓ ~ ✗ –), the ink repeats it, the label is there for screen readers. */
const MARK_META: Record<Mark, { label: string; className: string; icon: ReactNode }> = {
  yes: { label: "Yes", className: "text-ok-ink", icon: <Check aria-hidden className="size-4" strokeWidth={2.5} /> },
  partly: { label: "Partly", className: "text-warn-ink", icon: <span aria-hidden className="text-base leading-none font-semibold">~</span> },
  no: { label: "No", className: "text-stuck-ink", icon: <X aria-hidden className="size-4" strokeWidth={2.5} /> },
  na: { label: "Not applicable", className: "text-subtle", icon: <Minus aria-hidden className="size-4" strokeWidth={2} /> },
};

/** ✓ / ~ / ✗ cell for the alternatives table. Shape and label carry the meaning, not colour alone. */
export function MarkCell({ mark }: { mark: Mark }) {
  const m = MARK_META[mark];
  return (
    <span className={cn("inline-flex size-5 items-center justify-center", m.className)} title={m.label}>
      {m.icon}
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

/**
 * A short honest label (e.g. "Illustrative", "Only if Lives qualifies as an SME"), as quiet text, never a chip.
 * "ok" / "warn" lead with the state square; "brand" is for labels that are links (the link carries the underline).
 */
export function NoteChip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" | "ok"; className?: string }) {
  const tones = {
    neutral: "text-subtle",
    brand: "text-muted-foreground",
    warn: "text-warn-ink",
    ok: "text-ok-ink",
  } as const;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 font-medium whitespace-nowrap", tones[tone], className)}>
      {tone === "ok" || tone === "warn" ? <StateGlyph tone={tone} size="sm" /> : null}
      {children}
    </span>
  );
}
