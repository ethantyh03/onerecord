/**
 * OneRecord analytics → app JSON contract (owned by the data-science lane).
 *
 * Every JSON file in src/data/ is produced by analytics/ (Python, seed 42) and imported here with a type.
 * Screens import the typed constants from "@/data/contract", never the raw JSON.
 * Mock files carry `isMock: true`; the real pipeline overwrites them with the same shapes.
 *
 * Conventions
 * - Month = "YYYY-MM". Window = Oct 2025–Sep 2026; prior = Oct 2024–Sep 2025; history Oct 2023–Sep 2026.
 * - SGD values are whole dollars. Ratios (yoy, wape, bias, precision…) are fractions (0.123 = 12.3%).
 * - "dedup" view = golden IDs (de-duplicated + re-attributed). "raw" view = SAP records as recorded.
 * - yoy / momentum are null when the prior period is 0.
 */
import type { CountryCode, CustomerMaster, EntityCode, ItemMaster, MessageKind, ProductGroup } from "@/lib/types";

import metaJson from "./meta.json";
import masterJson from "./master.json";
import matrixJson from "./matrix.json";
import streamsJson from "./streams.json";
import bridgeJson from "./bridge.json";
import backtestJson from "./backtest.json";
import stressJson from "./stress.json";
import cleanxmethodJson from "./cleanxmethod.json";
import matcherEvalJson from "./matcher_eval.json";
import signalsJson from "./signals.json";
import actionsJson from "./actions.json";
import triageEvalJson from "./triage_eval.json";
import inboxJson from "./inbox.json";
import summaryJson from "./summary.json";
import dedupJson from "./dedup.json";

export type Month = string; // "2026-09"
export type ViewKey = "raw" | "dedup";

// ---------------------------------------------------------------- meta.json
export interface AnalyticsWindow {
  label: string; // "Oct 2025 – Sep 2026"
  start: Month; // "2025-10"
  end: Month; // "2026-09"
  priorStart: Month; // "2024-10"
  priorEnd: Month; // "2025-09"
  momentumStart: Month; // "2026-07"
  momentumEnd: Month; // "2026-09"
  historyStart: Month; // "2023-10"
  historyEnd: Month; // "2026-09"
  forecastStart: Month; // "2026-10"
  forecastEnd: Month; // "2026-12"
}
export interface FxRate {
  country: CountryCode;
  currency: string; // "MYR"
  sgdPerUnit: number; // fixed illustrative rate (A4)
}
export interface ModelCard {
  purpose: string;
  intendedUse: string;
  notIntendedFor: string[];
  methods: { name: string; detail: string }[];
  limitations: string[];
}
export interface DataHonestyItem {
  item: string;
  status: "synthetic" | "assumption" | "validated" | "needs_pilot";
  detail: string;
}
export interface PlantedPattern {
  id: string;
  name: string;
  description: string;
  source: string; // research / brief source
  assertion: string; // what the generator asserts
}
export interface SapPilotMapping {
  sapTable: string; // "ORDR / RDR1"
  sapDescription: string;
  feeds: string; // "Purchase orders (volume)"
  ourFile: string; // "pos.csv"
  keyFields: string[];
}
export interface Meta {
  isMock: boolean;
  generatedAt: string; // ISO
  seed: number;
  synthetic: true;
  generator: string;
  window: AnalyticsWindow;
  growthFormula: string; // print verbatim
  momentumFormula: string;
  wapeFormula: string;
  biasFormula: string;
  seasonalityNote: string;
  currency: "SGD";
  fx: FxRate[];
  params: Record<string, string | number | boolean>;
  modelCard: ModelCard;
  dataHonesty: DataHonestyItem[];
  plantedPatterns: PlantedPattern[];
  validatedVsPilot: { validatedHere: string[]; needsPilot: string[] };
  pilotPlan: { summary: string; weeks: number; scope: string; sapMapping: SapPilotMapping[]; steps: string[] };
  assumptions: { id: string; text: string }[];
}

