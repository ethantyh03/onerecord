/**
 * Pure helpers for the MDM console: SAP B1 10.0 SDK length limits, the form field → SAP property → DB column
 * mapping shown in the field review, and the duplicate re-check candidate sets.
 */
import type {
  CustomerMaster,
  DomainConfig,
  DtwFile,
  FieldDef,
  FieldValue,
  MdmRequest,
  Person,
  SapRecord,
} from "@/lib/types";
import { isEmptyValue, isFieldVisible } from "@/lib/engine/conditions";
import { findDuplicates, nameSimilarity } from "@/lib/engine/dedupe";
import { MDM_STAGE_ID } from "@/lib/engine/routing";

// ---------------------------------------------------------------------------------------------
// SAP B1 10.0 SDK column limits (research log). Keyed by DB column; SAP property names map onto them.

export interface SapLimit {
  dbColumn: string;
  max: number;
  /** Currency must be exactly 3 characters (ISO code). */
  exact?: boolean;
}

export const SDK_LIMITS: Record<string, SapLimit> = {
  CardCode: { dbColumn: "CardCode", max: 15 },
  CardName: { dbColumn: "CardName", max: 200 },
  LicTradNum: { dbColumn: "LicTradNum", max: 32 },
  Currency: { dbColumn: "Currency", max: 3, exact: true },
  E_Mail: { dbColumn: "E_Mail", max: 100 },
  Phone1: { dbColumn: "Phone1", max: 50 },
  ItemCode: { dbColumn: "ItemCode", max: 50 },
  ItemName: { dbColumn: "ItemName", max: 200 },
  PrcCode: { dbColumn: "PrcCode", max: 8 },
  PrcName: { dbColumn: "PrcName", max: 30 },
};

/** SAP property (DI API / Service Layer name) → DB column, for properties DTW files may not carry. */
const PROPERTY_TO_COLUMN: Record<string, string> = {
  CardCode: "CardCode",
  CardName: "CardName",
  FederalTaxID: "LicTradNum",
  Currency: "Currency",
  EmailAddress: "E_Mail",
  Phone1: "Phone1",
  ItemCode: "ItemCode",
  ItemName: "ItemName",
  CenterCode: "PrcCode",
  CenterName: "PrcName",
  PayTermsGrpCode: "GroupNum",
  CreditLimit: "CreditLine",
  GroupCode: "GroupCode",
  ContactPerson: "CntctPrsn",
  ItemsGroupCode: "ItmsGrpCod",
  InventoryUOM: "InvntryUom",
  AvgStdPrice: "AvgPrice",
  FreeText: "Free_Text",
  InWhichDimension: "DimCode",
  AddressName: "Address",
  AccountNo: "Account",
  BICSwiftCode: "SwiftNum",
  Price: "Price",
};

/** Limit for a SAP property or DB column, if the SDK list covers it. */
export function limitFor(propertyOrColumn: string): SapLimit | undefined {
  return SDK_LIMITS[propertyOrColumn] ?? SDK_LIMITS[PROPERTY_TO_COLUMN[propertyOrColumn] ?? ""];
}

export interface LengthCheck {
  ok: boolean;
  length: number;
  max: number;
  exact?: boolean;
}

export function checkLength(value: string, limit: SapLimit): LengthCheck {
  const length = value.length;
  const ok = limit.exact ? length === limit.max : length <= limit.max;
  return { ok, length, max: limit.max, exact: limit.exact };
}

// ---------------------------------------------------------------------------------------------
// Field review rows

export interface FieldReviewRow {
  key: string;
  label: string;
  /** "ItemName" or "BPAddresses.Street" */
  sapProperty: string;
  /** DTW object the property lands in */
  object: string;
  dbColumn: string;
  value: FieldValue;
  /** The value as it lands in the import file, when that differs from the form value (e.g. group "A" → 101). */
  importValue?: string;
  inImport: boolean;
  sensitive: boolean;
  isFile: boolean;
  length?: LengthCheck;
  /** Row added by Tesseract (the assigned SAP code), not typed by the requestor. */
  system?: boolean;
}

function parseSapField(sf: string, fallbackObject: string): { object: string; property: string } {
  const dot = sf.indexOf(".");
  if (dot > 0) return { object: sf.slice(0, dot), property: sf.slice(dot + 1) };
  return { object: fallbackObject, property: sf };
}

function findInFiles(files: DtwFile[], object: string, property: string): { db: string; value: string } | undefined {
  const file = files.find((f) => f.object === object) ?? (object === "" ? files[0] : undefined);
  if (!file) return undefined;
  const idx = file.headers.indexOf(property);
  if (idx < 0) return undefined;
  return { db: file.dbHeaders[idx] ?? property, value: file.rows[0]?.[idx] ?? "" };
}

const CODE_PROPERTY: Record<string, string> = {
  oBusinessPartners: "CardCode",
  oItems: "ItemCode",
  oProfitCenter: "CenterCode",
};

