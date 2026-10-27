import { describe, expect, it } from "vitest";
import { findDuplicates, jaroWinkler, nameSimilarity, normalizeName, scorePair, tokenSetRatio } from "../dedupe";
import { MASTERS, NUH, master } from "./fixtures";

describe("normalizeName", () => {
  it("expands abbreviations, strips punctuation and legal suffixes", () => {
    expect(normalizeName("Natl Univ Hosp")).toBe("national university hospital");
    expect(normalizeName("Nat'l Univ. Hosp.")).toBe("national university hospital");
    expect(normalizeName("Sunway Medical Center Sdn. Bhd.")).toBe("sunway medical centre");
    expect(normalizeName("Bangkok Central Laboratory Co., Ltd.")).toBe("bangkok central laboratory");
    expect(normalizeName("Quest Laboratories Pte Ltd")).toBe("quest laboratories");
    expect(normalizeName("ACME Intl Company Limited")).toBe("acme international");
    expect(normalizeName("St Luke's Gen Hosp")).toBe("saint lukes general hospital");
    expect(normalizeName("Mt Elizabeth Med Ctr")).toBe("mount elizabeth medical centre");
    expect(normalizeName("Bệnh viện Chợ Rẫy")).toBe("benh vien cho ray");
    expect(normalizeName("Dept of Pathology, Main St")).toBe("department of pathology main st");
  });

  it("handles empty and punctuation-only input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("  ., - ")).toBe("");
  });
});

describe("string similarity primitives", () => {
  it("jaroWinkler matches reference values", () => {
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(0.9611, 3);
    expect(jaroWinkler("dixon", "dicksonx")).toBeCloseTo(0.8133, 3);
    expect(jaroWinkler("abc", "abc")).toBe(1);
    expect(jaroWinkler("", "abc")).toBe(0);
    expect(jaroWinkler("abc", "xyz")).toBe(0);
  });

  it("tokenSetRatio behaves like rapidfuzz token_set_ratio", () => {
    expect(tokenSetRatio("fuzzy was a bear", "fuzzy fuzzy was a bear")).toBe(1);
    expect(tokenSetRatio("hospital kuala lumpur", "kuala lumpur hospital")).toBe(1);
    expect(tokenSetRatio("", "abc")).toBe(0);
    const r = tokenSetRatio("mount elizabeth hospital", "national university hospital");
    expect(r).toBeGreaterThan(0.4);
    expect(r).toBeLessThan(0.75);
  });
});

describe("scorePair", () => {
  it('"Natl Univ Hosp" vs "National University Hospital" ≥ 0.85, with a name reason', () => {
    const { score, reasons } = scorePair({ name: "Natl Univ Hosp", country: "SG" }, NUH);
    expect(score).toBeGreaterThanOrEqual(0.85);
    expect(reasons[0]).toMatch(/100% name match/);
    expect(reasons.join(" ")).toMatch(/Natl → National/);
  });

  it('"Mount Elizabeth Hospital" vs "National University Hospital" < 0.75', () => {
    expect(scorePair({ name: "Mount Elizabeth Hospital" }, NUH).score).toBeLessThan(0.75);
  });

  it('same taxId ⇒ reason "Same tax ID" and score ≥ 0.97', () => {
    const { score, reasons } = scorePair({ name: "Kent Ridge Medical Campus", taxId: "198500123-k" }, NUH);
    expect(reasons).toContain("Same tax ID");
    expect(score).toBeGreaterThanOrEqual(0.97);
  });

  it("adds postcode, phone and email-domain evidence, capped at 1", () => {
    const rec = { ...NUH, email: "procurement@nuh-demo.example" };
    const r = scorePair(
      { name: "National Univ Hospital", zipCode: "119074", phone: "67795555", email: "lab@nuh-demo.example" },
      rec,
    );
    expect(r.reasons).toEqual(expect.arrayContaining(["Same postcode", "Same phone number", "Same email domain (nuh-demo.example)"]));
    expect(r.score).toBeLessThanOrEqual(1);
    const weak = scorePair({ name: "Unrelated Name", zipCode: "119074" }, NUH);
    expect(weak.score).toBeLessThan(0.75);
  });

  it("ignores free-mail domains", () => {
    const rec = { ...NUH, email: "someone@gmail.com" };
    expect(scorePair({ name: "Xyz", email: "other@gmail.com" }, rec).reasons.join()).not.toMatch(/email/i);
  });

  it("recognises an initials match", () => {
    const r = scorePair({ name: "NUH" }, NUH);
    expect(r.score).toBeGreaterThanOrEqual(0.85);
    expect(r.reasons.join(" ")).toMatch(/Initials/);
  });

  it("tolerates typos", () => {
    expect(scorePair({ name: "Natonal Univercity Hospital" }, NUH).score).toBeGreaterThanOrEqual(0.85);
  });

  it("does not let shared prefixes or generic words create strong matches", () => {
    expect(nameSimilarity("National Heart Centre", "National University Hospital")).toBeLessThan(0.75);
    expect(nameSimilarity("Changi General Hospital", "Penang General Hospital")).toBeLessThan(0.75);
    expect(nameSimilarity("General Hospital", "Changi General Hospital")).toBeLessThan(0.75);
    expect(nameSimilarity("Medical Centre", "Sunway Medical Centre")).toBeLessThan(0.75);
  });
});