// ---------------------------------------------------------------- master.json
export interface MasterData {
  isMock: boolean;
  /** ~300 SAP customer records incl. planted duplicates (same goldenId). Includes pinned NUH C-SG-00017 (hasTransactions false). */
  customers: CustomerMaster[];
  /** ~120 items. Two TH rapid tests are deliberately recorded as Product B (see dedup.miscategorisation). */
  items: ItemMaster[];
}

// ---------------------------------------------------------------- matrix.json
export interface MonthValue {
  month: Month;
  sgd: number;
}
export interface MonthValueUnits extends MonthValue {
  units: number;
}
export interface MatrixCell {
  country: CountryCode;
  product: ProductGroup;
  sgd12m: number;
  sgdPrior12m: number;
  yoy: number | null; // headline growth (SGD)
  units12m: number;
  unitsPrior12m: number;
  unitsYoy: number | null; // within-product growth (units)
  sgd3m: number; // Jul–Sep 2026
  sgdPrior3m: number; // Jul–Sep 2025
  momentum: number | null; // 3M YoY (SGD)
  momentumUnits: number | null;
  series: MonthValueUnits[]; // 24 months Oct 2024–Sep 2026
  /** dedup.sgd12m − raw.sgd12m for this cell (0 in the raw view). Non-zero ⇒ show the Δ badge. */
  deltaVsRaw: number;
  changedByCleaning: boolean;
}
export interface MatrixTotal {
  key: string; // country code, product group, or "ALL"
  sgd12m: number;
  sgdPrior12m: number;
  yoy: number | null;
  momentum: number | null;
  units12m?: number; // product totals only
  series: MonthValue[]; // 24 months
}
export interface MatrixView {
  cells: MatrixCell[]; // 15 = 5 countries × 3 products
  countryTotals: MatrixTotal[];
  productTotals: MatrixTotal[];
  group: MatrixTotal;
}
export interface Matrix {
  isMock: boolean;
  window: AnalyticsWindow;
  months: Month[]; // the 24 series months
  growthFormula: string;
  momentumFormula: string;
  measureNote: string;
  views: Record<ViewKey, MatrixView>;
  cleaningNote: string; // "Merging duplicates alone does not change totals…"
}

// ---------------------------------------------------------------- streams.json
export interface StreamMonth {
  month: Month;
  enquiries: number; // count
  prSgd: number; // PR value raised that month
  poSgd: number; // PO value (dedup)
  mdmRequests: number; // count, internal work — NOT demand
}
export interface CountryStreams {
  country: CountryCode;
  enquiries12m: number;
  enquiriesPrior12m: number;
  enquiryYoy: number | null;
  prSgd12m: number;
  /** Open PR pipeline, NOT blocked. The app adds live stuck demand (blocked PRs) from the store. */
  prPipelineOpenSgd: number;
  prOpenCount: number;
  poSgd12m: number; // = matrix dedup country total (± rounding)
  mdmRequests12m: number;
  prToPoConversion: number; // fraction
  series: StreamMonth[]; // 24 months
}
export interface Streams {
  isMock: boolean;
  window: AnalyticsWindow;
  legend: string; // always visible
  definitions: Record<MessageKind, string>;
  stuckDemandNote: string;
  countries: CountryStreams[];
}

// ---------------------------------------------------------------- dedup.json
export interface ExampleRecord {
  cardCode: string;
  cardName: string;
  entity: EntityCode;
  country: CountryCode; // the country recorded on the SAP record
}
export interface NamedExample {
  country: CountryCode;
  goldenId: string;
  title: string;
  records: ExampleRecord[];
  rawStory: string;
  dedupStory: string;
}
export interface DedupCountry {
  country: CountryCode;
  rawRecords: number;
  goldenCustomers: number;
  duplicateRecords: number;
  sgdMisattributedIn12m: number; // value wrongly booked INTO this country (SG)
  sgdMisattributedOut12m: number; // this country's value booked elsewhere (MY, VN)
  netCorrectionSgd12m: number; // + = country gains when cleaned
  pctOfCountry12m: number; // net correction ÷ dedup country 12M value
}
export interface Dedup {
  isMock: boolean;
  customers: {
    rawRecords: number;
    goldenCustomers: number;
    duplicateRecords: number;
    duplicateRate: number;
    clustersOf2: number;
    clustersOf3Plus: number;
  };
  byCountry: DedupCountry[];
  misattribution: { startedMonth: Month; totalSgdMoved12m: number; description: string };
  miscategorisation: {
    country: CountryCode;
    fromProduct: ProductGroup; // true product
    toProduct: ProductGroup; // recorded product
    units12m: number;
    sgd12m: number;
    items: {
      itemCode: string;
      itemName: string;
      recordedProduct: ProductGroup;
      trueProduct: ProductGroup;
      recordedCategory: string;
      trueCategory: string;
    }[];
  };
  examples: NamedExample[]; // one per country
  note: string;
}

