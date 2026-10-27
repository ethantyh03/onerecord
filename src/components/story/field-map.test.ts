import { describe, expect, it } from "vitest";
import { DEFAULT_DOMAINS } from "@/config/default-config";
import { buildFieldMap } from "./field-map";

const domain = (id: string) => DEFAULT_DOMAINS.find((d) => d.id === id)!;

describe("field map (form field → SAP property → DB column)", () => {
  it("maps the item name to OITM.ItemName via oItems.csv", () => {
    const rows = buildFieldMap(domain("item"));
    const name = rows.find((r) => r.key === "itemName")!;
    expect(name.sapProperty).toBe("ItemName");
    expect(name.dtwFile).toBe("oItems.csv");
    expect(name.dbColumn).toBe("OITM.ItemName");
    expect(rows[0].dbColumn).toBe("OITM.ItemCode");
  });

  it("maps customer tax ID to OCRD.LicTradNum and street to CRD1.Street", () => {
    const rows = buildFieldMap(domain("customer"));
    expect(rows.find((r) => r.key === "taxId")!.dbColumn).toBe("OCRD.LicTradNum");
    expect(rows.find((r) => r.key === "street")!.dbColumn).toBe("CRD1.Street");
    expect(rows.find((r) => r.key === "creditLimit")!.dbColumn).toBe("OCRD.CreditLine");
  });

  it("extend is an update keyed by CardCode carrying U_Entities", () => {
    const rows = buildFieldMap(domain("extend"));
    expect(rows[0].sapProperty).toBe("CardCode");
    expect(rows.find((r) => r.key === "extendToEntity")!.dbColumn).toBe("OCRD.U_Entities");
  });
});
