"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowUpRight, CheckCircle2, MessageCircleQuestion, PauseCircle } from "lucide-react";
import type { ApprovalStep, MdmRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MS_FONT, MsAvatar, TEAMS, findPerson, firstName, formatAgo, usePeople, useSimNow } from "./shared";
import { TeamsButton } from "./TeamsApprovalCard";

export interface TeamsQuestionCardProps {
  request: MdmRequest;
  step: ApprovalStep;
  onAnswer: (answer: string) => void;
  compact?: boolean;
  className?: string;
}

/** The requestor's side of "Ask a question": answer inline, the approval resumes with the same approver. */
export function TeamsQuestionCard({ request, step, onAnswer, compact = false, className }: TeamsQuestionCardProps) {
  const people = usePeople();
  const now = useSimNow();
  const [text, setText] = useState("");
  const id = useId();
  const approver = findPerson(people, step.assigneeId);
  const q = step.question;
  const open = step.status === "question" && q && !q.answer;
  const pad = compact ? "px-3" : "px-4";

  function send() {
    const answer = text.trim();
    if (!answer) return;
    onAnswer(answer);
    setText("");
  }

  return (
    <article
      aria-label={`Question about ${request.title}`}
      className={cn(
        "overflow-hidden rounded-[6px] border border-[#e0e0e0] bg-white text-[#242424]",
        "shadow-[0_1.6px_3.6px_rgba(0,0,0,0.11),0_0.3px_0.9px_rgba(0,0,0,0.09)]",
        className,
      )}
      style={{ fontFamily: MS_FONT }}
    >
      <div className="h-1" style={{ background: TEAMS.purple }} aria-hidden="true" />
      <header className={cn("flex items-center gap-2 pt-2.5 pb-2", pad)}>
        <span
          className="inline-flex size-5 items-center justify-center rounded-[4px] text-white"
          style={{ background: TEAMS.purple }}
          aria-hidden="true"
        >
          <MessageCircleQuestion className="size-3.5" strokeWidth={2.25} />
        </span>
        <span className="text-[12px] font-semibold text-[#424242]">Approvals</span>
        <span className="text-[11px] text-[#616161]">· Question on your request</span>
        {q?.askedAt ? <span className="ml-auto text-[11px] text-[#616161]">{formatAgo(q.askedAt, now)}</span> : null}
      </header>

      <div className={cn(pad, "pb-3.5")}>
        <h3 className={cn("leading-snug font-semibold", compact ? "text-[14px]" : "text-[15px]")}>{request.title}</h3>
        <p className="mt-0.5 text-[12px] text-[#616161]">
          {request.id} · {step.label}
        </p>

        {q ? (
          <div className="mt-3 flex gap-2.5">
            <MsAvatar person={approver} size={28} presence="available" />
            <div className="min-w-0 flex-1 rounded-[6px] bg-[#f5f5f5] px-3 py-2">
              <p className="text-[12px] font-semibold text-[#424242]">{approver?.name ?? "Approver"}</p>
              <p className="mt-0.5 text-[13px] leading-snug">{q.text}</p>
            </div>
          </div>
        ) : null}

        {q?.answer ? (
          <div className="mt-2 flex justify-end">
            <div className="max-w-[85%] rounded-[6px] px-3 py-2 text-[13px] leading-snug" style={{ background: TEAMS.purpleTint }}>
              {q.answer}
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="mt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-[#616161]">
              <PauseCircle className="size-3.5" aria-hidden="true" />
              The approval clock is paused until you answer.
            </p>
            <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-[#424242]">
              Your answer
            </label>
            <textarea
              id={id}
              rows={3}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
              placeholder={`Reply to ${approver ? firstName(approver.name) : "the approver"}`}
              className="w-full resize-none rounded-[4px] border border-[#d1d1d1] border-b-[#616161] bg-white px-2.5 py-1.5 text-[13px] outline-none placeholder:text-[#8a8886] focus:border-b-2 focus:border-b-[#5b5fc7]"
            />
            <div className="mt-2 flex">
              <TeamsButton primary onClick={send} disabled={text.trim().length === 0} className="w-full sm:w-auto">
                Send answer
              </TeamsButton>
            </div>
          </div>
        ) : q?.answer ? (
          <div role="status" className="mt-3 flex gap-2 rounded-[4px] bg-[#f1faf1] px-2.5 py-2 text-[12px] font-semibold text-[#0e700e]">
            <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden="true" />
            Answer sent to {approver?.name ?? "the approver"}. The approval resumed where it paused.
          </div>
        ) : null}

        <div className="mt-3 border-t border-[#ebebeb] pt-2.5">
          <Link
            href={`/requests/view?id=${encodeURIComponent(request.id)}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
            style={{ color: TEAMS.purple }}
          >
            View request
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
