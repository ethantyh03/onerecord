"use client";

import { Fragment, useEffect } from "react";
import { motion, AnimatePresence, useAnimate, useInView, useReducedMotion } from "motion/react";
import { CornerDownRight, LoaderCircle } from "lucide-react";
import type { CustomerMaster, DuplicateChoice, DuplicateDecision, DuplicateMatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Notice, SapCode, StateGlyph, Tag, type StateTone } from "@/components/common";
import { cn } from "@/lib/utils";
import { DUP_DECISION_THRESHOLD, OVERRIDE_MIN_CHARS } from "./intake-logic";

export interface DuplicatePanelProps {
  /** Something to check has been typed */
  hasInput: boolean;
  checking: boolean;
  matches: DuplicateMatch[];
  decision: DuplicateDecision | undefined;
  onDecide: (d: DuplicateDecision | undefined) => void;
  onExtend: (m: DuplicateMatch) => void;
  /** "customer" or "vendor": wording only */
  noun: string;
  /** Requestor's entity, for "Extend to my entity" copy */
  myEntity: string;
  /** Extend is offered for customers only */
  canExtend: boolean;
}

const CHOICE_LABEL: Record<DuplicateChoice, string> = {
  use_existing: "Use existing",
  extend: "Extend to my entity",
  override: "Override",
};

function decisionFor(m: DuplicateMatch, choice: DuplicateChoice, justification?: string): DuplicateDecision {
  const d: DuplicateDecision = {
    matchCode: m.record.cardCode,
    matchName: m.record.cardName,
    score: m.score,
    reasons: [...m.reasons],
    choice,
  };
  if (justification !== undefined) d.justification = justification;
  return d;
}

// ---------------------------------------------------------------------------------------------
// Lock-on: the one piece of motion on this page that answers the user's typing.

const CORNERS = [
  { pos: "tl", cls: "top-0 left-0 border-t-2 border-l-2 rounded-tl-[3px]", dx: -14, dy: -10 },
  { pos: "tr", cls: "top-0 right-0 border-t-2 border-r-2 rounded-tr-[3px]", dx: 14, dy: -10 },
  { pos: "bl", cls: "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[3px]", dx: -14, dy: 10 },
  { pos: "br", cls: "right-0 bottom-0 border-r-2 border-b-2 rounded-br-[3px]", dx: 14, dy: 10 },
] as const;

/**
 * Corner brackets that close in on the existing record once (~250 ms) when the duplicate check finds it, so the
 * eye lands on the record that already exists. Signal teal: a live-data highlight. Re-mount (key) to replay when a
 * different record is picked. Reduced motion: the brackets are simply there.
 *
 * The snap runs when the record is fully on screen, not on mount: a restored draft opens with the match already
 * found (and below the fold until the page scrolls to it), and a parent AnimatePresence with initial={false}
 * would otherwise skip the entrance. Driven imperatively so neither can swallow it.
 */