describe("findDuplicates", () => {
  it("finds C-SG-00017 for the pinned demo input", () => {
    const res = findDuplicates({ name: "Natl Univ Hosp", country: "SG" }, MASTERS);
    expect(res[0].record.cardCode).toBe("C-SG-00017");
    expect(res[0].score).toBeGreaterThanOrEqual(0.85);
    expect(res[0].reasons.some((r) => /name match/.test(r))).toBe(true);
  });

  it('findDuplicates("Hospital") has no match ≥ 0.85', () => {
    for (const country of [undefined, "SG", "MY"] as const) {
      const res = findDuplicates({ name: "Hospital", country }, MASTERS);
      expect(res.every((m) => m.score < 0.85)).toBe(true);
    }
    expect(findDuplicates({ name: "The Clinic" }, MASTERS).every((m) => m.score < 0.85)).toBe(true);
  });

  it("returns nothing for short or empty names and never throws", () => {
    expect(findDuplicates({ name: "" }, MASTERS)).toEqual([]);
    expect(findDuplicates({ name: "a" }, MASTERS)).toEqual([]);
    expect(findDuplicates({ name: "  .. " }, MASTERS)).toEqual([]);
    expect(findDuplicates({ name: "Ltd" }, MASTERS)).toEqual([]);
    expect(findDuplicates({ name: "Natl Univ Hosp" }, [])).toEqual([]);
  });

  it("still surfaces an exact tax ID hit when the name is too short", () => {
    const res = findDuplicates({ name: "a", taxId: "198500123K" }, MASTERS);
    expect(res.map((m) => m.record.cardCode)).toEqual(["C-SG-00017"]);
  });

  it("blocks on country, except for tax ID hits", () => {
    expect(findDuplicates({ name: "National University Hospital", country: "MY" }, MASTERS)).toEqual([]);
    const cross = findDuplicates({ name: "National University Hospital", country: "MY", taxId: "198500123K" }, MASTERS);
    expect(cross[0].record.cardCode).toBe("C-SG-00017");
  });

  it("respects limit and threshold and sorts by score", () => {
    const masters = [
      master({ cardCode: "C-SG-00101", cardName: "Natl University Hospital" }),
      master({ cardCode: "C-SG-00102", cardName: "National Univ. Hospital (Kent Ridge)" }),
      master({ cardCode: "C-SG-00103", cardName: "National University Hosp" }),
      ...MASTERS,
    ];
    const res = findDuplicates({ name: "National University Hospital", country: "SG" }, masters);
    expect(res).toHaveLength(3);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].score).toBeGreaterThanOrEqual(res[i].score);
    expect(findDuplicates({ name: "National University Hospital", country: "SG" }, masters, { limit: 10 }).length).toBeGreaterThan(3);
    expect(findDuplicates({ name: "Mount Elizabeth Hospital", country: "SG" }, MASTERS, { threshold: 0.99 }).map((m) => m.record.cardCode)).toEqual([
      "C-SG-00021",
    ]);
  });

  it("matches across spelling variants and legal suffixes", () => {
    const res = findDuplicates({ name: "Sunway Medical Center", country: "MY" }, MASTERS);
    expect(res[0].record.cardCode).toBe("C-MY-00011");
    expect(res[0].score).toBeGreaterThanOrEqual(0.85);
  });
});
