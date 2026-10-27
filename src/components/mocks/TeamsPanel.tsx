"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  Bell,
  CheckCheck,
  ClipboardCheck,
  Inbox,
  MessageCircleQuestion,
  PartyPopper,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useSandbox } from "@/lib/store";
import { useApprovalActions } from "@/components/approvals/use-approval-actions";
import type { AppNotification, ApprovalStep, MdmRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MS_FONT, MsAvatar, TEAMS, findPerson, formatAgo, usePeople, useSimNow } from "./shared";
import { TeamsApprovalCard } from "./TeamsApprovalCard";
import { TeamsQuestionCard } from "./TeamsQuestionCard";

export interface TeamsPanelProps {
  /** Whose feed to show. Defaults to the current persona. */
  personId?: string;
  /** "desktop" shows the Teams top bar with search; "mobile" is the compact Teams-mobile list (use inside PhoneFrame). */
  variant?: "desktop" | "mobile";
  /** Cap the number of feed items (newest first). */
  limit?: number;
  className?: string;
}

const KIND_ICON: Record<AppNotification["kind"], typeof Bell> = {
  approval: ClipboardCheck,
  reminder: AlarmClock,
  escalation: ShieldAlert,
  question: MessageCircleQuestion,
  answer: MessageCircleQuestion,
  created: PartyPopper,
  rejected: XCircle,
  info: Bell,
};

const KIND_LABEL: Record<AppNotification["kind"], string> = {
  approval: "Approval request",
  reminder: "Reminder",
  escalation: "Escalation",
  question: "Question",
  answer: "Answer",
  created: "Created in SAP B1",
  rejected: "Rejected",
  info: "Update",
};

type Embedded =
  | { kind: "approval"; request: MdmRequest; step: ApprovalStep }
  | { kind: "question"; request: MdmRequest; step: ApprovalStep }
  | null;

/**
 * Teams "Activity" feed for one person, built from the sandbox's Teams notifications.
 * Actionable items carry the live card inline (approval card for approvers, question card for requestors).
 */
