"use client";

/**
 * "How it lands in SAP B1": the production target as one swimlane, colour-coded by who builds each box.
 * Inline SVG so it scales crisply in a 1080p recording; theme colours come from CSS variables.
 * The phase-1 golden path pulses box by box; the phase-2 Service Layer route is dashed and never animated.
 */

type Builder = "mdm" | "lean" | "outside";

export const BUILDER_META: Record<Builder, { color: string; label: string; detail: string }> = {
  mdm: { color: "var(--chart-1)", label: "MDM team configures", detail: "fields, routes, business units; loads the daily import" },
  lean: { color: "var(--chart-3)", label: "Lean team builds", detail: "1 citizen developer + 1 analyst, ~6 weeks" },
  outside: { color: "oklch(0.56 0.15 266)", label: "Outside help", detail: "SAP partner ~15 days · data-science contractor ~15 days" },
};

interface Lane {
  name: string;
  actor: string;
}

interface Box {
  lane: number;
  title: string;
  who: string;
  lines: string[];
  mono?: number[]; // indexes of lines set in monospace
  cost: string;
  builders: Builder[];
}

const LANES: Lane[] = [
  { name: "Requestor", actor: "Sales, product, support" },
  { name: "OneRecord checks", actor: "Before anyone approves" },
  { name: "Approvers", actor: "BU head, Finance, QA/RA" },
  { name: "MDM final check", actor: "MDM team" },
  { name: "SAP Business One", actor: "System of record" },
  { name: "Regional Pulse", actor: "Management, country leads" },
];

const BOXES: Box[] = [
  {
    lane: 0,
    title: "Power Apps form",
    who: "Lean team + MDM",
    lines: ["Structured form. Paste", "an email; rules fill it", "(in-tenant AI: phase 2).", "MDM edits fields, rules."],
    cost: "Existing licences",
    builders: ["lean", "mdm"],
  },
  {
    lane: 1,
    title: "Duplicate check",
    who: "DS contractor + lean",
    lines: ["Required fields and the", "IVD rule block submit.", "A nightly matcher writes", "match keys to SharePoint."],
    cost: "Standard connectors",
    builders: ["outside", "lean"],
  },
  {
    lane: 2,
    title: "Teams approvals",
    who: "Lean team + MDM",
    lines: ["Power Automate standard", "Approvals, in parallel:", "2-day SLA, reminder,", "escalation. Outlook too."],
    cost: "Standard connector",
    builders: ["lean", "mdm"],
  },
  {
    lane: 3,
    title: "SharePoint List",
    who: "Lean team + MDM",
    lines: ["One final review of a", "complete record. Bank", "and credit fields sit in", "a restricted list."],
    cost: "Existing licences",
    builders: ["lean", "mdm"],
  },
  {
    lane: 4,
    title: "DTW import file",
    who: "MDM team, no build",
    lines: ["Daily batch with SAP's", "own field names, loaded", "by MDM after the final", "check."],
    cost: "S$0 · ships with SAP B1",
    builders: ["mdm"],
  },
  {
    lane: 5,
    title: "Power BI report",
    who: "Analyst + contractor",
    lines: ["Reads orders, quotes,", "customers and items", "from SAP B1, with each", "hospital counted once."],
    cost: "Power BI Pro if not owned",
    builders: ["lean", "outside"],
  },
];

const PHASE2: Box = {
  lane: 4,
  title: "Service Layer",
  who: "SAP partner, ~15 days",
  lines: ["Approved records post", "straight into SAP B1", "through its API. Only", "if the pilot proves it."],
  cost: "≤USD 1,980/yr (phase 2)",
  builders: ["outside"],
};

const W = 1320;
const H = 572;
const LANE_W = W / LANES.length; // 220
const PAD = 12;
const BOX_W = LANE_W - PAD * 2; // 196
const ROW1_Y = 92;
const ROW1_H = 214;
const ROW2_Y = ROW1_Y + ROW1_H + 26;
const ROW2_H = 222;
const MID_Y = ROW1_Y + ROW1_H / 2;
const PULSE_STEP_S = 0.7;
const PULSE_CYCLE_S = PULSE_STEP_S * BOXES.length + 1.4;

