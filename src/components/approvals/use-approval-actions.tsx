"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useSandbox } from "@/lib/store";
import { canActOnStep, hoursForBusinessDays, personById } from "@/lib/selectors";
import { FINANCE_ROLES } from "@/lib/engine/routing";
import type { AppNotification, ApprovalStep, MdmRequest } from "@/lib/types";

/** Vendor bank fields that trigger the call-back control (final model P1-05). */
export const BANK_FIELD_KEYS = ["bankName", "bankAccountNo", "swift"] as const;

export const CALLBACK_LABEL = "Bank details verified by call-back to an independently sourced number";

/** Finance step on a vendor request that carries bank details: Approve needs the call-back tick. */
export function needsCallbackCheck(request: Pick<MdmRequest, "domainId" | "data">, step: Pick<ApprovalStep, "role">): boolean {
  if (request.domainId !== "vendor" || !FINANCE_ROLES.includes(step.role)) return false;
  return BANK_FIELD_KEYS.some((k) => {
    const v = request.data?.[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });
}

type Outcome = { ok: boolean; reason?: string };

/** Toast title for a blocked decision: the requestor's own request gets the plain-language SoD line. */
function blockedTitle(request: MdmRequest, verb: "approve" | "reject" | "ask on"): string {
  const s = useSandbox.getState();
  if (s.personaId === request.requestorId) {
    return verb === "ask on"
      ? "Segregation of duties: you can't ask questions on your own request"
      : `Segregation of duties: you can't ${verb} your own request`;
  }
  return `Can't ${verb} ${request.id}`;
}

/** Marks the persona's notifications about this step read once they've acted on it. */
function markStepRead(requestId: string, stepId: string): void {
  const s = useSandbox.getState();
  for (const n of s.notifications) {
    if (!n.read && n.toId === s.personaId && n.requestId === requestId && n.stepId === stepId) s.markNotificationRead(n.id);
  }
}

function nameOf(id: string | undefined): string {
  return personById(useSandbox.getState(), id)?.name ?? id ?? "someone";
}

/** Notifications added by the action that just ran (store prepends new ones). */
function newSince(before: ReadonlySet<string>): AppNotification[] {
  return useSandbox.getState().notifications.filter((n) => !before.has(n.id));
}

function snapshotIds(): Set<string> {
  return new Set(useSandbox.getState().notifications.map((n) => n.id));
}

/**
 * Who may decide this step right now, as the current persona: segregation of duties first (canActOnStep),
 * then "is it yours?" (the assignee, or the original assignee who delegated it).
 */
export function checkCanAct(requestId: string, stepId: string): Outcome {
  const s = useSandbox.getState();
  const me = s.personaId;
  const sod = canActOnStep(s, requestId, stepId, me);
  if (!sod.ok) return sod;
  const req = s.requests.find((r) => r.id === requestId);
  const step = req?.steps.find((x) => x.id === stepId);
  if (step && step.assigneeId !== me && step.originalAssigneeId !== me) {
    return {
      ok: false,
      reason: `This step is assigned to ${nameOf(step.assigneeId)}. Switch persona to ${nameOf(step.assigneeId)} to decide it.`,
    };
  }
  return { ok: true };
}

/**
 * Approve / reject / ask / answer with the guard, the store call and the toast in one place,
 * so the Teams card, the Outlook message and the phone all behave the same way.
 */
export function useApprovalActions() {
  const approve = useCallback((request: MdmRequest, step: ApprovalStep, comment?: string): boolean => {
    const guard = checkCanAct(request.id, step.id);
    if (!guard.ok) {
      toast.error(blockedTitle(request, "approve"), { description: guard.reason });
      return false;
    }
    const before = snapshotIds();
    const res = useSandbox.getState().approveStep(request.id, step.id, comment);
    if (!res.ok) {
      toast.error(`Can't approve ${request.id}`, { description: res.reason ?? res.error });
      return false;
    }
    markStepRead(request.id, step.id);
    const added = newSince(before);
    const next = added.filter((n) => n.kind === "approval" && n.channel === "teams");
    const nextNames = Array.from(new Set(next.map((n) => nameOf(n.toId))));
    const after = useSandbox.getState().requests.find((r) => r.id === request.id);
    let description: string;
    if (nextNames.length > 0) {
      description = `Next: ${nextNames.join(", ")} ${nextNames.length === 1 ? "has" : "have"} the approval card in Teams. ${nameOf(request.requestorId)} was told.`;
    } else if (after?.status === "mdm_review") {
      description = `All approvals are in. ${nameOf(request.requestorId)} was told it's with MDM for the SAP B1 step.`;
    } else {
      description = `${step.label} recorded. ${nameOf(request.requestorId)} was told; other reviewers in this stage are still deciding.`;
    }
    toast.success("Approved · Teams notification sent", { description });
    return true;
  }, []);

  const reject = useCallback((request: MdmRequest, step: ApprovalStep, comment: string): boolean => {
    const guard = checkCanAct(request.id, step.id);
    if (!guard.ok) {
      toast.error(blockedTitle(request, "reject"), { description: guard.reason });
      return false;
    }
    if (!comment.trim()) {
      toast.error("Add a reason before rejecting", { description: "The requestor needs to know what to fix." });
      return false;
    }
    const res = useSandbox.getState().rejectStep(request.id, step.id, comment);
    if (!res.ok) {
      toast.error(`Can't reject ${request.id}`, { description: res.reason ?? res.error });
      return false;
    }
    markStepRead(request.id, step.id);
    toast(`Rejected · ${request.id}`, {
      description: `${nameOf(request.requestorId)} got your reason in Teams and Outlook.`,
    });
    return true;
  }, []);

  const ask = useCallback((request: MdmRequest, step: ApprovalStep, text: string): boolean => {
    const guard = checkCanAct(request.id, step.id);
    if (!guard.ok) {
      toast.error(blockedTitle(request, "ask on"), { description: guard.reason });
      return false;
    }
    const res = useSandbox.getState().askQuestion(request.id, step.id, text);
    if (!res.ok) {
      toast.error(`Can't ask on ${request.id}`, { description: res.reason ?? res.error });
      return false;
    }
    markStepRead(request.id, step.id);
    toast(`Question sent to ${nameOf(request.requestorId)} · Teams`, {
      description: "Your step's SLA clock is paused until they answer. The answer comes back to you.",
    });
    return true;
  }, []);

  const answer = useCallback((request: MdmRequest, step: ApprovalStep, text: string): boolean => {
    const s = useSandbox.getState();
    if (s.personaId !== request.requestorId) {
      toast.error(`Only ${nameOf(request.requestorId)} can answer this question`);
      return false;
    }
    const res = s.answerQuestion(request.id, step.id, text);
    if (!res.ok) {
      toast.error(`Can't send the answer on ${request.id}`, { description: res.reason ?? res.error });
      return false;
    }
    markStepRead(request.id, step.id);
    toast.success(`Back with ${nameOf(step.assigneeId)} — the chain did not restart`, {
      description: `${step.label} is active again. The paused time doesn't count against the SLA.`,
    });
    return true;
  }, []);

  return { approve, reject, ask, answer };
}

/** "+N business days" on the sandbox clock, with a toast naming every reminder and escalation it produced. */
export function runFastForward(businessDays: number): void {
  const s = useSandbox.getState();
  const before = snapshotIds();
  const hours = hoursForBusinessDays(s.nowIso(), businessDays);
  const res = s.fastForward(hours);
  const added = newSince(before).filter((n) => n.channel === "teams");
  const sla = useSandbox.getState().config.sla;
  const lines: string[] = [];
  for (const n of added) {
    if (n.kind === "reminder") lines.push(`Reminder sent to ${nameOf(n.toId)} · ${n.requestId ?? ""}`.trim());
    else if (n.kind === "escalation") {
      lines.push(
        n.title.startsWith("Escalated to you")
          ? `Escalated to ${nameOf(n.toId)} after ${sla.escalateAfterBusinessDays} business days · ${n.requestId ?? ""}`.trim()
          : `MDM alerted (${nameOf(n.toId)}): ${n.requestId ?? "a step"} has no delegate or manager`,
      );
    }
  }
  const label = `Sandbox clock moved +${businessDays} business day${businessDays === 1 ? "" : "s"}`;
  if (res.reminders + res.escalations === 0) {
    toast(label, { description: "No reminders or escalations due. Every open step is inside its SLA, or already chased." });
    return;
  }
  const shown = lines.slice(0, 5);
  const more = lines.length - shown.length;
  toast.warning(`${label} · ${res.reminders} reminder${res.reminders === 1 ? "" : "s"}, ${res.escalations} escalation${res.escalations === 1 ? "" : "s"}`, {
    description: (
      <ul className="mt-0.5 space-y-0.5">
        {shown.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
        {more > 0 ? <li>+{more} more in the audit trail</li> : null}
      </ul>
    ),
    duration: 9000,
  });
}
