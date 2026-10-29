"use client";

import { useId, useState } from "react";
import { CheckCircle2, PauseCircle, Undo2 } from "lucide-react";
import { PhoneFrame } from "@/components/mocks/PhoneFrame";
import { MS_FONT, MsAvatar, TEAMS } from "@/components/mocks/shared";
import { TeamsButton } from "@/components/mocks/TeamsApprovalCard";
import { firstName, formatAgo } from "@/components/common/format";
import { Count, LightScope } from "@/components/common";
import type { ApprovalStep, MdmRequest, Person } from "@/lib/types";
import { useApprovalActions } from "./use-approval-actions";

export interface QuestionEntry {
  request: MdmRequest;
  step: ApprovalStep;
}

export interface QuestionsForYouProps {
  me: Person;
  entries: QuestionEntry[];
  people: Person[];
  now: string;
  onAnswered: (key: string) => void;
}

/**
 * "Questions for you": the requestor's side of Ask-a-question, shown on Teams mobile because the
 * requestor is usually on the road. The answer returns the step to the same approver.
 */
export function QuestionsForYou({ me, entries, people, now, onAnswered }: QuestionsForYouProps) {
  const open = entries.filter((e) => e.step.status === "question");
  const first = entries[0];
  const approver = people.find((p) => p.id === first?.step.assigneeId);

  return (
    <section aria-labelledby="questions-heading" className="panel @container overflow-hidden">
      <div className="panel-header">
        <h2 id="questions-heading" className="panel-title">
          Questions for you
          {open.length > 0 ? <Count className="ml-2">{open.length}</Count> : null}
        </h2>
      </div>

      <div className="grid gap-6 p-5 @xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 max-w-[60ch]">
          <p className="text-[0.9375rem] leading-relaxed text-secondary-foreground">
            {open.length > 0 && approver ? (
              <>
                {approver.name} needs one detail before deciding on {first.request.id}. {firstName(me.name)} is travelling, so the question
                arrives on Teams mobile. The reply goes straight back to {firstName(approver.name)}.
              </>
            ) : (
              <>Every question on your requests has an answer. The approvals carried on with the same approvers.</>
            )}
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex gap-2.5">
              <PauseCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">The approver&apos;s clock is paused.</span>{" "}
                <span className="text-muted-foreground">Time spent waiting for your answer doesn&apos;t count against their SLA.</span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <Undo2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">Nothing restarts.</span>{" "}
                <span className="text-muted-foreground">
                  Your answer returns the step to the same approver. Approvals already given stay given, unlike a bounced email that
                  starts the chain again.
                </span>
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-subtle">Teams mobile is simulated. In production this is the same Adaptive Card in the Teams app.</p>
        </div>

        <PhoneFrame height={600} className="justify-self-center" caption={`${me.name} · travelling, on Teams mobile (simulated)`}>
          {/* The phone screen imitates Teams mobile, so it keeps its native light look; the caption stays on the console. */}
          <LightScope style={{ fontFamily: MS_FONT }} className="text-[#242424]">
            <div className="flex items-center gap-2.5 border-b border-[#ebebeb] px-4 pt-1 pb-2.5">
              <MsAvatar person={me} size={28} presence="away" />
              <p className="text-[20px] font-bold tracking-tight">Activity</p>
            </div>
            <div className="space-y-3 p-3">
              {entries.map((e, i) => (
                <PhoneQuestionCard
                  key={`${e.request.id}:${e.step.id}`}
                  entry={e}
                  approver={people.find((p) => p.id === e.step.assigneeId)}
                  now={now}
                  primary={i === 0}
                  onAnswered={() => onAnswered(`${e.request.id}:${e.step.id}`)}
                />
              ))}
            </div>
          </LightScope>
        </PhoneFrame>
      </div>
    </section>
  );
}

function PhoneQuestionCard({
  entry,
  approver,
  now,
  primary,
  onAnswered,
}: {
  entry: QuestionEntry;
  approver: Person | undefined;
  now: string;
  primary: boolean;
  onAnswered: () => void;
}) {
  const { request, step } = entry;
  const { answer } = useApprovalActions();
  const [text, setText] = useState("");
  const id = useId();
  const q = step.question;
  const isOpen = step.status === "question" && q && !q.answer;
  const suffix = primary ? "" : `-${request.id}`;

  function send() {
    const reply = text.trim();
    if (!reply) return;
    if (answer(request, step, reply)) {
      setText("");
      onAnswered();
    }
  }

  return (
    <article
      className="overflow-hidden rounded-[8px] border border-[#e0e0e0] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
      aria-label={`Question on ${request.id}`}
    >
      <div className="h-1" style={{ background: TEAMS.purple }} aria-hidden="true" />
      <div className="px-3 pt-2.5 pb-3">
        <p className="flex items-center gap-1.5 text-[11px] text-[#616161]">
          <span className="font-semibold text-[#424242]">Approvals</span>
          <span>· {request.id}</span>
          {q?.askedAt ? <span className="ml-auto">{formatAgo(q.askedAt, now)}</span> : null}
        </p>
        <p className="mt-1 text-[14px] leading-snug font-semibold">{request.title}</p>
        <p className="text-[11px] text-[#616161]">{step.label}</p>

        {q ? (
          <div className="mt-2.5 flex gap-2">
            <MsAvatar person={approver} size={26} presence="available" />
            <div className="min-w-0 flex-1 rounded-[8px] bg-[#f5f5f5] px-2.5 py-1.5">
              <p className="text-[11px] font-semibold text-[#424242]">{approver?.name ?? "Approver"}</p>
              <p className="text-[13px] leading-snug">{q.text}</p>
            </div>
          </div>
        ) : null}

        {q?.answer ? (
          <div className="mt-2 flex justify-end">
            <p className="max-w-[85%] rounded-[8px] px-2.5 py-1.5 text-[13px] leading-snug" style={{ background: TEAMS.purpleTint }}>
              {q.answer}
            </p>
          </div>
        ) : null}

        {isOpen ? (
          <div className="mt-2.5">
            <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[11px] font-semibold text-[#424242]">
              <PauseCircle className="size-3" aria-hidden="true" />
              Clock paused until you reply
            </p>
            <label htmlFor={id} className="sr-only">
              Your answer
            </label>
            <textarea
              id={id}
              data-testid={`phone-answer-text${suffix}`}
              rows={3}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Reply to ${approver ? firstName(approver.name) : "the approver"}`}
              className="w-full resize-none rounded-[6px] border border-[#d1d1d1] bg-white px-2.5 py-1.5 text-[13px] outline-none placeholder:text-[#8a8886] focus:border-[#5b5fc7]"
            />
            <TeamsButton
              primary
              data-testid={`phone-answer-send${suffix}`}
              onClick={send}
              disabled={text.trim().length === 0}
              className="mt-1.5 w-full"
            >
              Send answer
            </TeamsButton>
          </div>
        ) : q?.answer ? (
          <p role="status" className="mt-2.5 flex gap-1.5 rounded-[6px] bg-[#f1faf1] px-2.5 py-2 text-[12px] font-semibold text-[#0e700e]">
            <CheckCircle2 className="mt-px size-4 shrink-0" aria-hidden="true" />
            <span>
              Back with {approver?.name ?? "the approver"} — the chain did not restart.
            </span>
          </p>
        ) : null}
      </div>
    </article>
  );
}
