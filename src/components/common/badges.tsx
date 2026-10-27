import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SyntheticBadgeProps {
  label?: string;
  className?: string;
}

/** Required on every analytics label: the numbers are synthetic and illustrative. */
export function SyntheticBadge({ label = "Synthetic, illustrative data", className }: SyntheticBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border-strong/70 bg-card px-2 text-[0.6875rem] font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <FlaskConical aria-hidden className="size-3" strokeWidth={2.25} />
      {label}
    </span>
  );
}

export interface Phase2BadgeProps {
  /** What is deferred, e.g. "Service Layer API". Renders as "Phase 2" alone when omitted. */
  label?: string;
  className?: string;
}

/** Marks anything not built in the prototype. Dashed violet outline: planned, not working. */
export function Phase2Badge({ label, className }: Phase2BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-dashed border-phase2 bg-phase2-soft/60 px-2 text-[0.6875rem] font-medium whitespace-nowrap text-phase2-ink",
        className,
      )}
    >
      <span className="font-semibold">Phase 2</span>
      {label ? <span className="font-normal opacity-90">{label}</span> : null}
    </span>
  );
}
