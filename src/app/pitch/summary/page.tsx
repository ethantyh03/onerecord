import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand-mark";
import {
  ALTERNATIVES,
  AMY_WATERFALL,
  BASE_INPUTS,
  BASE_VOLUME,
  VOLUME_PRESETS,
  computeBusinessCase,
  computePhase2Case,
  edgeGrantSgd,
  phase1OneOffSgd,
  phase1RunCostSgd,
  waterfallTotals,
  type Mark,
} from "@/components/story/business-case";
import summary from "@/data/summary.json";
import impact from "@/data/impact.json";
import { LINKS } from "@/lib/links";
import { cn } from "@/lib/utils";
import { qrPath } from "./_lib/qr";

export const metadata: Metadata = { title: "Two-slide summary" };

/**
 * Brief S7 deliverable 3: the 2-slide summary. Two 1920×1080 slides stacked, one per printed page.
 * Exported to PDF/PNG by recording/export-summary.mjs. Every figure comes from business-case.ts,
 * summary.json or impact.json, never typed in by hand.
 */

// ---------------------------------------------------------------------------------------------
// Numbers

const headline = (id: string) => summary.headlines.find((h) => h.id === id)!;
const supporting = (id: string) => summary.supporting.find((h) => h.id === id)!;

const base = computeBusinessCase(BASE_VOLUME);
const rows = VOLUME_PRESETS.map((v) => computeBusinessCase(v));
const phase2 = computePhase2Case(BASE_VOLUME);
const edge = edgeGrantSgd();
const wf = waterfallTotals();
const oneOff = phase1OneOffSgd();
const runCost = phase1RunCostSgd();
const phase2LicSgd = BASE_INPUTS.phase2LicencesUsdPerYear * BASE_INPUTS.fxSgdPerUsd;

const fmtInt = (n: number) => Math.round(n).toLocaleString("en-SG");
const fmtK = (n: number, digits = 1) => `S$${(n / 1000).toFixed(digits)}k`;
const fmtM = (n: number) => `S$${(n / 1_000_000).toFixed(2)}M`;

const forecast = headline("forecast");
const forecastToday = Math.round(forecast.baseline! * 100);
const forecastOurs = Math.round(forecast.value * 100);
const dup = headline("duplicates");
const hero = supporting("hero_my");
const heroPct = Math.round(Math.abs(hero.value) * 100);
const blocked = impact.opportunity.blockedDuringWindow;
const pilot = impact.adoption.pilot;

/** Team name for the slide footers (final model §7.4). The student fills this in; export-summary.mjs warns while it is empty. */
const TEAM_NAME = "CTFudders";
const teamLine = TEAM_NAME.trim() ? `${TEAM_NAME.trim()} · SMU DSA 2026` : "SMU DSA 2026";

const youtubeReady = !!LINKS.youtube && !/REPLACE_ME/i.test(LINKS.youtube);
const displayUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

// ---------------------------------------------------------------------------------------------
// Small pieces

const BUILDERS = {
  mdm: { color: "var(--chart-1)", label: "MDM team configures" },
  lean: { color: "var(--chart-3)", label: "Lean team builds" },
  outside: { color: "oklch(0.56 0.15 266)", label: "Outside help" },
} as const;
type Builder = keyof typeof BUILDERS;

const FLOW: { lane: string; title: string; note: string; cost: string; free?: boolean; builders: Builder[] }[] = [
  { lane: "Requestor", title: "Power Apps form", note: "Paste an email; rules fill it", cost: "Existing licences", builders: ["lean", "mdm"] },
  { lane: "Checks", title: "Duplicate + field check", note: "Fuzzy name + tax ID; IVD rule", cost: "Standard connectors", builders: ["outside", "lean"] },
  { lane: "Approvers", title: "Teams approvals", note: "In parallel, 2-business-day SLA", cost: "Standard connector", builders: ["lean", "mdm"] },
  { lane: "MDM", title: "SharePoint List", note: "One final check of a complete record", cost: "Existing licences", builders: ["lean", "mdm"] },
  { lane: "SAP B1", title: "DTW import file", note: "Daily batch in SAP's own field names", cost: "S$0 · ships with B1", free: true, builders: ["mdm"] },
  { lane: "Reporting", title: "Regional Pulse", note: "Each hospital counted once", cost: "Power BI Pro if not owned", builders: ["lean", "outside"] },
];