// ---------------------------------------------------------------- bridge.json
export type BridgeKey = "prior" | "new" | "expanding" | "declining" | "lost" | "current";
export interface BridgeStep {
  key: BridgeKey;
  label: string;
  /** prior/current positive; declining/lost NEGATIVE. prior + new + expanding + declining + lost = current (exact). */
  sgd: number;
  customers: number;
}
export interface TopAccountDedup {
  goldenId: string;
  name: string;
  sgd12m: number;
  sgdPrior12m: number;
  yoy: number | null;
  records: number; // SAP records merged into this golden ID
  hero?: boolean; // the MY hero reveal account
}
export interface TopAccountRaw {
  cardCode: string;
  name: string;
  goldenId: string;
  sgd12m: number;
  sgdPrior12m: number;
  yoy: number | null;
  status: "new" | "lost" | "flat" | "expanding" | "declining";
}
export interface CountryBridge {
  country: CountryCode;
  raw: BridgeStep[];
  dedup: BridgeStep[];
  example: NamedExample;
  topAccounts: { raw: TopAccountRaw[]; dedup: TopAccountDedup[] };
}
export interface Bridge {
  isMock: boolean;
  window: AnalyticsWindow;
  definition: string;
  countries: CountryBridge[];
}

// ---------------------------------------------------------------- backtest.json
export type MethodId = "rolling6" | "rolling12" | "seasonalNaive" | "etsDamped";
export interface MethodInfo {
  id: MethodId;
  label: string;
  role: "baseline" | "challenger" | "ours";
  description: string;
}
export interface ForecastPoint {
  month: Month;
  h: number; // 1..3
  value: number; // units
}
export interface OriginForecasts {
  origin: Month; // last month of data used
  forecasts: Record<MethodId, ForecastPoint[]>;
}
export interface MethodScore {
  wape: number;
  bias: number;
  n: number; // scored points
}
export interface IntervalPoint {
  month: Month;
  p10: number;
  p50: number;
  p90: number; // units
  p50Sgd: number;
}
export interface BacktestCell {
  country: CountryCode;
  product: ProductGroup;
  measure: "units";
  inHeadline: boolean; // false for Product C
  actuals: { month: Month; value: number }[]; // 36 months
  origins: OriginForecasts[]; // 6
  scores: Record<MethodId, MethodScore>;
  winner: MethodId; // lowest WAPE of the 4
  baselineWape: number; // rolling12
  oursWape: number; // etsDamped
  deltaWapePts: number; // (ours − baseline) × 100; negative = ours better
  oursBeatsBaseline: boolean;
  next3: IntervalPoint[]; // Oct–Dec 2026, ETS with empirical P10/P90
}
export interface Backtest {
  isMock: boolean;
  origins: Month[];
  horizons: number[];
  forecastMonths: Month[];
  preRegistration: string;
  methods: MethodInfo[];
  baselineMethod: "rolling12";
  oursMethod: "etsDamped";
  wapeFormula: string;
  biasFormula: string;
  headline: {
    scope: string;
    weighting: "sgd" | "units";
    baselineWape: number;
    oursWape: number;
    baselineBias: number;
    oursBias: number;
    rolling6Wape: number;
    seasonalNaiveWape: number;
    improvementPts: number; // (baseline − ours) × 100
    plainBaseline: string; // "Today's method is off by 15 units per 100 ordered"
    plainOurs: string;
    plainBiasBaseline: string; // "…tends to under-forecast by 11.5%"
    plainBiasOurs: string;
  };
  winLoss: {
    cells: number;
    oursWins: number;
    baselineWins: number;
    ties: number;
    byProduct: Record<"A" | "B", { oursWins: number; baselineWins: number }>;
    baselineWinCells: string[]; // "SG·A"
    sentence: string;
  };
  productC: { baselineWape: number; oursWape: number; baselineBias: number; oursBias: number; note: string };
  intervalMethod: string;
  cells: BacktestCell[]; // 15
}

