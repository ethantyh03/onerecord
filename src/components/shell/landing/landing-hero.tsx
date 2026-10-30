"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MERGE_DELAY_MS, hashUnit } from "./globe-data";
import { HeroMeta } from "./hero-meta";
import { LiveRequestPanel } from "./live-request-panel";
import { createMergeClock } from "./merge-clock";
import { RequestGlobe, type GlobeHandle } from "./request-globe";

/**
 * The hero bleeds to the edges of the content area (rail, if shown, on the left; status bar above). On
 * very wide screens the content column stops at 1600px, so stretch the band the rest of the way to the
 * right edge instead of letting the globe's horizon end in mid-air.
 */
function useRightBleed(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    const main = document.getElementById("main");
    const column = el?.parentElement;
    if (!el || !main || !column) return;
    const fit = () => {
      el.style.marginRight = "";
      const gap = main.getBoundingClientRect().right - el.getBoundingClientRect().right;
      if (gap > 0.5) el.style.marginRight = `${parseFloat(getComputedStyle(el).marginRight) - gap}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(main);
    return () => ro.disconnect();
  }, [ref]);
}

/** Side inset of the wordmark, as a share of the hero's width. */
const MARK_INSET = 0.012;

/**
 * Fit the wordmark to the hero's full width, edge to edge (like "Gotham" on the reference): measure its
 * width per em once the font is in, then set the font size so the word spans the hero. Re-fits when the
 * hero changes width (window, or the rail opening and closing).
 */
function useFitWordmark(sectionRef: RefObject<HTMLElement | null>, markRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const mark = markRef.current;
    if (!section || !mark) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      const size = parseFloat(getComputedStyle(mark).fontSize);
      const width = mark.getBoundingClientRect().width;
      const hero = section.getBoundingClientRect().width;
      if (!size || !width || !hero) return;
      const next = (hero * (1 - 2 * MARK_INSET)) / (width / size);
      if (Math.abs(next - size) > 0.5) section.style.setProperty("--mark", `${next.toFixed(2)}px`);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(fit);
    ro.observe(section);
    return () => {
      disposed = true;
      ro.disconnect();
    };
  }, [sectionRef, markRef]);
}

const WORDMARK = "Tesseract";

/**
 * The wordmark flickers in once on load, like a screen powering on (as "Gotham" does on the reference):
 * each letter blinks on and off a couple of times at its own irregular moments, then settles solid, within
 * about 0.9–1.3 s. Opacity only, in hard steps, so the fitted width never changes. No loop, no colour, no
 * glow; nothing at all under reduced motion.
 */
function useFlickerIn(markRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const mark = markRef.current;
    if (!mark || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(mark.querySelectorAll<HTMLElement>("[data-letter]"));
    const animations = letters.map((el, i) => {
      const r = (k: number) => hashUnit(`flicker-${i}-${k}`);
      const duration = 900 + 400 * r(0);
      // Moments as a share of the duration, each after the last: on, off, on, (dim, on), settled.
      const on1 = 0.05 + 0.3 * r(1);
      const off1 = on1 + 0.05 + 0.1 * r(2);
      const on2 = off1 + 0.04 + 0.1 * r(3);
      const twice = r(4) > 0.35;
      const off2 = on2 + 0.08 + 0.12 * r(5);
      const on3 = off2 + 0.03 + 0.08 * r(6);
      // Stretch the sequence so each letter settles late in its own duration (0.86–0.96 of it).
      const scale = (0.86 + 0.1 * r(7)) / (twice ? on3 : on2);
      const step = (opacity: number, offset: number) => ({ opacity, offset: offset * scale, easing: "steps(1, end)" });
      const frames = [
        step(0, 0),
        step(1, on1),
        step(0.08, off1),
        step(1, on2),
        ...(twice ? [step(0.3, off2), step(1, on3)] : []),
        { opacity: 1, offset: 1 },
      ];
      return el.animate(frames, { duration, fill: "backwards" });
    });
    return () => animations.forEach((a) => a.cancel());
  }, [markRef]);
}

/**
 * Sizes that scale with the hero's width (the section is the size container). The copy column is wide
 * enough for each line of the headline to hold on one line. `--mark` starts as an estimate ("Tesseract"
 * is about 5.55em wide at this tracking) and is then set from a measurement.
 */
const HERO_VARS = {
  "--copy-w": "clamp(21rem, 42cqw, 46rem)",
  "--gap": "2.4cqw",
  "--mark": `calc(100cqw * ${1 - 2 * MARK_INSET} / 5.55)`,
  "--mark-h": "calc(var(--mark) * 0.8)",
} as CSSProperties;

/**
 * Landing hero, after the Gotham site's hero but with our content: a full-bleed globe of Lives Group's
 * customer records and live requests (the region fitted into the right-hand zone, the horizon arcing
 * over it), what Tesseract does and the two ways in at the top left, the facts the globe shows in
 * columns between thin rules above the right of the wordmark, and the product name as a giant wordmark
 * across the full width.
 * The open-request queue (each row is one arc; pointing at a row lights it) follows as its own section.
 * The hero is at least one screen tall and grows with its content, so nothing overlaps on small screens.
 */
export function LandingHero() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLParagraphElement>(null);
  const highlightRef = useRef<string | null>(null);
  const globeRef = useRef<GlobeHandle | null>(null);
  const [keepOut] = useState(() => [copyRef, metaRef]);
  const [merge] = useState(createMergeClock);
  const reduce = useReducedMotion() ?? false;
  useRightBleed(sectionRef);
  useFitWordmark(sectionRef, markRef);
  useFlickerIn(markRef);

  // The merge runs once, a few seconds in; under reduced motion the page opens on the merged state.
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    merge.set(still ? Number.NEGATIVE_INFINITY : performance.now() + MERGE_DELAY_MS);
  }, [merge]);

  /** The map's Raw / Merged view: raw holds the duplicates apart; merged glides them in (instantly under reduced motion). */
  const showMerged = useCallback(
    (merged: boolean) => merge.set(merged ? performance.now() : Number.POSITIVE_INFINITY),
    [merge],
  );

  const point = useCallback((id: string | null) => {
    highlightRef.current = id;
    globeRef.current?.redraw();
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        aria-labelledby="home-title"
        style={HERO_VARS}
        className="relative isolate -mx-4 -mt-6 overflow-hidden border-b border-border bg-canvas [container-type:inline-size] sm:-mx-6 lg:-mx-8 lg:-mt-7"
      >
        <RequestGlobe
          zoneRef={zoneRef}
          keepOut={keepOut}
          merge={merge}
          highlightRef={highlightRef}
          apiRef={globeRef}
          className="absolute inset-0 -z-10 size-full"
        />

        <div className="relative pb-[calc(var(--mark-h)+1rem)] lg:min-h-[max(36rem,calc(100svh-3.5rem-1px))] lg:pb-0">
          {/* Keeps the copy readable where the globe's land runs behind it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse calc(var(--copy-w) * 0.95) 62% at calc(var(--copy-w) * 0.38) 26%, color-mix(in oklab, var(--canvas) 90%, transparent) 45%, transparent 100%)",
            }}
          />

          <div
            className={cn(
              "relative grid gap-x-(--gap) px-4 pt-6 sm:px-6",
              "[grid-template-areas:'copy'_'zone'_'meta']",
              // The copy row is at least as tall as the copy: the hero grows rather than let it run into the facts.
              "lg:min-h-[inherit] lg:grid-cols-[var(--copy-w)_minmax(0,1fr)] lg:grid-rows-[1fr_auto_var(--mark-h)]",
              // Narrower heroes run the facts across the full width; wide ones set them above the wordmark's
              // right half, like the reference, with the copy running down beside them.
              "lg:[grid-template-areas:'copy_zone'_'meta_meta'_'mark_mark']",
              "lg:@min-[84rem]:[grid-template-areas:'copy_zone'_'copy_meta'_'mark_mark']",
            )}
          >
            <div ref={copyRef} className="relative z-20 min-w-0 self-start [grid-area:copy] lg:pt-[1.2cqw]">
              <p
                data-testid="home-platform-badge"
                className="mb-5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm border border-border-strong bg-canvas/80 px-2.5 py-1 text-[0.8125rem] font-medium text-foreground"
              >
                <span aria-hidden className="size-1.5 rounded-full bg-ok" />
                <span>Connected</span>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span>Microsoft 365</span>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span>
                  SAP Business One <span className="text-muted-foreground">(LIVES_SANDBOX)</span>
                </span>
              </p>
              <h1
                id="home-title"
                className="font-wide text-[clamp(1.75rem,2.45cqw,3.25rem)] leading-[1.08] font-semibold text-balance text-foreground"
              >
                <span className="block lg:whitespace-nowrap">One record for every</span>
                <span className="block lg:whitespace-nowrap">customer, item and vendor.</span>
              </h1>
              <p className="mt-5 max-w-[60ch] text-[0.9375rem] leading-[1.6] text-pretty text-secondary-foreground @min-[75rem]:text-base">
                Request a new customer, vendor, item or cost centre in one form. Tesseract checks it for duplicates and
                missing fields, approvers decide in Teams or Outlook, and the MDM team loads the approved record into
                SAP Business One.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/requests/new"
                  data-testid="home-new-request"
                  className={cn(buttonVariants({ size: "lg" }), "h-10 gap-2 px-4 text-[0.9375rem]")}
                >
                  New request
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link
                  href="/pulse"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-10 bg-canvas/70 px-4 text-[0.9375rem]",
                  )}
                >
                  Regional Pulse
                </Link>
              </div>
            </div>

            {/* The globe fits the five countries into this zone. */}
            <div ref={zoneRef} aria-hidden className="h-80 [grid-area:zone] lg:h-auto lg:min-h-[20rem]" />

            {/* A soft dark scrim behind the facts: the globe runs behind and around them, never across. */}
            <div
              ref={metaRef}
              className="relative z-20 mt-4 [grid-area:meta] before:pointer-events-none before:absolute before:-inset-x-6 before:-inset-y-3 before:-z-10 before:rounded-[2rem] before:bg-canvas/85 before:blur-xl before:content-[''] lg:mt-0 lg:pt-3 lg:pb-[1.2cqw]"
            >
              <HeroMeta merge={merge} reduce={reduce} onShowMerged={showMerged} />
            </div>
          </div>

          {/* The product name across the full width of the hero, sitting on its bottom edge, over the globe. */}
          <p
            ref={markRef}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-[1.2cqw] z-10 w-max translate-y-[0.12em] font-wide text-[length:var(--mark)] leading-none font-medium tracking-[-0.045em] whitespace-nowrap text-foreground/90 select-none"
          >
            {WORDMARK.split("").map((ch, i) => (
              <span key={i} data-letter>
                {ch}
              </span>
            ))}
          </p>
        </div>
      </section>

      <LiveRequestPanel onPoint={point} />
    </>
  );
}