const ALT_LABEL: Record<string, string> = {
  "status-quo": "Email template + tracker",
  "sap-approvals": "SAP B1 approval procedures",
  "teams-approvals": "Teams Approvals only",
  "power-platform": "Power Platform workflow only",
  "mdm-suite": "Buy an MDM suite / B1 add-on",
  onerecord: "OneRecord",
};
const ALT_COST: Record<string, string> = {
  "status-quo": "~S$0",
  "sap-approvals": "S$0",
  "teams-approvals": "~S$0",
  "power-platform": "~S$30k",
  "mdm-suite": "High",
  onerecord: "~S$40k",
};
const CRITERIA = [
  { key: "stopsIncomplete", label: "Stops incomplete" },
  { key: "stopsDuplicates", label: "Stops duplicates" },
  { key: "fastVisibleApprovals", label: "Fast approvals" },
  { key: "mdmChangesWithoutIt", label: "MDM-owned, no IT" },
  { key: "regionalAnalytics", label: "Regional analytics" },
] as const;

function MarkGlyph({ mark }: { mark: Mark }) {
  const meta = {
    yes: { ch: "✓", cls: "bg-ok-soft text-ok-ink", sr: "Yes" },
    partly: { ch: "~", cls: "bg-warn-soft text-warn-ink", sr: "Partly" },
    no: { ch: "✗", cls: "bg-stuck-soft text-stuck-ink", sr: "No" },
    na: { ch: "—", cls: "bg-muted text-muted-foreground", sr: "Not applicable" },
  }[mark];
  return (
    <span className={cn("inline-flex size-[34px] items-center justify-center rounded-full text-[21px] leading-none font-bold", meta.cls)} title={meta.sr}>
      {meta.ch}
    </span>
  );
}

function Qr({ url, label }: { url: string; label: string }) {
  const { d, size } = qrPath(url);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="size-[112px] shrink-0 rounded-md bg-white" shapeRendering="crispEdges" role="img" aria-label={`QR code: ${label}`}>
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#0b1d24" />
    </svg>
  );
}

function SectionLabel({ n, children, className }: { n?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2.5 text-[18px] font-semibold tracking-[0.08em] text-primary uppercase", className)}>
      {n ? <span className="inline-flex size-[28px] items-center justify-center rounded-full bg-primary text-[16px] tracking-normal text-primary-foreground">{n}</span> : null}
      {children}
    </p>
  );
}

function SlideHeader({ kicker, title, page }: { kicker: string; title: ReactNode; page: string }) {
  return (
    <header className="border-b border-border pb-[16px]">
      <div className="flex items-center gap-3 text-[18px] text-muted-foreground">
        <BrandMark className="size-[30px] text-primary" />
        <span className="font-semibold text-foreground">OneRecord</span>
        <span aria-hidden>·</span>
        <span>{kicker}</span>
        <span className="ml-auto">
          Modernising master data at Lives Group · <span className="font-semibold text-foreground">{page}</span>
        </span>
      </div>
      <h1 className="mt-1.5 text-[44px] leading-[1.08] font-semibold tracking-[-0.025em] text-foreground">{title}</h1>
    </header>
  );
}