function BoxShape({ box, y, h, index, phase2 }: { box: Box; y: number; h: number; index?: number; phase2?: boolean }) {
  const x = box.lane * LANE_W + PAD;
  const stripeW = BOX_W / box.builders.length;
  const bodyStart = y + (phase2 ? 113 : 88);
  const lineH = phase2 ? 19.5 : 21;
  return (
    <g>
      {!phase2 ? (
        <rect
          className="sl-glow"
          x={x - 4}
          y={y - 4}
          width={BOX_W + 8}
          height={h + 8}
          rx={13}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={3}
          style={{ animationDelay: `${(index ?? 0) * PULSE_STEP_S}s` }}
        />
      ) : null}
      <rect
        x={x}
        y={y}
        width={BOX_W}
        height={h}
        rx={10}
        fill="var(--card)"
        stroke={phase2 ? "var(--phase2)" : "var(--primary)"}
        strokeOpacity={phase2 ? 1 : 0.55}
        strokeWidth={phase2 ? 1.75 : 1.5}
        strokeDasharray={phase2 ? "6 5" : undefined}
      />
      <clipPath id={`sl-clip-${box.lane}-${phase2 ? "p2" : "p1"}`}>
        <rect x={x} y={y} width={BOX_W} height={h} rx={10} />
      </clipPath>
      <g clipPath={`url(#sl-clip-${box.lane}-${phase2 ? "p2" : "p1"})`}>
        {box.builders.map((b, i) => (
          <rect key={b} x={x + i * stripeW} y={y} width={stripeW} height={8} fill={BUILDER_META[b].color} />
        ))}
      </g>
      <text x={x + 14} y={y + 38} fontSize={17} fontWeight={650} fill="var(--foreground)">
        {box.title}
      </text>
      <g>
        {box.builders.map((b, i) => (
          <circle key={b} cx={x + 18 + i * 12} cy={y + 56} r={4.5} fill={BUILDER_META[b].color} stroke="var(--card)" strokeWidth={1.5} />
        ))}
        <text x={x + 14 + box.builders.length * 12 + 6} y={y + 60.5} fontSize={12.5} fill="var(--muted-foreground)">
          {box.who}
        </text>
      </g>
      {box.lines.map((line, i) => {
        const mono = box.mono?.includes(i);
        return (
          <text
            key={i}
            x={x + 14}
            y={bodyStart + i * lineH}
            fontSize={mono ? 11.5 : phase2 ? 13.5 : 14.5}
            fontFamily={mono ? "var(--font-mono)" : undefined}
            fill={mono ? "var(--phase2-ink)" : "var(--secondary-foreground)"}
          >
            {line}
          </text>
        );
      })}
      <rect
        x={x + 8}
        y={y + h - 40}
        width={BOX_W - 16}
        height={28}
        rx={14}
        fill={phase2 ? "var(--phase2-soft)" : box.cost.startsWith("S$0") ? "var(--ok-soft)" : "var(--muted)"}
        stroke={phase2 ? "var(--phase2)" : box.cost.startsWith("S$0") ? "var(--ok)" : "none"}
        strokeOpacity={0.6}
      />
      <text
        x={x + BOX_W / 2}
        y={y + h - 21.5}
        fontSize={12.5}
        fontWeight={600}
        textAnchor="middle"
        fill={phase2 ? "var(--phase2-ink)" : box.cost.startsWith("S$0") ? "var(--ok-ink)" : "var(--secondary-foreground)"}
      >
        {box.cost}
      </text>
      {phase2 ? (
        <g>
          <rect x={x + 12} y={y + 69} width={120} height={22} rx={11} fill="var(--phase2-soft)" stroke="var(--phase2)" strokeDasharray="3 2" />
          <text x={x + 72} y={y + 84} fontSize={12} fontWeight={650} textAnchor="middle" fill="var(--phase2-ink)">
            Phase 2 · not built
          </text>
        </g>
      ) : null}
    </g>
  );
}

