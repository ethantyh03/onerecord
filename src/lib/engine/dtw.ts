import type { CountryCode, DomainConfig, DtwFile, FieldDef, FieldValue, MdmRequest } from "@/lib/types";
import { isEmptyValue, toNumber } from "./conditions";
import { productGroupOf, sapKeyFor } from "./codes";
import { parseAddress } from "./extract";

/**
 * SAP Business One hand-off artefacts.
 *
 * Phase 1: Data Transfer Workbench (DTW) import files. Each file mirrors a DTW template: header row 1 holds the
 * DI API / Service Layer property names, header row 2 the database column names, then the data rows. DTW maps
 * columns by header name, so CardCode / ItemCode lead each parent file for readability and RecordKey follows.
 * RecordKey is set to the new code, and child files (BPAddresses, BPBankAccounts, Items_Prices) link to it
 * through ParentKey. One-off UDFs (U_*) sit at the end of the template under their technical names.
 *
 * Phase 2: the equivalent Service Layer (OData v4) call, shown for reference only.
 *
 * Request data maps to SAP fields through FieldDef.sapField first ("CardName", "BPAddresses.Street",
 * "U_ShelfLife"…); fields without one fall back to the standard Tesseract field keys.
 */

type Kind = "bp" | "extend" | "item" | "costcentre" | "generic";
type Ctx = {
  req: MdmRequest;
  domain: DomainConfig;
  data: Record<string, FieldValue>;
  code: string;
  kind: Kind;
  isVendor: boolean;
};

// ---------------------------------------------------------------------------------------------
// SAP property → database column (2nd header row), per DTW object

const DB_COLUMNS: Record<string, Record<string, string>> = {
  oBusinessPartners: {
    RecordKey: "RecordKey",
    CardCode: "CardCode",
    CardName: "CardName",
    CardForeignName: "CardFName",
    CardType: "CardType",
    GroupCode: "GroupCode",
    FederalTaxID: "LicTradNum",
    Currency: "Currency",
    Phone1: "Phone1",
    Phone2: "Phone2",
    Cellular: "Cellular",
    Fax: "Fax",
    EmailAddress: "E_Mail",
    Website: "IntrntSite",
    ContactPerson: "CntctPrsn",
    PayTermsGrpCode: "GroupNum",
    PriceListNum: "ListNum",
    CreditLimit: "CreditLine",
    MaxCommitment: "DebtLine",
    SalesPersonCode: "SlpCode",
    DebitorAccount: "DebPayAcct",
    VatLiable: "VatStatus",
    Notes: "Free_Text",
    Valid: "validFor",
    Frozen: "frozenFor",
  },
  BPAddresses: {
    ParentKey: "CardCode",
    LineNum: "LineNum",
    AddressName: "Address",
    AddressType: "AdresType",
    Street: "Street",
    StreetNo: "StreetNo",
    Block: "Block",
    BuildingFloorRoom: "Building",
    City: "City",
    County: "County",
    State: "State",
    ZipCode: "ZipCode",
    Country: "Country",
  },
  BPBankAccounts: {
    ParentKey: "CardCode",
    LineNum: "LineNum",
    BankCode: "BankCode",
    AccountNo: "Account",
    AccountName: "AcctName",
    Branch: "Branch",
    Country: "Country",
    BICSwiftCode: "SwiftNum",
    IBAN: "IBAN",
  },
  oItems: {
    RecordKey: "RecordKey",
    ItemCode: "ItemCode",
    ItemName: "ItemName",
    ForeignName: "FrgnName",
    ItemsGroupCode: "ItmsGrpCod",
    ItemType: "ItemType",
    InventoryItem: "InvntItem",
    SalesItem: "SellItem",
    PurchaseItem: "PrchseItem",
    InventoryUOM: "InvntryUom",
    SalesUnit: "SalUnitMsr",
    PurchaseUnit: "BuyUnitMsr",
    ManageBatchNumbers: "ManBtchNum",
    ManageSerialNumbers: "ManSerNum",
    Mainsupplier: "CardCode",
    SupplierCatalogNo: "SuppCatNum",
    Manufacturer: "FirmCode",
    BarCode: "CodeBars",
    LeadTime: "LeadTime",
    MinOrderQuantity: "MinOrdrQty",
    DefaultWarehouse: "DfltWH",
  },
  Items_Prices: {
    ParentKey: "ItemCode",
    LineNum: "LineNum",
    PriceList: "PriceList",
    Price: "Price",
    Currency: "Currency",
  },
  oProfitCenter: {
    CenterCode: "PrcCode",
    CenterName: "PrcName",
    InWhichDimension: "DimCode",
    Effectivefrom: "ValidFrom",
    EffectiveTo: "ValidTo",
    GroupCode: "GrpCode",
    CostCenterType: "CCTypeCode",
    Active: "Active",
  },
};

