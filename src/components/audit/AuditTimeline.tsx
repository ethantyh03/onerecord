"use client";

import { useMemo, useState } from "react";
import { Download, FileWarning, Link2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AuditEvent } from "@/lib/types";
import { verifyChain } from "@/lib/engine/audit";
import { useSandbox } from "@/lib/store";
import { personById } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonAvatar, formatSgtDateTime } from "@/components/common";

export interface AuditTimelineProps {
  /** Request id (or "CONFIG") whose events are listed */
  requestId: string;
  /** Hide the card chrome when the host already provides a card */
  bare?: boolean;
  className?: string;
}

const ACTION_LABELS: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  question: "Asked a question",
  answered: "Answered the question",
  reminder: "Reminder sent",
  escalated: "Escalated",
  delegated: "Delegated",
  sod_reassigned: "Reassigned (segregation of duties)",
  dtw_generated: "SAP B1 import file generated",
  created_in_sap: "Created in SAP B1",
  sensitive_revealed: "Sensitive value viewed",
  duplicate_override: "Duplicate warning overridden",
  duplicate_extend: "Chose to extend the existing record",
  duplicate_use_existing: "Chose to use the existing record",
  linked_waiting_orders: "Linked waiting orders",
  ai_prefill: "Form pre-filled from pasted text",
  field_updated: "Field updated",
  cancelled: "Withdrawn",
  config_changed: "Configuration changed",
  out_of_office_set: "Out of office set",
  out_of_office_cleared: "Back in office",
};

