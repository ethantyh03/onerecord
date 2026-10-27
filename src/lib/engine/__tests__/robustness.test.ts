import { describe, expect, it } from "vitest";
import { classifyMessage, extractFieldsRules, findDuplicates, normalizeName, redactSensitive, validateRequest } from "..";
import { AMY_EMAIL, COSTCENTRE, CUSTOMER, EXTEND, ITEM, MASTERS, VENDOR } from "./fixtures";

/** Deterministic pseudo-random generator (mulberry32) so failures reproduce. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "abcXYZ019 .,:;-/\\()[]{}?!@#$%^&*_+=|\"'\t\n€é漢😀PO-SGD:Item:Category:";

function junk(r: () => number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(r() * ALPHABET.length)];
  return s;
}

describe("robustness on junk input", () => {
  const r = rng(20261028);
  const samples = [
    "",
    " ",
    ":",
    "Item:",
    "Item: \n\n",
    "Category:\tIVD reagent\t\t",
    AMY_EMAIL.slice(0, 57),
    AMY_EMAIL.repeat(20),
    ...Array.from({ length: 200 }, (_, i) => junk(r, 1 + (i % 120))),
  ];

  it("no engine entry point throws", () => {
    for (const s of samples) {
      expect(() => redactSensitive(s)).not.toThrow();
      expect(() => classifyMessage({ subject: s.slice(0, 20), body: s, from: s.slice(0, 10) })).not.toThrow();
      expect(() => normalizeName(s)).not.toThrow();
      expect(() => findDuplicates({ name: s, taxId: s.slice(0, 12), phone: s, email: s }, MASTERS)).not.toThrow();
      for (const d of [ITEM, CUSTOMER, VENDOR, COSTCENTRE, EXTEND]) {
        const res = extractFieldsRules(s, d);
        expect(Array.isArray(res.missing)).toBe(true);
        expect(() => validateRequest(d, res.values)).not.toThrow();
        for (const f of d.fields) {
          if (f.type === "select" && res.values[f.key] !== undefined) expect(f.options).toContain(res.values[f.key]);
        }
      }
    }
  });

  it("generic names never produce strong duplicate matches", () => {
    for (const name of ["Hospital", "hospital", "The Hospital", "Medical Centre", "Clinic", "Lab", "General Hospital", "Hosp", "Ctr"]) {
      expect(findDuplicates({ name }, MASTERS).every((m) => m.score < 0.85)).toBe(true);
    }
  });

  it("extraction is fast enough for live paste (Amy's email × 20 under 200 ms)", () => {
    const t0 = performance.now();
    extractFieldsRules(AMY_EMAIL.repeat(20), ITEM);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
