"use client";

import { useEffect, useRef, useState } from "react";
import { useSandbox } from "@/lib/store";
import { useStuckDemand } from "@/lib/selectors";
import { formatSgd, LiveMark, Readout, ReadoutDelta, SapCode } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * Last value the tile showed, kept across remounts so the count-down still plays after a navigation
 * (e.g. Priya marks a record created, then returns to the queue).
 */
let lastShown: number | null = null;

const DURATION_MS = 1_800;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts down to `target` when it drops; jumps straight up when it rises (e.g. after Reset sandbox). */
function useCountDown(target: number): { shown: number; dropping: boolean } {
  const [shown, setShown] = useState<number>(() => lastShown ?? target);
  const [dropping, setDropping] = useState(false);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) {
      lastShown = target;
      return;
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (target > from || reduce) {
      setShown(target);
      lastShown = target;
      return;
    }
    let raf = 0;
    const start = performance.now();
    setDropping(true);
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION_MS);
      const v = Math.round(from + (target - from) * easeOutCubic(p));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        lastShown = target;
        setDropping(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastShown = shownRef.current;
    };
  }, [target]);

  return { shown, dropping };
}

/**
 * Live stuck-demand readout: customer orders blocked by missing master data. A readout cell (Gotham meta
 * column: a hairline on the left, no box, no rail, no icon): the coral figure is the state, the teal
 * square says it is read live from the sandbox, and the release shows inline after the figure.
 * Counts down when MDM releases orders. Render it as a direct child of a ReadoutStrip to lead the row.
 */
export function StuckDemandTile({ className }: { className?: string }) {
  const stuck = useStuckDemand();
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const lastCode = useSandbox((s) =>
    s.lastUnblock ? s.requests.find((r) => r.id === s.lastUnblock?.requestId)?.sapCode : undefined,
  );
  const { shown, dropping } = useCountDown(stuck.totalSgd);
  const released = lastUnblock ? lastUnblock.beforeSgd - lastUnblock.afterSgd : 0;

  return (
    <Readout
      lead
      className={className}
      tone="stuck"
      label="Stuck demand"
      marker={<LiveMark />}
      value={
        <>
          <span
            data-testid="stuck-demand-value"
            data-value={stuck.totalSgd}
            aria-live="polite"
            className={cn("transition-[letter-spacing] duration-500", dropping && "tracking-[-0.035em]")}
          >
            {formatSgd(shown)}
          </span>
          {released > 0 ? (
            <ReadoutDelta tone="ok" className={cn("transition-opacity duration-700", dropping ? "opacity-100" : "opacity-90")}>
              −{formatSgd(released)}
            </ReadoutDelta>
          ) : null}
        </>
      }
      caption={
        <>
          {stuck.count} customer purchase request{stuck.count === 1 ? "" : "s"} (PRs) can&apos;t become orders until a customer or item
          code exists in SAP B1.
        </>
      }
      footnote={
        lastUnblock && released > 0 ? (
          <>
            Last release: {formatSgd(released)} when {lastUnblock.requestId}
            {lastCode ? (
              <>
                {" "}
                (<SapCode code={lastCode} variant="plain" className="text-muted-foreground" />)
              </>
            ) : null}{" "}
            went live in SAP B1.
          </>
        ) : (
          "Drops the moment MDM marks a record created in SAP B1."
        )
      }
    />
  );
}
