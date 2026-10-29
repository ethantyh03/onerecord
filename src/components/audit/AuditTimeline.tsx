"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Download, FileWarning, Link2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AuditEvent } from "@/lib/types";
import { GENESIS_HASH, hashEvent, verifyChain } from "@/lib/engine/audit";
import { useSandbox } from "@/lib/store";
import { personById, useCurrentPerson } from "@/lib/selectors";
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

/** State of one link of the chain as the verifier last saw it. */
type LinkState = "unchecked" | "ok" | "broken";

const RAIL: Record<LinkState, string> = {
  unchecked: "border-l border-border-strong",
  ok: "border-l border-ok/80",
  broken: "border-l-[1.5px] border-dashed border-stuck",
};

/**
 * One half of the chain rail beside a record (top half = the link into it, bottom half = the link out of it).
 * After a verify, the coloured rail runs down the chain in order: the verifier walking the links.
 */
function RailSegment({ half, state, delay, walk }: { half: "top" | "bottom"; state: LinkState; delay: number; walk: number }) {
  const reduce = useReducedMotion();
  const pos = half === "top" ? "top-0 h-4" : "top-4 bottom-0";
  if (state === "unchecked" || reduce) {
    return <span aria-hidden className={cn("absolute left-1/2 -translate-x-1/2", pos, RAIL[state])} />;
  }
  return (
    <>
      {/* Grey rail under a solid segment while it draws; a dashed (broken) segment shows nothing through its gaps. */}
      {state === "ok" ? <span aria-hidden className={cn("absolute left-1/2 -translate-x-1/2", pos, RAIL.unchecked)} /> : null}
      <motion.span
        key={walk}
        aria-hidden
        className={cn("absolute left-1/2 origin-top -translate-x-1/2", pos, RAIL[state])}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.12, delay, ease: "linear" }}
      />
    </>
  );
}

/**
 * Append-only audit trail for one request, oldest first, drawn as a chain of records: each record carries the
 * SHA-256 fingerprint of itself plus the one before it. Hash-chain controls: Verify chain and Export CSV for
 * everyone; MDM and admins also get the sandbox tamper test (on a copy, never the stored log). A broken link turns the record coral, shows the
 * fingerprint recomputed from the edited entry next to the stored one, and every link after it goes dashed.
 */
