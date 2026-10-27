/**
 * TS/Python parity for the duplicate scorer.
 *
 * analytics/resolve.py ports src/lib/engine/dedupe.ts line by line and writes analytics/matcher_fixture.json
 * (25 pairs: true duplicates, hard non-duplicates, edge cases). This test runs the TS scorer on the same pairs,
 * so the held-out precision/recall reported in src/data/matcher_eval.json describes the matcher the app runs.
 * Regenerate the fixture with: PYTHONIOENCODING=utf-8 python analytics/resolve.py
 */
import { describe, expect, it } from "vitest";
import type { CustomerMaster } from "@/lib/types";
import fixtureJson from "../../../../analytics/matcher_fixture.json";
import { nameSimilarity, normalizeName, scorePair, type DupInput } from "../dedupe";

interface FixturePair {
  id: string;
  kind: "true_duplicate" | "non_duplicate" | "edge_case";
  note: string;
  input: DupInput;
  record: CustomerMaster;
  expected: {
    score: number;
    nameSimilarity: number;
    reasons: string[];
    normalizedInput: string;
    normalizedRecord: string;
  };
}

const fixture = fixtureJson as unknown as { tolerance: number; pairs: FixturePair[] };
const cases = fixture.pairs.map((p) => [`${p.id} ${p.input.name} ~ ${p.record.cardName}`, p] as const);

describe("matcher parity fixture", () => {
  it("has 25 pairs and a ±0.02 tolerance", () => {
    expect(fixture.pairs).toHaveLength(25);
    expect(fixture.tolerance).toBeLessThanOrEqual(0.02);
  });
});

describe("TS scorePair matches Python resolve.py", () => {
  it.each(cases)("%s", (_label, p) => {
    expect(normalizeName(p.input.name)).toBe(p.expected.normalizedInput);
    expect(normalizeName(p.record.cardName)).toBe(p.expected.normalizedRecord);
    expect(Math.abs(nameSimilarity(p.input.name, p.record.cardName) - p.expected.nameSimilarity)).toBeLessThanOrEqual(1e-5);
    const { score, reasons } = scorePair(p.input, p.record);
    expect(Math.abs(score - p.expected.score)).toBeLessThanOrEqual(fixture.tolerance);
    expect(reasons).toEqual(p.expected.reasons);
  });
});
