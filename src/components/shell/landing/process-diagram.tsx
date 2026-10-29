"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowUpRight,
  ClipboardPen,
  Database,
  Pause,
  Play,
  ScanSearch,
  ShieldCheck,
  Split,
  type LucideIcon,
} from "lucide-react";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Phase2Badge } from "@/components/common/badges";
import { formatSgd } from "@/components/common/format";
import { PersonChip } from "@/components/common/person-chip";

const DEMO_REQUEST_ID = "REQ-1042";
const FALLBACK_ITEM_CODE = "I-A-000812";
const FALLBACK_RELEASED_SGD = 70_000;

interface JourneyNode {
  id: string;
  title: string;
  surface: string;
  text: (slaDays: number) => string;
  href: string;
  screen: string;
  personId: string;
  icon: LucideIcon;
  phase2?: string;
  narration: (ctx: { slaDays: number; released: string }) => string;
}

const NODES: JourneyNode[] = [
  {
    id: "request",
    title: "Request",
    surface: "Power Apps form",
    text: () => "Paste an old email and the form fills itself, asking only for what's missing.",
    href: "/requests/new",
    screen: "New request",
    personId: "amy",
    icon: ClipboardPen,
    narration: () =>
      "The requestor pastes an old email. The form fills itself, and because the item is a diagnostic test kit (an IVD medical device) it asks for the Malaysian regulator's (MDA) licence number and adds a Quality and Regulatory (QA/RA) review.",
  },
  {
    id: "checks",
    title: "Checks",
    surface: "Duplicate and completeness",
    text: () => "Missing fields and near-duplicate records are stopped before anyone approves.",
    href: "/requests/new",
    screen: "New request",
    personId: "amy",
    icon: ScanSearch,
    narration: () =>
      "Before anyone approves, the request is checked for empty required fields and matched against existing SAP records, so a second copy of a hospital never gets created.",
  },
  {
    id: "approvals",
    title: "Approvals",
    surface: "Teams and Outlook",
    text: (d) => `Approvers decide in parallel, each on a ${d}-business-day SLA clock.`,
    href: "/approvals",
    screen: "Approvals",
    personId: "weijie",
    icon: Split,
    narration: ({ slaDays }) =>
      `QA/RA, the BU head and Business Support approve at the same time from a Teams card or an Outlook email. Each step has ${slaDays} business days, with a reminder and then an escalation.`,
  },
  {
    id: "mdm",
    title: "MDM final check",
    surface: "MDM console",
    text: () => "One review of a record that is already complete, with the full audit trail.",
    href: "/mdm",
    screen: "MDM console",
    personId: "priya",
    icon: ShieldCheck,
    narration: () =>
      "Priya gives the approved record one final check. Every decision so far sits in a tamper-evident audit trail.",
  },
  {
    id: "sap",
    title: "SAP B1",
    surface: "Import file today",
    text: () => "A ready-made SAP import file (Data Transfer Workbench) replaces keying by hand.",
    href: "/sap",
    screen: "SAP B1",
    personId: "priya",
    icon: Database,
    phase2: "posts straight into SAP",
    narration: () =>
      "The record goes into SAP Business One through a ready-made import file (SAP's Data Transfer Workbench), and the requestor hears the moment it is live. In Phase 2 the record posts itself straight into SAP.",
  },
  {
    id: "pulse",
    title: "Regional Pulse",
    surface: "Clean data out",
    text: () => "One record per customer gives growth and a forecast the region can trust.",
    href: "/pulse",
    screen: "Regional Pulse",
    personId: "marcus",
    icon: Activity,
    narration: ({ released }) =>
      `The two hospital orders waiting on this item, worth ${released}, move again. Because each customer now has one record, regional growth and the forecast are built on the truth.`,
  },
];

type MarkerState = "passed" | "active" | "upcoming";

