"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Info,
  MessageCircleQuestion,
  PauseCircle,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import { MaskedValue } from "@/components/common";
import { useSandbox } from "@/lib/store";
import type { ApprovalStep, MdmRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MS_FONT, MsAvatar, TEAMS, findPerson, formatAgo, formatSgd, usePeople, useSimNow } from "./shared";
import { buildKeyFacts, countryName, formatFactValue, teamsSla, type TeamsSlaTone } from "./teams-helpers";

export interface TeamsApprovalCardProps {
  request: MdmRequest;
  step: ApprovalStep;
  onApprove: (comment?: string) => void;
  onReject: (comment: string) => void;
  onAsk: (text: string) => void;
  /** Tighter layout for feeds and the phone frame: 3 facts, smaller paddings. */
  compact?: boolean;
  className?: string;
}

type Mode = "approve" | "reject" | "ask" | null;

const SLA_TONE: Record<TeamsSlaTone, string> = {
  ok: "bg-[#e8ebfa] text-[#444791]",
  soon: "bg-[#fff4ce] text-[#835b00]",
  overdue: "bg-[#fde7e9] text-[#b10e1c]",
  paused: "bg-[#f0f0f0] text-[#424242]",
  done: "bg-[#f0f0f0] text-[#424242]",
};

/**
 * Microsoft Teams "Approvals" Adaptive Card look-alike. The production card is
 * integrations/teams/approval-card.json; this renders the same content in-app.
 */
