"use client";

import { useSyncExternalStore } from "react";

export interface Viewport {
  w: number;
  h: number;
}

const SERVER: Viewport = { w: 1920, h: 1080 };
let cached: Viewport = SERVER;

function read(): Viewport {
  if (typeof window === "undefined") return SERVER;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== cached.w || h !== cached.h) cached = { w, h };
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

/** The browser viewport in CSS px (1920×1080 on the server). */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}
