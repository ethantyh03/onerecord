import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./glyph";

export interface IllustrativeMarkerProps {
  /** Keep the page's exact wording, e.g. "Fictional sample messages" */
  label?: ReactNode;
  /** Lead with the small flask icon (default true) */
  icon?: boolean;
  className?: string;
}

/**
 * The one quiet provenance marker per section (a page header, a panel header, or a readout strip's
 * footnote): plain 12px subtle text, optionally led by a bare flask icon. Never a chip, never one per
 * card or per number.
 */
export function IllustrativeMarker({ label = "Synthetic, illustrative data", icon = true, className }: IllustrativeMarkerProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-subtle", className)}>
      {icon ? <FlaskConical aria-hidden className="size-3.5 shrink-0" strokeWidth={2} /> : null}
      {label}
    </span>
  );
}

export interface SyntheticBadgeProps {
  label?: string;
  className?: string;
}

/** Required on every analytics label: the numbers are synthetic and illustrative. Renders as the quiet IllustrativeMarker. */
export function SyntheticBadge({ label = "Synthetic, illustrative data", className }: SyntheticBadgeProps) {
  return <IllustrativeMarker label={label} className={className} />;
}

export interface Phase2BadgeProps {
  /** What is deferred, e.g. "Service Layer API". Renders as "Phase 2" alone when omitted. */
  label?: string;
  className?: string;
}

/** Marks anything not built in the prototype: a hollow violet square, then "Phase 2" and what is deferred. No box. */
export function Phase2Badge({ label, className }: Phase2BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 font-medium whitespace-nowrap text-phase2-ink",
        className,
      )}
    >
      <StateGlyph tone="phase2" />
      <span className="font-semibold">Phase 2</span>
      {label ? <span className="font-normal">{label}</span> : null}
    </span>
  );
}

export interface TagProps {
  children: ReactNode;
  className?: string;
}

/**
 * A category inside dense text (Blueprint's minimal tag): request type in a mixed list ("New Item"),
 * a filter value, a field key beside prose. 20px, no border, raised fill. Not for status (StatusText),
 * counts (Count), IDs (mono already marks them) or provenance (IllustrativeMarker).
 */
export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm bg-secondary px-1.5 text-xs whitespace-nowrap text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface CountProps {
  children: ReactNode;
  className?: string;
}

/** A plain count beside a title or tab (no chip): tabular figures, subtle ink, normal width. */
export function Count({ children, className }: CountProps) {
  return (
    <span className={cn("num text-sm font-normal tracking-normal text-subtle [font-stretch:100%]", className)}>{children}</span>
  );
}
