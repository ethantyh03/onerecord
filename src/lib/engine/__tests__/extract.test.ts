import { describe, expect, it } from "vitest";
import { extractFieldsRules, redactSensitive } from "../extract";
import { AMY_EMAIL, COSTCENTRE, CUSTOMER, EXTEND, ITEM, VENDOR } from "./fixtures";
import { DEFAULT_DOMAINS } from "@/config/default-config";
const DEFAULT_ITEM_FIELDS = DEFAULT_DOMAINS.find((d) => d.id === "item")!.fields;

describe("redactSensitive", () => {
  it("removes bank account numbers", () => {
    const r = redactSensitive("Please pay to DBS Bank account 1234567890 by Friday.");
    expect(r.text).not.toContain("1234567890");
    expect(r.redactions).toBe(1);
  });

  it("removes IBAN, SWIFT/BIC and credit limit amounts", () => {
    const r = redactSensitive(
      "IBAN GB82 WEST 1234 5698 7654 32\nSWIFT: DBSSSGSG\nCredit limit requested: S$80,000\nAcct no 012-345678-9",
    );
    expect(r.text).not.toMatch(/GB82|WEST 1234|DBSSSGSG|80,000|345678/);
    expect(r.text).toMatch(/Credit limit requested: /);
    expect(r.redactions).toBe(4);
  });

  it("keeps phone numbers, UENs, postcodes and PO numbers", () => {
    const s = "Tel +65 6779 5555, fax 6779 1234 5. UEN 198500123K. Singapore 119074. PO 45001234 attached.";
    const r = redactSensitive(s);
    expect(r.text).toBe(s);
    expect(r.redactions).toBe(0);
  });

  it("does not mistake ordinary capitalised words for SWIFT codes", () => {
    const s = "PLEASE CREATE NEW CUSTOMER HOSPITAL ACCOUNT";
    expect(redactSensitive(s)).toEqual({ text: s, redactions: 0 });
  });

  it("never throws on empty or junk input", () => {
    expect(redactSensitive("")).toEqual({ text: "", redactions: 0 });
    expect(() => redactSensitive("%%%\u0000\n\t😀")).not.toThrow();
  });
});

