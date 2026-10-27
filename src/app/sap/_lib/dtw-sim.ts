import type { DtwFile } from "@/lib/types";

/**
 * Data Transfer Workbench "Simulate" for the sandbox: the checks DTW itself would fail an import on,
 * run against the files OneRecord generated. Pure; no store access.
 */

export interface DtwIssue {
  fileName: string;
  /** 1-based line in the CSV (lines 1–2 are the two header rows). */
  line?: number;
  column?: string;
  message: string;
}

export interface DtwFileReport {
  fileName: string;
  object: string;
  records: number;
  errors: DtwIssue[];
  warnings: DtwIssue[];
}

export interface DtwSimulation {
  files: DtwFileReport[];
  /** Records in parent (header) files: what DTW reports as "objects". */
  objects: number;
  errorCount: number;
  warningCount: number;
  ok: boolean;
}

/**
 * Field limits from SAP B1 10.0 (SDK help, Web client import spec). Keyed by both the property name
 * (DTW row 1) and the DB column (row 2). Where sources disagree, the stricter value is used.
 */
export const SAP_FIELD_LIMITS: Record<string, number> = {
  CardCode: 15,
  CardName: 100,
  CardForeignName: 100,
  CardFName: 100,
  FederalTaxID: 32,
  LicTradNum: 32,
  Currency: 3,
  EmailAddress: 100,
  E_Mail: 100,
  Phone1: 20,
  Phone2: 20,
  ItemCode: 50,
  ItemName: 100,
  ForeignName: 100,
  FrgnName: 100,
  Mainsupplier: 15,
  CenterCode: 8,
  PrcCode: 8,
  CenterName: 30,
  PrcName: 30,
  AddressName: 50,
  ZipCode: 20,
};

/** Mandatory columns per DTW object (beyond the record key). */
const MANDATORY: Record<string, string[]> = {
  oBusinessPartners: ["CardCode", "CardName"],
  oItems: ["ItemCode", "ItemName"],
  oProfitCenter: ["CenterCode", "CenterName"],
  oProfitCenters: ["CenterCode", "CenterName"],
};

const CARD_TYPES = new Set(["C", "S", "L", "cCustomer", "cSupplier", "cLid"]);
const YES_NO = new Set(["tYES", "tNO", "Y", "N"]);

/** Template name from the file name ("BPAddresses.csv" → "BPAddresses"), falling back to the object. */
function templateOf(file: DtwFile): string {
  const base = file.fileName.replace(/^.*[\/]/, "").replace(/\.(csv|txt)$/i, "");
  return base || file.object;
}

/** Child templates (BPAddresses, BPBankAccounts, ContactEmployees …) link to a parent by ParentKey. */
export function isChildFile(file: DtwFile): boolean {
  return file.headers.includes("ParentKey") || !/^o[A-Z]/.test(templateOf(file));
}

function columnIndex(file: DtwFile, ...names: string[]): number {
  for (const name of names) {
    const i = file.headers.indexOf(name);
    if (i >= 0) return i;
    const j = file.dbHeaders.indexOf(name);
    if (j >= 0) return j;
  }
  return -1;
}