/** Rows for the field review table: the SAP code first, then every visible field that has a value. */
export function buildFieldReview(
  req: MdmRequest,
  domain: DomainConfig,
  files: DtwFile[],
  sapCode: string | undefined,
): FieldReviewRow[] {
  const rows: FieldReviewRow[] = [];
  const codeProp = CODE_PROPERTY[domain.sapObject];
  if (codeProp && sapCode) {
    const hit = findInFiles(files, domain.sapObject, codeProp);
    const codeValue = hit?.value || (codeProp === "CenterCode" ? sapCode.replace(/^CC-/, "").replace(/-/g, "") : sapCode);
    const limit = limitFor(codeProp);
    rows.push({
      key: "__code",
      label: domain.id === "extend" ? "Existing SAP code (kept)" : "SAP code (assigned by Tesseract)",
      sapProperty: codeProp,
      object: domain.sapObject,
      dbColumn: hit?.db ?? PROPERTY_TO_COLUMN[codeProp] ?? codeProp,
      value: codeValue,
      inImport: !!hit || files.length === 0,
      sensitive: false,
      isFile: false,
      length: limit ? checkLength(codeValue, limit) : undefined,
      system: true,
    });
  }

  for (const f of domain.fields) {
    if (!isFieldVisible(f, req.data)) continue;
    const value = req.data[f.key];
    if (isEmptyValue(value)) continue;
    if (domain.id === "extend" && f.key === "existingCode") continue; // shown as the code row
    rows.push(reviewRow(f, value, domain, files));
  }
  return rows;
}

function reviewRow(f: FieldDef, value: FieldValue, domain: DomainConfig, files: DtwFile[]): FieldReviewRow {
  const isFile = f.type === "file";
  const { object, property } = f.sapField ? parseSapField(f.sapField, domain.sapObject) : { object: domain.sapObject, property: "" };
  const hit = property ? findInFiles(files, object, property) : undefined;
  const dbColumn = hit?.db ?? (property ? PROPERTY_TO_COLUMN[property] ?? property : "—");
  const text = String(value ?? "").trim();
  const limit = property ? limitFor(property) ?? limitFor(dbColumn) : undefined;
  const importValue = hit && hit.value !== "" && hit.value !== text ? hit.value : undefined;
  return {
    key: f.key,
    label: f.label,
    sapProperty: property ? (object !== domain.sapObject ? `${object}.${property}` : property) : isFile ? "Attachment" : "—",
    object,
    dbColumn: isFile ? "ATC1 (attachments)" : dbColumn,
    value,
    importValue,
    inImport: !!hit,
    sensitive: !!f.sensitive,
    isFile,
    length: limit && !isFile ? checkLength(importValue ?? text, limit) : undefined,
  };
}

/** SAP property names (bare) of sensitive fields, for masking DTW cells and Service Layer values. */
export function sensitiveProperties(domain: DomainConfig): Set<string> {
  const out = new Set<string>();
  for (const f of domain.fields) {
    if (!f.sensitive || !f.sapField) continue;
    out.add(parseSapField(f.sapField, domain.sapObject).property);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Service Layer validator

export interface SlCheck {
  property: string;
  dbColumn: string;
  value: string;
  check: LengthCheck;
}

/** One check per payload property the SDK limit list covers (the key in the path counts for a PATCH). */
export function validateServiceLayer(payload: { method: string; path: string; body: Record<string, unknown> }): SlCheck[] {
  const out: SlCheck[] = [];
  const keyInPath = /\('([^']*)'\)/.exec(payload.path)?.[1];
  if (keyInPath) {
    const limit = SDK_LIMITS.CardCode;
    out.push({ property: "CardCode (in URL)", dbColumn: limit.dbColumn, value: keyInPath, check: checkLength(keyInPath, limit) });
  }
  for (const [k, v] of Object.entries(payload.body)) {
    if (v === null || typeof v === "object") continue;
    const limit = limitFor(k);
    if (!limit) continue;
    const s = String(v);
    out.push({ property: k, dbColumn: limit.dbColumn, value: s, check: checkLength(s, limit) });
  }
  return out;
}

/** Copy of a payload with sensitive values replaced (for viewers outside Finance / MDM). */
export function maskPayload(body: Record<string, unknown>, sensitive: Set<string>): Record<string, unknown> {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = sensitive.has(k) ? "••••••" : walk(x);
      return o;
    }
    return v;
  };
  return walk(body) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------------------------
// Duplicate re-check

export interface RecheckMatch {
  code: string;
  name: string;
  score: number;
  reasons: string[];
  source: "master" | "tesseract";
}

export interface RecheckResult {
  kind: "matches" | "clear" | "extension" | "not_applicable";
  matches: RecheckMatch[];
  /** How many records were compared */
  compared: number;
}