describe("extractFieldsRules — Amy's email (item)", () => {
  const res = extractFieldsRules(AMY_EMAIL, ITEM);

  it("fills itemName and category, and flags the missing licence", () => {
    expect(res.values.itemName).toBe("Dengue NS1 Ag Rapid Test 25T");
    expect(res.values.category).toBe("IVD reagent");
    expect(res.values.regLicenceNo).toBeUndefined();
    expect(res.missing).toContain("regLicenceNo");
  });

  it("fills the rest of the item from free text", () => {
    expect(res.values).toMatchObject({
      productGroup: "A",
      manufacturer: "Biosens Diagnostics",
      uom: "BOX",
      packSize: "25 tests/box",
      costPrice: 182,
      salesPrice: 265,
      storage: "2–30°C",
      entity: "SPD",
      countries: "MY, SG",
    });
    expect(res.missing).toEqual(["regLicenceNo"]);
  });

  it("reports a confidence in (0, 1] for every filled field", () => {
    expect(Object.keys(res.confidence).sort()).toEqual(Object.keys(res.values).sort());
    for (const c of Object.values(res.confidence)) {
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(res.confidence.itemName).toBeGreaterThan(res.confidence.productGroup);
  });

  it("picks up a licence number when one is given", () => {
    const r = extractFieldsRules(`${AMY_EMAIL} HSA reg no DE0512345.`, ITEM);
    expect(r.values.regLicenceNo).toBe("DE0512345");
    expect(r.missing).toEqual([]);
  });
});

describe("extractFieldsRules — other domains", () => {
  it("customer email", () => {
    const email = [
      "Hi team, please set up new customer Natl Univ Hosp for SPD.",
      "Address: 5 Lower Kent Ridge Road, Singapore 119074. UEN 198500123K. Tel +65 6779 5555.",
      "Contact: Dr Lim Hui Min, lab.procurement@nuh-demo.example",
      "Public hospital, payment terms 30 days, credit limit S$80,000.",
      "Thanks, Amy (amy.lim@livesgroup.example)",
    ].join("\n");
    const r = extractFieldsRules(email, CUSTOMER);
    expect(r.values).toMatchObject({
      customerName: "Natl Univ Hosp",
      country: "SG",
      entity: "SPD",
      taxId: "198500123K",
      street: "5 Lower Kent Ridge Road",
      city: "Singapore",
      zipCode: "119074",
      phone: "+65 6779 5555",
      email: "lab.procurement@nuh-demo.example",
      contactPerson: "Dr Lim Hui Min",
      segment: "Public hospital",
      paymentTerms: "Net 30",
      creditLimit: 80000,
    });
    expect(r.missing).toEqual([]);
  });

  it("spreadsheet rows pasted with tabs (vendor)", () => {
    const sheet = [
      "Vendor Name\tCountry\tTax ID\tAddress\tEmail\tBank\tAccount No\tSWIFT\tPayment Terms",
      "Biosens Diagnostics Co., Ltd.\tSG\t201912345M\t8 Science Park Drive, Singapore 118264\tar@biosens.example\tDBS Bank\t072-123456-7\tDBSSSGSG\tNet 30",
    ].join("\n");
    const r = extractFieldsRules(sheet, VENDOR);
    expect(r.values).toMatchObject({
      vendorName: "Biosens Diagnostics Co., Ltd.",
      country: "SG",
      taxId: "201912345M",
      street: "8 Science Park Drive",
      zipCode: "118264",
      email: "ar@biosens.example",
      bankName: "DBS Bank",
      bankAccountNo: "072-123456-7",
      swift: "DBSSSGSG",
      paymentTerms: "Net 30",
    });
    expect(r.missing).toEqual(["suppliesRegulated"]);
  });

  it("cost centre and extension requests", () => {
    const cc = extractFieldsRules("Cost centre name: SG Molecular Dx Lab\nEntity: SPD\nCountry: Singapore\nBudget owner: Daniel Ong\nDimension 2", COSTCENTRE);
    expect(cc.values).toMatchObject({ centreName: "SG Molecular Dx Lab", entity: "SPD", country: "SG", owner: "Daniel Ong", dimension: "2 · Business unit" });

    const ext = extractFieldsRules(
      "Please extend National University Hospital (C-SG-00017) to QTG. Ship-to address: Level 3, NUHS Tower Block, 1E Kent Ridge Road, Singapore 119228. No change to credit terms. Reason: QTG starts supplying lab consumables to the hospital.",
      EXTEND,
    );
    expect(ext.values).toMatchObject({
      existingCode: "C-SG-00017",
      existingName: "National University Hospital",
      extendToEntity: "QTG",
      newShipToAddress: "Level 3, NUHS Tower Block, 1E Kent Ridge Road, Singapore 119228",
      changesCreditTerms: "No",
      reason: "QTG starts supplying lab consumables to the hospital",
    });
    expect(ext.missing).toEqual([]);
  });

  it("junk or empty text yields no values, every required field missing, and never throws", () => {
    for (const junk of ["", "   ", "asdf qwerty zxcv", "!!!???", "lorem\n\n\t\t\n:::", "1234567890 1234567890"]) {
      const r = extractFieldsRules(junk, ITEM);
      expect(r.values).toEqual({});
      expect(r.missing).toEqual(["itemName", "category", "productGroup", "manufacturer", "uom", "costPrice", "salesPrice", "entity"]);
    }
  });

  it("only returns options that exist for select fields", () => {
    const r = extractFieldsRules("Category: Something odd\nUoM: CRATE", ITEM);
    expect(r.values.category).toBeUndefined();
    expect(r.values.uom).toBeUndefined();
  });
});

describe("extractFieldsRules — Amy's K2EDTA tube (IVD-regulated lab consumable)", () => {
  const ITEM_LIVE = { ...ITEM, fields: DEFAULT_ITEM_FIELDS };
  it("maps K2EDTA / blood collection tube text to the IVD consumable category and product group B", () => {
    const r = extractFieldsRules(
      "Hi MDM, please set up a new item code. Item: K2EDTA Blood Collection Tube 4 mL, 100/pk. Manufacturer: Greiner Bio-One (AT). For SG + MY hospitals, three PRs already waiting.",
      ITEM_LIVE,
    );
    expect(r.values.category).toBe("Lab consumable – IVD medical device");
    expect(r.values.productGroup).toBe("B");
    expect(r.missing).toContain("regLicenceNo");
  });

  it("plain EDTA / blood collection tube wording maps the same way", () => {
    expect(extractFieldsRules("We need EDTA vacuum tubes for a clinic tender.", ITEM_LIVE).values.category).toBe(
      "Lab consumable – IVD medical device",
    );
    expect(extractFieldsRules("New blood collection tube, 3 mL, sodium citrate.", ITEM_LIVE).values.category).toBe(
      "Lab consumable – IVD medical device",
    );
  });
});
