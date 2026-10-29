"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AMY_EMAIL } from "@/lib/extract-cache";
import { cn } from "@/lib/utils";
import { Glyph, Headline, ReadoutRow, SlideFrame, STAGE_W, type SlideProps } from "../primitives";

/*
 * T3 (deck content doc §2), a two-step build so the proof can be read:
 *   step 0 (arrival from s06): Amy's messy email turns into the filled form. Phrases lift out of the email and land
 *     in labelled fields, the bank account number is struck out, "Regulatory licence no." shows Needed. ≈2 s, then it
 *     HOLDS while the speaker points at Needed and the struck-out number.
 *   step 1 (next key): the form shrinks into step 1 of the flow and the other five steps draw left to right. ≈1.5 s.
 * Static / jumped-to: step 0 shows the held form, step 1 (and print) the finished flow.
 */

const EASE = [0.65, 0, 0.35, 1] as const;

const FIELDS: { label: string; value: ReactNode; phrase?: string }[] = [
  { label: "Item description", value: "K2EDTA Blood Collection Tube 4 mL, 100/pk", phrase: "K2EDTA Blood Collection Tube 4 mL, 100/pk" },
  { label: "Manufacturer", value: "Meditube Korea Co., Ltd.", phrase: "Meditube Korea Co., Ltd." },
  { label: "Category", value: "Lab consumable – IVD medical device", phrase: "lab consumable" },
  { label: "Unit", value: "PACK", phrase: "PACK" },
  { label: "Entity", value: "SPD", phrase: "SPD" },
  { label: "Countries", value: "SG, MY", phrase: "SG + MY" },
];
const BANK = "123-456789-001";

type Part = { text: string; src?: number; bank?: boolean };

/** Split Amy's email (verbatim) around the phrases that move, in the order they appear. */
function segment(email: string): Part[] {
  const out: Part[] = [];
  let pos = 0;
  const marks: { text: string; src?: number; bank?: boolean }[] = [
    ...FIELDS.map((f, i) => ({ text: f.phrase!, src: i })),
    { text: BANK, bank: true },
  ];
  for (const m of marks) {
    const i = email.indexOf(m.text, pos);
    if (i < 0) continue;
    if (i > pos) out.push({ text: email.slice(pos, i) });
    out.push(m);
    pos = i + m.text.length;
  }
  out.push({ text: email.slice(pos) });
  return out;
}
const PARTS = segment(AMY_EMAIL);

// Timeline (ms). Step 0 runs 0 → T_HOLD and stops; step 1 starts at T_HOLD and runs to T_DONE.
const T_LIFT = 250;
const FLY_MS = 620;
const FLY_GAP = 170;
const landAt = (i: number) => T_LIFT + i * FLY_GAP + FLY_MS;
const T_BANK = 1150;
const T_NEEDED = landAt(FIELDS.length - 1) + 120;
const T_HOLD = T_NEEDED;
const T_SHRINK = T_HOLD + 1;
const T_DRAW = T_SHRINK + 550;
const DRAW_MS = 1000;
const T_DONE = T_DRAW + DRAW_MS + 150;
/** Step 1: when each mark fires, in ms after the key press. */
const STEP1_AT: [number, number][] = [
  [T_SHRINK, 90],
  [T_DRAW, 90 + (T_DRAW - T_SHRINK)],
  [T_DONE, 90 + (T_DONE - T_SHRINK)],
];

// ---------------------------------------------------------------- the flow (end state)

const NODES: { title: string; tool: string; who: string[] }[] = [
  { title: "Request form", tool: "Power Apps", who: ["MDM team configures the fields"] },
  { title: "Completeness + duplicate check", tool: "before any approver sees it", who: ["lean team", "matcher by a contractor"] },
  { title: "Approvals in parallel", tool: "Teams cards, two-business-day clock, reminders", who: ["lean team builds", "MDM edits routes"] },
  { title: "MDM final check", tool: "SharePoint list with an audit trail", who: ["lean team"] },
  { title: "SAP B1 import file", tool: "Data Transfer Workbench · S$0", who: ["MDM loads it daily"] },
  { title: "Regional Pulse", tool: "growth, forecast and stuck orders on de-duplicated customers", who: ["lean team analyst"] },
];
const BRANCHES: Record<number, string> = {
  0: "in-tenant AI for paste-to-fill",
  4: "automatic posting through SAP's Service Layer",
};

