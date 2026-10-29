"use client";

import type { ReactNode } from "react";
import { BatteryFull, Bell, CalendarDays, Ellipsis, MessageSquare, SignalHigh, Users, Wifi } from "lucide-react";
import { formatSgtTime } from "@/components/common/format";
import { cn } from "@/lib/utils";
import { MS_FONT, MS_SCOPE, TEAMS, useSimNow } from "./shared";

export interface PhoneFrameProps {
  children: ReactNode;
  /** Caption under the device, e.g. "Amy Lim · travelling, on Teams mobile". */
  caption?: ReactNode;
  /** Show the Teams-mobile bottom tab bar (default true). */
  teamsChrome?: boolean;
  /** Screen height in px (default 600). Width scales with it. */
  height?: number;
  className?: string;
}

const TABS = [
  { label: "Activity", icon: Bell, active: true },
  { label: "Chat", icon: MessageSquare },
  { label: "Teams", icon: Users },
  { label: "Calendar", icon: CalendarDays },
  { label: "More", icon: Ellipsis },
] as const;

/** A modern phone bezel for mobile moments (Amy answering an approver's question while travelling). */
export function PhoneFrame({ children, caption, teamsChrome = true, height = 600, className }: PhoneFrameProps) {
  const now = useSimNow();
  const width = Math.round(height * 0.49);

  return (
    <figure className={cn("inline-flex flex-col items-center gap-3", className)}>
      {/* The device is a look-alike (light Teams mobile); the caption under it stays console text. */}
      <div
        className={cn(MS_SCOPE, "relative rounded-[46px] bg-[#16161a] p-[9px] shadow-[inset_0_0_0_1.5px_#4a4a52]")}
        style={{ width: width + 18 }}
      >
        {/* side buttons */}
        <span className="absolute top-[110px] -left-[2.5px] h-8 w-[3px] rounded-l bg-[#2a2a30]" aria-hidden="true" />
        <span className="absolute top-[156px] -left-[2.5px] h-12 w-[3px] rounded-l bg-[#2a2a30]" aria-hidden="true" />
        <span className="absolute top-[140px] -right-[2.5px] h-16 w-[3px] rounded-r bg-[#2a2a30]" aria-hidden="true" />

        <div
          className="relative flex flex-col overflow-hidden rounded-[38px] bg-white"
          style={{ height, width, fontFamily: MS_FONT }}
        >
          {/* status bar */}
          <div className="relative flex h-[46px] shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold text-[#111]">
            <span className="tabular-nums">{formatSgtTime(now)}</span>
            <span className="absolute top-[11px] left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
            <span className="flex items-center gap-1" aria-hidden="true">
              <SignalHigh className="size-3.5" strokeWidth={2.5} />
              <Wifi className="size-3.5" strokeWidth={2.5} />
              <BatteryFull className="size-4" strokeWidth={2} />
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">{children}</div>

          {teamsChrome ? (
            <nav
              aria-hidden="true"
              className="grid shrink-0 grid-cols-5 border-t border-[#ebebeb] bg-[#fafafa] px-1 pt-1.5 pb-1"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = "active" in t && t.active;
                return (
                  <span
                    key={t.label}
                    className="flex flex-col items-center gap-0.5 text-[10px]"
                    style={{ color: active ? TEAMS.purple : "#616161" }}
                  >
                    <Icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.8} />
                    <span className={active ? "font-semibold" : undefined}>{t.label}</span>
                  </span>
                );
              })}
            </nav>
          ) : null}

          {/* home indicator */}
          <div className={cn("flex h-[22px] shrink-0 items-center justify-center", teamsChrome ? "bg-[#fafafa]" : "bg-white")}>
            <span className="h-[5px] w-[118px] rounded-full bg-[#111]" aria-hidden="true" />
          </div>
        </div>
      </div>
      {caption ? <figcaption className="max-w-[300px] text-center text-xs text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
