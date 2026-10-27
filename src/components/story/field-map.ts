import type { DomainConfig, FieldDef, FieldValue, MdmRequest } from "@/lib/types";
import { buildDtwFiles } from "@/lib/engine/dtw";

/** SAP B1 DTW object → database table it writes (SAP B1 10.0 SDK). */
export const SAP_TABLES: Record<string, string> = {
  oBusinessPartners: "OCRD",
  BPAddresses: "CRD1",
  BPBankAccounts: "OCRB",
  oItems: "OITM",
  Items_Prices: "ITM1",
  oProfitCenter: "OPRC",
};

export interface FieldMapRow {
  key: string;
  label: string;
  required: "always" | "conditional" | "optional";
  sensitive: boolean;
  /** Who fills it: the requestor (form field) or OneRecord itself. */
  source: "form" | "system";
  /** DI API / Service Layer property, e.g. "CardName" or "BPAddresses.Street". */
  sapProperty: string | null;
  /** DTW file the value lands in, e.g. "oBusinessPartners.csv". */
  dtwFile: string | null;
  /** DB table.column, e.g. "OCRD.CardName". */
  dbColumn: string | null;
  maxLength?: number;
  /** Why the field has no SAP column. */
  note?: string;
}

function sampleValue(f: FieldDef): FieldValue {
  if (f.options?.length) return f.options.find((o) => /^yes$/i.test(o)) ?? f.options[0];
  switch (f.type) {
    case "number":
      return 1000;
    case "country":
      return "SG";
    case "entity":
      return "SPD";
    case "email":
      return "sample@hospital.example";
    case "phone":
      return "+65 6000 0000";
    case "date":
      return "2026-10-28";
    case "file":
      return "certificate.pdf";
    case "textarea":
      return f.key.toLowerCase().includes("address") ? "5 Lower Kent Ridge Road, Singapore 119074" : "Sample";
    default:
      if (/swift|bic/i.test(f.key)) return "DBSSSGSGXXX";
      if (/account/i.test(f.key)) return "0123456789";
      if (/address/i.test(f.key)) return "5 Lower Kent Ridge Road, Singapore 119074";
      return "Sample";
  }
}

function sampleCode(domain: DomainConfig): string {
  switch (domain.codePrefix) {
    case "C":
      return "C-SG-00123";
    case "V":
      return "V-SG-00045";
    case "I":
      return "I-A-000813";
    case "CC":
      return "CC-SG-0031";
    default:
      return domain.id === "extend" ? "C-SG-00017" : "X-00001";
  }
}

/**
 * Form field → SAP property → DTW file → DB column, built from the live config and the real DTW generator,
 * so an admin-added field (with a sapField) shows up here exactly as it would land in SAP.
 */
export function buildFieldMap(domain: DomainConfig): FieldMapRow[] {
  const data: Record<string, FieldValue> = {};
  for (const f of domain.fields) data[f.key] = sampleValue(f);
  const code = sampleCode(domain);
  const req: MdmRequest = {
    id: "REQ-0000",
    domainId: domain.id,
    title: "Field map sample",
    requestorId: "amy",
    entity: "SPD",
    country: "SG",
    createdAt: "2026-10-28T01:00:00.000Z",
    submittedAt: "2026-10-28T01:00:00.000Z",
    status: "mdm_review",
    data,
    configVersion: 0,
    steps: [],
    blockedPrIds: [],
  };

  let files: ReturnType<typeof buildDtwFiles> = [];
  try {
    files = buildDtwFiles(req, domain, code, domain.id === "extend" ? { existingEntities: ["SPD"] } : undefined);
  } catch {
    files = [];
  }
  const parent = files[0];
  const strip = (s: string) => s.replace(/^o(?=[A-Z])/, "").toLowerCase();

  const locate = (sapProperty: string): { file: string | null; db: string | null } => {
    const dot = sapProperty.indexOf(".");
    const obj = dot > 0 ? sapProperty.slice(0, dot) : null;
    const field = dot > 0 ? sapProperty.slice(dot + 1) : sapProperty;
    const file = obj ? files.find((x) => strip(x.object) === strip(obj)) : parent;
    if (!file) return { file: null, db: null };
    const i = file.headers.indexOf(field);
    if (i < 0) return { file: null, db: null };
    const table = SAP_TABLES[file.object] ?? file.object;
    return { file: file.fileName, db: `${table}.${file.dbHeaders[i] ?? field}` };
  };

  const rows: FieldMapRow[] = [];
  if (parent && parent.headers.length) {
    const keyCol = parent.headers[0];
    const table = SAP_TABLES[parent.object] ?? parent.object;
    rows.push({
      key: "__code",
      label: domain.id === "extend" ? "Existing record (the code being updated)" : "New SAP code",
      required: "always",
      sensitive: false,
      source: "system",
      sapProperty: keyCol,
      dtwFile: parent.fileName,
      dbColumn: `${table}.${parent.dbHeaders[0] ?? keyCol}`,
      note: domain.id === "extend" ? "Update row keyed by the existing code" : "Assigned by OneRecord when the import file is generated",
    });
  }

  for (const f of domain.fields) {
    if (domain.id === "extend" && f.sapField === "CardCode") continue; // covered by the key row above
    const base = {
      key: f.key,
      label: f.label,
      required: (f.required ? "always" : f.requiredIf ? "conditional" : "optional") as FieldMapRow["required"],
      sensitive: Boolean(f.sensitive),
      source: "form" as const,
      maxLength: f.maxLength,
    };
    if (!f.sapField) {
      rows.push({
        ...base,
        sapProperty: null,
        dtwFile: null,
        dbColumn: null,
        note: f.type === "file" ? "Attachment kept with the request in SharePoint" : "Kept in OneRecord for approvers",
      });
      continue;
    }
    const loc = locate(f.sapField);
    rows.push({
      ...base,
      sapProperty: f.sapField,
      dtwFile: loc.file,
      dbColumn: loc.db,
      note: loc.file ? undefined : "Shown to approvers; not written by this import",
    });
  }

  if (parent && parent.headers.includes("U_OneRecordRef")) {
    const table = SAP_TABLES[parent.object] ?? parent.object;
    rows.push({
      key: "__ref",
      label: "OneRecord request ID",
      required: "always",
      sensitive: false,
      source: "system",
      sapProperty: "U_OneRecordRef",
      dtwFile: parent.fileName,
      dbColumn: `${table}.U_OneRecordRef`,
      note: "Links the SAP record back to its approvals and audit trail",
    });
  }
  return rows;
}
