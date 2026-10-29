import { StateGlyph } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * Marks a capability that is planned but not enabled yet: the hollow violet square, then "Planned" and
 * what is planned. Same ink and glyph as the common phase-2 marker, in product wording. No box.
 */
export function PlannedBadge({ label, className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs leading-4 font-medium whitespace-nowrap text-phase2-ink",
        className,
      )}
    >
      <StateGlyph tone="phase2" />
      <span className="font-semibold">Planned</span>
      {label ? <span className="font-normal">· {label}</span> : null}
    </span>
  );
}
