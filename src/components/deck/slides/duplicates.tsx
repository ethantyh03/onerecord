"use client";

import { useEffect, useState } from "react";
import { animate, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { BUKIT_MERGED, BUKIT_RAW, DEDUP_COUNTS, DOTS, pct, sgdMillions } from "../deck-data";
import { DecodeText } from "../decode-text";
import { Code, Glyph, Headline, SlideFrame, type SlideProps } from "../primitives";

/*
 * s03 and s04 share one table geometry, so T2 (deck content doc §2) can start s04 from exactly what s03 shows:
 * the three Bukit Damai rows slide together and fuse into one row, their SAP codes stack under one name,
 * "Lost / Flat / New" turns into −32%, then 388 record dots become 363 customers.
 * The rows that move fade out before they meet (only the codes travel, so no two names ever overprint), the
 * merged record code flickers in like the T1 wordmark, and slide 3's headline holds until −32% has landed.
 */

const S03_HEADLINE = "In SAP, one hospital can look like three different customers.";
const S04_HEADLINE = "Merge the duplicates, and Malaysia's #2 account is down 32%.";
/** ms after arrival: the merged row has landed, its code flickers in and the headline turns. */
const T_LANDED = 880;
const T_HEADLINE = 1080;

const HEADER_TOP = 330;
const ROW_TOP = 378;
const ROW_H = 116;
const COL = { code: 112, name: 412, entity: 1032, rank: 1202, status: 1422, end: 1808 } as const;
const EASE = [0.65, 0, 0.35, 1] as const;

const CODE_SIZE = 28;
const MERGED_CODE_SIZE = 22;
const MERGED_CODE_PITCH = 178;

function statusOf(r: (typeof BUKIT_RAW)[number]) {
  if (r.status === "lost") return { text: `Lost customer, ${pct(r.yoy ?? 0)}`, tone: "stuck" as const };
  if (r.status === "new") return { text: "New customer", tone: "neutral" as const };
  return { text: `Flat, ${pct(r.yoy ?? 0)}`, tone: "neutral" as const };
}

function TableHeader({ merged }: { merged?: boolean }) {
  const cells: [number, string][] = [
    [COL.code, "SAP code"],
    [COL.name, merged ? "Customer" : "Name as keyed"],
    [COL.entity, "Entity"],
    [COL.rank, "Rank in Malaysia"],
    [COL.status, "Last 12 months"],
  ];
  return (
    <div className="absolute inset-x-[112px] h-[48px] border-b border-border-strong" style={{ top: HEADER_TOP }}>
      {cells.map(([x, t]) => (
        <span key={t} className="absolute bottom-3 text-[20px] leading-none text-subtle" style={{ left: x - 112 }}>
          {t}
        </span>
      ))}
    </div>
  );
}

/** One raw SAP row (without its code, which moves on its own in T2). */
function RawRowCells({ r }: { r: (typeof BUKIT_RAW)[number] }) {
  const s = statusOf(r);
  return (
    <>
      <span className="absolute text-[30px] leading-none text-foreground" style={{ left: COL.name - 112, top: 43 }}>
        {r.name}
      </span>
      <span className="absolute text-[28px] leading-none text-secondary-foreground" style={{ left: COL.entity - 112, top: 44 }}>
        {r.entity}
      </span>
      <span
        className="num absolute font-semibold text-foreground"
        style={{ left: COL.rank - 112, top: 40, fontSize: 34, lineHeight: 1, fontStretch: "112%" }}
      >
        #{r.rank}
      </span>
      <span
        className={cn("absolute flex items-center gap-3 text-[28px] leading-none", s.tone === "stuck" ? "text-stuck" : "text-secondary-foreground")}
        style={{ left: COL.status - 112, top: 44 }}
      >
        <Glyph tone={s.tone === "stuck" ? "stuck" : "neutral"} hollow={r.status === "new"} size={13} />
        {s.text}
      </span>
    </>
  );
}

/**
 * The three Bukit Damai rows. merged=false: s03's raw rows. merged=true: the fused row. With play, the rows
 * start raw and fuse (≈1 s).
 */
function BukitRows({ merged, play }: { merged: boolean; play: boolean }) {
  const [fused, setFused] = useState(merged && !play);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!merged || !play) return;
    const t = window.setTimeout(() => setFused(true), 120);
    const l = window.setTimeout(() => setLanded(true), T_LANDED);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(l);
    };
  }, [merged, play]);
  const motionOn = merged && play;
  const t = (d: number, delay = 0) => (motionOn ? { duration: d, delay, ease: EASE } : { duration: 0 });
  const sortedCodes = [...BUKIT_RAW.map((r) => r.cardCode)].sort();

  return (
    <>
      {/* Raw rows: the two that move fade out on the way up; the first fades just before the merged row appears. */}
      {BUKIT_RAW.map((r, i) => (
        <motion.div
          key={r.cardCode}
          className="absolute inset-x-[112px] border-b border-border"
          style={{ top: ROW_TOP + i * ROW_H, height: ROW_H }}
          initial={false}
          animate={fused ? { y: -i * ROW_H, opacity: 0 } : { y: 0, opacity: 1 }}
          transition={{ y: t(0.8), opacity: i === 0 ? t(0.2, 0.55) : t(0.26, 0.02) }}
        >
          <RawRowCells r={r} />
        </motion.div>
      ))}

      {/* SAP codes: each flies from its row's code cell to its slot under the merged name. */}
      {BUKIT_RAW.map((r, i) => {
        const slot = sortedCodes.indexOf(r.cardCode);
        const from = { x: COL.code, y: ROW_TOP + i * ROW_H + 44 };
        const to = { x: COL.name + slot * MERGED_CODE_PITCH, y: ROW_TOP + 106 };
        return (
          <motion.span
            key={r.cardCode}
            className="absolute top-0 left-0 origin-[0%_0%] leading-none"
            initial={false}
            animate={
              fused
                ? { x: to.x, y: to.y, scale: MERGED_CODE_SIZE / CODE_SIZE }
                : { x: from.x, y: from.y, scale: 1 }
            }
            transition={t(0.85, 0.05 + slot * 0.04)}
          >
            <Code className={cn("transition-colors duration-500", fused ? "text-muted-foreground" : "text-foreground")} style={{ fontSize: CODE_SIZE }}>
              {r.cardCode}
            </Code>
          </motion.span>
        );
      })}

      {/* The fused row */}
      {merged ? (
        <motion.div
          className="absolute inset-x-[112px] border-b border-border-strong"
          style={{ top: ROW_TOP, height: 150 }}
          initial={false}
          animate={{ opacity: fused ? 1 : 0 }}
          transition={t(0.35, 0.74)}
        >
          <Code className="absolute text-foreground" style={{ left: 0, top: 30, fontSize: 28 }}>
            <DecodeText text={BUKIT_MERGED.goldenId} play={motionOn && landed} hidden={motionOn} duration={640} />
          </Code>
          <span
            className="absolute font-semibold text-foreground"
            style={{ left: COL.name - 112, top: 24, fontSize: 34, lineHeight: 1, fontStretch: "112%", letterSpacing: "-0.015em" }}
          >
            {BUKIT_MERGED.name}
          </span>
          <span className="absolute text-[22px] leading-none text-muted-foreground" style={{ left: COL.name - 112, top: 72 }}>
            {BUKIT_MERGED.records} SAP records merged
          </span>
          <span className="absolute text-[28px] leading-none text-secondary-foreground" style={{ left: COL.entity - 112, top: 32 }}>
            {BUKIT_MERGED.entities.join(" + ")}
          </span>
          <span
            className="num absolute font-semibold text-foreground"
            style={{ left: COL.rank - 112, top: 26, fontSize: 44, lineHeight: 1, fontStretch: "112%" }}
          >
            #{BUKIT_MERGED.rank}
          </span>
          <span
            className="num absolute font-semibold text-stuck"
            style={{ left: COL.status - 112, top: 20, fontSize: 64, lineHeight: 1, fontStretch: "112%", letterSpacing: "-0.03em" }}
          >
            {pct(BUKIT_MERGED.yoy)}
          </span>
          <span className="num absolute text-[22px] leading-none text-muted-foreground" style={{ left: COL.status - 112, top: 98 }}>
            {sgdMillions(BUKIT_MERGED.sgdPrior12m)} → {sgdMillions(BUKIT_MERGED.sgd12m)}
          </span>
        </motion.div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- S03

export function S03ThreeRecords({ position }: SlideProps) {
  return (
    <SlideFrame
      position={position}
      label="Raw SAP records, Malaysia, Oct 2025–Sep 2026 vs the 12 months before. Synthetic, illustrative data."
    >
      <Headline>{S03_HEADLINE}</Headline>
      <TableHeader />
      <BukitRows merged={false} play={false} />
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- S04 + the dot field

const COLS = 33; // 363 = 33 × 11: the merged field closes into a clean rectangle
const PITCH = 24;
const DOT = 10;
const FIELD_TOP = 600;

const posOf = (i: number) => ({ x: (i % COLS) * PITCH, y: Math.floor(i / COLS) * PITCH });

type Phase = "hidden" | "raw" | "merged" | "compact";

function DotField({ play, delayMs }: { play: boolean; delayMs: number }) {
  const [phase, setPhase] = useState<Phase>(play ? "hidden" : "compact");
  const [count, setCount] = useState(play ? DEDUP_COUNTS.rawRecords : DEDUP_COUNTS.goldenCustomers);

  useEffect(() => {
    if (!play) return;
    const timers = [
      window.setTimeout(() => setPhase("raw"), delayMs),
      window.setTimeout(() => setPhase("merged"), delayMs + 380),
      window.setTimeout(() => setPhase("compact"), delayMs + 1280),
    ];
    let stop: (() => void) | undefined;
    timers.push(
      window.setTimeout(() => {
        const c = animate(DEDUP_COUNTS.rawRecords, DEDUP_COUNTS.goldenCustomers, {
          duration: 0.9,
          ease: "easeInOut",
          onUpdate: (v) => setCount(Math.round(v)),
        });
        stop = () => c.stop();
      }, delayMs + 380),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      stop?.();
    };
  }, [play, delayMs]);

  const animated = play;
  const done = phase === "compact";

  return (
    <>
      <div
        aria-hidden
        className="absolute left-[112px] transition-opacity duration-300"
        style={{ top: FIELD_TOP, width: COLS * PITCH, height: 12 * PITCH, opacity: phase === "hidden" ? 0 : 1 }}
      >
        {DOTS.map((d) => {
          const dup = d.into !== null;
          const at =
            phase === "compact" ? posOf(d.to) : phase === "merged" && dup ? posOf(d.into!) : posOf(d.from);
          const gone = dup && (phase === "merged" || phase === "compact");
          const lit = !dup && d.absorbs && (phase === "merged" || phase === "compact");
          return (
            <motion.span
              key={d.code}
              className={cn(
                "absolute top-0 left-0 rounded-[1.5px] transition-colors duration-300",
                dup ? "bg-stuck" : d.hero && lit ? "bg-stuck" : lit ? "bg-foreground" : "bg-subtle/55",
              )}
              style={{ width: DOT, height: DOT }}
              initial={false}
              animate={{ x: at.x, y: at.y, opacity: gone ? (phase === "merged" && animated ? [1, 1, 0] : 0) : 1 }}
              transition={
                !animated
                  ? { duration: 0 }
                  : phase === "merged"
                    ? { duration: 0.8, ease: EASE, opacity: { duration: 0.8, times: [0, 0.75, 1] } }
                    : { duration: 0.5, ease: EASE }
              }
            />
          );
        })}
      </div>

      <div
        className="absolute left-[1000px] w-[808px] transition-opacity duration-300"
        style={{ top: FIELD_TOP - 8, opacity: phase === "hidden" ? 0 : 1 }}
      >
        <p className="text-[30px] leading-none text-muted-foreground">
          <span className="num text-foreground">{DEDUP_COUNTS.rawRecords}</span> customer records in SAP
        </p>
        <p className="mt-6 flex items-baseline gap-6">
          <span
            className="num font-semibold text-foreground"
            style={{ fontSize: 168, lineHeight: 0.82, fontStretch: "112%", letterSpacing: "-0.04em" }}
          >
            {count}
          </span>
          <span className={cn("text-[34px] leading-none transition-opacity duration-300", done ? "text-foreground opacity-100" : "opacity-0")}>
            distinct customers
          </span>
        </p>
        <p className="mt-9 flex items-center gap-7 text-[22px] leading-[28px] text-subtle">
          {done ? (
            <>
              <span className="inline-flex items-center gap-2.5">
                <Glyph tone="fg" size={10} /> a customer that had duplicates
              </span>
              <span className="inline-flex items-center gap-2.5">
                <Glyph tone="stuck" size={10} /> {BUKIT_MERGED.name}
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2.5">
              <Glyph tone="stuck" size={10} /> a duplicate record
            </span>
          )}
        </p>
      </div>

      <p
        className="absolute top-[924px] left-[112px] max-w-[1696px] text-[28px] leading-[36px] text-secondary-foreground transition-opacity duration-300"
        style={{ opacity: phase === "hidden" ? 0 : 1 }}
      >
        <span className="num text-foreground">
          {DEDUP_COUNTS.duplicateRecords} of {DEDUP_COUNTS.rawRecords}
        </span>{" "}
        records (<span className="num">{(DEDUP_COUNTS.duplicateRate * 100).toFixed(1)}%</span>) are duplicates. Merging moves no
        country total; it changes who you call.
      </p>
    </>
  );
}

/** On arrival from slide 3, slide 3's headline holds until the merged row has landed, then turns into the punchline. */
function SwapHeadline({ play }: { play: boolean }) {
  const [swapped, setSwapped] = useState(!play);
  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => setSwapped(true), T_HEADLINE);
    return () => window.clearTimeout(t);
  }, [play]);
  const tr = (duration: number, delay = 0) => (play ? { duration, delay } : { duration: 0 });
  return (
    <>
      <motion.div initial={false} animate={{ opacity: swapped ? 0 : 1 }} transition={tr(0.18)} aria-hidden={swapped}>
        <Headline>{S03_HEADLINE}</Headline>
      </motion.div>
      <motion.div initial={false} animate={{ opacity: swapped ? 1 : 0 }} transition={tr(0.3, 0.14)} aria-hidden={!swapped}>
        <Headline>{S04_HEADLINE}</Headline>
      </motion.div>
    </>
  );
}

export function S04Merged({ mode, play, position }: SlideProps) {
  const animated = mode === "live" && play;
  return (
    <SlideFrame position={position} label="Synthetic, illustrative data.">
      <SwapHeadline play={animated} />
      <TableHeader merged />
      <BukitRows merged play={animated} />
      <DotField play={animated} delayMs={1150} />
    </SlideFrame>
  );
}
