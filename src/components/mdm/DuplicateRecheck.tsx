"use client";

import { useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { DomainConfig, MdmRequest } from "@/lib/types";
import { master } from "@/data/contract";
import { useSandbox } from "@/lib/store";
import { formatAgo, SapCode, StateGlyph } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { recheckDuplicates, type RecheckMatch } from "./mdm-helpers";

/**
 * The re-check result as a ruled status line (hairlines above and below, no box, no rail): a state
 * square, the result in the state's ink, the detail under it, the Re-check control on the right.
 */
function ResultLine({
  tone,
  children,
  action,
  className,
}: {
  tone: "ok" | "neutral";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-testid="mdm-dup-recheck"
      className={cn("flex items-start gap-3 border-y border-border py-3 text-sm leading-6", className)}
    >
      <StateGlyph tone={tone} className="mt-2" />
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="-my-0.5 shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * The matcher's own reasons as a machine readout: "97% · Same tax ID · Same postcode". A reason that
 * already carries the score ("92% name match") drops the repeated figure.
 */
function readout(m: RecheckMatch): string[] {
  const pct = `${Math.round(m.score * 100)}%`;
  const reasons = m.reasons.map((r) => (r.startsWith(`${pct} `) ? r.slice(pct.length + 1) : r));
  return [pct, ...reasons];
}

/**
 * Lock-on: corner brackets close around the existing record that matched (once, ~250 ms) and a mono
 * readout says why. It answers MDM's re-check, so the motion is earned; reduced motion shows it static.
 */
function LockOn({ match }: { match: RecheckMatch }) {
  return (
    <li className="relative px-3.5 py-2.5" data-testid={`mdm-dup-match-${match.code}`}>
      <span aria-hidden className="pointer-events-none absolute inset-0 animate-in duration-250 ease-out fade-in zoom-in-[1.06]">
        <span className="absolute top-0 left-0 size-3 border-t-2 border-l-2 border-signal" />
        <span className="absolute top-0 right-0 size-3 border-t-2 border-r-2 border-signal" />
        <span className="absolute bottom-0 left-0 size-3 border-b-2 border-l-2 border-signal" />
        <span className="absolute right-0 bottom-0 size-3 border-r-2 border-b-2 border-signal" />
      </span>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <SapCode code={match.code} />
        <span className="text-sm font-medium text-foreground">{match.name}</span>
      </div>
      {/* Break only between reasons, never inside one. */}
      <p className="mono-id mt-1.5 text-signal">
        {readout(match).map((part, i) => (
          <span key={i}>
            {i ? <span className="text-subtle"> · </span> : null}
            <span className="whitespace-nowrap">{part}</span>
          </span>
        ))}
      </p>
    </li>
  );
}

/** (1) Duplicate re-check: the intake check runs again at MDM, against the master extract and everything created since. */
export function DuplicateRecheck({ req, domain, now }: { req: MdmRequest; domain: DomainConfig; now: string }) {
  const sapRecords = useSandbox((s) => s.sapRecords);
  const [checkedAt, setCheckedAt] = useState(now);
  const [runs, setRuns] = useState(0);
  const result = useMemo(
    () => recheckDuplicates(req, domain, master, sapRecords),
    // runs forces a fresh pass when MDM clicks "Re-check"
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [req, domain, sapRecords, runs],
  );
  const ago = formatAgo(checkedAt, now);
  const decision = req.duplicateDecision;

  const rerun = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setRuns((n) => n + 1);
        setCheckedAt(useSandbox.getState().nowIso());
      }}
      aria-label="Run the duplicate check again"
      className="shrink-0"
    >
      <RefreshCw aria-hidden />
      Re-check
    </Button>
  );

  if (result.kind === "extension") {
    return (
      <ResultLine tone="neutral">
        <p className="font-semibold text-foreground">Extension of an existing record: no new record is created</p>
        <p className="text-secondary-foreground">
          Updates <SapCode code={String(req.data.existingCode ?? "")} /> {String(req.data.existingName ?? "")} for{" "}
          {String(req.data.extendToEntity ?? req.entity)}, so there is nothing new to duplicate.
        </p>
      </ResultLine>
    );
  }

  if (result.kind === "matches") {
    return (
      <section data-testid="mdm-dup-recheck" className="border-y border-border text-sm">
        <header className="flex items-start gap-3 py-3 leading-6">
          <StateGlyph tone="warn" className="mt-2" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-warn-ink">
              {result.matches.length} possible duplicate{result.matches.length === 1 ? "" : "s"} · re-checked {ago}
            </p>
            {decision?.choice === "override" ? (
              <p className="text-secondary-foreground">
                Requestor overrode the warning at intake: “{decision.justification ?? "no reason given"}”
              </p>
            ) : null}
          </div>
          <div className="-my-0.5 shrink-0">{rerun}</div>
        </header>
        <ul className="grid gap-x-6 gap-y-3 pb-4 pl-5 md:grid-cols-2">
          {result.matches.map((m) => (
            <LockOn key={`${m.code}-${runs}`} match={m} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <ResultLine tone={result.kind === "clear" ? "ok" : "neutral"} action={result.kind === "clear" ? rerun : undefined}>
      <p className={cn("font-semibold", result.kind === "clear" ? "text-ok-ink" : "text-foreground")}>
        {result.kind === "not_applicable" ? "No duplicate check for this record type" : `No duplicates found · re-checked ${ago}`}
      </p>
      {result.kind === "clear" ? (
        <p className="text-secondary-foreground">
          Compared with <span className="num">{result.compared.toLocaleString("en-SG")}</span> records in the SAP B1 master
          extract and the sandbox.
        </p>
      ) : null}
    </ResultLine>
  );
}
