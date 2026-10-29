import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StateGlyph, type StateTone } from "./glyph";

/** Lead-phrase ink. Neutral leads are foreground (a notice's lead is its point); see STATE_INK for status words. */
const LEAD_INK: Record<StateTone, string> = {
  neutral: "text-foreground",
  stuck: "text-stuck-ink",
  warn: "text-warn-ink",
  ok: "text-ok-ink",
  live: "text-foreground",
  phase2: "text-phase2-ink",
  waiting: "text-foreground",
};

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  tone?: StateTone;
  /** One meaningful icon instead of the square (e.g. Pause for "clock is paused"), drawn in the tone's ink */
  icon?: ReactNode;
  /** The point, in the state's ink: "Clock paused." The rest (children) follows in secondary text. */
  lead?: ReactNode;
  children?: ReactNode;
  /** A button or link on the right */
  action?: ReactNode;
  /** Page-level notice: the line sits between two hairlines, full width */
  ruled?: boolean;
  /** "sm" = 13px for footnotes under forms; "md" = 14px (default) */
  size?: "sm" | "md";
}

/**
 * A notice as a line, not a tinted box (Blueprint's minimal Callout): a state square (or one icon), a
 * lead phrase in the state's ink, the rest in secondary text, an optional action on the right.
 * `ruled` puts it between two hairlines for page-level notices. role="note" by default; pass
 * role="status" / aria-live where the original announced changes.
 */
export function Notice({
  tone = "neutral",
  icon,
  lead,
  children,
  action,
  ruled,
  size = "md",
  className,
  role = "note",
  ...rest
}: NoticeProps) {
  return (
    <div
      role={role}
      {...rest}
      className={cn(
        "flex items-start gap-3",
        size === "sm" ? "text-[0.8125rem] leading-5" : "text-sm leading-6",
        ruled && "border-y border-border py-3",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className={cn("inline-flex shrink-0 [&_svg]:size-4", size === "sm" ? "mt-0.5" : "mt-1", LEAD_INK[tone])}>
          {icon}
        </span>
      ) : (
        <StateGlyph tone={tone} className={size === "sm" ? "mt-1.5" : "mt-2"} />
      )}
      <div className="min-w-0 flex-1 text-secondary-foreground">
        {lead ? <span className={cn("font-medium", LEAD_INK[tone])}>{lead} </span> : null}
        {children}
      </div>
      {action ? <div className="-my-1 ml-auto flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