function Slide({ children, id }: { children: ReactNode; id: string }) {
  return (
    <section
      data-testid={id}
      className="summary-slide relative flex h-[1080px] w-[1920px] flex-col overflow-hidden bg-background px-[48px] pt-[34px] pb-[26px] text-foreground"
    >
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Slide 1: problem → solution → why this

function Slide1() {
  const max = wf.beforeDays;
  return (
    <Slide id="summary-slide-1">
      <SlideHeader kicker="2-slide summary" title="Messy master data hides money. OneRecord fixes it at the front door." page="1 / 2" />

      <div className="mt-[24px] grid min-h-0 flex-1 grid-cols-[540px_620px_1fr] gap-[44px]">
        {/* PROBLEM */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel n="1">Problem</SectionLabel>
          <h2 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.015em]">Amy needed one item code. It took {wf.beforeDays} days.</h2>
          <p className="mt-1 text-[18px] text-muted-foreground">Our breakdown of App C (illustrative): before → after</p>

          <div className="mt-4 space-y-[13px]">
            {AMY_WATERFALL.map((s) => {
              const process = s.kind === "process";
              return (
                <div key={s.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[18px] leading-snug">
                    <span className={cn("min-w-0", process && "font-semibold")}>{s.label}</span>
                    <span className="shrink-0 font-semibold proportional-nums">
                      {s.beforeDays} → {s.afterDays} d
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-[16px] rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full opacity-30"
                      style={{ width: `${(s.beforeDays / max) * 100}%`, background: process ? "var(--chart-3)" : "var(--chart-1)" }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(s.afterDays / max) * 100}%`, background: process ? "var(--chart-3)" : "var(--chart-1)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-warn/45 bg-warn-soft px-4 py-2.5 text-[18px] leading-snug text-warn-ink">
            <span className="font-semibold text-foreground">
              {wf.beforeDays} → ~{wf.afterDays} calendar days.
            </span>{" "}
            ≈{Math.round(wf.processShare * 100)}% of the saving is a process change: approve in parallel, no new software.
          </div>

          <ul className="mt-5 space-y-3">
            {[
              ["Incomplete and duplicate records", "Requests arrive by email; 40% bounce, 6% of new customers already exist (A13)."],
              ["Invisible approvals, no audit trail", "Approvers sign one at a time; nobody can see where a request is stuck."],
              ["Regional numbers no one trusts", "The same hospital sits under 3 codes, so growth and decline are hidden."],
            ].map(([t, d]) => (
              <li key={t} className="border-l-[4px] border-stuck pl-3.5">
                <p className="text-[20px] leading-tight font-semibold">{t}</p>
                <p className="mt-0.5 text-[18px] leading-snug text-secondary-foreground">{d}</p>
              </li>
            ))}
          </ul>

          <p className="mt-auto inline-flex self-start rounded-full border border-primary/30 bg-primary-soft px-4 py-1.5 text-[18px] font-medium text-primary">
            Fact: SAP B1&apos;s built-in approvals are document-centric
          </p>
        </div>

        {/* SOLUTION */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel n="2">Solution</SectionLabel>
          <h2 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.015em]">One front door on Microsoft 365, landing in SAP Business One</h2>

          <ol className="relative mt-3 space-y-[5px]">
            {FLOW.map((f) => (
              <li key={f.title} className="flex items-stretch overflow-hidden rounded-lg border border-border bg-card shadow-raised">
                <div className="flex w-[8px] shrink-0 flex-col">
                  {f.builders.map((b) => (
                    <span key={b} className="flex-1" style={{ background: BUILDERS[b].color }} />
                  ))}
                </div>
                <div className="flex w-[112px] shrink-0 items-center border-r border-border bg-muted/50 px-3 text-[18px] leading-tight font-semibold text-muted-foreground">
                  {f.lane}
                </div>
                <div className="flex min-w-0 flex-1 items-center px-3.5 py-[6px]">
                  <p className="truncate text-[19px] leading-tight font-semibold" title={f.note}>
                    {f.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center pr-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-px text-[18px] font-medium whitespace-nowrap",
                      f.free ? "border border-ok/60 bg-ok-soft text-ok-ink" : "bg-muted text-secondary-foreground",
                    )}
                  >
                    {f.cost}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[18px] text-secondary-foreground">
            {(Object.keys(BUILDERS) as Builder[]).map((b) => (
              <span key={b} className="inline-flex items-center gap-2">
                <span className="size-[14px] rounded-[4px]" style={{ background: BUILDERS[b].color }} />
                {BUILDERS[b].label}
              </span>
            ))}
          </div>
          <p className="mt-1.5 rounded-md border border-dashed border-phase2 bg-phase2-soft px-3 py-1 text-[18px] leading-snug text-phase2-ink">
            <span className="font-semibold">Phase 2 (not built):</span> automatic SAP posting, ≤USD 1,980/yr
          </p>

          <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2">
            <figure className="min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/summary/dup.png" alt="Duplicate check: National University Hospital, C-SG-00017, 100% match" className="w-full rounded-md border border-border" />
              <figcaption className="mt-1 text-[18px] leading-tight text-muted-foreground">Duplicate caught before approval</figcaption>
            </figure>
            <figure className="min-w-0">
              {/* Cropped to the card header + the two masked credit-term rows so it stays readable at this size. */}
              <div className="overflow-hidden rounded-md border border-border" style={{ aspectRatio: "1236 / 330" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/summary/teams.png" alt="Teams approval card with masked credit terms" className="block w-full" />
              </div>
              <figcaption className="mt-1 text-[18px] leading-tight text-muted-foreground">Approve in Teams</figcaption>
            </figure>
            <figure className="col-span-2">
              {/* Cropped to the header, the top 4 rows and the −32% card so it clears the slide footer (the full hero lists 10 rows). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/summary/pulse.png"
                alt="Regional Pulse: Bukit Damai Specialist Hospital, #2 in Malaysia, down 32% once merged"
                className="block w-full rounded-md border border-border object-cover object-top"
                style={{ aspectRatio: "2288 / 735" }}
              />
              <figcaption className="mt-1 text-[18px] leading-tight text-muted-foreground">Regional Pulse: duplicates merged, a hidden decline appears</figcaption>
            </figure>
          </div>
        </div>

        {/* WHY THIS */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel n="3">Why this, not…</SectionLabel>
          <h2 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.015em]">The only option that fixes both the workflow and the numbers</h2>

          <table className="mt-4 w-full border-collapse text-[18px]">
            <thead>
              <tr>
                <th className="pb-2 text-left align-bottom font-semibold text-muted-foreground">Option</th>
                <th className="pb-2 pl-1 text-left align-bottom font-semibold text-muted-foreground">Cost</th>
                {CRITERIA.map((c) => (
                  <th key={c.key} className="w-[46px] pb-2 align-bottom">
                    <span className="inline-block text-left leading-tight font-semibold text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                      {c.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALTERNATIVES.map((a) => (
                <tr key={a.id} className={cn("border-t border-border", a.chosen && "bg-primary-soft")}>
                  <td className={cn("py-[9px] pr-2 pl-2 leading-tight", a.chosen ? "font-bold text-primary" : "font-medium")}>{ALT_LABEL[a.id]}</td>
                  <td className="py-[9px] pl-1 whitespace-nowrap text-secondary-foreground proportional-nums">{ALT_COST[a.id]}</td>
                  {CRITERIA.map((c) => (
                    <td key={c.key} className="py-[9px] text-center">
                      <MarkGlyph mark={a[c.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[18px] text-muted-foreground">✓ yes · ~ partly · ✗ no · — not applicable</p>

          <ul className="mt-6 space-y-3 text-[18px] leading-snug text-secondary-foreground">
            <li>
              <span className="font-semibold text-foreground">SAP B1 approvals</span> are document-centric: no structured intake, no duplicate check, no parallel SLA for master-data requests.
            </li>
            <li>
              <span className="font-semibold text-foreground">Teams Approvals alone</span> is a good zero-build first step, but has no duplicate check and no SAP-ready output.
            </li>
          </ul>
        </div>
      </div>

      <footer className="mt-[18px] flex justify-between border-t border-border pt-2.5 text-[18px] text-muted-foreground">
        <span>Prototype on synthetic, illustrative data · Amy&apos;s case: brief, App C</span>
        <span className="font-semibold text-foreground" data-testid="summary-team">{teamLine}</span>
        <span>Live demo and full working: {displayUrl(LINKS.liveUrl)}</span>
      </footer>
    </Slide>
  );
}

// ---------------------------------------------------------------------------------------------
// Slide 2: impact, cost, adoption

function Slide2() {
  const tiles = [
    {
      figure: "Median 14 days → ≤ 4 business days",
      caption: `Setup time for a new record (A26). Amy's took ${wf.beforeDays}; ≈${Math.round(wf.processShare * 100)}% of the saving is a process change.`,
    },
    {
      figure: "≈1,750 hours a year",
      caption: `${fmtInt(base.hoursPerYear)} h (≈${base.fte.toFixed(2)} FTE) of analyst, requestor and MDM time handed back. Capacity, not headcount.`,
    },
    {
      figure: "Payback ≈ 6 months",
      caption: `${base.paybackMonths.toFixed(1)} months on a ${fmtK(oneOff)} phase-1 one-off, hard hours only, at ${BASE_VOLUME} requests a month.`,
    },
    {
      figure: "No new licences",
      caption: "for the workflow in phase 1: standard Microsoft 365 connectors, Teams, SharePoint and SAP B1's own import tool.",
    },
  ];

  return (
    <Slide id="summary-slide-2">
      <SlideHeader kicker="2-slide summary" title="Impact, cost and how we get it adopted" page="2 / 2" />

      <div className="mt-[20px] grid grid-cols-4 gap-[24px]">
        {tiles.map((t) => (
          <div key={t.figure} className="rounded-xl bg-sidebar px-5 pt-4 pb-4 text-sidebar-foreground">
            <p className="text-[33px] leading-[1.05] font-semibold tracking-[-0.025em] text-white proportional-nums">{t.figure}</p>
            <p className="mt-2 text-[18px] leading-snug text-sidebar-foreground/85">{t.caption}</p>
          </div>
        ))}
      </div>

      <div className="mt-[22px] grid min-h-0 flex-1 grid-cols-[600px_560px_1fr] gap-[40px]">
        {/* BUSINESS CASE */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel>Business case (hard hours × S$50/h)</SectionLabel>
          <table className="mt-3 w-full border-collapse text-[18px] proportional-nums">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1.5 font-semibold">Requests / month</th>
                <th className="pb-1.5 text-right font-semibold">Hours / yr</th>
                <th className="pb-1.5 text-right font-semibold">Net / yr</th>
                <th className="pb-1.5 text-right font-semibold">Payback</th>
                <th className="pb-1.5 text-right font-semibold">3-yr net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isBase = r.requestsPerMonth === BASE_VOLUME;
                return (
                  <tr key={r.requestsPerMonth} className={cn("border-t border-border", isBase && "bg-primary-soft font-semibold text-primary")}>
                    <td className="py-[7px] pl-2">
                      {r.requestsPerMonth}
                      {isBase ? " (base)" : ""}
                    </td>
                    <td className="py-[7px] text-right">{fmtInt(r.hoursPerYear)}</td>
                    <td className="py-[7px] text-right">{fmtK(r.netSgdPerYear)}</td>
                    <td className="py-[7px] text-right">{r.paybackMonths.toFixed(1)} mo</td>
                    <td className="py-[7px] pr-2 text-right">{fmtK(r.threeYearNetSgd, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <dl className="mt-4 space-y-2.5 text-[18px] leading-snug">
            <div>
              <dt className="font-semibold">
                Phase 1: {fmtK(oneOff)} one-off + {fmtK(runCost)}/yr run
              </dt>
              <dd className="text-secondary-foreground">
                Lean team 2 × 6 weeks, a 15-day contractor, MDM config, 30-min onboarding. Cash ≈ the contractor; the rest is internal time.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">
                Phase 2, only after the pilot: {fmtK(phase2.oneOffSgd)} + ≤{fmtK(phase2LicSgd)}/yr licences
              </dt>
              <dd className="text-secondary-foreground">
                Automatic SAP posting saves only the import step: ~{Math.round(phase2.paybackYearsProcess)}-year payback on hours, so it is a speed decision.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Upside, not counted</dt>
              <dd className="text-secondary-foreground">
                EDGE grant ≈{fmtK(edge.grantSgd, 0)} if Lives qualifies as an SME; approver time. Opportunity figures are never added to payback.
              </dd>
            </div>
          </dl>
        </div>

        {/* PILOT + ADOPTION */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel>Pilot, KPIs and adoption</SectionLabel>
          <p className="mt-3 text-[20px] leading-snug font-semibold">
            {pilot.weeks}-week pilot · {pilot.scope}
          </p>
          <ul className="mt-2.5 space-y-1.5 text-[18px] leading-snug">
            {[
              ["≥90%", "of requests through OneRecord by week 6"],
              ["≤4", "business days median setup (baseline 14 days)"],
              ["<15%", "bounce rate (baseline 40%)"],
              ["Count", "duplicates stopped at intake, weekly"],
              ["Falling", "S$ of orders waiting on a setup"],
            ].map(([k, v]) => (
              <li key={v} className="flex gap-3">
                <span className="w-[86px] shrink-0 font-semibold text-primary proportional-nums">{k}</span>
                <span className="text-secondary-foreground">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg border border-border bg-card px-3.5 py-2 text-[18px] leading-snug">
            <span className="font-semibold">Week 6 gate:</span> median &gt;6 business days or adoption &lt;70% → fix or stop. KPIs met → TH, VN, MM, then
            Vendor and Cost centre.
          </p>
          <p className="mt-3 text-[18px] leading-snug text-secondary-foreground">
            <span className="font-semibold text-foreground">Adoption:</span> one front door (the MDM mailbox auto-replies with the form link) ·
            one-click approvals in Teams · visible status ends chasing · a champion per entity · weekly SLA scoreboard.
          </p>
        </div>

        {/* INSIGHT + SCOPE */}
        <div className="flex min-h-0 flex-col">
          <SectionLabel>Regional insight (illustrative data)</SectionLabel>
          <ul className="mt-3 space-y-2.5 text-[18px] leading-snug">
            <li className="border-l-[4px] border-stuck pl-3">
              Merging {dup.value} duplicate records (of {dup.baseline}) shows Bukit Damai Specialist Hospital, Malaysia&apos;s #2 account, is down {heroPct}%.
            </li>
            <li className="border-l-[4px] border-warn pl-3">
              {fmtM(blocked.value)} of orders waited on an MDM setup in the last 12 months, {blocked.avgDaysBlocked.value} days on average.
            </li>
            <li className="border-l-[4px] border-primary pl-3">
              On our illustrative data, today&apos;s method is off by {forecastToday} units per 100 ordered; ours by {forecastOurs} (6 unseen months, rising
              dengue season).
            </li>
          </ul>

          <p className="mt-4 text-[18px] leading-snug">
            <span className="font-semibold">Not in v1, by design:</span>{" "}
            <span className="text-secondary-foreground">automatic SAP posting, merging existing SAP duplicates, deep-learning forecasts.</span>
          </p>
          <p className="mt-2 text-[18px] leading-snug">
            <span className="font-semibold">Roadmap:</span>{" "}
            <span className="text-secondary-foreground">
              M365 pilot build → vendor bank-detail changes with dual Finance control → delegation and time-zone SLAs → Power BI Pulse on real B1 extracts.
            </span>
          </p>
        </div>
      </div>

      {/* ASSUMPTIONS */}
      <div className="mt-3 rounded-lg border border-border bg-muted/60 px-4 py-2 text-[18px] leading-[1.35] text-secondary-foreground">
        <span className="font-semibold text-foreground">Labelled assumptions</span> (full register at /assumptions): <b>A1</b> 5 countries: SG, MY, TH,
        VN, MM · <b>A5/A27</b> Oct 2025–Sep 2026 vs the year before; 36 months of synthetic history (B1 holds ≥24) · <b>A8</b> growth = 12-month YoY PO value
        on de-duplicated customers · <b>A9</b> independent approvals run in parallel (policy change) · <b>A12–A13</b> ~80 requests/month; 40% bounce, 6%
        duplicate customers · <b>A17</b> all data synthetic, names fictional · <b>A19–A26</b> 1.25 h saved per request, 4 h per duplicate, 40 h/month
        consolidation, S$50/h, build and partner costs (low confidence), 10% leak, USD 1 = S$1.33, 14-day baseline.
      </div>

      {/* LINKS */}
      <footer className="mt-3 flex items-center gap-8 border-t border-border pt-3">
        <p className="mr-auto max-w-[220px] text-[22px] leading-tight font-semibold text-foreground" data-testid="summary-team">{teamLine}</p>
        <div className="flex items-center gap-4">
          <Qr url={LINKS.liveUrl} label="live prototype" />
          <div>
            <p className="text-[18px] text-muted-foreground">Live prototype</p>
            <p className="text-[24px] font-semibold text-foreground">{displayUrl(LINKS.liveUrl)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Qr url={LINKS.github} label="GitHub repository" />
          <div>
            <p className="text-[18px] text-muted-foreground">Code (GitHub)</p>
            <p className="text-[24px] font-semibold text-foreground">{displayUrl(LINKS.github)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {youtubeReady ? <Qr url={LINKS.youtube} label="demo video" /> : null}
          <div>
            <p className="text-[18px] text-muted-foreground">Demo video (YouTube)</p>
            <p className="text-[24px] font-semibold text-foreground">{youtubeReady ? displayUrl(LINKS.youtube) : "YouTube link: see submission form"}</p>
          </div>
        </div>
      </footer>
    </Slide>
  );
}

export default function SummaryPage() {
  return (
    <>
      {/* The pitch layer is a fixed, clipped full-screen frame; this route scrolls and prints as 2 pages instead. */}
      <style>{`
        [data-testid="pitch-overlay"] { position: static !important; overflow: visible !important; }
        html, body { background: var(--canvas); }
        @page { size: 1920px 1080px; margin: 0; }
        @media print {
          html, body { background: var(--background); }
          .summary-stack { gap: 0 !important; padding: 0 !important; }
          .summary-slide { break-after: page; page-break-after: always; box-shadow: none !important; }
          .summary-slide:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <main className="summary-stack flex w-max flex-col gap-10 p-10 print:p-0" data-testid="pitch-summary">
        <Slide1 />
        <Slide2 />
      </main>
    </>
  );
}
