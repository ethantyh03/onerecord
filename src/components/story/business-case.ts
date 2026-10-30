/**
 * Tesseract business case (final model §6), as pure functions.
 *
 * Every number on /impact comes from here. Inputs are the §6.1 table (A12, A13, A19–A26 plus the research log);
 * change an input and every derived figure follows. Hard benefit = capacity released (hours × loaded rate).
 * Soft benefit and opportunity are reported separately and are NEVER summed into payback.
 */

export interface BusinessCaseInputs {
  /** Loaded cost per hour for analysts, requestors and MDM (approver time is not counted). */
  hourlyRateSgd: number;
  /** Customer requests as a share of all requests (35 of 80). */
  customerShare: number;
  /** Requests bounced back for missing information today (A13). */
  bounceRate: number;
  /** Duplicate rate on new customer records (A13). */
  duplicateRate: number;
  /** A19 components, hours saved per request. */
  reworkHoursPerBounce: number;
  forwardingChasingHours: number;
  manualKeyingHours: number;
  /** A20: rework hours per duplicate customer that slips through, and the share caught at intake. */
  duplicateReworkHours: number;
  duplicateInterceptRate: number;
  /** A21: regional consolidation, hours per month (5 country analysts × 1 day). */
  regionalHoursPerMonth: number;
  /** A22: phase-1 one-off components (S$). */
  leanTeamSgd: number;
  contractorSgd: number;
  mdmConfigSgd: number;
  onboardingSgd: number;
  /** A22: phase-1 run cost as a share of the one-off, per year. */
  runCostRate: number;
  /** A23: phase-2 SAP partner one-off (S$). */
  sapPartnerSgd: number;
  /** Phase-2 licences: Process (USD 150/mo) + 1 Premium maker (USD 15/mo), per year in USD. */
  phase2LicencesUsdPerYear: number;
  /** Phase-2 maintenance as a share of the partner one-off, per year. */
  phase2MaintenanceRate: number;
  /** Phase-2 pay-as-you-go price per premium flow run (USD, preview). */
  paygUsdPerRun: number;
  /** Phase 2 only removes the DTW load step: hours per request. */
  dtwLoadHoursPerRequest: number;
  /** A25: S$ per USD. */
  fxSgdPerUsd: number;
  /** A24: share of stuck demand assumed lost for good (opportunity column only). */
  leakRate: number;
  /** A26: baseline median cycle time, calendar days. */
  baselineMedianDays: number;
  /** Target median, calendar days (≤4 business days ≈ 6 calendar days). */
  targetCalendarDays: number;
  /** Working hours per FTE-year (research log). */
  hoursPerFte: number;
  /** EDGE grant share of third-party costs (SME) and the digital sub-cap. */
  edgeRate: number;
  edgeDigitalSubCapSgd: number;
}

export const BASE_INPUTS: BusinessCaseInputs = {
  hourlyRateSgd: 50,
  customerShare: 35 / 80,
  bounceRate: 0.4,
  duplicateRate: 0.06,
  reworkHoursPerBounce: 1.0,
  forwardingChasingHours: 0.5,
  manualKeyingHours: 0.35,
  duplicateReworkHours: 4,
  duplicateInterceptRate: 0.7,
  regionalHoursPerMonth: 40,
  leanTeamSgd: 24_000,
  contractorSgd: 9_750,
  mdmConfigSgd: 2_400,
  onboardingSgd: 3_750,
  runCostRate: 0.15,
  sapPartnerSgd: 22_500,
  phase2LicencesUsdPerYear: 1_980,
  phase2MaintenanceRate: 0.15,
  paygUsdPerRun: 0.6,
  dtwLoadHoursPerRequest: 0.15,
  fxSgdPerUsd: 1.33,
  leakRate: 0.1,
  baselineMedianDays: 14,
  targetCalendarDays: 6,
  hoursPerFte: 1_872,
  edgeRate: 0.5,
  edgeDigitalSubCapSgd: 30_000,
};

export const VOLUME_PRESETS = [40, 80, 120] as const;
export const BASE_VOLUME = 80;
export const VOLUME_MIN = 20;
export const VOLUME_MAX = 200;

/** A19: hours saved per request = rework (bounce rate × rework hours) + forwarding/chasing + manual keying. */
export function hoursSavedPerRequest(i: BusinessCaseInputs = BASE_INPUTS): number {
  return i.bounceRate * i.reworkHoursPerBounce + i.forwardingChasingHours + i.manualKeyingHours;
}

