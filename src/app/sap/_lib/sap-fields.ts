import type { DomainConfig, MdmRequest, SapRecord } from "@/lib/types";

export type SapObjectKind = "bp" | "item" | "profit" | "other";

export function objectKind(object: string): SapObjectKind {
  if (/BusinessPartner/i.test(object)) return "bp";
  if (/Item/i.test(object)) return "item";
  if (/ProfitCent/i.test(object)) return "profit";
  return "other";
}

export const OBJECT_LABEL: Record<SapObjectKind, string> = {
  bp: "Business Partner",
  item: "Item",
  profit: "Profit Center",
  other: "Object",
};

/**
 * Every SAP field we know for a record: the imported DTW values first, then the linked request's
 * values mapped through each config field's sapField. Dotted mappings ("BPBankAccounts.AccountNo")
 * are also stored under their last segment so either spelling resolves.
 */
export function resolveRecordFields(
  record: SapRecord,
  request?: MdmRequest,
  domain?: DomainConfig,
): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const v = String(value).trim();
    if (!v) return;
    if (!(key in out)) out[key] = v;
    const dot = key.lastIndexOf(".");
    if (dot >= 0) {
      const short = key.slice(dot + 1);
      if (!(short in out)) out[short] = v;
    }
  };
  for (const [k, v] of Object.entries(record.fields ?? {})) put(k, v);
  if (request && domain) {
    for (const f of domain.fields) {
      if (f.sapField) put(f.sapField, request.data[f.key]);
    }
  }
  return out;
}

/** First non-empty value among candidate SAP field names. */
export function pick(fields: Record<string, string>, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = fields[n];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

/** Fields of a dotted child collection, e.g. childRows(fields, "BPAddresses") → { Street: …, ZipCode: … }. */
export function childFields(fields: Record<string, string>, collection: string): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${collection}.`;
  for (const [k, v] of Object.entries(fields)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  }
  return out;
}

const CARD_TYPE_LABEL: Record<string, string> = {
  C: "Customer",
  cCustomer: "Customer",
  S: "Vendor",
  cSupplier: "Vendor",
  L: "Lead",
  cLid: "Lead",
};

export function cardTypeLabel(v: string | undefined, code: string): string {
  if (v && CARD_TYPE_LABEL[v]) return CARD_TYPE_LABEL[v];
  if (code.startsWith("V-")) return "Vendor";
  return "Customer";
}

export function yesNo(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (v === "tYES" || v === "Y") return "Yes";
  if (v === "tNO" || v === "N") return "No";
  return v;
}

/** Sort newest first by createdAt, then by code descending as a tie-break. */
export function newestFirst(records: SapRecord[]): SapRecord[] {
  return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.code.localeCompare(a.code));
}
