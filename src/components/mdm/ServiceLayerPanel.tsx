"use client";

import { useMemo } from "react";
import { Check, Send, X } from "lucide-react";
import { Phase2Badge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { maskPayload, validateServiceLayer } from "./mdm-helpers";

/** (5) Phase 2 reference: the Service Layer call that would create the record directly. Never sent. */
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
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 font-mono text-xs font-bold",
              payload.method === "PATCH" ? "bg-warn-soft text-warn-ink" : "bg-ok-soft text-ok-ink",
            )}
          >
            {payload.method}
          </span>
          <code className="truncate font-mono text-[0.8125rem] font-medium text-foreground">{payload.path}</code>
          <Phase2Badge label="— not sent" />
        </div>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}>
            <Button size="sm" disabled data-testid="mdm-sl-send" aria-describedby="sl-send-why">
              <Send aria-hidden />
              Send to Service Layer
            </Button>
          </TooltipTrigger>
          <TooltipContent id="sl-send-why" className="max-w-[300px]">
            Phase 2. At about 80 requests a month, posting directly saves too few hours to pay back yet, so phase 1 imports
            through DTW after the MDM check. Nothing is sent from this prototype.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <pre className="max-h-[360px] overflow-auto rounded-lg border bg-muted/50 px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-foreground">
          {json}
        </pre>
        <div className="rounded-lg border px-3 py-2.5">
          <p className="text-[0.8125rem] font-semibold text-foreground">Field-length validator</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {failing ? `${failing} field${failing === 1 ? "" : "s"} too long` : "All checked fields fit"} · SAP B1 10.0 SDK limits
          </p>
          {checks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No length-limited fields in this payload.</p>
          ) : (
            <ul className="space-y-1">
              {checks.map((c) => (
                <li key={c.property} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {c.check.ok ? (
                      <Check aria-label="Fits" className="size-3.5 shrink-0 text-ok-ink" />
                    ) : (
                      <X aria-label="Too long" className="size-3.5 shrink-0 text-stuck-ink" />
                    )}
                    <code className="truncate font-mono text-foreground">{c.property}</code>
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
        In phase 2, a business partner and its child rows go in one <code className="font-mono">$batch</code> request so they
        are created together or not at all.
      </p>
    </div>
  );
}
