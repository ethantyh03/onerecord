"use client";

import { useMemo } from "react";
import { Check, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { maskPayload, validateServiceLayer } from "./mdm-helpers";
import { PlannedBadge } from "./PlannedBadge";

/** (5) Planned direct posting: the Service Layer call that would create the record. Never sent. */
export function ServiceLayerPanel({
  payload,
  sensitive,
  canSee,
}: {
  payload: { method: "POST" | "PATCH"; path: string; body: Record<string, unknown> };
  sensitive: Set<string>;
  canSee: boolean;
}) {
  const checks = useMemo(() => validateServiceLayer(payload), [payload]);
  const json = useMemo(
    () => JSON.stringify(canSee ? payload.body : maskPayload(payload.body, sensitive), null, 2),
    [payload, canSee, sensitive],
  );
  const failing = checks.filter((c) => !c.check.ok).length;

  return (
    <div data-testid="mdm-sl-panel" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <code className="mono-id font-semibold text-foreground">{payload.method}</code>
          <code className="mono-id truncate text-foreground">{payload.path}</code>
          <PlannedBadge label="not sent" />
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                tabIndex={0}
                className="inline-flex rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            }
          >
            <Button size="sm" variant="outline" disabled data-testid="mdm-sl-send" aria-describedby="sl-send-why">
              <Send aria-hidden />
              Send to Service Layer
            </Button>
          </TooltipTrigger>
          <TooltipContent id="sl-send-why" className="max-w-[300px]">
            Not enabled. Records are imported through DTW after the MDM check; direct posting is planned.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <pre className="max-h-[360px] overflow-auto rounded-sm bg-canvas px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-secondary-foreground scrollbar-thin [font-variant-ligatures:none]">
          {json}
        </pre>
        <div className="flex flex-col">
          <div className="border-b border-border-strong pb-2">
            <p className="text-sm font-semibold text-foreground">Field-length validator</p>
            <p className={cn("text-xs", failing ? "text-stuck-ink" : "text-muted-foreground")}>
              {failing ? `${failing} field${failing === 1 ? "" : "s"} too long` : "All checked fields fit"} · SAP B1 10.0 SDK limits
            </p>
          </div>
          {checks.length === 0 ? (
            <p className="py-2.5 text-xs text-muted-foreground">No length-limited fields in this payload.</p>
          ) : (
            <ul className="divide-y divide-border">
              {checks.map((c) => (
                <li key={c.property} className="flex items-center justify-between gap-2 py-1.5 text-[0.8125rem]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {c.check.ok ? (
                      <Check aria-label="Fits" className="size-3.5 shrink-0 text-ok-ink" />
                    ) : (
                      <X aria-label="Too long" className="size-3.5 shrink-0 text-stuck-ink" />
                    )}
                    <code className="mono-id truncate text-foreground">{c.property}</code>
                  </span>
                  <span className={cn("num shrink-0 font-medium", c.check.ok ? "text-ok-ink" : "text-stuck-ink")}>
                    {c.check.length}/{c.check.exact ? `=${c.check.max}` : c.check.max}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        When enabled, a business partner and its child rows go in one <code className="mono-id text-secondary-foreground">$batch</code>{" "}
        request so they are created together or not at all.
      </p>
    </div>
  );
}
