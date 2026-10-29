import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATE_INK, StateGlyph, type StateTone } from "./glyph";

export interface StatusTextProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StateTone;
  /** Outline the square instead of filling it */
  hollow?: boolean;
  /**
   * Replaces the square when an icon says something the square cannot (e.g. lucide `Pause` for
   * "clock paused"). Rendered at 14px in the ink colour. Never both.
   */
  icon?: ReactNode;
  /** "sm" = 12px text, 6px square (dense rows, cards); "md" = 13px text, 8px square */
  size?: "sm" | "md";
  children: ReactNode;
}

/**
 * Status as plain text: a small state square and the label in the state's ink. No border, no fill,
 * no pill (gods-eye-view's `--plain` badge, Blueprint's minimal intent). Use it for every status, SLA
 * reading, "Clock paused", "Live", "Overdue" in rows, cards and headers.
 */
export function StatusText({ tone = "neutral", hollow, icon, size = "md", className, children, ...rest }: StatusTextProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap",
        size === "sm" ? "text-xs leading-4" : "text-[0.8125rem] leading-5",
        STATE_INK[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="inline-flex shrink-0 [&_svg]:size-3.5">
          {icon}
        </span>
      ) : (
        <StateGlyph tone={tone} hollow={hollow} size={size === "sm" ? "sm" : "md"} />
      )}
      {children}
    </span>
  );
}
