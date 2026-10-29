"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, ClipboardCheck, Info, Lock, Paperclip, PhoneCall, XCircle } from "lucide-react";
import { needsCallbackCheck, useApprovalActions } from "@/components/approvals/use-approval-actions";
import { formatSgtDateTime } from "@/components/common/format";
import { useSandbox } from "@/lib/store";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MS_FONT, MS_SCOPE, MS_TEXT, findPerson, firstName, formatAgo, usePeople, useSimNow } from "./shared";
import { buildKeyFacts, countryName, formatFactValue } from "./teams-helpers";
import { CARD_MASK_TEXT } from "./TeamsApprovalCard";

export const OUTLOOK_SENDER = { name: "OneRecord Approvals", email: "approvals@livesgroup.example" } as const;

const OUTLOOK = { blue: "#0f6cbd" } as const;

export interface OutlookMessageProps {
  notification: AppNotification;
  /** Mark the message read when it is shown (default true). */
  markReadOnView?: boolean;
  className?: string;
}

/**
 * Outlook reading pane for one OneRecord email, with an actionable-message card
 * (Approve / Open in OneRecord) when the recipient holds a pending step.
 */
export function OutlookMessage({ notification: n, markReadOnView = true, className }: OutlookMessageProps) {
  const people = usePeople();
  const now = useSimNow();
  const request = useSandbox((s) => (n.requestId ? s.requests.find((r) => r.id === n.requestId) : undefined));
  const domain = useSandbox((s) => (request ? s.config.domains.find((d) => d.id === request.domainId) : undefined));
  const actions = useApprovalActions();
  const markNotificationRead = useSandbox((s) => s.markNotificationRead);
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState("");
  const commentId = useId();

  useEffect(() => {
    if (markReadOnView && !n.read) markNotificationRead(n.id);
  }, [markReadOnView, n.id, n.read, markNotificationRead]);

  const recipient = findPerson(people, n.toId);
  const step = request && n.stepId ? request.steps.find((s) => s.id === n.stepId) : undefined;
  const requestor = findPerson(people, request?.requestorId);
  const isApprover = Boolean(step && (step.assigneeId === n.toId || step.originalAssigneeId === n.toId));
  const pendingForRecipient = isApprover && step?.status === "pending" && step.assigneeId === n.toId;
  /** Vendor bank details need the call-back tick, which lives on the Teams card and in OneRecord, not in email. */
  const callbackRequired = Boolean(request && step && pendingForRecipient && needsCallbackCheck(request, step));
  const canApprove = pendingForRecipient && !callbackRequired;
  const facts = useMemo(
    () => (request ? buildKeyFacts(request, domain, { limit: 4, role: step?.role }) : []),
    [request, domain, step?.role],
  );

  function approve() {
    if (!request || !step) return;
    const ok = actions.approve(request, step, comment.trim() || undefined);
    setConfirming(false);
    if (ok) setComment("");
  }

  return (
    <article
      className={cn(MS_SCOPE, "flex min-h-0 flex-col overflow-hidden bg-white", className)}
      style={{ fontFamily: MS_FONT, color: MS_TEXT }}
      aria-label={`Email: ${n.title}`}
    >
      <header className="border-b border-[#ebebeb] px-5 pt-4 pb-3">
        <h2 className="text-[18px] leading-snug font-semibold">{n.title}</h2>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-[3px] bg-[#e8ebfa] px-1.5 py-px text-[11px] font-semibold text-[#444791]">OneRecord</span>
          {pendingForRecipient ? (
            <span className="rounded-[3px] bg-[#fff4ce] px-1.5 py-px text-[11px] font-semibold text-[#835b00]">Action required</span>
          ) : null}
        </div>
        <div className="mt-3 flex items-start gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ background: OUTLOOK.blue }}
            aria-hidden="true"
          >
            OR
          </span>
          <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
            <p className="truncate">
              <span className="font-semibold text-[#242424]">{OUTLOOK_SENDER.name}</span>{" "}
              <span className="text-[#616161]">&lt;{OUTLOOK_SENDER.email}&gt;</span>
            </p>
            <p className="truncate text-[#616161]">
              To: {recipient ? `${recipient.name} <${recipient.email}>` : n.toId}
            </p>
          </div>
          <time dateTime={n.at} className="shrink-0 text-right text-[11px] text-[#616161]">
            {formatSgtDateTime(n.at)}
            <span className="block">{formatAgo(n.at, now)}</span>
          </time>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[14px] leading-relaxed">
        <p>Hi {recipient ? firstName(recipient.name) : "there"},</p>
        <p className="mt-2 whitespace-pre-line">{n.body}</p>

        {request ? (
          <section
            aria-label="Actionable message"
            className="mt-4 overflow-hidden rounded-[6px] border border-[#d1d1d1] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-center gap-2 border-b border-[#ebebeb] bg-[#fafafa] px-4 py-2">
              <ClipboardCheck className="size-4" style={{ color: OUTLOOK.blue }} aria-hidden="true" />
              <span className="text-[12px] font-semibold">OneRecord · {pendingForRecipient ? "Approval needed" : "Request update"}</span>
              <span className="ml-auto text-[11px] text-[#616161] tabular-nums">{request.id}</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-[15px] font-semibold">{request.title}</p>
              <p className="text-[12px] text-[#616161]">
                {requestor ? `${requestor.name} · ` : ""}
                {request.entity} · {countryName(request.country)}
                {step ? ` · ${step.label}` : ""}
              </p>
              {facts.length > 0 ? (
                <dl className="mt-2.5 grid grid-cols-[minmax(100px,36%)_1fr] gap-x-3 gap-y-1 text-[13px]">
                  {facts.map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="text-[#616161]">{f.label}</dt>
                      <dd className="min-w-0 break-words">
                        {f.sensitive ? (
                          <span className="inline-flex items-center gap-1 text-[#616161]">
                            <Lock className="size-3 shrink-0" aria-hidden="true" />
                            {CARD_MASK_TEXT}
                          </span>
                        ) : (
                          formatFactValue(f.value)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {step && isApprover && step.status !== "pending" ? (
                <p
                  role="status"
                  className={cn(
                    "mt-3 flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12px] font-semibold",
                    step.status === "approved"
                      ? "bg-[#f1faf1] text-[#0e700e]"
                      : step.status === "rejected"
                        ? "bg-[#fdf3f4] text-[#b10e1c]"
                        : "bg-[#f5f5f5] text-[#424242]",
                  )}
                >
                  {step.status === "approved" ? (
                    <CheckCircle2 className="size-4" />
                  ) : step.status === "rejected" ? (
                    <XCircle className="size-4" />
                  ) : (
                    <Info className="size-4" />
                  )}
                  {step.status === "approved"
                    ? `Approved${step.decidedAt ? ` ${formatAgo(step.decidedAt, now)}` : ""}. Recorded in the OneRecord audit trail.`
                    : step.status === "rejected"
                      ? "Rejected. The requestor has the reason."
                      : step.status === "question"
                        ? "Question open. The SLA clock is paused."
                        : "This step opens when the earlier stage is approved."}
                </p>
              ) : null}

              {confirming ? (
                <div className="mt-3">
                  <label htmlFor={commentId} className="mb-1 block text-[12px] font-semibold text-[#424242]">
                    Comment (optional)
                  </label>
                  <textarea
                    id={commentId}
                    rows={2}
                    autoFocus
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full resize-none rounded-[4px] border border-[#d1d1d1] border-b-[#616161] px-2.5 py-1.5 text-[13px] outline-none focus:border-b-2 focus:border-b-[#0f6cbd]"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {canApprove ? (
                  confirming ? (
                    <>
                      <OutlookButton primary data-testid="outlook-approve-submit" onClick={approve}>
                        Submit approval
                      </OutlookButton>
                      <OutlookButton onClick={() => setConfirming(false)}>Cancel</OutlookButton>
                    </>
                  ) : (
                    <OutlookButton primary data-testid="outlook-approve" onClick={() => setConfirming(true)}>
                      Approve
                    </OutlookButton>
                  )
                ) : null}
                {!confirming ? (
                  <Link
                    href={`/requests/view?id=${encodeURIComponent(request.id)}`}
                    className="inline-flex h-8 items-center gap-1 rounded-[4px] border border-[#d1d1d1] bg-white px-3 text-[13px] font-semibold text-[#242424] transition-colors hover:bg-[#f5f5f5]"
                  >
                    Open in OneRecord
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              {callbackRequired ? (
                <p className="mt-3 flex items-start gap-1.5 rounded-[4px] border border-[#f2c661] bg-[#fffaeb] px-2.5 py-1.5 text-[12px] text-[#5c4300]">
                  <PhoneCall className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  New supplier bank details: approve from Teams or OneRecord, where you confirm the call-back to an independently
                  sourced number. Email approval is switched off for this step.
                </p>
              ) : null}
              {canApprove ? (
                <p className="mt-2 text-[11px] text-[#616161]">
                  To reject or ask a question, open the request. Both need a written reason.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <p className="mt-5 flex items-start gap-1.5 border-t border-[#ebebeb] pt-3 text-[11px] leading-snug text-[#8a8886]">
          <Paperclip className="mt-px size-3 shrink-0" aria-hidden="true" />
          Sent by the OneRecord approval flow (Power Automate). Buttons in this email are an actionable message and need
          Exchange Online. If they don&apos;t show, use Open in OneRecord.
        </p>
      </div>
    </article>
  );
}

export function OutlookButton({
  primary,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 min-w-[80px] items-center justify-center gap-1.5 rounded-[4px] px-3 text-[13px] font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0f6cbd] disabled:opacity-45",
        primary
          ? "bg-[#0f6cbd] text-white hover:bg-[#115ea3] active:bg-[#0c3b5e]"
          : "border border-[#d1d1d1] bg-white text-[#242424] hover:bg-[#f5f5f5]",
        className,
      )}
      {...props}
    />
  );
}

export interface OutlookPanelProps {
  personId?: string;
  className?: string;
}

/** Outlook inbox (message list + reading pane) for one person's OneRecord emails. */
export function OutlookPanel({ personId, className }: OutlookPanelProps) {
  const currentId = useSandbox((s) => s.personaId);
  const ownerId = personId ?? currentId;
  const notifications = useSandbox((s) => s.notifications);
  const now = useSimNow();
  const mail = useMemo(
    () => notifications.filter((n) => n.toId === ownerId && n.channel === "outlook").sort((a, b) => b.at.localeCompare(a.at)),
    [notifications, ownerId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = mail.find((m) => m.id === selectedId) ?? mail[0];

  return (
    <section
      className={cn(MS_SCOPE, "@container flex min-h-0 flex-col overflow-hidden rounded-[8px] border border-[#e0e0e0] bg-[#faf9f8]", className)}
      style={{ fontFamily: MS_FONT, color: MS_TEXT }}
      aria-label="Outlook inbox"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: OUTLOOK.blue }}>
        <span className="text-[14px] font-semibold tracking-tight">Outlook</span>
        <span className="text-[12px] opacity-85">Inbox · {mail.filter((m) => !m.read).length} unread</span>
      </div>
      {mail.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-12 text-center">
          <p className="text-[13px] font-semibold">Nothing in Focused</p>
          <p className="text-[12px] text-[#616161]">OneRecord emails for this person appear here.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(120px,40%)_1fr] @2xl:grid-cols-[280px_1fr] @2xl:grid-rows-1">
          <ol className="min-h-0 overflow-y-auto border-b border-[#e0e0e0] bg-white @2xl:border-r @2xl:border-b-0">
            {mail.map((m) => {
              const active = m.id === selected?.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "relative block w-full border-b border-[#f0f0f0] px-3 py-2.5 text-left transition-colors",
                      active ? "bg-[#ebf3fc]" : "hover:bg-[#f5f5f5]",
                    )}
                  >
                    {!m.read ? <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: OUTLOOK.blue }} /> : null}
                    <span className="flex items-baseline gap-2">
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", !m.read && "font-semibold")}>{OUTLOOK_SENDER.name}</span>
                      <span className={cn("shrink-0 text-[11px]", !m.read ? "font-semibold text-[#0f6cbd]" : "text-[#616161]")}>
                        {formatAgo(m.at, now)}
                      </span>
                    </span>
                    <span className={cn("block truncate text-[12px]", !m.read ? "font-semibold text-[#0f6cbd]" : "text-[#242424]")}>
                      {m.title}
                    </span>
                    <span className="block truncate text-[12px] text-[#616161]">{m.body}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {selected ? <OutlookMessage key={selected.id} notification={selected} className="min-h-0" /> : null}
        </div>
      )}
    </section>
  );
}
