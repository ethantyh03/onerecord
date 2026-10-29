"use client";

import { useLayoutEffect } from "react";
import { applyStoredTheme } from "@/components/common/use-theme";

/**
 * The pitch frames style <html>/<body> themselves (e.g. the summary's canvas background), so the
 * document root must be light while a frame is open, even when the console is dark. The inline theme
 * script already does this on a direct load; this covers client-side navigation in and out.
 */
export function PitchLightRoot() {
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.classList.remove("dark");
    el.style.colorScheme = "light";
    return () => applyStoredTheme();
  }, []);
  return null;
}
