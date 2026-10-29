"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { PersonChip, StatusText, formatSgtDate, formatSgtDateTime } from "@/components/common";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./shared";

export function HistoryTab() {
  const config = useSandbox((s) => s.config);
  const requests = useSandbox((s) => s.requests);
  const history = useMemo(() => [...config.history].sort((a, b) => b.version - a.version), [config.history]);

  /** Requests still in flight on each config version: proof that they keep the route they started with. */
  const inFlightByVersion = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of requests) {
      if (r.status !== "in_approval" && r.status !== "needs_info" && r.status !== "mdm_review") continue;
      m.set(r.configVersion, (m.get(r.configVersion) ?? 0) + 1);
    }
    return m;
  }, [requests]);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Change history"
        description="Every save is a new version with who, when and what. Requests already in flight finish on the version they started with."
      />
      <ol className="panel divide-y divide-border overflow-hidden" data-testid="admin-history">
        {history.map((h) => {
          const live = h.version === config.version;
          const inFlight = inFlightByVersion.get(h.version) ?? 0;
          return (
            <li
              key={h.version}
              className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3"
              data-testid={`admin-history-v${h.version}`}
              aria-current={live ? "true" : undefined}
            >
              <span className={cn("mono-id pt-px font-medium", live ? "text-foreground" : "text-muted-foreground")}>v{h.version}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{h.summary}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <PersonChip personId={h.byId} />
                  <time dateTime={h.at} title={formatSgtDate(h.at)} className="num">
                    {formatSgtDateTime(h.at)} SGT
                  </time>
                  {inFlight ? (
                    <span>
                      {inFlight} request{inFlight === 1 ? "" : "s"} still running on this version
                    </span>
                  ) : null}
                </div>
              </div>
              {live ? <StatusText tone="ok">Live</StatusText> : <span />}
            </li>
          );
        })}
      </ol>
      {history.length === 1 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="size-3.5" aria-hidden /> Only the go-live version so far. Each change adds a new version here.
        </p>
      ) : null}
    </div>
  );
}