function dbColumn(object: string, sap: string): string {
  return DB_COLUMNS[object]?.[sap] ?? sap;
}

// ---------------------------------------------------------------------------------------------
// Sandbox reference codes (the simulated company's OCRG / OCTG / OITB / OPLN tables)

/** Customer and vendor groups (OCRG). */
const CUSTOMER_GROUPS: Record<string, number> = {
  "public hospital": 101,
  "private hospital": 102,
  "diagnostic lab": 103,
  clinic: 104,
  "research/academic": 105,
  industry: 106,
};
const DEFAULT_CUSTOMER_GROUP = 100;
const VENDOR_GROUP_GENERAL = 201;
const VENDOR_GROUP_REGULATED = 202;

/** Payment terms (OCTG.GroupNum). */
const PAYMENT_TERMS: Record<string, number> = { cod: 1, "net 14": 2, "net 30": 3, "net 45": 4, "net 60": 5, "net 90": 6 };

/** Item groups (OITB) by product group. */
const ITEM_GROUPS: Record<"A" | "B" | "C", number> = { A: 101, B: 102, C: 103 };

/** Price lists (OPLN). */
const SALES_PRICE_LIST = 1;
const PURCHASE_PRICE_LIST = 2;

const BASE_CURRENCY = "SGD";

// ---------------------------------------------------------------------------------------------
// Value helpers

function text(v: FieldValue | undefined): string {
  if (isEmptyValue(v)) return "";
  return String(v).replace(/\s*[\r\n]+\s*/g, ", ").trim();
}

function parseSapField(sf: string): { obj?: string; field: string } {
  const i = sf.indexOf(".");
  return i > 0 ? { obj: sf.slice(0, i), field: sf.slice(i + 1) } : { field: sf };
}

function sameObject(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const strip = (s: string) => s.replace(/^o(?=[A-Z])/, "").toLowerCase();
  return strip(a) === strip(b);
}

/** The field (if any) whose sapField targets this column of this object. Unqualified sapFields target the parent object. */
function fieldFor(ctx: Ctx, object: string, sap: string, isParent: boolean): FieldDef | undefined {
  return ctx.domain.fields.find((f) => {
    if (!f.sapField) return false;
    const p = parseSapField(f.sapField);
    if (p.field !== sap) return false;
    return p.obj ? sameObject(p.obj, object) : isParent;
  });
}

/** First non-empty value among the given request-data keys. */
function pick(ctx: Ctx, ...keys: string[]): FieldValue | undefined {
  for (const k of keys) {
    const v = ctx.data[k];
    if (!isEmptyValue(v)) return v;
  }
  return undefined;
}

/** The value of the field mapped to exactly this SAP column (FieldDef.sapField), else pick() over the standard keys. */
function value(ctx: Ctx, object: string, sap: string, isParent: boolean, ...keys: string[]): FieldValue | undefined {
  const mapped = fieldFor(ctx, object, sap, isParent);
  if (mapped && !isEmptyValue(ctx.data[mapped.key])) return ctx.data[mapped.key];
  return pick(ctx, ...keys);
}

