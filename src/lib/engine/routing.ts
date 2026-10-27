import type {
  ApprovalStep,
  BusinessUnit,
  Condition,
  DomainConfig,
  FieldValue,
  Person,
  RoleId,
  SlaConfig,
  StageDef,
  StepDef,
  StepStatus,
} from "@/lib/types";
import { evalCondition, toNumber } from "./conditions";
import { addBusinessDays } from "./sla";

export const MDM_STAGE_ID = "mdm-final";
export const MDM_STAGE_LABEL = "MDM final check";

export const ROLE_LABELS: Record<RoleId, string> = {
  requestor: "Requestor",
  bu_head: "BU Head",
  sales_manager: "Sales Manager",
  business_support: "Business Support",
  finance: "Finance",
  finance_director: "Finance Director",
  financial_controller: "Financial Controller",
  procurement: "Procurement",
  qa_ra: "QA/RA",
  mdm: "MDM",
  admin: "Admin",
};

/** Why a conditional step is needed, phrased as the outcome after the arrow in addedBecause. */
const ROLE_REASONS: Partial<Record<RoleId, string>> = {
  qa_ra: "regulatory review required",
  finance: "Finance review required",
  finance_director: "Finance Director approval required",
  financial_controller: "Financial Controller approval required",
  procurement: "Procurement review required",
  bu_head: "BU Head approval required",
  sales_manager: "Sales Manager approval required",
  business_support: "Business Support review required",
};

const FINAL: ReadonlySet<StepStatus> = new Set<StepStatus>(["approved", "rejected", "skipped"]);
const ACTIVE: ReadonlySet<StepStatus> = new Set<StepStatus>(["pending", "question"]);

export function isFinalStatus(s: StepStatus): boolean {
  return FINAL.has(s);
}

// ---------------------------------------------------------------------------------------------
// Assignment

const MAX_DELEGATION_HOPS = 3;

/**
 * Who fills a role for a request: the BU's role assignment, else the first person holding the role
 * (preferring the BU's own entity), else the MDM team so the step is never orphaned.
 * An out-of-office assignee with a delegate hands over to the delegate (following up to 3 hops).
 */
export function resolveAssignee(
  role: RoleId,
  bu: BusinessUnit | undefined,
  people: Person[],
): { assigneeId: string; originalAssigneeId?: string } {
  const byId = new Map(people.map((p) => [p.id, p]));
  const assigned = bu?.roleAssignments?.[role];
  let id: string | undefined = assigned && (byId.size === 0 || byId.has(assigned)) ? assigned : undefined;
  if (!id) {
    const holders = people.filter((p) => p.roles.includes(role));
    id = (holders.find((p) => bu && p.entity === bu.id) ?? holders[0])?.id;
  }
  if (!id) id = people.find((p) => p.roles.includes("mdm"))?.id ?? people[0]?.id ?? "";

  const original = id;
  const seen = new Set<string>([id]);
  for (let hop = 0; hop < MAX_DELEGATION_HOPS; hop++) {
    const p = byId.get(id);
    if (!p?.outOfOffice || !p.delegateId || seen.has(p.delegateId) || !byId.has(p.delegateId)) break;
    id = p.delegateId;
    seen.add(id);
  }
  return id === original ? { assigneeId: id } : { assigneeId: id, originalAssigneeId: original };
}

// ---------------------------------------------------------------------------------------------
// Route building

function humanizeKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w === "id" ? "ID" : w === "uom" ? "UoM" : w === "no" ? "no." : w));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatValue(v: FieldValue | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("en-SG");
  const n = toNumber(v);
  return Number.isFinite(n) && /^[\d,.\s]+$/.test(v.trim()) ? n.toLocaleString("en-SG") : v.trim();
}

/** Human-readable statement of why a condition holds for this data, e.g. "Category = IVD reagent". */
export function describeCondition(c: Condition, data: Record<string, FieldValue>): string {
  const name = humanizeKey(c.field);
  const actual = data[c.field];
  switch (c.op) {
    case "equals":
    case "in":
      return `${name} = ${formatValue(actual)}`;
    case "gt":
      return `${name} ${formatValue(actual)} > ${formatValue(typeof c.value === "number" ? c.value : String(c.value ?? ""))}`;
    case "isEmpty":
      return `${name} not provided`;
    case "notEmpty":
      return `${name} provided`;
    default:
      return name;
  }
}

