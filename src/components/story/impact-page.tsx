"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import {
  IllustrativeMarker,
  PageHeader,
  Phase2Badge,
  Readout,
  ReadoutStrip,
  ReadoutUnit,
  StateGlyph,
  formatSgd,
  type StateTone,
} from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasHydrated } from "@/lib/store";
import { useStuckDemand } from "@/lib/selectors";
import { signals } from "@/data/contract";
import { cn } from "@/lib/utils";
import {
  ALTERNATIVES,
  BASE_INPUTS,
  BASE_VOLUME,
  SOURCES,
  VOLUME_MAX,
  VOLUME_MIN,
  VOLUME_PRESETS,
  computeBusinessCase,
  computePhase2Case,
  edgeGrantSgd,
  phase1OneOffSgd,
  phase1RunCostSgd,
  revenueAtRiskSgd,
  waterfallTotals,
} from "./business-case";
import { AmyWaterfall } from "./amy-waterfall";
import { Figure, MarkCell, NoteChip, Panel, SectionHeading, T } from "./story-ui";

const I = BASE_INPUTS;

function int(n: number): string {
  return Math.round(n).toLocaleString("en-SG");
}
function one(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "never";
}
function months(n: number): string {
  return Number.isFinite(n) ? `${n.toFixed(1)} months` : "never";
}
/** S$2.64M: the same style as summary.json and the Pulse headline figures. */
function millions(n: number): string {
  return `S$${(n / 1_000_000).toFixed(2)}M`;
}
function years(n: number): string {
  return Number.isFinite(n) ? `~${n < 10 ? n.toFixed(1) : Math.round(n)} years` : "never";
}

