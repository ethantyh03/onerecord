/**
 * Pure helpers for the intake page: duplicate-check candidates, entity options, defaults, completeness and the
 * submit gate. No React, so they are unit-tested.
 */
import type {
  BusinessUnit,
  CountryCode,
  CustomerMaster,
  DomainConfig,
  DuplicateDecision,
  DuplicateMatch,
  FieldDef,
  FieldValue,
  Person,
  SapRecord,
} from "@/lib/types";
import { COUNTRIES } from "@/lib/types";
import { isEmptyValue, isFieldRequired, isFieldVisible, toNumber, validateRequest } from "@/lib/engine/conditions";
import { findDuplicates, type DupInput } from "@/lib/engine/dedupe";
import { entitiesOf } from "@/lib/seed";

/** A match at or above this score must be resolved (use existing / extend / override) before submit. */
export const DUP_DECISION_THRESHOLD = 0.85;
/** Minimum length of an override justification. */
export const OVERRIDE_MIN_CHARS = 20;

const COUNTRY_SET = new Set<string>(COUNTRIES.map((c) => c.code));

// ---------------------------------------------------------------------------------------------
// Duplicate-check candidates

function toMaster(rec: SapRecord): CustomerMaster | null {
  const country = String(rec.fields["BPAddresses.Country"] ?? /^[CV]-([A-Z]{2})-/.exec(rec.code)?.[1] ?? "").toUpperCase();
  if (!COUNTRY_SET.has(country)) return null;
  return {
    cardCode: rec.code,
    cardName: rec.fields.CardName ?? rec.name,
    entity: entitiesOf(rec).join(", ") || "—",
    country: country as CountryCode,
    licTradNum: rec.fields.FederalTaxID,
    street: rec.fields["BPAddresses.Street"],
    zipCode: rec.fields["BPAddresses.ZipCode"],
    phone1: rec.fields.Phone1,
    email: rec.fields.EmailAddress,
    goldenId: rec.code,
    segment: rec.fields.GroupCode ?? "",
    hasTransactions: false,
  };
}

/**
 * Records to check a new business partner against.
 * - customer / extend: SAP master customers (master.json) plus customer records in the sandbox SAP B1
 *   (anything created during the demo). Sandbox entities win, so an extension shows the entity it gained.
 * - vendor: supplier records in the sandbox SAP B1.
 */
export function dupCandidates(
  kind: "customer" | "vendor",
  masterCustomers: CustomerMaster[],
  sapRecords: SapRecord[],
): CustomerMaster[] {
  const wantType = kind === "vendor" ? "cSupplier" : "cCustomer";
  const fromSap = sapRecords
    .filter((r) => r.object === "oBusinessPartners" && (r.fields.CardType ?? (r.code.startsWith("V-") ? "cSupplier" : "cCustomer")) === wantType)
    .map(toMaster)
    .filter((x): x is CustomerMaster => !!x);
  if (kind === "vendor") return fromSap;
  const byCode = new Map<string, CustomerMaster>();
  for (const m of masterCustomers) byCode.set(m.cardCode, m);
  for (const s of fromSap) {
    const m = byCode.get(s.cardCode);
    byCode.set(s.cardCode, m ? { ...m, entity: s.entity !== "—" ? s.entity : m.entity } : s);
  }
  return [...byCode.values()];
}

/** The duplicate-check input for a customer or vendor form. */
export function dupInputFor(domain: DomainConfig, data: Record<string, FieldValue>): DupInput | null {
  const nameKey = domain.id === "vendor" ? "vendorName" : domain.id === "customer" ? "customerName" : null;
  if (!nameKey) return null;
  const str = (k: string) => (isEmptyValue(data[k]) ? undefined : String(data[k]).trim());
  const country = str("country")?.toUpperCase();
  return {
    name: str(nameKey) ?? "",
    country: country && COUNTRY_SET.has(country) ? (country as CountryCode) : undefined,
    taxId: str("taxId"),
    zipCode: str("zipCode"),
    phone: str("phone"),
    email: str("email"),
  };
}

