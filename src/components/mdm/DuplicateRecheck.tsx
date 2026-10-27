"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, GitMerge, RefreshCw, TriangleAlert } from "lucide-react";
import type { DomainConfig, MdmRequest } from "@/lib/types";
import { master } from "@/data/contract";
import { useSandbox } from "@/lib/store";
import { formatAgo, SapCode } from "@/components/common";
import { Button } from "@/components/ui/button";
import { recheckDuplicates } from "./mdm-helpers";

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
      variant="ghost"
      size="xs"
      onClick={() => {
        setRuns((n) => n + 1);
        setCheckedAt(useSandbox.getState().nowIso());
      }}
      aria-label="Run the duplicate check again"
    >
      <RefreshCw aria-hidden />
      Re-check
    </Button>
  );

  if (result.kind === "extension") {
    return (
      <div data-testid="mdm-dup-recheck" className="rounded-xl border border-primary/20 bg-primary-soft/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <GitMerge aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-foreground">Extension of an existing record: no new record is created</p>
            <p className="mt-0.5 text-secondary-foreground">
              Updates <SapCode code={String(req.data.existingCode ?? "")} /> {String(req.data.existingName ?? "")} for{" "}
              {String(req.data.extendToEntity ?? req.entity)}, so there is nothing new to duplicate.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (result.kind === "matches") {
    return (
      <div data-testid="mdm-dup-recheck" className="rounded-xl border border-warn/50 bg-warn-soft px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn-ink" />
            <div>
              <p className="text-sm font-semibold text-warn-ink">
                {result.matches.length} possible duplicate{result.matches.length === 1 ? "" : "s"} · re-checked {ago}
              </p>
              {decision?.choice === "override" ? (
                <p className="mt-0.5 text-[0.8125rem] text-secondary-foreground">
                  Requestor overrode the warning at intake: “{decision.justification ?? "no reason given"}”
                </p>
              ) : null}
            </div>
          </div>
          {rerun}
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {result.matches.map((m) => (
            <li key={m.code} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md bg-card/80 px-2.5 py-1.5 text-[0.8125rem]">
              <SapCode code={m.code} />
              <span className="font-medium text-foreground">{m.name}</span>
              <span className="num font-semibold text-warn-ink">{Math.round(m.score * 100)}%</span>
              <span className="text-muted-foreground">{m.reasons.join(", ")}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      data-testid="mdm-dup-recheck"
      className="flex items-center justify-between gap-3 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-ok-ink" />
        <div className="text-sm">
          <p className="font-semibold text-ok-ink">
            {result.kind === "not_applicable" ? "No duplicate check for this record type" : `No duplicates found · re-checked ${ago}`}
          </p>
          {result.kind === "clear" ? (
            <p className="mt-0.5 text-[0.8125rem] text-secondary-foreground">
              Compared with {result.compared.toLocaleString("en-SG")} records in the SAP B1 master extract and the sandbox.
            </p>
          ) : null}
        </div>
      </div>
      {result.kind === "clear" ? rerun : null}
    </div>
  );
}
