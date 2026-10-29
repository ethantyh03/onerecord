"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Plus } from "lucide-react";
import type { MdmRequest, Person, PurchaseRequest } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { PersonAvatar, SapCode, StatusText, formatSgd } from "@/components/common";
import { MDM_STAGE_ID } from "@/lib/engine/routing";
import { cn } from "@/lib/utils";
import { formatLiveDate } from "./intake-logic";

export interface SuccessStateProps {
  request: MdmRequest;
  people: Person[];
  prs: PurchaseRequest[];
  onNew: () => void;
}

function joinNames(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export function SuccessState({ request, people, prs, onNew }: SuccessStateProps) {
  const reduce = useReducedMotion();
  const active = request.steps.filter((s) => s.status === "pending" && s.stageId !== MDM_STAGE_ID);
  const recipients = active.map((s) => people.find((p) => p.id === s.assigneeId)).filter((p): p is Person => !!p);
  const linked = prs.filter((p) => request.blockedPrIds.includes(p.id));
  const linkedSgd = linked.reduce((a, p) => a + p.sgd, 0);

  return (
    <motion.section
      data-testid="submit-success"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="panel max-w-[1120px] overflow-hidden"
    >
      {/* Header: the receipt left (status line, mono ID, title, expected date), the next actions right (kept above the
          fold on a 720px projector). No icon tile: the green square and the words say it went through. */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-border px-6 py-5">
        <div className="min-w-0 flex-1 basis-80">
          <StatusText tone="ok">Submitted for approval</StatusText>
          <h2 className="font-wide mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[1.375rem] leading-7 font-semibold text-foreground">
            <SapCode code={request.id} className="text-[0.75em]" />
            <span>{request.title}</span>
          </h2>
          {request.expectedBy ? (
            <p className="mt-2 text-[0.9375rem] text-secondary-foreground">
              Expected live in SAP B1: <strong className="font-wide num font-semibold text-foreground">{formatLiveDate(request.expectedBy)}</strong>
              <span className="text-muted-foreground"> · today by email: median 14 days</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/requests/view?id=${encodeURIComponent(request.id)}`}
            data-testid="success-track"
            className={cn(buttonVariants({ variant: "default" }), "h-9 px-4")}
          >
            Track this request
            <ArrowRight aria-hidden />
          </Link>
          <Button type="button" variant="outline" className="h-9 px-4" data-testid="success-new" onClick={onNew}>
            <Plus aria-hidden />
            New request
          </Button>
        </div>
      </div>

      <div className="divide-y divide-border">
        <div className="px-6 py-4">
          <p className="text-sm font-medium text-foreground" data-testid="success-teams">
            Teams approval cards sent to {recipients.length ? joinNames(recipients.map((p) => p.name)) : "the approvers"}
            <span className="ml-3 border-l border-border-strong pl-3 text-xs font-normal text-subtle">Simulated</span>
          </p>
          {recipients.length ? (
            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Approvers notified">
              {recipients.map((p) => (
                <li key={p.id} className="inline-flex items-center gap-2 text-[0.8125rem] text-foreground">
                  <PersonAvatar person={p} size="xs" />
                  {p.name}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2.5 text-xs text-muted-foreground">
            They approve in parallel from Teams or Outlook. A reminder goes out after 1 business day, an escalation after 3.
          </p>
        </div>

        {linked.length ? (
          <div className="px-6 py-4" data-testid="success-linked">
            <p className="text-sm font-medium text-foreground">
              {linked.length} waiting customer order{linked.length === 1 ? "" : "s"} (
              <span className="num font-semibold text-stuck">{formatSgd(linkedSgd)}</span>) linked to this request
            </p>
            {/* The orders as ruled rows (money waiting = coral on the total above; rows stay neutral). */}
            <ul className="mt-2.5 divide-y divide-border border-y border-border">
              {linked.map((p) => (
                <li key={p.id} className="flex h-9 items-center gap-4 text-[0.8125rem]">
                  <SapCode code={p.id} className="w-20 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{p.customerName}</span>
                  <span className="w-8 text-muted-foreground">{p.country}</span>
                  <span className="num w-24 text-right font-medium text-foreground">{formatSgd(p.sgd)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">They are released automatically the moment the record is created in SAP B1.</p>
          </div>
        ) : null}
      </div>

    </motion.section>
  );
}