/** Duplicate customer records stopped at intake, per month. */
export function duplicatesStoppedPerMonth(requestsPerMonth: number, i: BusinessCaseInputs = BASE_INPUTS): number {
  return requestsPerMonth * i.customerShare * i.duplicateRate * i.duplicateInterceptRate;
}

/** Workflow hours released per month: per-request saving + duplicate rework avoided. */
export function workflowHoursPerMonth(requestsPerMonth: number, i: BusinessCaseInputs = BASE_INPUTS): number {
  return requestsPerMonth * hoursSavedPerRequest(i) + duplicatesStoppedPerMonth(requestsPerMonth, i) * i.duplicateReworkHours;
}

export function phase1OneOffSgd(i: BusinessCaseInputs = BASE_INPUTS): number {
  return i.leanTeamSgd + i.contractorSgd + i.mdmConfigSgd + i.onboardingSgd;
}

export function phase1RunCostSgd(i: BusinessCaseInputs = BASE_INPUTS): number {
  return phase1OneOffSgd(i) * i.runCostRate;
}

export interface BusinessCase {
  requestsPerMonth: number;
  hoursSavedPerRequest: number;
  workflowHoursPerMonth: number;
  regionalHoursPerMonth: number;
  hoursPerYear: number;
  fte: number;
  grossSgdPerYear: number;
  runCostSgdPerYear: number;
  netSgdPerYear: number;
  duplicatesStoppedPerYear: number;
  phase1OneOffSgd: number;
  /** Months to recover the phase-1 one-off from net hard savings. */
  paybackMonths: number;
  /** Same, counting workflow hours only (no regional consolidation, A21). */
  paybackWorkflowOnlyMonths: number;
  threeYearNetSgd: number;
  /** Soft: request-days per month in which customers can be invoiced sooner. */
  requestDaysReturnedPerMonth: number;
}

function paybackMonthsFor(oneOff: number, netPerYear: number): number {
  return netPerYear > 0 ? oneOff / (netPerYear / 12) : Number.POSITIVE_INFINITY;
}

/** The hard business case at a given request volume. */
export function computeBusinessCase(requestsPerMonth: number, i: BusinessCaseInputs = BASE_INPUTS): BusinessCase {
  const v = Math.max(0, requestsPerMonth);
  const wf = workflowHoursPerMonth(v, i);
  const hoursPerYear = (wf + i.regionalHoursPerMonth) * 12;
  const gross = hoursPerYear * i.hourlyRateSgd;
  const run = phase1RunCostSgd(i);
  const net = gross - run;
  const oneOff = phase1OneOffSgd(i);
  const wfOnlyNet = wf * 12 * i.hourlyRateSgd - run;
  return {
    requestsPerMonth: v,
    hoursSavedPerRequest: hoursSavedPerRequest(i),
    workflowHoursPerMonth: wf,
    regionalHoursPerMonth: i.regionalHoursPerMonth,
    hoursPerYear,
    fte: hoursPerYear / i.hoursPerFte,
    grossSgdPerYear: gross,
    runCostSgdPerYear: run,
    netSgdPerYear: net,
    duplicatesStoppedPerYear: duplicatesStoppedPerMonth(v, i) * 12,
    phase1OneOffSgd: oneOff,
    paybackMonths: paybackMonthsFor(oneOff, net),
    paybackWorkflowOnlyMonths: paybackMonthsFor(oneOff, wfOnlyNet),
    threeYearNetSgd: net * 3 - oneOff,
    requestDaysReturnedPerMonth: v * (i.baselineMedianDays - i.targetCalendarDays),
  };
}

export interface Phase2Case {
  requestsPerMonth: number;
  hoursSavedPerMonth: number;
  savingSgdPerYear: number;
  oneOffSgd: number;
  licencesSgdPerYear: number;
  maintenanceSgdPerYear: number;
  netWithProcessSgdPerYear: number;
  paybackYearsProcess: number;
  paygSgdPerYear: number;
  netWithPaygSgdPerYear: number;
  paybackYearsPayg: number;
}

