"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, Clock, FastForward } from "lucide-react";
import { toast } from "sonner";
import type { AppNotification } from "@/lib/types";
import { addBusinessDays } from "@/lib/engine/sla";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatSgtDateTime } from "@/components/common/format";
import { useSimNow } from "@/components/common/use-sim-now";

const HOUR_MS = 3_600_000;

interface Jump {
  id: string;
  label: string;
  hours: (nowIso: string) => number;
}

/** Hours needed to move exactly n business days (Fri 10:00 + 1 business day = Mon 10:00). */
function businessDayHours(nowIso: string, days: number): number {
  try {
    const target = new Date(addBusinessDays(nowIso, days)).getTime();
    const hours = (target - new Date(nowIso).getTime()) / HOUR_MS;
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 100) / 100;
  } catch {
    // fall through to the calendar approximation
  }
  return days * 24;
}

const JUMPS: Jump[] = [
  { id: "4h", label: "+4 hours", hours: () => 4 },
  { id: "1bd", label: "+1 business day", hours: (n) => businessDayHours(n, 1) },
  { id: "3bd", label: "+3 business days", hours: (n) => businessDayHours(n, 3) },
];

function describeOffset(ms: number): string | null {
  if (!ms || ms < 60_000) return null;
  const totalH = Math.round(ms / HOUR_MS);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  if (d === 0) return `+${h}h`;
  return h === 0 ? `+${d}d` : `+${d}d ${h}h`;
}

function summariseSlaEvents(fresh: AppNotification[]): string {
  const key = (n: AppNotification) => `${n.requestId ?? ""}:${n.stepId ?? ""}`;
  const reminders = new Set(fresh.filter((n) => n.kind === "reminder").map(key)).size;
  const escalations = new Set(fresh.filter((n) => n.kind === "escalation").map(key)).size;
  if (reminders === 0 && escalations === 0) return "No SLA reminders or escalations were due.";
  const parts: string[] = [];
  if (reminders) parts.push(`${reminders} reminder${reminders === 1 ? "" : "s"}`);
  if (escalations) parts.push(`${escalations} escalation${escalations === 1 ? "" : "s"}`);
  return `${parts.join(" and ")} sent to approvers.`;
}

/** Simulated clock in SGT with a fast-forward menu that drives SLA reminders and escalations. */
export function SimClock({ className }: { className?: string }) {
  const now = useSimNow();
  const offset = useSandbox((s) => s.clockOffsetMs);
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState(0);
  const offsetLabel = describeOffset(offset);

  function jump(j: Jump) {
    const store = useSandbox.getState();
    const before = new Set(store.notifications.map((n) => n.id));
    const hours = j.hours(store.nowIso());
    store.fastForward(hours);
    const after = useSandbox.getState();
    const fresh = after.notifications.filter((n) => !before.has(n.id));
    setPulse((p) => p + 1);
    toast(`Clock moved to ${formatSgtDateTime(after.nowIso())} SGT`, {
      description: summariseSlaEvents(fresh),
      icon: <FastForward className="size-4" />,
    });
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div className="relative flex h-10 items-center gap-2.5 rounded-l-lg border border-r-0 bg-card pr-3 pl-2.5">
        {pulse > 0 && !reduceMotion ? (
          <motion.span
            key={pulse}
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-l-lg ring-2 ring-primary"
            initial={{ opacity: 0.9, scale: 1 }}
            animate={{ opacity: 0, scale: 1.12 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        ) : null}
        <motion.span
          key={`icon-${pulse}`}
          className="flex text-primary"
          initial={pulse > 0 && !reduceMotion ? { rotate: -90 } : false}
          animate={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
        >
          <Clock aria-hidden className="size-4" strokeWidth={2.25} />
        </motion.span>
        <span className="flex flex-col leading-none">
          <span className="text-[0.6875rem] text-muted-foreground">
            Simulated clock
            {offsetLabel ? <span className="num ml-1.5 font-medium text-primary">{offsetLabel}</span> : null}
          </span>
          <motion.span
            key={`time-${pulse}`}
            className="num mt-1 text-sm font-semibold whitespace-nowrap text-foreground"
            initial={pulse > 0 && !reduceMotion ? { opacity: 0, y: -4 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {formatSgtDateTime(now)} <span className="font-medium text-muted-foreground">SGT</span>
          </motion.span>
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-r-lg border bg-card px-3 text-sm font-medium text-foreground outline-none transition-colors",
            "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 data-popup-open:bg-muted",
          )}
        >
          <FastForward aria-hidden className="size-4 text-primary" />
          <span className="hidden md:inline">Fast-forward</span>
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 pt-1 pb-1.5 leading-snug">
              Move the demo clock to see SLA reminders and escalations fire.
            </DropdownMenuLabel>
            {JUMPS.map((j) => {
              const hours = j.hours(now);
              const target = new Date(new Date(now).getTime() + hours * HOUR_MS).toISOString();
              return (
                <DropdownMenuItem key={j.id} onClick={() => jump(j)} className="flex-col items-start gap-0 rounded-md px-2 py-1.5">
                  <span className="text-sm font-medium text-foreground">{j.label}</span>
                  <span className="num text-xs text-muted-foreground">to {formatSgtDateTime(target)}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
