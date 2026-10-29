"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DecodeText } from "../decode-text";
import { AMY_SLICES } from "../deck-data";
import { Headline, MetaColumns, SlideFrame, STAGE_W, type SlideProps } from "../primitives";

// ---------------------------------------------------------------- S01 · title

const MARK_INSET = 26;
const MARK_TYPE = { lineHeight: 1, fontStretch: "112%", letterSpacing: "-0.045em" } as const;

const PROBE = 100;

/**
 * Fit the wordmark to the slide's width: measure the word once at a fixed 100 px (a hidden probe with the same
 * type settings) when the font is in, then scale. No feedback on its own size, so it can never oscillate.
 */
function useFitFont(probeRef: React.RefObject<HTMLElement | null>, target: number, initial: number) {
  const [size, setSize] = useState(initial);
  useLayoutEffect(() => {
    let off = false;
    const fit = () => {
      const w = probeRef.current?.offsetWidth;
      if (off || !w) return;
      setSize(Math.round(((PROBE * target) / w) * 10) / 10);
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      off = true;
    };
  }, [probeRef, target]);
  return size;
}

export function S01Title({ mode, step, play, position }: SlideProps) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const size = useFitFont(probeRef, STAGE_W - 2 * MARK_INSET, 330);
  const shown = mode === "static" || step >= 1;
  return (
    <SlideFrame position={position} footerClassName="hidden">
      <Headline size={64} className="max-w-[1180px]">
        Messy master data hides money. OneRecord fixes it at the front door.
      </Headline>

      <MetaColumns
        className="absolute top-[616px] right-[96px] left-[860px]"
        cols={[
          { top: "Team CTFudders", bottom: "SMU DSA 2026 finals" },
          { top: "Lives Group", bottom: "5 countries, one SAP Business One" },
          { top: "Runs on Microsoft 365", bottom: "Lands in SAP Business One" },
          { top: "Synthetic, illustrative data", bottom: "All names fictional" },
        ]}
      />

      <h1 className="sr-only">OneRecord</h1>
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 font-medium whitespace-nowrap"
        style={{ ...MARK_TYPE, fontSize: PROBE }}
      >
        OneRecord
      </span>
      <p
        aria-hidden
        data-bleed
        className="absolute bottom-0 w-max font-medium whitespace-nowrap text-foreground/90 select-none"
        style={{
          ...MARK_TYPE,
          left: MARK_INSET,
          fontSize: size,
          transform: "translateY(0.13em)",
        }}
      >
        <DecodeText text="OneRecord" play={mode === "live" && play && step >= 1} hidden={!shown} />
      </p>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S02 · hook

const SEGMENTS: { days: number; text: string }[] = [
  { days: AMY_SLICES[0].days, text: "waiting for MDM" },
  { days: AMY_SLICES[1].days, text: "bounced: missing QA/RA field" },
  { days: AMY_SLICES[2].days, text: "3 approvers, one at a time" },
  { days: AMY_SLICES[3].days, text: "MDM queue + manual keying" },
];
const TOTAL_DAYS = SEGMENTS.reduce((a, s) => a + s.days, 0); // 18
const ENDS = SEGMENTS.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.days], []); // 2, 7, 16, 18

/** The email trail (the /pitch/hook subject lines), each on the day it was sent. Day 18 is the coral line below. */
const TRAIL: { day: number; subject: string }[] = [
  { day: 1, subject: "New item code request: K2EDTA blood collection tubes" },
  { day: 3, subject: "RE: New item code request: K2EDTA blood collection tubes" },
  { day: 7, subject: "RE: RE: FW: new item code, licence no. missing?" },
  { day: 12, subject: "FW: RE: RE: FW: new item code, still waiting on QA/RA sign-off" },
];

const COUNT_MS = 3400;

