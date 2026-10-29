"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { AMY_SLICES, CASE_ROWS, GROUP, HOURS_PER_YEAR, PROCESS_SHARE, grouped, pct, sgdMillions } from "../deck-data";
import { Glyph, Headline, ReadoutRow, SlideFrame, type SlideProps } from "../primitives";

const EASE = [0.65, 0, 0.35, 1] as const;

// ---------------------------------------------------------------- S09 · regional view

/** Each meaning line stays under ten words: the detail is in the speaker notes and appendix A6. */
const REGIONAL: { label: string; figure: ReactNode; sub?: ReactNode; meaning: ReactNode }[] = [
  {
    label: "Growth",
    figure: (
      <>
        {sgdMillions(GROUP.sgd12m, 1)}, {pct(GROUP.yoy, 1)}
      </>
    ),
    sub: <>{pct(GROUP.momentum, 1)} Jul–Sep</>,
    meaning: "Same 12 months a year apart, de-duplicated customers",
  },
  {
    label: "Forecast",
    figure: <>11 → 9 per 100</>,
    meaning: "Units off per 100 ordered · wins 7 of 10 cells",
  },
  {
    label: "Stuck demand",
    figure: (
      <>
        <span className="text-stuck">S$345,800</span> <span className="text-subtle">→</span> S$309,800
      </>
    ),
    meaning: (
      <>
        Orders waiting on a setup · <span className="num text-ok">−S$36,000</span> you just watched
      </>
    ),
  },
  {
    label: "Action",
    figure: <>S$620k addressable</>,
    sub: "before conversion",
    meaning: "Owner: BU Head, SPD Malaysia · one plan across SPD + QTS",
  },
];