// ---------------------------------------------------------------- stress.json
export interface StressScenario {
  id: "base" | "no_signal" | "half_dengue";
  label: string;
  description: string;
  seed: number;
  baselineWape: number;
  oursWape: number;
  advantagePts: number; // (baseline − ours) × 100
  expected: string;
  passed: boolean;
}
export interface Stress {
  isMock: boolean;
  title: string; // "Our method doesn't invent signal"
  scope: string;
  scenarios: StressScenario[];
  verdict: string;
}

// ---------------------------------------------------------------- cleanxmethod.json
export type CleanRow = "raw" | "golden";
export type MethodCol = "rolling" | "ours";
export interface CleanXMethod {
  isMock: boolean;
  scope: string;
  rows: CleanRow[];
  cols: MethodCol[];
  rowLabels: Record<CleanRow, string>;
  colLabels: Record<MethodCol, string>;
  table: Record<CleanRow, Record<MethodCol, number>>; // WAPE
  fromCleaningPts: number;
  fromModellingPts: number;
  totalImprovementPts: number;
  sentence: string;
  plain: Record<CleanRow, Record<MethodCol, string>>;
}

// ---------------------------------------------------------------- matcher_eval.json
export interface PrfCounts {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}
export interface MatcherExampleSide {
  cardCode?: string;
  cardName: string;
  country: CountryCode;
}
export interface MatcherEval {
  isMock: boolean;
  threshold: number;
  tunedOn: CountryCode[];
  heldOut: CountryCode[];
  method: string;
  heldOutMetrics: PrfCounts & { pairsScored: number; truePairs: number };
  tuningMetrics: PrfCounts;
  plain: { precision: string; recall: string };
  prCurve: { threshold: number; precision: number; recall: number }[];
  perPerturbation: { type: string; label: string; n: number; recall: number }[];
  examples: { kind: "missed" | "false_positive"; a: MatcherExampleSide; b: MatcherExampleSide; score: number; why: string }[];
  duplicateRate: number;
}

// ---------------------------------------------------------------- signals.json
export interface SignalRowBase {
  goldenId: string;
  name: string;
  country: CountryCode;
  entity: EntityCode;
  product: ProductGroup;
  reason: string;
  /** Addressable S$, BEFORE conversion. Never sum into a revenue headline. */
  sgdAddressable: number;
  assumedConversion: number; // fraction shown next to the S$
  signalSource: string;
}
export interface DropOffRow extends SignalRowBase {
  trailing6mSgd: number;
  prior6mSgd: number;
  daysSinceLastPo: number;
  medianReorderDays: number;
}
export interface CrossSellRow extends SignalRowBase {
  peerMedianSgd: number;
  installedBase: boolean; // "C installed, low A" pull-through signal (signal only, not a forecast feature)
}
export interface Signals {
  isMock: boolean;
  assumptions: { dropOffSaveRate: number; crossSellConversion: number; label: string };
  dropOff: DropOffRow[];
  crossSell: CrossSellRow[];
  totals: { dropOffAddressableSgd: number; crossSellAddressableSgd: number };
}

// ---------------------------------------------------------------- actions.json
export interface CountryAction {
  ownerRole: string;
  action: string;
  byWhen: string; // ISO date
  sgdAddressable: number | null; // before conversion
  kpi: string;
}
export interface CountryCard {
  country: CountryCode;
  implication: string;
  signalSource: string;
  kpi: string; // KPI to watch next quarter
  actions: CountryAction[]; // 2–3
}
export interface Actions {
  isMock: boolean;
  note: string;
  cards: CountryCard[]; // 5
}

