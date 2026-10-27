import { describe, expect, it } from "vitest";
import { buildRoute } from "@/lib/engine/routing";
import { DEFAULT_CONFIG, IVD_CONSUMABLE_CATEGORY, NEW_BU_TEMPLATE } from "@/config/default-config";
const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("admin: Test a route", () => {
  const item = DEFAULT_CONFIG.domains.find((d) => d.id === "item")!;
  const data = { category: IVD_CONSUMABLE_CATEGORY, productGroup: "A", entity: "MLS" };

  it("without MLS config, falls back to the first role holders and has no pre-check", () => {
    const steps = buildRoute({ domain: item, bu: undefined, data, people: DEFAULT_CONFIG.people });
    expect(steps.find((s) => s.role === "bu_head")?.assigneeId).toBe("daniel");
    expect(steps.some((s) => s.stageLabel === "Molecular regulatory pre-check")).toBe(false);
  });

  it("after adding NEW_BU_TEMPLATE (as Fill demo values does), routes to Henry and adds the pre-check", () => {
    const bu = deepClone(NEW_BU_TEMPLATE);
    expect(bu).toEqual(NEW_BU_TEMPLATE);
    const steps = buildRoute({ domain: item, bu, data, people: DEFAULT_CONFIG.people });
    expect(steps.find((s) => s.role === "bu_head")?.assigneeId).toBe("henry");
    const pre = steps.find((s) => s.stageLabel === "Molecular regulatory pre-check");
    expect(pre?.assigneeId).toBe("ploy");
    expect(pre?.addedBecause).toContain("Business unit MLS rule");
    expect(steps.at(-1)?.role).toBe("mdm");
  });
});
