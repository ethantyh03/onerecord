import { cn } from "@/lib/utils";

/**
 * The state vocabulary, one meaning each (pattern sheet, "Glyph vocabulary"):
 *
 *   stuck   filled coral   money waiting / stuck / rejected / breached
 *   warn    filled amber   clock risk / needs attention
 *   ok      filled green   done / created in SAP / verified
 *   live    filled teal    live data, read from the sandbox right now
 *   neutral filled grey    in progress / neutral
 *   phase2  hollow violet  phase 2: planned, not built
 *   waiting hollow grey    waiting / not started / skipped
 */
export type StateTone = "neutral" | "stuck" | "warn" | "ok" | "live" | "phase2" | "waiting";

/** Fill (or outline) of the square for each tone. */
export const GLYPH_CLASSES: Record<StateTone, string> = {
  neutral: "bg-subtle",
  stuck: "bg-stuck",
  warn: "bg-warn",
  ok: "bg-ok",
  live: "bg-signal",
  phase2: "border border-phase2",
  waiting: "border border-subtle",
};

/** Text colour that pairs with each glyph when the word itself carries the state. */
export const STATE_INK: Record<StateTone, string> = {
  neutral: "text-secondary-foreground",
  stuck: "text-stuck-ink",
  warn: "text-warn-ink",
  ok: "text-ok-ink",
  live: "text-secondary-foreground",
  phase2: "text-phase2-ink",
  waiting: "text-muted-foreground",
};

export interface StateGlyphProps {
  tone?: StateTone;
  /** Draw the outline only (a filled tone reads as "not yet" / "planned"). phase2 and waiting are always hollow. */
  hollow?: boolean;
  /** "sm" = 6px for dense table cells, "md" = 8px elsewhere */
  size?: "sm" | "md";
  className?: string;
}

/**
 * The small square that carries state next to a word or a number. Squares, not dots: they echo the
 * map markers and avoid the "status pill" look. Always aria-hidden: the state is also in words.
 */
export function StateGlyph({ tone = "neutral", hollow, size = "md", className }: StateGlyphProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-[1px]",
        size === "sm" ? "size-1.5" : "size-2",
        hollow && tone !== "phase2" && tone !== "waiting" ? "border border-current" : GLYPH_CLASSES[tone],
        className,
      )}
    />
  );
}
