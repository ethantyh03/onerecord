import type { ApprovalStep, MdmRequest, Person, SlaConfig } from "@/lib/types";

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

export type SlaEvent = { kind: "reminder" | "escalation"; stepId: string; toId: string; fromId?: string };

const OPEN_STATUSES = new Set<MdmRequest["status"]>(["in_approval", "needs_info", "mdm_review"]);

/**
 * Advance SLA state for one request. Only `pending` steps are considered (a `question` step's clock is paused).
 * - reminder once elapsed ≥ reminderAfterBusinessDays (to the current assignee)
 * - escalation once elapsed ≥ escalateAfterBusinessDays: reassigned to the assignee's delegate, else their manager;
 *   originalAssigneeId keeps the first owner. With no delegate or manager, the MDM team is notified and the
 *   assignee stays.
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
  let changed = false;

  const steps = req.steps.map((step) => {
    if (step.status !== "pending" || !step.activatedAt) return step;
    const elapsed = stepElapsedBusinessDays(step, nowIso);
    let next = step;

    if (!next.reminderSentAt && elapsed >= sla.reminderAfterBusinessDays) {
      next = { ...next, reminderSentAt: nowIso };
      events.push({ kind: "reminder", stepId: step.id, toId: step.assigneeId });
    }

    if (!next.escalatedAt && elapsed >= sla.escalateAfterBusinessDays) {
      const current = byId.get(next.assigneeId);
      const candidate = [current?.delegateId, current?.managerId].find(
        (id): id is string => !!id && id !== next.assigneeId && byId.has(id),
      );
      if (candidate) {
        events.push({ kind: "escalation", stepId: step.id, toId: candidate, fromId: next.assigneeId });
        next = {
          ...next,
          escalatedAt: nowIso,
          originalAssigneeId: next.originalAssigneeId ?? next.assigneeId,
          assigneeId: candidate,
        };
      } else {
        const mdm = people.find((p) => p.roles.includes("mdm") && p.id !== next.assigneeId);
        events.push({ kind: "escalation", stepId: step.id, toId: mdm?.id ?? next.assigneeId, fromId: next.assigneeId });
        next = { ...next, escalatedAt: nowIso };
      }
    }

    if (next !== step) changed = true;
    return next;
  });

  return { steps: changed ? steps : req.steps, events };
}
