import type { ApprovalStep, MdmRequest, Person, SlaConfig, StepStatus } from "@/lib/types";

/**
 * Business-time arithmetic in Singapore time (UTC+8, no DST).
 *
 * Business time runs continuously Mon 00:00 → Sat 00:00 SGT and stops over the weekend, so
 * "1 business day" = 24 business hours. ISO strings are treated as instants.
 */
const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const BUSINESS_WEEK_MS = 5 * DAY_MS;
const SGT_OFFSET_MS = 8 * HOUR_MS;
/** 1970-01-05 (a Monday) 00:00 in SGT wall-clock milliseconds. */
const MONDAY_ANCHOR = 4 * DAY_MS;

function parseInstant(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new RangeError(`Invalid ISO date: ${iso}`);
  return t;
}

/** Business milliseconds elapsed since the anchor Monday for an instant. Weekend instants clamp to the next Monday 00:00. */
function businessMsAt(t: number): number {
  const local = t + SGT_OFFSET_MS - MONDAY_ANCHOR;
  const weeks = Math.floor(local / WEEK_MS);
  const inWeek = local - weeks * WEEK_MS;
  return weeks * BUSINESS_WEEK_MS + Math.min(inWeek, BUSINESS_WEEK_MS);
}

/** Inverse of businessMsAt: the earliest instant at which the business clock reads `b`. */
function instantAtBusinessMs(b: number): number {
  const weeks = Math.floor(b / BUSINESS_WEEK_MS);
  const rem = b - weeks * BUSINESS_WEEK_MS;
  return weeks * WEEK_MS + rem + MONDAY_ANCHOR - SGT_OFFSET_MS;
}

/** Add (possibly fractional) business days, skipping Sat/Sun in SGT. A weekend start counts from Monday 00:00. */
export function addBusinessDays(iso: string, days: number): string {
  const t = parseInstant(iso);
  if (!Number.isFinite(days) || days === 0) return new Date(t).toISOString();
  const target = businessMsAt(t) + Math.round(days * DAY_MS);
  return new Date(instantAtBusinessMs(target)).toISOString();
}

/** Fractional business days from a to b (negative when b is before a), excluding weekends in SGT. */
export function businessDaysBetween(aIso: string, bIso: string): number {
  return (businessMsAt(parseInstant(bIso)) - businessMsAt(parseInstant(aIso))) / DAY_MS;
}

/** True when the instant falls on Saturday or Sunday in SGT. */
export function isWeekendSgt(iso: string): boolean {
  const local = parseInstant(iso) + SGT_OFFSET_MS - MONDAY_ANCHOR;
  const inWeek = local - Math.floor(local / WEEK_MS) * WEEK_MS;
  return inWeek >= BUSINESS_WEEK_MS;
}

/** Business days a step has been waiting, net of paused (question) time. 0 when the step has not been activated. */
export function stepElapsedBusinessDays(step: ApprovalStep, nowIso: string): number {
  if (!step.activatedAt) return 0;
  let paused = step.pausedMs || 0;
  if (step.status === "question" && step.pausedAt) {
    paused += Math.max(0, parseInstant(nowIso) - parseInstant(step.pausedAt));
  }
  return Math.max(0, businessDaysBetween(step.activatedAt, nowIso) - paused / DAY_MS);
}

/** Why a would-be escalation target was passed over (segregation of duties). */
export type SodSkip = {
  id: string;
  reason: "requestor" | "requestor_delegate" | "holds_step";
  /** For holds_step: the other step on the request that this person holds or has decided, and its status. */
  stepLabel?: string;
  stepStatus?: StepStatus;
};

export type SlaEvent = {
  kind: "reminder" | "escalation";
  stepId: string;
  toId: string;
  fromId?: string;
  /** Escalation only: eligible-looking targets skipped for segregation of duties, in the order they were tried. */
  skipped?: SodSkip[];
};

/**
 * Segregation of duties for a reassignment: may `personId` take over step `stepId` of `req`?
 * Returns why not, or null when they may. Nobody approves their own request (nor does the requestor's delegate,
 * matching segregationCheck), and nobody holds or decides two steps of the same request. Skipped steps were
 * never decided, so they don't count.
 */
