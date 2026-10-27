"use client";

import { useEffect, useState } from "react";
import { useSandbox } from "@/lib/store";

/**
 * The simulated "now" as an ISO string. Re-renders when the demo clock is
 * fast-forwarded and on a gentle tick so relative times and SLA chips stay current.
 */
export function useSimNow(tickMs = 20_000): string {
  const offset = useSandbox((s) => s.clockOffsetMs);
  const [now, setNow] = useState(() => useSandbox.getState().nowIso());

  useEffect(() => {
    const update = () => setNow(useSandbox.getState().nowIso());
    update();
    const id = window.setInterval(update, tickMs);
    return () => window.clearInterval(id);
  }, [offset, tickMs]);

  return now;
}
