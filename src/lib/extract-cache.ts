/**
 * Paste-to-fill for the intake page (final model P0-05).
 *
 * The prototype has no live LLM. Two scripted demo inputs (Amy's old email and a customer spreadsheet row) have
 * CACHED extraction results, keyed by a hash of the normalised, already-redacted text. Any other text falls back
 * to the transparent rules extractor in the engine. Sensitive values are always stripped first, exactly as the
 * production in-tenant LLM path would do before text leaves the browser.
 */
import type { DomainConfig, FieldValue } from "@/lib/types";
import { IVD_CONSUMABLE_CATEGORY, REGULATED_CATEGORIES } from "@/config/default-config";
import { extractFieldsRules, redactSensitive } from "@/lib/engine/extract";
import { isEmptyValue } from "@/lib/engine/conditions";

// ---------------------------------------------------------------------------------------------
// Scripted demo inputs

/** Amy's original email to the MDM mailbox (case brief, App C), verbatim. */
export const AMY_EMAIL =
  "Hi MDM team, pls create item code for the new blood collection tubes we're importing. Item: K2EDTA Blood Collection Tube 4 mL, 100/pk. Manufacturer: Meditube Korea Co., Ltd. Category: lab consumable. Pack: 100 tubes/pack, UoM PACK. Cost SGD 18.50/pack, selling SGD 27.00/pack. Storage 4-25C. Entity SPD, for SG + MY hospital labs. Supplier bank for payment: DBS 123-456789-001. Need ASAP, customers are waiting. Thanks, Amy";

const CUSTOMER_HEADER = [
  "Customer name",
  "Country",
  "SSM reg no",
  "Address",
  "Postcode",
  "Phone",
  "Email",
  "Contact",
  "Payment terms",
  "Credit limit",
  "Bank account",
];
const CUSTOMER_VALUES = [
  "Putra Heights Diagnostic Laboratory Sdn Bhd",
  "MY",
  "1330456-K",
  "12 Jalan Putra Mahkota 7/8, Putra Heights, Subang Jaya",
  "47650",
  "+60 3 5191 2288",
  "accounts@putraheightsdx.example",
  "Dr Farah Aziz",
  "30 days",
  "80000",
  "Maybank 5142 7788 9910",
];

/** One row copied from a sales team's customer set-up spreadsheet (tab-separated, header line first). */
export const CUSTOMER_ROW = `${CUSTOMER_HEADER.join("\t")}\n${CUSTOMER_VALUES.join("\t")}`;

export const PASTE_EXAMPLES = {
  amy: { label: "Amy's old email", text: AMY_EMAIL },
  customer: { label: "Customer spreadsheet row", text: CUSTOMER_ROW },
} as const;

// ---------------------------------------------------------------------------------------------
// Redaction

const SENSITIVE_HEADER = /credit|bank|account|iban|swift|\bbic\b/i;

/**
 * Engine redaction first (bank accounts, IBAN, SWIFT, credit amounts in prose), then a header-aware pass for
 * tab-separated rows: any cell under a credit / bank / account column is removed even when it looks harmless
 * (e.g. a bare "80000" under "Credit limit"). Idempotent: already-redacted cells are not counted twice.
 */
export function redactForExtraction(text: string): { text: string; redactions: number } {
  const first = redactSensitive(typeof text === "string" ? text : "");
  let count = first.redactions;
  const lines = first.text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.trim() !== "");
  if (headerIdx < 0 || !lines[headerIdx].includes("\t")) return { text: first.text, redactions: count };

  const header = lines[headerIdx].split("\t");
  const sensitiveCols = header.map((h, i) => (SENSITIVE_HEADER.test(h) ? i : -1)).filter((i) => i >= 0);
  if (sensitiveCols.length === 0) return { text: first.text, redactions: count };

  const out = lines.map((line, li) => {
    if (li <= headerIdx || !line.includes("\t")) return line;
    const cells = line.split("\t");
    for (const c of sensitiveCols) {
      const cell = cells[c];
      if (cell === undefined || cell.trim() === "" || cell.includes("[REDACTED")) continue;
      cells[c] = /credit/i.test(header[c]) ? "[REDACTED AMOUNT]" : "[REDACTED ACCOUNT]";
      count++;
    }
    return cells.join("\t");
  });
  return { text: out.join("\n"), redactions: count };
}

// ---------------------------------------------------------------------------------------------
// Cache

