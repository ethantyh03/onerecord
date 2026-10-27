"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard controls for the recording frames (nothing on screen, so nothing shows in the take):
 * Esc → back to the director's console, R → replay.
 */
export function usePitchKeys(onReplay?: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") router.push("/demo");
      else if ((e.key === "r" || e.key === "R") && onReplay) onReplay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, onReplay]);
}