export function S02Hook({ mode, play, position }: SlideProps) {
  const animated = mode === "live" && play;
  const [day, setDay] = useState(animated ? 1 : TOTAL_DAYS);
  const [after, setAfter] = useState(!animated);

  useEffect(() => {
    if (!animated) return;
    const c = animate(1, TOTAL_DAYS, {
      duration: COUNT_MS / 1000,
      ease: "linear",
      onUpdate: (v) => setDay(Math.floor(v)),
      onComplete: () => setDay(TOTAL_DAYS),
    });
    const t = window.setTimeout(() => setAfter(true), COUNT_MS + 250);
    return () => {
      c.stop();
      window.clearTimeout(t);
    };
  }, [animated]);

  const done = day >= TOTAL_DAYS;
  const barX = 900;
  const barW = 1808 - barX;
  const cell = barW / TOTAL_DAYS;

  return (
    <SlideFrame
      position={position}
      label="Amy's case: case brief, App C. Day split: our reading of it. S$ figure: synthetic, illustrative data."
    >
      <Headline>
        Amy needed one item code. It took <span className="text-warn">18 days</span>.
      </Headline>

      {/* The day counter */}
      <div className="absolute top-[292px] left-[112px] w-[770px]">
        <p className="text-[26px] leading-none text-muted-foreground">Day</p>
        <p
          className={cn("num mt-1 font-semibold transition-colors duration-300", done ? "text-warn" : "text-foreground")}
          style={{ fontSize: 236, lineHeight: 0.86, fontStretch: "112%", letterSpacing: "-0.04em" }}
          aria-live="off"
        >
          {day}
        </p>
        <ul className="mt-12 space-y-2.5">
          {TRAIL.map((e) => (
            <li
              key={e.subject}
              className={cn(
                "flex gap-4 text-[21px] leading-[28px] text-subtle transition-opacity duration-200",
                day >= e.day ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="num w-[70px] shrink-0 text-subtle">Day {e.day}</span>
              <span className="truncate">{e.subject}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 18 day cells, filling in four segments */}
      <div className="absolute top-[322px]" style={{ left: barX, width: barW }}>
        <div className="relative h-[18px]">
          {Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const seg = ENDS.findIndex((e) => i < e);
            const boundary = ENDS.includes(i + 1) && i + 1 < TOTAL_DAYS;
            return (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "absolute top-0 h-full transition-colors duration-150",
                  i < day ? (seg === 2 ? "bg-warn" : "bg-foreground/75") : "bg-secondary",
                )}
                style={{ left: i * cell, width: cell - (boundary ? 8 : 3) }}
              />
            );
          })}
        </div>
        <ol className="mt-7">
          {SEGMENTS.map((s, i) => (
            <li
              key={s.text}
              className={cn(
                "flex items-baseline gap-6 border-t border-border py-[15px] transition-opacity duration-300",
                day >= ENDS[i] ? "opacity-100" : "opacity-0",
              )}
            >
              <span
                className={cn("num w-[150px] shrink-0 font-semibold", i === 2 ? "text-warn" : "text-foreground")}
                style={{ fontSize: 40, lineHeight: 1, fontStretch: "112%" }}
              >
                {s.days} days
              </span>
              <span className="text-[28px] leading-[34px] text-secondary-foreground">{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <motion.div
        className="absolute top-[792px] left-[112px] w-[1696px]"
        initial={false}
        animate={{ opacity: after ? 1 : 0 }}
        transition={{ duration: 0.35 }}
      >
        <p className="text-stuck" style={{ fontSize: 38, lineHeight: 1.15, fontStretch: "112%", fontWeight: 600, letterSpacing: "-0.015em" }}>
          Day 18: she tries to raise a sales order. The item still isn&apos;t in SAP.
        </p>
        <p className="mt-8 border-t border-border pt-7 text-[30px] leading-[38px] text-secondary-foreground">
          <span className="num font-semibold text-foreground">S$1.34M</span> of customer orders waited on a master-data setup in the
          last 12 months.
        </p>
      </motion.div>
    </SlideFrame>
  );
}
