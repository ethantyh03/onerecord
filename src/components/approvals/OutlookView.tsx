"use client";

import { useMemo } from "react";
import { Inbox } from "lucide-react";
import { OutlookMessage } from "@/components/mocks/OutlookMessage";
import { MS_FONT } from "@/components/mocks/shared";
import { useSandbox } from "@/lib/store";
import { LightScope } from "@/components/common";
import type { AppNotification, ApprovalStep, MdmRequest, Person } from "@/lib/types";

/**
 * The same approval as an Outlook actionable message. Uses the persona's real approval email when there is one;
 * otherwise shows the message the flow would send (not stored).
 */
export function OutlookView({ request, step, me }: { request: MdmRequest; step: ApprovalStep; me: Person }) {
  const notifications = useSandbox((s) => s.notifications);
  const requestor = useSandbox((s) => s.config.people.find((p) => p.id === request.requestorId));

  const stored = useMemo(
    () =>
      notifications
        .filter((n) => n.toId === me.id && n.channel === "outlook" && n.requestId === request.id && n.stepId === step.id)
        .sort((a, b) => b.at.localeCompare(a.at))[0],
    [notifications, me.id, request.id, step.id],
  );

  const message: AppNotification = stored ?? {
    id: `preview-${request.id}-${step.id}-${me.id}`,
    at: step.activatedAt ?? request.submittedAt ?? request.createdAt,
    toId: me.id,
    channel: "outlook",
    kind: "approval",
    title: `[Action required] ${request.id} — ${request.title}`,
    body: `${requestor?.name ?? "A colleague"} needs a decision on ${request.title}. Step: ${step.label}.`,
    requestId: request.id,
    stepId: step.id,
    read: true,
  };

  return (
    // A look-alike of a real Microsoft product: it keeps its native light look inside the dark console.
    <LightScope className="overflow-hidden rounded-xl border border-[#d6d6d6] bg-white text-[#242424]" style={{ fontFamily: MS_FONT }}>
      <div className="flex items-center gap-2 bg-[#0f6cbd] px-3 py-2 text-white">
        <Inbox className="size-4" aria-hidden="true" />
        <span className="text-[14px] font-semibold tracking-tight">Outlook</span>
        <span className="text-[12px] opacity-85">Inbox · {me.email}</span>
        <span className="ml-auto rounded-full bg-white/90 px-2 py-px text-[11px] font-semibold text-[#5c4300]">Preview</span>
      </div>
      <OutlookMessage key={message.id} notification={message} markReadOnView={Boolean(stored)} className="min-h-[520px]" />
    </LightScope>
  );
}