function reasonFor(step: StepDef): string {
  return ROLE_REASONS[step.role] ?? `${step.label} required`;
}

function makeStep(
  stage: StageDef,
  stageIndex: number,
  def: StepDef,
  stepId: string,
  assignment: { assigneeId: string; originalAssigneeId?: string },
  addedBecause?: string,
): ApprovalStep {
  const step: ApprovalStep = {
    id: stepId,
    stageId: stage.id,
    stageLabel: stage.label,
    stageIndex,
    stageMode: stage.mode,
    role: def.role,
    label: def.label,
    assigneeId: assignment.assigneeId,
    status: "waiting",
    pausedMs: 0,
  };
  if (assignment.originalAssigneeId) step.originalAssigneeId = assignment.originalAssigneeId;
  if (addedBecause) step.addedBecause = addedBecause;
  return step;
}

/**
 * Build the approval route for a request:
 * domain stages (conditional steps filtered; included ones carry addedBecause) → BU extra stages → MDM final check.
 * Stages left with no steps are dropped, so stageIndex is contiguous. Every step starts 'waiting' with pausedMs 0.
 */
export function buildRoute(a: {
  domain: DomainConfig;
  bu?: BusinessUnit;
  data: Record<string, FieldValue>;
  people: Person[];
}): ApprovalStep[] {
  const { domain, bu, data, people } = a;
  const steps: ApprovalStep[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };

  const stages: { stage: StageDef; fromBu: boolean }[] = [
    ...domain.stages.filter((s) => s.id !== MDM_STAGE_ID).map((stage) => ({ stage, fromBu: false })),
    ...(bu?.extraStages ?? []).filter((s) => s.id !== MDM_STAGE_ID).map((stage) => ({ stage, fromBu: true })),
  ];

  let stageIndex = 0;
  for (const { stage, fromBu } of stages) {
    const included = stage.steps.filter((def) => evalCondition(def.condition, data));
    if (included.length === 0) continue;
    for (const def of included) {
      const parts: string[] = [];
      if (fromBu) parts.push(`Business unit ${bu!.id} rule → ${stage.label}`);
      if (def.condition) parts.push(`${describeCondition(def.condition, data)} → ${reasonFor(def)}`);
      steps.push(
        makeStep(
          stage,
          stageIndex,
          def,
          uniqueId(`${stage.id}.${def.id}`),
          resolveAssignee(def.role, bu, people),
          parts.length ? parts.join("; ") : undefined,
        ),
      );
    }
    stageIndex++;
  }

  const mdmStage: StageDef = {
    id: MDM_STAGE_ID,
    label: MDM_STAGE_LABEL,
    mode: "sequential",
    steps: [{ id: "mdm", label: "MDM final check — data quality and SAP B1 creation", role: "mdm" }],
  };
  steps.push(
    makeStep(mdmStage, stageIndex, mdmStage.steps[0], uniqueId(`${MDM_STAGE_ID}.mdm`), resolveAssignee("mdm", bu, people)),
  );
  return steps;
}

// ---------------------------------------------------------------------------------------------
// Progression

/**
 * Activate the current stage: the lowest stageIndex that still has non-final steps.
 * Parallel → all its waiting steps become pending; sequential → the first waiting step, unless one is already active.
 * Idempotent: calling it again changes nothing.
 */
