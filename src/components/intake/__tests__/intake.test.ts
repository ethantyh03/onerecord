import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, IVD_CONSUMABLE_CATEGORY } from "@/config/default-config";
import { master } from "@/data/contract";
import { buildSeed } from "@/lib/seed";
import { buildRoute, expectedCompletion, activateNext } from "@/lib/engine/routing";
import { AMY_EMAIL, CUSTOMER_ROW, extractForIntake, redactForExtraction } from "@/lib/extract-cache";
import { completeness, dupCandidates, dupInputFor, runDupCheck, submitBlockers, formatLiveDate } from "../intake-logic";

const domains = DEFAULT_CONFIG.domains;
const domain = (id: string) => domains.find((d) => d.id === id)!;
const seed = buildSeed("2026-10-28T01:00:00.000Z", DEFAULT_CONFIG);

describe("paste-to-fill cache", () => {
  it("Amy's email hits the cache, opens New Item and strips the bank account", () => {
    const x = extractForIntake(AMY_EMAIL, domains);
    expect(x.source).toBe("cache");
    expect(x.domainId).toBe("item");
    expect(x.redactions).toBe(1);
    expect(x.redactedText).not.toContain("123-456789-001");
    expect(x.values.category).toBe(IVD_CONSUMABLE_CATEGORY);
    expect(x.values.itemName).toBe("K2EDTA Blood Collection Tube 4 mL, 100/pk");
    expect(x.filledKeys.length).toBeGreaterThanOrEqual(6);
    expect(x.insights[0]).toContain("HSA Class A");
    const c = completeness(domain("item"), x.values);
    expect(c.missing.map((f) => f.key).sort()).toEqual(["regCertificate", "regLicenceNo", "storage"]);
  });

  it("re-applying the redacted text still hits the cache", () => {
    const once = extractForIntake(AMY_EMAIL, domains);
    const twice = extractForIntake(once.redactedText, domains, "customer");
    expect(twice.source).toBe("cache");
    expect(twice.redactions).toBe(0);
  });

  it("customer row: 2 sensitive values removed, 12 fields filled, credit limit left empty", () => {
    const x = extractForIntake(CUSTOMER_ROW, domains);
    expect(x.source).toBe("cache");
    expect(x.domainId).toBe("customer");
    expect(x.redactions).toBe(2);
    expect(x.filledKeys.length).toBe(12);
    expect(x.values.creditLimit).toBeUndefined();
    expect(redactForExtraction(CUSTOMER_ROW).text).toContain("[REDACTED AMOUNT]");
  });

  it("other text falls back to the rules extractor without throwing", () => {
    const x = extractForIntake("Item: Pipette Tips 200 uL\nCategory: Lab consumable", domains);
    expect(x.source).toBe("rules");
    expect(x.domainId).toBe("item");
    expect(() => extractForIntake("", domains)).not.toThrow();
  });
});

describe("duplicate check", () => {
  const candidates = dupCandidates("customer", master.customers, seed.sapRecords);

  it("Natl Univ Hosp (SG, 198500123K) finds C-SG-00017 at >= 90% with Same tax ID", () => {
    const input = dupInputFor(domain("customer"), { customerName: "Natl Univ Hosp", country: "SG", taxId: "198500123K" });
    const m = runDupCheck(input, candidates);
    expect(m[0].record.cardCode).toBe("C-SG-00017");
    expect(m[0].score).toBeGreaterThanOrEqual(0.9);
    expect(m[0].reasons).toContain("Same tax ID");
  });

  it("Natl Univ Hosp without tax ID still matches >= 85% on name", () => {
    const m = runDupCheck(dupInputFor(domain("customer"), { customerName: "Natl Univ Hosp", country: "SG" }), candidates);
    expect(m[0].record.cardCode).toBe("C-SG-00017");
    expect(m[0].score).toBeGreaterThanOrEqual(0.85);
  });

  it("the demo customer row has no blocking duplicate", () => {
    const x = extractForIntake(CUSTOMER_ROW, domains);
    const m = runDupCheck(dupInputFor(domain("customer"), x.values), candidates);
    expect(m.filter((d) => d.score >= 0.85)).toEqual([]);
  });

  it("gate: a strong match needs a decision; override needs 20 chars", () => {
    const data = { customerName: "Natl Univ Hosp", country: "SG", taxId: "198500123K" };
    const matches = runDupCheck(dupInputFor(domain("customer"), data), candidates);
    expect(submitBlockers({ domain: domain("customer"), data, matches, decision: undefined })).toContain(
      "Choose what to do about the possible duplicate",
    );
    const base = { matchCode: "C-SG-00017", matchName: "National University Hospital", score: 0.97, reasons: [] };
    const short = submitBlockers({ domain: domain("customer"), data, matches, decision: { ...base, choice: "override", justification: "different" } });
    expect(short.some((s) => s.includes("20 characters"))).toBe(true);
  });
});

describe("route preview", () => {
  it("Amy's K2EDTA item: QA/RA + BU Head + Business Support in parallel, then MDM", () => {
    const x = extractForIntake(AMY_EMAIL, domains);
    const bu = DEFAULT_CONFIG.businessUnits.find((b) => b.id === "SPD");
    const steps = buildRoute({ domain: domain("item"), bu, data: x.values, people: DEFAULT_CONFIG.people });
    expect(steps.filter((s) => s.stageIndex === 0).map((s) => s.role).sort()).toEqual(["bu_head", "business_support", "qa_ra"]);
    expect(steps.find((s) => s.role === "qa_ra")?.addedBecause).toContain("regulatory (QA/RA) review required");
    const now = "2026-10-28T01:00:00.000Z";
    const live = expectedCompletion(activateNext(steps, now), now, DEFAULT_CONFIG.sla);
    expect(formatLiveDate(live)).toMatch(/^(Mon 2|Tue 3) Nov$/);
  });
});
