"use client";

import { StateGlyph } from "@/components/common";
import { cn } from "@/lib/utils";

/**
 * "How it lands in SAP B1": the production target as one system map, read left to right, lane by lane.
 * No cards: each lane is a column between hairlines (the Gotham meta-column idiom). The phase-1 golden path is
 * one teal (signal) track across the top with a square station per lane, and a request steps along it. Under
 * the track each lane names the platform (UI face: product names are not identifiers), the part, who builds it
 * (one small square per builder, coloured by who builds it) and, on a ruled last line, the new spend it needs.
 * The phase-2 Service Layer is a dashed violet branch under the MDM and SAP lanes, never animated.
 * HTML rather than SVG so the text stays at real pixel sizes on a 1280-wide projector.
 */

type Builder = "mdm" | "lean" | "outside";

/**
 * Who builds each part. Colours deliberately avoid teal signal (the Tesseract path) and violet (phase 2):
 * bright neutral = configuration only (it has to read against the border on a projector, so not mid-grey),
 * amber = the lean team's build, coral = paid outside help.
 */
export const BUILDER_META: Record<Builder, { color: string; label: string; detail: string }> = {
  mdm: { color: "var(--foreground)", label: "MDM team configures", detail: "fields, routes, business units; loads the daily import" },
  lean: { color: "var(--chart-3)", label: "Lean team builds", detail: "1 citizen developer + 1 analyst, ~6 weeks" },
  outside: { color: "var(--chart-2)", label: "Outside help", detail: "SAP partner ~15 days · data-science contractor ~15 days" },
};

interface Lane {
  name: string;
  actor: string;
}

interface Box {
  lane: number;
  /** The platform the part runs on, as named in the sandbox → production table */
  system: string;
  /** Shorter form of `system` for when the map is narrow (a 1280-wide projector) */
  short?: string;
  title: string;
  who: string;
  lines: string[];
  cost: string;
  builders: Builder[];
}

const LANES: Lane[] = [
  { name: "Requestor", actor: "Sales, product, support" },
  { name: "Tesseract checks", actor: "Before anyone approves" },
  { name: "Approvers", actor: "BU head, Finance, QA/RA" },
  { name: "MDM final check", actor: "MDM team" },
  { name: "SAP Business One", actor: "System of record" },
  { name: "Regional Pulse", actor: "Management, country leads" },
];

const BOXES: Box[] = [
  {
    lane: 0,
    system: "Power Apps",
    title: "Power Apps form",
    who: "Lean team + MDM",
    lines: ["Structured form. Paste", "an email; rules fill it", "(in-tenant AI: phase 2).", "MDM edits fields, rules."],
    cost: "Existing licences",
    builders: ["lean", "mdm"],
  },
  {
    lane: 1,
    system: "Microsoft Graph",
    short: "MS Graph",
    title: "Duplicate check",
    who: "DS contractor + lean",
    lines: ["Required fields and the", "IVD rule block submit.", "A nightly matcher writes", "match keys to SharePoint."],
    cost: "Standard connectors",
    builders: ["outside", "lean"],
  },
  {
    lane: 2,
    system: "Power Automate",
    short: "Automate",
    title: "Teams approvals",
    who: "Lean team + MDM",
    lines: ["Power Automate standard", "Approvals, in parallel:", "2-day SLA, reminder,", "escalation. Outlook too."],
    cost: "Standard connector",
    builders: ["lean", "mdm"],
  },
  {
    lane: 3,
    system: "SharePoint",
    title: "SharePoint List",
    who: "Lean team + MDM",
    lines: ["One final review of a", "complete record. Bank", "and credit fields sit in", "a restricted list."],
    cost: "Existing licences",
    builders: ["lean", "mdm"],
  },
  {
    lane: 4,
    system: "SAP B1",
    title: "DTW import file",
    who: "MDM team, no build",
    lines: ["Daily batch with SAP's", "own field names, loaded", "by MDM after the final", "check."],
    cost: "S$0 · ships with SAP B1",
    builders: ["mdm"],
  },
  {
    lane: 5,
    system: "Power BI",
    title: "Power BI report",
    who: "Analyst + contractor",
    lines: ["Reads orders, quotes,", "customers and items", "from SAP B1, with each", "hospital counted once."],
    cost: "Power BI Pro if not owned",
    builders: ["lean", "outside"],
  },
];