const FLOW_X = 112;
const FLOW_W = 1696;
const NODE_PITCH = FLOW_W / NODES.length;
const NODE_TOP = 296;
/** Every step number on one line, every title on the next, titles get a fixed two-line box. */
const TITLE_TOP = 32;
const TITLE_SIZE = 27;
const TITLE_H = Math.ceil(TITLE_SIZE * 1.1 * 2);
const LINE_Y = NODE_TOP + TITLE_TOP + TITLE_H + 40;
const NODE_TEXT_W = NODE_PITCH - 44;

function Flow({ drawn, nodeOne, animated }: { drawn: boolean; nodeOne: boolean; animated: boolean }) {
  const tr = (delay: number, duration = 0.35) => (animated ? { delay, duration, ease: EASE } : { duration: 0 });
  const rel = LINE_Y - NODE_TOP;
  return (
    <>
      {/* The path of a request: the one signal-teal element on the slide */}
      <motion.div
        aria-hidden
        className="absolute h-[2px] origin-left bg-signal"
        style={{ left: FLOW_X, top: LINE_Y - 1, width: NODE_PITCH * (NODES.length - 1) + 8 }}
        initial={false}
        animate={{ scaleX: drawn ? 1 : 0 }}
        transition={animated ? { duration: DRAW_MS / 1000, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
      />
      <ol>
        {NODES.map((n, i) => {
          const x = FLOW_X + i * NODE_PITCH;
          const delay = (i / (NODES.length - 1)) * (DRAW_MS / 1000) * 0.92;
          const visible = drawn || (i === 0 && nodeOne);
          return (
            <motion.li
              key={n.title}
              className="absolute"
              style={{ left: x, top: NODE_TOP, width: NODE_PITCH }}
              initial={false}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={i === 0 ? tr(0.3, 0.3) : tr(delay, 0.3)}
            >
              <span className="num absolute left-[28px] text-[20px] leading-none text-subtle" style={{ top: 0 }}>
                {i + 1}
              </span>
              <h3
                className="absolute left-[28px] font-semibold text-foreground"
                style={{
                  top: TITLE_TOP,
                  width: NODE_TEXT_W,
                  height: TITLE_H,
                  fontSize: TITLE_SIZE,
                  lineHeight: 1.1,
                  letterSpacing: "-0.012em",
                  fontStretch: "106%",
                }}
              >
                {n.title}
              </h3>
              <span aria-hidden className="absolute size-[16px] rounded-[2px] bg-signal" style={{ left: 0, top: rel - 8 }} />
              <p className="absolute left-[28px] text-[22px] leading-[28px] text-secondary-foreground" style={{ top: rel + 30, width: NODE_TEXT_W }}>
                {n.tool}
              </p>
              <ul className="absolute left-[28px] space-y-1 text-[20px] leading-[26px] text-muted-foreground" style={{ top: rel + 128, width: NODE_TEXT_W }}>
                {n.who.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              {BRANCHES[i] ? (
                <>
                  <motion.span
                    aria-hidden
                    className="absolute w-0 origin-top border-l-2 border-dashed border-phase2"
                    style={{ left: 7, top: rel + 10, height: 238 }}
                    initial={false}
                    animate={{ scaleY: drawn ? 1 : 0 }}
                    transition={tr(DRAW_MS / 1000 - 0.05, 0.4)}
                  />
                  <motion.p
                    className="absolute left-[28px] text-[21px] leading-[27px] text-phase2-ink"
                    style={{ top: rel + 222, width: i === 0 ? NODE_TEXT_W + 120 : NODE_TEXT_W + 60 }}
                    initial={false}
                    animate={{ opacity: drawn ? 1 : 0 }}
                    transition={tr(DRAW_MS / 1000 + 0.2, 0.3)}
                  >
                    <span className="font-semibold">Phase 2</span> · {BRANCHES[i]}
                  </motion.p>
                </>
              ) : null}
            </motion.li>
          );
        })}
      </ol>

      <motion.div
        className="absolute left-[112px] w-[1696px]"
        style={{ top: 812 }}
        initial={false}
        animate={{ opacity: drawn ? 1 : 0 }}
        transition={tr(DRAW_MS / 1000 + 0.3, 0.4)}
      >
        <ReadoutRow
          className="border-t border-border pt-7"
          cells={[{ value: "No new licences in phase 1" }, { value: "Lean team of 2 · 6 weeks" }, { value: "≈15 days of outside help" }]}
        />
      </motion.div>
    </>
  );
}

// ---------------------------------------------------------------- the morph (start state)

type Flight = { from: { x: number; y: number }; to: { x: number; y: number } };

const EMAIL = { x: 112, w: 760 };
const FORM = { x: 944, y: 296, w: 864 };

export function S07OnePicture({ mode, play, step, position }: SlideProps) {
  const animated = mode === "live" && play;
  const formStep = step === 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(() => (formStep ? (animated ? 0 : T_HOLD) : animated ? T_HOLD : T_DONE));
  const [flights, setFlights] = useState<(Flight | null)[]>([]);
  const flying = animated && formStep;

  // Measure where each phrase sits in the email and where its field value sits, in design px.
  useLayoutEffect(() => {
    if (!flying) return;
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const k = box.width / STAGE_W || 1;
      const at = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: (r.left - box.left) / k, y: (r.top - box.top) / k };
      };
      setFlights(
        FIELDS.map((_, i) => {
          const from = at(root.querySelector(`[data-src="${i}"]`));
          const to = at(root.querySelector(`[data-dst="${i}"]`));
          return from && to ? { from, to } : null;
        }),
      );
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, [flying]);

  // One clock drives every mark of the build.
  useEffect(() => {
    if (!animated) return;
    const marks: [number, number][] = formStep
      ? [T_LIFT, ...FIELDS.map((_, i) => landAt(i)), T_BANK, T_NEEDED].map((m) => [m, m])
      : STEP1_AT;
    const timers = marks.map(([m, at]) => window.setTimeout(() => setT(m), at));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [animated, formStep]);

  const shrinking = t >= T_SHRINK;
  const showMorph = formStep || (animated && t < T_DONE);
  const tr = (duration: number, delay = 0) => (animated ? { duration, delay, ease: EASE } : { duration: 0 });

  return (
    <SlideFrame position={position}>
      <div ref={rootRef} className="absolute inset-0">
        <Headline size={58}>
          OneRecord is one front door on Microsoft 365, and every approved record lands in SAP Business One.
        </Headline>

        {showMorph ? (
          <>
            {/* Amy's email, as she sent it */}
            <motion.div
              className="absolute"
              style={{ top: FORM.y, left: EMAIL.x, width: EMAIL.w }}
              initial={false}
              animate={shrinking ? { opacity: 0, x: -40 } : { opacity: 1, x: 0 }}
              transition={tr(0.45)}
              aria-hidden={shrinking}
            >
              <dl className="grid grid-cols-[110px_1fr] border-b border-border text-[22px] leading-[30px]">
                <dt className="border-t border-border py-2 text-subtle">From</dt>
                <dd className="border-t border-border py-2 text-secondary-foreground">Amy Lim</dd>
                <dt className="border-t border-border py-2 text-subtle">To</dt>
                <dd className="border-t border-border py-2 text-secondary-foreground">MDM team mailbox</dd>
                <dt className="border-t border-border py-2 text-subtle">Subject</dt>
                <dd className="border-t border-border py-2 text-secondary-foreground">
                  New item code request: K2EDTA blood collection tubes
                </dd>
              </dl>
              <p className="mt-6 text-[25px] leading-[37px] text-secondary-foreground">
                {PARTS.map((p, i) =>
                  p.src !== undefined ? (
                    <span
                      key={i}
                      data-src={p.src}
                      className={cn("transition-[opacity,background-color] duration-300", t >= T_LIFT ? "bg-secondary text-foreground" : "")}
                      style={{ opacity: t >= landAt(p.src) - FLY_MS + 40 ? 0.35 : 1 }}
                    >
                      {p.text}
                    </span>
                  ) : p.bank ? (
                    <span
                      key={i}
                      className={cn(
                        "decoration-stuck decoration-[3px] transition-colors duration-300",
                        t >= T_BANK ? "text-subtle line-through" : "",
                      )}
                    >
                      {p.text}
                    </span>
                  ) : (
                    <Fragment key={i}>{p.text}</Fragment>
                  ),
                )}
              </p>
            </motion.div>

            {/* The form it becomes; on the next key it shrinks into step 1 of the flow */}
            <motion.div
              className="absolute origin-top-left"
              style={{ left: FORM.x, top: FORM.y, width: FORM.w }}
              initial={false}
              animate={
                shrinking
                  ? { x: FLOW_X + 28 - FORM.x, y: TITLE_TOP, scale: NODE_TEXT_W / FORM.w, opacity: 0 }
                  : { x: 0, y: 0, scale: 1, opacity: 1 }
              }
              transition={animated ? { duration: 0.55, ease: EASE, opacity: { duration: 0.25, delay: 0.32 } } : { duration: 0 }}
            >
              <div className="flex items-baseline justify-between border-b border-border-strong pb-4">
                <span className="font-semibold text-foreground" style={{ fontSize: 32, fontStretch: "112%", letterSpacing: "-0.015em" }}>
                  New item request
                </span>
                <span className="text-[22px] text-subtle">Filled from Amy&apos;s email</span>
              </div>
              <dl className="grid grid-cols-[300px_1fr] text-[28px] leading-[34px]">
                {FIELDS.map((f, i) => (
                  <Fragment key={f.label}>
                    <dt className="border-b border-border py-[11px] text-muted-foreground">{f.label}</dt>
                    <dd className="min-h-[57px] border-b border-border py-[11px]">
                      <span
                        data-dst={i}
                        className="text-foreground transition-opacity duration-200"
                        style={{ opacity: t >= landAt(i) ? 1 : 0 }}
                      >
                        {f.value}
                      </span>
                    </dd>
                  </Fragment>
                ))}
                <dt className="border-b border-border py-[11px] text-muted-foreground">Regulatory licence no.</dt>
                <dd className="min-h-[57px] border-b border-border py-[11px]">
                  <span
                    className="inline-flex items-center gap-3 font-semibold text-warn transition-opacity duration-200"
                    style={{ opacity: t >= T_NEEDED ? 1 : 0 }}
                  >
                    <Glyph tone="warn" size={14} /> Needed (IVD item)
                  </span>
                </dd>
                <dt className="py-[11px] text-muted-foreground">Supplier bank account</dt>
                <dd className="min-h-[57px] py-[11px]">
                  <span
                    className="inline-flex items-baseline gap-3 text-[25px] leading-[32px] text-ok transition-opacity duration-200"
                    style={{ opacity: t >= T_BANK ? 1 : 0 }}
                  >
                    <Glyph tone="ok" size={14} className="relative top-[1px]" /> 1 sensitive value removed before extraction
                  </span>
                </dd>
              </dl>
            </motion.div>

            {/* Phrases in flight (step 0 only) */}
            {flying
              ? flights.map((f, i) =>
                  f ? (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute top-0 left-0 bg-secondary text-[25px] leading-[37px] whitespace-nowrap text-foreground"
                      initial={{ x: f.from.x, y: f.from.y, opacity: 0 }}
                      animate={
                        t >= T_LIFT
                          ? { x: [f.from.x, f.to.x], y: [f.from.y, f.from.y - 26, f.to.y], opacity: [1, 1, 0] }
                          : { x: f.from.x, y: f.from.y, opacity: 0 }
                      }
                      transition={{
                        duration: FLY_MS / 1000,
                        delay: (i * FLY_GAP) / 1000,
                        ease: EASE,
                        opacity: { duration: FLY_MS / 1000, delay: (i * FLY_GAP) / 1000, times: [0, 0.9, 1] },
                      }}
                    >
                      {FIELDS[i].phrase}
                    </motion.span>
                  ) : null,
                )
              : null}
          </>
        ) : null}

        <Flow drawn={t >= T_DRAW} nodeOne={t >= T_SHRINK} animated={animated} />
      </div>
    </SlideFrame>
  );
}