export function ImpactPage() {
  const [volume, setVolume] = useState<number>(BASE_VOLUME);
  const c = useMemo(() => computeBusinessCase(volume), [volume]);
  const p2 = useMemo(() => computePhase2Case(volume), [volume]);
  const p2At120 = useMemo(() => computePhase2Case(120), []);
  const wf = waterfallTotals();
  const oneOff = phase1OneOffSgd();
  const run = phase1RunCostSgd();
  const edge = edgeGrantSgd();
  const rows = useMemo(() => {
    const vols: number[] = [...VOLUME_PRESETS];
    if (!vols.includes(volume)) vols.push(volume);
    return vols.sort((a, b) => a - b).map((v) => computeBusinessCase(v));
  }, [volume]);

  return (
    <div className="w-full space-y-8 pb-10">
      <PageHeader
        title="The business case"
        subtitle="What OneRecord saves, what it costs and when it pays back. Only hard savings (hours released) count towards payback; delayed revenue and growth signals sit in their own columns."
        meta={
          <Link href="/assumptions#group-business" className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <NoteChip>Every input labelled, A12–A26</NoteChip>
          </Link>
        }
        actions={
          <Link href="/assumptions" className={buttonVariants({ variant: "outline" })}>
            <ScrollText aria-hidden />
            See every assumption
          </Link>
        }
      />

      {/* ---------------------------------------------------------------- Headline readouts */}
      <ReadoutStrip as="section" aria-label="Headline impact" gridClassName="lg:[&>[data-lead]]:flex-[1.6]">
        <Readout
          lead
          label="Median time to set up a record"
          value={
            <Figure formula={<>{SOURCES.a26} Target: median ≤4 business days, in line with the APQC benchmark of 3.0 days.</>}>
              {/* Units at normal width; if it wraps, the arrow ends the first line instead of starting the second. */}
              <span className="whitespace-nowrap">
                14<ReadoutUnit> days</ReadoutUnit> <span className="text-muted-foreground">→</span>
              </span>{" "}
              <span className="whitespace-nowrap">
                ≤ 4<ReadoutUnit> business days</ReadoutUnit>
              </span>
            </Figure>
          }
          caption="Median 14 days (Amy's took 18) → ≤ 4 business days. Amy's item is from the case brief (Appendix C)."
          footnote="A26 · APQC benchmark 3.0 days"
        />
        <Readout
          label="Hours back a year"
          value={
            <Figure
              formula={
                <>
                  ({one(c.workflowHoursPerMonth)} workflow h + {I.regionalHoursPerMonth} regional h) × 12 months at {volume} requests a month.{" "}
                  {SOURCES.a19}
                </>
              }
            >
              ≈{int(c.hoursPerYear)}
              <ReadoutUnit> h</ReadoutUnit>
            </Figure>
          }
          caption={`About ${c.fte.toFixed(2)} of a full-time person, at ${volume} requests a month`}
          footnote="A19–A21 · valued at S$50/h"
        />
        <Readout
          label="Phase-1 payback"
          value={
            <Figure
              testId="impact-payback"
              formula={
                <>
                  {formatSgd(oneOff)} one-off ÷ ({formatSgd(c.netSgdPerYear)} net a year ÷ 12) = {one(c.paybackMonths)} months.
                </>
              }
            >
              {months(c.paybackMonths)}
            </Figure>
          }
          caption={`On a ${formatSgd(oneOff)} one-off; hard hours only, at ${volume} requests a month`}
          footnote="A22 · run cost 15%/yr deducted"
        />
        <Readout
          label="New workflow licences, phase 1"
          value={
            <Figure formula="Phase 1 runs on standard connectors only: Power Apps canvas app, SharePoint List, Power Automate standard Approvals in Teams/Outlook, and the SAP import file loaded by MDM. Licences Lives already owns with Microsoft 365.">
              None
            </Figure>
          }
          caption="No new licences for the workflow (phase 1): standard connectors only. Power BI Pro only if not owned."
          footnote="Research log: Microsoft licensing"
        />
      </ReadoutStrip>

      {/* ---------------------------------------------------------------- Volume control */}
      <section aria-labelledby="calc-title" className="space-y-4">
        <Panel
          as="div"
          titleId="calc-title"
          title="Try a different volume"
          description="Lives Group has not published its request volume, so we show three cases. Pick one, or drag the slider; every number on this page follows."
          bodyClassName="flex flex-col gap-5 lg:flex-row lg:items-center"
        >
          <div className="shrink-0 lg:min-w-[8.5rem]">
            <p className="text-[0.8125rem] font-medium text-muted-foreground">Requests a month</p>
            <p className="num font-wide mt-1 text-[2rem] leading-none font-semibold text-foreground">{volume}</p>
          </div>
          <div className="flex shrink-0 gap-1.5" role="group" aria-label="Volume presets">
            {VOLUME_PRESETS.map((v) => (
              <Button
                key={v}
                data-testid={`impact-volume-${v}`}
                variant={volume === v ? "default" : "outline"}
                size="lg"
                aria-pressed={volume === v}
                onClick={() => setVolume(v)}
                className="num min-w-[4.5rem]"
              >
                {v}
                {v === BASE_VOLUME ? <span className="text-xs font-normal opacity-80">base</span> : null}
              </Button>
            ))}
          </div>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:border-l lg:border-border lg:pl-5">
            <span className="sr-only">Requests a month</span>
            <input
              type="range"
              min={VOLUME_MIN}
              max={VOLUME_MAX}
              step={5}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="h-2 w-full cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              style={{ accentColor: "var(--primary)" }}
              data-testid="impact-volume-slider"
            />
            <span className="num flex justify-between gap-4 text-xs text-muted-foreground">
              <span>{VOLUME_MIN}</span>
              <span className="text-center">{SOURCES.volume}</span>
              <span>{VOLUME_MAX}</span>
            </span>
          </label>
        </Panel>

        {/* ---------------------------------------------------------------- Hard / soft / opportunity: one panel, three ruled columns */}
        <div className="panel grid overflow-hidden lg:grid-cols-3 lg:grid-rows-[auto_1fr_auto]">
          <BenefitColumn
            title="Hard: capacity released"
            note="Counts towards payback"
            tone="ok"
            rows={[
              {
                label: "Workflow hours a month",
                value: <Figure formula={<>{volume} requests × 1.25 h + duplicates stopped × 4 h. {SOURCES.a19} {SOURCES.a20}</>}>{one(c.workflowHoursPerMonth)} h</Figure>,
              },
              {
                label: "Regional consolidation a month",
                value: <Figure formula={SOURCES.a21}>{I.regionalHoursPerMonth} h</Figure>,
              },
              {
                label: "Hours a year",
                value: <Figure formula={`(${one(c.workflowHoursPerMonth)} + ${I.regionalHoursPerMonth}) × 12. ${SOURCES.fte}`}>{int(c.hoursPerYear)} h ({c.fte.toFixed(2)} FTE)</Figure>,
                strong: true,
              },
              {
                label: "Value a year at S$50/h",
                value: <Figure formula={`${int(c.hoursPerYear)} h × S$50. ${SOURCES.rate}`}>{formatSgd(c.grossSgdPerYear)}</Figure>,
              },
              {
                label: "Less run cost",
                value: <Figure formula={`${formatSgd(oneOff)} × 15%. ${SOURCES.run}`}>−{formatSgd(run)}</Figure>,
              },
              {
                label: "Net a year",
                value: <Figure formula={`${formatSgd(c.grossSgdPerYear)} − ${formatSgd(run)}`}>{formatSgd(c.netSgdPerYear)}</Figure>,
                strong: true,
              },
              {
                label: "Duplicate customers stopped a year",
                value: (
                  <Figure formula={`${volume} × 35/80 customers × 6% duplicates × 70% caught × 12. ${SOURCES.a20}`}>
                    ≈{Math.round(c.duplicatesStoppedPerYear)}
                  </Figure>
                ),
              },
            ]}
          />
          <BenefitColumn
            title="Soft: faster, calmer"
            note="Real, but not in payback"
            tone="neutral"
            rows={[
              {
                label: "Request-days returned a month",
                value: (
                  <Figure formula={`${volume} requests × (14 − ~6) calendar days. Days in which customers can be invoiced sooner. ${SOURCES.a26}`}>
                    ≈{int(c.requestDaysReturnedPerMonth)}
                  </Figure>
                ),
                strong: true,
              },
              {
                label: "Median cycle time",
                value: <Figure formula={SOURCES.a26}>median 14 days (Amy&apos;s took 18) → ≤ 4 business days</Figure>,
              },
              {
                label: "Outside benchmark",
                value: <Figure formula={SOURCES.apqc}>3.0 days (APQC median)</Figure>,
              },
              {
                label: "Bounced requests",
                value: <Figure formula="A13 (illustrative): 40% bounce today. Pilot target: under 15%, because the form will not submit with a required field missing.">40% → under 15%</Figure>,
              },
              {
                label: "Approver time saved",
                value: <Figure formula="Approvers cost S$85–110/h. Their time is real but deliberately left out of the case.">Not counted</Figure>,
              },
              {
                label: "Status chasing",
                value: <Figure formula="Requestors and approvers see where every request stands, so 'any update?' emails stop. Counted inside A19 forwarding and chasing (0.5 h), not again here.">Ends</Figure>,
              },
            ]}
          />
          <OpportunityColumn />
        </div>
      </section>

      {/* ---------------------------------------------------------------- Costs */}
      <Panel
        titleId="costs-title"
        title="What it costs"
        description="Phase 1 is the workflow on Microsoft 365 plus the SAP import file. Phase 2 (automatic SAP posting) is only bought if the pilot proves the case for it."
        flush
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className={cn(T.table, "min-w-[720px]")}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.head}>Item</th>
                <th className={T.head}>Who</th>
                <th className={cn(T.head, "text-right")}>One-off</th>
                <th className={cn(T.head, "text-right")}>Each year</th>
              </tr>
            </thead>
            <tbody>
              <CostGroupRow label="Phase 1: pilot, then roll-out" badge={<NoteChip tone="ok">No new licences for the workflow (phase 1)</NoteChip>} />
              <CostRow item="Lean team build, 6 weeks" who="1 citizen developer + 1 analyst" oneOff={<Figure formula="2 people × 6 weeks × 40 h × S$50 (A22)">{formatSgd(I.leanTeamSgd)}</Figure>} />
              <CostRow item="Duplicate matcher and forecast" who="Data-science / Power Platform contractor, ~15 days" oneOff={<Figure formula="15 days × S$650/day (A22, upper end of S$450–650, low confidence)">{formatSgd(I.contractorSgd)}</Figure>} />
              <CostRow item="Forms, routes and business units" who="MDM team configures" oneOff={<Figure formula="48 h × S$50 (A22)">{formatSgd(I.mdmConfigSgd)}</Figure>} />
              <CostRow item="Onboarding" who="150 requestors and approvers × 30 min" oneOff={<Figure formula="150 people × 0.5 h × S$50 (A22)">{formatSgd(I.onboardingSgd)}</Figure>} />
              <CostRow
                item="Run and maintain"
                who="Lean team"
                yearly={<Figure formula={`15% of ${formatSgd(oneOff)} a year. ${SOURCES.run}`}>{formatSgd(run)}</Figure>}
              />
              <CostRow
                item="Regional Pulse in Power BI, only if not owned"
                who="Microsoft, ~10 viewers"
                yearly={
                  <Figure formula="Power BI Pro for ~10 viewers at ≈USD 14/user/month (approx.) = ≈USD 1,680 a year, only if Lives does not already own it. The pilot analytics run without Power BI, so it is not in the total.">
                    ≈USD 14/user/month, not in total
                  </Figure>
                }
              />
              <CostRow item="Phase 1 total" who="" strong oneOff={<Figure formula={SOURCES.a22}>{formatSgd(oneOff)}</Figure>} yearly={formatSgd(run)} />
              <CostGroupRow label="Phase 2: automatic posting to SAP B1" badge={<Phase2Badge label="after the pilot" />} />
              <CostRow item="Service Layer integration" who="SAP partner, ~15 days" oneOff={<Figure formula={SOURCES.a23}>{formatSgd(I.sapPartnerSgd)}</Figure>} />
              <CostRow
                item="Licences: Process + 1 Premium maker"
                who="Microsoft"
                yearly={<Figure formula={SOURCES.licences}>≤{formatSgd(p2.licencesSgdPerYear)} (USD 1,980)</Figure>}
              />
              <CostRow item="Maintenance" who="SAP partner" yearly={<Figure formula={`15% of ${formatSgd(I.sapPartnerSgd)} a year`}>{formatSgd(p2.maintenanceSgdPerYear)}</Figure>} />
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---------------------------------------------------------------- Payback */}
      <div className="grid items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          titleId="payback-title"
          title="When it pays back"
          description="Months to earn back the phase-1 one-off from net hard savings. The middle column drops the regional consolidation hours, as a stress test."
          flush
        >
          <div className="scrollbar-thin relative overflow-x-auto">
            <table className={cn(T.table, "min-w-[640px]")}>
              <thead>
                <tr className={T.headRow}>
                  <th className={T.head}>Requests a month</th>
                  <th className={cn(T.head, "text-right")}>Hours a year</th>
                  <th className={cn(T.head, "text-right")}>Net a year</th>
                  <th className={cn(T.head, "text-right")}>Payback, phase 1</th>
                  <th className={cn(T.head, "text-right")}>Workflow hours only</th>
                  <th className={cn(T.head, "text-right")}>3-year net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const active = r.requestsPerMonth === volume;
                  return (
                    <tr key={r.requestsPerMonth} aria-current={active ? "true" : undefined} className={cn(T.row, active && "bg-secondary")}>
                      <td className={cn(T.cell, "font-medium text-foreground")}>
                        <span className="num">{r.requestsPerMonth}</span>
                        {r.requestsPerMonth === BASE_VOLUME ? <span className="ml-2 text-xs text-muted-foreground">base case</span> : null}
                        {!VOLUME_PRESETS.includes(r.requestsPerMonth as 40 | 80 | 120) ? <span className="ml-2 text-xs text-muted-foreground">your pick</span> : null}
                      </td>
                      <td className={cn(T.cell, "text-right")}>
                        <Figure formula={`(${one(r.workflowHoursPerMonth)} + 40) × 12`}>{int(r.hoursPerYear)}</Figure>
                      </td>
                      <td className={cn(T.cell, "text-right")}>
                        <Figure formula={`${int(r.hoursPerYear)} h × S$50 − ${formatSgd(run)} run cost`}>{formatSgd(r.netSgdPerYear)}</Figure>
                      </td>
                      <td className={cn(T.cell, "text-right font-semibold text-foreground")}>
                        <Figure formula={`${formatSgd(oneOff)} ÷ (${formatSgd(r.netSgdPerYear)} ÷ 12)`}>{months(r.paybackMonths)}</Figure>
                      </td>
                      <td className={cn(T.cell, "text-right text-muted-foreground")}>
                        <Figure formula="Same, without the 40 h/month of regional consolidation (A21)">{months(r.paybackWorkflowOnlyMonths)}</Figure>
                      </td>
                      <td className={cn(T.cell, "text-right")}>
                        <Figure formula={`3 × ${formatSgd(r.netSgdPerYear)} − ${formatSgd(oneOff)}`}>{formatSgd(r.threeYearNetSgd, { compact: true })}</Figure>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          as="aside"
          titleId="sl-title"
          title="Why automatic SAP posting is not in v1"
          level={3}
          action={<Phase2Badge />}
          footer={<span className="text-sm font-medium text-foreground">Phase 2 is justified by speed (same-day posting) or scale, not hours. We decide after the pilot.</span>}
        >
          <p className="text-sm text-secondary-foreground">
            Posting straight to SAP B1 through the Service Layer only removes the import step MDM already does in minutes.
          </p>
          <dl className="mt-3 divide-y divide-border text-sm">
            <CalcLine label={`Time saved at ${volume} requests`} value={<Figure formula={`${volume} × 0.15 h per import`}>{one(p2.hoursSavedPerMonth)} h a month</Figure>} />
            <CalcLine label="Worth" value={<Figure formula={`${one(p2.hoursSavedPerMonth)} h × 12 × S$50`}>{formatSgd(p2.savingSgdPerYear)} a year</Figure>} />
            <CalcLine label="Less licences + maintenance" value={<Figure formula={`${SOURCES.licences} Maintenance 15% of ${formatSgd(I.sapPartnerSgd)}.`}>−{formatSgd(p2.licencesSgdPerYear + p2.maintenanceSgdPerYear)}</Figure>} />
            <CalcLine label="Net" value={<span className="num font-semibold">{formatSgd(p2.netWithProcessSgdPerYear)} a year</span>} />
            <CalcLine
              label={`Payback on ${formatSgd(I.sapPartnerSgd)}`}
              value={<Figure formula={`${formatSgd(I.sapPartnerSgd)} ÷ ${formatSgd(p2.netWithProcessSgdPerYear)}`} className="font-semibold text-phase2-ink">{years(p2.paybackYearsProcess)}</Figure>}
            />
            <CalcLine label="With pay-as-you-go runs" value={<Figure formula={SOURCES.payg}>{years(p2.paybackYearsPayg)}</Figure>} />
            <CalcLine label="At 120 requests, Process licence" value={<Figure formula="120 × 0.15 h × 12 × S$50 − licences − maintenance">{years(p2At120.paybackYearsProcess)}</Figure>} />
          </dl>
        </Panel>
      </div>

      {/* ---------------------------------------------------------------- Waterfall */}
      <section aria-labelledby="amy-title">
        <SectionHeading
          id="amy-title"
          title="Where the time goes, and what fixes it"
          subtitle="Amy needed one new item code. It took eighteen days, a bounced request and three approvers one at a time — and her sales order still failed."
        />
        <AmyWaterfall />
        <p className="mt-3 max-w-[110ch] text-sm text-muted-foreground">
          The biggest single saving is a policy decision: let the three approvers decide at the same time, with a 2-business-day SLA and reminders. That
          is {wf.processSavedDays} of the {wf.savedDays} days, ≈{Math.round(wf.processShare * 100)}% of the saving, and needs no new software.
        </p>
      </section>

      {/* ---------------------------------------------------------------- Alternatives */}
      <Panel
        titleId="alt-title"
        title="Why this, and not something else"
        description="Six ways to fix master-data requests, scored on what the brief asks for."
        flush
        footer="SAP Learning: B1 approval procedures can be set up for sales, purchasing, inventory and payment documents. Legend: ✓ yes · ~ partly · ✗ no · – not applicable."
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className={cn(T.table, "min-w-[980px]")}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.head}>Option</th>
                <th className={cn(T.head, "px-3")}>One-off cost</th>
                <th className={cn(T.head, "px-2 text-center whitespace-normal")}>Stops incomplete</th>
                <th className={cn(T.head, "px-2 text-center whitespace-normal")}>Stops duplicates</th>
                <th className={cn(T.head, "px-2 text-center whitespace-normal")}>Fast, visible approvals</th>
                <th className={cn(T.head, "px-2 text-center whitespace-normal")}>MDM changes it without IT</th>
                <th className={cn(T.head, "px-2 text-center whitespace-normal")}>Regional analytics</th>
                <th className={T.head}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ALTERNATIVES.map((a) => (
                <tr key={a.id} aria-current={a.chosen ? "true" : undefined} className={cn(T.row, a.chosen && "bg-secondary")}>
                  <td className={cn(T.cell, "align-middle", a.chosen ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                    {a.option}
                  </td>
                  <td className={cn(T.cell, "px-3 align-middle text-secondary-foreground")}>{a.oneOff}</td>
                  <td className={cn(T.cell, "px-2 text-center align-middle")}><MarkCell mark={a.stopsIncomplete} /></td>
                  <td className={cn(T.cell, "px-2 text-center align-middle")}><MarkCell mark={a.stopsDuplicates} /></td>
                  <td className={cn(T.cell, "px-2 text-center align-middle")}><MarkCell mark={a.fastVisibleApprovals} /></td>
                  <td className={cn(T.cell, "px-2 text-center align-middle")}><MarkCell mark={a.mdmChangesWithoutIt} /></td>
                  <td className={cn(T.cell, "px-2 text-center align-middle")}><MarkCell mark={a.regionalAnalytics} /></td>
                  <td className={cn(T.cell, "max-w-[340px] align-middle", a.chosen ? "font-medium text-foreground" : "text-secondary-foreground")}>{a.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ---------------------------------------------------------------- Adoption, pilot, KPIs */}
      <section aria-labelledby="adopt-title">
        <SectionHeading id="adopt-title" title="Getting people off email" subtitle="A 6-week pilot with clear numbers to hit, and a rule for when to stop." />
        <div className="panel overflow-hidden">
          <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">The pilot</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <PilotLine k="Length" v="6 weeks" />
                <PilotLine k="Countries" v="Singapore and Malaysia" />
                <PilotLine k="Request types" v="Customer and Item" />
                <PilotLine k="Business units" v="SPD and QTS" />
                <PilotLine k="Cash cost" v="The contractor only; the rest is internal time" />
              </dl>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">What we measure</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <KpiLine target="≥90%" what="of requests come through OneRecord by week 6" />
                <KpiLine target="≤4 business days" what="median setup time (baseline 14 calendar days)" />
                <KpiLine target="<15%" what="of requests bounced (baseline 40%)" />
                <KpiLine target="Count" what="duplicates caught at intake" />
                <KpiLine target="Trend" what="S$ of customer orders stuck behind setup" />
              </ul>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Week-6 decision</h3>
              <ul className="mt-3 divide-y divide-border text-sm">
                <DecisionLine tone="ok" lead="Scale" text="KPIs met → add Thailand, Vietnam and Myanmar, then Vendor and Cost centre." />
                <DecisionLine tone="stuck" lead="Fix or stop" text="Median above 6 business days, or adoption under 70%." />
              </ul>
            </div>
          </div>
          <div className="border-t border-border">
            <h3 className="px-4 pt-3.5 text-sm font-semibold text-foreground">How requestors and approvers stop using email</h3>
            <ul className="grid text-sm sm:grid-cols-2 xl:grid-cols-3">
              <AdoptionItem title="One front door" text="After 4 weeks the MDM mailbox auto-replies with the form link." />
              <AdoptionItem title="One-click approvals" text="Approve or reject from a Teams card or an Outlook email." />
              <AdoptionItem title="Visible status" text="Everyone sees where a request is, so nobody chases." />
              <AdoptionItem title="A champion per entity and country" text="A named person to ask, close to the requestor." />
              <AdoptionItem title="30-minute onboarding" text="Short sessions per team, recorded for new joiners." />
              <AdoptionItem title="Weekly SLA scoreboard" text="Shared with BU heads: who decided on time." />
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- EDGE */}
      <Panel titleId="edge-title" title="Upside, not in the base case" action={<NoteChip tone="warn">Only if Lives qualifies as an SME</NoteChip>}>
        <p className="max-w-[110ch] text-sm leading-relaxed text-secondary-foreground">
          An EDGE grant could cover{" "}
          <Figure formula={`50% × (contractor ${formatSgd(I.contractorSgd)} + SAP partner ${formatSgd(I.sapPartnerSgd)}) = ${formatSgd(edge.grantSgd)}. ${SOURCES.edge}`}>
            ≈{formatSgd(edge.grantSgd, { compact: true })}
          </Figure>{" "}
          of third-party costs, within the S$30k digital sub-cap. The EIS 400% deduction on qualifying AI spend (YA2027–28) may also apply. Approver time
          (S$85–110/h) is not counted anywhere above.
        </p>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

interface BenefitRow {
  label: string;
  value: ReactNode;
  strong?: boolean;
  /** Ink of the value when it carries state (e.g. money waiting) */
  className?: string;
}

/**
 * One column of the benefits panel. The three columns share one panel and line up on a subgrid (head, rows,
 * foot), separated by hairlines. State is a square before the title: green = counts towards payback,
 * coral = money waiting, grey = real but not in payback. No rails.
 */
function BenefitColumn({
  title,
  note,
  tone,
  rows,
  marker,
  footer,
}: {
  title: string;
  note: string;
  tone: StateTone;
  rows: BenefitRow[];
  marker?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="flex flex-col border-border not-first:border-t lg:row-span-3 lg:grid lg:grid-rows-subgrid lg:not-first:border-t-0 lg:not-first:border-l">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="panel-title flex items-center gap-2">
            <StateGlyph tone={tone} />
            {title}
          </h3>
          <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{note}</p>
        </div>
        {marker ? <div className="pt-0.5">{marker}</div> : null}
      </header>
      <dl className="flex-1 divide-y divide-border">
        {rows.map((r) => (
          <div key={r.label} className="flex min-h-10 items-baseline justify-between gap-4 px-4 py-2.5">
            <dt className={cn("text-sm", r.strong ? "font-medium text-foreground" : "text-secondary-foreground")}>{r.label}</dt>
            <dd
              className={cn(
                "num text-right text-sm",
                r.strong ? "font-wide text-base font-semibold" : "font-medium",
                r.className ?? "text-foreground",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {footer ? <p className="border-t border-border px-4 py-2.5 text-xs leading-5 text-muted-foreground">{footer}</p> : <span aria-hidden />}
    </section>
  );
}

function OpportunityColumn() {
  const hydrated = useHasHydrated();
  const stuck = useStuckDemand();
  const live = (node: ReactNode) => (hydrated ? node : <Skeleton className="inline-block h-4 w-20 align-middle" />);
  const t = signals?.totals;
  const a = signals?.assumptions;
  const rows: BenefitRow[] = [
    {
      label: `Customer orders stuck behind setup (${hydrated ? stuck.count : "…"} PRs)`,
      value: live(
        <Figure formula="Live from this sandbox: Σ value of open customer PRs blocked by a pending MDM request. Drops the moment a record is created in SAP B1.">
          {formatSgd(stuck.totalSgd)}
        </Figure>,
      ),
      strong: true,
      className: "text-stuck",
    },
    {
      label: "Of which could walk away",
      value: live(<Figure formula={`${formatSgd(stuck.totalSgd)} × 10%. ${SOURCES.a24}`}>{formatSgd(revenueAtRiskSgd(stuck.totalSgd))}</Figure>),
    },
  ];
  if (t && a) {
    rows.push(
      {
        label: "Accounts dropping off",
        value: (
          <Figure formula={`Trailing-12-month value of flagged accounts, at risk before any save. Assumed save rate ${Math.round(a.dropOffSaveRate * 100)}%. From signals.json.`}>
            {millions(t.dropOffAddressableSgd)} at risk, before save rate
          </Figure>
        ),
      },
      {
        label: "Cross-sell gaps",
        value: (
          <Figure formula={`Σ peer-gap value, addressable before conversion. Assumed conversion ${Math.round(a.crossSellConversion * 100)}%. From signals.json.`}>
            {millions(t.crossSellAddressableSgd)} addressable, before conversion
          </Figure>
        ),
      },
    );
  }
  return (
    <BenefitColumn
      title="Opportunity: money in view"
      note="Never added to payback or to one revenue figure"
      tone="stuck"
      marker={<IllustrativeMarker />}
      rows={rows}
      footer="Stuck demand is mostly delayed revenue, not lost revenue. Drop-off and cross-sell are addressable before conversion."
    />
  );
}

/** A group heading inside the cost table: semibold label and its quiet qualifier, a stronger hairline above. No fill. */
function CostGroupRow({ label, badge }: { label: string; badge?: ReactNode }) {
  return (
    <tr className="border-b border-border not-first:border-t not-first:border-t-border-strong">
      <td colSpan={4} className="px-4 pt-4 pb-2">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
          {label}
          {badge}
        </span>
      </td>
    </tr>
  );
}

function CostRow({
  item,
  who,
  oneOff,
  yearly,
  strong,
}: {
  item: string;
  who: string;
  oneOff?: ReactNode;
  yearly?: ReactNode;
  strong?: boolean;
}) {
  return (
    <tr className={cn(T.row, strong && "border-t border-t-border-strong font-semibold")}>
      <td className={cn(T.cell, "text-foreground")}>{item}</td>
      <td className={cn(T.cell, "text-secondary-foreground")}>{who}</td>
      <td className={cn(T.cell, "text-right text-foreground")}>{oneOff ?? <span className="text-subtle">—</span>}</td>
      <td className={cn(T.cell, "text-right text-foreground")}>{yearly ?? <span className="text-subtle">—</span>}</td>
    </tr>
  );
}

function CalcLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-secondary-foreground">{label}</dt>
      <dd className="num text-right text-foreground">{value}</dd>
    </div>
  );
}

function DecisionLine({ tone, lead, text }: { tone: StateTone; lead: string; text: string }) {
  return (
    <li className="flex gap-3 py-2.5 first:pt-0">
      <StateGlyph tone={tone} className="mt-1.5" />
      <span className="min-w-0">
        <span className={cn("block font-semibold", tone === "ok" ? "text-ok-ink" : "text-stuck-ink")}>{lead}</span>
        <span className="text-foreground">{text}</span>
      </span>
    </li>
  );
}

function PilotLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}

function KpiLine({ target, what }: { target: string; what: string }) {
  return (
    <li className="grid grid-cols-[7.5rem_1fr] gap-2">
      <span className="num font-semibold text-foreground">{target}</span>
      <span className="text-secondary-foreground">{what}</span>
    </li>
  );
}

function AdoptionItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="px-4 py-3">
      <span className="block font-medium text-foreground">{title}</span>
      <span className="text-secondary-foreground">{text}</span>
    </li>
  );
}