export function TeamsPanel({ personId, variant = "desktop", limit, className }: TeamsPanelProps) {
  const currentId = useSandbox((s) => s.personaId);
  const ownerId = personId ?? currentId;
  const people = usePeople();
  const owner = findPerson(people, ownerId);
  const notifications = useSandbox((s) => s.notifications);
  const requests = useSandbox((s) => s.requests);
  const actions = useApprovalActions();
  const markNotificationRead = useSandbox((s) => s.markNotificationRead);
  const now = useSimNow();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [query, setQuery] = useState("");

  const feed = useMemo(() => {
    const mine = notifications
      .filter((n) => n.toId === ownerId && n.channel === "teams")
      .sort((a, b) => b.at.localeCompare(a.at));
    return typeof limit === "number" ? mine.slice(0, limit) : mine;
  }, [notifications, ownerId, limit]);

  const unread = feed.filter((n) => !n.read).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feed.filter(
      (n) =>
        (filter === "all" || !n.read) &&
        (!q || `${n.title} ${n.body} ${n.requestId ?? ""}`.toLowerCase().includes(q)),
    );
  }, [feed, filter, query]);

  /** Only the newest notification per step carries the live card, so reminders don't duplicate it. */
  const embedded = useMemo(() => {
    const byId = new Map<string, Embedded>();
    const seenSteps = new Set<string>();
    for (const n of feed) {
      if (!n.requestId || !n.stepId) continue;
      const key = `${n.requestId}:${n.stepId}`;
      if (seenSteps.has(key)) continue;
      const request = requests.find((r) => r.id === n.requestId);
      const step = request?.steps.find((s) => s.id === n.stepId);
      if (!request || !step) continue;
      const isApprover = step.assigneeId === ownerId || step.originalAssigneeId === ownerId;
      const isRequestor = request.requestorId === ownerId;
      if (n.kind === "question" && isRequestor && step.question) {
        byId.set(n.id, { kind: "question", request, step });
        seenSteps.add(key);
      } else if ((n.kind === "approval" || n.kind === "reminder" || n.kind === "escalation") && isApprover) {
        byId.set(n.id, { kind: "approval", request, step });
        seenSteps.add(key);
      }
    }
    return byId;
  }, [feed, requests, ownerId]);

  function markAllRead() {
    feed.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
  }

  const mobile = variant === "mobile";

  return (
    <section
      aria-label={`Teams activity for ${owner?.name ?? "this user"}`}
      className={cn("flex min-h-0 flex-col overflow-hidden text-[#242424]", mobile ? "bg-white" : "rounded-[8px] border border-[#e0e0e0] bg-[#f5f5f5]", className)}
      style={{ fontFamily: MS_FONT }}
    >
      {mobile ? (
        <div className="flex items-center gap-2.5 border-b border-[#ebebeb] bg-white px-4 pt-2 pb-2.5">
          <MsAvatar person={owner} size={28} presence="available" />
          <h2 className="text-[20px] font-bold tracking-tight">Activity</h2>
          {unread > 0 ? (
            <span className="rounded-full px-1.5 text-[11px] leading-[18px] font-semibold text-white" style={{ background: "#c4314b" }}>
              {unread}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setFilter((f) => (f === "all" ? "unread" : "all"))}
            className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold"
            style={filter === "unread" ? { background: TEAMS.purpleTint, color: TEAMS.purpleDark } : { color: TEAMS.subtle }}
            aria-pressed={filter === "unread"}
          >
            Unread
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-[#e0e0e0] bg-[#ebebeb] px-3 py-2">
            <span className="text-[14px] font-bold tracking-tight" style={{ color: TEAMS.purpleDark }}>
              Teams
            </span>
            <label className="relative flex min-w-0 flex-1 items-center">
              <span className="sr-only">Search activity</span>
              <Search className="pointer-events-none absolute left-2.5 size-3.5 text-[#616161]" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-7 w-full rounded-[4px] border border-transparent bg-white pr-2 pl-8 text-[12px] outline-none placeholder:text-[#616161] focus:border-[#5b5fc7]"
              />
            </label>
            <MsAvatar person={owner} size={26} presence="available" />
          </div>
          <div className="flex items-center gap-2 border-b border-[#e0e0e0] bg-white px-4 py-2.5">
            <h2 className="text-[15px] font-bold">Activity</h2>
            {unread > 0 ? (
              <span className="rounded-full px-1.5 text-[11px] leading-[18px] font-semibold text-white" style={{ background: "#c4314b" }}>
                {unread} new
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1" role="group" aria-label="Filter">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className="rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-[#f5f5f5]"
                  style={filter === f ? { background: TEAMS.purpleTint, color: TEAMS.purpleDark } : { color: TEAMS.subtle }}
                >
                  {f === "all" ? "All" : "Unread"}
                </button>
              ))}
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="ml-1 inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[12px] text-[#424242] hover:bg-[#f5f5f5]"
                >
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}

      <ol className={cn("min-h-0 flex-1 overflow-y-auto", mobile ? "divide-y divide-[#f0f0f0]" : "space-y-2 p-2")}>
        {visible.length === 0 ? (
          <li className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full" style={{ background: TEAMS.purpleTint, color: TEAMS.purple }}>
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <p className="text-[13px] font-semibold">
              {feed.length === 0 ? "No activity yet" : filter === "unread" ? "You're all caught up" : "No matches"}
            </p>
            <p className="max-w-[240px] text-[12px] text-[#616161]">
              {feed.length === 0
                ? "Approval requests, questions and SAP confirmations for this person appear here."
                : filter === "unread"
                  ? "Everything here has been read."
                  : "Try a request ID such as REQ-1042."}
            </p>
          </li>
        ) : (
          visible.map((n) => {
            const card = embedded.get(n.id) ?? null;
            return (
              <FeedItem
                key={n.id}
                n={n}
                now={now}
                mobile={mobile}
                card={card}
                onOpen={() => {
                  if (!n.read) markNotificationRead(n.id);
                }}
                renderCard={(c) =>
                  c.kind === "approval" ? (
                    <TeamsApprovalCard
                      request={c.request}
                      step={c.step}
                      compact={mobile}
                      onApprove={(comment) => {
                        const ok = actions.approve(c.request, c.step, comment);
                        if (ok) markNotificationRead(n.id);
                        return ok;
                      }}
                      onReject={(comment) => {
                        const ok = actions.reject(c.request, c.step, comment);
                        if (ok) markNotificationRead(n.id);
                        return ok;
                      }}
                      onAsk={(text) => {
                        const ok = actions.ask(c.request, c.step, text);
                        if (ok) markNotificationRead(n.id);
                        return ok;
                      }}
                    />
                  ) : (
                    <TeamsQuestionCard
                      request={c.request}
                      step={c.step}
                      compact={mobile}
                      onAnswer={(answer) => {
                        if (actions.answer(c.request, c.step, answer)) markNotificationRead(n.id);
                      }}
                    />
                  )
                }
              />
            );
          })
        )}
      </ol>
    </section>
  );
}

function FeedItem({
  n,
  now,
  mobile,
  card,
  onOpen,
  renderCard,
}: {
  n: AppNotification;
  now: string;
  mobile: boolean;
  card: Embedded;
  onOpen: () => void;
  renderCard: (c: NonNullable<Embedded>) => React.ReactNode;
}) {
  const Icon = KIND_ICON[n.kind] ?? Bell;
  const tone =
    n.kind === "escalation" || n.kind === "rejected"
      ? "#c4314b"
      : n.kind === "created"
        ? "#0e700e"
        : n.kind === "reminder"
          ? "#835b00"
          : TEAMS.purple;
  return (
    <li
      className={cn(
        "relative",
        mobile ? "px-3 py-3" : "rounded-[6px] bg-white px-3 py-3 shadow-[0_0.3px_0.9px_rgba(0,0,0,0.1)]",
        !n.read && !mobile && "ring-1 ring-[#c7c9f0]",
      )}
      onClick={onOpen}
      onFocusCapture={onOpen}
    >
      <div className="flex gap-3">
        <span
          className="relative mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${tone}14`, color: tone }}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("min-w-0 flex-1 truncate text-[13px]", n.read ? "font-normal" : "font-semibold")}>{n.title}</p>
            <time dateTime={n.at} className="shrink-0 text-[11px] text-[#616161]">
              {formatAgo(n.at, now)}
            </time>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold tracking-wide text-[#8a8886] uppercase">
            {KIND_LABEL[n.kind]}
            {n.requestId ? ` · ${n.requestId}` : ""}
          </p>
          <p className={cn("mt-1 text-[12px] leading-snug text-[#424242]", card ? "line-clamp-2" : "")}>{n.body}</p>
          {card ? (
            <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
              {renderCard(card)}
            </div>
          ) : n.requestId ? (
            <Link
              href={`/requests/view?id=${encodeURIComponent(n.requestId)}`}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
              style={{ color: TEAMS.purple }}
            >
              Open in OneRecord
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
      {!n.read ? (
        <span className="absolute top-4 left-1 size-1.5 rounded-full" style={{ background: TEAMS.purple }} aria-label="Unread" />
      ) : null}
    </li>
  );
}
