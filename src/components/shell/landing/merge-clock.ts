"use client";

import { useEffect, useState } from "react";
import { MERGE_TOTAL_MS, landedCount, type CustomerPoint } from "./globe-data";

/**
 * The hero's one "merge" moment: when the duplicate customer records start gliding into the records
 * they duplicate. Shared by the globe (draws it) and the meta counter (388 records → 363 customers).
 */
export interface MergeClock {
  /** performance.now() when the merge starts: +Infinity = not scheduled, -Infinity = already merged */
  readonly start: number;
  set(start: number): void;
  subscribe(fn: () => void): () => void;
}

export function createMergeClock(): MergeClock {
  const listeners = new Set<() => void>();
  const clock = {
    start: Number.POSITIVE_INFINITY,
    set(start: number) {
      clock.start = start;
      listeners.forEach((fn) => fn());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
  return clock;
}

export type MergePhase = "raw" | "merging" | "merged";

/** How many duplicates have landed so far, re-rendering only when that number changes. */
export function useMergeProgress(
  clock: MergeClock,
  dups: Pick<CustomerPoint, "code" | "dup">[],
  reduce: boolean,
): { landed: number; phase: MergePhase } {
  const total = dups.filter((d) => d.dup).length;
  const [state, setState] = useState<{ landed: number; phase: MergePhase }>({ landed: 0, phase: "raw" });

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    const read = (now: number): { landed: number; phase: MergePhase } => {
      const elapsed = now - clock.start;
      if (elapsed < 0) return { landed: 0, phase: "raw" };
      if (reduce || elapsed >= MERGE_TOTAL_MS) return { landed: total, phase: "merged" };
      return { landed: landedCount(dups, elapsed), phase: "merging" };
    };
    const apply = (s: { landed: number; phase: MergePhase }) =>
      setState((prev) => (prev.landed === s.landed && prev.phase === s.phase ? prev : s));
    const tick = () => {
      raf = 0;
      const s = read(performance.now());
      apply(s);
      if (s.phase === "merging") raf = requestAnimationFrame(tick);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      raf = 0;
      const now = performance.now();
      apply(read(now));
      const wait = clock.start - now;
      if (!Number.isFinite(clock.start) && clock.start > 0) return;
      if (wait > 0) timer = window.setTimeout(tick, wait + 10);
      else if (read(now).phase === "merging") raf = requestAnimationFrame(tick);
    };
    const off = clock.subscribe(schedule);
    schedule();
    return () => {
      off();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [clock, dups, total, reduce]);

  return state;
}
