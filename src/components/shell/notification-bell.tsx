"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Mail, MessageSquare } from "lucide-react";
import type { AppNotification } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/common/empty-state";
import { firstName, formatAgo } from "@/components/common/format";
import { SapCode } from "@/components/common/sap-code";
import { useSimNow } from "@/components/common/use-sim-now";

const CHANNEL = {
  teams: { label: "Teams", icon: MessageSquare, cls: "bg-teams text-white" },
  outlook: { label: "Outlook", icon: Mail, cls: "bg-outlook text-white" },
} as const;

function ChannelMark({ channel }: { channel: AppNotification["channel"] }) {
  const c = CHANNEL[channel];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", c.cls)} title={c.label}>
      <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      <span className="sr-only">{c.label}</span>
    </span>
  );
}

/** Teams and Outlook messages for the current persona, as they would arrive in Microsoft 365. */
export function NotificationBell() {
  const router = useRouter();
  const now = useSimNow();
  const [open, setOpen] = useState(false);
  const personaId = useSandbox((s) => s.personaId);
  const notifications = useSandbox((s) => s.notifications);
  const personName = useSandbox((s) => s.config.people.find((p) => p.id === s.personaId)?.name ?? "you");

  const mine = useMemo(
    () =>
      notifications
        .filter((n) => n.toId === personaId)
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    [notifications, personaId],
  );
  const unread = mine.filter((n) => !n.read);
  const unreadTeams = unread.filter((n) => n.channel === "teams").length;
  const unreadOutlook = unread.length - unreadTeams;

  function openNotification(n: AppNotification) {
    const store = useSandbox.getState();
    if (!n.read) store.markNotificationRead(n.id);
    setOpen(false);
    if (n.requestId) router.push(`/requests/${encodeURIComponent(n.requestId)}`);
  }

  function markAllRead() {
    const store = useSandbox.getState();
    for (const n of unread) store.markNotificationRead(n.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-lg border bg-card text-foreground outline-none transition-colors",
          "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 data-popup-open:bg-muted",
        )}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
      >
        <Bell aria-hidden className="size-[1.125rem]" strokeWidth={2} />
        {unread.length > 0 ? (
          <span className="num absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-stuck px-1 text-[0.6875rem] leading-none font-semibold text-stuck-foreground">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[400px] max-w-[calc(100vw-1.5rem)] gap-0 p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-2 rounded-[3px] bg-teams" />
                Teams <span className="num font-medium text-foreground">{unreadTeams}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden className="size-2 rounded-[3px] bg-outlook" />
                Outlook <span className="num font-medium text-foreground">{unreadOutlook}</span>
              </span>
              <span>unread</span>
            </p>
          </div>
          {unread.length > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {mine.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Bell}
            title={`Nothing new for ${firstName(personName)}`}
            description="Approval requests, questions and SAP B1 confirmations arrive here from Teams and Outlook."
          />
        ) : (
          <ul className="scrollbar-thin max-h-[min(440px,60vh)] divide-y overflow-y-auto">
            {mine.slice(0, 30).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:bg-muted",
                    !n.read && "bg-primary-soft/45",
                  )}
                >
                  <ChannelMark channel={n.channel} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("text-sm leading-snug text-foreground", n.read ? "font-medium" : "font-semibold")}>
                        {n.title}
                      </span>
                      <span className="num shrink-0 pt-px text-[0.6875rem] text-muted-foreground">{formatAgo(n.at, now)}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-muted-foreground">
                      {n.body}
                    </span>
                    {n.requestId ? (
                      <span className="mt-1.5 flex items-center gap-1.5">
                        <SapCode code={n.requestId} className="text-[0.6875rem]" />
                      </span>
                    ) : null}
                  </span>
                  {!n.read ? <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
