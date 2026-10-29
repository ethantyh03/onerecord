"use client";

import { Send } from "lucide-react";
import type { ApprovalStep, FieldDef, Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { SectionTitle, StateGlyph, type StateTone } from "@/components/common";
import { cn } from "@/lib/utils";
import { RoutePreview } from "./route-preview";
import { EMAIL_BASELINE_DAYS, formatLiveDate } from "./intake-logic";

/** The submit block is sticky, so keep it short: the full list is in Completeness above. */
const MAX_BLOCKERS = 3;

export interface CheckRow {
  label: string;
  state: "ok" | "todo" | "na";
  detail?: string;
  /** List the still-empty required fields under this row, each one a jump to its field */
  listMissing?: boolean;
}

const CHECK_TONE: Record<CheckRow["state"], StateTone> = { ok: "ok", todo: "warn", na: "waiting" };

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

/**
 * The submission summary: one panel, three hairline-divided sections (completeness, who approves, expected date +
 * submit). On wide screens it is the sticky, scrolling right rail and the submit section stays pinned to its foot.
 */
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
  const complete = hasDomain && pct === 100;

  return (
    <aside
      aria-label="Submission summary"
      className="panel scrollbar-thin flex flex-col xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"
    >
      {/* Completeness */}
      <section className="px-4 pt-3 pb-4" data-testid="completeness" aria-labelledby="rail-completeness">
        <SectionTitle
          id="rail-completeness"
          title="Completeness"
          size="sm"
          actions={
            <span className="num text-[0.8125rem] text-muted-foreground">
              {hasDomain ? `${done} of ${required.length} required` : "—"}
            </span>
          }
        />
        <RequiredMeter total={hasDomain ? required.length : 0} done={done} complete={complete} />
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="text-[0.8125rem] leading-5">
              <div className="flex items-start gap-2.5">
                <StateGlyph tone={CHECK_TONE[c.state]} className="mt-1.5" />
                <span className="min-w-0">
                  <span className={cn(c.state === "na" ? "text-muted-foreground" : "text-foreground")}>{c.label}</span>
                  {c.detail ? <span className="text-xs text-muted-foreground"> · {c.detail}</span> : null}
                </span>
              </div>
              {c.listMissing && missing.length ? (
                // The still-empty fields as plain links under the row (amber = needs attention), not a chip per field.
                <ul
                  aria-label="Required fields still empty"
                  className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-[18px] text-[0.8125rem] leading-5"
                >
                  {missing.map((f) => (
                    <li key={f.key} className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onFocusField(f.key)}
                        className="rounded-[2px] text-warn-ink underline decoration-warn-ink/35 underline-offset-[3px] transition-colors outline-none hover:decoration-warn-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {f.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Route */}
      <section className="border-t border-border px-4 pt-3 pb-4" aria-labelledby="rail-route">
        <SectionTitle
          id="rail-route"
          title="Who approves"
          size="sm"
          actions={<span className="text-xs text-subtle">Updates as you fill the form</span>}
        />
        <div className="mt-2.5">
          {hasDomain && steps.length ? (
            <RoutePreview steps={steps} people={people} slaDays={slaDays} unconfiguredEntity={unconfiguredEntity} />
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground">Pick a request type to see the approvers.</p>
          )}
        </div>
      </section>

      {/* Expected date + Submit: pinned to the foot of the scrolling rail so neither drops below the fold. Its own
          top hairline is the edge when the route scrolls under it (no shadow). */}
      <div className="z-10 border-t border-border bg-card px-4 pt-3.5 pb-4 xl:sticky xl:bottom-0">
        <p
          className={cn("text-[0.9375rem] leading-6", liveIso ? "font-semibold text-foreground" : "text-muted-foreground")}
          data-testid="expected-date"
        >
          {liveIso ? (
            <span>
              Expected live in SAP B1: <span className="font-wide num">{formatLiveDate(liveIso)}</span>
            </span>
          ) : (
            "Expected live date appears here"
          )}
        </p>
        <p
          className="mt-0.5 text-xs text-muted-foreground"
          title={`Mon–Fri business days on the simulated clock, ${slaDays} per approval stage. Today's median by email is 14 calendar days (A26); Amy's item in the case brief took ${EMAIL_BASELINE_DAYS}.`}
        >
          Today by email: median 14 days (Amy&apos;s took {EMAIL_BASELINE_DAYS})
        </p>

        <Button
          type="button"
          data-testid="submit-request"
          disabled={!ready}
          onClick={onSubmit}
          className="mt-3 h-10 w-full text-[0.9375rem]"
        >
          <Send aria-hidden />
          Submit for approval
        </Button>
        {!ready && blockers.length ? (
          <ul className="mt-2.5 space-y-1" data-testid="submit-blockers">
            {blockers.slice(0, MAX_BLOCKERS).map((b) => (
              <li key={b} className="flex gap-2 text-xs leading-4 text-muted-foreground">
                <StateGlyph tone="warn" size="sm" className="mt-[5px]" />
                {b}
              </li>
            ))}
            {blockers.length > MAX_BLOCKERS ? (
              <li className="pl-3.5 text-xs text-muted-foreground">+{blockers.length - MAX_BLOCKERS} more</li>
            ) : null}
          </ul>
        ) : ready ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">Approvers get a Teams card and an Outlook email (simulated).</p>
        ) : null}
        {submitError ? <p className="mt-2 text-xs text-destructive">{submitError}</p> : null}
      </div>
    </aside>
  );
}

/** Above this many required fields the meter is one continuous bar instead of one segment per field. */
const MAX_SEGMENTS = 28;

/**
 * One segment per required field, filled ones first: the count in the title row made visible (a real part of a
 * known whole). Light grey while the form is in progress, green once every required field has a value.
 */
function RequiredMeter({ total, done, complete }: { total: number; done: number; complete: boolean }) {
  const fill = complete ? "bg-ok" : "bg-primary";
  if (!total || total > MAX_SEGMENTS) {
    const pct = total ? (done / total) * 100 : 0;
    return (
      <div className="mt-2 h-1 overflow-hidden rounded-[1px] bg-border" aria-hidden>
        <div className={cn("h-full transition-[width] duration-500", fill)} style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return (
    <div className="mt-2 flex h-1 gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-full min-w-0 flex-1 rounded-[1px] transition-colors duration-300", i < done ? fill : "bg-border-strong")}
        />
      ))}
    </div>
  );
}
