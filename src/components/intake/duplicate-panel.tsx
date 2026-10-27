"use client";

import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { CircleCheck, CopyCheck, GitBranchPlus, LoaderCircle, ScanSearch, SquarePen, TriangleAlert } from "lucide-react";
import type { CustomerMaster, DuplicateChoice, DuplicateDecision, DuplicateMatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SapCode } from "@/components/common";
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

/** Live duplicate check for a new customer or vendor (final model P0-06). */
export function DuplicatePanel({ hasInput, checking, matches, decision, onDecide, onExtend, noun, myEntity, canExtend }: DuplicatePanelProps) {
  const reduce = useReducedMotion();
  const top = matches[0];
  const strong = !!top && top.score >= DUP_DECISION_THRESHOLD;
  const selected = (decision && matches.find((m) => m.record.cardCode === decision.matchCode)) || top;

  return (
    <section
      data-testid="dup-panel"
      aria-live="polite"
      className={cn(
        "rounded-xl border shadow-raised transition-colors",
        strong ? "border-warn/60 bg-warn-soft/60" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            strong ? "bg-warn text-warn-foreground" : top ? "bg-muted text-muted-foreground" : "bg-ok-soft text-ok-ink",
          )}
        >
          {strong ? <TriangleAlert aria-hidden className="size-4" /> : <ScanSearch aria-hidden className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {!hasInput
              ? "Duplicate check"
              : strong
                ? `This ${noun} may already exist in SAP B1`
                : top
                  ? "Similar records found"
                  : `No existing ${noun} looks like this`}
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {!hasInput
              ? `As you type the name, tax ID and postcode, OneRecord checks every ${noun} record already in SAP B1.`
              : strong
                ? "Decide before submitting, so no approver spends time on a second copy of the same organisation."
                : top
                  ? "Below the duplicate threshold, so no decision is needed. Check them anyway."
                  : `Checked against existing ${noun} records in SAP B1, including the same tax ID in any country.`}
          </p>
        </div>
        {checking ? <LoaderCircle aria-label="Checking" className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <AnimatePresence initial={false}>
        {matches.length ? (
          <motion.ul
            key="matches"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2 px-5 pb-3"
          >
            {matches.map((m, i) => {
              const pct = Math.round(m.score * 100);
              const isSel = selected?.record.cardCode === m.record.cardCode && strong;
              return (
                <li key={m.record.cardCode}>
                  <button
                    type="button"
                    data-testid={`dup-match-${i}`}
                    disabled={!strong || matches.length === 1}
                    onClick={() => decision && onDecide(decisionFor(m, decision.choice, decision.justification))}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-lg border bg-card px-3.5 py-2.5 text-left disabled:cursor-default",
                      isSel ? "border-warn ring-1 ring-warn/50" : "border-border",
                    )}
                  >
                    <span className="flex w-14 shrink-0 flex-col items-center">
                      <span
                        className={cn(
                          "num text-[1.375rem] leading-none font-semibold tracking-tight",
                          m.score >= DUP_DECISION_THRESHOLD ? "text-warn-ink" : "text-muted-foreground",
                        )}
                      >
                        {pct}%
                      </span>
                      <span className="mt-0.5 text-[0.625rem] text-muted-foreground">match</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-foreground">{m.record.cardName}</span>
                        <SapCode code={m.record.cardCode} />
                      </span>
                      <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                        Entity {m.record.entity} · {m.record.country}
                        {m.record.street ? ` · ${m.record.street}` : ""}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {m.reasons.map((r) => (
                          <span
                            key={r}
                            className={cn(
                              "inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium",
                              r === "Same tax ID" ? "bg-warn text-warn-foreground" : "bg-muted text-foreground/80",
                            )}
                          >
                            {r}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {strong && selected ? (
        <div className="border-t border-warn/40 px-5 py-3.5">
          <p className="mb-2 text-[0.8125rem] font-medium">What would you like to do?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Duplicate decision">
            <ChoiceButton
              testId="dup-choice-use"
              icon={<CopyCheck aria-hidden />}
              active={decision?.choice === "use_existing"}
              onClick={() => onDecide(decisionFor(selected, "use_existing"))}
            >
              {CHOICE_LABEL.use_existing}
            </ChoiceButton>
            {canExtend ? (
              <ChoiceButton
                testId="dup-choice-extend"
                icon={<GitBranchPlus aria-hidden />}
                active={false}
                primary
                onClick={() => onExtend(selected)}
              >
                {CHOICE_LABEL.extend}
              </ChoiceButton>
            ) : null}
            <ChoiceButton
              testId="dup-choice-override"
              icon={<SquarePen aria-hidden />}
              active={decision?.choice === "override"}
              onClick={() => onDecide(decisionFor(selected, "override", decision?.choice === "override" ? decision.justification ?? "" : ""))}
            >
              {CHOICE_LABEL.override}
            </ChoiceButton>
          </div>

          {decision?.choice === "use_existing" ? (
            <div className="mt-3 rounded-lg border border-ok/35 bg-ok-soft px-3.5 py-3 text-[0.8125rem] text-ok-ink" data-testid="dup-use-existing-note">
              <p className="flex items-start gap-2">
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>
                  No new record is needed. <strong>{selected.record.cardName}</strong> is already in SAP B1 as{" "}
                  <SapCode code={selected.record.cardCode} />: quote that code on your sales order.
                  {canExtend ? ` If ${myEntity || "your entity"} doesn't sell to them yet, extend the existing record to your entity instead.` : ""}
                </span>
              </p>
              {canExtend ? (
                <Button type="button" size="sm" variant="outline" className="mt-2.5 bg-card" onClick={() => onExtend(selected)}>
                  <GitBranchPlus aria-hidden />
                  Extend to {myEntity || "my entity"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {decision?.choice === "override" ? (
            <div className="mt-3">
              <label htmlFor="dup-justification" className="text-[0.8125rem] font-medium">
                Why is this a different {noun}?
              </label>
              <Textarea
                id="dup-justification"
                data-testid="dup-justification"
                value={decision.justification ?? ""}
                onChange={(e) => onDecide({ ...decision, justification: e.target.value })}
                placeholder="e.g. Separate legal entity with its own tax ID; the match is a sister hospital in the same group"
                rows={2}
                className="mt-1.5 bg-card"
              />
              <p className="mt-1 text-[0.75rem] text-muted-foreground">
                {Math.max(0, OVERRIDE_MIN_CHARS - (decision.justification ?? "").trim().length) > 0
                  ? `At least ${OVERRIDE_MIN_CHARS - (decision.justification ?? "").trim().length} more characters. `
                  : ""}
                Overrides are logged in the audit trail and flagged to MDM for the final check.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChoiceButton({
  children,
  icon,
  active,
  primary,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
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
      className={cn("h-9 px-3", !primary && "bg-card", active && "border-foreground/60 bg-foreground text-background hover:bg-foreground/90 hover:text-background")}
    >
      {icon}
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
    <section data-testid="dup-panel" aria-live="polite" className="rounded-xl border border-border bg-card px-5 py-3.5 shadow-raised">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <ScanSearch aria-hidden className="size-4 text-primary" />
        Existing record in SAP B1
      </h2>
      {record ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="font-semibold">{record.cardName}</span>
          <SapCode code={record.cardCode} />
          <span className="text-muted-foreground">{record.country}</span>
          <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
            Sold by:
            {entities.length ? (
              entities.map((e) => (
                <span key={e} className="rounded-full bg-muted px-2 py-px text-[0.75rem] font-medium text-foreground">
                  {e}
                </span>
              ))
            ) : (
              <span>—</span>
            )}
            {targetEntity && !already ? (
              <span className="rounded-full border border-dashed border-primary px-2 py-px text-[0.75rem] font-medium text-primary">
                + {targetEntity}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      <p className={cn("mt-2 text-[0.8125rem]", already ? "text-warn-ink" : "text-muted-foreground")}>
        {record
          ? already
            ? `${targetEntity} already sells to this customer, so nothing needs extending.`
            : "One business-partner record is shared by every entity, so this updates the existing record: it adds your entity, plus any new terms Finance approves. The customer code stays the same."
          : code.trim()
            ? `No customer with code ${code.trim()} was found in SAP B1. Check the code, or search by name.`
            : name.trim()
              ? "Pick the record you mean:"
              : "Enter the customer code or name and OneRecord finds the record."}
      </p>
      {!record && suggestions.length ? (
        <ul className="mt-2 space-y-1.5">
          {suggestions.map((m) => (
            <li key={m.record.cardCode} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <span className="num w-10 font-semibold text-muted-foreground">{Math.round(m.score * 100)}%</span>
              <span className="min-w-0 flex-1 truncate">{m.record.cardName}</span>
              <SapCode code={m.record.cardCode} />
              <Button type="button" size="sm" variant="outline" onClick={() => onPick(m)}>
                Use this record
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
