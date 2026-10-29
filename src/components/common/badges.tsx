import { isValidElement, type ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./glyph";

export interface IllustrativeMarkerProps {
  /**
   * The page's own wording, e.g. "Fictional sample messages". Without a label the marker renders nothing:
   * the top bar's environment tag ("Sandbox · synthetic data") already covers every screen.
   */
  label?: ReactNode;
  /** Lead with the small flask icon (default true) */
  icon?: boolean;
  className?: string;
}

/**
 * A quiet provenance note for one section (a page header, a panel header, or a readout strip's
 * footnote): plain 12px subtle text, optionally led by a bare flask icon. Never a chip, never one per
 * card or per number. Renders only when a page passes its own `label`.
 */
export function IllustrativeMarker({ label, icon = true, className }: IllustrativeMarkerProps) {
  if (!label) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 whitespace-nowrap text-subtle", className)}>
      {icon ? <FlaskConical aria-hidden className="size-3.5 shrink-0" strokeWidth={2} /> : null}
      {label}
    </span>
  );
}

export interface SyntheticBadgeProps {
  /** Shown only when passed: the generic "synthetic data" note now lives once, in the top bar. */
  label?: string;
  className?: string;
}

/** A page-specific provenance note. Renders nothing without a `label` (the top bar's environment tag covers the rest). */
export function SyntheticBadge({ label, className }: SyntheticBadgeProps) {
  return <IllustrativeMarker label={label} className={className} />;
}

/**
 * True when `node` would render nothing: empty values, or a provenance marker with no label of its own.
 * Wrappers (page-header meta, panel markers, strip footnotes) use it so they never leave a bare hairline.
 */
export function isBlankMarker(node: ReactNode): boolean {
  // Anything falsy rendered nothing before markers could be blank (`{meta ? … : null}`): keep that.
  if (!node || node === true) return true;
  if (isValidElement(node) && (node.type === SyntheticBadge || node.type === IllustrativeMarker)) {
    return !(node.props as { label?: ReactNode }).label;
  }
  return false;
}

export interface Phase2BadgeProps {
  /** What is planned, e.g. "Service Layer API". Renders as "Planned" alone when omitted. */
  label?: string;
  className?: string;
}

/** Marks a capability that is planned but not enabled yet: a hollow violet square, then "Planned" and what. No box. */
export function Phase2Badge({ label, className }: Phase2BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 font-medium whitespace-nowrap text-phase2-ink",
        className,
      )}
    >
      <StateGlyph tone="phase2" />
      <span className="font-semibold">Planned</span>
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
