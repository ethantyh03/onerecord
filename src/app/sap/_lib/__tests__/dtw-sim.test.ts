import { describe, expect, it } from "vitest";
import { buildDtwFiles } from "@/lib/engine/dtw";
import type { DomainConfig, DtwFile, MdmRequest } from "@/lib/types";
import { isChildFile, isSensitiveColumn, primaryKeyOf, simulateDtwImport, simulationLog } from "../dtw-sim";

function domain(id: string, sapObject: string, codePrefix: string): DomainConfig {
  return { id, label: id, description: "", icon: "box", sapObject, codePrefix, fields: [], stages: [], dupCheck: false, enabled: true };
}

function request(domainId: string, data: MdmRequest["data"], over: Partial<MdmRequest> = {}): MdmRequest {
  return {
    id: "REQ-1042",
    domainId,
    title: "New Item: Dengue IgG/IgM Combo 30T",
    requestorId: "amy",
    entity: "SPD",
    country: "MY",
    createdAt: "2026-10-20T02:00:00.000Z",
    status: "mdm_review",
    data,
    configVersion: 1,
    steps: [],
    blockedPrIds: ["PR-5521", "PR-5527"],
    ...over,
  };
}

const ITEM = domain("item", "oItems", "I");
const CUSTOMER = domain("customer", "oBusinessPartners", "C");
const VENDOR = domain("vendor", "oBusinessPartners", "V");

function file(over: Partial<DtwFile>): DtwFile {
  return { fileName: "oBusinessPartners.csv", object: "oBusinessPartners", headers: [], dbHeaders: [], rows: [], ...over };
}

describe("simulateDtwImport on engine-generated files", () => {
  it("passes REQ-1042 (item) with 0 errors and 0 warnings", () => {
    const files = buildDtwFiles(
      request("item", { itemName: "Dengue IgG/IgM Combo 30T", productGroup: "A", category: "IVD reagent", uom: "Box" }),
      ITEM,
      "I-A-000813",
    );
    const sim = simulateDtwImport(files);
    expect(sim.errorCount).toBe(0);
    expect(sim.warningCount).toBe(0);
    expect(sim.ok).toBe(true);
    expect(sim.objects).toBe(1);
    expect(primaryKeyOf(files)).toBe("I-A-000813");
    expect(simulationLog(sim).at(-1)).toBe("Simulation complete: 0 errors, 0 warnings");
  });

  it("passes a customer with addresses, linking child rows to the parent", () => {
    const files = buildDtwFiles(
      request("customer", {
        customerName: "Harbourfront Specialist Clinic Pte Ltd",
        taxId: "201912345K",
        email: "accounts@harbourfront-clinic.example",
        phone: "+65 6221 4800",
        street: "1 Maritime Square #09-12",
        zipCode: "099253",
        country: "SG",
      }),
      CUSTOMER,
      "C-SG-00123",
    );
    expect(files.map((f) => f.fileName)).toContain("BPAddresses.csv");
    expect(files.filter(isChildFile).map((f) => f.fileName)).toEqual(["BPAddresses.csv"]);
    const sim = simulateDtwImport(files);
    expect(sim.errorCount).toBe(0);
    expect(sim.objects).toBe(1);
  });

  it("passes a vendor with a bank account", () => {
    const files = buildDtwFiles(
      request("vendor", {
        vendorName: "Meridian Bioscience Supplies Sdn Bhd",
        taxId: "202301018842",
        bankAccountNo: "514012345678",
        swift: "MBBEMYKL",
        bankName: "Maybank",
        country: "MY",
      }),
      VENDOR,
      "V-MY-00045",
    );
    expect(files.map((f) => f.fileName)).toContain("BPBankAccounts.csv");
    expect(simulateDtwImport(files).errorCount).toBe(0);
  });
});

describe("simulateDtwImport catches what DTW would reject", () => {
  it("flags a CardName over 100 characters", () => {
    const sim = simulateDtwImport([
      file({ headers: ["RecordKey", "CardCode", "CardName"], dbHeaders: ["RecordKey", "CardCode", "CardName"], rows: [["1", "C-SG-00123", "x".repeat(101)]] }),
    ]);
    expect(sim.ok).toBe(false);
    expect(sim.files[0].errors[0]).toMatchObject({ column: "CardName", line: 3 });
  });

  it("flags a profit-centre code longer than PrcCode's 8 characters", () => {
    const sim = simulateDtwImport([
      file({
        fileName: "oProfitCenter.csv",
        object: "oProfitCenter",
        headers: ["CenterCode", "CenterName"],
        dbHeaders: ["PrcCode", "PrcName"],
        rows: [["CC-SG-0031", "SPD Field Service SG"]],
      }),
    ]);
    expect(sim.errorCount).toBe(1);
    expect(sim.files[0].errors[0].message).toMatch(/allows 8/);
  });

  it("flags empty mandatory fields, bad CardType and bad currency", () => {
    const sim = simulateDtwImport([
      file({
        headers: ["RecordKey", "CardCode", "CardName", "CardType", "Currency"],
        dbHeaders: ["RecordKey", "CardCode", "CardName", "CardType", "Currency"],
        rows: [["1", "C-SG-00124", "", "X", "sgd"]],
      }),
    ]);
    const messages = sim.files[0].errors.map((e) => e.message).join(" | ");
    expect(messages).toMatch(/Mandatory field CardName is empty/);
    expect(messages).toMatch(/CardType "X"/);
    expect(messages).toMatch(/Currency "sgd"/);
  });

  it("flags a child row whose ParentKey matches no parent", () => {
    const sim = simulateDtwImport([
      file({ headers: ["RecordKey", "CardCode", "CardName"], dbHeaders: ["RecordKey", "CardCode", "CardName"], rows: [["C-SG-00123", "C-SG-00123", "Clinic"]] }),
      file({
        fileName: "BPAddresses.csv",
        object: "BPAddresses",
        headers: ["ParentKey", "LineNum", "AddressName"],
        dbHeaders: ["CardCode", "LineNum", "Address"],
        rows: [["C-SG-99999", "0", "Bill to"]],
      }),
    ]);
    expect(sim.files[1].errors[0].message).toMatch(/no matching parent/);
  });

  it("flags header rows of different lengths and short data rows", () => {
    const sim = simulateDtwImport([file({ headers: ["CardCode", "CardName"], dbHeaders: ["CardCode"], rows: [["C-SG-00123"]] })]);
    const messages = sim.files[0].errors.map((e) => e.message).join(" | ");
    expect(messages).toMatch(/Header rows differ/);
    expect(messages).toMatch(/Row has 1 values/);
  });

  it("warns (not errors) on stray whitespace", () => {
    const sim = simulateDtwImport([
      file({ headers: ["RecordKey", "CardCode", "CardName"], dbHeaders: ["RecordKey", "CardCode", "CardName"], rows: [["1", "C-SG-00123", " Clinic "]] }),
    ]);
    expect(sim.ok).toBe(true);
    expect(sim.warningCount).toBe(1);
  });
});

describe("isSensitiveColumn", () => {
  it("covers bank, credit and payment-terms columns in either spelling", () => {
    expect(isSensitiveColumn("AccountNo")).toBe(true);
    expect(isSensitiveColumn("BPBankAccounts.AccountNo")).toBe(true);
    expect(isSensitiveColumn("CreditLimit")).toBe(true);
    expect(isSensitiveColumn("PayTermsGrpCode")).toBe(true);
    expect(isSensitiveColumn("CardName")).toBe(false);
    expect(isSensitiveColumn("U_Secret", ["U_Secret"])).toBe(true);
  });
});
