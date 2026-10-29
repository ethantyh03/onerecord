"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useSandbox } from "@/lib/store";

/**
 * Counts a stuck-demand figure down from the value before the last SAP release to the current value,
 * once per release and per place on the page (remembered for this browser tab under `seenKey`).
 * The count starts only once `ref` is on screen, so a figure below the fold counts down when the
 * presenter scrolls to it instead of off-screen. Display only: never touches the store. Static under
 * reduced motion.
 */
export function useUnblockCountdown(target: number, seenKey: string, ref: RefObject<HTMLElement | null>): number {
  const lastUnblock = useSandbox((s) => s.lastUnblock);
  const [shown, setShown] = useState(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const key = lastUnblock ? `${lastUnblock.requestId}@${lastUnblock.at}` : "";
    let seen = "";
    try {
      seen = window.sessionStorage.getItem(seenKey) ?? "";
    } catch {
      seen = key;
    }
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduce = false;
    }
    const shouldAnimate =
      !reduce && lastUnblock != null && key !== seen && lastUnblock.afterSgd === target && lastUnblock.beforeSgd > target;
    if (!shouldAnimate) {
      setShown(target);
      return;
    }
    const from = lastUnblock.beforeSgd;
    const delay = 450;
    const dur = 1600;
    setShown(from);

    let start = 0;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start - delay) / dur));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        try {
          window.sessionStorage.setItem(seenKey, key);
        } catch {
          /* private mode: animate again next time, harmless */
        }
      }
    };
    const run = () => {
      start = performance.now();
      raf.current = requestAnimationFrame(tick);
    };

    const el = ref.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.6)) {
            io?.disconnect();
            io = null;
            run();
          }
        },
        { threshold: [0, 0.6, 1] },
      );
      io.observe(el);
    } else {
      run();
    }
    return () => {
      io?.disconnect();
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [lastUnblock, target, seenKey, ref]);

  return shown;
}