const COUNTRY_NAMES: [RegExp, CountryCode][] = [
  [/\bsingapore\b/i, "SG"],
  [/\bmalaysia\b/i, "MY"],
  [/\bthailand\b/i, "TH"],
  [/\bviet\s?nam\b/i, "VN"],
  [/\bmyanmar\b/i, "MM"],
];
const COUNTRY_CODES = new Set(["SG", "MY", "TH", "VN", "MM"]);

function countryOf(ctx: Ctx, ...keys: string[]): string {
  const raw = text(pick(ctx, ...keys)).toUpperCase();
  if (COUNTRY_CODES.has(raw)) return raw;
  for (const [re, code] of COUNTRY_NAMES) if (re.test(raw)) return code;
  return ctx.req.country;
}

function dateYmd(iso: string, sep: string): string {
  const t = Date.parse(iso);
  const d = new Date((Number.isNaN(t) ? 0 : t) + 8 * 3_600_000); // SGT calendar date
  const p = (n: number) => String(n).padStart(2, "0");
  return [d.getUTCFullYear(), p(d.getUTCMonth() + 1), p(d.getUTCDate())].join(sep);
}

function effectiveDateIso(req: MdmRequest): string {
  return req.dtwGeneratedAt ?? req.sapCreatedAt ?? req.submittedAt ?? req.createdAt;
}

function kindOf(domain: DomainConfig): Kind {
  if (domain.id === "extend") return "extend";
  if (domain.sapObject === "oBusinessPartners") return "bp";
  if (domain.sapObject === "oItems") return "item";
  if (domain.sapObject === "oProfitCenter") return "costcentre";
  return "generic";
}

function ctxOf(req: MdmRequest, domain: DomainConfig, sapCode: string): Ctx {
  return {
    req,
    domain,
    data: req.data ?? {},
    code: sapCode,
    kind: kindOf(domain),
    isVendor: domain.codePrefix === "V" || domain.id === "vendor",
  };
}

// ---------------------------------------------------------------------------------------------
// Column sets. Each yields [SAP property, value]; numbers are kept as numbers for the Service Layer body.

type Cell = string | number | undefined;
type Row = [string, Cell][];

function yesNo(b: boolean): string {
  return b ? "tYES" : "tNO";
}

function bpGroup(ctx: Ctx): number {
  if (ctx.isVendor) return /^y/i.test(text(ctx.data.suppliesRegulated)) ? VENDOR_GROUP_REGULATED : VENDOR_GROUP_GENERAL;
  return CUSTOMER_GROUPS[text(ctx.data.segment).toLowerCase()] ?? DEFAULT_CUSTOMER_GROUP;
}

function paymentTermsCode(v: FieldValue | undefined): number | undefined {
  const s = text(v).toLowerCase();
  if (!s) return undefined;
  if (/\b(cod|cash)\b/.test(s)) return PAYMENT_TERMS.cod;
  const days = /(\d{1,3})/.exec(s)?.[1];
  return days ? PAYMENT_TERMS[`net ${days}`] : undefined;
}

function num(v: FieldValue | undefined): number | undefined {
  const n = toNumber(v ?? null);
  return Number.isFinite(n) ? n : undefined;
}