export function AuditTimeline({ requestId, bare = false, className }: AuditTimelineProps) {
  const audit = useSandbox((s) => s.audit);
  const config = useSandbox((s) => s.config);
  const me = useCurrentPerson();
  // The tamper test is a sandbox tool for the people who own the log (MDM, admins), not for requestors.
  const canTamperTest = me.roles.includes("mdm") || me.roles.includes("admin");

  // The tamper test works on a copy of the whole chain; the stored log is never touched.
  const [tampered, setTampered] = useState<{ chain: AuditEvent[]; seq: number; original: string } | null>(null);
  const [check, setCheck] = useState<{ result: CheckResult; auditLen: number; walk: number } | null>(null);

  const chain = tampered?.chain ?? audit;
  const events = useMemo(() => chain.filter((e) => e.requestId === requestId), [chain, requestId]);
  const result = check && (tampered || check.auditLen === audit.length) ? check.result : null;
  const brokenSeq = result?.kind === "broken" ? result.at : null;
  const walk = check?.walk ?? 0;

  /** What exactly failed at the broken record: its own fingerprint, its link to the record before, or both. */
  const breakDetail = useMemo(() => {
    if (brokenSeq === null) return null;
    const ev = chain[brokenSeq];
    if (!ev) return null;
    const { hash, ...rest } = ev;
    const recomputed = hashEvent(rest);
    const expectedPrev = brokenSeq === 0 ? GENESIS_HASH : chain[brokenSeq - 1]?.hash;
    return { recomputed, hashMismatch: recomputed !== hash, prevMismatch: ev.prevHash !== expectedPrev };
  }, [brokenSeq, chain]);

  function runVerify(target: AuditEvent[] = chain) {
    const v = verifyChain(target);
    const r: CheckResult = v.ok ? { kind: "ok", total: target.length } : { kind: "broken", at: v.brokenAt ?? 0, total: target.length };
    setCheck((c) => ({ result: r, auditLen: audit.length, walk: (c?.walk ?? 0) + 1 }));
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

  /** The link into event `e` (from the record before it in the shared log). */
  function linkInto(e: AuditEvent): LinkState {
    if (!result) return "unchecked";
    if (result.kind === "ok" || brokenSeq === null) return "ok";
    if (e.seq < brokenSeq) return "ok";
    if (e.seq === brokenSeq) return breakDetail?.prevMismatch ? "broken" : "ok";
    return "broken";
  }

  function nodeState(e: AuditEvent): "unchecked" | "ok" | "broken" | "after" {
    if (!result) return "unchecked";
    if (result.kind === "ok" || brokenSeq === null || e.seq < brokenSeq) return "ok";
    return e.seq === brokenSeq ? "broken" : "after";
  }

  const body = (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 @3xl:flex-row @3xl:items-start @3xl:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="panel-title">Audit trail</h2>
          <p className="max-w-[64ch] text-sm leading-5 text-muted-foreground">
            Every action on {requestId}, oldest first. Each entry carries a SHA-256 fingerprint of itself plus the entry
            before it, so an edit after the fact breaks the chain.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => runVerify()} data-testid="audit-verify">
            <ShieldCheck aria-hidden />
            Verify chain
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCsv} disabled={events.length === 0} data-testid="audit-export">
            <Download aria-hidden />
            Export CSV
          </Button>
          {tampered ? (
            <Button variant="outline" size="sm" onClick={restore} data-testid="audit-restore">
              <RotateCcw aria-hidden />
              Restore
            </Button>
          ) : canTamperTest ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={simulateTamper}
              disabled={events.length === 0}
              data-testid="audit-tamper"
              title="Sandbox only: edits one entry on a copy of the log, then re-checks the chain"
              className="text-muted-foreground"
            >
              <FileWarning aria-hidden />
              Tamper test (sandbox)
            </Button>
          ) : null}
        </div>
      </div>

      {result ? (
        result.kind === "ok" ? (
          <div
            role="status"
            data-testid="audit-result"
            data-result="ok"
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-sm"
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
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2.5 text-sm"
          >
            <span className="inline-flex items-center gap-1.5 font-semibold text-stuck-ink">
              <ShieldAlert aria-hidden className="size-4" />
              Integrity broken at event #{result.at + 1} — any edit after the fact is detectable
            </span>
            {tampered ? (
              <span className="text-secondary-foreground">Sandbox test on a copy; the stored log is unchanged.</span>
            ) : null}
          </div>
        )
      ) : null}

      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No audit events for {requestId} yet.</p>
      ) : (
        <ol className="py-1" aria-label={`Audit events for ${requestId}`}>
          {events.map((e, i) => {
            const actor = personById({ config }, e.actorId);
            const broken = brokenSeq === e.seq;
            const isTamperedRow = tampered?.seq === e.seq;
            const node = nodeState(e);
            const next = events[i + 1];
            return (
              <li
                key={e.seq}
                data-testid={`audit-event-${e.seq + 1}`}
                data-broken={broken || undefined}
                data-link={node}
                className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 pr-4 pl-1"
              >
                {/* The chain: the record number is the link node, the rail is the chain of fingerprints. Only the
                    tamper moment (the broken entry and the ones after it) earns a box; verified entries are bare numerals. */}
                <div className="relative">
                  {i > 0 ? <RailSegment half="top" state={linkInto(e)} delay={i * 0.06} walk={walk} /> : null}
                  {next ? <RailSegment half="bottom" state={linkInto(next)} delay={i * 0.06 + 0.03} walk={walk} /> : null}
                  <span
                    className={cn(
                      "relative z-10 mx-auto mt-2 flex h-5 w-fit min-w-9 items-center justify-center rounded-sm border px-1 font-mono text-xs leading-none tabular-nums [font-stretch:100%]",
                      node === "broken"
                        ? "border-stuck bg-stuck font-semibold text-stuck-foreground"
                        : node === "after"
                          ? "border-dashed border-stuck/70 bg-card text-stuck-ink"
                          : node === "ok"
                            ? "border-transparent bg-card text-ok-ink"
                            : "border-transparent bg-card text-muted-foreground",
                    )}
                  >
                    #{e.seq + 1}
                  </span>
                </div>
                <div className="min-w-0 space-y-1 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <PersonAvatar person={actor} size="xs" />
                    <span className="text-sm font-medium text-foreground">{actor?.name ?? e.actorId}</span>
                    <span className={cn("text-sm font-medium", ACTION_TONE[e.action] ?? "text-secondary-foreground")}>
                      {actionLabel(e.action)}
                    </span>
                    <span className="num text-xs text-muted-foreground">{formatSgtDateTime(e.at)}</span>
                  </div>
                  {e.detail ? (
                    <p className={cn("text-[0.8125rem] leading-5 text-pretty", broken ? "font-medium text-stuck-ink" : "text-secondary-foreground")}>
                      {e.detail}
                    </p>
                  ) : null}
                  {isTamperedRow ? (
                    <p className="text-xs text-stuck-ink">
                      Edited on a copy. Originally: <span className="italic">{tampered.original || "—"}</span>
                    </p>
                  ) : null}
                  <div
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 font-mono text-xs text-muted-foreground [font-stretch:100%]"
                    title={`hash ${e.hash}\nprev ${e.prevHash}`}
                  >
                    <span className={cn("num", broken ? "font-semibold text-stuck-ink" : "text-secondary-foreground")}>
                      {short(e.hash)}
                    </span>
                    {broken && breakDetail?.hashMismatch ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-stuck-ink"
                        title={`Fingerprint recomputed from the entry as it reads now: ${breakDetail.recomputed}`}
                      >
                        <span aria-hidden className="text-sm leading-none font-semibold">≠</span>
                        <span className="num font-semibold text-stuck-ink">
                          {short(breakDetail.recomputed)}
                        </span>
                        <span className="font-sans text-xs">recomputed</span>
                      </span>
                    ) : null}
                    <span className={cn("num inline-flex items-center gap-1", broken && breakDetail?.prevMismatch && "text-stuck-ink")}>
                      <Link2 aria-hidden className="size-3" />
                      prev {short(e.prevHash)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );

  if (bare) return <div className={cn("@container", className)}>{body}</div>;
  return <section className={cn("@container panel overflow-hidden", className)}>{body}</section>;
}

export default AuditTimeline;
