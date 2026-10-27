import { describe, expect, it } from "vitest";
import { buildDtwFiles, dtwToCsv, toServiceLayerPayload } from "../dtw";
import { COSTCENTRE, CUSTOMER, EXTEND, ITEM, VENDOR } from "./fixtures";
import type { DomainConfig, MdmRequest } from "@/lib/types";

function req(domainId: string, data: MdmRequest["data"], country: MdmRequest["country"] = "SG"): MdmRequest {
  return {
    id: "REQ-1038",
    domainId,
    title: "",
    requestorId: "amy",
    entity: "SPD",
    country,
    createdAt: "2026-10-20T01:00:00.000Z",
    submittedAt: "2026-10-20T02:00:00.000Z",
    status: "mdm_review",
    data,
    configVersion: 1,
    steps: [],
    blockedPrIds: [],
  };
}

const customer = req("customer", {
  customerName: "Klinik Kesihatan Ampang Jaya",
  country: "MY",
  entity: "SPD",
  taxId: "C 2584563202",
  street: "12, Jalan Mamanda 9",
  city: "Ampang",
  zipCode: "68000",
  phone: "+60 3-4270 1234",
  email: "procurement@kkaj.example",
  contactPerson: "Dr Farah Aziz",
  segment: "Clinic",
  paymentTerms: "Net 45",
  creditLimit: 80000,
  currency: "MYR",
}, "MY");

const byName = (files: ReturnType<typeof buildDtwFiles>, name: string) => files.find((f) => f.fileName === name)!;
const cell = (f: ReturnType<typeof buildDtwFiles>[number], header: string, row = 0) => f.rows[row][f.headers.indexOf(header)];

describe("buildDtwFiles — business partners", () => {
  it("customer request ⇒ oBusinessPartners.csv with headers[0] CardCode and the CardName value", () => {
    const files = buildDtwFiles(customer, CUSTOMER, "C-MY-00123");
    expect(files.map((f) => f.fileName)).toEqual(["oBusinessPartners.csv", "BPAddresses.csv"]);
    const bp = byName(files, "oBusinessPartners.csv");
    expect(bp.object).toBe("oBusinessPartners");
    expect(bp.headers[0]).toBe("CardCode");
    expect(bp.headers.length).toBe(bp.dbHeaders.length);
    expect(bp.rows).toHaveLength(1);
    expect(bp.rows[0].length).toBe(bp.headers.length);
    expect(cell(bp, "CardCode")).toBe("C-MY-00123");
    expect(cell(bp, "CardName")).toBe("Klinik Kesihatan Ampang Jaya");
    expect(cell(bp, "CardType")).toBe("cCustomer");
    expect(cell(bp, "FederalTaxID")).toBe("C 2584563202");
    expect(cell(bp, "EmailAddress")).toBe("procurement@kkaj.example");
    expect(cell(bp, "CreditLimit")).toBe("80000");
    expect(cell(bp, "Currency")).toBe("MYR");
    expect(cell(bp, "U_OneRecordRef")).toBe("REQ-1038");
  });

  it("second header row carries the DB column names", () => {
    const bp = buildDtwFiles(customer, CUSTOMER, "C-MY-00123")[0];
    const db = (h: string) => bp.dbHeaders[bp.headers.indexOf(h)];
    expect(db("CardCode")).toBe("CardCode");
    expect(db("FederalTaxID")).toBe("LicTradNum");
    expect(db("EmailAddress")).toBe("E_Mail");
    expect(db("PayTermsGrpCode")).toBe("GroupNum");
    expect(db("CreditLimit")).toBe("CreditLine");
  });

  it("writes bill-to and ship-to addresses linked by ParentKey", () => {
    const addr = byName(buildDtwFiles(customer, CUSTOMER, "C-MY-00123"), "BPAddresses.csv");
    expect(addr.headers.slice(0, 2)).toEqual(["ParentKey", "LineNum"]);
    expect(addr.dbHeaders[0]).toBe("CardCode");
    expect(addr.rows).toHaveLength(2);
    expect(addr.rows.map((r) => r[addr.headers.indexOf("AddressType")])).toEqual(["bo_BillTo", "bo_ShipTo"]);
    expect(cell(addr, "ParentKey")).toBe("C-MY-00123");
    expect(cell(addr, "Street")).toBe("12, Jalan Mamanda 9");
    expect(cell(addr, "ZipCode")).toBe("68000");
    expect(cell(addr, "Country")).toBe("MY");
  });

  it("vendor ⇒ supplier card plus BPBankAccounts", () => {
    const vendor = req("vendor", {
      vendorName: "Biosens Diagnostics Co., Ltd.",
      country: "SG",
      taxId: "201912345M",
      street: "8 Science Park Drive",
      zipCode: "118264",
      email: "ar@biosens.example",
      suppliesRegulated: "Yes",
      bankName: "DBS Bank Ltd",
      bankAccountNo: "072-123456-7",
      swift: "DBSSSGSG",
      paymentTerms: "Net 30",
    });
    const files = buildDtwFiles(vendor, VENDOR, "V-SG-00045");
    expect(files.map((f) => f.fileName)).toEqual(["oBusinessPartners.csv", "BPAddresses.csv", "BPBankAccounts.csv"]);
    expect(cell(files[0], "CardType")).toBe("cSupplier");
    const bank = files[2];
    expect(bank.headers).toEqual(expect.arrayContaining(["ParentKey", "BankCode", "AccountNo", "Country", "BICSwiftCode"]));
    expect(cell(bank, "AccountNo")).toBe("072-123456-7");
    expect(cell(bank, "BICSwiftCode")).toBe("DBSSSGSG");
    expect(cell(bank, "BankCode")).toBe("DBSS");
    expect(bank.dbHeaders[bank.headers.indexOf("AccountNo")]).toBe("Account");
  });

  it("extend ⇒ BPAddresses only, keyed on the existing code", () => {
    const ext = req("extend", {
      existingCode: "C-SG-00017",
      existingName: "National University Hospital",
      extendToEntity: "QTG",
      newShipToAddress: "Level 3, NUHS Tower Block, 1E Kent Ridge Road, Singapore 119228",
      changesCreditTerms: "No",
      reason: "QTG starts supplying lab consumables",
    });
    const files = buildDtwFiles(ext, EXTEND, "C-SG-00017");
    expect(files.map((f) => f.fileName)).toEqual(["BPAddresses.csv"]);
    expect(cell(files[0], "ParentKey")).toBe("C-SG-00017");
    expect(cell(files[0], "AddressType")).toBe("bo_ShipTo");
    expect(cell(files[0], "ZipCode")).toBe("119228");
    expect(cell(files[0], "AddressName")).toMatch(/QTG/);
  });
});

