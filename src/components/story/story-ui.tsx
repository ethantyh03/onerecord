"use client";

import type { ReactNode } from "react";
import { Check, Minus, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Mark } from "./business-case";

/** A number whose formula and source appear on hover or keyboard focus (dotted underline = "ask me where this came from"). */
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
              "num cursor-help underline decoration-muted-foreground/45 decoration-dotted underline-offset-[5px] outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/40",
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

/** Section title used across the story pages: a plain heading, an optional one-line explanation and right-aligned extras. */
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
    <div className={cn("mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h2 id={id} className="text-[1.1875rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
          {title}
        </h2>
        {subtitle ? <p className="max-w-[78ch] text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{aside}</div> : null}
    </div>
  );
}

const MARK_META: Record<Mark, { label: string; className: string; icon: ReactNode }> = {
  yes: { label: "Yes", className: "bg-ok-soft text-ok-ink", icon: <Check aria-hidden className="size-3.5" strokeWidth={2.75} /> },
  partly: { label: "Partly", className: "bg-warn-soft text-warn-ink", icon: <span aria-hidden className="text-[0.8125rem] leading-none font-bold">~</span> },
  no: { label: "No", className: "bg-stuck-soft text-stuck-ink", icon: <X aria-hidden className="size-3.5" strokeWidth={2.75} /> },
  na: { label: "Not applicable", className: "bg-muted text-muted-foreground", icon: <Minus aria-hidden className="size-3.5" strokeWidth={2.5} /> },
};

/** ✓ / ~ / ✗ cell for the alternatives table. Shape and label carry the meaning, not colour alone. */
export function MarkCell({ mark }: { mark: Mark }) {
  const m = MARK_META[mark];
  return (
    <span className={cn("inline-flex size-6 items-center justify-center rounded-full", m.className)} title={m.label}>
      {m.icon}
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

/** Small honest-label chip (e.g. "Illustrative", "Live from the sandbox"). */
export function NoteChip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "brand" | "warn" | "ok"; className?: string }) {
  const tones = {
    neutral: "border-border-strong/70 bg-card text-muted-foreground",
    brand: "border-primary/25 bg-primary-soft text-primary",
    warn: "border-warn/40 bg-warn-soft text-warn-ink",
    ok: "border-ok/30 bg-ok-soft text-ok-ink",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