/** A stage on the OneRecord path: a square stage box (records are square, people are round). */
function Marker({ icon: Icon, state }: { icon: LucideIcon; state: MarkerState }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-500",
        state === "active" && "border-signal bg-signal text-canvas",
        state === "passed" && "border-signal/50 bg-signal-soft text-signal",
        state === "upcoming" && "border-border-strong bg-card text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="size-[1.0625rem]" strokeWidth={2} />
    </span>
  );
}

/**
 * The end-to-end process: Request → Checks → Approvals → MDM → SAP B1 → Regional Pulse.
 * A record token travels the track; its identity changes as it goes
 * (request id → SAP item code → released demand). Every node opens its screen.
 */
export function ProcessDiagram() {
  const reduceMotion = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);

  const slaDays = useSandbox((s) => s.config.sla.stepBusinessDays);
  const req = useSandbox((s) => s.requests.find((r) => r.id === DEMO_REQUEST_ID));
  const prs = useSandbox((s) => s.prs);

  const { releasedSgd, orderCount } = useMemo(() => {
    const ids = new Set(req?.blockedPrIds ?? []);
    const linked = prs.filter((p) => ids.has(p.id) || p.blockedByRequestId === DEMO_REQUEST_ID);
    const sum = linked.reduce((n, p) => n + p.sgd, 0);
    return {
      releasedSgd: sum > 0 ? sum : FALLBACK_RELEASED_SGD,
      orderCount: linked.length > 0 ? linked.length : 2,
    };
  }, [prs, req]);

  const released = formatSgd(releasedSgd);
  const itemCode = req?.sapCode ?? FALLBACK_ITEM_CODE;
  const isLive = req?.status === "created";
  const autoplay = playing && !hovering && !reduceMotion;
  const last = NODES.length - 1;

  function advance() {
    if (active === last) {
      setCycle((c) => c + 1);
      setActive(0);
    } else {
      setActive(active + 1);
    }
  }

  useEffect(() => {
    if (!autoplay) return;
    const delay = active === last ? 4200 : 2400;
    const t = window.setTimeout(() => {
      if (active === last) {
        setCycle((c) => c + 1);
        setActive(0);
      } else {
        setActive(active + 1);
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [active, autoplay, last]);

  function token(i: number): { label: string; tone: "brand" | "ok"; mono: boolean } {
    if (i === 4) return { label: itemCode, tone: "ok", mono: true };
    if (i === 5) return { label: `${formatSgd(releasedSgd, { compact: true })} released`, tone: "ok", mono: false };
    return { label: DEMO_REQUEST_ID, tone: "brand", mono: true };
  }

  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.9 };

  return (
    <section aria-labelledby="journey-title" className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <div className="min-w-0">
          <h2 id="journey-title" className="panel-title text-base">
            From request to SAP B1, and back out as insight
          </h2>
          <p className="mt-0.5 max-w-[80ch] text-sm text-muted-foreground">
            {isLive ? (
              <>
                Follow {DEMO_REQUEST_ID}, a new dengue test kit for Malaysia. It is live in SAP B1 as{" "}
                <span className="mono-id text-foreground">{itemCode}</span>, and the{" "}
                {orderCount} hospital orders worth {released} it was holding back are moving again.
              </>
            ) : (
              <>
                Follow {DEMO_REQUEST_ID}, a new dengue test kit for Malaysia. {orderCount} hospital orders worth{" "}
                <span className="num font-medium text-stuck-ink">{released}</span> are waiting on it.
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {reduceMotion ? (
            <Button type="button" variant="outline" size="sm" onClick={advance}>
              Next step
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>
              {playing ? <Pause aria-hidden className="size-3.5" /> : <Play aria-hidden className="size-3.5" />}
              {playing ? "Pause" : "Play"}
            </Button>
          )}
        </div>
      </div>

      <div
        className="bg-canvas bg-dot-grid px-2 pt-4 pb-3 lg:px-3"
        onMouseLeave={() => setHovering(false)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovering(false);
        }}
      >
        {/* The storyboard's "Clean in │ Money out" split: steps 1–5 clean the record, step 6 is the payoff. */}
        <div data-testid="home-split" className="mb-1 hidden grid-cols-6 xl:grid">
          <div className="col-span-5 px-3">
            <p className="text-center text-[0.8125rem] text-muted-foreground">
              <span className="mr-2 font-semibold text-signal">Clean in</span>
              one complete, checked record per customer, vendor and item
            </p>
            <span aria-hidden className="mt-1.5 block h-2 rounded-t-sm border-x border-t border-signal/45" />
          </div>
          <div className="col-span-1 px-3">
            <p className="text-center text-[0.8125rem] font-semibold text-ok-ink">Money out</p>
            <span aria-hidden className="mt-1.5 block h-2 rounded-t-sm border-x border-t border-ok/50" />
          </div>
        </div>
        <ol className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-y-0">
          {NODES.map((node, i) => {
            const state: MarkerState = i < active ? "passed" : i === active ? "active" : "upcoming";
            const t = token(i);
            return (
              <li
                key={node.id}
                className={cn("relative", i === last && "xl:border-l xl:border-dashed xl:border-ok/50 xl:pl-1")}
              >
                {i < last ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-[66px] right-[-5px] left-[55px] z-10 hidden h-[2px] overflow-hidden bg-border-strong xl:block"
                  >
                    <motion.span
                      className="absolute inset-0 origin-left bg-signal"
                      initial={false}
                      animate={{ scaleX: i < active ? 1 : 0 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </span>
                ) : null}

                <Link
                  href={node.href}
                  onMouseEnter={() => {
                    setHovering(true);
                    setActive(i);
                  }}
                  onFocus={() => {
                    setHovering(true);
                    setActive(i);
                  }}
                  className={cn(
                    "group/node relative flex h-full flex-col rounded-lg border p-3 outline-none transition-[background-color,border-color] duration-300",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    state === "active"
                      ? "border-border-strong bg-card"
                      : "border-transparent hover:border-border hover:bg-card/80",
                  )}
                >
                  <span className="mb-2 hidden h-7 items-end xl:flex">
                    {i === active ? (
                      <motion.span
                        layoutId={`journey-token-${cycle}`}
                        layout="position"
                        initial={reduceMotion || i !== 0 ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={layoutTransition}
                        className={cn(
                          "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-xs font-semibold whitespace-nowrap",
                          t.tone === "ok"
                            ? "border-ok/45 bg-ok-soft text-ok-ink"
                            : "border-signal/45 bg-signal-soft text-foreground",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("size-1.5 rounded-full", t.tone === "ok" ? "bg-ok" : "bg-signal")}
                        />
                        <span className={cn("num", t.mono && "mono-id font-normal")}>
                          {t.label}
                        </span>
                      </motion.span>
                    ) : null}
                  </span>

                  <Marker icon={node.icon} state={state} />

                  <span className="mt-3 flex items-baseline gap-1.5">
                    <span className="num text-sm font-medium text-muted-foreground">{i + 1}</span>
                    <span className="text-[0.9375rem] leading-snug font-semibold text-foreground">{node.title}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="ml-auto size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover/node:opacity-100 group-focus-visible/node:opacity-100"
                    />
                  </span>
                  <span className="mt-0.5 text-[0.8125rem] font-medium text-secondary-foreground">{node.surface}</span>
                  <span className="mt-1.5 text-[0.8125rem] leading-snug text-muted-foreground">{node.text(slaDays)}</span>
                  {node.phase2 ? <Phase2Badge label={node.phase2} className="mt-2 self-start" /> : null}
                  <span className="mt-auto pt-3">
                    <PersonChip personId={node.personId} />
                  </span>
                  <span className="sr-only">Open {node.screen}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex min-h-[3.25rem] items-center border-t border-border px-4 py-3 lg:px-5">
        <motion.p
          key={active}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-[110ch] text-sm leading-snug text-secondary-foreground"
        >
          <span className="num mr-1.5 font-semibold text-foreground">
            Step {active + 1} of {NODES.length}.
          </span>
          {NODES[active].narration({ slaDays, released })}
        </motion.p>
      </div>
    </section>
  );
}
