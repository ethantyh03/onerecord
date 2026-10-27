"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Info,
  Lock,
  MessageCircleQuestion,
  PauseCircle,
  PhoneCall,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import { formatSgtDateTime } from "@/components/common/format";
import { CALLBACK_LABEL, needsCallbackCheck } from "@/components/approvals/use-approval-actions";
import { useSandbox } from "@/lib/store";
import type { ApprovalStep, MdmRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MS_FONT, MsAvatar, TEAMS, findPerson, formatAgo, formatSgd, usePeople, useSimNow } from "./shared";
import { buildKeyFacts, countryName, formatFactValue, teamsSla, type TeamsSlaTone } from "./teams-helpers";

/** What a sensitive field shows on any card or message: never the value, for anyone (final model decision 4). */
export const CARD_MASK_TEXT = "•••• · view in OneRecord (Finance only)";

export interface TeamsApprovalCardProps {
  request: MdmRequest;
  step: ApprovalStep;
  /** Return false to keep the comment (e.g. the action was blocked). */
  onApprove: (comment?: string) => boolean | void;
  onReject: (comment: string) => boolean | void;
  onAsk: (text: string) => boolean | void;
  /** Tighter layout for feeds and the phone frame: 3 facts, smaller paddings. */
  compact?: boolean;
  className?: string;
}

const SLA_TONE: Record<TeamsSlaTone, string> = {
  ok: "bg-[#e8ebfa] text-[#444791]",
  soon: "bg-[#fff4ce] text-[#835b00]",
  overdue: "bg-[#fde7e9] text-[#b10e1c]",
  paused: "bg-[#f0f0f0] text-[#424242]",
  done: "bg-[#f0f0f0] text-[#424242]",
};

const INPUT_CLS =
  "w-full resize-none rounded-[4px] border border-[#d1d1d1] border-b-[#616161] bg-white px-2.5 py-1.5 text-[13px] text-[#242424] outline-none placeholder:text-[#8a8886] focus:border-b-2 focus:border-b-[#5b5fc7]";

