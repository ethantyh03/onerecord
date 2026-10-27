import { stepElapsedBusinessDays } from "@/lib/engine/sla";
import { isFieldVisible } from "@/lib/engine/conditions";
import { formatDays } from "@/components/common/format";
import type {
  ApprovalStep,
  CountryCode,
  DomainConfig,
  FieldValue,
  MdmRequest,
  RoleId,
  SlaConfig,
} from "@/lib/types";
import { COUNTRIES } from "@/lib/types";

export type TeamsSlaTone = "ok" | "soon" | "overdue" | "paused" | "done";

export interface TeamsSla {
  /** Business days left before the step breaches its SLA (negative once overdue). */
  remainingDays: number;
  /** Teams-card wording, e.g. "Due in 1.5 business days" */
  label: string;
  tone: TeamsSlaTone;
}

function businessDaysLabel(days: number): string {
  const text = formatDays(days);
  return `${text} business ${text === "1" ? "day" : "days"}`;
}

/**
 * SLA position of one approval step in Teams-card wording. Uses the engine's net-elapsed rule
 * (business days since activation minus paused time), the same clock slaTick runs on.
 */
export function teamsSla(step: ApprovalStep, sla: SlaConfig, nowIso: string): TeamsSla {
  const budget = sla.stepBusinessDays;
  if (step.status === "approved" || step.status === "rejected" || step.status === "skipped") {
    return { remainingDays: 0, label: "Decision recorded", tone: "done" };
  }
  if (!step.activatedAt) {
    return { remainingDays: budget, label: `${businessDaysLabel(budget)} once active`, tone: "ok" };
  }
  const remaining = budget - stepElapsedBusinessDays(step, nowIso);
  if (step.status === "question") {
    return { remainingDays: remaining, label: "SLA paused · question open", tone: "paused" };
  }
  if (remaining >= 0.05) {
    return {
      remainingDays: remaining,
      label: `Due in ${businessDaysLabel(remaining)}`,
      tone: remaining <= 0.5 ? "soon" : "ok",
    };
  }
  if (remaining > -0.05) return { remainingDays: remaining, label: "Due now", tone: "soon" };
  return { remainingDays: remaining, label: `Overdue by ${businessDaysLabel(remaining)}`, tone: "overdue" };
}

export interface KeyFact {
  key: string;
  label: string;
  value: FieldValue;
  sensitive: boolean;
}

const FINANCE_ROLES: RoleId[] = ["finance", "finance_director", "financial_controller"];

function hasValue(v: FieldValue | undefined): v is string | number {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * The short fact list on an approval card. Non-sensitive facts keep config order;
 * sensitive facts (bank, credit, payment terms) are capped at 3 and lead for finance approvers.
 */
export function buildKeyFacts(
  request: MdmRequest,
  domain: DomainConfig | undefined,
  opts: { limit?: number; role?: RoleId } = {},
): KeyFact[] {
  const limit = opts.limit ?? 6;
  const data = request.data ?? {};
  let facts: KeyFact[];
  if (domain) {
    facts = domain.fields
      .filter((f) => f.type !== "file" && f.type !== "textarea")
      .filter((f) => isFieldVisible(f, data) && hasValue(data[f.key]))
      .map((f) => ({ key: f.key, label: f.label, value: data[f.key], sensitive: Boolean(f.sensitive) }));
  } else {
    facts = Object.entries(data)
      .filter(([, v]) => hasValue(v))
      .map(([k, v]) => ({ key: k, label: humanize(k), value: v, sensitive: false }));
  }
  const plain = facts.filter((f) => !f.sensitive);
  const sensitive = facts.filter((f) => f.sensitive).slice(0, 3);
  if (opts.role && FINANCE_ROLES.includes(opts.role)) {
    return [...sensitive, ...plain].slice(0, Math.max(limit, sensitive.length));
  }
  const plainSlots = Math.max(0, limit - sensitive.length);
  return [...plain.slice(0, plainSlots), ...sensitive].slice(0, limit);
}

export function countryName(code: CountryCode | string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? String(code);
}

export function formatFactValue(v: FieldValue | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-SG");
  return v;
}