function bpHeaderRow(ctx: Ctx): Row {
  const O = "oBusinessPartners";
  const v = (sap: string, ...keys: string[]) => value(ctx, O, sap, true, ...keys);
  return [
    ["CardCode", ctx.code],
    ["RecordKey", ctx.code],
    ["CardName", text(v("CardName", ctx.isVendor ? "vendorName" : "customerName", "customerName", "vendorName", "name"))],
    ["CardType", ctx.isVendor ? "cSupplier" : "cCustomer"],
    ["GroupCode", bpGroup(ctx)],
    ["FederalTaxID", text(v("FederalTaxID", "taxId"))],
    ["Currency", text(v("Currency", "currency")) || BASE_CURRENCY],
    ["Phone1", text(v("Phone1", "phone"))],
    ["EmailAddress", text(v("EmailAddress", "email"))],
    ["ContactPerson", text(v("ContactPerson", "contactPerson"))],
    ["PayTermsGrpCode", paymentTermsCode(v("PayTermsGrpCode", "paymentTerms"))],
    ["CreditLimit", ctx.isVendor ? undefined : num(v("CreditLimit", "creditLimit"))],
    ["U_TesseractRef", ctx.req.id],
  ];
}

function bpAddressRows(ctx: Ctx): Row[] {
  const O = "BPAddresses";
  const v = (sap: string, ...keys: string[]) => value(ctx, O, sap, false, ...keys);
  const country = text(v("Country")) || countryOf(ctx, "country");
  const base = (line: number, name: string, type: string): Row => [
    ["ParentKey", ctx.code],
    ["LineNum", line],
    ["AddressName", name],
    ["AddressType", type],
    ["Street", text(v("Street", "street", "address"))],
    ["City", text(v("City", "city")) || (country === "SG" ? "Singapore" : "")],
    ["ZipCode", text(v("ZipCode", "zipCode", "postcode"))],
    ["Country", country],
  ];
  return ctx.isVendor ? [base(0, "Pay to", "bo_BillTo")] : [base(0, "Bill to", "bo_BillTo"), base(1, "Ship to", "bo_ShipTo")];
}

/** Options for buildDtwFiles / toServiceLayerPayload. */
export interface DtwOptions {
  /** Extension only: entities the existing BP record already carries in U_Entities. */
  existingEntities?: string[];
}

/** DTW import mode for a request type: an extension updates the existing business partner (assumption A28). */
export function dtwImportMode(domain: Pick<DomainConfig, "id">): "add" | "update" {
  return domain.id === "extend" ? "update" : "add";
}

function creditChange(ctx: Ctx): boolean {
  return /^y/i.test(text(ctx.data.changesCreditTerms));
}

/**
 * Extension = UPDATE of the shared BP record, keyed by CardCode: entity appended to U_Entities, plus the
 * Finance-approved payment terms / credit limit when changesCreditTerms = Yes.
 */
function extendHeaderRow(ctx: Ctx, opts?: DtwOptions): Row {
  const entities = [...(opts?.existingEntities ?? [])].map((e) => e.trim()).filter(Boolean);
  const add = text(pick(ctx, "extendToEntity"));
  if (add && !entities.includes(add)) entities.push(add);
  const row: Row = [
    ["CardCode", ctx.code],
    ["RecordKey", ctx.code],
    ["U_Entities", entities.join(", ")],
  ];
  if (creditChange(ctx)) {
    row.push(["PayTermsGrpCode", paymentTermsCode(pick(ctx, "paymentTerms"))]);
    row.push(["CreditLimit", num(pick(ctx, "creditLimit"))]);
  }
  row.push(["U_TesseractRef", ctx.req.id]);
  return row;
}

function extendAddressRows(ctx: Ctx): Row[] {
  const raw = text(pick(ctx, "newShipToAddress"));
  if (!raw) return [];
  const a = parseAddress(raw, ctx.req.country);
  const entity = text(pick(ctx, "extendToEntity"));
  return [
    [
      ["ParentKey", ctx.code],
      ["LineNum", 0],
      ["AddressName", entity ? `Ship to ${entity}` : "Ship to"],
      ["AddressType", "bo_ShipTo"],
      ["Street", a.street],
      ["City", a.city],
      ["ZipCode", a.zipCode],
      ["Country", a.country],
    ],
  ];
}

function bankCode(swift: string, bankName: string): string {
  if (/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swift)) return swift.slice(0, 4);
  const words = bankName.replace(/\b(bank|berhad|bhd|ltd|limited|plc|public|company|co)\b/gi, "").trim();
  return (words || bankName).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 30);
}