/**
 * Microsoft Teams "Approvals" Adaptive Card look-alike. The production card is
 * integrations/teams/approval-card.json; this renders the same content in-app:
 * fact set, an always-visible comment box (required to reject), Approve / Reject,
 * and "Ask a question" as a show-card. Sensitive values never appear on the card.
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
  const viewerId = useSandbox((s) => s.personaId);
  const now = useSimNow();
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [calledBack, setCalledBack] = useState(false);
  const commentId = useId();
  const questionId = useId();
  const callbackId = useId();
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const requestor = findPerson(people, request.requestorId);
  const assignee = findPerson(people, step.assigneeId);
  const original = findPerson(people, step.originalAssigneeId);
  const viewer = findPerson(people, viewerId);
  const status = teamsSla(step, sla, now);
  const facts = useMemo(
    () => buildKeyFacts(request, domain, { limit: compact ? 3 : 6, role: step.role }),
    [request, domain, compact, step.role],
  );
  const blocked = useMemo(() => {
    const ids = new Set(request.blockedPrIds ?? []);
    const list = prs.filter((p) => (ids.has(p.id) || p.blockedByRequestId === request.id) && p.status === "blocked");
    return { count: list.length, sgd: list.reduce((sum, p) => sum + p.sgd, 0) };
  }, [prs, request.blockedPrIds, request.id]);

  const actionable = step.status === "pending";
  const callbackRequired = actionable && needsCallbackCheck(request, step);
  const requestorName = requestor?.name ?? "the requestor";
  const pad = compact ? "px-3" : "px-4";

  function approve() {
    if (callbackRequired && !calledBack) return;
    const note = comment.trim();
    const verified = callbackRequired
      ? `${CALLBACK_LABEL} · verified by ${viewer?.name ?? "the approver"}, ${formatSgtDateTime(now)} SGT.`
      : "";
    const full = [verified, note].filter(Boolean).join(" ");
    const ok = onApprove(full || undefined);
    if (ok !== false) {
      setComment("");
      setCalledBack(false);
    }
  }

  function reject() {
    const note = comment.trim();
    if (!note) {
      setCommentError(true);
      commentRef.current?.focus();
      return;
    }
    const ok = onReject(note);
    if (ok !== false) setComment("");
  }

  function sendQuestion() {
    const q = question.trim();
    if (!q) return;
    const ok = onAsk(q);
    if (ok !== false) {
      setQuestion("");
      setAsking(false);
    }
  }

  return (
    <article
      data-testid="teams-card"
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
            <h3 className={cn("leading-snug font-semibold", compact ? "text-[14px]" : "text-[17px]")}>{request.title}</h3>
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
              data-testid="teams-sla"
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

        {/* Key facts (Adaptive Card FactSet). Sensitive values are never on the card. */}
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
                    <span data-testid="teams-masked" className="inline-flex items-center gap-1 text-[#616161]">
                      <Lock className="size-3 shrink-0" aria-hidden="true" />
                      <span>{CARD_MASK_TEXT}</span>
                    </span>
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
            {callbackRequired ? (
              <div className="mt-3 rounded-[4px] border border-[#f2c661] bg-[#fffaeb] px-2.5 py-2 text-[12px] text-[#5c4300]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <PhoneCall className="size-3.5 shrink-0" aria-hidden="true" />
                  Bank details on a new supplier: call back before you approve
                </p>
                <label htmlFor={callbackId} className="mt-1.5 flex cursor-pointer items-start gap-2">
                  <input
                    id={callbackId}
                    type="checkbox"
                    data-testid="teams-callback"
                    checked={calledBack}
                    onChange={(e) => setCalledBack(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[#5b5fc7]"
                  />
                  <span>{CALLBACK_LABEL}. Your name and the time go into the audit trail.</span>
                </label>
              </div>
            ) : null}

            <div className="mt-3">
              <label htmlFor={commentId} className="mb-1 block text-[12px] font-semibold text-[#424242]">
                Comment <span className="font-normal text-[#616161]">(required to reject)</span>
              </label>
              <textarea
                id={commentId}
                ref={commentRef}
                data-testid="teams-comment"
                rows={compact ? 1 : 2}
                value={comment}
                maxLength={500}
                aria-invalid={commentError || undefined}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError) setCommentError(false);
                }}
                placeholder="Add a note for the requestor and the audit trail"
                className={cn(INPUT_CLS, commentError && "border-[#c4314b] border-b-[#c4314b]")}
              />
              {commentError ? (
                <p role="alert" className="mt-1 text-[11px] font-semibold text-[#b10e1c]">
                  Add a reason so {requestorName} knows what to fix.
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <TeamsButton
                primary
                data-testid="teams-approve"
                onClick={approve}
                disabled={callbackRequired && !calledBack}
                title={callbackRequired && !calledBack ? "Tick the call-back check first" : undefined}
              >
                Approve
              </TeamsButton>
              <TeamsButton data-testid="teams-reject" onClick={reject}>
                Reject
              </TeamsButton>
              <TeamsButton data-testid="teams-ask" pressed={asking} onClick={() => setAsking((v) => !v)} aria-expanded={asking}>
                Ask a question
              </TeamsButton>
            </div>

            <AnimatePresence initial={false}>
              {asking ? (
                <motion.div
                  key="ask"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-[4px] border border-[#e0e0e0] bg-[#fafafa] p-2.5">
                    <p className="mb-2 text-[11px] text-[#616161]">
                      Your question goes to {requestorName}. The SLA clock pauses until they answer, and the answer comes back
                      to you.
                    </p>
                    <label htmlFor={questionId} className="mb-1 block text-[12px] font-semibold text-[#424242]">
                      Question
                    </label>
                    <textarea
                      id={questionId}
                      data-testid="teams-ask-text"
                      autoFocus
                      rows={2}
                      value={question}
                      maxLength={500}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendQuestion();
                        if (e.key === "Escape") setAsking(false);
                      }}
                      placeholder="e.g. Please attach the HSA licence certificate"
                      className={INPUT_CLS}
                    />
                    <div className="mt-2 flex gap-2">
                      <TeamsButton primary data-testid="teams-ask-send" onClick={sendQuestion} disabled={question.trim().length === 0}>
                        Send question
                      </TeamsButton>
                      <TeamsButton onClick={() => setAsking(false)}>Cancel</TeamsButton>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : (
          <OutcomeBanner step={step} assigneeName={assignee?.name ?? "Approver"} requestorName={requestorName} now={now} />
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-[#ebebeb] pt-2.5">
          <Link
            href={`/requests/view?id=${encodeURIComponent(request.id)}`}
            data-testid="teams-open-details"
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: TEAMS.purple }}
          >
            Open details
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="ml-auto truncate text-[11px] text-[#8a8886]">
            Stage {step.stageIndex + 1} · {step.stageLabel}
          </span>
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
