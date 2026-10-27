"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { PersonChip, formatSgtDate, formatSgtDateTime } from "@/components/common";
import { cn } from "@/lib/utils";

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
      <div>
        <h2 className="text-base font-semibold text-foreground">Change history</h2>
        <p className="text-[0.8125rem] text-muted-foreground">
          Every save is a new version with who, when and what. Requests already in flight finish on the version they started with.
        </p>
      </div>
      <ol className="relative space-y-0" data-testid="admin-history">
        {history.map((h, i) => {
          const live = h.version === config.version;
          const inFlight = inFlightByVersion.get(h.version) ?? 0;
          return (
            <li key={h.version} className="relative pb-4 pl-12 last:pb-0" data-testid={`admin-history-v${h.version}`}>
              {i < history.length - 1 ? <span aria-hidden className="absolute top-8 bottom-0 left-[17px] w-px bg-border-strong" /> : null}
              <span
                className={cn(
                  "absolute top-0 left-0 inline-flex h-8 min-w-9 items-center justify-center rounded-full border px-1.5 font-mono text-xs font-semibold tabular-nums",
                  live ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card text-foreground",
                )}
              >
                v{h.version}
              </span>
              <div className={cn("rounded-xl border bg-card px-4 py-3 shadow-raised", live ? "border-primary/40" : "border-border")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{h.summary}</p>
                  {live ? (
                    <span className="inline-flex h-5 items-center rounded-full bg-ok-soft px-2 text-[0.6875rem] font-semibold text-ok-ink">Live</span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <PersonChip personId={h.byId} />
                  <time dateTime={h.at} title={formatSgtDate(h.at)}>
                    {formatSgtDateTime(h.at)} SGT
                  </time>
                  {inFlight ? (
                    <span>
                      {inFlight} request{inFlight === 1 ? "" : "s"} still running on this version
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {history.length === 1 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <History className="size-3.5" aria-hidden /> Only the go-live version so far. Add a business unit or toggle a field to see a new version appear.
        </p>
      ) : null}
    </div>
  );
}