/** §6.6: what automatic SAP posting (Service Layer) would actually save — only the DTW load step. */
export function computePhase2Case(requestsPerMonth: number, i: BusinessCaseInputs = BASE_INPUTS): Phase2Case {
  const v = Math.max(0, requestsPerMonth);
  const hours = v * i.dtwLoadHoursPerRequest;
  const saving = hours * 12 * i.hourlyRateSgd;
  const licences = i.phase2LicencesUsdPerYear * i.fxSgdPerUsd;
  const maintenance = i.sapPartnerSgd * i.phase2MaintenanceRate;
  const payg = v * 12 * i.paygUsdPerRun * i.fxSgdPerUsd;
  const netProcess = saving - licences - maintenance;
  const netPayg = saving - payg - maintenance;
  const years = (net: number) => (net > 0 ? i.sapPartnerSgd / net : Number.POSITIVE_INFINITY);
  return {
    requestsPerMonth: v,
    hoursSavedPerMonth: hours,
    savingSgdPerYear: saving,
    oneOffSgd: i.sapPartnerSgd,
    licencesSgdPerYear: licences,
    maintenanceSgdPerYear: maintenance,
    netWithProcessSgdPerYear: netProcess,
    paybackYearsProcess: years(netProcess),
    paygSgdPerYear: payg,
    netWithPaygSgdPerYear: netPayg,
    paybackYearsPayg: years(netPayg),
  };
}

/** EDGE upside (not in the base case): share of third-party costs, capped at the digital sub-cap. */
export function edgeGrantSgd(i: BusinessCaseInputs = BASE_INPUTS): { thirdPartySgd: number; grantSgd: number } {
  const thirdParty = i.contractorSgd + i.sapPartnerSgd;
  return { thirdPartySgd: thirdParty, grantSgd: Math.min(thirdParty * i.edgeRate, i.edgeDigitalSubCapSgd) };
}

/** Opportunity (illustrative): revenue at risk if A24's leak rate applied to today's stuck demand. */
export function revenueAtRiskSgd(stuckDemandSgd: number, i: BusinessCaseInputs = BASE_INPUTS): number {
  return Math.max(0, stuckDemandSgd) * i.leakRate;
}

// ---------------------------------------------------------------------------------------------
// §6.7 Where 18 days go: one new item request by email (illustrative breakdown)

export type FixKind = "tooling" | "process";

export interface WaterfallSlice {
  id: string;
  label: string;
  beforeDays: number;
  afterDays: number;
  fix: string;
  kind: FixKind;
}

export const AMY_WATERFALL: WaterfallSlice[] = [
  {
    id: "notice",
    label: "Waiting for MDM to notice the email",
    beforeDays: 2,
    afterDays: 0,
    fix: "The form goes straight into routing",
    kind: "tooling",
  },
  {
    id: "bounce",
    label: "Bounced for the missing QA/RA field, plus travel delay",
    beforeDays: 5,
    afterDays: 0,
    fix: "Completeness gate and the IVD rule",
    kind: "tooling",
  },
  {
    id: "sequential",
    label: "Three approvers one at a time (~3 days each)",
    beforeDays: 9,
    afterDays: 3,
    fix: "Approve in parallel, 2-business-day SLA, reminders",
    kind: "process",
  },
  {
    id: "keying",
    label: "MDM queue and keying into SAP by hand",
    beforeDays: 2,
    afterDays: 1,
    fix: "SAP import file built from the approved request",
    kind: "tooling",
  },
];