export function reassignmentConflict(
  req: Pick<MdmRequest, "requestorId" | "steps">,
  stepId: string,
  personId: string,
  people: Pick<Person, "id" | "delegateId">[],
): SodSkip | null {
  if (personId === req.requestorId) return { id: personId, reason: "requestor" };
  const requestor = people.find((p) => p.id === req.requestorId);
  if (requestor?.delegateId && requestor.delegateId === personId) return { id: personId, reason: "requestor_delegate" };
  const other = req.steps.find((s) => s.id !== stepId && s.status !== "skipped" && s.assigneeId === personId);
  return other ? { id: personId, reason: "holds_step", stepLabel: other.label, stepStatus: other.status } : null;
}

const OPEN_STATUSES = new Set<MdmRequest["status"]>(["in_approval", "needs_info", "mdm_review"]);

/**
 * Advance SLA state for one request. Only `pending` steps are considered (a `question` step's clock is paused).
 * - reminder once elapsed ≥ reminderAfterBusinessDays (to the current assignee)
 * - escalation once elapsed ≥ escalateAfterBusinessDays: reassigned to the assignee's delegate, else their manager;
 *   originalAssigneeId keeps the first owner. Segregation of duties (reassignmentConflict) applies: a target who
 *   raised the request or already holds or decided another step on it is skipped, and the first choice's manager is
 *   tried once more. With no eligible delegate or manager, the MDM team is notified and the assignee stays.
 * Steps are handled in order, so two steps escalating in the same tick never land on the same person.
 * Idempotent: reminderSentAt / escalatedAt guard against repeats, so a second tick yields no events.
 */
export function slaTick(
  req: MdmRequest,
  nowIso: string,
  sla: SlaConfig,
  people: Person[],
): { steps: ApprovalStep[]; events: SlaEvent[] } {
  const events: SlaEvent[] = [];
  if (!OPEN_STATUSES.has(req.status)) return { steps: req.steps, events };
  const byId = new Map(people.map((p) => [p.id, p]));
  const steps = [...req.steps];
  let changed = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.status !== "pending" || !step.activatedAt) continue;
    const elapsed = stepElapsedBusinessDays(step, nowIso);
    let next = step;

    if (!next.reminderSentAt && elapsed >= sla.reminderAfterBusinessDays) {
      next = { ...next, reminderSentAt: nowIso };
      events.push({ kind: "reminder", stepId: step.id, toId: step.assigneeId });
    }

    if (!next.escalatedAt && elapsed >= sla.escalateAfterBusinessDays) {
      const from = next.assigneeId;
      const current = byId.get(from);
      const valid = (id: string | undefined): id is string => !!id && id !== from && byId.has(id);
      // Delegate, else manager (the plain rule); then, one level up, the first choice's manager.
      const direct = [current?.delegateId, current?.managerId].filter(valid);
      const chain = [...new Set([...direct, byId.get(direct[0] ?? "")?.managerId].filter(valid))];
      // Judge eligibility against the steps as they stand now, including reassignments earlier in this tick.
      const view = { requestorId: req.requestorId, steps };
      const skipped: SodSkip[] = [];
      const candidate = chain.find((id) => {
        const conflict = reassignmentConflict(view, step.id, id, people);
        if (conflict) skipped.push(conflict);
        return !conflict;
      });
      const extra = skipped.length ? { skipped } : {};
      if (candidate) {
        events.push({ kind: "escalation", stepId: step.id, toId: candidate, fromId: from, ...extra });
        next = {
          ...next,
          escalatedAt: nowIso,
          originalAssigneeId: next.originalAssigneeId ?? from,
          assigneeId: candidate,
        };
      } else {
        const mdm = people.find((p) => p.roles.includes("mdm") && p.id !== from);
        events.push({ kind: "escalation", stepId: step.id, toId: mdm?.id ?? from, fromId: from, ...extra });
        next = { ...next, escalatedAt: nowIso };
      }
    }

    if (next !== step) {
      steps[i] = next;
      changed = true;
    }
  }

  return { steps: changed ? steps : req.steps, events };
}
