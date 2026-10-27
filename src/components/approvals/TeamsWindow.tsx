"use client";

import { Bell, CalendarDays, CheckCircle2, CircleDashed, ClipboardCheck, Clock3, MessageCircleQuestion, MessageSquare, Search, Users, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { SlaChip } from "@/components/common";
import { formatSgtTime } from "@/components/common/format";
import { MS_FONT, MsAvatar, TEAMS } from "@/components/mocks/shared";
import { TeamsApprovalCard } from "@/components/mocks/TeamsApprovalCard";
import { useUnreadCounts } from "@/lib/selectors";
import type { ApprovalStep, MdmRequest, Person } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useApprovalActions } from "./use-approval-actions";

const RAIL = [
  { label: "Activity", icon: Bell },
  { label: "Chat", icon: MessageSquare },
  { label: "Teams", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "Approvals", icon: ClipboardCheck, active: true },
] as const;

/** A Teams desktop window (no logos) with the OneRecord Approvals app open on the selected card. */
export function TeamsWindow({ request, step, me }: { request: MdmRequest; step: ApprovalStep; me: Person }) {
  const actions = useApprovalActions();
  const unread = useUnreadCounts(me.id).teams;
  const sentAt = step.activatedAt ?? request.submittedAt ?? request.createdAt;

  return (
    <div
      className="overflow-hidden rounded-xl border border-[#d6d6d6] bg-[#f5f5f5] text-[#242424] shadow-float"
      style={{ fontFamily: MS_FONT }}
      aria-label="Microsoft Teams (simulated)"
    >
      {/* title bar */}
      <div className="flex items-center gap-3 border-b border-[#e0e0e0] bg-[#ebebeb] px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#d1d1d1]" />
          <span className="size-2.5 rounded-full bg-[#d1d1d1]" />
          <span className="size-2.5 rounded-full bg-[#d1d1d1]" />
        </span>
        <span className="text-[13px] font-bold tracking-tight" style={{ color: TEAMS.purpleDark }}>
          Teams
        </span>
        <span className="relative mx-auto flex w-full max-w-[420px] items-center" aria-hidden="true">
          <Search className="absolute left-2.5 size-3.5 text-[#616161]" />
          <span className="h-7 w-full rounded-[4px] bg-white pl-8 text-[12px] leading-7 text-[#616161]">Search</span>
        </span>
        <span className="rounded-full border border-[#e0b252] bg-[#fff6dc] px-2 py-px text-[11px] font-semibold text-[#5c4300]">
          Simulated
        </span>
        <MsAvatar person={me} size={24} presence={me.outOfOffice ? "away" : "available"} />
      </div>

      <div className="flex min-h-[560px]">
        {/* app rail */}
        <nav aria-hidden="true" className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-[#e0e0e0] bg-[#ebebeb] py-2">
          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = "active" in item && item.active;
            return (
              <span
                key={item.label}
                className={cn("relative flex w-full flex-col items-center gap-0.5 py-1.5 text-[10px]", active ? "font-semibold" : "text-[#616161]")}
                style={active ? { color: TEAMS.purple } : undefined}
              >
                {active ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r" style={{ background: TEAMS.purple }} /> : null}
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
                {item.label === "Activity" && unread > 0 ? (
                  <span className="absolute top-0.5 right-3 rounded-full bg-[#c4314b] px-1 text-[9px] leading-[14px] font-semibold text-white">
                    {unread}
                  </span>
                ) : null}
              </span>
            );
          })}
        </nav>

        {/* chat with the Approvals app */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2.5 border-b border-[#e0e0e0] bg-white px-4 py-2.5">
            <span className="inline-flex size-8 items-center justify-center rounded-[6px] text-white" style={{ background: TEAMS.purple }} aria-hidden="true">
              <ClipboardCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">OneRecord Approvals</p>
              <p className="text-[11px] text-[#616161]">App · posts approval cards and reminders</p>
            </div>
            <span className="ml-auto flex gap-4 text-[13px]" aria-hidden="true">
              <span className="border-b-2 pb-1 font-semibold" style={{ borderColor: TEAMS.purple }}>
                Chat
              </span>
              <span className="pb-1 text-[#616161]">About</span>
            </span>
          </div>

          <div className="flex-1 px-4 py-5 md:px-6">
            <div className="flex gap-3">
              <span className="mt-6 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-white" style={{ background: TEAMS.purple }} aria-hidden="true">
                <ClipboardCheck className="size-4" />
              </span>
              <div className="min-w-0 max-w-[640px] flex-1">
                <p className="mb-1 text-[12px] text-[#616161]">
                  <span className="font-semibold text-[#424242]">OneRecord Approvals</span> {formatSgtTime(sentAt)}
                </p>
                <TeamsApprovalCard
                  key={`${request.id}:${step.id}`}
                  request={request}
                  step={step}
                  onApprove={(comment) => actions.approve(request, step, comment)}
                  onReject={(comment) => actions.reject(request, step, comment)}
                  onAsk={(text) => actions.ask(request, step, text)}
                />
                {step.role === "mdm" ? (
                  <p className="mt-2 text-[12px] text-[#616161]">
                    MDM&apos;s final check, the SAP B1 import file and &ldquo;Created in SAP B1&rdquo; live in the{" "}
                    <Link
                      href={`/mdm?id=${encodeURIComponent(request.id)}`}
                      data-testid="open-mdm-console"
                      className="font-semibold hover:underline"
                      style={{ color: TEAMS.purple }}
                    >
                      MDM console
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEP_ICON: Record<ApprovalStep["status"], ReactNode> = {
  approved: <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />,
  rejected: <XCircle className="size-4 text-stuck" aria-hidden="true" />,
  pending: <Clock3 className="size-4 text-primary" aria-hidden="true" />,
  question: <MessageCircleQuestion className="size-4 text-warn" aria-hidden="true" />,
  waiting: <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />,
  skipped: <CircleDashed className="size-4 text-muted-foreground/60" aria-hidden="true" />,
};

/** Where the selected request goes: every stage and step with who holds it and its SLA. */
export function RouteStrip({ request, people, highlightStepId }: { request: MdmRequest; people: Person[]; highlightStepId: string }) {
  const stages: { id: string; label: string; mode: string; steps: ApprovalStep[] }[] = [];
  for (const step of request.steps) {
    if (step.status === "skipped") continue;
    let stage = stages.find((s) => s.id === step.stageId);
    if (!stage) {
      stage = { id: step.stageId, label: step.stageLabel, mode: step.stageMode, steps: [] };
      stages.push(stage);
    }
    stage.steps.push(step);
  }

  return (
    <section aria-labelledby="route-heading" className="rounded-xl border border-border bg-card p-4 shadow-raised">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id="route-heading" className="text-[0.9375rem] font-semibold">
          Route for {request.id}
        </h3>
        <p className="text-xs text-muted-foreground">Each stage opens when the one before it is approved. Steps in a stage run in parallel.</p>
      </div>
      <ol className="mt-3 grid gap-3 md:grid-flow-col md:auto-cols-fr">
        {stages.map((stage, i) => (
          <li key={stage.id} className="min-w-0 rounded-lg border border-border bg-background/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Stage {i + 1} · {stage.steps.length > 1 && stage.mode === "parallel" ? "in parallel" : stage.label}
            </p>
            <ul className="mt-2 space-y-2">
              {stage.steps.map((step) => {
                const who = people.find((p) => p.id === step.assigneeId);
                return (
                  <li
                    key={step.id}
                    className={cn("flex items-start gap-2 rounded-md p-1.5", step.id === highlightStepId && "bg-primary-soft ring-1 ring-primary/30")}
                  >
                    <span className="mt-0.5">{STEP_ICON[step.status]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{step.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{who?.name ?? step.assigneeId}</span>
                    </span>
                    <SlaChip step={step} />
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
