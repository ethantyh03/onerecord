"use client";

import type { MdmRequest } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { actorName } from "@/lib/selectors";
import { formatSgtDateTime, StatusBadge } from "@/components/common";
import { Panel } from "./Panel";

/** (3) Compact approval history: who approved what, when, and with which comment. One row per step, in route order. */
export function ApprovalHistory({ req }: { req: MdmRequest }) {
  const config = useSandbox((s) => s.config);
  const steps = [...req.steps].sort((a, b) => a.stageIndex - b.stageIndex);

  return (
    <Panel
      title="Approval history"
      description={`Submitted ${req.submittedAt ? formatSgtDateTime(req.submittedAt) : "—"} by ${actorName({ config }, req.requestorId)}`}
      bodyClassName="p-0"
    >
      <ol className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="min-w-0 text-sm font-medium text-foreground">{s.label}</span>
            <StatusBadge status={s.status} size="sm" />
            <span className="col-span-2 text-xs leading-5 text-muted-foreground">
              {actorName({ config }, s.assigneeId)}
              {s.originalAssigneeId ? ` (for ${actorName({ config }, s.originalAssigneeId)})` : ""}
              {s.decidedAt ? <span className="num">{` · ${formatSgtDateTime(s.decidedAt)}`}</span> : ""}
              {s.addedBecause ? ` · ${s.addedBecause}` : ""}
            </span>
            {s.comment ? (
              <span className="col-span-2 mt-0.5 border-l border-border-strong pl-3 text-[0.8125rem] leading-snug text-secondary-foreground">
                {s.comment}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