function bpBankRows(ctx: Ctx): Row[] {
  const O = "BPBankAccounts";
  const v = (sap: string, ...keys: string[]) => value(ctx, O, sap, false, ...keys);
  const account = text(v("AccountNo", "bankAccountNo"));
  const swift = text(v("BICSwiftCode", "swift")).toUpperCase().replace(/\s+/g, "");
  const bankName = text(pick(ctx, "bankName"));
  if (!ctx.isVendor && !account) return [];
  return [
    [
      ["ParentKey", ctx.code],
      ["LineNum", 0],
      ["BankCode", text(v("BankCode")) || bankCode(swift, bankName)],
      ["AccountNo", account],
      ["AccountName", text(pick(ctx, "vendorName", "customerName"))],
      ["Country", countryOf(ctx, "country")],
      ["BICSwiftCode", swift],
    ],
  ];
}

function itemFlags(ctx: Ctx): { batch: boolean; serial: boolean; group: "A" | "B" | "C" | null } {
  const category = text(ctx.data.category).toLowerCase();
  const group = productGroupOf(ctx.data.productGroup);
  return {
    group,
    batch: /reagent|ivd|test kit|consumable/.test(category) || group === "A",
    serial: /instrument|equipment/.test(category) || group === "C",
  };
}

function itemRow(ctx: Ctx): Row {
  const O = "oItems";
  const v = (sap: string, ...keys: string[]) => value(ctx, O, sap, true, ...keys);
  const f = itemFlags(ctx);
  const uom = text(v("InventoryUOM", "uom")).toUpperCase();
  const groupRaw = v("ItemsGroupCode", "productGroup");
  const groupLetter = productGroupOf(groupRaw) ?? f.group;
  const groupCode = groupLetter ? ITEM_GROUPS[groupLetter] : num(groupRaw);
  return [
    ["ItemCode", ctx.code],
    ["RecordKey", ctx.code],
    ["ItemName", text(v("ItemName", "itemName"))],
    ["ItemsGroupCode", groupCode],
    ["ItemType", "itItems"],
    ["InventoryItem", "tYES"],
    ["SalesItem", "tYES"],
    ["PurchaseItem", "tYES"],
    ["InventoryUOM", uom],
    ["SalesUnit", text(v("SalesUnit")).toUpperCase() || uom],
    ["PurchaseUnit", text(v("PurchaseUnit")).toUpperCase() || uom],
    ["ManageBatchNumbers", yesNo(f.batch)],
    ["ManageSerialNumbers", yesNo(f.serial)],
    ["U_Category", text(v("U_Category", "category"))],
    ["U_Manufacturer", text(v("U_Manufacturer", "manufacturer"))],
    ["U_PackSize", text(v("U_PackSize", "packSize"))],
    ["U_StorageCond", text(v("U_StorageCond", "storage"))],
    ["U_RegLicenceNo", text(v("U_RegLicenceNo", "regLicenceNo"))],
    ["U_TesseractRef", ctx.req.id],
  ];
}

function itemPriceRows(ctx: Ctx): Row[] {
  const rows: Row[] = [];
  const add = (list: number, price: number | undefined) => {
    if (price === undefined) return;
    rows.push([
      ["ParentKey", ctx.code],
      ["LineNum", rows.length],
      ["PriceList", list],
      ["Price", price],
      ["Currency", BASE_CURRENCY],
    ]);
  };
  add(SALES_PRICE_LIST, num(pick(ctx, "salesPrice")));
  add(PURCHASE_PRICE_LIST, num(pick(ctx, "costPrice")));
  return rows;
}

function dimensionOf(v: FieldValue | undefined): number {
  const d = /([1-5])/.exec(text(v))?.[1];
  return d ? Number(d) : 1;
}

