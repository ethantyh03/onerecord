import type { CountryCode, DomainConfig, MdmRequest } from "@/lib/types";

/**
 * SAP code numbering convention:
 * customer C-SG-00123 / vendor V-MY-00045 (country scope, 5 digits), item I-A-000812 (product-group scope, 6 digits),
 * cost centre CC-SG-0031 (country scope, 4 digits).
 */
export function codeDigits(prefix: string): number {
  if (prefix === "I") return 6;
  if (prefix === "CC") return 4;
  return 5;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Next free code in prefix+scope, one above the highest existing number (codes in other scopes are ignored). */
export function nextSapCode(prefix: string, scope: string, existing: string[]): string {
  const re = new RegExp(`^${escapeRe(prefix)}-${escapeRe(scope)}-(\\d+)$`, "i");
  let max = 0;
  for (const code of existing) {
    const m = re.exec(code.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${scope}-${String(max + 1).padStart(codeDigits(prefix), "0")}`;
}

const COUNTRY_CODES: readonly CountryCode[] = ["SG", "MY", "TH", "VN", "MM"];

/** Product group ("A" | "B" | "C") from a raw value such as "A", "Product A" or "Product A · IVD reagents & test kits". */
export function productGroupOf(v: unknown): "A" | "B" | "C" | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase();
  const m = /^(?:PRODUCT\s*)?([ABC])\b/.exec(s);
  return m ? (m[1] as "A" | "B" | "C") : null;
}

/** The numbering scope for a request: product group for items, otherwise the record's country. */
export function codeScopeFor(domain: DomainConfig, req: MdmRequest): string {
  if (domain.codePrefix === "I") return productGroupOf(req.data.productGroup) ?? "A";
  const c = String(req.data.country ?? "").trim().toUpperCase();
  return (COUNTRY_CODES as readonly string[]).includes(c) ? c : req.country;
}

/**
 * Code to use when the request lands in SAP B1. Extensions reuse the existing record's code;
 * everything else gets the next number in its scope.
 */
export function assignSapCode(domain: DomainConfig, req: MdmRequest, existing: string[]): string {
  const existingCode = String(req.data.existingCode ?? "").trim();
  if (domain.id === "extend" && existingCode) return existingCode.toUpperCase();
  return nextSapCode(domain.codePrefix, codeScopeFor(domain, req), existing);
}

/** SAP B1 key length limit for cost centres (OPRC.PrcCode). */
export const PRC_CODE_MAX = 8;

/**
 * The key a code is stored under inside SAP B1. Business partner and item codes fit their SAP keys as-is;
 * a cost-centre display code such as CC-SG-0031 (10 characters) exceeds OPRC.PrcCode's 8, so SAP holds it
 * without the "CC-" prefix (SG-0031). Tesseract keeps showing the full display code everywhere else.
 */
export function sapKeyFor(code: string): string {
  const c = code.trim();
  if (c.length <= PRC_CODE_MAX) return c;
  const short = c.replace(/^CC-/i, "");
  return short.length <= PRC_CODE_MAX ? short : c;
}