const ACTION_TONE: Record<string, string> = {
  approved: "text-ok-ink",
  created_in_sap: "text-ok-ink",
  rejected: "text-stuck-ink",
  duplicate_override: "text-warn-ink",
  escalated: "text-warn-ink",
  reminder: "text-warn-ink",
  question: "text-warn-ink",
  sensitive_revealed: "text-phase2-ink",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const short = (h: string) => h.slice(0, 8);

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

type CheckResult = { kind: "ok"; total: number } | { kind: "broken"; at: number; total: number } | null;

/**
 * Append-only audit trail for one request, oldest first, with the hash-chain controls:
 * Verify chain, Simulate tamper (on a copy, never the stored log) and Export CSV.
 */
export function AuditTimeline({ requestId, bare = false, className }: AuditTimelineProps) {
  const audit = useSandbox((s) => s.audit);
  const config = useSandbox((s) => s.config);

  // Simulate tamper works on a copy of the whole chain; the stored log is never touched.
  const [tampered, setTampered] = useState<{ chain: AuditEvent[]; seq: number; original: string } | null>(null);
  const [check, setCheck] = useState<{ result: CheckResult; auditLen: number } | null>(null);

  const chain = tampered?.chain ?? audit;
  const events = useMemo(() => chain.filter((e) => e.requestId === requestId), [chain, requestId]);
  const result = check && (tampered || check.auditLen === audit.length) ? check.result : null;
  const brokenSeq = result?.kind === "broken" ? result.at : null;

  function runVerify(target: AuditEvent[] = chain) {
    const v = verifyChain(target);
    const r: CheckResult = v.ok ? { kind: "ok", total: target.length } : { kind: "broken", at: v.brokenAt ?? 0, total: target.length };
    setCheck({ result: r, auditLen: audit.length });
    return r;
  }

  function simulateTamper() {
    const mine = audit.filter((e) => e.requestId === requestId);
    const target = mine.find((e) => e.action === "approved") ?? mine.find((e) => e.action === "submitted") ?? mine[0];
    if (!target) return;
    const original = target.detail ?? "";
    const edited = target.action === "approved" ? `${original.split(" · ")[0]} · “Approved after full review”` : `${original} (edited)`;
    const copy = audit.map((e) => (e.seq === target.seq ? { ...e, detail: edited } : e));
    setTampered({ chain: copy, seq: target.seq, original });
    runVerify(copy);
  }

  function restore() {
    setTampered(null);
    runVerify(audit);
  }

  function exportCsv() {
    const header = ["event_no", "time_sgt", "at_iso", "actor", "action", "detail", "prev_hash", "hash"];
    const rows = events.map((e) => [
      String(e.seq + 1),
      formatSgtDateTime(e.at),
      e.at,
      personById({ config }, e.actorId)?.name ?? e.actorId,
      actionLabel(e.action),
      e.detail ?? "",
      e.prevHash,
      e.hash,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    try {
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${requestId}-audit-trail.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      toast.success(`Exported ${events.length} audit events`, { description: `${requestId}-audit-trail.csv` });
    } catch {
      toast.error("This browser blocked the download");
    }
  }

  const body = (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">Audit trail</h2>
          <p className="max-w-[64ch] text-sm text-muted-foreground">
            Every action on {requestId}, oldest first. Each entry carries a SHA-256 fingerprint of itself plus the entry
            before it, so an edit after the fact breaks the chain.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => runVerify()} data-testid="audit-verify">
            <ShieldCheck aria-hidden />
            Verify chain
          </Button>
          {tampered ? (
            <Button variant="outline" size="sm" onClick={restore} data-testid="audit-restore">
              <RotateCcw aria-hidden />
              Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={simulateTamper} disabled={events.length === 0} data-testid="audit-tamper">
              <FileWarning aria-hidden />
              Simulate tamper
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={events.length === 0} data-testid="audit-export">
            <Download aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      {result ? (
        result.kind === "ok" ? (
          <div
            role="status"
            data-testid="audit-result"
            data-result="ok"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ok/25 bg-ok-soft px-5 py-2.5 text-sm"
          >
            <span className="font-semibold text-ok-ink">✓ Chain intact · {result.total} events</span>
            <span className="text-secondary-foreground">
              Every fingerprint in the shared log re-checked, including the {events.length} for {requestId}.
            </span>
          </div>
        ) : (
          <div
            role="alert"
            data-testid="audit-result"
            data-result="broken"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stuck/30 bg-stuck-soft px-5 py-2.5 text-sm"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-stuck-ink">
              <ShieldAlert aria-hidden className="size-4" />
              Integrity broken at event #{result.at + 1} — any edit after the fact is detectable
            </span>
            {tampered ? (
              <span className="text-secondary-foreground">Simulation on a copy; the stored log is unchanged.</span>
            ) : null}
          </div>
        )
      ) : null}

      {events.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No audit events for {requestId} yet.</p>
      ) : (
        <ol className="divide-y divide-border" aria-label={`Audit events for ${requestId}`}>
          {events.map((e) => {
            const actor = personById({ config }, e.actorId);
            const broken = brokenSeq === e.seq;
            const isTamperedRow = tampered?.seq === e.seq;
            return (
              <li
                key={e.seq}
                data-testid={`audit-event-${e.seq + 1}`}
                data-broken={broken || undefined}
                className={cn(
                  "grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-5 py-3 transition-colors @2xl:grid-cols-[3.25rem_minmax(0,1fr)_13rem]",
                  broken && "bg-stuck-soft shadow-[inset_3px_0_0_var(--stuck)]",
                )}
              >
                <span
                  className={cn(
                    "num pt-0.5 font-mono text-xs font-medium",
                    broken ? "text-stuck-ink" : "text-muted-foreground",
                  )}
                >
                  #{e.seq + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <PersonAvatar person={actor} size="xs" />
                    <span className="text-sm font-medium text-foreground">{actor?.name ?? e.actorId}</span>
                    <span className={cn("text-sm font-medium", ACTION_TONE[e.action] ?? "text-secondary-foreground")}>
                      {actionLabel(e.action)}
                    </span>
                    <span className="num text-xs text-muted-foreground">{formatSgtDateTime(e.at)}</span>
                  </div>
                  {e.detail ? (
                    <p className={cn("text-sm text-pretty", broken ? "text-stuck-ink" : "text-secondary-foreground")}>{e.detail}</p>
                  ) : null}
                  {isTamperedRow ? (
                    <p className="text-xs text-stuck-ink">
                      Edited on a copy. Originally: <span className="italic">{tampered.original || "—"}</span>
                    </p>
                  ) : null}
                </div>
                <div
                  className="col-start-2 flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] text-muted-foreground @2xl:col-start-3 @2xl:flex-col @2xl:items-end @2xl:gap-0.5"
                  title={`hash ${e.hash}\nprev ${e.prevHash}`}
                >
                  <span className={cn("num rounded-[4px] border px-1 py-px", broken ? "border-stuck/40 text-stuck-ink" : "border-border bg-muted/60 text-foreground")}>
                    {short(e.hash)}
                  </span>
                  <span className="num inline-flex items-center gap-1">
                    <Link2 aria-hidden className="size-3" />
                    prev {short(e.prevHash)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
        Prototype: hash chain kept and checked in this browser. In production: SharePoint version history, Purview approval
        logs and a hash column.
      </p>
    </>
  );

  if (bare) return <div className={cn("@container", className)}>{body}</div>;
  return <section className={cn("@container overflow-hidden rounded-xl border bg-card shadow-raised", className)}>{body}</section>;
}

export default AuditTimeline;
