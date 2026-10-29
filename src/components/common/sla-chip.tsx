"use client";

import { Pause } from "lucide-react";
import type { ApprovalStep } from "@/lib/types";
import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STATE_INK, StateGlyph } from "./glyph";
import { readSla, SLA_GLYPH } from "./sla";
import { useSimNow } from "./use-sim-now";

export interface SlaChipProps {
  step: ApprovalStep;
  /**
   * Drop the square once the step is decided ("Done in 1d" as plain muted text). For places where a
   * status beside it already says Approved or Rejected, so one fact does not get two markers.
   */
  quietWhenDone?: boolean;
  className?: string;
}

/**
 * Live SLA reading for one approval step, driven by the simulated clock. Plain status text (square +
 * reading); "paused" shows the Pause icon instead of the square. Focusable, with the detail in a tooltip.
 */
export function SlaChip({ step, quietWhenDone, className }: SlaChipProps) {
  const now = useSimNow();
  const sla = useSandbox((s) => s.config.sla);
  const elapsed = !step.activatedAt
    ? null
    : step.status === "approved" || step.status === "rejected"
      ? stepElapsedBusinessDays(step, step.decidedAt ?? now)
      : stepElapsedBusinessDays(step, now);
  const reading = readSla(step, elapsed, sla);
  const tone = SLA_GLYPH[reading.tone];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            data-sla={reading.tone}
            className={cn(
              "num inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-[2px] text-[0.8125rem] leading-5 font-medium whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              reading.tone === "done" ? "text-muted-foreground" : STATE_INK[tone],
              className,
            )}
          />
        }
      >
        {reading.tone === "paused" ? (
          <Pause aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2.25} />
        ) : quietWhenDone && reading.tone === "done" ? null : (
          <StateGlyph tone={tone} />
        )}
        {reading.label}
        <span className="sr-only">. {reading.detail}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{reading.detail}</TooltipContent>
    </Tooltip>
  );
}
