"use client";

import {
  Bell,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  MessageCircleQuestion,
  MessageSquare,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { LightScope, SlaChip } from "@/components/common";
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

/** A Teams desktop window (no logos) with the Tesseract Approvals app open on the selected card. */
export function TeamsWindow({ request, step, me }: { request: MdmRequest; step: ApprovalStep; me: Person }) {
  const actions = useApprovalActions();
  const unread = useUnreadCounts(me.id).teams;
  const sentAt = step.activatedAt ?? request.submittedAt ?? request.createdAt;

  return (
    // A look-alike of a real Microsoft product: it keeps its native light look inside the dark console.
    <LightScope
      className="overflow-hidden rounded-xl border border-[#d6d6d6] bg-[#f5f5f5] text-[#242424]"
      style={{ fontFamily: MS_FONT }}
      aria-label="Microsoft Teams preview"
    >
      {/* title bar */}
      <div className="flex items-center gap-3 border-b border-[#e0e0e0] bg-[#ebebeb] px-3 py-1">
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
          <span className="h-6 w-full rounded-[4px] bg-white pl-8 text-[12px] leading-6 text-[#616161]">Search</span>
        </span>
        <span className="rounded-full border border-[#e0b252] bg-[#fff6dc] px-2 py-px text-[11px] font-semibold text-[#5c4300]">
          Preview
        </span>
        <MsAvatar person={me} size={22} presence={me.outOfOffice ? "away" : "available"} />
      </div>

      <div className="flex min-h-[480px]">
        {/* app rail */}
        <nav aria-hidden="true" className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-[#e0e0e0] bg-[#ebebeb] py-2">
          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = "active" in item && item.active;
            return (
              <span
                key={item.label}
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 py-1.5 text-[10px]",
                  active ? "font-semibold" : "text-[#616161]",
                )}
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
          <div className="flex items-center gap-2.5 border-b border-[#e0e0e0] bg-white px-4 py-1.5">
            <span
              className="inline-flex size-6 items-center justify-center rounded-[5px] text-white"
              style={{ background: TEAMS.purple }}
              aria-hidden="true"
            >
              <ClipboardCheck className="size-3.5" />
            </span>
            <p className="min-w-0 truncate text-[13px]">
              <span className="font-semibold">Tesseract Approvals</span>
              <span className="text-[11px] text-[#616161]"> · App · posts approval cards and reminders</span>
            </p>
            <span className="ml-auto flex gap-4 text-[13px]" aria-hidden="true">
              <span className="border-b-2 pb-1 font-semibold" style={{ borderColor: TEAMS.purple }}>
                Chat
              </span>
              <span className="pb-1 text-[#616161]">About</span>
            </span>
          </div>

          <div className="flex-1 px-4 py-3 md:px-6">
            <div className="flex gap-3">
              <span
                className="mt-5 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-white"
                style={{ background: TEAMS.purple }}
                aria-hidden="true"
              >
                <ClipboardCheck className="size-4" />
              </span>
              <div className="min-w-0 max-w-[640px] flex-1">
                <p className="mb-1 text-[12px] text-[#616161]">
                  <span className="font-semibold text-[#424242]">Tesseract Approvals</span> {formatSgtTime(sentAt)}
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
    </LightScope>
  );
}

const STEP_ICON: Record<ApprovalStep["status"], ReactNode> = {
  approved: <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />,
  rejected: <XCircle className="size-4 text-stuck" aria-hidden="true" />,
  pending: <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />,
  question: <MessageCircleQuestion className="size-4 text-warn-ink" aria-hidden="true" />,
  waiting: <CircleDashed className="size-4 text-subtle" aria-hidden="true" />,
  skipped: <CircleDashed className="size-4 text-subtle" aria-hidden="true" />,
};

/** The strip's caption, true to the stages shown: only mention parallel or one-after-another steps that exist. */
function routeCaption(stages: { mode: string; steps: ApprovalStep[] }[]): string {
  const multi = stages.filter((s) => s.steps.length > 1);
  const parallel = multi.some((s) => s.mode === "parallel");
  const sequential = multi.some((s) => s.mode !== "parallel");
  const lead = "Each stage opens when the one before it is approved.";
  if (parallel && sequential) return `${lead} Some stages run their steps in parallel, others one after another.`;
  if (parallel) return `${lead} Steps within a stage run in parallel.`;
  if (sequential) return `${lead} Steps within a stage run one after another.`;
  return lead;
}

/** Where the selected request goes: every stage and step with who holds it and its SLA. */
export function RouteStrip({ request, people, highlightStepId }: { request: MdmRequest; people: Person[]; highlightStepId: string }) {
  const stages: {
    id: string;
    label: string;
    mode: string;
    steps: ApprovalStep[];
  }[] = [];
  for (const step of request.steps) {
    if (step.status === "skipped") continue;
    let stage = stages.find((s) => s.id === step.stageId);
    if (!stage) {
      stage = {
        id: step.stageId,
        label: step.stageLabel,
        mode: step.stageMode,
        steps: [],
      };
      stages.push(stage);
    }
    stage.steps.push(step);
  }

  return (
    <section aria-labelledby="route-heading" className="panel overflow-hidden">
      <div className="panel-header flex-wrap justify-start gap-y-0.5 py-2.5">
        <h3 id="route-heading" className="panel-title">
          Route for <span className="mono-id">{request.id}</span>
        </h3>
        <p className="text-[0.8125rem] text-muted-foreground">{routeCaption(stages)}</p>
      </div>
      {/* Stages as ruled columns (Gotham meta columns), not boxes; the open step is the raised row. */}
      <ol className="grid gap-x-6 gap-y-4 p-4 md:grid-flow-col md:auto-cols-fr">
        {stages.map((stage, i) => (
          <li key={stage.id} className="min-w-0 border-l border-border-strong pl-4">
            <p className="text-xs font-medium text-muted-foreground">
              Stage {i + 1} · {stage.label}
              {stage.steps.length > 1 ? (stage.mode === "parallel" ? " · in parallel" : " · one after another") : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {stage.steps.map((step) => {
                const who = people.find((p) => p.id === step.assigneeId);
                return (
                  <li
                    key={step.id}
                    aria-current={step.id === highlightStepId ? "step" : undefined}
                    className={cn("-mx-1.5 flex items-start gap-2 rounded-sm p-1.5", step.id === highlightStepId && "bg-secondary")}
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
