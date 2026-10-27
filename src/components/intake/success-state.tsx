"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, Link2, MessageSquareMore, Plus } from "lucide-react";
import type { MdmRequest, Person, PurchaseRequest } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { PersonAvatar, SapCode, formatSgd } from "@/components/common";
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
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-float"
    >
      <div className="flex items-start gap-4 border-b border-border px-7 py-6">
        <motion.span
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 18, delay: 0.1 }}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-ok text-ok-foreground"
        >
          <CircleCheck aria-hidden className="size-7" />
        </motion.span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-muted-foreground">Submitted for approval</p>
          <h2 className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[1.5rem] leading-tight font-semibold tracking-tight">
            <SapCode code={request.id} className="text-[0.9em]" />
            <span>{request.title}</span>
          </h2>
          {request.expectedBy ? (
            <p className="mt-1.5 text-[0.9375rem] text-foreground/90">
              Expected live in SAP B1: <strong>{formatLiveDate(request.expectedBy)}</strong>
              <span className="text-muted-foreground"> · today by email: median 14 days</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-7 py-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-teams/12 text-teams" style={{ background: "color-mix(in oklch, var(--teams) 12%, transparent)" }}>
            <MessageSquareMore aria-hidden className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium" data-testid="success-teams">
              Teams approval cards sent to {recipients.length ? joinNames(recipients.map((p) => p.name)) : "the approvers"}
              <span className="ml-2 rounded-full border border-border px-1.5 py-px align-middle text-[0.6875rem] font-normal text-muted-foreground">
                Simulated
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recipients.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pr-2.5 pl-0.5 text-[0.75rem]">
                  <PersonAvatar person={p} size="xs" />
                  {p.name}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
              They approve in parallel from Teams or Outlook. A reminder goes out after 1 business day, an escalation after 3.
            </p>
          </div>
        </div>

        {linked.length ? (
          <div className="flex items-start gap-3" data-testid="success-linked">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-stuck-soft text-stuck-ink">
              <Link2 aria-hidden className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {linked.length} waiting customer order{linked.length === 1 ? "" : "s"} ({formatSgd(linkedSgd)}) linked to this request
              </p>
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {linked.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-1.5 text-[0.8125rem]">
                    <SapCode code={p.id} variant="plain" />
                    <span className="min-w-0 flex-1 truncate">{p.customerName}</span>
                    <span className="text-muted-foreground">{p.country}</span>
                    <span className="num w-20 text-right font-medium">{formatSgd(p.sgd)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[0.75rem] text-muted-foreground">
                They are released automatically the moment the record is created in SAP B1.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-7 py-4">
        <Link
          href={`/requests/view?id=${encodeURIComponent(request.id)}`}
          data-testid="success-track"
          className={cn(buttonVariants({ variant: "default" }), "h-10 px-4")}
        >
          Track this request
          <ArrowRight aria-hidden />
        </Link>
        <Button type="button" variant="outline" className="h-10 px-4" data-testid="success-new" onClick={onNew}>
          <Plus aria-hidden />
          New request
        </Button>
      </div>
    </motion.section>
  );
}