export function Swimlane() {
  return (
    <figure
      data-testid="arch-swimlane"
      className="overflow-hidden rounded-xl border bg-card shadow-raised"
      aria-labelledby="swimlane-caption"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby="swimlane-title swimlane-desc"
        className="block h-auto w-full"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <title id="swimlane-title">How a OneRecord request lands in SAP Business One</title>
        <desc id="swimlane-desc">
          Requestor fills a Power Apps form; OneRecord checks for duplicates and missing fields; approvers decide in Teams or Outlook through Power
          Automate standard Approvals; MDM gives a final check in a SharePoint List; phase 1 loads a DTW import file into SAP B1 daily, phase 2 posts
          through the Service Layer; Regional Pulse reports in Power BI on SAP B1 extracts.
        </desc>
        <defs>
          <marker id="sl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--primary)" />
          </marker>
          <marker id="sl-arrow-p2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--phase2)" />
          </marker>
          <style>{`
            .sl-flow { stroke-dasharray: 7 5; animation: sl-dash 0.9s linear infinite; }
            @keyframes sl-dash { to { stroke-dashoffset: -12; } }
            .sl-glow { opacity: 0; animation: sl-glow ${PULSE_CYCLE_S}s ease-in-out infinite; }
            @keyframes sl-glow {
              0% { opacity: 0; }
              6% { opacity: 0.9; }
              18% { opacity: 0; }
              100% { opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .sl-flow { animation: none; }
              .sl-glow { animation: none; opacity: 0; }
            }
          `}</style>
        </defs>

        {/* lanes */}
        {LANES.map((lane, i) => (
          <g key={lane.name}>
            <rect x={i * LANE_W} y={0} width={LANE_W} height={H} fill={i % 2 ? "var(--muted)" : "var(--card)"} opacity={i % 2 ? 0.55 : 1} />
            {i > 0 ? <line x1={i * LANE_W} x2={i * LANE_W} y1={0} y2={H} stroke="var(--border)" strokeWidth={1} /> : null}
            <text x={i * LANE_W + PAD + 2} y={34} fontSize={16.5} fontWeight={700} fill="var(--foreground)">
              {lane.name}
            </text>
            <text x={i * LANE_W + PAD + 2} y={56} fontSize={12.5} fill="var(--muted-foreground)">
              {lane.actor}
            </text>
          </g>
        ))}
        <line x1={0} x2={W} y1={72} y2={72} stroke="var(--border)" />

        {/* golden path connectors (phase 1) */}
        {BOXES.slice(0, -1).map((b) => {
          const x1 = b.lane * LANE_W + PAD + BOX_W;
          const x2 = (b.lane + 1) * LANE_W + PAD - 2;
          return (
            <line
              key={`c-${b.lane}`}
              className="sl-flow"
              x1={x1}
              x2={x2}
              y1={MID_Y}
              y2={MID_Y}
              stroke="var(--primary)"
              strokeWidth={3}
              markerEnd="url(#sl-arrow)"
            />
          );
        })}

        {/* phase-2 route: from the MDM check straight into the Service Layer */}
        <path
          d={`M ${3 * LANE_W + LANE_W / 2} ${ROW1_Y + ROW1_H} V ${ROW2_Y + 110} H ${4 * LANE_W + PAD - 2}`}
          fill="none"
          stroke="var(--phase2)"
          strokeWidth={2.25}
          strokeDasharray="6 5"
          markerEnd="url(#sl-arrow-p2)"
        />
        <text x={3 * LANE_W + LANE_W / 2 - 10} y={ROW2_Y + 54} fontSize={13} fontWeight={600} textAnchor="end" fill="var(--phase2-ink)">
          Phase 2:
        </text>
        <text x={3 * LANE_W + LANE_W / 2 - 10} y={ROW2_Y + 72} fontSize={13} textAnchor="end" fill="var(--phase2-ink)">
          record posts
        </text>
        <text x={3 * LANE_W + LANE_W / 2 - 10} y={ROW2_Y + 90} fontSize={13} textAnchor="end" fill="var(--phase2-ink)">
          itself to SAP
        </text>

        {BOXES.map((b, i) => (
          <BoxShape key={b.lane} box={b} y={ROW1_Y} h={ROW1_H} index={i} />
        ))}
        <BoxShape box={PHASE2} y={ROW2_Y} h={ROW2_H} phase2 />

        {/* legend: who builds it */}
        <g transform={`translate(${PAD + 2}, ${ROW2_Y + 6})`}>
          <text x={0} y={16} fontSize={15} fontWeight={700} fill="var(--foreground)">
            Who builds it
          </text>
          {(Object.keys(BUILDER_META) as Builder[]).map((b, i) => (
            <g key={b} transform={`translate(0, ${40 + i * 38})`}>
              <rect x={0} y={-12} width={16} height={16} rx={4} fill={BUILDER_META[b].color} />
              <text x={26} y={1} fontSize={14} fontWeight={650} fill="var(--foreground)">
                {BUILDER_META[b].label}
              </text>
              <text x={26} y={18} fontSize={12.5} fill="var(--secondary-foreground)">
                {BUILDER_META[b].detail}
              </text>
            </g>
          ))}
          <g transform="translate(330, 40)">
            <line x1={0} x2={34} y1={-4} y2={-4} stroke="var(--primary)" strokeWidth={3} className="sl-flow" />
            <text x={44} y={1} fontSize={14} fontWeight={650} fill="var(--foreground)">
              Phase 1 golden path
            </text>
            <text x={44} y={18} fontSize={12.5} fill="var(--secondary-foreground)">
              about 4 business days end to end
            </text>
          </g>
          <g transform="translate(330, 78)">
            <line x1={0} x2={34} y1={-4} y2={-4} stroke="var(--phase2)" strokeWidth={2.25} strokeDasharray="6 5" />
            <text x={44} y={1} fontSize={14} fontWeight={650} fill="var(--foreground)">
              Phase 2, not built
            </text>
            <text x={44} y={18} fontSize={12.5} fill="var(--secondary-foreground)">
              only if same-day posting is worth it
            </text>
          </g>
          <g transform="translate(330, 116)">
            <rect x={0} y={-12} width={34} height={16} rx={8} fill="var(--ok-soft)" stroke="var(--ok)" strokeOpacity={0.6} />
            <text x={44} y={1} fontSize={14} fontWeight={650} fill="var(--foreground)">
              Cost on each box
            </text>
            <text x={44} y={18} fontSize={12.5} fill="var(--secondary-foreground)">
              new spend that box needs
            </text>
          </g>
          
        </g>

        {/* phase-1 summary card */}
        <g transform={`translate(${5 * LANE_W + PAD}, ${ROW2_Y})`}>
          <rect x={0} y={0} width={BOX_W} height={ROW2_H} rx={10} fill="var(--primary-soft)" stroke="var(--primary)" strokeOpacity={0.3} />
          <text x={14} y={30} fontSize={15} fontWeight={700} fill="var(--primary)">
            Phase 1 in numbers
          </text>
          {(
            [
              ["~6 weeks", "to the pilot", 60],
              ["S$39.9k", "one-off", 88],
              ["S$0", "new workflow licences", 116],
              ["≈6 months", "payback", 162],
            ] as const
          ).map(([big, small, ty]) => (
            <text key={big} x={14} y={ty} fontSize={14} fill="var(--secondary-foreground)">
              <tspan fontWeight={700} fontSize={17} fill="var(--foreground)">
                {big}
              </tspan>{" "}
              {small}
            </text>
          ))}
          <text x={14} y={134} fontSize={11.5} fill="var(--muted-foreground)">
            Power BI Pro only if not owned
          </text>
          <text x={14} y={ROW2_H - 14} fontSize={11.5} fill="var(--muted-foreground)">
            At 80 requests a month (/impact)
          </text>
        </g>
      </svg>
      <figcaption id="swimlane-caption" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-2.5 text-[0.8125rem] text-muted-foreground">
        <span>Production target on Microsoft 365 and SAP Business One.</span>
        <span>In this prototype, Teams, Outlook, SAP B1 and the clock are simulated in your browser.</span>
      </figcaption>
    </figure>
  );
}
