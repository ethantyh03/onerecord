"use client";

import { MessageCircleQuestion } from "lucide-react";
import { SlaChip } from "@/components/common";
import { MsAvatar } from "@/components/mocks/shared";
import type { ApprovalStep, DomainConfig, MdmRequest, Person } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface WaitingEntry {
  request: MdmRequest;
  step: ApprovalStep;
  /** Business days left on the step's SLA (Infinity while paused on a question). */
  remaining: number;
}

export interface WaitingListProps {
  items: WaitingEntry[];
  selectedKey: string | null;
  onSelect: (entry: WaitingEntry) => void;
  people: Person[];
  domains: DomainConfig[];
  personName: string;
}

/** "Waiting on me": every step assigned to the persona, closest deadline first. */
export function WaitingList({ items, selectedKey, onSelect, people, domains, personName }: WaitingListProps) {
  return (
    <section aria-labelledby="waiting-heading" className="rounded-xl border border-border bg-card shadow-raised">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 pt-3.5 pb-3">
        <div>
          <h2 id="waiting-heading" className="text-[0.9375rem] font-semibold text-foreground">
            Waiting on me
          </h2>
          <p className="text-xs text-muted-foreground">Closest deadline first</p>
        </div>
        <span
          className={cn(
            "num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold",
            items.length > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          aria-label={`${items.length} waiting`}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Nothing is waiting on {personName}. New approvals land here and in Teams.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {items.map((entry) => {
            const { request, step } = entry;
            const key = `${request.id}:${step.id}`;
            const active = key === selectedKey;
            const requestor = people.find((p) => p.id === request.requestorId);
            const domain = domains.find((d) => d.id === request.domainId);
            return (
              <li key={key}>
                <button
                  type="button"
                  data-testid={`waiting-item-${request.id}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => onSelect(entry)}
                  className={cn(
                    "relative block w-full px-4 py-3 text-left transition-colors outline-none focus-visible:bg-accent",
                    active ? "bg-primary-soft" : "hover:bg-muted/70",
                  )}
                >
                  {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" aria-hidden="true" /> : null}
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="num font-semibold text-foreground">{request.id}</span>
                    <span>{domain?.label ?? request.domainId}</span>
                    {step.status === "question" ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-secondary-foreground">
                        <MessageCircleQuestion className="size-3.5" aria-hidden="true" />
                        Question open
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm leading-snug font-medium text-foreground">{request.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{step.label}</span>
                  <span className="mt-2 flex items-center gap-2">
                    <MsAvatar person={requestor} size={20} />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{requestor?.name ?? request.requestorId}</span>
                    <SlaChip step={step} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