describe("buildDtwFiles — items and cost centres", () => {
  const item = req("item", {
    itemName: "Dengue NS1 Ag Rapid Test 25T",
    category: "IVD reagent",
    productGroup: "A",
    manufacturer: "Biosens Diagnostics",
    uom: "BOX",
    packSize: "25 tests/box",
    costPrice: 182,
    salesPrice: 265,
    storage: "2–30°C",
    regLicenceNo: "DE0512345",
    entity: "SPD",
  });

  it("item ⇒ oItems with SAP and DB names, UDF licence and batch management", () => {
    const files = buildDtwFiles(item, ITEM, "I-A-000812");
    const items = byName(files, "oItems.csv");
    expect(items.headers[0]).toBe("ItemCode");
    expect(items.headers).toEqual(
      expect.arrayContaining(["ItemName", "ItemsGroupCode", "InventoryUOM", "SalesUnit", "PurchaseItem", "SalesItem", "InventoryItem", "U_RegLicenceNo"]),
    );
    const db = (h: string) => items.dbHeaders[items.headers.indexOf(h)];
    expect(db("ItemsGroupCode")).toBe("ItmsGrpCod");
    expect(db("InventoryUOM")).toBe("InvntryUom");
    expect(db("U_RegLicenceNo")).toBe("U_RegLicenceNo");
    expect(cell(items, "ItemCode")).toBe("I-A-000812");
    expect(cell(items, "ItemName")).toBe("Dengue NS1 Ag Rapid Test 25T");
    expect(cell(items, "InventoryUOM")).toBe("BOX");
    expect(cell(items, "U_RegLicenceNo")).toBe("DE0512345");
    expect(cell(items, "ManageBatchNumbers")).toBe("tYES");
    expect(cell(items, "ItemsGroupCode")).toBe("101");
  });

  it("item prices go to Items_Prices", () => {
    const prices = byName(buildDtwFiles(item, ITEM, "I-A-000812"), "Items_Prices.csv");
    expect(prices.rows.map((r) => r[prices.headers.indexOf("Price")])).toEqual(["265", "182"]);
  });

  it("cost centre ⇒ oProfitCenter", () => {
    const cc = req("costcentre", { centreName: "SG Molecular Dx Lab", entity: "SPD", country: "SG", owner: "Daniel Ong", dimension: "2 · Business unit" });
    const files = buildDtwFiles(cc, COSTCENTRE, "CC-SG-0031");
    expect(files.map((f) => f.fileName)).toEqual(["oProfitCenter.csv"]);
    const f = files[0];
    expect(f.headers.slice(0, 4)).toEqual(["CenterCode", "CenterName", "InWhichDimension", "Effectivefrom"]);
    expect(f.dbHeaders.slice(0, 4)).toEqual(["PrcCode", "PrcName", "DimCode", "ValidFrom"]);
    // OPRC.PrcCode allows 8 characters, so SAP holds CC-SG-0031 as SG-0031.
    expect(f.rows[0].slice(0, 4)).toEqual(["SG-0031", "SG Molecular Dx Lab", "2", "20261020"]);
  });

  it("maps admin-added fields through FieldDef.sapField", () => {
    const domain: DomainConfig = {
      ...ITEM,
      fields: [...ITEM.fields, { key: "shelfLife", label: "Shelf life (months)", type: "number", required: false, sapField: "U_ShelfLife" }],
    };
    const items = buildDtwFiles({ ...item, data: { ...item.data, shelfLife: 18 } }, domain, "I-A-000812")[0];
    expect(cell(items, "U_ShelfLife")).toBe("18");
  });
});

