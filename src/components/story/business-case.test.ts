import { describe, expect, it } from "vitest";
import {
  ALTERNATIVES,
  AMY_WATERFALL,
  BASE_INPUTS,
  computeBusinessCase,
  computePhase2Case,
  edgeGrantSgd,
  hoursSavedPerRequest,
  phase1OneOffSgd,
  phase1RunCostSgd,
  revenueAtRiskSgd,
  waterfallTotals,
} from "./business-case";

describe("business case (final model §6)", () => {
  it("A19 hours saved per request is 1.25 h", () => {
    expect(hoursSavedPerRequest()).toBeCloseTo(1.25, 6);
  });

  it("phase-1 one-off is S$39,900 with S$5,985/yr run cost", () => {
    expect(phase1OneOffSgd()).toBe(39_900);
    expect(phase1RunCostSgd()).toBeCloseTo(5_985, 6);
  });

  it("base case: 80 requests/month", () => {
    const c = computeBusinessCase(80);
    expect(c.workflowHoursPerMonth).toBeCloseTo(105.9, 1);
    expect(Math.abs(c.hoursPerYear - 1_751)).toBeLessThan(1);
    expect(Math.abs(c.grossSgdPerYear - 87_528)).toBeLessThan(1);
    expect(Math.abs(c.netSgdPerYear - 81_543)).toBeLessThan(1);
    expect(c.phase1OneOffSgd).toBe(39_900);
    expect(Math.abs(c.paybackMonths - 5.9)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(c.paybackWorkflowOnlyMonths - 8.3)).toBeLessThanOrEqual(0.1);
    expect(Math.round(c.duplicatesStoppedPerYear)).toBe(18);
    expect(c.fte).toBeCloseTo(0.94, 2);
    expect(Math.round(c.threeYearNetSgd / 1000)).toBe(205);
    expect(c.requestDaysReturnedPerMonth).toBe(640);
  });

  it("40 requests/month pays back in 9.6 months", () => {
    const c = computeBusinessCase(40);
    expect(Math.abs(c.hoursPerYear - 1_115)).toBeLessThan(1);
    expect(Math.abs(c.netSgdPerYear - 49_779)).toBeLessThan(1);
    expect(Math.abs(c.paybackMonths - 9.6)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(c.paybackWorkflowOnlyMonths - 18.6)).toBeLessThanOrEqual(0.1);
    expect(Math.round(c.threeYearNetSgd / 1000)).toBe(109);
  });

  it("120 requests/month pays back in 4.2 months", () => {
    const c = computeBusinessCase(120);
    expect(Math.abs(c.hoursPerYear - 2_386)).toBeLessThan(1);
    expect(Math.abs(c.netSgdPerYear - 113_307)).toBeLessThan(1);
    expect(Math.abs(c.paybackMonths - 4.2)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(c.paybackWorkflowOnlyMonths - 5.4)).toBeLessThanOrEqual(0.1);
    expect(Math.round(c.threeYearNetSgd / 1000)).toBe(300);
  });

  it("zero volume never divides by zero", () => {
    const c = computeBusinessCase(0);
    expect(Number.isFinite(c.hoursPerYear)).toBe(true);
    expect(c.paybackWorkflowOnlyMonths).toBe(Number.POSITIVE_INFINITY);
  });

  it("§6.6: automatic SAP posting does not pay back on hours", () => {
    const p = computePhase2Case(80);
    expect(p.hoursSavedPerMonth).toBeCloseTo(12, 6);
    expect(p.savingSgdPerYear).toBeCloseTo(7_200, 6);
    expect(Math.round(p.licencesSgdPerYear)).toBe(2_633);
    expect(p.maintenanceSgdPerYear).toBe(3_375);
    expect(Math.round(p.paybackYearsProcess)).toBe(19);
    expect(Math.round(p.paybackYearsPayg)).toBe(7);
    expect(computePhase2Case(120).paybackYearsProcess).toBeCloseTo(4.7, 1);
  });

  it("Amy's 18 days: ≈43% of the saving needs no new software", () => {
    const t = waterfallTotals(AMY_WATERFALL);
    expect(t.beforeDays).toBe(18);
    expect(t.afterDays).toBe(4);
    expect(t.savedDays).toBe(14);
    expect(t.processSavedDays).toBe(6);
    expect(Math.round(t.processShare * 100)).toBe(43);
  });

  it("EDGE upside ≈ S$16k, within the S$30k digital sub-cap", () => {
    const e = edgeGrantSgd();
    expect(e.thirdPartySgd).toBe(32_250);
    expect(Math.round(e.grantSgd / 1000)).toBe(16);
  });

  it("revenue at risk applies the 10% leak rate and never goes negative", () => {
    expect(revenueAtRiskSgd(345_800)).toBeCloseTo(34_580, 6);
    expect(revenueAtRiskSgd(-5)).toBe(0);
    expect(BASE_INPUTS.leakRate).toBe(0.1);
  });

  it("alternatives table has exactly one chosen option", () => {
    expect(ALTERNATIVES.filter((a) => a.chosen)).toHaveLength(1);
    expect(ALTERNATIVES).toHaveLength(6);
  });
});