export function runDupCheck(input: DupInput | null, candidates: CustomerMaster[]): DuplicateMatch[] {
  if (!input) return [];
  return findDuplicates(input, candidates, { limit: 3, threshold: 0.75 });
}

// ---------------------------------------------------------------------------------------------
// Form defaults and options

export interface EntityOption {
  id: string;
  label: string;
  configured: boolean;
}

/** Configured business units, plus the requestor's own entity when MDM has not configured it yet. */
export function entityOptions(units: BusinessUnit[], person: Person | undefined): EntityOption[] {
  const out: EntityOption[] = units.map((b) => ({ id: b.id, label: b.name, configured: true }));
  if (person?.entity && !units.some((b) => b.id === person.entity)) {
    out.push({ id: person.entity, label: `${person.entity} (not configured yet)`, configured: false });
  }
  return out;
}

/** Starting values for a new form: the requestor's country and entity. */
export function defaultData(domain: DomainConfig, person: Person | undefined): Record<string, FieldValue> {
  const data: Record<string, FieldValue> = {};
  if (!person) return data;
  for (const f of domain.fields) {
    if (f.type === "country") data[f.key] = person.country;
    if (f.type === "entity") data[f.key] = person.entity;
  }
  return data;
}

/** The entity a request routes under (same rule as the store). */
export function requestEntity(data: Record<string, FieldValue>, person: Person | undefined): string {
  for (const k of ["entity", "extendToEntity"]) if (!isEmptyValue(data[k])) return String(data[k]).trim();
  return person?.entity ?? "";
}

/** Number fields go to the store as numbers when they parse ("80,000" → 80000); everything else is trimmed. */
export function toStoreData(domain: DomainConfig, data: Record<string, FieldValue>): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const [k, v] of Object.entries(data)) {
    const f = domain.fields.find((x) => x.key === k);
    if (v === null || v === undefined) continue;
    if (f?.type === "number" && typeof v === "string") {
      const n = toNumber(v);
      out[k] = v.trim() === "" ? null : Number.isFinite(n) ? n : v;
    } else {
      out[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Completeness and submit gate

export interface Completeness {
  required: FieldDef[];
  missing: FieldDef[];
  errors: Record<string, string>;
}

export function completeness(domain: DomainConfig, data: Record<string, FieldValue>): Completeness {
  const required = domain.fields.filter((f) => isFieldVisible(f, data) && isFieldRequired(f, data));
  const missing = required.filter((f) => isEmptyValue(data[f.key]));
  const { errors } = validateRequest(domain, data);
  return { required, missing, errors };
}

export interface GateInput {
  domain: DomainConfig | undefined;
  data: Record<string, FieldValue>;
  matches: DuplicateMatch[];
  decision: DuplicateDecision | undefined;
}

/** Plain-language reasons Submit is disabled (empty = ready). */
export function submitBlockers({ domain, data, matches, decision }: GateInput): string[] {
  if (!domain) return ["Pick a request type"];
  const out: string[] = [];
  const c = completeness(domain, data);
  if (c.missing.length) out.push(`${c.missing.length} required field${c.missing.length === 1 ? "" : "s"} still empty`);
  const invalid = Object.keys(c.errors).filter((k) => !c.missing.some((f) => f.key === k));
  if (invalid.length) out.push(`${invalid.length} field${invalid.length === 1 ? " needs" : "s need"} fixing`);
  const top = matches[0];
  if (top && top.score >= DUP_DECISION_THRESHOLD) {
    if (!decision) out.push("Choose what to do about the possible duplicate");
    else if (decision.choice === "use_existing") out.push("You chose to use the existing record, so there is nothing new to create");
    else if (decision.choice === "override" && (decision.justification ?? "").trim().length < OVERRIDE_MIN_CHARS) {
      out.push(`Explain the override in at least ${OVERRIDE_MIN_CHARS} characters`);
    }
  }
  return out;
}

/** "Tue 3 Nov" in Singapore time. */
export function formatLiveDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", weekday: "short", day: "numeric", month: "short" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month === "Sept" ? "Sep" : parts.month}`;
}
