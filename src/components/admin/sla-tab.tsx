"use client";

import { useState } from "react";
import { BellRing, Clock, Save, Siren } from "lucide-react";
import type { SlaConfig } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaveConfig } from "./shared";

const ROWS: { key: keyof SlaConfig; label: string; help: string; icon: typeof Clock }[] = [
  { key: "stepBusinessDays", label: "Time to decide", help: "Business days each approver has before the step counts as late.", icon: Clock },
  { key: "reminderAfterBusinessDays", label: "Reminder after", help: "A Teams nudge goes to the approver after this many business days.", icon: BellRing },
  { key: "escalateAfterBusinessDays", label: "Escalate after", help: "The step moves to the approver's manager or delegate after this many business days.", icon: Siren },
];

export function SlaTab() {
  const config = useSandbox((s) => s.config);
  const save = useSaveConfig();
  const [draft, setDraft] = useState<{ version: number; sla: Record<keyof SlaConfig, string> } | null>(null);
  const base = Object.fromEntries(ROWS.map((r) => [r.key, String(config.sla[r.key])])) as Record<keyof SlaConfig, string>;
  const values = draft && draft.version === config.version ? draft.sla : base;
  const parsed = Object.fromEntries(ROWS.map((r) => [r.key, Number(values[r.key])])) as unknown as SlaConfig;

  const errors: string[] = [];
  for (const r of ROWS) if (!Number.isFinite(parsed[r.key]) || parsed[r.key] < 0.5 || parsed[r.key] > 20) errors.push(`${r.label} must be between 0.5 and 20 business days`);
  if (!errors.length && parsed.reminderAfterBusinessDays >= parsed.escalateAfterBusinessDays) errors.push("The reminder has to come before the escalation");
  const dirty = ROWS.some((r) => parsed[r.key] !== config.sla[r.key]);

  function onSave() {
    if (!dirty || errors.length) return;
    const changes = ROWS.filter((r) => parsed[r.key] !== config.sla[r.key]).map(
      (r) => `${r.label.toLowerCase()} ${config.sla[r.key]} → ${parsed[r.key]} business day${parsed[r.key] === 1 ? "" : "s"}`,
    );
    save({ ...config, sla: parsed }, `SLA: ${changes.join("; ")}`);
    setDraft(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Service levels</h2>
        <p className="text-[0.8125rem] text-muted-foreground">
          Counted in business days (Mon–Fri). Time spent waiting for the requestor to answer a question doesn&rsquo;t count.
        </p>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-raised">
        {ROWS.map(({ key, label, help, icon: Icon }) => (
          <div key={key} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`sla-${key}`} className="text-sm font-medium text-foreground">
                {label}
              </label>
              <p className="text-xs text-muted-foreground">{help}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id={`sla-${key}`}
                type="number"
                min={0.5}
                step={0.5}
                className="w-20 text-right tabular-nums"
                value={values[key]}
                onChange={(e) => setDraft({ version: config.version, sla: { ...values, [key]: e.target.value } })}
                data-testid={`admin-sla-${key}`}
              />
              <span className="w-24 text-[0.8125rem] text-muted-foreground">business days</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={errors.length ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {errors[0] ?? "In production the clock runs in each approver's own time zone and public-holiday calendar."}
        </p>
        <Button size="sm" disabled={!dirty || errors.length > 0} onClick={onSave} data-testid="admin-sla-save">
          <Save /> Save service levels
        </Button>
      </div>
    </div>
  );
}