export function activateNext(steps: ApprovalStep[], nowIso: string): ApprovalStep[] {
  const open = steps.filter((s) => !FINAL.has(s.status));
  if (open.length === 0) return steps;
  const current = Math.min(...open.map((s) => s.stageIndex));
  const inStage = steps.filter((s) => s.stageIndex === current);
  const parallel = inStage[0]?.stageMode === "parallel";

  let toActivate: Set<string>;
  if (parallel) {
    toActivate = new Set(inStage.filter((s) => s.status === "waiting").map((s) => s.id));
  } else {
    if (inStage.some((s) => ACTIVE.has(s.status))) return steps;
    const first = inStage.find((s) => s.status === "waiting");
    toActivate = new Set(first ? [first.id] : []);
  }
  if (toActivate.size === 0) return steps;
  return steps.map((s) => (toActivate.has(s.id) ? { ...s, status: "pending" as const, activatedAt: nowIso } : s));
}

/** Steps that are pending/question in `after` but were not active in `before` (use to send approval notifications). */
export function newlyActivated(before: ApprovalStep[], after: ApprovalStep[]): ApprovalStep[] {
  const wasActive = new Set(before.filter((s) => ACTIVE.has(s.status)).map((s) => s.id));
  return after.filter((s) => ACTIVE.has(s.status) && !wasActive.has(s.id));
}

export type DecisionOutcome = "continue" | "rejected" | "business_approved" | "completed" | "noop";

/**
 * Record an approver's decision on a pending (or question) step.
 * - noop: step missing or not pending/question (double click, stale tab) — steps returned unchanged (same reference)
 * - rejected: the step is rejected and every other open step is skipped
 * - approved: the next stage is activated (via activateNext); outcome is
 *   'business_approved' when only the MDM stage remains, 'completed' when the MDM step is approved, else 'continue'.
 * Deciding a step with an open question closes its pause (pausedMs accrues, pausedAt cleared).
 */
export function applyDecision(
  steps: ApprovalStep[],
  stepId: string,
  decision: "approved" | "rejected",
  nowIso: string,
  comment?: string,
): { steps: ApprovalStep[]; outcome: DecisionOutcome } {
  const target = steps.find((s) => s.id === stepId);
  if (!target || !ACTIVE.has(target.status)) return { steps, outcome: "noop" };

  const decided: ApprovalStep = { ...target, status: decision, decidedAt: nowIso };
  if (comment !== undefined && comment.trim() !== "") decided.comment = comment.trim();
  if (target.pausedAt) {
    const paused = Math.max(0, Date.parse(nowIso) - Date.parse(target.pausedAt));
    decided.pausedMs = (target.pausedMs || 0) + (Number.isFinite(paused) ? paused : 0);
    delete decided.pausedAt;
  }

  let next = steps.map((s) => (s.id === stepId ? decided : s));

  if (decision === "rejected") {
    next = next.map((s) => (FINAL.has(s.status) ? s : { ...s, status: "skipped" as const }));
    return { steps: next, outcome: "rejected" };
  }

  next = activateNext(next, nowIso);
  const isMdm = (s: ApprovalStep) => s.stageId === MDM_STAGE_ID;
  const done = (s: ApprovalStep) => s.status === "approved" || s.status === "skipped";
  const mdmSteps = next.filter(isMdm);
  const business = next.filter((s) => !isMdm(s));

  if (isMdm(decided)) {
    return { steps: next, outcome: mdmSteps.every(done) ? "completed" : "continue" };
  }
  if (business.every(done)) {
    return { steps: next, outcome: mdmSteps.length === 0 ? "completed" : "business_approved" };
  }
  return { steps: next, outcome: "continue" };
}

/**
 * Expected completion date for the route from startIso. Each remaining stage costs sla.stepBusinessDays
 * (a parallel stage counts once; a sequential stage once per open step). Stages already finished cost nothing,
 * so calling it mid-flight with startIso = now gives an up-to-date estimate.
 */
export function expectedCompletion(steps: ApprovalStep[], startIso: string, sla: SlaConfig): string {
  const byStage = new Map<number, ApprovalStep[]>();
  for (const s of steps) {
    if (FINAL.has(s.status)) continue;
    const list = byStage.get(s.stageIndex) ?? [];
    list.push(s);
    byStage.set(s.stageIndex, list);
  }
  let units = 0;
  for (const list of byStage.values()) units += list[0].stageMode === "parallel" ? 1 : list.length;
  return addBusinessDays(startIso, units * sla.stepBusinessDays);
}
