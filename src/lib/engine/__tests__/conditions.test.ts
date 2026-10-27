import { describe, expect, it } from "vitest";
import { evalCondition, isFieldRequired, isFieldVisible, validateRequest } from "../conditions";
import { CUSTOMER, ITEM } from "./fixtures";
import type { FieldDef } from "@/lib/types";

const regLicence = ITEM.fields.find((f) => f.key === "regLicenceNo")!;

describe("evalCondition", () => {
  it("treats an undefined condition as always true", () => {
    expect(evalCondition(undefined, {})).toBe(true);
  });

  it("'in' compares String(value) against the option list", () => {
    const c = { field: "category", op: "in" as const, value: ["IVD reagent", "Medical device"] };
    expect(evalCondition(c, { category: "IVD reagent" })).toBe(true);
    expect(evalCondition(c, { category: "Medical device" })).toBe(true);
    expect(evalCondition(c, { category: "Lab consumable" })).toBe(false);
    expect(evalCondition(c, { category: null })).toBe(false);
    expect(evalCondition(c, {})).toBe(false);
  });

  it("'gt' compares numerically, including formatted strings", () => {
    const c = { field: "creditLimit", op: "gt" as const, value: 50000 };
    expect(evalCondition(c, { creditLimit: 80000 })).toBe(true);
    expect(evalCondition(c, { creditLimit: "80,000" })).toBe(true);
    expect(evalCondition(c, { creditLimit: 30000 })).toBe(false);
    expect(evalCondition(c, { creditLimit: 50000 })).toBe(false);
    expect(evalCondition(c, { creditLimit: null })).toBe(false);
    expect(evalCondition(c, { creditLimit: "not a number" })).toBe(false);
  });

  it("supports equals, isEmpty and notEmpty", () => {
    expect(evalCondition({ field: "x", op: "equals", value: "Yes" }, { x: "Yes" })).toBe(true);
    expect(evalCondition({ field: "x", op: "equals", value: "Yes" }, { x: "No" })).toBe(false);
    expect(evalCondition({ field: "x", op: "isEmpty" }, { x: "  " })).toBe(true);
    expect(evalCondition({ field: "x", op: "isEmpty" }, {})).toBe(true);
    expect(evalCondition({ field: "x", op: "notEmpty" }, { x: 0 })).toBe(true);
    expect(evalCondition({ field: "x", op: "notEmpty" }, { x: null })).toBe(false);
  });
});

describe("isFieldRequired / isFieldVisible", () => {
  it("'in' with [IVD reagent, Medical device] makes regLicenceNo required", () => {
    expect(isFieldRequired(regLicence, { category: "IVD reagent" })).toBe(true);
    expect(isFieldRequired(regLicence, { category: "Medical device" })).toBe(true);
    expect(isFieldRequired(regLicence, { category: "Lab consumable" })).toBe(false);
    expect(isFieldRequired(regLicence, {})).toBe(false);
  });

  it("required fields stay required regardless of data", () => {
    const f = ITEM.fields.find((x) => x.key === "itemName")!;
    expect(isFieldRequired(f, {})).toBe(true);
  });

  it("showIf hides a field until its condition holds", () => {
    const f: FieldDef = { key: "swift", label: "SWIFT", type: "text", required: true, showIf: { field: "bankName", op: "notEmpty" } };
    expect(isFieldVisible(f, {})).toBe(false);
    expect(isFieldVisible(f, { bankName: "DBS" })).toBe(true);
    expect(isFieldVisible(ITEM.fields[0], {})).toBe(true);
  });
});

describe("validateRequest", () => {
  it("flags missing required fields, including conditionally required ones", () => {
    const res = validateRequest(ITEM, { itemName: "Dengue NS1 Ag Rapid Test 25T", category: "IVD reagent" });
    expect(res.ok).toBe(false);
    expect(res.errors.regLicenceNo).toMatch(/required/i);
    expect(res.errors.manufacturer).toMatch(/required/i);
    expect(res.errors.itemName).toBeUndefined();
  });

  it("checks maxLength, pattern and number type", () => {
    const res = validateRequest(CUSTOMER, {
      customerName: "x".repeat(101),
      creditLimit: "eighty thousand",
      swift: "dbs",
    });
    expect(res.errors.customerName).toMatch(/100/);
    expect(res.errors.creditLimit).toMatch(/number/i);
    expect(res.errors.swift).toBe("8 or 11 characters, e.g. DBSSSGSG");
  });

  it("does not require hidden fields", () => {
    const domain = {
      ...ITEM,
      fields: [
        { key: "a", label: "A", type: "text" as const, required: true, showIf: { field: "b", op: "equals" as const, value: "Yes" } },
      ],
    };
    expect(validateRequest(domain, {}).ok).toBe(true);
    expect(validateRequest(domain, { b: "Yes" }).ok).toBe(false);
  });

  it("passes a complete item request", () => {
    const res = validateRequest(ITEM, {
      itemName: "Dengue NS1 Ag Rapid Test 25T",
      category: "IVD reagent",
      productGroup: "A",
      manufacturer: "Biosens Diagnostics",
      uom: "BOX",
      costPrice: 182,
      salesPrice: "265.00",
      regLicenceNo: "DE0512345",
      entity: "SPD",
    });
    expect(res).toEqual({ ok: true, errors: {} });
  });

  it("never throws on an invalid admin-entered regex", () => {
    const domain = { ...ITEM, fields: [{ key: "a", label: "A", type: "text" as const, required: false, pattern: "([" }] };
    expect(() => validateRequest(domain, { a: "x" })).not.toThrow();
  });
});
