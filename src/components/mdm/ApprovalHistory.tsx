"use client";

import type { MdmRequest } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { actorName } from "@/lib/selectors";
import { formatSgtDateTime, StatusBadge } from "@/components/common";
import { Panel } from "./Panel";

/** (3) Compact approval history: who approved what, when, and with which comment. */
export function ApprovalHistory({ req }: { req: MdmRequest }) {
  const config = useSandbox((s) => s.config);
  const steps = [...req.steps].sort((a, b) => a.stageIndex - b.stageIndex);

  return (
    <Panel title="Approval history" description={`Submitted ${req.submittedAt ? formatSgtDateTime(req.submittedAt) : "—"} by ${actorName({ config }, req.requestorId)}`}>
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <span className="min-w-0 text-[0.8125rem] font-medium text-foreground">{s.label}</span>
            <StatusBadge status={s.status} size="sm" />
            <span className="col-span-2 text-xs text-muted-foreground">
              {actorName({ config }, s.assigneeId)}
              {s.originalAssigneeId ? ` (for ${actorName({ config }, s.originalAssigneeId)})` : ""}
              {s.decidedAt ? ` · ${formatSgtDateTime(s.decidedAt)}` : ""}
              {s.addedBecause ? ` · ${s.addedBecause}` : ""}
            </span>
            {s.comment ? (
              <span className="col-span-2 border-l-2 border-border-strong pl-2 text-xs leading-snug text-secondary-foreground">
                {s.comment}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
