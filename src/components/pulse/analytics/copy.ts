import { actions, backtest, bridge, matrix, meta, signals, streams, stress, type CountryBridge, type DataHonestyItem } from "@/data/contract";
import { COUNTRIES } from "@/lib/types";
import { formatPct } from "@/components/pulse/core/pulse-format";

/**
 * Product wording for the strings the analytics pipeline writes into src/data/*.json. The JSON keeps the pipeline's
 * own wording (analytics/run_all.py regenerates it); this module turns it into what Regional Pulse says to its users:
 * methods by name ("seasonal model", "rolling average"), no planning-document references (assumption IDs, section
 * numbers). Every figure still comes from the JSON, so the text cannot drift from the numbers.
 */

/** "today's method" / "ours" → the methods' names. */
export function methodNames(s: string): string {
  return s
    .replace(/\bOur method\b/g, "The seasonal model")
    .replace(/\bour method\b/g, "the seasonal model")
    .replace(/\bour advantage\b/g, "the seasonal model's advantage")
    .replace(/\btoday's rolling average\b/g, "the current rolling average")
    .replace(/\bToday's method\b/g, "The rolling average")
    .replace(/\btoday's method\b/g, "the rolling average")
    .replace(/\btoday's error\b/g, "the rolling average's error")
    .replace(/\bthan today's\b/g, "than the rolling average")
    .replace(/\bOurs\b/g, "The seasonal model")
    .replace(/\bours\b/g, "the seasonal model");
}

/** " (A19)", " (A13, A26)", " (A19–A26)" → "" */
export function stripAssumptionIds(s: string): string {
  return s.replace(/\s*\(A\d{1,2}(?:\s*[–-]\s*A?\d{1,2})?(?:,\s*A\d{1,2}(?:\s*[–-]\s*A?\d{1,2})?)*\)/g, "");
}

/** The pipeline's note on how the sandbox builds the merged view; it lives once, in About this data → Model limits. */
function stripGroundTruthNote(s: string): string {
  return s.replace(/\s*The de-duplicated view uses the synthetic data's ground-truth golden IDs[^.]*\./g, "");
}

const noSept = (s: string) => s.replace(/\bSept\b/g, "Sep");

const per100 = (w: number) => Math.round(w * 100);

// ---------------------------------------------------------------------------------------------------------------
// Forecast

/** "The rolling average is off by 11 units per 100 ordered; the seasonal model by 9" (no trailing full stop). */
export function errorSentence(baselineWape: number, seasonalWape: number): string {
  return `The rolling average is off by ${per100(baselineWape)} units per 100 ordered; the seasonal model by ${per100(seasonalWape)}`;
}

/** Headline scope (Products A and B, all countries). */
export const HEADLINE_ERROR = errorSentence(backtest.headline.baselineWape, backtest.headline.oursWape);

/** "The seasonal model beats the rolling average in 7 of 10 country × product cells (A: 4 of 5, B: 3 of 5); …" */
export const WIN_LOSS_SENTENCE = (() => {
  const wl = backtest.winLoss;
  const byProduct = Object.entries(wl.byProduct)
    .map(([p, r]) => `${p}: ${r.oursWins} of ${r.oursWins + r.baselineWins}`)
    .join(", ");
  const losses = wl.baselineWinCells.length ? ` (${wl.baselineWinCells.join(", ")})` : "";
  return `The seasonal model beats the rolling average in ${wl.oursWins} of ${wl.cells} country × product cells (${byProduct}); the rolling average wins ${wl.baselineWins}${losses}.`;
})();

export const PRODUCT_C_NOTE = methodNames(backtest.productC.note);

// ---------------------------------------------------------------------------------------------------------------
// Definitions and footnotes

export const SEASONALITY_NOTE =
  "Growth compares the same 12 months a year apart, not half-years, so dengue season, fiscal-year flushes and CNY/Tet don't show up as growth.";

/** What counts as volume and the currency, without the half-years sentence (Definitions → Seasonality says it). */
export const MEASURE_NOTE = noSept(matrix.measureNote)
  .replace(/\bfixed illustrative FX\b/g, "fixed FX rates")
  .replace(/\s*We compare the same 12 months a year apart[^.]*\./, "");

export const CLEANING_NOTE = noSept(stripGroundTruthNote(matrix.cleaningNote));

export const BRIDGE_DEFINITION = stripGroundTruthNote(bridge.definition);

/**
 * A country's duplicate example as a fact, not a headline:
 * "Bukit Damai Specialist Hospital: 3 SAP records, one customer (#2 in Malaysia, −32%)".
 */
export function duplicateExampleTitle(cb: CountryBridge): string {
  const i = cb.topAccounts.dedup.findIndex((a) => a.goldenId === cb.example.goldenId);
  const a = i >= 0 ? cb.topAccounts.dedup[i] : undefined;
  const records = a && a.records > 1 ? a.records : cb.example.records.length;
  const name = a?.name ?? cb.example.records[0]?.cardName ?? cb.example.goldenId;
  const country = COUNTRIES.find((c) => c.code === cb.country)?.name ?? cb.country;
  const rank = a ? `#${i + 1} in ${country}` : country;
  const yoy = a && a.yoy != null ? `, ${formatPct(a.yoy)}` : "";
  return `${name}: ${records} SAP records, one customer (${rank}${yoy})`;
}

export const STREAMS_LEGEND = streams.legend.replace(/\bour internal work\b/g, "internal work");

/** The signals' S$ definition and rates, said once (under the signals table). */
export const SIGNALS_RATE_NOTE = signals.assumptions.label
  .replace(/,\s*below the [^.]*?in our research/g, "")
  .replace(/\bteam assumptions\b/g, "planning assumptions")
  .replace(/\s*Never summed into a revenue headline\./g, "");

/** The country actions' footnote: what the S$ mean and why the signals run on merged customers. */
export const ACTIONS_NOTE = actions.note
  .replace(/\s*Never summed into a revenue headline\./g, "")
  // The raw-vs-merged comparison is methodology; it lives in About this data → Model limits.
  .replace(/Signals run on merged customers: on raw SAP records [^.]*\./, "Signals run on merged customers.");

// ---------------------------------------------------------------------------------------------------------------
// Model quality

export const STRESS_TITLE = "No-signal stress test";
export const STRESS_VERDICT = methodNames(stress.verdict).replace(/With a different seed and half the dengue effect/g, "With half the dengue effect");
export const stressExpected = (s: string) => s.replace(/^Ours ahead$/, "Seasonal ahead");

/** The stress scenarios in product wording: what changed in the data, not how the generator was run. */
const STRESS_SCENARIO: Record<string, { label: string; description: string }> = {
  base: { label: "Current data", description: "The data behind every other number on this page." },
  no_signal: {
    label: "Data with seasonality removed",
    description: "Seasonal, dengue, holiday, fiscal-year and trend effects removed; noise and data-quality problems kept.",
  },
  half_dengue: { label: "Weaker dengue season", description: "A dengue season half as strong, on a fresh sample." },
};
export function stressScenario(id: string, label: string, description: string): { label: string; description: string } {
  return STRESS_SCENARIO[id] ?? { label, description };
}

/** The triage test set, described without evaluation-protocol wording. */
export function triageTestSet(s: string): string {
  return s.replace(/written blind before the rules were read/g, "written independently of the rules").replace(/deliberately tricky/g, "tricky");
}
export function triagePlain(s: string): string {
  return s.replace(/^On (\d+) messages written without seeing the rules, /, "On $1 labelled test messages, ").replace(/deliberately tricky/g, "tricky");
}

// ---------------------------------------------------------------------------------------------------------------
// About this data (the drawer)

const PATTERN_SOURCE: Record<string, string> = {
  hero_my: "Known issue: duplicates hide drop-off",
  misattribution: "Known issue: orders booked to the wrong country",
  false_crosssell: "Known issue: cross-sell blind spot",
  duplicates: "Planning assumption: about 6% duplicate records",
  dengue: "Public dengue case data (SG/MY/TH/VN/MM)",
  holidays: "Public holiday calendars",
  fiscal: "Public-sector fiscal years",
  contract_churn: "Reagent rental contract terms (MY)",
  stuck_demand: "Data acceptance check",
  nuh: "Sample master record",
  forecast: "Data acceptance check",
  matcher: "Data acceptance check",
};

export function patternSource(id: string, source: string): string {
  return PATTERN_SOURCE[id] ?? stripAssumptionIds(source.replace(/^Research log:\s*/, ""));
}

export function patternName(name: string): string {
  return name.replace(/^Forecast plant check$/, "Forecast check").replace(/^Matcher band$/, "Duplicate finder accuracy band");
}

export function patternDescription(s: string): string {
  return s
    .replace(/\bincl\. pinned\b/g, "incl.")
    .replace(/, for the intake duplicate demo\./, ", as a reference for duplicate checks at intake.")
    .replace(/\s*\(a suspiciously perfect score fails\)/g, "");
}

/** Pipeline vocabulary (script and file names, research-protocol terms) → plain words. */
function plainPipeline(s: string): string {
  return s
    .replace(/\bGenerated by analytics\/generate\.py from params\.yaml with seed (\d+)/g, "Generated from one parameter file (seed $1)")
    .replace(/\s*\(analytics\/run_all\.py\)/g, "")
    .replace(/\bfrom one seed\b/g, "from one parameter file")
    .replace(/\(falsification test\)/g, "(no-signal stress test)")
    .replace(/\bWith a different seed and half the dengue effect\b/g, "With half the dengue effect")
    .replace(/\bA non-pre-registered rerun\b/g, "A rerun")
    .replace(/\bThe pre-registered backtest\b/g, "The backtest")
    .replace(/\bvs \+(\d+(?:\.\d+)?) pre-registered\b/g, "vs +$1 on the scored window")
    .replace(/^Pre-registered, leak-tested/, "Fixed before any result was seen, leak-tested")
    .replace(/^Not pre-registered: /, "Outside the scored window: ")
    .replace(/^Held-out TH\/VN\/MM: Of 100/, "Tested on TH/VN/MM: of 100")
    .replace(/; Catches /g, "; catches ")
    .replace(/\s*Perturbations not mirrored in the normaliser\./g, "")
    .replace(/\bThe matcher's own crosswalk\b/g, "The duplicate finder's own grouping")
    .replace(/\bthe matcher's crosswalk\b/g, "the duplicate finder's grouping")
    .replace(/\bthe matcher aims at\b/g, "the duplicate finder aims at")
    .replace(/\bthe matcher evaluation\b/g, "Model quality")
    .replace(/\bThe matcher is measured\b/g, "The duplicate finder is measured")
    .replace(
      /^The TypeScript matcher used at intake is a port of the same scorer \(parity-tested on \d+ fixture pairs\); the live intake warns at ([\d.]+) and blocks at ([\d.]+), the batch merge threshold is ([\d.]+)\.$/,
      "The intake duplicate check uses the same scorer: it warns at $1 and blocks at $2; batch merging uses $3.",
    );
}

/** One row of "What is synthetic, assumed or tested", in product wording. */
export function honestyItem(it: DataHonestyItem): DataHonestyItem {
  let { item, detail } = it;
  item = stripAssumptionIds(item)
    .replace(/^Falsification test$/, "No-signal stress test")
    .replace(/^Matcher precision \/ recall$/, "Duplicate finder precision / recall");
  detail = plainPipeline(methodNames(detail))
    .replace(/\bthe pinned demo record\b/g, "one sample master record")
    .replace(/\s*\(research log\)/g, "")
    .replace(/^On (\d+) messages written without seeing the rules, /, "On $1 labelled test messages, ")
    .replace(/\bdeliberately tricky\b/g, "tricky")
    .replace(/^A13 assumes 6%; the pilot measures it on OCRD\.$/, "Assumed at 6%; measured on OCRD once live SAP B1 data is connected.")
    .replace(/^Team estimates and research-log prices; payback counts hard hours only \(impact\.json\)\.$/, "Estimates with sourced unit prices; payback counts hard hours only. See Business case.");
  return { ...it, item, detail };
}

export const VALIDATED_HERE = meta.validatedVsPilot.validatedHere.map((v) =>
  plainPipeline(v).replace(/^Business-case arithmetic reproduces the final model §6 figures$/, "Business-case arithmetic reproduces from its inputs"),
);
export const NEEDS_LIVE_DATA = meta.validatedVsPilot.needsPilot.map(stripAssumptionIds);

export const ROLLOUT_SUMMARY = `Planned: ${meta.pilotPlan.scope}. The same analytics run unchanged on SAP B1 extracts in week 1.`;

export const ROLLOUT_STEPS = meta.pilotPlan.steps.map((s) =>
  s
    .replace(/\btoday's rolling average\b/g, "the current rolling average")
    .replace(/;\s*run analytics\/run_all\.py unchanged on the extracts$/, "; rerun the same pipeline on the extracts")
    .replace(/;\s*report losses too$/, "")
    .replace(
      /^Week 6: keep \/ kill on the KPIs:.*$/,
      "Week 6: review against the targets: median setup time ≤ 4 business days; stop if the median is above 6 or adoption under 70%.",
    ),
);

/** The country actions' footnote sentence on raw vs merged signals, moved here from the page. */
const RAW_SIGNALS_LIMIT = (() => {
  const m = actions.note.match(/Signals run on merged customers: on raw SAP records ([^.]*)\./);
  return m ? `Customer signals run on merged customers: on raw SAP records ${m[1]}.` : null;
})();

export const MODEL_LIMITS = [
  ...meta.modelCard.limitations
    // The drawer's description already says the data is synthetic.
    .filter((l) => !/^All data is synthetic\b/.test(l))
    .map((l) =>
      plainPipeline(methodNames(l))
        .replace(/\bIn production the view would use\b/g, "On live data the view uses")
        .replace(/\s*Clean first\.$/, "")
        .replace(/\bteam-assumed\b/g, "assumed"),
    ),
  ...(RAW_SIGNALS_LIMIT ? [RAW_SIGNALS_LIMIT] : []),
];