function sapToCustomer(r: SapRecord): CustomerMaster | null {
  if (r.object !== "oBusinessPartners") return null;
  const m = /^[A-Z]+-(SG|MY|TH|VN|MM)-/.exec(r.code);
  return {
    cardCode: r.code,
    cardName: r.name,
    entity: String(r.fields.U_Entities ?? r.fields.U_Entity ?? ""),
    country: (m?.[1] ?? "SG") as CustomerMaster["country"],
    licTradNum: r.fields.FederalTaxID,
    street: r.fields["BPAddresses.Street"],
    zipCode: r.fields["BPAddresses.ZipCode"],
    phone1: r.fields.Phone1,
    email: r.fields.EmailAddress,
    goldenId: r.code,
    segment: "",
    hasTransactions: false,
  };
}

/** Re-runs the duplicate check against the master extract plus every record already in the SAP B1 sandbox. */
export function recheckDuplicates(
  req: MdmRequest,
  domain: DomainConfig,
  masters: { customers: CustomerMaster[]; items: { itemCode: string; itemName: string }[] },
  sapRecords: SapRecord[],
): RecheckResult {
  const own = req.sapCode;
  if (domain.id === "extend") return { kind: "extension", matches: [], compared: 0 };

  if (domain.sapObject === "oBusinessPartners") {
    const isVendor = domain.codePrefix === "V";
    const fromSap = sapRecords
      .filter((r) => r.code !== own && (isVendor ? r.code.startsWith("V-") : r.code.startsWith("C-")))
      .map(sapToCustomer)
      .filter((x): x is CustomerMaster => !!x);
    const seen = new Set(fromSap.map((c) => c.cardCode));
    const pool = [...(isVendor ? [] : masters.customers.filter((c) => !seen.has(c.cardCode) && c.cardCode !== own)), ...fromSap];
    const d = req.data;
    const name = String(d.customerName ?? d.vendorName ?? "");
    const hits = findDuplicates(
      {
        name,
        country: req.country,
        taxId: d.taxId ? String(d.taxId) : undefined,
        zipCode: d.zipCode ? String(d.zipCode) : undefined,
        phone: d.phone ? String(d.phone) : undefined,
        email: d.email ? String(d.email) : undefined,
      },
      pool,
      { limit: 3, threshold: 0.85 },
    );
    const sapCodes = new Set(fromSap.map((c) => c.cardCode));
    return {
      kind: hits.length ? "matches" : "clear",
      compared: pool.length,
      matches: hits.map((h) => ({
        code: h.record.cardCode,
        name: h.record.cardName,
        score: h.score,
        reasons: h.reasons,
        source: sapCodes.has(h.record.cardCode) ? "tesseract" : "master",
      })),
    };
  }

  if (domain.sapObject === "oItems") {
    const name = String(req.data.itemName ?? "");
    const pool: { code: string; name: string; source: RecheckMatch["source"] }[] = [];
    const seen = new Set<string>();
    for (const r of sapRecords) {
      if (r.object !== "oItems" || r.code === own) continue;
      seen.add(r.code);
      pool.push({ code: r.code, name: r.name, source: "tesseract" });
    }
    for (const i of masters.items) if (!seen.has(i.itemCode) && i.itemCode !== own) pool.push({ code: i.itemCode, name: i.itemName, source: "master" });
    const matches = pool
      .map((p) => ({ ...p, score: name ? nameSimilarity(name, p.name) : 0 }))
      .filter((p) => p.score >= 0.9)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((p) => ({ code: p.code, name: p.name, score: p.score, reasons: [`${Math.round(p.score * 100)}% name match`], source: p.source }));
    return { kind: matches.length ? "matches" : "clear", matches, compared: pool.length };
  }

  if (domain.sapObject === "oProfitCenter") {
    const name = String(req.data.centreName ?? "");
    const pool = sapRecords.filter((r) => r.object === "oProfitCenter" && r.code !== own);
    const matches = pool
      .map((r) => ({ r, score: name ? nameSimilarity(name, r.name) : 0 }))
      .filter((x) => x.score >= 0.9)
      .slice(0, 3)
      .map(({ r, score }) => ({ code: r.code, name: r.name, score, reasons: [`${Math.round(score * 100)}% name match`], source: "tesseract" as const }));
    return { kind: matches.length ? "matches" : "clear", matches, compared: pool.length };
  }

  return { kind: "not_applicable", matches: [], compared: 0 };
}

// ---------------------------------------------------------------------------------------------
// Misc

export function isMdmUser(p: Person | undefined): boolean {
  return !!p && (p.roles.includes("mdm") || p.roles.includes("admin"));
}

/** When the business approvals finished (the MDM final-check step was activated). */
export function approvedAt(req: MdmRequest): string | undefined {
  const mdm = req.steps.find((s) => s.stageId === MDM_STAGE_ID);
  if (mdm?.activatedAt) return mdm.activatedAt;
  const decided = req.steps.filter((s) => s.stageId !== MDM_STAGE_ID && s.decidedAt).map((s) => s.decidedAt as string);
  return decided.sort().at(-1);
}
