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

/** Request-type cards, straight from config.domains (enabled only). */
export function TypePicker({ domains, selectedId, onSelect, collapsed, onExpand }: TypePickerProps) {
  const enabled = domains.filter((d) => d.enabled);
  const selected = enabled.find((d) => d.id === selectedId);

  if (collapsed && selected) {
    const Icon = ICONS[selected.icon] ?? FileText;
    const copy = cardCopy(selected);
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary-soft px-3.5 py-2 shadow-raised">
        <div role="radiogroup" aria-label="Request type" className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            role="radio"
            aria-checked
            data-testid={`request-type-${selected.id}`}
            onClick={onExpand}
            title="Change the request type"
            className="flex min-w-0 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon aria-hidden className="size-4" />
            </span>
            <span className="shrink-0 text-sm font-semibold text-primary">{copy.label}</span>
            <span className="hidden truncate text-[0.8125rem] text-muted-foreground sm:inline">· {copy.description}</span>
          </button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" data-testid="request-type-change" onClick={onExpand}>
          <ArrowLeftRight aria-hidden />
          Change type
        </Button>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Request type" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
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
              "group flex min-w-0 flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 text-left outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              on
                ? "border-primary bg-primary-soft shadow-[inset_0_0_0_1px_var(--primary)]"
                : "border-border bg-card hover:border-border-strong hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
                on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
            </span>
            <span className={cn("w-full truncate text-sm leading-5 font-semibold", on ? "text-primary" : "text-foreground")}>{copy.label}</span>
            <span className="line-clamp-2 min-h-[2lh] text-[0.75rem] leading-snug text-muted-foreground">{copy.description}</span>
          </button>
        );
      })}
    </div>
  );
}
