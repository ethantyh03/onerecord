"use client";

import type { ReactNode } from "react";
import {
  BellRing,
  Check,
  CircleAlert,
  CornerDownRight,
  Database,
  MessageCircleQuestion,
  Pause,
  Send,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  X,
} from "lucide-react";
import type { AppConfig, ApprovalStep, DomainConfig, MdmRequest } from "@/lib/types";
import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import { useSandbox } from "@/lib/store";
import { personById, useNow } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import {
  PersonAvatar,
  SapCode,
  SlaChip,
  StatusBadge,
  firstName,
  formatDays,
  formatSgd,
  formatSgtDateTime,
  formatSgtDay,
} from "@/components/common";
import { businessStages, mdmStep, type LinkedDemand } from "./tracker-utils";

type NodeState = "done" | "active" | "paused" | "failed" | "upcoming" | "unreached";

const RAIL: Record<NodeState, string> = {
  done: "border-solid border-ok/55",
  active: "border-dashed border-primary/40",
  paused: "border-dashed border-warn/60",
  failed: "border-dashed border-border-strong",
  upcoming: "border-dashed border-border-strong",
  unreached: "border-dashed border-border",
};

function Node({ state, n }: { state: NodeState; n: number }) {
  const base = "relative z-10 inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold";
  switch (state) {
    case "done":
      return (
        <span className={cn(base, "bg-ok text-ok-foreground")}>
          <Check aria-hidden className="size-4.5" strokeWidth={2.75} />
        </span>
      );
    case "active":
      return (
        <span className={cn(base, "bg-primary text-primary-foreground")}>
          <span aria-hidden className="absolute -inset-1.5 -z-10 rounded-full bg-primary/25 motion-safe:animate-pulse" />
          <span className="num">{n}</span>
        </span>
      );
    case "paused":
      return (
        <span className={cn(base, "bg-warn text-warn-foreground")}>
          <span aria-hidden className="absolute -inset-1.5 -z-10 rounded-full bg-warn/30 motion-safe:animate-pulse" />
          <Pause aria-hidden className="size-4" strokeWidth={2.5} />
        </span>
      );
    case "failed":
      return (
        <span className={cn(base, "bg-stuck text-stuck-foreground")}>
          <X aria-hidden className="size-4.5" strokeWidth={2.75} />
        </span>
      );
    case "unreached":
      return <span className={cn(base, "border border-dashed border-border-strong bg-card text-muted-foreground/70")}><span className="num">{n}</span></span>;
    default:
      return (
        <span className={cn(base, "border-2 border-border-strong bg-card text-muted-foreground")}>
          <span className="num">{n}</span>
        </span>
      );
  }
}

const STATE_SR: Record<NodeState, string> = {
  done: "Done",
  active: "In progress",
  paused: "Paused",
  failed: "Stopped",
  upcoming: "Not started",
  unreached: "Not reached",
};

