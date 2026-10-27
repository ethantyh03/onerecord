"use client";

import { CalendarCheck, CircleAlert, CircleCheck, Mail, Send } from "lucide-react";
import type { ApprovalStep, FieldDef, Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoutePreview } from "./route-preview";
import { EMAIL_BASELINE_DAYS, formatLiveDate } from "./intake-logic";

export interface CheckRow {
  label: string;
  state: "ok" | "todo" | "na";
  detail?: string;
}

export interface IntakeRailProps {
  hasDomain: boolean;
  required: FieldDef[];
  missing: FieldDef[];
  checks: CheckRow[];
  blockers: string[];
  steps: ApprovalStep[];
  people: Person[];
  slaDays: number;
  liveIso: string | undefined;
  unconfiguredEntity?: string;
  onFocusField: (key: string) => void;
  onSubmit: () => void;
  submitError?: string;
}

export function IntakeRail({
  hasDomain,
  required,
  missing,
  checks,
  blockers,
  steps,
  people,
  slaDays,
  liveIso,
  unconfiguredEntity,
  onFocusField,
  onSubmit,
  submitError,
}: IntakeRailProps) {
  const done = required.length - missing.length;
  const pct = required.length ? Math.round((done / required.length) * 100) : 0;
  const ready = hasDomain && blockers.length === 0;

  return (
    <aside
      aria-label="Submission summary"
      className="scrollbar-thin space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pb-2"
    >
      {/* Completeness */}
      <section className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-raised" data-testid="completeness">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Completeness</h2>
          <span className="num text-[0.8125rem] text-muted-foreground">
            {hasDomain ? `${done} of ${required.length} required` : "—"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", pct === 100 ? "bg-ok" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-2 text-[0.8125rem]">
              {c.state === "ok" ? (
                <CircleCheck aria-hidden className="mt-px size-4 shrink-0 text-ok" />
              ) : c.state === "todo" ? (
                <CircleAlert aria-hidden className="mt-px size-4 shrink-0 text-warn" />
              ) : (
                <span aria-hidden className="mt-[7px] ml-[5px] mr-[5px] size-1.5 shrink-0 rounded-full bg-border-strong" />
              )}
              <span className="min-w-0">
                <span className={cn(c.state === "na" && "text-muted-foreground")}>{c.label}</span>
                {c.detail ? <span className="block text-[0.75rem] text-muted-foreground">{c.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {missing.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {missing.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => onFocusField(f.key)}
                className="h-6 rounded-full border border-warn/50 bg-warn-soft px-2 text-[0.6875rem] font-medium text-warn-ink hover:bg-warn/20"
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {/* Route */}
      <section className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-raised">
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Who approves</h2>
          <span className="text-[0.75rem] text-muted-foreground">Updates as you fill the form</span>
        </div>
        {hasDomain && steps.length ? (
          <RoutePreview steps={steps} people={people} slaDays={slaDays} unconfiguredEntity={unconfiguredEntity} />
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">Pick a request type to see the approvers.</p>
        )}

        <div className="mt-3 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground" data-testid="expected-date">
            <CalendarCheck aria-hidden className="size-4.5 text-ok" />
            {liveIso ? <>Expected live in SAP B1: {formatLiveDate(liveIso)}</> : "Expected live date appears here"}
          </p>
          <p className="mt-1 flex items-center gap-2 pl-[1.625rem] text-[0.75rem] text-muted-foreground">
            <Mail aria-hidden className="size-3.5" />
            Today by email: ~{EMAIL_BASELINE_DAYS} days
          </p>
          <p className="mt-0.5 pl-[1.625rem] text-[0.6875rem] text-muted-foreground/90">
            Mon–Fri business days on the simulated clock, {slaDays} per approval stage.
          </p>
        </div>
      </section>

      {/* Submit: pinned to the bottom of the scrolling rail so it never drops below the fold */}
      <section className="z-10 rounded-xl border border-border bg-card px-4 py-3.5 shadow-raised lg:sticky lg:bottom-0">

        <Button
          type="button"
          data-testid="submit-request"
          disabled={!ready}
          onClick={onSubmit}
          className="h-11 w-full text-[0.9375rem]"
        >
          <Send aria-hidden />
          Submit for approval
        </Button>
        {!ready && blockers.length ? (
          <ul className="mt-2.5 space-y-1" data-testid="submit-blockers">
            {blockers.map((b) => (
              <li key={b} className="flex gap-1.5 text-[0.75rem] leading-snug text-muted-foreground">
                <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-warn" />
                {b}
              </li>
            ))}
          </ul>
        ) : ready ? (
          <p className="mt-2 text-center text-[0.75rem] text-muted-foreground">
            Approvers get a Teams card and an Outlook email (simulated).
          </p>
        ) : null}
        {submitError ? <p className="mt-2 text-[0.75rem] text-destructive">{submitError}</p> : null}
      </section>
    </aside>
  );
}
