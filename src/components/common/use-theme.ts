"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, type ConsoleTheme } from "./theme-script";

export type { ConsoleTheme };

function root(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

/** The theme currently applied to <html> (dark unless the light fallback is on). */
export function currentTheme(): ConsoleTheme {
  return root()?.classList.contains("dark") === false ? "light" : "dark";
}

/** The saved choice for this browser; dark when nothing is saved or storage is blocked. */
export function readStoredTheme(): ConsoleTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function paint(theme: ConsoleTheme) {
  const el = root();
  if (!el) return;
  el.classList.toggle("dark", theme === "dark");
  el.style.colorScheme = theme;
}

/** Switch the console theme and remember it for this browser. */
export function setTheme(theme: ConsoleTheme) {
  paint(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

/** Re-apply the saved choice (used when leaving the always-light /pitch frames). */
export function applyStoredTheme() {
  paint(readStoredTheme());
}

function subscribe(onChange: () => void) {
  const el = root();
  if (!el) return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/**
 * The live console theme. Re-renders when the theme toggles, so canvas drawings (the landing globe,
 * the Pulse map) can re-read their colours from CSS variables.
 */
export function useTheme(): ConsoleTheme {
  return useSyncExternalStore(subscribe, currentTheme, () => "dark");
}
