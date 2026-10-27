import type { Condition, DomainConfig, FieldDef, FieldValue } from "@/lib/types";

/** True when a value is null, undefined or blank text. */
export function isEmptyValue(v: FieldValue | undefined): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/**
 * Parse a number from a field value, tolerating currency symbols, thousands separators and
 * k/m suffixes ("S$80,000", "80k", "1.2m"). Returns NaN when the value is not numeric.
 */
export function toNumber(v: FieldValue | undefined): number {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return NaN;
  const s = v.trim().replace(/^(?:S\$|SGD|MYR|RM|THB|VND|MMK|USD|US\$|\$)\s*/i, "").replace(/,/g, "");
  const m = /^(-?\d+(?:\.\d+)?)\s*([kKmM])?$/.exec(s);
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  const suffix = m[2]?.toLowerCase();
  return suffix === "k" ? n * 1_000 : suffix === "m" ? n * 1_000_000 : n;
}

function norm(v: unknown): string {
  return String(v).trim().toLowerCase();
}

/**
 * Evaluate a config condition against request data.
 * - undefined condition → true
 * - equals / in compare String(value), trimmed and case-insensitive
 * - gt compares numerically (empty or non-numeric → false)
 */
export function evalCondition(c: Condition | undefined, data: Record<string, FieldValue>): boolean {
  if (!c) return true;
  const v = data[c.field];
  switch (c.op) {
    case "isEmpty":
      return isEmptyValue(v);
    case "notEmpty":
      return !isEmptyValue(v);
    case "equals":
      if (isEmptyValue(v)) return c.value === undefined || norm(c.value) === "";
      return norm(v) === norm(c.value ?? "");
    case "in": {
      if (isEmptyValue(v)) return false;
      const list = Array.isArray(c.value)
        ? c.value
        : typeof c.value === "string"
          ? c.value.split(",")
          : c.value === undefined
            ? []
            : [c.value];
      const needle = norm(v);
      return list.some((x) => norm(x) === needle);
    }
    case "gt": {
      if (isEmptyValue(v)) return false;
      const a = toNumber(v);
      const b = typeof c.value === "number" ? c.value : toNumber(typeof c.value === "string" ? c.value : null);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    default:
      return false;
  }
}

/** f.required, or f.requiredIf holds. */
export function isFieldRequired(f: FieldDef, data: Record<string, FieldValue>): boolean {
  if (f.required) return true;
  return f.requiredIf ? evalCondition(f.requiredIf, data) : false;
}

/** No showIf, or showIf holds. */
export function isFieldVisible(f: FieldDef, data: Record<string, FieldValue>): boolean {
  return !f.showIf || evalCondition(f.showIf, data);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate request data against a domain's fields. Hidden fields are skipped entirely.
 * Checks: required (incl. requiredIf), number type, email shape, pattern, maxLength.
 */
export function validateRequest(
  domain: DomainConfig,
  data: Record<string, FieldValue>,
): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const f of domain.fields) {
    if (!isFieldVisible(f, data)) continue;
    const v = data[f.key];
    if (isEmptyValue(v)) {
      if (isFieldRequired(f, data)) errors[f.key] = `${f.label} is required`;
      continue;
    }
    const s = String(v).trim();
    if (f.type === "number" && !Number.isFinite(toNumber(v))) {
      errors[f.key] = `${f.label} must be a number`;
      continue;
    }
    if (f.type === "email" && !EMAIL_RE.test(s)) {
      errors[f.key] = `${f.label} must be a valid email address`;
      continue;
    }
    if (f.pattern) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(f.pattern);
      } catch {
        re = null; // an invalid admin-entered pattern must never block a request
      }
      if (re && !re.test(s)) {
        errors[f.key] = f.patternHint ?? `${f.label} is not in the expected format`;
        continue;
      }
    }
    if (f.maxLength && s.length > f.maxLength) {
      errors[f.key] = `${f.label} must be ${f.maxLength} characters or fewer (SAP B1 limit)`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
