"use client";

import { CircleCheck, CircleDashed, Pause, Siren, Timer, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ApprovalStep } from "@/lib/types";
import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readSla, type SlaTone } from "./sla";
import { useSimNow } from "./use-sim-now";

const TONE: Record<SlaTone, { cls: string; icon: LucideIcon }> = {
  idle: { cls: "border-border bg-transparent text-muted-foreground", icon: CircleDashed },
  ok: { cls: "border-ok/30 bg-ok-soft text-ok-ink", icon: Timer },
  warn: { cls: "border-warn/45 bg-warn-soft text-warn-ink", icon: TriangleAlert },
  stuck: { cls: "border-stuck/35 bg-stuck-soft text-stuck-ink", icon: Siren },
  paused: { cls: "border-border-strong bg-muted text-secondary-foreground", icon: Pause },
  done: { cls: "border-border bg-transparent text-muted-foreground", icon: CircleCheck },
};

export interface SlaChipProps {
  step: ApprovalStep;
  className?: string;
}

/** Live SLA reading for one approval step, driven by the simulated clock. */
export function SlaChip({ step, className }: SlaChipProps) {
  const now = useSimNow();
  const sla = useSandbox((s) => s.config.sla);
  const elapsed = !step.activatedAt
    ? null
    : step.status === "approved" || step.status === "rejected"
      ? stepElapsedBusinessDays(step, step.decidedAt ?? now)
      : stepElapsedBusinessDays(step, now);
  const reading = readSla(step, elapsed, sla);
  const { cls, icon: Icon } = TONE[reading.tone];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              "num inline-flex h-6 shrink-0 cursor-default items-center gap-1 rounded-md border px-1.5 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              cls,
              className,
            )}
          />
        }
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
        {reading.label}
        <span className="sr-only">. {reading.detail}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{reading.detail}</TooltipContent>
    </Tooltip>
  );
}