const PHASE2: Box = {
  lane: 4,
  system: "SAP B1",
  title: "Service Layer",
  who: "SAP partner, ~15 days",
  lines: ["Approved records post", "straight into SAP B1", "through its API. Only", "if volumes justify it."],
  cost: "≤USD 1,980/yr (phase 2)",
  builders: ["outside"],
};

/** One golden-path step: how long a request "sits" at each station before stepping on. */
const STEP_S = 0.8;
const CYCLE_S = STEP_S * BOXES.length + 1.6;
const pct = (s: number) => `${((s / CYCLE_S) * 100).toFixed(2)}%`;

/*
 * Stations are solid teal squares; while the request sits at one, a 1px outline locks on around it (hard
 * on/off, no fade), then the bead (a small teal square) runs along the segment to the next station.
 * Under reduced motion the path is static.
 */
const CSS = `
.sl-station { outline: 1px solid transparent; outline-offset: 3px; animation: sl-station ${CYCLE_S}s steps(1, end) infinite backwards; }
@keyframes sl-station {
  0%, ${pct(STEP_S * 1.2)}, 100% { outline-color: transparent; }
  ${pct(0.12)} { outline-color: var(--signal); }
}
.sl-bead { opacity: 0; left: 0; animation: sl-bead ${CYCLE_S}s linear infinite; }
@keyframes sl-bead {
  0%, ${pct(STEP_S * 0.5)} { opacity: 0; left: 0; }
  ${pct(STEP_S * 0.52)} { opacity: 1; left: 0; }
  ${pct(STEP_S)} { opacity: 1; left: calc(100% - 0.5rem); }
  ${pct(STEP_S * 1.04)}, 100% { opacity: 0; left: calc(100% - 0.5rem); }
}
@media (prefers-reduced-motion: reduce) {
  .sl-station { animation: none; }
  .sl-bead { display: none; }
}
`;

/** One square per builder, in the builder's colour. */
function BuilderMarks({ builders, className }: { builders: Builder[]; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 gap-[3px]", className)}>
      {builders.map((b) => (
        <span key={b} className="size-2.5 rounded-[1px]" style={{ background: BUILDER_META[b].color }} />
      ))}
    </span>
  );
}

function SystemName({ box }: { box: Box }) {
  return (
    <p className="truncate text-xs leading-4 text-subtle" title={box.system}>
      {box.short ? (
        <>
          <span className="@min-[1120px]:hidden">{box.short}</span>
          <span className="hidden @min-[1120px]:inline">{box.system}</span>
        </>
      ) : (
        box.system
      )}
    </p>
  );
}

/** The track row of one lane: its station, and (except the last lane) the segment and arrow to the next station. */
function Track({ index, last }: { index: number; last: boolean }) {
  return (
    <div aria-hidden className="relative h-8">
      <span
        className="sl-station absolute top-1/2 left-4 z-10 size-2.5 -translate-y-1/2 rounded-[1px] bg-signal"
        style={{ animationDelay: `${index * STEP_S}s` }}
      />
      {last ? null : (
        <span className="absolute top-1/2 left-[1.875rem] -right-3 z-10 flex -translate-y-1/2 items-center">
          <span className="h-0.5 flex-1 bg-signal" />
          <svg viewBox="0 0 6 8" className="h-2 w-1.5 shrink-0 overflow-visible">
            <path d="M0 0 L6 4 L0 8 z" fill="var(--signal)" />
          </svg>
          <span className="sl-bead absolute top-1/2 size-2 -translate-y-1/2 rounded-[1px] bg-signal" style={{ animationDelay: `${index * STEP_S}s` }} />
        </span>
      )}
    </div>
  );
}

function CostLine({ cost, tone }: { cost: string; tone: "ok" | "phase2" | "default" }) {
  return (
    <p
      className={cn(
        "mx-4 mt-3 mb-4 border-t border-border pt-2 text-[0.8125rem] leading-5 font-medium",
        tone === "ok" && "text-ok-ink",
        tone === "phase2" && "text-phase2-ink",
        tone === "default" && "text-secondary-foreground",
      )}
    >
      {cost}
    </p>
  );
}