export function TeamsApprovalCard({
  request,
  step,
  onApprove,
  onReject,
  onAsk,
  compact = false,
  className,
}: TeamsApprovalCardProps) {
  const people = usePeople();
  const sla = useSandbox((s) => s.config.sla);
  const domain = useSandbox((s) => s.config.domains.find((d) => d.id === request.domainId));
  const prs = useSandbox((s) => s.prs);
  const now = useSimNow();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const textId = useId();

  const requestor = findPerson(people, request.requestorId);
  const assignee = findPerson(people, step.assigneeId);
  const original = findPerson(people, step.originalAssigneeId);
  const viewerId = useSandbox((s) => s.personaId);
  const status = teamsSla(step, sla, now);
  const facts = useMemo(
    () => buildKeyFacts(request, domain, { limit: compact ? 3 : 6, role: step.role }),
    [request, domain, compact, step.role],
  );
  const blocked = useMemo(() => {
    const ids = new Set(request.blockedPrIds ?? []);
    const list = prs.filter((p) => ids.has(p.id) && p.status === "blocked");
    return { count: list.length, sgd: list.reduce((sum, p) => sum + p.sgd, 0) };
  }, [prs, request.blockedPrIds]);

  const actionable = step.status === "pending";
  const requestorName = requestor?.name ?? "the requestor";
  const trimmed = text.trim();

  function open(next: Mode) {
    setMode((cur) => (cur === next ? null : next));
    setText("");
  }

  function confirm() {
    if (mode === "approve") onApprove(trimmed || undefined);
    else if (mode === "reject" && trimmed) onReject(trimmed);
    else if (mode === "ask" && trimmed) onAsk(trimmed);
    else return;
    setMode(null);
    setText("");
  }

  const pad = compact ? "px-3" : "px-4";

  return (
    <article
      aria-label={`Approval request: ${request.title}`}
      className={cn(
        "overflow-hidden rounded-[6px] border border-[#e0e0e0] bg-white text-[#242424]",
        "shadow-[0_1.6px_3.6px_rgba(0,0,0,0.11),0_0.3px_0.9px_rgba(0,0,0,0.09)]",
        className,
      )}
      style={{ fontFamily: MS_FONT }}
    >
      <div className="h-1" style={{ background: TEAMS.purple }} aria-hidden="true" />

      {/* App header */}
      <header className={cn("flex items-center gap-2 pt-2.5 pb-2", pad)}>
        <span
          className="inline-flex size-5 items-center justify-center rounded-[4px] text-white"
          style={{ background: TEAMS.purple }}
          aria-hidden="true"
        >
          <ClipboardCheck className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[12px] font-semibold text-[#424242]">Approvals</span>
        <span className="text-[11px] text-[#616161]">· OneRecord</span>
        {step.activatedAt ? (
          <span className="ml-auto text-[11px] text-[#616161]">{formatAgo(step.activatedAt, now)}</span>
        ) : null}
      </header>

      <div className={cn(pad, compact ? "pb-3" : "pb-4")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className={cn("leading-snug font-semibold", compact ? "text-[14px]" : "text-[16px]")}>{request.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-[#616161]">
              <MsAvatar person={requestor} size={18} />
              <span>
                Requested by <span className="font-semibold text-[#424242]">{requestorName}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{request.entity}</span>
              <span aria-hidden="true">·</span>
              <span>{countryName(request.country)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{request.id}</span>
            </p>
          </div>
          {status.tone !== "done" ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                SLA_TONE[status.tone],
              )}
            >
              {status.tone === "paused" ? <PauseCircle className="size-3" /> : <Clock3 className="size-3" />}
              {status.label}
            </span>
          ) : null}
        </div>

        {original && original.id !== assignee?.id ? (
          <p className="mt-2 flex items-center gap-1.5 rounded-[4px] bg-[#f5f5f5] px-2 py-1 text-[11px] text-[#424242]">
            <UserRoundCog className="size-3.5 shrink-0 text-[#616161]" />
            {viewerId === original.id ? (
              <span>
                {step.escalatedAt ? "Escalated to " : "Delegated to "}
                <span className="font-semibold">{assignee?.name ?? "a delegate"}</span>
                {step.escalatedAt ? " after the SLA passed. You can still decide." : " while you're out of office."}
              </span>
            ) : (
              <span>
                {step.escalatedAt ? "Escalated from " : "Covering for "}
                <span className="font-semibold">{original.name}</span>
                {step.escalatedAt ? " after the SLA passed" : " (out of office)"}
              </span>
            )}
          </p>
        ) : null}

        {/* Key facts (Adaptive Card FactSet) */}
        {facts.length > 0 || blocked.count > 0 ? (
          <dl
            className={cn(
              "mt-3 grid grid-cols-[minmax(96px,38%)_1fr] gap-x-3 gap-y-1.5 border-t border-[#ebebeb] pt-3",
              compact ? "text-[12px]" : "text-[13px]",
            )}
          >
            {facts.map((f) => (
              <div key={f.key} className="contents">
                <dt className="font-semibold text-[#424242]">{f.label}</dt>
                <dd className="min-w-0 break-words text-[#242424]">
                  {f.sensitive ? (
                    <MaskedValue value={f.value} requestId={request.id} fieldKey={f.key} />
                  ) : (
                    formatFactValue(f.value)
                  )}
                </dd>
              </div>
            ))}
            {blocked.count > 0 ? (
              <div className="contents">
                <dt className="font-semibold text-[#424242]">Blocked demand</dt>
                <dd className="font-semibold text-[#835b00]">
                  {blocked.count} customer PR{blocked.count === 1 ? "" : "s"} · {formatSgd(blocked.sgd)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {/* Why you're seeing this */}
        <div className="mt-3 flex gap-2 rounded-[4px] bg-[#f0f0ff] px-2.5 py-2 text-[12px] text-[#3d3e78]">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Why you&apos;re seeing this:</span> you&apos;re assigned the{" "}
            <span className="font-semibold">{step.label}</span> step
            {step.stageMode === "parallel" ? ", in parallel with the other reviewers in this stage" : ""}.
            {step.addedBecause ? <span className="block text-[#5b5c8f]">Added because {step.addedBecause}.</span> : null}
          </p>
        </div>

        {/* Question thread */}
        {step.question ? (
          <div className="mt-3 space-y-1.5 border-l-2 border-[#c7c9f0] pl-2.5 text-[12px]">
            <p>
              <span className="font-semibold">{assignee?.name ?? "Approver"} asked:</span> {step.question.text}
            </p>
            {step.question.answer ? (
              <p>
                <span className="font-semibold">{requestorName} answered:</span> {step.question.answer}
                {step.question.answeredAt ? (
                  <span className="text-[#616161]"> · {formatAgo(step.question.answeredAt, now)}</span>
                ) : null}
              </p>
            ) : (
              <p className="text-[#616161]">Waiting for {requestorName} to answer. The SLA clock is paused.</p>
            )}
          </div>
        ) : null}

        {/* Actions */}
        {actionable ? (
          <>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <TeamsButton primary pressed={mode === "approve"} onClick={() => open("approve")}>
                Approve
              </TeamsButton>
              <TeamsButton pressed={mode === "reject"} onClick={() => open("reject")}>
                Reject
              </TeamsButton>
              <TeamsButton pressed={mode === "ask"} onClick={() => open("ask")}>
                Ask a question
              </TeamsButton>
            </div>
            <AnimatePresence initial={false}>
              {mode ? (
                <motion.div
                  key={mode}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-3">
                    <label htmlFor={textId} className="mb-1 block text-[12px] font-semibold text-[#424242]">
                      {mode === "approve"
                        ? "Comment (optional)"
                        : mode === "reject"
                          ? "Reason for rejecting (required)"
                          : `Question for ${requestorName}`}
                    </label>
                    <textarea
                      id={textId}
                      autoFocus
                      rows={compact ? 2 : 3}
                      value={text}
                      maxLength={500}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) confirm();
                        if (e.key === "Escape") open(null);
                      }}
                      placeholder={
                        mode === "approve"
                          ? "Add a note for the audit trail"
                          : mode === "reject"
                            ? "Tell the requestor what to fix"
                            : "e.g. Please attach the HSA licence certificate"
                      }
                      className="w-full resize-none rounded-[4px] border border-[#d1d1d1] border-b-[#616161] bg-white px-2.5 py-1.5 text-[13px] text-[#242424] outline-none placeholder:text-[#8a8886] focus:border-b-2 focus:border-b-[#5b5fc7]"
                    />
                    {mode === "ask" ? (
                      <p className="mt-1 text-[11px] text-[#616161]">
                        The SLA clock pauses until {requestorName} answers, and the answer comes back to you.
                      </p>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <TeamsButton
                        primary
                        onClick={confirm}
                        disabled={mode !== "approve" && trimmed.length === 0}
                      >
                        {mode === "approve" ? "Confirm approval" : mode === "reject" ? "Confirm rejection" : "Send question"}
                      </TeamsButton>
                      <TeamsButton onClick={() => open(null)}>Cancel</TeamsButton>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <OutcomeBanner step={step} assigneeName={assignee?.name ?? "Approver"} requestorName={requestorName} now={now} />
        )}

        <div className="mt-3 flex items-center border-t border-[#ebebeb] pt-2.5">
          <Link
            href={`/requests/${encodeURIComponent(request.id)}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: TEAMS.purple }}
          >
            View details
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="ml-auto text-[11px] text-[#8a8886]">Stage {step.stageIndex + 1} · {step.stageLabel}</span>
        </div>
      </div>
    </article>
  );
}

function OutcomeBanner({
  step,
  assigneeName,
  requestorName,
  now,
}: {
  step: ApprovalStep;
  assigneeName: string;
  requestorName: string;
  now: string;
}) {
  const when = step.decidedAt ? ` · ${formatAgo(step.decidedAt, now)}` : "";
  if (step.status === "approved") {
    return (
      <Banner tone="green" icon={<CheckCircle2 className="size-4" />}>
        Approved by {assigneeName}
        {when}
        {step.comment ? <span className="block font-normal text-[#424242]">“{step.comment}”</span> : null}
      </Banner>
    );
  }
  if (step.status === "rejected") {
    return (
      <Banner tone="red" icon={<XCircle className="size-4" />}>
        Rejected by {assigneeName}
        {when}
        {step.comment ? <span className="block font-normal text-[#424242]">“{step.comment}”</span> : null}
      </Banner>
    );
  }
  if (step.status === "question") {
    return (
      <Banner tone="amber" icon={<MessageCircleQuestion className="size-4" />}>
        Question sent to {requestorName}. Buttons return when they answer.
      </Banner>
    );
  }
  if (step.status === "skipped") {
    return (
      <Banner tone="grey" icon={<Info className="size-4" />}>
        Step skipped. It isn&apos;t needed for this request.
      </Banner>
    );
  }
  return (
    <Banner tone="grey" icon={<Clock3 className="size-4" />}>
      Not active yet. This step opens when the earlier stage is approved.
    </Banner>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "green" | "red" | "amber" | "grey";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    green: "bg-[#f1faf1] text-[#0e700e]",
    red: "bg-[#fdf3f4] text-[#b10e1c]",
    amber: "bg-[#fff9f5] text-[#8a3707]",
    grey: "bg-[#f5f5f5] text-[#424242]",
  }[tone];
  return (
    <div role="status" className={cn("mt-3.5 flex gap-2 rounded-[4px] px-2.5 py-2 text-[12px] font-semibold", styles)}>
      <span className="mt-px shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TeamsButton({
  primary,
  pressed,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-8 min-w-[88px] items-center justify-center gap-1.5 rounded-[4px] px-3 text-[13px] font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5b5fc7]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        primary
          ? "bg-[#5b5fc7] text-white hover:bg-[#4f52b2] active:bg-[#444791]"
          : "border border-[#d1d1d1] bg-white text-[#242424] hover:bg-[#f5f5f5] active:bg-[#e0e0e0]",
        pressed && !primary && "border-[#5b5fc7] bg-[#e8ebfa] text-[#444791]",
        pressed && primary && "bg-[#444791]",
        className,
      )}
      {...props}
    />
  );
}