export function S09Regional({ position }: SlideProps) {
  return (
    <SlideFrame
      position={position}
      label="Synthetic, illustrative data · Growth = PO value (Oct 2025–Sep 2026) ÷ PO value (Oct 2024–Sep 2025) − 1 · Forecast: Products A + B, on 6 months the model never saw."
    >
      <Headline size={60}>Once customers are merged, Pulse tells Malaysia to call Bukit Damai by 13 Nov.</Headline>
      <div className="absolute top-[300px] left-[112px] w-[1696px] border-t border-border-strong">
        {REGIONAL.map((r) => (
          <div key={r.label} className="grid min-h-[150px] grid-cols-[230px_760px_1fr] items-start gap-x-[40px] border-b border-border py-[30px]">
            <span className="pt-[12px] text-[26px] leading-none text-muted-foreground">{r.label}</span>
            <span>
              <span
                className="num block font-semibold text-foreground"
                style={{ fontSize: 54, lineHeight: 1.05, fontStretch: "112%", letterSpacing: "-0.025em" }}
              >
                {r.figure}
              </span>
              {r.sub ? <span className="num mt-2 block text-[24px] leading-none text-muted-foreground">{r.sub}</span> : null}
            </span>
            <span className="pt-[8px] text-[27px] leading-[35px] text-secondary-foreground">{r.meaning}</span>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S10 · impact (T5)

/*
 * T5, a two-step build so "before" registers before it shrinks:
 *   step 0 (arrival from s09): today's 14 days draw left to right in the proportions of Amy's 18 days (slide 2):
 *     waiting and a bounce, three approvers one after another (amber), then the MDM queue. The total bar fills
 *     amber to 14 days. ≈1.5 s, then it HOLDS.
 *   step 1 (next key): the approvers slide on top of each other (parallel, 2-business-day clock), the wait and
 *     bounce collapse, the total bar shrinks to ≤ 4 business days and turns green, and a dashed amber outline of
 *     the 14 days stays behind it, so the static end state (and the PDF) still shows the shrink.
 * Lanes are schematic: the only figures are the 14-day median (A26), the 2-business-day clock and ≤ 4 business days.
 */
const LABEL_X = 112;
const BX = 440; // bars start here
const BW = 1808 - BX;
const DAY = BW / 14;
const BDAY = (DAY * 6) / 4; // ≤ 4 business days ≈ 6 calendar days (impact.json soft.requestDaysReturnedPerMonth)
const ROW_TOP = 288;
const ROW_GAP = 60;
const BAR_H = 16;
const TOTAL_Y = ROW_TOP + ROW_GAP * 5 + 20;
const TOTAL_H = 52;
const TICK_Y = TOTAL_Y + TOTAL_H + 14;

/** Amy's 18 days (2 notice + 5 bounce, 9 approvals, 2 MDM), scaled to the 14-day median. */
const SCALE = 14 / AMY_SLICES.reduce((a, s) => a + s.days, 0);
const WAIT_D = (AMY_SLICES[0].days + AMY_SLICES[1].days) * SCALE;
const APPROVER_D = (AMY_SLICES[2].days * SCALE) / 3;
const MDM_D = AMY_SLICES[3].days * SCALE;

type Lane = {
  label: string;
  afterLabel?: string;
  before: { x: number; w: number };
  after: { x: number; w: number };
  tone: "wait" | "approver" | "mdm";
};
const GAP = 5;
const LANES: Lane[] = [
  { label: "Waits, then bounces", before: { x: 0, w: WAIT_D * DAY - GAP }, after: { x: 0, w: 0 }, tone: "wait" },
  ...["QA/RA", "BU head", "Business support"].map((label, i) => ({
    label,
    before: { x: (WAIT_D + i * APPROVER_D) * DAY, w: APPROVER_D * DAY - GAP },
    after: { x: 0, w: 2 * BDAY - GAP },
    tone: "approver" as const,
  })),
  {
    label: "MDM queue + keying",
    afterLabel: "MDM check + import file",
    before: { x: (14 - MDM_D) * DAY, w: MDM_D * DAY },
    after: { x: 2 * BDAY, w: 2 * BDAY },
    tone: "mdm",
  },
];
const DRAW_S = 1.4;

export function S10Impact({ mode, play, step, position }: SlideProps) {
  const animated = mode === "live" && play;
  const beforeStep = step === 0;
  /** Step 0: the bars have drawn. */
  const [drawn, setDrawn] = useState(!(animated && beforeStep));
  /** Step 1: the after state. */
  const [after, setAfter] = useState(!beforeStep && !animated);
  useEffect(() => {
    if (!animated) return;
    const id = window.setTimeout(() => (beforeStep ? setDrawn(true) : setAfter(true)), beforeStep ? 60 : 90);
    return () => window.clearTimeout(id);
  }, [animated, beforeStep]);

  const tr = (duration: number, delay = 0, ease: typeof EASE | "linear" = EASE) =>
    animated ? { duration, delay, ease } : { duration: 0 };
  /** Step 0 draws each bar in time order, linear, like a clock running. */
  const drawTr = (x: number, w: number) => tr(((w + GAP) / BW) * DRAW_S, 0.1 + (x / BW) * DRAW_S, "linear");

  return (
    <SlideFrame
      position={position}
      label="Median 14 days: assumption A26. Lanes are schematic, in the proportions of Amy's 18 days (slide 2). Hours at 80 requests a month; from labelled assumptions (A12–A26)."
    >
      <Headline size={60}>Median setup time drops from 14 days to 4 business days or less.</Headline>

      <div aria-hidden className="absolute inset-0">
        {/* lanes */}
        {LANES.map((l, i) => {
          const y = ROW_TOP + i * ROW_GAP;
          const g = after ? l.after : l.before;
          const w = drawn ? g.w : 0;
          const color =
            l.tone === "approver" ? (after ? "bg-foreground/75" : "bg-warn") : l.tone === "mdm" ? (after ? "bg-foreground/45" : "bg-foreground/60") : "bg-foreground/60";
          return (
            <div key={l.label}>
              <span
                className={cn(
                  "absolute text-[24px] leading-none whitespace-nowrap transition-colors duration-500",
                  after && l.tone === "wait" ? "text-subtle line-through decoration-2" : "text-secondary-foreground",
                )}
                style={{ left: LABEL_X, top: y + 10 }}
              >
                {l.afterLabel ? (
                  <span className="relative inline-block">
                    <motion.span
                      className="block"
                      initial={false}
                      animate={{ opacity: after ? 0 : 1 }}
                      transition={tr(0.3, 0.5)}
                    >
                      {l.label}
                    </motion.span>
                    <motion.span
                      className="absolute top-0 left-0 block"
                      initial={false}
                      animate={{ opacity: after ? 1 : 0 }}
                      transition={tr(0.3, 0.75)}
                    >
                      {l.afterLabel}
                    </motion.span>
                  </span>
                ) : (
                  l.label
                )}
              </span>
              <motion.span
                className={cn("absolute block rounded-[1px] transition-colors duration-700", color)}
                style={{ left: BX, top: y + 14, height: BAR_H }}
                initial={false}
                animate={{ x: g.x, width: w }}
                transition={beforeStep ? drawTr(l.before.x, l.before.w) : tr(0.9, l.tone === "mdm" ? 0.25 : 0.06 * i)}
              />
            </div>
          );
        })}

        {/* the total: today's 14 days, kept as a dashed amber outline once the bar has shrunk */}
        <span className="absolute text-[28px] leading-none font-semibold text-foreground" style={{ left: LABEL_X, top: TOTAL_Y + 12 }}>
          Median setup time
        </span>
        <motion.span
          className="absolute block rounded-[2px] border-2 border-dashed border-warn/80"
          style={{ left: BX, top: TOTAL_Y, width: 14 * DAY, height: TOTAL_H }}
          initial={false}
          animate={{ opacity: drawn ? 1 : 0 }}
          transition={tr(0.2, beforeStep ? DRAW_S + 0.1 : 0)}
        />
        <motion.span
          className={cn("absolute block rounded-[2px] transition-colors duration-700", after ? "bg-ok" : "bg-warn")}
          style={{ left: BX, top: TOTAL_Y, height: TOTAL_H, transitionDelay: animated && !beforeStep ? "300ms" : undefined }}
          initial={false}
          animate={{ width: drawn ? (after ? 4 * BDAY : 14 * DAY) : 0 }}
          transition={beforeStep ? tr(DRAW_S, 0.1, "linear") : tr(0.95, 0.3)}
        />
        <motion.span
          className={cn(
            "absolute text-[28px] leading-none font-semibold whitespace-nowrap transition-colors duration-300",
            after ? "text-warn" : "text-background",
          )}
          style={{
            right: 1920 - (BX + 14 * DAY) + 20,
            top: TOTAL_Y + (TOTAL_H - 28) / 2 + 1,
            // turns amber once the shrinking bar has uncovered it
            transitionDelay: animated && !beforeStep ? "520ms" : undefined,
          }}
          initial={false}
          animate={{ opacity: drawn ? 1 : 0 }}
          transition={tr(0.25, beforeStep ? DRAW_S + 0.1 : 0)}
        >
          14 days today
        </motion.span>
        <motion.span
          className="absolute font-semibold whitespace-nowrap text-ok"
          style={{
            left: BX + 4 * BDAY + 26,
            top: TOTAL_Y + (TOTAL_H - 44) / 2 + 2,
            fontSize: 44,
            lineHeight: 1,
            fontStretch: "112%",
            letterSpacing: "-0.02em",
          }}
          initial={false}
          animate={{ opacity: after ? 1 : 0 }}
          transition={tr(0.35, 1.2)}
        >
          ≤ 4 business days
        </motion.span>

        {/* axis labels: calendar days before, business days after */}
        {Array.from({ length: 14 }, (_, d) => (
          <motion.span
            key={`c${d}`}
            className="num absolute text-[20px] leading-none text-subtle"
            style={{ left: BX + (d + 1) * DAY - 7, top: TICK_Y }}
            initial={false}
            animate={{ opacity: after ? 0 : 1 }}
            transition={tr(0.3, 0.25)}
          >
            {d + 1}
          </motion.span>
        ))}
        {Array.from({ length: 4 }, (_, d) => (
          <motion.span
            key={`b${d}`}
            className="num absolute text-[20px] leading-none text-foreground"
            style={{ left: BX + (d + 1) * BDAY - 7, top: TICK_Y }}
            initial={false}
            animate={{ opacity: after ? 1 : 0 }}
            transition={tr(0.3, 1.0 + d * 0.08)}
          >
            {d + 1}
          </motion.span>
        ))}
        <motion.span
          className="absolute text-[20px] leading-none text-subtle"
          style={{ left: BX, top: TICK_Y + 32 }}
          initial={false}
          animate={{ opacity: after ? 0 : 1 }}
          transition={tr(0.25, 0.2)}
        >
          calendar days, one approver after another
        </motion.span>
        <motion.span
          className="absolute text-[20px] leading-none text-subtle"
          style={{ left: BX, top: TICK_Y + 32 }}
          initial={false}
          animate={{ opacity: after ? 1 : 0 }}
          transition={tr(0.3, 1.1)}
        >
          business days, approvers in parallel on a 2-business-day clock
        </motion.span>
      </div>

      <motion.div
        className="absolute left-[112px] w-[1696px]"
        style={{ top: 800 }}
        initial={false}
        animate={{ opacity: after ? 1 : 0 }}
        transition={tr(0.4, 1.6)}
      >
        <ReadoutRow
          className="border-t border-border pt-7"
          cells={[
            {
              value: <>≈{grouped(Math.round(HOURS_PER_YEAR / 50) * 50)} hours a year back</>,
              caption: (
                <>
                  <span className="num">{grouped(HOURS_PER_YEAR)}</span> h, ≈0.94 FTE: capacity, not headcount
                </>
              ),
            },
            {
              value: <>≈{Math.round(PROCESS_SHARE * 100)}% of the time saved is a process change</>,
              caption: "Approving in parallel needs no new software",
              flex: 1.3,
            },
          ]}
        />
      </motion.div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S11 · business case

export function S11BusinessCase({ mode, play, position }: SlideProps) {
  const animated = mode === "live" && play;
  const [all, setAll] = useState(!animated);
  useEffect(() => {
    if (!animated) return;
    const t = window.setTimeout(() => setAll(true), 900);
    return () => window.clearTimeout(t);
  }, [animated]);

  const cols = "grid grid-cols-[360px_1fr_1fr_1fr_1fr] gap-x-[32px]";
  return (
    <SlideFrame
      position={position}
      label="Hard hours only, at S$50/h. Approver time, grants and stuck-demand revenue are not counted. From labelled assumptions (A12–A26)."
    >
      <Headline size={60}>Phase 1 costs S$39.9k with no new licences, and pays back in about six months.</Headline>
      <div className="absolute top-[300px] left-[112px] w-[1696px]">
        <div className={cn(cols, "border-b border-border-strong px-6 pb-3 text-[20px] leading-none text-subtle")}>
          <span>Requests a month</span>
          <span className="text-right">Hours back a year</span>
          <span className="text-right">Net benefit a year</span>
          <span className="text-right">Payback</span>
          <span className="text-right">3-year net</span>
        </div>
        {CASE_ROWS.map((r) => (
          <motion.div
            key={r.requests}
            className={cn(
              cols,
              "num items-baseline border-b border-border px-6 py-[27px] text-[36px] leading-none",
              r.base ? "bg-secondary font-semibold text-foreground" : "text-secondary-foreground",
            )}
            initial={false}
            animate={{ opacity: r.base || all ? 1 : 0 }}
            transition={animated ? { duration: 0.35 } : { duration: 0 }}
          >
            <span>
              {r.requests}
              {r.base ? <span className="ml-3 text-[26px] font-normal text-muted-foreground">(base)</span> : null}
            </span>
            <span className="text-right">{r.hours}</span>
            <span className="text-right">{r.net}</span>
            <span className="text-right">{r.payback}</span>
            <span className="text-right">{r.threeYear}</span>
          </motion.div>
        ))}
      </div>

      <div className="absolute top-[694px] left-[112px] grid w-[1696px] grid-cols-[1fr_1fr]">
        <div className="pr-10">
          <p className="font-semibold text-foreground" style={{ fontSize: 32, lineHeight: 1.15, fontStretch: "112%" }}>
            Phase 1: S$39.9k one-off + S$6.0k a year to run
          </p>
          <p className="mt-4 text-[25px] leading-[34px] text-secondary-foreground">
            Lean team of 2 for 6 weeks, a 15-day contractor, MDM set-up, 30-minute onboarding. Cash ≈ S$9,750 (the
            contractor); the rest is internal time. No new licences for the workflow.
          </p>
        </div>
        <div className="border-l border-border-strong pl-10">
          <p className="flex items-center gap-3 font-semibold text-phase2-ink" style={{ fontSize: 32, lineHeight: 1.15, fontStretch: "112%" }}>
            <Glyph tone="phase2" hollow size={14} /> Phase 2, only after the pilot
          </p>
          <p className="mt-4 text-[25px] leading-[34px] text-secondary-foreground">
            S$22.5k + ≤ S$2.6k a year in licences. Automatic posting saves only the import step: about a 19-year payback
            on hours, so it is a speed decision.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
