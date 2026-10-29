"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSgtDateTime } from "@/components/common/format";
import { IllustrativeMarker, PanelSection, SectionTitle } from "@/components/common";
import { useSandbox } from "@/lib/store";
import { selectWaitingOn, useNow } from "@/lib/selectors";
import { SYSTEM_ACTOR_ID } from "@/config/people";
import type { Person } from "@/lib/types";
import { runFastForward } from "./use-approval-actions";

/**
 * Demo clock control: +1 / +3 business days runs the SLA check and reports reminders and escalations.
 * A section of the approvals queue panel (hairline above, ruled sub-title), not a panel of its own.
 */
export function SimTimePanel() {
  const now = useNow(10_000);
  const sla = useSandbox((s) => s.config.sla);
  return (
    <PanelSection role="group" aria-labelledby="simtime-heading">
      <SectionTitle id="simtime-heading" as="h3" size="sm" title="Simulated time" actions={<IllustrativeMarker label="Simulated" />} />
      <div className="mt-2">
        <p className="mono-id text-[1.0625rem] leading-6 text-foreground" data-testid="approvals-sim-time">
          {formatSgtDateTime(now)} SGT
        </p>
        <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
          A reminder goes out after {sla.reminderAfterBusinessDays} business day without a decision. After {sla.escalateAfterBusinessDays},
          the step moves to the approver&apos;s delegate or manager. Weekends don&apos;t count.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 [&>*]:flex-1">
          <Button variant="outline" data-testid="ff-1bd" onClick={() => runFastForward(1)}>
            <FastForward aria-hidden="true" />
            +1 business day
          </Button>
          <Button variant="outline" data-testid="ff-3bd" onClick={() => runFastForward(3)}>
            <FastForward aria-hidden="true" />
            +3 business days
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}

/** Out-of-office for the current persona: pending and upcoming approvals move to the chosen delegate. A queue panel section. */
export function OutOfOfficePanel({ me }: { me: Person }) {
  const people = useSandbox((s) => s.config.people);
  const setOutOfOffice = useSandbox((s) => s.setOutOfOffice);
  const candidates = people.filter((p) => p.id !== me.id && p.id !== SYSTEM_ACTOR_ID && p.roles.length > 0);
  const fallback = me.delegateId ?? me.managerId ?? candidates[0]?.id ?? "";
  const [picked, setPicked] = useState<{ owner: string; id: string } | null>(null);
  const delegateId = picked && picked.owner === me.id ? picked.id : fallback;
  const delegate = people.find((p) => p.id === delegateId);
  const away = Boolean(me.outOfOffice);
  // Labels for the trigger: every person, so a configured delegate outside the candidate list shows a name, not an id.
  const items = Object.fromEntries(people.map((p) => [p.id, p.name]));

  function toggle(next: boolean) {
    const before = selectWaitingOn(useSandbox.getState(), me.id).length;
    if (next) {
      if (!delegate) {
        toast.error("Pick a delegate first");
        return;
      }
      setOutOfOffice(me.id, delegate.id);
      const after = selectWaitingOn(useSandbox.getState(), me.id).length;
      const moved = Math.max(0, before - after);
      toast(`Out of office on · approvals go to ${delegate.name}`, {
        description:
          moved > 0
            ? `${moved} open approval${moved === 1 ? "" : "s"} moved now; ${delegate.name} got the Teams card${moved === 1 ? "" : "s"} (simulated).`
            : `Nothing is waiting on you right now. New approvals will go to ${delegate.name}.`,
      });
    } else {
      setOutOfOffice(me.id, null);
      toast(`Welcome back, ${me.name.split(" ")[0]}`, {
        description: "New approvals come to you again. Steps already with your delegate stay with them.",
      });
    }
  }

  return (
    <PanelSection role="group" aria-labelledby="ooo-heading">
      <SectionTitle
        id="ooo-heading"
        as="h3"
        size="sm"
        title="Out of office"
        actions={
          <Switch
            data-testid="ooo-toggle"
            checked={away}
            onCheckedChange={(checked) => toggle(Boolean(checked))}
            aria-label={away ? "Turn off out of office" : "Turn on out of office"}
          />
        }
      />
      <div className="mt-2">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="ooo-delegate">
          Delegate
        </label>
        <Select items={items} value={delegateId} onValueChange={(v) => v && setPicked({ owner: me.id, id: String(v) })} disabled={away}>
          <SelectTrigger id="ooo-delegate" data-testid="ooo-delegate" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                <span className="text-muted-foreground"> · {p.title}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {away
            ? `You're out of office. Your open and upcoming approvals go to ${delegate?.name ?? "your delegate"}, so nothing waits on an empty desk.`
            : `Turn this on and your open and upcoming approvals go to ${delegate?.name ?? "your delegate"} until you're back. Each move is in the audit trail.`}
        </p>
      </div>
    </PanelSection>
  );
}
