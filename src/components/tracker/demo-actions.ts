import { MDM_STAGE_ID } from "@/lib/engine/routing";
import { useSandbox } from "@/lib/store";
import { canActOnStep, personById } from "@/lib/selectors";

/**
 * Approve every pending business step as its assignee, stage after stage, by switching persona for each decision
 * and switching back. Segregation of duties is checked for each assignee first. Stops at the MDM final check.
 */
export function approveAllAsAssignees(requestId: string): { approved: string[]; blocked: string[] } {
  const store = useSandbox.getState;
  const original = store().personaId;
  const approved: string[] = [];
  const blocked: string[] = [];
  const tried = new Set<string>();
  try {
    for (let round = 0; round < 12; round++) {
      const s = store();
      const req = s.requests.find((r) => r.id === requestId);
      if (!req) break;
      const pending = req.steps.filter((st) => st.status === "pending" && st.stageId !== MDM_STAGE_ID && !tried.has(st.id));
      if (pending.length === 0) break;
      for (const step of pending) {
        tried.add(step.id);
        const name = personById(store(), step.assigneeId)?.name ?? step.assigneeId;
        const check = canActOnStep(store(), requestId, step.id, step.assigneeId);
        if (!check.ok) {
          blocked.push(`${name}: ${check.reason ?? "not allowed"}`);
          continue;
        }
        store().setPersona(step.assigneeId);
        const res = store().approveStep(requestId, step.id, "Approved via sandbox tools");
        if (res.ok) approved.push(name);
        else blocked.push(`${name}: ${res.reason ?? "not allowed"}`);
      }
    }
  } finally {
    store().setPersona(original);
  }
  return { approved, blocked };
}
