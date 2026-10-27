import { describe, expect, it } from "vitest";
import { SENSITIVE_ROLES, canSeeSensitive, maskValue } from "../masking";
import { assignSapCode, codeScopeFor, nextSapCode } from "../codes";
import { CUSTOMER, EXTEND, ITEM, PEOPLE } from "./fixtures";
import type { MdmRequest } from "@/lib/types";

const byId = (id: string) => PEOPLE.find((p) => p.id === id)!;

describe("masking", () => {
  it("only finance and MDM roles see sensitive fields", () => {
    expect(SENSITIVE_ROLES).toEqual(["finance", "finance_director", "financial_controller", "mdm"]);
    expect(canSeeSensitive(byId("weijie"))).toBe(true);
    expect(canSeeSensitive(byId("priya"))).toBe(true);
    expect(canSeeSensitive(byId("rachel"))).toBe(true);
    expect(canSeeSensitive(byId("meiling"))).toBe(true);
    expect(canSeeSensitive(byId("amy"))).toBe(false);
    expect(canSeeSensitive(byId("daniel"))).toBe(false);
  });

  it("masks to the last 4 characters", () => {
    expect(maskValue("1234567890")).toBe("•••• 7890");
    expect(maskValue("012-345678-9")).toBe("•••• 78-9");
    expect(maskValue(null)).toBe("—");
    expect(maskValue("")).toBe("—");
  });

  it("fully hides short values where the last 4 would reveal everything", () => {
    expect(maskValue(80000)).toBe("••••••");
    expect(maskValue("Net 30")).toBe("••••••");
  });
});

describe("codes", () => {
  it("next code after C-SG-00122 is C-SG-00123", () => {
    expect(nextSapCode("C", "SG", ["C-SG-00122"])).toBe("C-SG-00123");
  });

  it("uses the highest existing number in scope, ignoring other scopes and prefixes", () => {
    expect(nextSapCode("C", "SG", ["C-SG-00017", "C-SG-00122", "C-MY-00500", "CC-SG-0900", "V-SG-00999"])).toBe("C-SG-00123");
    expect(nextSapCode("V", "MY", ["V-MY-00044"])).toBe("V-MY-00045");
    expect(nextSapCode("C", "VN", [])).toBe("C-VN-00001");
  });

  it("items are scoped by product group with 6 digits; cost centres use 4 digits", () => {
    expect(nextSapCode("I", "A", ["I-A-000811", "I-B-000900"])).toBe("I-A-000812");
    expect(nextSapCode("CC", "SG", ["CC-SG-0030"])).toBe("CC-SG-0031");
  });

  it("picks the right scope and keeps the existing code for extensions", () => {
    const base: MdmRequest = {
      id: "REQ-1",
      domainId: "item",
      title: "",
      requestorId: "amy",
      entity: "SPD",
      country: "MY",
      createdAt: "2026-10-20T00:00:00.000Z",
      status: "mdm_review",
      data: { productGroup: "Product A · IVD reagents & test kits" },
      configVersion: 1,
      steps: [],
      blockedPrIds: [],
    };
    expect(codeScopeFor(ITEM, base)).toBe("A");
    expect(codeScopeFor(CUSTOMER, { ...base, domainId: "customer", data: { country: "SG" } })).toBe("SG");
    expect(codeScopeFor(CUSTOMER, { ...base, domainId: "customer", data: {} })).toBe("MY");
    expect(assignSapCode(ITEM, base, ["I-A-000811"])).toBe("I-A-000812");
    expect(assignSapCode(EXTEND, { ...base, domainId: "extend", data: { existingCode: "C-SG-00017" } }, [])).toBe("C-SG-00017");
  });
});
