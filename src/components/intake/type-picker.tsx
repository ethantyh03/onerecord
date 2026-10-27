"use client";

import { FileText, GitBranchPlus, Hospital, Landmark, Package, Truck, type LucideIcon } from "lucide-react";
import type { DomainConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Building2: Hospital,
  Hospital,
  Truck,
  Package,
  Landmark,
  GitBranchPlus,
};

export interface TypePickerProps {
  domains: DomainConfig[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/** Request-type cards, straight from config.domains (enabled only). */
export function TypePicker({ domains, selectedId, onSelect }: TypePickerProps) {
  const enabled = domains.filter((d) => d.enabled);
  return (
    <div role="radiogroup" aria-label="Request type" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {enabled.map((d) => {
        const Icon = ICONS[d.icon] ?? FileText;
        const on = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`request-type-${d.id}`}
            onClick={() => onSelect(d.id)}
            className={cn(
              "group flex min-h-[5.5rem] flex-col items-start gap-1.5 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              on
                ? "border-primary bg-primary-soft shadow-[inset_0_0_0_1px_var(--primary)]"
                : "border-border bg-card hover:border-border-strong hover:bg-muted/50",
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg",
                  on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              <span className={cn("text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{d.label}</span>
            </span>
            <span className="line-clamp-2 text-[0.75rem] leading-snug text-muted-foreground">{d.description}</span>
          </button>
        );
      })}
    </div>
  );
}
