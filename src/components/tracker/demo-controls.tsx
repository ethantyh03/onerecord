"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FastForward, UsersRound } from "lucide-react";
import { toast } from "sonner";
import type { MdmRequest } from "@/lib/types";
import { MDM_STAGE_ID } from "@/lib/engine/routing";
import { approveAllAsAssignees } from "./demo-actions";
import { useSandbox } from "@/lib/store";
import { hoursForBusinessDays } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function DemoControls({ request }: { request: MdmRequest }) {
  const [open, setOpen] = useState(false);
  const fastForward = useSandbox((s) => s.fastForward);
  const pendingBusiness = request.steps.filter((s) => s.status === "pending" && s.stageId !== MDM_STAGE_ID).length;
  const questions = request.steps.filter((s) => s.status === "question").length;
  const atMdm = request.status === "mdm_review";

  function approveAll() {
    const { approved, blocked } = approveAllAsAssignees(request.id);
    if (approved.length) {
      toast.success(`Approved as ${approved.join(", ")}`, {
        description: blocked.length ? `Skipped: ${blocked.join("; ")}` : "Each approval is recorded under the approver's own name.",
      });
    } else {
      toast.error("Nothing was approved", { description: blocked.join("; ") || "No business step is waiting for a decision." });
    }
  }

  function plusOneDay() {
    const now = useSandbox.getState().nowIso();
    const r = fastForward(hoursForBusinessDays(now, 1));
    toast("Clock moved forward 1 business day (simulated)", {
      description:
        r.reminders + r.escalations
          ? `${r.reminders} reminder${r.reminders === 1 ? "" : "s"} and ${r.escalations} escalation${r.escalations === 1 ? "" : "s"} sent.`
          : "No reminders or escalations were due.",
    });
  }

  return (
    // A ruled disclosure line, not a dashed box: it is a presenter's control, so it stays quiet until opened.
    <section className="border-y border-border" data-testid="demo-controls">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        data-testid="demo-controls-toggle"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <UsersRound aria-hidden className="size-4 text-muted-foreground" />
          Demo control — simulates approvers acting
        </span>
        <ChevronDown aria-hidden className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border px-1 py-4">
          <p className="text-sm text-muted-foreground">
            Plays each approver in turn so the route can be shown end to end. Segregation of duties still applies, and it stops at the MDM
            final check.
          </p>
          <Button className="w-full" onClick={approveAll} disabled={pendingBusiness === 0} data-testid="demo-approve-all">
            Approve all pending steps as their assignees
          </Button>
          {questions ? (
            <p className="text-xs text-warn-ink">
              {questions} step{questions === 1 ? " is" : "s are"} paused on a question; the requestor has to answer first.
            </p>
          ) : null}
          {atMdm ? (
            <p className="text-xs text-secondary-foreground">
              Business approvals are done.{" "}
              <Link href={`/mdm?id=${encodeURIComponent(request.id)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                Open it in the MDM console
              </Link>{" "}
              for the final check and SAP B1 import.
            </p>
          ) : null}
          <Button variant="outline" className="w-full" onClick={plusOneDay} data-testid="demo-fast-forward">
            <FastForward aria-hidden />
            +1 business day
          </Button>
        </div>
      ) : null}
    </section>
  );
}
