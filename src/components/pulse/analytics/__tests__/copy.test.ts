import { describe, expect, it } from "vitest";
import { backtest, bridge, meta, stress, triageEval } from "@/data/contract";
import { MATCHER_CAVEAT, SEASON_CAVEAT } from "../caveats";
import {
  ACTIONS_NOTE,
  BRIDGE_DEFINITION,
  CLEANING_NOTE,
  HEADLINE_ERROR,
  MEASURE_NOTE,
  MODEL_LIMITS,
  NEEDS_LIVE_DATA,
  PRODUCT_C_NOTE,
  ROLLOUT_STEPS,
  ROLLOUT_SUMMARY,
  SIGNALS_RATE_NOTE,
  STREAMS_LEGEND,
  STRESS_VERDICT,
  VALIDATED_HERE,
  WIN_LOSS_SENTENCE,
  duplicateExampleTitle,
  honestyItem,
  methodNames,
  patternDescription,
  patternSource,
  stressScenario,
  stripAssumptionIds,
  triagePlain,
  triageTestSet,
} from "../copy";

/** Wording a team pitching to judges would use, never a product speaking to its users. */
const PITCH = [
  /\bours\b/i,
  /\btoday's method\b/i,
  /\bour (method|advantage|research)\b/i,
  /\bpilot\b/i,
  /\bbrief\b/i,
  /\bfinal model\b/i,
  /\bresearch log\b/i,
  /\bin production\b/i,
  /\bphase ?2\b/i,
  /\bdemo\b/i,
  /\bA\d{2}\b/,
  /Never summed into a revenue headline/,
  /Losses are shown, not hidden/,
];

function expectProductCopy(s: string) {
  for (const re of PITCH) expect(s, `${re} in: ${s}`).not.toMatch(re);
}

describe("pulse copy: product wording over pipeline strings", () => {
  it("names the methods instead of 'ours' / 'today's method'", () => {
    expect(methodNames("Ours is off by 9; today's method by 11.")).toBe("The seasonal model is off by 9; the rolling average by 11.");
    expect(methodNames("hours saved")).toBe("hours saved");
  });

  it("keeps the headline forecast numbers", () => {
    const h = backtest.headline;
    expect(HEADLINE_ERROR).toBe(
      `The rolling average is off by ${Math.round(h.baselineWape * 100)} units per 100 ordered; the seasonal model by ${Math.round(h.oursWape * 100)}`,
    );
    expect(HEADLINE_ERROR).toContain("off by 11 units per 100 ordered; the seasonal model by 9");
  });

  it("rebuilds the win/loss sentence from the numbers", () => {
    expect(WIN_LOSS_SENTENCE).toBe(
      "The seasonal model beats the rolling average in 7 of 10 country × product cells (A: 4 of 5, B: 3 of 5); the rolling average wins 3 (MY·A, TH·B, MM·B).",
    );
  });

  it("strips assumption IDs", () => {
    expect(stripAssumptionIds("Hours saved per request (A19) and analyst hours (A21)")).toBe(
      "Hours saved per request and analyst hours",
    );
    expect(stripAssumptionIds("Bounce rate baselines (A13, A26)")).toBe("Bounce rate baselines");
    expect(stripAssumptionIds("Hours saved and costs (A19–A26)")).toBe("Hours saved and costs");
  });

  it("gives every built-in pattern a product source", () => {
    for (const p of meta.plantedPatterns) expectProductCopy(patternSource(p.id, p.source));
  });

  it("leaves no pitch wording in the page's notes and the About this data drawer", () => {
    const texts = [
      SEASON_CAVEAT,
      MATCHER_CAVEAT,
      PRODUCT_C_NOTE,
      MEASURE_NOTE,
      CLEANING_NOTE,
      BRIDGE_DEFINITION,
      STREAMS_LEGEND,
      SIGNALS_RATE_NOTE,
      ACTIONS_NOTE,
      STRESS_VERDICT,
      ROLLOUT_SUMMARY,
      ...ROLLOUT_STEPS,
      ...VALIDATED_HERE,
      ...NEEDS_LIVE_DATA,
      ...MODEL_LIMITS,
      ...meta.dataHonesty.map((it) => `${honestyItem(it).item} ${honestyItem(it).detail}`),
    ];
    for (const t of texts) expectProductCopy(t);
  });

  it("moves the sandbox's ground-truth note out of the footnotes and keeps the figures", () => {
    expect(CLEANING_NOTE).not.toMatch(/ground-truth/);
    expect(BRIDGE_DEFINITION).not.toMatch(/ground-truth/);
    expect(CLEANING_NOTE).toContain("S$53.4M");
    expect(MODEL_LIMITS.some((l) => /ground-truth golden IDs/.test(l))).toBe(true);
    expect(MEASURE_NOTE).toContain("fixed FX rates");
    expect(SIGNALS_RATE_NOTE).toContain("Multiply by the assumed rate");
  });

  it("states the duplicate example as a fact, not a headline", () => {
    const my = bridge.countries.find((c) => c.country === "MY")!;
    expect(duplicateExampleTitle(my)).toBe("Bukit Damai Specialist Hospital: 3 SAP records, one customer (#2 in Malaysia, −32%)");
    for (const c of bridge.countries) expect(duplicateExampleTitle(c)).not.toMatch(/hidden behind/);
  });

  it("keeps the raw-vs-merged signal comparison in About this data, not under the actions", () => {
    expect(ACTIONS_NOTE).toMatch(/Signals run on merged customers\.$/);
    expect(ACTIONS_NOTE).not.toMatch(/false alarms/);
    expect(MODEL_LIMITS.some((l) => /would miss \d+ real drop-offs and raise \d+ false alarms/.test(l))).toBe(true);
  });

  it("describes model checks without generator, script or protocol vocabulary", () => {
    const shown = [
      STRESS_VERDICT,
      ...stress.scenarios.map((s) => { const v = stressScenario(s.id, s.label, s.description); return `${v.label} ${v.description}`; }),
      triageTestSet(triageEval.testSet),
      triagePlain(triageEval.plain),
      ...MODEL_LIMITS,
      ...VALIDATED_HERE,
      ...ROLLOUT_STEPS,
      ...meta.plantedPatterns.map((p) => patternDescription(p.description)),
      ...meta.dataHonesty.map((it) => `${honestyItem(it).item} ${honestyItem(it).detail}`),
    ];
    for (const t of shown) {
      expect(t, t).not.toMatch(/\bseed (?:7|42) instead\b|different seed|won by luck|written blind|analytics\/|params\.yaml|\.py\b|TypeScript|parity-tested|suspiciously|pre-registered|Falsification/i);
    }
    expect(ROLLOUT_STEPS.some((s) => /≤ 4 business days/.test(s))).toBe(true);
  });
});
