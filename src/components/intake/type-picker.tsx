"use client";

import { ArrowLeftRight, FileText, GitBranchPlus, Hospital, Landmark, Package, Truck, type LucideIcon } from "lucide-react";
import type { DomainConfig } from "@/lib/types";
import { DEFAULT_DOMAINS } from "@/config/default-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Building2: Hospital,
  Hospital,
  Truck,
  Package,
  Landmark,
  GitBranchPlus,
};

/**
 * Card-sized copy for the built-in request types. Used only while the admin hasn't renamed the type or
 * rewritten its description, so config edits always win.
 */
const SHORT: Record<string, { label: string; description: string }> = {
  customer: { label: "New Customer", description: "Hospital, lab or clinic we sell to" },
  vendor: { label: "New Vendor", description: "Supplier or service provider we pay" },
  item: { label: "New Item", description: "Reagent, consumable or instrument" },
  costcentre: { label: "New Cost Centre", description: "Profit centre for a team or site" },
  extend: { label: "Extend a record", description: "Add an entity to an existing customer" },
};

function cardCopy(d: DomainConfig): { label: string; description: string } {
  const def = DEFAULT_DOMAINS.find((x) => x.id === d.id);
  const short = SHORT[d.id];
  return {
    label: short && def && def.label === d.label ? short.label : d.label,
    description: short && def && def.description === d.description ? short.description : d.description,
  };
}

export interface TypePickerProps {
  domains: DomainConfig[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Show only the chosen type as one compact row (the type is already known). */
  collapsed?: boolean;
  onExpand?: () => void;
}

/** Request-type options, straight from config.domains (enabled only). */
export function TypePicker({ domains, selectedId, onSelect, collapsed, onExpand }: TypePickerProps) {
  const enabled = domains.filter((d) => d.enabled);
  const selected = enabled.find((d) => d.id === selectedId);

  if (collapsed && selected) {
    const Icon = ICONS[selected.icon] ?? FileText;
    const copy = cardCopy(selected);
    // The type is known: one ruled line (no box, no rail), with the way back on the right.
    return (
      <div className="flex min-h-11 items-center gap-3 border-y border-border py-1">
        <div role="radiogroup" aria-label="Request type" className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            role="radio"
            aria-checked
            data-testid={`request-type-${selected.id}`}
            onClick={onExpand}
            title="Change the request type"
            className="flex min-w-0 items-center gap-2.5 rounded-sm text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon aria-hidden className="size-4 shrink-0 text-foreground" />
            <span className="font-wide shrink-0 text-[0.9375rem] font-semibold text-foreground">{copy.label}</span>
            <span className="hidden truncate text-[0.8125rem] text-muted-foreground sm:inline">· {copy.description}</span>
          </button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="-mr-2 shrink-0" data-testid="request-type-change" onClick={onExpand}>
          <ArrowLeftRight aria-hidden />
          Change type
        </Button>
      </div>
    );
  }

  // A ruled option table, not a row of cards: hairlines between the options and above/below the set, no box per
  // option, no rail. Five across when the column is wide enough, otherwise three or two per row; the grid is
  // nudged 1px past the clip box so only the inner rules show at any column count (an unfilled last slot stays
  // closed off by the last option's right rule). The chosen type is the raised fill, like a selected row.
  return (
    <div className="@container overflow-hidden border-y border-border">
      <div
        role="radiogroup"
        aria-label="Request type"
        className="-mx-px -mb-px grid w-[calc(100%+2px)] grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-5"
      >
        {enabled.map((d) => {
          const Icon = ICONS[d.icon] ?? FileText;
          const on = d.id === selectedId;
          const copy = cardCopy(d);
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-testid={`request-type-${d.id}`}
              onClick={() => onSelect(d.id)}
              title={d.description}
              className={cn(
                "group flex min-w-0 flex-col items-start gap-1 border-b border-l border-border px-3.5 pt-3 pb-3 text-left transition-colors outline-none last:border-r",
                "focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                on ? "bg-secondary" : "hover:bg-secondary/50",
              )}
            >
              <span className="flex w-full min-w-0 items-center gap-2">
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    on ? "text-foreground" : "text-subtle group-hover:text-muted-foreground",
                  )}
                />
                <span className="truncate text-sm leading-5 font-semibold text-foreground">{copy.label}</span>
              </span>
              <span className="line-clamp-2 min-h-[2lh] pl-6 text-xs leading-4 text-muted-foreground">{copy.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