function Milestone({
  n,
  state,
  title,
  meta,
  time,
  last,
  testid,
  children,
}: {
  n: number;
  state: NodeState;
  title: ReactNode;
  meta?: ReactNode;
  time?: string;
  last?: boolean;
  testid?: string;
  children?: ReactNode;
}) {
  return (
    <li
      className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 pb-7 last:pb-0"
      data-testid={testid}
      data-state={state}
      aria-current={state === "active" || state === "paused" ? "step" : undefined}
    >
      {!last ? (
        <span aria-hidden className={cn("absolute top-10 bottom-1 left-[1.125rem] -translate-x-1/2 border-l-2", RAIL[state])} />
      ) : null}
      <Node state={state} n={n} />
      <div className={cn("min-w-0 pt-1.5", state === "unreached" && "opacity-55")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
            {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
            <span className="sr-only">{STATE_SR[state]}</span>
          </div>
          {time ? <span className="num text-xs whitespace-nowrap text-muted-foreground">{time}</span> : null}
        </div>
        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
    </li>
  );
}

function CheckLine({ tone = "ok", children }: { tone?: "ok" | "warn" | "muted"; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-secondary-foreground">
      {tone === "ok" ? (
        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.5} />
      ) : tone === "warn" ? (
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-ink" />
      ) : (
        <CornerDownRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 text-pretty">{children}</span>
    </p>
  );
}

function stageState(steps: ApprovalStep[]): NodeState {
  if (steps.some((s) => s.status === "rejected")) return "failed";
  if (steps.every((s) => s.status === "approved" || s.status === "skipped")) return "done";
  if (steps.some((s) => s.status === "question")) return "paused";
  if (steps.some((s) => s.status === "pending")) return "active";
  return "upcoming";
}

function latestDecision(steps: ApprovalStep[]): string | undefined {
  const ts = steps.map((s) => s.decidedAt).filter((x): x is string => !!x);
  return ts.sort().at(-1);
}

// ---------------------------------------------------------------------------------------------

function StepCard({ step, req, now, people }: { step: ApprovalStep; req: MdmRequest; now: string; people: { config: AppConfig } }) {
  const assignee = personById(people, step.assigneeId);
  const original = personById(people, step.originalAssigneeId);
  const requestor = personById(people, req.requestorId);
  const escalateAfter = useSandbox((s) => s.config.sla.escalateAfterBusinessDays);
  const elapsed = stepElapsedBusinessDays(step, now);
  const active = step.status === "pending" || step.status === "question";

  let waiting: string;
  switch (step.status) {
    case "pending":
      waiting = `Waiting ${formatDays(elapsed)} business day${formatDays(elapsed) === "1" ? "" : "s"}`;
      break;
    case "question":
      waiting = `Clock paused · ${formatDays(elapsed)} business days used`;
      break;
    case "approved":
    case "rejected":
      waiting = step.decidedAt ? `Decided ${formatSgtDateTime(step.decidedAt)}` : "Decided";
      break;
    case "skipped":
      waiting = "Not needed for this request";
      break;
    default:
      waiting = "Starts when the previous stage is approved";
  }

  return (
    <div
      data-testid={`tracker-step-${step.id}`}
      data-status={step.status}
      className={cn(
        "relative flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card p-3.5",
        step.status === "pending" && "border-primary/35 bg-primary-soft/45",
        step.status === "question" && "border-warn/50 bg-warn-soft/50",
        step.status === "rejected" && "border-stuck/40 bg-stuck-soft/60",
        step.status === "approved" && "border-ok/25",
        (step.status === "waiting" || step.status === "skipped") && "border-dashed",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative">
          <PersonAvatar person={assignee} size="lg" away={assignee?.outOfOffice} />
          {active ? (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 flex size-3">
              <span className="absolute inset-0 rounded-full bg-primary/50 motion-safe:animate-ping [animation-duration:2s]" />
              <span className="relative size-3 rounded-full border-2 border-card bg-primary" />
            </span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-foreground">{assignee?.name ?? "Unassigned"}</span>
            <StatusBadge status={step.status} size="sm" />
          </div>
          <p className="text-[0.8125rem] leading-snug text-muted-foreground">{step.label}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SlaChip step={step} />
        <span className="num text-xs text-secondary-foreground">{waiting}</span>
      </div>

      {step.addedBecause ? (
        <span className="inline-flex w-fit max-w-full items-start gap-1.5 rounded-md border border-primary/20 bg-primary-soft px-2 py-1 text-xs text-accent-foreground">
          <Sparkles aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="text-pretty">Added because {step.addedBecause}</span>
        </span>
      ) : null}

      {step.escalatedAt || step.originalAssigneeId || step.reminderSentAt ? (
        <div className="space-y-1 text-xs text-secondary-foreground">
          {step.reminderSentAt ? (
            <p className="flex items-center gap-1.5">
              <BellRing aria-hidden className="size-3.5 text-warn-ink" />
              Reminder sent {formatSgtDateTime(step.reminderSentAt)}
            </p>
          ) : null}
          {step.escalatedAt ? (
            <p className="flex items-start gap-1.5">
              <UserRoundCog aria-hidden className="mt-px size-3.5 shrink-0 text-stuck-ink" />
              <span>
                {original
                  ? `Escalated to ${assignee?.name ?? "the delegate"} after ${escalateAfter} business days with no decision from ${original.name}.`
                  : `No decision after ${escalateAfter} business days, so the MDM team was alerted.`}{" "}
                <span className="num text-muted-foreground">{formatSgtDateTime(step.escalatedAt)}</span>
              </span>
            </p>
          ) : original ? (
            <p className="flex items-start gap-1.5">
              <UserRoundCog aria-hidden className="mt-px size-3.5 shrink-0 text-muted-foreground" />
              <span>Covering for {original.name} (out-of-office delegate)</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {step.comment && step.comment !== step.question?.text ? (
        <p className="border-l-2 border-border-strong pl-2.5 text-[0.8125rem] text-secondary-foreground italic">“{step.comment}”</p>
      ) : null}

      {step.question ? (
        <div className="space-y-2 rounded-md border border-border bg-background/70 p-2.5" data-testid={`tracker-question-${step.id}`}>
          <div className="flex items-start gap-2">
            <MessageCircleQuestion aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-ink" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {assignee ? firstName(assignee.name) : "Approver"} asked · <span className="num">{formatSgtDateTime(step.question.askedAt)}</span>
              </p>
              <p className="text-[0.8125rem] text-foreground text-pretty">{step.question.text}</p>
            </div>
          </div>
          {step.question.answer ? (
            <div className="ml-6 flex items-start gap-2">
              <PersonAvatar person={requestor} size="xs" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {requestor ? firstName(requestor.name) : "Requestor"} answered ·{" "}
                  <span className="num">{step.question.answeredAt ? formatSgtDateTime(step.question.answeredAt) : ""}</span>
                </p>
                <p className="text-[0.8125rem] text-foreground text-pretty">{step.question.answer}</p>
                <p className="mt-1 text-xs text-muted-foreground">Back with the same approver; the chain did not restart.</p>
              </div>
            </div>
          ) : (
            <p className="ml-6 text-xs text-warn-ink">
              Waiting for {requestor ? firstName(requestor.name) : "the requestor"}&apos;s answer. The SLA clock is paused.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

export interface DeliveryTrackerProps {
  request: MdmRequest;
  domain: DomainConfig | undefined;
  demand: LinkedDemand;
}

/** Submitted → Checks passed → approval stages → MDM final check → Created in SAP B1 → Requestor notified. */
export function DeliveryTracker({ request: req, domain, demand }: DeliveryTrackerProps) {
  const now = useNow(20_000);
  const config = useSandbox((s) => s.config);
  const sla = config.sla;
  const view = { config };
  const requestor = personById(view, req.requestorId);
  const reqFirst = requestor ? firstName(requestor.name) : "The requestor";

  const stages = businessStages(req);
  const mdm = mdmStep(req);
  const submitted = !!req.submittedAt && req.status !== "draft";
  const created = req.status === "created";
  const stopped = req.status === "rejected" || req.status === "cancelled";
  const rejectedStep = req.steps.find((s) => s.status === "rejected");
  const rejectedBy = personById(view, rejectedStep?.assigneeId);

  let n = 0;
  let reachedStop = false;
  const unreached = (s: NodeState): NodeState => (reachedStop && s !== "done" ? "unreached" : s);

  const items: ReactNode[] = [];

  // 1. Submitted
  n++;
  items.push(
    <Milestone
      key="submitted"
      n={n}
      testid="tracker-submitted"
      state={submitted ? "done" : "active"}
      title="Submitted"
      time={req.submittedAt ? formatSgtDateTime(req.submittedAt) : undefined}
    >
      <p className="flex items-center gap-2 text-sm text-secondary-foreground">
        <PersonAvatar person={requestor} size="sm" />
        {submitted ? (
          <span>
            {requestor?.name ?? "Requestor"} sent the {domain?.label.toLowerCase() ?? "request"} request
          </span>
        ) : (
          <span>Draft — {requestor?.name ?? "the requestor"} has not submitted it yet.</span>
        )}
      </p>
    </Milestone>,
  );

  // 2. Checks passed
  n++;
  const dd = req.duplicateDecision;
  const aiCount = req.aiFilledKeys?.length ?? 0;
  items.push(
    <Milestone key="checks" n={n} testid="tracker-checks" state={submitted ? "done" : "upcoming"} title="Checks passed" meta="before any approver sees it" time={req.submittedAt ? formatSgtDateTime(req.submittedAt) : undefined}>
      {submitted ? (
        <div className="space-y-1.5">
          <CheckLine>
            All required fields complete and within SAP B1 field limits
            {aiCount ? ` · ${aiCount} fields pre-filled from pasted text and confirmed by ${reqFirst}` : ""}
          </CheckLine>
          {dd ? (
            <CheckLine tone={dd.choice === "override" ? "warn" : "ok"}>
              Possible duplicate <span className="font-medium text-foreground">{dd.matchName}</span> <SapCode code={dd.matchCode} /> ·{" "}
              {Math.round(dd.score * 100)}% match ({dd.reasons.join(", ")}) →{" "}
              {dd.choice === "extend"
                ? `extend the existing record to ${req.entity} instead of creating a new one`
                : dd.choice === "use_existing"
                  ? "use the existing record"
                  : `kept as a new record: “${dd.justification ?? "no reason given"}” (flagged to MDM)`}
            </CheckLine>
          ) : (
            <CheckLine>{domain?.dupCheck ? "No likely duplicates found in SAP B1" : "Duplicate check not needed for this request type"}</CheckLine>
          )}
          {demand.blockedCount + demand.releasedCount > 0 ? (
            <CheckLine tone="muted">
              Linked {demand.blockedCount + demand.releasedCount} waiting customer order
              {demand.blockedCount + demand.releasedCount === 1 ? "" : "s"} ({formatSgd(demand.blockedSgd + demand.releasedSgd)}) to this request
            </CheckLine>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Completeness and duplicate checks run when the request is submitted.</p>
      )}
    </Milestone>,
  );

  // 3. Approval stages
  for (const stage of stages) {
    n++;
    let state: NodeState = submitted ? stageState(stage.steps) : "upcoming";
    if (req.status === "cancelled" && state !== "done") state = "unreached";
    state = unreached(state);
    if (state === "failed") reachedStop = true;
    const decided = state === "done" ? latestDecision(stage.steps) : undefined;
    const parallel = stage.mode === "parallel" && stage.steps.length > 1;
    items.push(
      <Milestone
        key={`stage-${stage.stageIndex}`}
        n={n}
        testid={`tracker-stage-${stage.stageIndex}`}
        state={state}
        title={stage.label}
        meta={parallel ? `In parallel · ${stage.steps.length} approvers` : stage.steps.length > 1 ? "One after another" : undefined}
        time={decided ? formatSgtDateTime(decided) : undefined}
      >
        <div className={cn("grid gap-3", parallel ? "sm:grid-cols-2 2xl:grid-cols-3" : "")}>
          {stage.steps.map((step) => (
            <StepCard key={step.id} step={step} req={req} now={now} people={view} />
          ))}
        </div>
      </Milestone>,
    );
  }

  // 4. MDM final check
  n++;
  {
    let state: NodeState = created ? "done" : mdm ? (submitted ? stageState([mdm]) : "upcoming") : "upcoming";
    if (stopped && state !== "done") state = "unreached";
    items.push(
      <Milestone
        key="mdm"
        n={n}
        testid="tracker-mdm"
        state={state}
        title="MDM final check"
        meta="data quality, then the SAP B1 import"
        time={mdm?.decidedAt ? formatSgtDateTime(mdm.decidedAt) : undefined}
      >
        {mdm ? <StepCard step={mdm} req={req} now={now} people={view} /> : null}
        {req.dtwGeneratedAt && !created ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-secondary-foreground">
            <Database aria-hidden className="size-3.5 text-primary" />
            SAP B1 import file (DTW) generated {formatSgtDateTime(req.dtwGeneratedAt)}
          </p>
        ) : null}
      </Milestone>,
    );
  }

  // 5. Created in SAP B1
  n++;
  {
    const state: NodeState = created ? "done" : stopped ? "unreached" : "upcoming";
    const isExtend = req.domainId === "extend";
    items.push(
      <Milestone
        key="sap"
        n={n}
        testid="tracker-sap"
        state={state}
        title={isExtend ? "Updated in SAP B1" : "Created in SAP B1"}
        meta="Simulated SAP B1"
        time={req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : undefined}
      >
        {created ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-secondary-foreground">
            <ShieldCheck aria-hidden className="size-4 text-ok" />
            {isExtend ? "Existing record extended, same code" : "Live as"} <SapCode code={req.sapCode} className="text-sm" />
            {demand.releasedCount ? (
              <span className="text-ok-ink">
                · {demand.releasedCount} waiting order{demand.releasedCount === 1 ? "" : "s"} released ({formatSgd(demand.releasedSgd)})
              </span>
            ) : null}
          </p>
        ) : stopped ? (
          <p className="text-sm text-muted-foreground">Not reached.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {req.expectedBy ? (
              <>
                Expected live <span className="font-medium text-foreground">{formatSgtDay(req.expectedBy)}</span>, by DTW import after the
                MDM check.
              </>
            ) : (
              "Loaded by DTW import after the MDM check."
            )}
          </p>
        )}
      </Milestone>,
    );
  }

  // 6. Requestor notified
  n++;
  items.push(
    <Milestone
      key="notified"
      n={n}
      last
      testid="tracker-notified"
      state={created ? "done" : stopped ? "unreached" : "upcoming"}
      title="Requestor notified"
      time={created && req.sapCreatedAt ? formatSgtDateTime(req.sapCreatedAt) : undefined}
    >
      {created ? (
        <p className="flex items-center gap-2 text-sm text-secondary-foreground">
          <Send aria-hidden className="size-4 text-primary" />
          {requestor?.name ?? "The requestor"} was told in Teams and Outlook (simulated) with the new code.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {reqFirst} gets a Teams message and an email the moment the record is live.
        </p>
      )}
    </Milestone>,
  );

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-raised" aria-labelledby="tracker-heading">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 id="tracker-heading" className="text-base font-semibold text-foreground">
            Delivery tracker
          </h2>
          <p className="text-sm text-muted-foreground">Where this request is right now, and who it is waiting on.</p>
        </div>
        <span
          data-testid="tracker-sla-rule"
          className="inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-background px-3 text-xs font-medium text-secondary-foreground"
        >
          <BellRing aria-hidden className="size-3.5 text-warn-ink" />
          Reminder after {sla.reminderAfterBusinessDays} business day{sla.reminderAfterBusinessDays === 1 ? "" : "s"} · escalation after{" "}
          {sla.escalateAfterBusinessDays}
        </span>
      </div>

      {req.status === "rejected" && rejectedStep ? (
        <div role="status" className="flex items-start gap-2 border-b border-stuck/25 bg-stuck-soft px-5 py-3 text-sm text-stuck-ink">
          <X aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">
            Rejected by {rejectedBy?.name ?? "an approver"} at “{rejectedStep.label}”
            {rejectedStep.comment ? `: “${rejectedStep.comment}”` : ""}. Sent back to {reqFirst} with the reason.
          </span>
        </div>
      ) : null}
      {req.status === "cancelled" ? (
        <div role="status" className="flex items-start gap-2 border-b border-border bg-muted px-5 py-3 text-sm text-secondary-foreground">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Withdrawn by the requestor{req.closedAt ? ` on ${formatSgtDateTime(req.closedAt)}` : ""}. Nothing was created in SAP B1.
        </div>
      ) : null}

      <ol className="px-5 py-6" data-testid="tracker-timeline" aria-label="Delivery tracker">
        {items}
      </ol>
    </section>
  );
}
