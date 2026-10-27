import type { ApprovalStep, SlaConfig } from "@/lib/types";
import { formatDays } from "./format";

export type SlaTone = "idle" | "ok" | "warn" | "stuck" | "paused" | "done";

export interface SlaReading {
  tone: SlaTone;
  /** Short chip text, e.g. "1.5d left" */
  label: string;
  /** Plain-language explanation for the tooltip */
  detail: string;
}

/**
 * Turns a step plus its net elapsed business days into a chip reading.
 * Thresholds mirror the engine's slaTick: reminder at sla.reminderAfterBusinessDays,
 * due at sla.stepBusinessDays, escalation at sla.escalateAfterBusinessDays.
 */
export function readSla(step: ApprovalStep, elapsedBd: number | null, sla: SlaConfig): SlaReading {
  const target = sla.stepBusinessDays;
  switch (step.status) {
    case "waiting":
      return { tone: "idle", label: "Not started", detail: "The clock starts when the previous stage is approved." };
    case "skipped":
      return { tone: "idle", label: "Skipped", detail: "This step did not apply to the request." };
    case "approved":
    case "rejected": {
      const took = elapsedBd ?? 0;
      const over = took > target;
      return {
        tone: "done",
        label: took < 0.05 ? "Done same day" : `Done in ${formatDays(took)}d`,
        detail: over
          ? `Decided after ${formatDays(took)} business days, ${formatDays(took - target)} over the ${target}-day target.`
          : `Decided after ${formatDays(took)} of ${target} business days.`,
      };
    }
    case "question": {
      const used = elapsedBd ?? 0;
      return {
        tone: "paused",
        label: "Clock paused",
        detail: `Waiting for the requestor's answer. ${formatDays(used)} of ${target} business days used; the clock restarts when they reply.`,
      };
    }
    case "pending": {
      const used = elapsedBd ?? 0;
      if (step.escalatedAt) {
        return {
          tone: "stuck",
          label: "Escalated",
          detail: `No decision after ${sla.escalateAfterBusinessDays} business days, so the step was escalated${
            step.originalAssigneeId ? " and reassigned" : ""
          }.`,
        };
      }
      const remaining = target - used;
      if (remaining < 0) {
        return {
          tone: "stuck",
          label: `Overdue ${formatDays(-remaining)}d`,
          detail: `${formatDays(used)} business days without a decision; the target is ${target}. Escalation at ${sla.escalateAfterBusinessDays}.`,
        };
      }
      if (used >= sla.reminderAfterBusinessDays) {
        return {
          tone: "warn",
          label: `${formatDays(remaining)}d left`,
          detail: `${formatDays(remaining)} of ${target} business days left. ${
            step.reminderSentAt ? "A reminder went to the approver." : "A reminder is due to the approver."
          }`,
        };
      }
      return {
        tone: "ok",
        label: `${formatDays(remaining)}d left`,
        detail: `${formatDays(remaining)} of ${target} business days left. A reminder goes out after ${sla.reminderAfterBusinessDays}.`,
      };
    }
    default:
      return { tone: "idle", label: "—", detail: "" };
  }
}