export function waterfallTotals(slices: WaterfallSlice[] = AMY_WATERFALL): {
  beforeDays: number;
  afterDays: number;
  savedDays: number;
  processSavedDays: number;
  toolingSavedDays: number;
  processShare: number;
} {
  let before = 0;
  let after = 0;
  let process = 0;
  for (const s of slices) {
    before += s.beforeDays;
    after += s.afterDays;
    if (s.kind === "process") process += s.beforeDays - s.afterDays;
  }
  const saved = before - after;
  return {
    beforeDays: before,
    afterDays: after,
    savedDays: saved,
    processSavedDays: process,
    toolingSavedDays: saved - process,
    processShare: saved > 0 ? process / saved : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// §6.9 Alternatives

export type Mark = "yes" | "partly" | "no" | "na";

export interface Alternative {
  id: string;
  option: string;
  oneOff: string;
  stopsIncomplete: Mark;
  stopsDuplicates: Mark;
  fastVisibleApprovals: Mark;
  mdmChangesWithoutIt: Mark;
  regionalAnalytics: Mark;
  verdict: string;
  chosen?: boolean;
}

export const ALTERNATIVES: Alternative[] = [
  {
    id: "status-quo",
    option: "Status quo + better email template + shared tracker",
    oneOff: "~S$0",
    stopsIncomplete: "partly",
    stopsDuplicates: "no",
    fastVisibleApprovals: "no",
    mdmChangesWithoutIt: "yes",
    regionalAnalytics: "no",
    verdict: "Doesn't fix noticing or chasing",
  },
  {
    id: "sap-approvals",
    option: "SAP B1 approval procedures",
    oneOff: "S$0",
    stopsIncomplete: "no",
    stopsDuplicates: "no",
    fastVisibleApprovals: "na",
    mdmChangesWithoutIt: "na",
    regionalAnalytics: "no",
    verdict:
      "Built-in approvals are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests",
  },
  {
    id: "teams-approvals",
    option: "Teams Approvals templates only",
    oneOff: "~S$0",
    stopsIncomplete: "partly",
    stopsDuplicates: "no",
    fastVisibleApprovals: "yes",
    mdmChangesWithoutIt: "yes",
    regionalAnalytics: "no",
    verdict: "A good zero-build first step; no duplicate check, no SAP-ready output",
  },
  {
    id: "power-platform",
    option: "Forms / Power Apps + SharePoint + Power Automate only",
    oneOff: "~S$30k",
    stopsIncomplete: "yes",
    stopsDuplicates: "partly",
    fastVisibleApprovals: "yes",
    mdmChangesWithoutIt: "yes",
    regionalAnalytics: "no",
    verdict: "Fixes the workflow (exact-match duplicates only), but the regional numbers stay dirty",
  },
  {
    id: "mdm-suite",
    option: "Buy an MDM suite or SAP B1 add-on",
    oneOff: "High (enterprise pricing, not verified) + IT",
    stopsIncomplete: "yes",
    stopsDuplicates: "yes",
    fastVisibleApprovals: "yes",
    mdmChangesWithoutIt: "partly",
    regionalAnalytics: "partly",
    verdict: "Over-sized for ~80 requests a month",
  },
  {
    id: "onerecord",
    option: "Tesseract (Microsoft 365 workflow + small data-science layer + SAP import file)",
    oneOff: "~S$40k, no new licences for the workflow (phase 1); Power BI Pro only if not owned",
    stopsIncomplete: "yes",
    stopsDuplicates: "yes",
    fastVisibleApprovals: "yes",
    mdmChangesWithoutIt: "yes",
    regionalAnalytics: "yes",
    verdict: "Chosen: fuzzy + tax-ID duplicate check, parallel approvals with SLA, stuck demand and a de-duplicated forecast",
    chosen: true,
  },
];

// ---------------------------------------------------------------------------------------------
// Sources shown on hover

export const SOURCES = {
  rate: "S$50/h loaded cost: MOM Occupational Wage Survey 2025 median + 1.8-month AVC + 17% CPF ÷ 1,872 h (derived). Approver time is not counted.",
  volume: "A12 (illustrative): 40 / 80 / 120 requests a month, base case 80; 35 of 80 are customers.",
  a19: "A19 (team estimate): 1.25 h per request = rework 0.40 (40% bounce × 1.0 h) + forwarding and chasing 0.50 + keying vs import file 0.35.",
  a20: "A20 (team estimate): 6% of new customer records are duplicates (A13); 70% caught at intake; 4 h rework each (1-10-100 data-quality heuristic).",
  a21: "A21 (team estimate): 5 country analysts × 1 day a month of manual consolidation = 40 h/month.",
  a22: "A22: lean team 2 × 6 weeks × 40 h × S$50 = S$24,000; contractor 15 days × S$650 = S$9,750; MDM config 48 h = S$2,400; onboarding 150 people × 0.5 h = S$3,750. Day rate is the upper end of S$450–650 (low confidence).",
  run: "Run cost 15% of the one-off per year (research range 15–25%).",
  a23: "A23 (low confidence): SAP partner 15 days × S$1,500/day, derived from a US$150–350/h global proxy.",
  licences: "Process licence USD 150/month + 1 Premium maker USD 15/month = USD 1,980/yr × 1.33 (A25). Microsoft list pricing.",
  payg: "Pay-as-you-go USD 0.60 per premium flow run (preview); cheaper than a Process licence below 250 runs a month.",
  a24: "A24 (assumption): 10% of stuck demand leaks away. Opportunity column only, never in payback.",
  a26: "A26: baseline median 14 calendar days for an email request (example new item: 18).",
  apqc: "APQC Open Standards Benchmarking: median 3.0 calendar days to set up a supplier (3,047 organisations).",
  edge: "EDGE (EnterpriseSG, from 30 Sep 2026): up to 50% of third-party costs for SMEs, S$30k digital sub-cap. Applies only if Lives Group qualifies as an SME on the turnover test.",
  fte: "1,872 working hours per FTE-year.",
} as const;
