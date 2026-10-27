import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, NEW_BU_TEMPLATE } from "@/config/default-config";
import { onboardingTemplateFor, pendingEntityLabel } from "../bu-template";

describe("admin: Add business unit prefill", () => {
  it("prefills MLS from 'Set up MLS' and from 'Add business unit' while MLS is unconfigured", () => {
    expect(DEFAULT_CONFIG.people.some((p) => p.entity === "MLS")).toBe(true);
    expect(onboardingTemplateFor(DEFAULT_CONFIG, "MLS")).toBe(NEW_BU_TEMPLATE);
    expect(onboardingTemplateFor(DEFAULT_CONFIG)).toBe(NEW_BU_TEMPLATE);
  });

  it("the prefilled draft passes the sheet's validation (BU head, name, code, named stage)", () => {
    const t = onboardingTemplateFor(DEFAULT_CONFIG)!;
    expect(t.id).toMatch(/^[A-Z0-9]{2,6}$/);
    expect(t.name.trim()).not.toBe("");
    expect(t.roleAssignments.bu_head).toBe("henry");
    expect(t.roleAssignments.business_support).toBe("siti");
    expect(t.extraStages.map((s) => s.label)).toEqual(["Molecular regulatory pre-check"]);
  });

  it("starts blank once MLS exists or for another entity", () => {
    const withMls = { ...DEFAULT_CONFIG, businessUnits: [...DEFAULT_CONFIG.businessUnits, NEW_BU_TEMPLATE] };
    expect(onboardingTemplateFor(withMls)).toBeNull();
    expect(onboardingTemplateFor(withMls, "MLS")).toBeNull();
    expect(onboardingTemplateFor(DEFAULT_CONFIG, "XYZ")).toBeNull();
  });

  it("spells out MLS", () => {
    expect(pendingEntityLabel("MLS")).toBe("MLS (Meridian Life Sciences, newly acquired)");
    expect(pendingEntityLabel("XYZ")).toBe("XYZ");
  });
});
