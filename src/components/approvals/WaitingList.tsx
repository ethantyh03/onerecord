"use client";

import { MessageCircleQuestion } from "lucide-react";
import { PersonAvatar, SapCode, SlaChip, StatusText } from "@/components/common";
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

/**
 * "Waiting on me": every step assigned to the persona, closest deadline first, as dense rows inside the queue panel
 * (the panel and its "Waiting on me" header belong to the workspace). The open card's row is raised; no rail.
 */
export function WaitingList({ items, selectedKey, onSelect, people, domains, personName }: WaitingListProps) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-muted-foreground">
        0 waiting<span className="sr-only"> on {personName}</span>
      </p>
    );
  }
  return (
    <ol aria-labelledby="waiting-heading" className="divide-y divide-border">
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
                "group/row block w-full px-4 py-3 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active ? "bg-secondary" : "hover:bg-secondary/50",
              )}
            >
              <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
                <span className="text-sm">
                  <SapCode code={request.id} variant="plain" />
                </span>
                <span className="truncate">{domain?.label ?? request.domainId}</span>
                {step.status === "question" ? (
                  <StatusText tone="warn" size="sm" icon={<MessageCircleQuestion />} className="ml-auto self-center">
                    Question open
                  </StatusText>
                ) : null}
              </span>
              <span className="mt-1 line-clamp-2 block text-sm leading-snug font-medium text-foreground">{request.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{step.label}</span>
              <span className="mt-2 flex items-center gap-2">
                <PersonAvatar person={requestor} size="xs" />
                <span className="min-w-0 flex-1 truncate text-xs text-secondary-foreground">{requestor?.name ?? request.requestorId}</span>
                <SlaChip step={step} />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
