"use client";

import { useMemo, useRef } from "react";
import { backtest, matrix, streams } from "@/data/contract";
import { useSandbox } from "@/lib/store";
import { useNow, useStuckDemand } from "@/lib/selectors";
import { businessDaysBetween } from "@/lib/engine/sla";
import type { RequestStatus } from "@/lib/types";
import { IllustrativeMarker } from "@/components/common/badges";
import { StateGlyph } from "@/components/common/glyph";
import { LiveMark, Readout, ReadoutDelta, ReadoutStrip, ReadoutUnit } from "@/components/common/readout";
import { formatSgd } from "@/components/common/format";
import { useHonestyDrawer } from "@/components/pulse/analytics/DataHonestyDrawer";
import { SEASON_CAVEAT_SHORT } from "@/components/pulse/analytics/caveats";
import { usePulse } from "./PulseContext";
import { formatPct, sgdCompact, viewKey } from "./pulse-format";
import { useUnblockCountdown } from "./use-unblock-countdown";

const IN_FLIGHT: ReadonlySet<RequestStatus> = new Set<RequestStatus>(["in_approval", "needs_info", "mdm_review"]);

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function oneDp(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** The strip's one provenance line: what is illustrative, what is live, and the way into "What's real here?". */
function StripFootnote() {
  const honesty = useHonestyDrawer();
  return (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <IllustrativeMarker label="Illustrative" />
      <LiveMark label="Live from OneRecord" />
      <button
        type="button"
        onClick={() => honesty?.open()}
        title="What's real here? Limits and caveats"
        className="font-medium text-muted-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        What&apos;s real here?
      </button>
    </span>
  );
}

const SEEN_KEY = "onerecord-pulse-unblock-seen";

/**
 * Component 2: six headline readouts in two tiers, order unchanged. Tier one is the demand money
 * (orders, pipeline, stuck), with stuck demand as the large figure in the wider third column; tier
 * two is our own work (setups, forecast, analyst time) at a smaller size. Columns line up across tiers.
 * Stuck demand and MDM work in flight read live from the sandbox.
 */
export function PulseKpis() {
  const { view } = usePulse();
  const group = matrix.views[viewKey(view)].group;
  const now = useNow(30_000);
  const stuck = useStuckDemand();
  const requests = useSandbox((s) => s.requests);
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const stuckRef = useRef<HTMLDivElement>(null);
  // Counts down when the tile is on screen (it sits below the region map at presenter size).
  const shownStuck = useUnblockCountdown(stuck.totalSgd, SEEN_KEY, stuckRef);

  const avgBlockedDays = useMemo(() => {
    if (stuck.prs.length === 0) return 0;
    const total = stuck.prs.reduce((acc, p) => acc + Math.max(0, businessDaysBetween(p.createdAt, now)), 0);
    return total / stuck.prs.length;
  }, [stuck.prs, now]);

  const inFlight = useMemo(() => {
    const live = requests.filter((r) => IN_FLIGHT.has(r.status));
    const ages = live.map((r) => Math.max(0, businessDaysBetween(r.submittedAt ?? r.createdAt, now)));
    return { count: live.length, medianAge: median(ages), atMdm: live.filter((r) => r.status === "mdm_review").length };
  }, [requests, now]);

  const pipeline = useMemo(
    () =>
      streams.countries.reduce(
        (acc, c) => ({ sgd: acc.sgd + c.prPipelineOpenSgd, count: acc.count + c.prOpenCount }),
        { sgd: 0, count: 0 },
      ),
    [],
  );

  /** Distinct setups the stuck PRs wait on: linked MDM requests, plus missing records nobody has requested yet. */
  const setups = useMemo(() => {
    const keys = new Set(
      stuck.prs.map((p) => p.blockedByRequestId ?? `none:${p.customerCode ? "" : p.customerName}|${p.itemCode ? "" : p.itemName}`),
    );
    return keys.size;
  }, [stuck.prs]);

  const h = backtest.headline;
  const released = lastUnblock && lastUnblock.afterSgd === stuck.totalSgd ? lastUnblock.beforeSgd - lastUnblock.afterSgd : 0;

  return (
    <ReadoutStrip
      as="section"
      id="pulse-kpis"
      aria-label="Headline numbers"
      columns={3}
      className="scroll-mt-24 border-t border-border pt-6"
      gridClassName="gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]"
      footnote={<StripFootnote />}
    >
      <Readout
        label="Customer orders, last 12 months"
        value={sgdCompact(group.sgd12m)}
        caption={
          <>
            <span className="font-semibold text-foreground">{formatPct(group.yoy)}</span> on the same 12 months a year
            earlier. Latest quarter: {formatPct(group.momentum)}.
          </>
        }
        footnote={view === "merged" ? "Confirmed POs, merged customers." : "Confirmed POs, raw SAP records."}
      />
      <Readout
        label="Open purchase requests"
        value={sgdCompact(pipeline.sgd)}
        caption={`${pipeline.count} quotes customers have accepted but not yet turned into orders. Pipeline, not counted as demand.`}
        footnote="Excludes requests blocked by a missing record (next tile)."
      />
      <div ref={stuckRef} data-testid="pulse-stuck-demand" className="grid">
        <Readout
          lead
          size="lg"
          tone="stuck"
          href="/mdm"
          marker={<LiveMark />}
          label="Stuck demand"
          value={
            <>
              <span data-testid="pulse-stuck-demand-value">{formatSgd(shownStuck)}</span>
              {released > 0 ? <ReadoutDelta tone="ok">−{formatSgd(released)}</ReadoutDelta> : null}
            </>
          }
          caption={
            stuck.count > 0
              ? `${stuck.count} customer purchase request${stuck.count === 1 ? "" : "s"} (PRs) can't become orders: ${stuck.count === 1 ? "it waits" : "they wait"} on ${setups} customer or item setup${setups === 1 ? "" : "s"}, ${oneDp(avgBlockedDays)} business days on average.`
              : "No customer purchase requests (PRs) are waiting on a setup right now."
          }
          footnote={
            released > 0 ? (
              <span className="inline-flex items-baseline gap-1.5 font-medium text-ok-ink">
                <StateGlyph tone="ok" size="sm" className="translate-y-[-1px]" />
                <span>
                  {formatSgd(released)} released when <span className="mono-id">{lastUnblock?.requestId}</span> was created in
                  SAP B1
                </span>
              </span>
            ) : (
              "Live from OneRecord. Open the MDM console to clear it."
            )
          }
        />
      </div>
      <Readout
        size="sm"
        label="Setup requests in flight"
        marker={<LiveMark />}
        value={inFlight.count}
        caption={`Customer, item and vendor setups being approved. Median age ${oneDp(inFlight.medianAge)} business days; ${inFlight.atMdm} waiting for the MDM final check. Our internal work, not demand.`}
        footnote="Live from OneRecord."
      />
      <Readout
        size="sm"
        tone="ok"
        label="Forecast error, Products A and B"
        value={
          <>
            <span className="text-muted-foreground line-through decoration-[2px] decoration-muted-foreground/50">
              {Math.round(h.baselineWape * 100)}
            </span>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <span className="sr-only">down to</span>
            <span>{Math.round(h.oursWape * 100)}</span>
            <ReadoutUnit className="ml-0">per 100</ReadoutUnit>
          </>
        }
        caption={`${h.plainBaseline}. ${h.plainOurs}.`}
        footnote={`Backtested on 6 months the model never saw. ${SEASON_CAVEAT_SHORT}`}
      />
      <Readout
        size="sm"
        label="Analyst time back"
        value={
          <span>
            ≈40<ReadoutUnit>h / month</ReadoutUnit>
          </span>
        }
        caption="Country analysts no longer extract and reconcile spreadsheets by hand each month."
        footnote="Assumption A21: 5 analysts × 1 day a month. To confirm in the pilot."
      />
    </ReadoutStrip>
  );
}