function profitCenterRow(ctx: Ctx): Row {
  const O = "oProfitCenter";
  const v = (sap: string, ...keys: string[]) => value(ctx, O, sap, true, ...keys);
  return [
    ["CenterCode", sapKeyFor(ctx.code)],
    ["CenterName", text(v("CenterName", "centreName"))],
    ["InWhichDimension", dimensionOf(v("InWhichDimension", "dimension"))],
    ["Effectivefrom", dateYmd(effectiveDateIso(ctx.req), "")],
    ["Active", "tYES"],
    ["U_Entity", text(v("U_Entity", "entity")) || ctx.req.entity],
    ["U_Country", countryOf(ctx, "country")],
    ["U_Owner", text(v("U_Owner", "owner"))],
    ["U_TesseractRef", ctx.req.id],
  ];
}

/** Fields whose sapField points at a column the template does not already carry: appended so admin-added fields reach SAP. */
function extraCells(ctx: Ctx, object: string, isParent: boolean, row: Row): Row {
  const have = new Set(row.map(([k]) => k));
  const extra: Row = [];
  for (const f of ctx.domain.fields) {
    if (!f.sapField) continue;
    const p = parseSapField(f.sapField);
    const targets = p.obj ? sameObject(p.obj, object) : isParent;
    if (!targets || have.has(p.field)) continue;
    have.add(p.field);
    const v = ctx.data[f.key];
    extra.push([p.field, f.type === "number" ? num(v) : text(v)]);
  }
  return extra;
}

function toFile(fileName: string, object: string, rows: Row[], extras: Row = []): DtwFile {
  const template = rows[0] ?? [];
  const cols = [...template.map(([k]) => k), ...extras.map(([k]) => k)];
  const cellText = (c: Cell) => (c === undefined ? "" : String(c));
  return {
    fileName,
    object,
    headers: cols,
    dbHeaders: cols.map((c) => dbColumn(object, c)),
    rows: rows.map((r) => [...r, ...extras].map(([, c]) => cellText(c))),
  };
}

function genericRow(ctx: Ctx): Row {
  const row: Row = [["Code", ctx.code]];
  for (const f of ctx.domain.fields) {
    const v = ctx.data[f.key];
    row.push([f.sapField ? parseSapField(f.sapField).field : f.key, f.type === "number" ? num(v) : text(v)]);
  }
  row.push(["U_TesseractRef", ctx.req.id]);
  return row;
}

// ---------------------------------------------------------------------------------------------
// Public API

/**
 * DTW import files for an approved request.
 * Business partner: oBusinessPartners + BPAddresses (+ BPBankAccounts for vendors, or customers with bank details).
 * Item: oItems (+ Items_Prices when prices are given). Cost centre: oProfitCenter.
 * Extension (A28): an oBusinessPartners UPDATE row keyed by CardCode (U_Entities, plus PayTermsGrpCode / CreditLimit when
 * credit terms change) and a BPAddresses row when a new ship-to is given. Import it with dtwImportMode() = "update".
 */
export function buildDtwFiles(req: MdmRequest, domain: DomainConfig, sapCode: string, opts?: DtwOptions): DtwFile[] {
  const ctx = ctxOf(req, domain, sapCode);
  switch (ctx.kind) {
    case "bp": {
      const header = bpHeaderRow(ctx);
      const files = [
        toFile("oBusinessPartners.csv", "oBusinessPartners", [header], extraCells(ctx, "oBusinessPartners", true, header)),
      ];
      const addr = bpAddressRows(ctx);
      files.push(toFile("BPAddresses.csv", "BPAddresses", addr, extraCells(ctx, "BPAddresses", false, addr[0])));
      const bank = bpBankRows(ctx);
      if (bank.length) files.push(toFile("BPBankAccounts.csv", "BPBankAccounts", bank, extraCells(ctx, "BPBankAccounts", false, bank[0])));
      return files;
    }
    case "extend": {
      const files = [toFile("oBusinessPartners.csv", "oBusinessPartners", [extendHeaderRow(ctx, opts)])];
      const rows = extendAddressRows(ctx);
      if (rows.length) files.push(toFile("BPAddresses.csv", "BPAddresses", rows));
      return files;
    }
    case "item": {
      const row = itemRow(ctx);
      const files = [toFile("oItems.csv", "oItems", [row], extraCells(ctx, "oItems", true, row))];
      const prices = itemPriceRows(ctx);
      if (prices.length) files.push(toFile("Items_Prices.csv", "Items_Prices", prices));
      return files;
    }
    case "costcentre": {
      const row = profitCenterRow(ctx);
      return [toFile("oProfitCenter.csv", "oProfitCenter", [row], extraCells(ctx, "oProfitCenter", true, row))];
    }
    default:
      return [toFile(`${domain.sapObject || domain.id}.csv`, domain.sapObject || domain.id, [genericRow(ctx)])];
  }
}

