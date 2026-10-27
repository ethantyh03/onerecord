"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FastForward, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatSgtDateTime } from "@/components/common/format";
import { useSandbox } from "@/lib/store";
import { selectWaitingOn, useNow } from "@/lib/selectors";
import { SYSTEM_ACTOR_ID } from "@/config/people";
import type { Person } from "@/lib/types";
import { runFastForward } from "./use-approval-actions";

function SimulatedTag() {
  return (
    <span className="inline-flex h-5 items-center rounded-full border border-warn/45 bg-warn-soft px-2 text-[0.6875rem] font-medium text-warn-ink">
      Simulated
    </span>
  );
}

/** Demo clock control: +1 / +3 business days runs the SLA check and reports reminders and escalations. */
export function SimTimePanel() {
  const now = useNow(10_000);
  const sla = useSandbox((s) => s.config.sla);
  return (
    <section aria-labelledby="simtime-heading" className="rounded-xl border border-border bg-card p-4 shadow-raised">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="simtime-heading" className="text-[0.9375rem] font-semibold">
          Simulated time
        </h2>
        <SimulatedTag />
      </div>
      <p className="num mt-2 text-lg font-semibold tracking-tight text-foreground">{formatSgtDateTime(now)} SGT</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        A reminder goes out after {sla.reminderAfterBusinessDays} business day without a decision. After{" "}
        {sla.escalateAfterBusinessDays}, the step moves to the approver&apos;s delegate or manager. Weekends don&apos;t count.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" data-testid="ff-1bd" onClick={() => runFastForward(1)}>
          <FastForward aria-hidden="true" />
          +1 business day
        </Button>
        <Button variant="outline" data-testid="ff-3bd" onClick={() => runFastForward(3)}>
          <FastForward aria-hidden="true" />
          +3 business days
        </Button>
      </div>
    </section>
  );
}

/** Out-of-office for the current persona: pending and upcoming approvals move to the chosen delegate. */
export function OutOfOfficePanel({ me }: { me: Person }) {
  const people = useSandbox((s) => s.config.people);
  const setOutOfOffice = useSandbox((s) => s.setOutOfOffice);
  const candidates = people.filter((p) => p.id !== me.id && p.id !== SYSTEM_ACTOR_ID && p.roles.length > 0);
  const fallback = me.delegateId ?? me.managerId ?? candidates[0]?.id ?? "";
  const [picked, setPicked] = useState<{ owner: string; id: string } | null>(null);
  const delegateId = picked && picked.owner === me.id ? picked.id : fallback;
  const delegate = people.find((p) => p.id === delegateId);
  const away = Boolean(me.outOfOffice);
  const items = Object.fromEntries(candidates.map((p) => [p.id, p.name]));

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
    <section aria-labelledby="ooo-heading" className="rounded-xl border border-border bg-card p-4 shadow-raised">
      <div className="flex items-center gap-2">
        <Palmtree className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="ooo-heading" className="text-[0.9375rem] font-semibold">
          Out of office
        </h2>
        <Switch
          data-testid="ooo-toggle"
          className="ml-auto"
          checked={away}
          onCheckedChange={(checked) => toggle(Boolean(checked))}
          aria-label={away ? "Turn off out of office" : "Turn on out of office"}
        />
      </div>
      <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor="ooo-delegate">
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
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {away
          ? `You're out of office. Your open and upcoming approvals go to ${delegate?.name ?? "your delegate"}, so nothing waits on an empty desk.`
          : `Turn this on and your open and upcoming approvals go to ${delegate?.name ?? "your delegate"} until you're back. Each move is in the audit trail.`}
      </p>
    </section>
  );
}