export function simulateDtwImport(files: DtwFile[]): DtwSimulation {
  const reports: DtwFileReport[] = [];
  // Parent keys DTW can link children to: RecordKey values plus the business key (CardCode …).
  const parentKeys = new Set<string>();
  for (const f of files) {
    if (isChildFile(f)) continue;
    const rk = columnIndex(f, "RecordKey");
    const code = columnIndex(f, "CardCode", "ItemCode", "CenterCode", "PrcCode");
    for (const row of f.rows) {
      if (rk >= 0 && row[rk]) parentKeys.add(row[rk]);
      if (code >= 0 && row[code]) parentKeys.add(row[code]);
    }
  }

  for (const f of files) {
    const errors: DtwIssue[] = [];
    const warnings: DtwIssue[] = [];
    const object = f.object || templateOf(f);
    const template = templateOf(f);
    const err = (message: string, line?: number, column?: string) => errors.push({ fileName: f.fileName, line, column, message });
    const warn = (message: string, line?: number, column?: string) => warnings.push({ fileName: f.fileName, line, column, message });

    if (f.headers.length === 0) err("Template has no header row");
    if (f.dbHeaders.length !== f.headers.length) {
      err(`Header rows differ: ${f.headers.length} property names vs ${f.dbHeaders.length} DB columns`, 2);
    }
    const seen = new Set<string>();
    f.headers.forEach((h) => {
      if (seen.has(h)) warn(`Column ${h} appears twice; DTW uses the first`, 1, h);
      seen.add(h);
    });
    if (f.rows.length === 0) err("No data rows to import");

    const mandatory = isChildFile(f) ? [] : (MANDATORY[template] ?? MANDATORY[object] ?? []);
    for (const m of mandatory) {
      if (columnIndex(f, m) < 0) err(`Mandatory column ${m} is missing`, 1, m);
    }

    const child = isChildFile(f);
    const parentCol = columnIndex(f, "ParentKey");

    f.rows.forEach((row, r) => {
      const line = r + 3;
      if (row.length !== f.headers.length) {
        err(`Row has ${row.length} values; the template has ${f.headers.length} columns`, line);
      }
      f.headers.forEach((h, c) => {
        const raw = row[c] ?? "";
        const db = f.dbHeaders[c];
        if (raw !== raw.trim()) warn(`Value has leading or trailing spaces`, line, h);
        const value = raw.trim();
        if (mandatory.includes(h) && value === "") err(`Mandatory field ${h} is empty`, line, h);
        const limit = SAP_FIELD_LIMITS[h] ?? (db ? SAP_FIELD_LIMITS[db] : undefined);
        if (limit !== undefined && value.length > limit) {
          err(`${h} "${value}" is ${value.length} characters; SAP B1 allows ${limit}`, line, h);
        }
        if (value === "") return;
        if (h === "CardType" && !CARD_TYPES.has(value)) err(`CardType "${value}" is not C, S or L`, line, h);
        if ((h === "Currency" || db === "Currency") && !/^[A-Z]{3}$/.test(value) && value !== "##") {
          err(`Currency "${value}" is not a 3-letter ISO code`, line, h);
        }
        if ((h === "CreditLimit" || h === "MaxCommitment" || h === "LeadTime" || h === "MinOrderQuantity") && Number.isNaN(Number(value))) {
          err(`${h} must be a number`, line, h);
        }
        if (
          (h === "InventoryItem" || h === "SalesItem" || h === "PurchaseItem" || h === "ManageBatchNumbers" || h === "Valid" || h === "Frozen") &&
          !YES_NO.has(value)
        ) {
          err(`${h} must be tYES or tNO`, line, h);
        }
        if ((h === "EmailAddress" || db === "E_Mail") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          warn(`EmailAddress "${value}" does not look like an email address`, line, h);
        }
      });
      if (child && parentCol >= 0) {
        const key = (row[parentCol] ?? "").trim();
        if (!key) err("ParentKey is empty", line, "ParentKey");
        else if (parentKeys.size > 0 && !parentKeys.has(key)) err(`ParentKey ${key} has no matching parent record`, line, "ParentKey");
      }
    });

    reports.push({ fileName: f.fileName, object, records: f.rows.length, errors, warnings });
  }

  const parents = files.filter((f) => !isChildFile(f));
  const objects = (parents.length > 0 ? parents : files).reduce((n, f) => n + f.rows.length, 0);
  const errorCount = reports.reduce((n, r) => n + r.errors.length, 0);
  const warningCount = reports.reduce((n, r) => n + r.warnings.length, 0);
  return { files: reports, objects, errorCount, warningCount, ok: errorCount === 0 };
}

/** The business key of the first parent record (CardCode / ItemCode / CenterCode), i.e. the code DTW will report. */
export function primaryKeyOf(files: DtwFile[]): string | undefined {
  const parent = files.find((f) => !isChildFile(f)) ?? files[0];
  if (!parent) return undefined;
  const i = columnIndex(parent, "CardCode", "ItemCode", "CenterCode", "PrcCode");
  return i >= 0 ? parent.rows[0]?.[i] : undefined;
}

/** Column names that are never shown unmasked to roles without sensitive access. */
const SENSITIVE_COLUMNS = new Set([
  "CreditLimit",
  "CreditLine",
  "MaxCommitment",
  "DebtLine",
  "PayTermsGrpCode",
  "GroupNum",
  "PaymentTerms",
  "AccountNo",
  "Account",
  "AccountName",
  "AcctName",
  "IBAN",
  "BICSwiftCode",
  "SwiftNum",
  "BankCode",
  "Branch",
  "ControlKey",
]);

/**
 * True when an SAP column holds a sensitive value: bank details, credit limit, payment terms.
 * Accepts "AccountNo" or a dotted config mapping such as "BPBankAccounts.AccountNo".
 */
export function isSensitiveColumn(name: string, extra?: Iterable<string>): boolean {
  const last = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  if (SENSITIVE_COLUMNS.has(last) || name.startsWith("BPBankAccounts.")) return true;
  if (extra) for (const e of extra) if (e === name || e === last) return true;
  return false;
}

/** The DTW log lines shown while simulating, in DTW's own wording. */
export function simulationLog(sim: DtwSimulation): string[] {
  const lines: string[] = [];
  for (const f of sim.files) {
    lines.push(`Reading ${f.fileName} · ${f.records} record(s)`);
    for (const e of f.errors) lines.push(`  Error${e.line ? ` (line ${e.line}${e.column ? `, ${e.column}` : ""})` : ""}: ${e.message}`);
    for (const w of f.warnings) lines.push(`  Warning${w.line ? ` (line ${w.line}${w.column ? `, ${w.column}` : ""})` : ""}: ${w.message}`);
  }
  lines.push("Checking mandatory fields and SAP B1 10.0 field lengths");
  lines.push(`Simulation complete: ${sim.errorCount} error${sim.errorCount === 1 ? "" : "s"}, ${sim.warningCount} warning${sim.warningCount === 1 ? "" : "s"}`);
  return lines;
}