describe("dtwToCsv", () => {
  it("writes both header rows then data, RFC 4180 quoted, CRLF", () => {
    const csv = dtwToCsv({
      fileName: "x.csv",
      object: "oBusinessPartners",
      headers: ["CardCode", "CardName"],
      dbHeaders: ["CardCode", "CardName"],
      rows: [["C-SG-00123", 'Hospital "A", Ward 3\nAnnex']],
    });
    expect(csv).toBe('CardCode,CardName\r\nCardCode,CardName\r\nC-SG-00123,"Hospital ""A"", Ward 3\nAnnex"\r\n');
  });
});

describe("toServiceLayerPayload", () => {
  it("BusinessPartners POST with child collections", () => {
    const p = toServiceLayerPayload(customer, CUSTOMER, "C-MY-00123");
    expect(p.method).toBe("POST");
    expect(p.path).toBe("/b1s/v2/BusinessPartners");
    expect(p.body).toMatchObject({ CardCode: "C-MY-00123", CardName: "Klinik Kesihatan Ampang Jaya", CardType: "cCustomer", CreditLimit: 80000 });
    expect((p.body.BPAddresses as unknown[]).length).toBe(2);
  });

  it("Items and ProfitCenters", () => {
    const item = req("item", { itemName: "Dengue NS1 Ag Rapid Test 25T", productGroup: "A", uom: "BOX", category: "IVD reagent", salesPrice: 265 });
    const pi = toServiceLayerPayload(item, ITEM, "I-A-000812");
    expect(pi.path).toBe("/b1s/v2/Items");
    expect(pi.body).toMatchObject({ ItemCode: "I-A-000812", ItemType: "itItems", InventoryUOM: "BOX" });
    const cc = req("costcentre", { centreName: "SG Molecular Dx Lab", dimension: "1" });
    const pc = toServiceLayerPayload(cc, COSTCENTRE, "CC-SG-0031");
    expect(pc.path).toBe("/b1s/v2/ProfitCenters");
    expect(pc.body).toMatchObject({ CenterCode: "SG-0031", CenterName: "SG Molecular Dx Lab", InWhichDimension: 1 });
  });

  it("extension PATCHes the existing business partner", () => {
    const ext = req("extend", { existingCode: "C-SG-00017", newShipToAddress: "1E Kent Ridge Road, Singapore 119228", extendToEntity: "QTG" });
    const p = toServiceLayerPayload(ext, EXTEND, "C-SG-00017");
    expect(p.method).toBe("PATCH");
    expect(p.path).toBe("/b1s/v2/BusinessPartners('C-SG-00017')");
  });
});