function Legend() {
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-foreground">Who builds it</p>
        <ul className="mt-2.5 space-y-2.5">
          {(Object.keys(BUILDER_META) as Builder[]).map((b) => (
            <li key={b} className="grid grid-cols-[0.625rem_1fr] gap-x-2.5">
              <span aria-hidden className="mt-[0.3125rem] size-2.5 rounded-[1px]" style={{ background: BUILDER_META[b].color }} />
              <span>
                <span className="block text-sm leading-5 font-semibold text-foreground">{BUILDER_META[b].label}</span>
                <span className="block text-[0.8125rem] leading-[1.125rem] text-secondary-foreground">{BUILDER_META[b].detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ul className="space-y-2.5 sm:pt-[1.875rem]">
        <li className="grid grid-cols-[2.25rem_1fr] gap-x-2.5">
          <span aria-hidden className="relative mt-[0.3125rem] block h-2.5 w-9">
            <span className="absolute top-0 left-0 size-2.5 rounded-[1px] bg-signal" />
            <span className="absolute top-1/2 right-0 left-3.5 h-[1.5px] -translate-y-1/2 bg-signal" />
          </span>
          <span>
            <span className="block text-sm leading-5 font-semibold text-foreground">Phase 1 golden path</span>
            <span className="block text-[0.8125rem] leading-[1.125rem] text-secondary-foreground">about 4 business days end to end</span>
          </span>
        </li>
        <li className="grid grid-cols-[2.25rem_1fr] gap-x-2.5">
          <span aria-hidden className="mt-2.5 block w-9 border-t-2 border-dashed border-phase2" />
          <span>
            <span className="block text-sm leading-5 font-semibold text-foreground">Phase 2, planned</span>
            <span className="block text-[0.8125rem] leading-[1.125rem] text-secondary-foreground">only if same-day posting is worth it</span>
          </span>
        </li>
        <li className="grid grid-cols-[2.25rem_1fr] gap-x-2.5">
          <span aria-hidden className="mt-2.5 block w-9 border-t border-border-strong" />
          <span>
            <span className="block text-sm leading-5 font-semibold text-foreground">Cost on each box</span>
            <span className="block text-[0.8125rem] leading-[1.125rem] text-secondary-foreground">new spend that box needs</span>
          </span>
        </li>
      </ul>
    </div>
  );
}

/**
 * The phase-2 branch, under the MDM and SAP lanes: a dashed violet line drops from the MDM lane and runs
 * right into a hollow violet station, where the Service Layer entry sits under the SAP lane.
 */
function Phase2Branch() {
  return (
    <div className="relative col-span-2 grid grid-cols-2 border-l border-border">
      {/* the elbow: down from the MDM lane, then right to the SAP lane's station */}
      <span aria-hidden className="absolute top-0 left-[1.3125rem] h-8 border-l-2 border-dashed border-phase2" />
      <span aria-hidden className="absolute top-8 left-[1.3125rem] right-[calc(50%-0.75rem)] flex -translate-y-1/2 items-center">
        <span className="flex-1 border-t-2 border-dashed border-phase2" />
        <svg viewBox="0 0 6 8" className="h-2 w-1.5 shrink-0 overflow-visible">
          <path d="M0 0 L6 4 L0 8 z" fill="var(--phase2)" />
        </svg>
      </span>

      <div className="px-4 pt-11 pb-4">
        <p className="pl-5 text-[0.8125rem] leading-[1.125rem] text-phase2-ink">
          <span className="font-semibold">Phase 2:</span> record posts itself to SAP
        </p>
      </div>

      <div className="flex flex-col border-l border-border">
        <div aria-hidden className="relative h-10">
          <span className="absolute top-8 left-4 size-2.5 -translate-y-1/2 rounded-[1px] border-[1.5px] border-phase2 bg-card" />
        </div>
        <div className="px-4">
          <SystemName box={PHASE2} />
          <h3 className="font-wide mt-1 text-[0.9375rem] leading-5 font-semibold text-foreground">{PHASE2.title}</h3>
          <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">{PHASE2.who}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs leading-4 font-semibold whitespace-nowrap text-phase2-ink">
            <StateGlyph tone="phase2" />
            Phase 2 · planned
          </span>
          <p className="mt-2 text-sm leading-[1.45] text-secondary-foreground">{PHASE2.lines.join(" ")}</p>
        </div>
        <div className="mt-auto">
          <CostLine cost={PHASE2.cost} tone="phase2" />
        </div>
      </div>
    </div>
  );
}

function Phase1Numbers() {
  const rows = [
    ["~6 weeks", "to the pilot"],
    ["S$39.9k", "one-off"],
    ["S$0", "new workflow licences"],
  ] as const;
  return (
    <div className="flex flex-col border-l border-border px-4 pt-4 pb-4">
      <p className="font-wide text-sm leading-5 font-semibold text-foreground">Phase 1 in numbers</p>
      <div className="mt-2 space-y-1">
        {rows.map(([big, small]) => (
          <p key={big} className="text-[0.8125rem] leading-6 text-secondary-foreground">
            <span className="num font-wide text-[1.0625rem] font-semibold text-foreground">{big}</span> {small}
          </p>
        ))}
        <p className="text-xs leading-4 text-subtle">Power BI Pro only if not owned</p>
        <p className="pt-1.5 text-[0.8125rem] leading-6 text-secondary-foreground">
          <span className="num font-wide text-[1.0625rem] font-semibold text-foreground">≈6 months</span> payback
        </p>
      </div>
      <p className="mt-auto pt-3 text-xs leading-4 text-subtle">At 80 requests a month (see Business case)</p>
    </div>
  );
}

export function Swimlane() {
  return (
    <figure data-testid="arch-swimlane" aria-labelledby="swimlane-title" aria-describedby="swimlane-desc" className="panel flex flex-col overflow-hidden">
      <style>{CSS}</style>
      <header className="panel-header py-2.5">
        <h2 id="swimlane-title" className="panel-title">
          How a Tesseract request lands in SAP Business One
        </h2>
      </header>
      <p id="swimlane-desc" className="sr-only">
        Requestor fills a Power Apps form; Tesseract checks for duplicates and missing fields; approvers decide in Teams or Outlook through Power
        Automate standard Approvals; MDM gives a final check in a SharePoint List; phase 1 loads a DTW import file into SAP B1 daily, phase 2 posts
        through the Service Layer; Regional Pulse reports in Power BI on SAP B1 extracts.
      </p>

      <div className="scrollbar-thin relative overflow-x-auto">
        <div className="@container relative min-w-[940px]">
          {/* six lanes, each a ruled column on a shared subgrid: head, track, identity, description, cost */}
          <div className="grid grid-cols-6 grid-rows-[auto_auto_auto_1fr_auto]">
            {LANES.map((lane, i) => {
              const box = BOXES[i];
              const costTone = box.cost.startsWith("S$0") ? "ok" : "default";
              return (
                <div key={lane.name} className={cn("row-span-5 grid min-w-0 grid-rows-subgrid", i > 0 && "border-l border-border")}>
                  <div className="border-b border-border px-4 pt-3 pb-2.5">
                    <p className="font-wide text-[0.9375rem] leading-5 font-semibold text-foreground">{lane.name}</p>
                    <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">{lane.actor}</p>
                  </div>
                  <Track index={i} last={i === BOXES.length - 1} />
                  <div className="min-w-0 px-4">
                    <SystemName box={box} />
                    <h3 className="font-wide mt-1 text-[0.9375rem] leading-5 font-semibold text-foreground">{box.title}</h3>
                    <p className="mt-1 text-[0.8125rem] leading-5 text-muted-foreground">
                      <BuilderMarks builders={box.builders} className="mr-2 align-[-0.0625rem]" />
                      {box.who}
                    </p>
                  </div>
                  <p className="px-4 pt-2.5 text-sm leading-[1.45] text-secondary-foreground">{box.lines.join(" ")}</p>
                  <CostLine cost={box.cost} tone={costTone} />
                </div>
              );
            })}
          </div>

          {/* legend, the phase-2 branch, phase 1 in numbers */}
          <div className="grid grid-cols-6 border-t border-border">
            <div className="col-span-3 px-4 py-4">
              <Legend />
            </div>
            <Phase2Branch />
            <Phase1Numbers />
          </div>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
        <span>Production target on Microsoft 365 and SAP Business One.</span>
        <span>In this sandbox, Teams, Outlook, SAP B1 and the clock run in your browser.</span>
      </figcaption>
    </figure>
  );
}
