"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePitchKeys } from "../_lib/use-pitch-keys";

const TOTAL_DAYS = 18;
/** Counter runs 1 → 18 over this long, after a short hold on black. */
const START_DELAY_MS = 500;
const COUNT_MS = 8_000;

/** Our breakdown of App C (illustrative): 2 + 5 + 9 + 2 days. */
const SEGMENTS = [
  { days: 2, label: "Unnoticed in the MDM inbox" },
  { days: 5, label: "Bounced: licence no. missing" },
  { days: 9, label: "Three approvers, one at a time" },
  { days: 2, label: "Keyed into SAP by hand" },
] as const;

/** The email trail, each appearing on the day it was sent. */
const EMAILS: {
  day: number;
  from: string;
  subject: string;
  pos: React.CSSProperties;
  align: "left" | "right";
  opacity: number;
  alarm?: boolean;
}[] = [
  { day: 1, from: "Amy Lim", subject: "New item code request: K2EDTA blood collection tubes", pos: { top: "8%", left: "6%" }, align: "left", opacity: 0.3 },
  { day: 3, from: "MDM Team", subject: "RE: New item code request: K2EDTA blood collection tubes", pos: { top: "15.5%", right: "7%" }, align: "right", opacity: 0.26 },
  { day: 7, from: "Amy Lim", subject: "RE: RE: FW: new item code, licence no. missing?", pos: { top: "23%", left: "15%" }, align: "left", opacity: 0.24 },
  { day: 12, from: "Daniel Ong", subject: "FW: RE: RE: FW: new item code, still waiting on QA/RA sign-off", pos: { top: "79%", right: "9%" }, align: "right", opacity: 0.24 },
  { day: 18, from: "Sales Ops", subject: "RE: Sales order failed: item code not found", pos: { top: "86.5%", left: "24%" }, align: "left", opacity: 0.62, alarm: true },
];

const easeInOut = (p: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, p)))) / 2;

function segmentEnd(index: number): number {
  return SEGMENTS.slice(0, index + 1).reduce((a, s) => a + s.days, 0);
}

function HookFrame() {
  const params = useSearchParams();
  const still = params.get("still") === "1";
  const reduceMotion = useReducedMotion();
  const freeze = still || !!reduceMotion;

  const [run, setRun] = useState(0);
  const [day, setDay] = useState(freeze ? TOTAL_DAYS : 0);

  const replay = useCallback(() => setRun((n) => n + 1), []);
  usePitchKeys(replay);

  useEffect(() => {
    if (freeze) {
      setDay(TOTAL_DAYS);
      return;
    }
    setDay(0);
    let raf = 0;
    const start = performance.now() + START_DELAY_MS;
    const tick = (t: number) => {
      if (t < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = (t - start) / COUNT_MS;
      const d = Math.min(TOTAL_DAYS, 1 + Math.floor(easeInOut(p) * (TOTAL_DAYS - 1) + 1e-6));
      setDay(d);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [freeze, run]);

  const done = day >= TOTAL_DAYS;
  const shown = Math.max(1, day);

  return (
    <div
      className="relative size-full cursor-none select-none overflow-hidden bg-black text-white"
      data-testid="pitch-hook"
      data-done={done ? "true" : "false"}
    >
      {/* Faded email trail */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {EMAILS.map((e) => {
          const visible = day >= e.day;
          return (
            <motion.div
              key={e.subject}
              className={cn(
                "absolute flex max-w-[42vw] items-baseline gap-[0.6em] text-[clamp(14px,1.2vw,24px)] leading-snug",
                e.align === "right" && "flex-row-reverse text-right",
              )}
              style={e.pos}
              initial={false}
              animate={{ opacity: visible ? e.opacity : 0, y: visible ? 0 : 6 }}
              transition={{ duration: freeze ? 0 : 0.9, ease: "easeOut" }}
            >
              <Mail className="size-[1em] shrink-0 translate-y-[0.12em]" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className={cn("mr-[0.5em] font-semibold", e.alarm ? "text-stuck" : "text-white")}>{e.from}</span>
                <span className={e.alarm ? "text-stuck" : "text-white/90"}>{e.subject}</span>
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Counter */}
      <div className="absolute inset-x-0 top-[31%] flex flex-col items-center px-[6vw]">
        <motion.h1
          className="text-[clamp(7rem,17vw,21rem)] leading-[0.86] font-semibold tracking-[-0.05em] tabular-nums"
          initial={false}
          animate={{ opacity: day > 0 ? 1 : 0 }}
          transition={{ duration: freeze ? 0 : 0.5 }}
          aria-label="18 days."
          data-testid="pitch-hook-counter"
        >
          {shown} {shown === 1 ? "day" : "days"}.
        </motion.h1>

        {/* Day strip: one cell per calendar day, grouped by our illustrative breakdown */}
        <motion.div
          className="mt-[4.5vh] w-[min(1180px,78vw)]"
          initial={false}
          animate={{ opacity: day > 0 ? 1 : 0 }}
          transition={{ duration: freeze ? 0 : 0.6, delay: freeze ? 0 : 0.2 }}
        >
          <div className="flex gap-[1.4vw]">
            {SEGMENTS.map((seg, i) => {
              const first = segmentEnd(i) - seg.days + 1;
              const complete = day >= segmentEnd(i);
              return (
                <div key={seg.label} className="min-w-0" style={{ flexGrow: seg.days, flexBasis: 0 }}>
                  <div className="flex gap-[0.35vw]">
                    {Array.from({ length: seg.days }, (_, k) => {
                      const d = first + k;
                      return (
                        <span
                          key={d}
                          className="h-[clamp(8px,0.75vw,14px)] flex-1 rounded-[2px] transition-colors duration-300"
                          style={{ background: day >= d ? "rgb(255 255 255 / 0.88)" : "rgb(255 255 255 / 0.1)" }}
                        />
                      );
                    })}
                  </div>
                  <motion.div
                    className="mt-[1.4vh] text-[clamp(13px,1.05vw,20px)] leading-tight text-white/70"
                    initial={false}
                    animate={{ opacity: complete ? 1 : 0 }}
                    transition={{ duration: freeze ? 0 : 0.5 }}
                  >
                    <span className="font-semibold text-white tabular-nums">{seg.days} days</span>
                    <span className="block">{seg.label}</span>
                  </motion.div>
                </div>
              );
            })}
          </div>
          <motion.p
            className="mt-[2.2vh] text-[clamp(12px,0.85vw,16px)] text-white/45"
            initial={false}
            animate={{ opacity: done ? 1 : 0 }}
            transition={{ duration: freeze ? 0 : 0.6, delay: freeze ? 0 : 0.4 }}
          >
            Our breakdown of App C (illustrative)
          </motion.p>
        </motion.div>
      </div>

      <p className="absolute bottom-[3.5vh] left-[6vw] text-[clamp(13px,0.95vw,18px)] text-white/55">
        Scenario from case brief, Appendix C
      </p>
    </div>
  );
}

export default function PitchHookPage() {
  return (
    <Suspense fallback={<div className="size-full bg-black" />}>
      <HookFrame />
    </Suspense>
  );
}