function csvCell(s: string): string {
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV: header row 1 (SAP names), header row 2 (DB columns), data rows; CRLF line endings. */
export function dtwToCsv(f: DtwFile): string {
  return [f.headers, f.dbHeaders, ...f.rows].map((r) => r.map((c) => csvCell(c ?? "")).join(",")).join("\r\n") + "\r\n";
}

function toBody(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of row) {
    if (k === "RecordKey" || k === "ParentKey" || k === "LineNum") continue;
    if (v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Phase 2 reference: the Service Layer call that would create the record directly.
 * BusinessPartners / Items / ProfitCenters are POSTed; an extension PATCHes the existing business partner.
 */
export function toServiceLayerPayload(
  req: MdmRequest,
  domain: DomainConfig,
  sapCode: string,
  opts?: DtwOptions,
): { method: "POST" | "PATCH"; path: string; body: Record<string, unknown> } {
  const ctx = ctxOf(req, domain, sapCode);
  switch (ctx.kind) {
    case "bp": {
      const header = bpHeaderRow(ctx);
      const body = toBody([...header, ...extraCells(ctx, "oBusinessPartners", true, header)]);
      body.BPAddresses = bpAddressRows(ctx).map(toBody);
      const bank = bpBankRows(ctx);
      if (bank.length) body.BPBankAccounts = bank.map(toBody);
      const contact = text(pick(ctx, "contactPerson"));
      if (contact) body.ContactEmployees = [{ Name: contact }];
      return { method: "POST", path: "/b1s/v2/BusinessPartners", body };
    }
    case "extend": {
      const code = sapCode.replace(/'/g, "''");
      const body = toBody(extendHeaderRow(ctx, opts).filter(([k]) => k !== "CardCode"));
      const addresses = extendAddressRows(ctx).map(toBody);
      if (addresses.length) body.BPAddresses = addresses;
      return { method: "PATCH", path: `/b1s/v2/BusinessPartners('${code}')`, body };
    }
    case "item": {
      const row = itemRow(ctx);
      const body = toBody([...row, ...extraCells(ctx, "oItems", true, row)]);
      const prices = itemPriceRows(ctx).map(toBody);
      if (prices.length) body.ItemPrices = prices;
      return { method: "POST", path: "/b1s/v2/Items", body };
    }
    case "costcentre": {
      const row = profitCenterRow(ctx).map(([k, v]): [string, Cell] =>
        k === "Effectivefrom" ? ["EffectiveFrom", dateYmd(effectiveDateIso(ctx.req), "-")] : [k, v],
      );
      return { method: "POST", path: "/b1s/v2/ProfitCenters", body: toBody([...row, ...extraCells(ctx, "oProfitCenter", true, row)]) };
    }
    default: {
      const entity = (domain.sapObject || domain.id).replace(/^o(?=[A-Z])/, "");
      return { method: "POST", path: `/b1s/v2/${entity}`, body: toBody(genericRow(ctx)) };
    }
  }
}
