import type { FieldValue, Person, RoleId } from "@/lib/types";

/** Roles allowed to see bank details, credit limits and payment terms. Every reveal is audit-logged by the store. */
export const SENSITIVE_ROLES: RoleId[] = ["finance", "finance_director", "financial_controller", "mdm"];

export function canSeeSensitive(p: Person | undefined | null): boolean {
  return !!p && p.roles.some((r) => SENSITIVE_ROLES.includes(r));
}

const MASK = "••••";
/** Values shorter than this are hidden completely: showing the last 4 would reveal most or all of them. */
const MIN_LENGTH_FOR_TAIL = 8;

/**
 * Mask a sensitive value for display: null/empty → "—"; otherwise "•••• " + last 4 characters
 * (e.g. "•••• 7890"). Short values such as a credit limit (80000) or "Net 30" are fully hidden ("••••••").
 */
export function maskValue(v: FieldValue | undefined): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (s === "") return "—";
  if (s.length < MIN_LENGTH_FOR_TAIL) return `${MASK}••`;
  return `${MASK} ${s.slice(-4)}`;
}
