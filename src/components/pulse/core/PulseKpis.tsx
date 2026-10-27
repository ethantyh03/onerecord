"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Clock4, FileStack, FlaskConical, Hourglass, PackageCheck, Target, Workflow } from "lucide-react";
import { backtest, matrix, streams } from "@/data/contract";
import { useSandbox } from "@/lib/store";
import { useNow, useStuckDemand } from "@/lib/selectors";
import { businessDaysBetween } from "@/lib/engine/sla";
import type { RequestStatus } from "@/lib/types";
import { KpiTile } from "@/components/common/kpi-tile";
import { formatSgd } from "@/components/common/format";
import { useHonestyDrawer } from "@/components/pulse/analytics/DataHonestyDrawer";
import { SEASON_CAVEAT_SHORT } from "@/components/pulse/analytics/caveats";
import { usePulse } from "./PulseContext";
import { formatPct, sgdCompact, viewKey } from "./pulse-format";

const IN_FLIGHT: ReadonlySet<RequestStatus> = new Set<RequestStatus>(["in_approval", "needs_info", "mdm_review"]);

function LiveDot() {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-stuck/30 bg-stuck-soft px-2 text-[0.6875rem] font-medium text-stuck-ink">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-stuck opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-stuck" />
      </span>
      Live
    </span>
  );
}

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

/** "Illustrative" chip that opens the "What's real here?" drawer. */
function IllustrativeChip() {
  const honesty = useHonestyDrawer();
  return (
    <button
      type="button"
      onClick={() => honesty?.open()}
      title="What's real here? Limits and caveats"
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border-strong/70 bg-card px-2 text-[0.6875rem] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <FlaskConical aria-hidden className="size-3" strokeWidth={2.25} />
      Illustrative
    </button>
  );
}

const SEEN_KEY = "onerecord-pulse-unblock-seen";

/**
 * Counts the stuck-demand figure down from the value before the last SAP release to the current value,
 * once per release (remembered for this browser tab). Display only: never touches the store.
 */
function useCountdown(target: number): number {
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const [shown, setShown] = useState(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const key = lastUnblock ? `${lastUnblock.requestId}@${lastUnblock.at}` : "";
    let seen = "";
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      seen = key;
    }
    const shouldAnimate =
      lastUnblock != null && key !== seen && lastUnblock.afterSgd === target && lastUnblock.beforeSgd > target;
    if (!shouldAnimate) {
      setShown(target);
      return;
    }
    const from = lastUnblock.beforeSgd;
    const start = performance.now();
    const delay = 450;
    const dur = 1600;
    setShown(from);
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start - delay) / dur));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        try {
          window.sessionStorage.setItem(SEEN_KEY, key);
        } catch {
          /* private mode: animate again next time, harmless */
        }
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [lastUnblock, target]);

  return shown;
}

/** Component 2: six headline tiles. Stuck demand and MDM work in flight read live from the sandbox. */
export function PulseKpis() {
  const { view } = usePulse();
  const group = matrix.views[viewKey(view)].group;
  const now = useNow(30_000);
  const stuck = useStuckDemand();
  const requests = useSandbox((s) => s.requests);
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const shownStuck = useCountdown(stuck.totalSgd);

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
    <section id="pulse-kpis" aria-label="Headline numbers" className="grid scroll-mt-24 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiTile
        icon={PackageCheck}
        tone="brand"
        badge={<IllustrativeChip />}
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
      <KpiTile
        icon={FileStack}
        badge={<IllustrativeChip />}
        label="Open purchase requests"
        value={sgdCompact(pipeline.sgd)}
        caption={`${pipeline.count} quotes customers have accepted but not yet turned into orders. Pipeline, not counted as demand.`}
        footnote="Excludes requests blocked by a missing record (next tile)."
      />
      <div data-testid="pulse-stuck-demand" className="grid">
        <KpiTile
          icon={Hourglass}
          tone="stuck"
          href="/mdm"
          badge={<LiveDot />}
          label="Stuck demand"
          value={<span data-testid="pulse-stuck-demand-value">{formatSgd(shownStuck)}</span>}
          caption={
            stuck.count > 0
              ? `${stuck.count} customer purchase request${stuck.count === 1 ? "" : "s"} (PRs) can't become orders: ${stuck.count === 1 ? "it waits" : "they wait"} on ${setups} customer or item setup${setups === 1 ? "" : "s"}, ${oneDp(avgBlockedDays)} business days on average.`
              : "No customer purchase requests (PRs) are waiting on a setup right now."
          }
          footnote={
            released > 0 ? (
              <span className="inline-flex items-start gap-1 font-medium text-ok-ink">
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
                {formatSgd(released)} released when {lastUnblock?.requestId} was created in SAP B1
              </span>
            ) : (
              "Live from OneRecord. Open the MDM console to clear it."
            )
          }
        />
      </div>
      <KpiTile
        icon={Workflow}
        label="Setup requests in flight"
        value={inFlight.count}
        caption={`Customer, item and vendor setups being approved. Median age ${oneDp(inFlight.medianAge)} business days; ${inFlight.atMdm} waiting for the MDM final check. Our internal work, not demand.`}
        footnote="Live from OneRecord."
      />
      <KpiTile
        icon={Target}
        tone="ok"
        badge={<IllustrativeChip />}
        label="Forecast error, Products A and B"
        value={
          <span className="flex items-baseline gap-2">
            <span className="text-muted-foreground line-through decoration-[2px] decoration-muted-foreground/50">
              {Math.round(h.baselineWape * 100)}
            </span>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <span className="sr-only">down to</span>
            <span>{Math.round(h.oursWape * 100)}</span>
            <span className="text-base font-medium tracking-normal text-secondary-foreground">per 100</span>
          </span>
        }
        caption={`${h.plainBaseline}. ${h.plainOurs}.`}
        footnote={`Backtested on 6 months the model never saw. ${SEASON_CAVEAT_SHORT}`}
      />
      <KpiTile
        icon={Clock4}
        label="Analyst time back"
        value={
          <span className="flex items-baseline gap-1.5">
            ≈40<span className="text-base font-medium tracking-normal text-secondary-foreground">h / month</span>
          </span>
        }
        caption="Country analysts no longer extract and reconcile spreadsheets by hand each month."
        footnote="Assumption A21: 5 analysts × 1 day a month. To confirm in the pilot."
      />
    </section>
  );
}