/** Lower-case, whitespace-collapsed text: tolerant of trailing spaces and re-wrapped lines. */
export function normaliseForCache(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** FNV-1a 32-bit hash as 8 hex characters. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Cache key for any text: hash of the normalised text after redaction. */
export function cacheKeyFor(text: string): string {
  return hashText(normaliseForCache(redactForExtraction(text).text));
}

interface CachedExtraction {
  domainId: string;
  values: Record<string, FieldValue>;
  insights: string[];
}

const CACHE: Record<string, CachedExtraction> = {
  [cacheKeyFor(AMY_EMAIL)]: {
    domainId: "item",
    values: {
      itemName: "K2EDTA Blood Collection Tube 4 mL, 100/pk",
      category: IVD_CONSUMABLE_CATEGORY,
      productGroup: "B",
      manufacturer: "Meditube Korea Co., Ltd.",
      uom: "PCK",
      packSize: "100",
      costPrice: "18.50",
      salesPrice: "27.00",
      entity: "SPD",
      countries: "SG, MY",
    },
    insights: [
      "K2EDTA blood collection tubes are regulated as IVD medical devices (HSA Class A), so QA/RA review and a licence number are required",
      "“Lab consumable” in the email was refined to “Lab consumable – IVD medical device” (Product B · lab consumables)",
      "Storage 4–25 °C spans two SAP storage classes, so it was left for you to choose",
      "UoM “PACK” mapped to the SAP unit PCK, 100 tubes per pack",
    ],
  },
  [cacheKeyFor(CUSTOMER_ROW)]: {
    domainId: "customer",
    values: {
      customerName: "Putra Heights Diagnostic Laboratory Sdn Bhd",
      country: "MY",
      taxId: "1330456-K",
      segment: "Diagnostic lab",
      street: "12 Jalan Putra Mahkota 7/8, Putra Heights",
      city: "Subang Jaya",
      zipCode: "47650",
      phone: "+60 3 5191 2288",
      email: "accounts@putraheightsdx.example",
      contactPerson: "Dr Farah Aziz",
      paymentTerms: "Net 30",
      currency: "MYR",
    },
    insights: [
      "Spreadsheet columns matched to SAP fields by header name (SSM reg no → tax / registration no.)",
      "“30 days” mapped to the SAP payment-terms group Net 30; billing currency MYR inferred from country MY",
      "Credit limit and bank account were removed before extraction: type them straight into the protected fields",
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Public API

export interface IntakeExtraction {
  source: "cache" | "rules";
  domainId: string;
  values: Record<string, FieldValue>;
  /** Keys that received a value, in form order. */
  filledKeys: string[];
  redactions: number;
  /** What the extractor actually saw (sensitive values replaced). */
  redactedText: string;
  insights: string[];
}

const DOMAIN_HINTS: [RegExp, string][] = [
  [/\bcost\s*cent(?:re|er)\b|\bprofit\s*cent(?:re|er)\b/i, "costcentre"],
  [/\bextend\b|\badd (?:our|my) entity\b/i, "extend"],
  [/\bitem\s*code\b|\bitem:|\breagent\b|\btest kit\b|\bconsumable\b|\btubes?\b|\banalys[eo]r\b/i, "item"],
  [/\bvendor\b|\bsupplier set ?up\b|\bnew supplier\b/i, "vendor"],
];

function guessDomain(text: string, domains: DomainConfig[], preferred?: string): DomainConfig | undefined {
  const enabled = domains.filter((d) => d.enabled);
  const pref = enabled.find((d) => d.id === preferred);
  if (pref) return pref;
  for (const [re, id] of DOMAIN_HINTS) {
    const d = enabled.find((x) => x.id === id);
    if (d && re.test(text)) return d;
  }
  return enabled.find((d) => d.id === "customer") ?? enabled[0];
}

/** Keep only values for fields the domain has, and select values that are one of the field's options. */
function fitToDomain(values: Record<string, FieldValue>, domain: DomainConfig): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const f of domain.fields) {
    const v = values[f.key];
    if (isEmptyValue(v)) continue;
    if (f.type === "select" && f.options && !f.options.includes(String(v))) continue;
    out[f.key] = v as FieldValue;
  }
  return out;
}

/**
 * Redact, then use the cached extraction for the two scripted inputs, else the rules extractor.
 * `preferredDomainId` (the request type already picked) steers the rules path; a cached input always
 * opens its own request type. Never throws.
 */
export function extractForIntake(text: string, domains: DomainConfig[], preferredDomainId?: string): IntakeExtraction {
  const red = redactForExtraction(text ?? "");
  const cached = CACHE[hashText(normaliseForCache(red.text))];
  const cachedDomain = cached ? domains.find((d) => d.id === cached.domainId && d.enabled) : undefined;

  if (cached && cachedDomain) {
    const values = fitToDomain(cached.values, cachedDomain);
    return {
      source: "cache",
      domainId: cachedDomain.id,
      values,
      filledKeys: cachedDomain.fields.map((f) => f.key).filter((k) => k in values),
      redactions: red.redactions,
      redactedText: red.text,
      insights: cached.insights,
    };
  }

  const domain = guessDomain(red.text, domains, preferredDomainId);
  if (!domain) {
    return { source: "rules", domainId: preferredDomainId ?? "", values: {}, filledKeys: [], redactions: red.redactions, redactedText: red.text, insights: [] };
  }
  let values: Record<string, FieldValue> = {};
  try {
    values = fitToDomain(extractFieldsRules(red.text, domain).values, domain);
  } catch {
    values = {};
  }
  const insights: string[] = [];
  const category = String(values.category ?? "");
  if ((REGULATED_CATEGORIES as readonly string[]).includes(category)) {
    insights.push(`${category} is a regulated category, so QA/RA review and a licence number are required`);
  }
  if (Object.keys(values).length === 0) {
    insights.push("Nothing recognisable was found. Try labelled lines such as “Item: …” or a spreadsheet row with headers");
  }
  return {
    source: "rules",
    domainId: domain.id,
    values,
    filledKeys: domain.fields.map((f) => f.key).filter((k) => k in values),
    redactions: red.redactions,
    redactedText: red.text,
    insights,
  };
}