// ---------------------------------------------------------------- triage_eval.json
export interface TriageEval {
  isMock: boolean;
  status: "mock" | "final";
  testSet: string;
  testSetSize: number;
  accuracy: number;
  macroF1: number;
  labels: MessageKind[]; // row/col order of the confusion matrix
  confusion: number[][]; // rows = actual, cols = predicted
  perClass: { kind: MessageKind; precision: number; recall: number; n: number }[];
  plain: string;
  errors: { id: string; subject: string; actual: MessageKind; predicted: MessageKind; why: string }[];
}

// ---------------------------------------------------------------- inbox.json
export interface InboxMessage {
  id: string; // "MSG-2001"
  from: string; // email, *.example
  company: string;
  country: CountryCode;
  subject: string;
  body: string;
  receivedAt: string; // ISO +08:00
  /** Hand label, for "rule vs human" comparison only. Classify live with classifyMessage(). */
  humanLabel?: MessageKind;
}
export interface Inbox {
  isMock: boolean;
  note: string;
  messages: InboxMessage[];
}

// ---------------------------------------------------------------- summary.json
export type HeadlineId = "growth" | "forecast" | "duplicates" | "cycle_time" | "payback";
export interface Headline {
  id: HeadlineId;
  label: string;
  value: number;
  baseline?: number; // "before" value where there is one
  display: string; // ready-to-print, e.g. "15 → 12 per 100"
  unit: string;
  sentence: string; // plain-language, used verbatim by app, video and slides
  sourceFile: string;
  sourcePath: string;
}
export interface Summary {
  isMock: boolean;
  generatedAt: string;
  window: string;
  headlines: Headline[]; // exactly 5, in this order: growth, forecast, duplicates, cycle_time, payback
}

// ---------------------------------------------------------------- typed exports
export const meta = metaJson as Meta;
export const master = masterJson as MasterData;
export const matrix = matrixJson as Matrix;
export const streams = streamsJson as Streams;
export const bridge = bridgeJson as Bridge;
export const backtest = backtestJson as Backtest;
export const stress = stressJson as Stress;
export const cleanXMethod = cleanxmethodJson as CleanXMethod;
export const matcherEval = matcherEvalJson as MatcherEval;
export const signals = signalsJson as Signals;
export const actions = actionsJson as Actions;
export const triageEval = triageEvalJson as TriageEval;
export const inbox = inboxJson as Inbox;
export const summary = summaryJson as Summary;
export const dedup = dedupJson as Dedup;

// ---------------------------------------------------------------- small helpers (pure)
export function matrixCell(view: ViewKey, country: CountryCode, product: ProductGroup): MatrixCell | undefined {
  return matrix.views[view].cells.find((c) => c.country === country && c.product === product);
}
export function backtestCell(country: CountryCode, product: ProductGroup): BacktestCell | undefined {
  return backtest.cells.find((c) => c.country === country && c.product === product);
}
export function headline(id: HeadlineId): Headline | undefined {
  return summary.headlines.find((h) => h.id === id);
}
/** WAPE → "off by 15 units per 100 ordered" */
export function plainWape(w: number): string {
  return `off by ${Math.round(w * 100)} units per 100 ordered`;
}
/** bias → "tends to over-forecast by 3.2%" */
export function plainBias(b: number): string {
  return `tends to ${b > 0 ? "over" : "under"}-forecast by ${Math.abs(Math.round(b * 1000) / 10)}%`;
}
/** precision → "of 100 duplicate warnings, 89 are real" */
export function plainPrecision(p: number): string {
  return `of 100 duplicate warnings, ${Math.round(p * 100)} are real`;
}
/** recall → "catches 86 of every 100 real duplicates" */
export function plainRecall(r: number): string {
  return `catches ${Math.round(r * 100)} of every 100 real duplicates`;
}