function LockOn({ className = "-inset-[5px]" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const inView = useInView(scope, { once: true, amount: "all" });

  useEffect(() => {
    if (reduce || !inView) return;
    for (const c of CORNERS) {
      animate(
        `[data-corner="${c.pos}"]`,
        { x: [c.dx, 0], y: [c.dy, 0], opacity: [0, 1] },
        { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
      );
    }
  }, [inView, reduce, animate]);

  return (
    <span ref={scope} aria-hidden data-testid="dup-lock" className={cn("pointer-events-none absolute z-10", className)}>
      {CORNERS.map((c) => (
        <span
          key={c.pos}
          data-corner={c.pos}
          className={cn("absolute size-3.5 border-signal", c.cls)}
          style={reduce ? undefined : { opacity: 0, transform: `translate(${c.dx}px, ${c.dy}px)` }}
        />
      ))}
    </span>
  );
}

/** The matcher's own reasons as one plain line ("98% name match · Same postcode"); sans, since mono is for identifiers. */
function MatchReadout({ reasons, hot }: { reasons: string[]; hot: boolean }) {
  return (
    <span className="min-w-0 text-[0.8125rem] leading-5 text-secondary-foreground">
      {reasons.map((r, i) => (
        <Fragment key={r}>
          {i ? <span className="text-subtle"> · </span> : null}
          <span className={cn(r === "Same tax ID" && hot && "font-medium text-warn-ink", r === "Same tax ID" && !hot && "text-foreground")}>
            {r}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** Live duplicate check for a new customer or vendor (final model P0-06). */
export function DuplicatePanel({ hasInput, checking, matches, decision, onDecide, onExtend, noun, myEntity, canExtend }: DuplicatePanelProps) {
  const reduce = useReducedMotion();
  const top = matches[0];
  const strong = !!top && top.score >= DUP_DECISION_THRESHOLD;
  const selected = (decision && matches.find((m) => m.record.cardCode === decision.matchCode)) || top;
  // State in the square, not in a tinted header: not checked yet (hollow), likely duplicate (amber),
  // similar names only (grey), nothing like it (green).
  const tone: StateTone = !hasInput ? "waiting" : strong ? "warn" : top ? "neutral" : "ok";

  return (
    <section
      data-testid="dup-panel"
      data-state={!hasInput ? "idle" : strong ? "duplicate" : top ? "similar" : "clear"}
      aria-live="polite"
      className="panel overflow-hidden"
    >
      <div className="panel-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <StateGlyph tone={tone} />
          <h2 className="panel-title">
            {!hasInput
              ? "Duplicate check"
              : strong
                ? `This ${noun} may already exist in SAP B1`
                : top
                  ? "Similar records found"
                  : `No existing ${noun} looks like this`}
          </h2>
        </div>
        {checking ? <LoaderCircle aria-label="Checking" className="size-4 shrink-0 animate-spin text-subtle" /> : null}
      </div>

      <p className="px-4 pt-3 pb-3 text-sm leading-5 text-muted-foreground">
        {!hasInput
          ? `As you type the name, tax ID and postcode, Tesseract checks every ${noun} record already in SAP B1.`
          : strong
            ? "Decide before submitting, so no approver spends time on a second copy of the same organisation."
            : top
              ? "Below the duplicate threshold, so no decision is needed. Check them anyway."
              : `Checked against existing ${noun} records in SAP B1, including the same tax ID in any country.`}
      </p>

      <AnimatePresence initial={false}>
        {matches.length ? (
          <motion.ul
            key="matches"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Matches are rows, not cards: hairline-divided, edge to edge. The lock-on brackets frame the record
                that already exists; the matcher's reasons sit on a mono line under its name. */}
            {matches.map((m, i) => {
              const pct = Math.round(m.score * 100);
              const hot = m.score >= DUP_DECISION_THRESHOLD;
              const isSel = strong && selected?.record.cardCode === m.record.cardCode;
              const pickable = strong && matches.length > 1;
              return (
                <li key={m.record.cardCode} className="relative border-t border-border">
                  {isSel ? <LockOn className="inset-x-2 inset-y-1.5" /> : null}
                  <button
                    type="button"
                    data-testid={`dup-match-${i}`}
                    data-locked={isSel ? "true" : undefined}
                    disabled={!pickable}
                    onClick={() => decision && onDecide(decisionFor(m, decision.choice, decision.justification))}
                    className={cn(
                      "flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-default",
                      pickable && !isSel && "hover:bg-secondary/50",
                    )}
                  >
                    <span className="flex w-16 shrink-0 flex-col pt-0.5">
                      <span
                        className={cn(
                          "num font-wide text-[1.5rem] leading-none font-semibold",
                          hot ? "text-warn-ink" : "text-muted-foreground",
                        )}
                      >
                        {pct}%
                      </span>
                      <span className="mt-1.5 text-xs leading-none text-subtle">match</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="text-[0.9375rem] font-semibold text-foreground">{m.record.cardName}</span>
                        <SapCode code={m.record.cardCode} />
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Entity {m.record.entity} · {m.record.country}
                        {m.record.street ? ` · ${m.record.street}` : ""}
                      </span>
                      {m.reasons.length ? (
                        <motion.span
                          initial={isSel && !reduce ? { opacity: 0 } : false}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.18, duration: 0.15 }}
                          className="mt-2 flex items-start gap-1.5 text-[0.8125rem]"
                        >
                          <CornerDownRight aria-hidden className="mt-[3px] size-3.5 shrink-0 text-subtle" />
                          <MatchReadout reasons={m.reasons} hot={hot} />
                        </motion.span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {strong && selected ? (
        <div className="border-t border-border px-4 py-3.5">
          <p className="mb-2 text-[0.8125rem] font-medium text-foreground">What would you like to do?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duplicate decision">
            <ChoiceButton
              testId="dup-choice-use"
              active={decision?.choice === "use_existing"}
              onClick={() => onDecide(decisionFor(selected, "use_existing"))}
            >
              {CHOICE_LABEL.use_existing}
            </ChoiceButton>
            {canExtend ? (
              <ChoiceButton testId="dup-choice-extend" active={false} primary onClick={() => onExtend(selected)}>
                {CHOICE_LABEL.extend}
              </ChoiceButton>
            ) : null}
            <ChoiceButton
              testId="dup-choice-override"
              active={decision?.choice === "override"}
              onClick={() => onDecide(decisionFor(selected, "override", decision?.choice === "override" ? decision.justification ?? "" : ""))}
            >
              {CHOICE_LABEL.override}
            </ChoiceButton>
          </div>

          {decision?.choice === "use_existing" ? (
            <Notice tone="ok" size="sm" lead="No new record is needed." className="mt-3.5" data-testid="dup-use-existing-note">
              <strong className="font-semibold text-foreground">{selected.record.cardName}</strong> is already in SAP B1 as{" "}
              <SapCode code={selected.record.cardCode} />: quote that code on your sales order.
              {canExtend ? ` If ${myEntity || "your entity"} doesn't sell to them yet, extend the existing record to your entity instead.` : ""}
              {canExtend ? (
                <span className="mt-2.5 block">
                  <Button type="button" size="sm" variant="outline" onClick={() => onExtend(selected)}>
                    Extend to {myEntity || "my entity"}
                  </Button>
                </span>
              ) : null}
            </Notice>
          ) : null}

          {decision?.choice === "override" ? (
            <div className="mt-3">
              <label htmlFor="dup-justification" className="text-[0.8125rem] font-medium text-foreground">
                Why is this a different {noun}?
              </label>
              <Textarea
                id="dup-justification"
                data-testid="dup-justification"
                value={decision.justification ?? ""}
                onChange={(e) => onDecide({ ...decision, justification: e.target.value })}
                placeholder="e.g. Separate legal entity with its own tax ID; the match is a sister hospital in the same group"
                rows={2}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.max(0, OVERRIDE_MIN_CHARS - (decision.justification ?? "").trim().length) > 0 ? (
                  <span className="text-warn-ink">{`At least ${OVERRIDE_MIN_CHARS - (decision.justification ?? "").trim().length} more characters. `}</span>
                ) : (
                  ""
                )}
                Overrides are logged in the audit trail and flagged to MDM for the final check.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** One of the three decisions: a labelled control, no icon of its own (the words carry it). */
function ChoiceButton({
  children,
  active,
  primary,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  active: boolean;
  primary?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Button
      type="button"
      role="radio"
      aria-checked={active}
      data-testid={testId}
      variant={primary ? "default" : "outline"}
      onClick={onClick}
      className={cn("h-9 px-3.5", active && "border-primary bg-primary-soft text-foreground hover:border-primary hover:bg-primary-soft")}
    >
      {children}
    </Button>
  );
}

export interface RecordLookupProps {
  code: string;
  name: string;
  record: CustomerMaster | undefined;
  entities: string[];
  targetEntity: string;
  suggestions: DuplicateMatch[];
  onPick: (m: DuplicateMatch) => void;
}

/** Extend: confirm the existing record and show the entities it already has (A28). */
export function RecordLookup({ code, name, record, entities, targetEntity, suggestions, onPick }: RecordLookupProps) {
  const already = !!record && !!targetEntity && entities.includes(targetEntity);
  return (
    <section data-testid="dup-panel" aria-live="polite" className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <StateGlyph tone={record ? "ok" : "waiting"} />
          <h2 className="panel-title">Existing record in SAP B1</h2>
        </div>
      </div>
      {record ? (
        // Same lock-on as the duplicate check: this is the one record being extended, not a new one. A row, not a box.
        <div key={record.cardCode} className="relative border-b border-border px-4 py-3.5">
          <LockOn className="inset-x-2 inset-y-1.5" />
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-sm">
            <span className="text-[0.9375rem] font-semibold text-foreground">{record.cardName}</span>
            <SapCode code={record.cardCode} />
            <span className="text-muted-foreground">{record.country}</span>
            <span className="flex flex-wrap items-center gap-1.5 border-l border-border-strong pl-3 text-[0.8125rem] text-muted-foreground">
              Sold by:
              {entities.length ? entities.map((e) => <Tag key={e} className="font-medium text-foreground">{e}</Tag>) : <span>—</span>}
              {targetEntity && !already ? <span className="text-xs font-medium text-foreground">+ {targetEntity}</span> : null}
            </span>
          </div>
        </div>
      ) : null}
      <div className="px-4 py-3.5">
        {record && already ? (
          <Notice tone="warn" size="sm">{`${targetEntity} already sells to this customer, so nothing needs extending.`}</Notice>
        ) : (
          <p className="text-sm leading-5 text-muted-foreground">
            {record
              ? "One business-partner record is shared by every entity, so this updates the existing record: it adds your entity, plus any new terms Finance approves. The customer code stays the same."
              : code.trim()
                ? `No customer with code ${code.trim()} was found in SAP B1. Check the code, or search by name.`
                : name.trim()
                  ? "Pick the record you mean:"
                  : "Enter the customer code or name and Tesseract finds the record."}
          </p>
        )}
        {!record && suggestions.length ? (
          <ul className="mt-2.5 divide-y divide-border border-y border-border">
            {suggestions.map((m) => (
              <li key={m.record.cardCode} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
                <span className="num w-11 font-semibold text-muted-foreground">{Math.round(m.score * 100)}%</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{m.record.cardName}</span>
                <SapCode code={m.record.cardCode} />
                <Button type="button" size="sm" variant="outline" onClick={() => onPick(m)}>
                  Use this record
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
