"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { useStuckDemand } from "@/lib/selectors";
import { formatSgd, KpiTile, SapCode, SyntheticBadge } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * Last value the tile showed, kept across remounts so the count-down still plays after a navigation
 * (e.g. Priya marks a record created, then returns to the queue).
 */
let lastShown: number | null = null;

const DURATION_MS = 1_800;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts down to `target` when it drops; jumps straight up when it rises (e.g. after Reset demo). */
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

/** Live stuck-demand tile: customer orders blocked by missing master data. Counts down when MDM releases them. */
export function StuckDemandTile({ className }: { className?: string }) {
  const stuck = useStuckDemand();
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const lastCode = useSandbox((s) =>
    s.lastUnblock ? s.requests.find((r) => r.id === s.lastUnblock?.requestId)?.sapCode : undefined,
  );
  const { shown, dropping } = useCountDown(stuck.totalSgd);
  const released = lastUnblock ? lastUnblock.beforeSgd - lastUnblock.afterSgd : 0;

  return (
    <KpiTile
      className={cn("min-h-[148px]", className)}
      tone="stuck"
      icon={AlertTriangle}
      label="Stuck demand"
      badge={<SyntheticBadge label="Synthetic, illustrative" />}
      value={
        <span className="flex items-baseline gap-3">
          <span
            data-testid="stuck-demand-value"
            data-value={stuck.totalSgd}
            aria-live="polite"
            className={cn("transition-[letter-spacing] duration-500", dropping && "tracking-[-0.035em]")}
          >
            {formatSgd(shown)}
          </span>
          {released > 0 ? (
            <span
              className={cn(
                "rounded-full border border-ok/30 bg-ok-soft px-2 py-0.5 text-sm font-semibold tracking-normal text-ok-ink transition-opacity duration-700",
                dropping ? "opacity-100" : "opacity-90",
              )}
            >
              −{formatSgd(released)}
            </span>
          ) : null}
        </span>
      }
      caption={
        <>
          {stuck.count} purchase request{stuck.count === 1 ? "" : "s"} can&apos;t become sales orders until a customer or item
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
                (<SapCode code={lastCode} variant="plain" />)
              </>
            ) : null}{" "}
            went live in SAP B1.
          </>
        ) : (
          "Live from the sandbox: drops the moment MDM marks a record created in SAP B1."
        )
      }
    />
  );
}
