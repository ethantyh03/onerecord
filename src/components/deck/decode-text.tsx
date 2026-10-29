"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** The characters an SAP record code is made of: the noise a name resolves out of. */
const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

function unit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * T1, the bookend (deck content doc §2): each glyph flickers on and off in hard steps through record-code
 * characters, then settles on its own letter, staggered left to right, once, within `duration` ms.
 * Every glyph keeps the width of its final letter (the noise is drawn over it), so the line never reflows.
 * Not playing = the settled text. The accessible name is always the whole line.
 */
export function DecodeText({
  text,
  play,
  hidden,
  duration = 900,
  className,
  style,
  onDone,
}: {
  text: string;
  /** Start the flicker (once per mount while true). */
  play: boolean;
  /** Before it plays: keep the line invisible (it still holds its space). */
  hidden?: boolean;
  duration?: number;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !play) return;
    const glyphs = Array.from(root.querySelectorAll<HTMLElement>("[data-g]"));
    const finals = glyphs.map((g) => g.querySelector<HTMLElement>("[data-final]")!);
    const noises = glyphs.map((g) => g.querySelector<HTMLElement>("[data-noise]")!);
    const n = glyphs.length;
    const per = Math.min(440, duration * 0.5);
    const stagger = n > 1 ? (duration - per) / (n - 1) : 0;
    const frame = 46; // ms per noise character: hard steps, no fades

    finals.forEach((f) => (f.style.opacity = "0"));
    noises.forEach((x) => (x.style.opacity = "0"));

    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - t0;
      let settled = 0;
      for (let i = 0; i < n; i++) {
        const local = t - i * stagger;
        const fin = finals[i];
        const noise = noises[i];
        if (local < 0) continue;
        if (local >= per) {
          if (fin.style.opacity !== "1") {
            fin.style.opacity = "1";
            noise.style.opacity = "0";
          }
          settled++;
          continue;
        }
        const k = Math.floor(local / frame);
        // On/off pattern per glyph: mostly on, with irregular dropouts, like a screen powering on.
        const on = unit(`${text}-${i}-${k}`) > 0.28;
        const ch = NOISE[Math.floor(unit(`${text}-${i}-${k}-c`) * NOISE.length)];
        // The last frames show the real letter flickering before it holds.
        const real = local > per * 0.72;
        if (real) {
          fin.style.opacity = on ? "1" : "0.15";
          noise.style.opacity = "0";
        } else {
          fin.style.opacity = "0";
          noise.textContent = ch;
          noise.style.opacity = on ? "0.9" : "0";
        }
      }
      if (settled < n) raf = requestAnimationFrame(tick);
      else doneRef.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      finals.forEach((f) => (f.style.opacity = "1"));
      noises.forEach((x) => (x.style.opacity = "0"));
    };
  }, [play, text, duration]);

  const words = text.split(/(\s+)/);
  let gi = 0;
  return (
    <span
      ref={ref}
      className={cn("inline", className)}
      style={{ ...style, visibility: hidden && !play ? "hidden" : undefined }}
    >
      <span className="sr-only">{text}</span>
      {words.map((w, wi) =>
        /^\s+$/.test(w) ? (
          <span key={wi} aria-hidden>
            {w}
          </span>
        ) : (
          // Words never break inside: each is one inline-block of glyphs.
          <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
            {w.split("").map((ch) => {
              const i = gi++;
              return (
                <span key={i} data-g className="relative inline-block">
                  <span data-final>{ch}</span>
                  <span
                    data-noise
                    className="absolute inset-0 flex items-center justify-center font-mono font-normal"
                    style={{ opacity: 0, fontSize: "0.86em", fontStretch: "100%", letterSpacing: 0 }}
                  />
                </span>
              );
            })}
          </span>
        ),
      )}
    </span>
  );
}
