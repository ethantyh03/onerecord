"use client";

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ENVIRONMENT_TAG_DETAIL, ENVIRONMENT_TAG_QUALIFIER, ENVIRONMENT_TAG_SHORT } from "./copy";

/**
 * The one environment tag, in the status bar on every screen from tablet width up: "Sandbox · synthetic
 * data" ("Sandbox" below xl; on phones the footer carries it). Quiet bordered label, focusable, with
 * the detail in a tooltip.
 */
export function EnvironmentTag({ className }: { className?: string }) {
  return (
    // The tooltip opens to the left, inside the top bar, and closes the moment the pointer leaves the tag:
    // opened below, it covered the page's top-right controls (e.g. Regional Pulse's "Raw SAP records") and
    // swallowed the next click.
    <Tooltip disableHoverablePopup>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            data-testid="environment-tag"
            className={cn(
              "inline-flex h-6 shrink-0 cursor-default items-center gap-1.5 rounded-sm border border-border-strong px-2 text-xs leading-4 whitespace-nowrap text-muted-foreground",
              "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              className,
            )}
          />
        }
      >
        <FlaskConical aria-hidden className="size-3.5 shrink-0 text-subtle" strokeWidth={2} />
        <span>
          {ENVIRONMENT_TAG_SHORT}
          <span className="hidden xl:inline"> · {ENVIRONMENT_TAG_QUALIFIER}</span>
        </span>
        <span className="sr-only">. {ENVIRONMENT_TAG_DETAIL}</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-64 text-pretty">
        {ENVIRONMENT_TAG_DETAIL}
      </TooltipContent>
    </Tooltip>
  );
}
