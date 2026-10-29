"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, FilePlus2, FlaskConical, TriangleAlert } from "lucide-react";
import {
  EmptyState,
  IllustrativeMarker,
  Notice,
  PageHeader,
  Phase2Badge,
  Readout,
  ReadoutStrip,
  SyntheticBadge,
  formatSgtDateTime,
} from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { inbox, triageEval, type InboxMessage } from "@/data/contract";
import { classifyMessage } from "@/lib/engine/triage";
import type { MessageKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Figure, LINK, Panel, SectionHeading } from "./story-ui";

const KINDS: MessageKind[] = ["po", "pr", "enquiry", "followup", "mdm"];

/**
 * Stream colours are a small square beside the stream's name, never a filled badge: green = real demand
 * (counted), light grey = pipeline, amber = early signal, slate = service, hollow = our own internal work.
 */
const KIND_META: Record<MessageKind, { label: string; plural: string; role: string; counted: string; dot: string; hollow?: boolean }> = {
  po: {
    label: "Purchase order",
    plural: "Purchase orders",
    role: "Demand",
    counted: "Counted as volume in Regional Pulse.",
    dot: "var(--ok)",
  },
  pr: {
    label: "Purchase request",
    plural: "Purchase requests",
    role: "Pipeline",
    counted: "Quote accepted or intent to buy, no PO yet. Tracked as pipeline, not counted as volume.",
    dot: "var(--foreground)",
  },
  enquiry: {
    label: "Enquiry",
    plural: "Enquiries",
    role: "Leading indicator",
    counted: "Price, stock or spec questions. Counted as a signal of demand to come.",
    dot: "var(--warn)",
  },
  followup: {
    label: "Follow-up",
    plural: "Follow-ups",
    role: "Service",
    counted: "Delivery or invoice questions on existing orders. Excluded from demand so nothing is counted twice.",
    dot: "var(--chart-5)",
  },
  mdm: {
    label: "Master-data setup",
    plural: "Master-data setup",
    role: "Internal work, not demand",
    counted: "A new customer, item or vendor to set up. Goes into OneRecord as a request, never into the sales numbers.",
    dot: "var(--muted-foreground)",
    hollow: true,
  },
};

function KindDot({ kind, className }: { kind: MessageKind; className?: string }) {
  const m = KIND_META[kind];
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-[1px]", className)}
      style={m.hollow ? { boxShadow: `inset 0 0 0 1.5px ${m.dot}` } : { background: m.dot }}
    />
  );
}

interface Classified {
  msg: InboxMessage;
  kind: MessageKind;
  reasons: string[];
  confidence: number;
}

function confidenceLabel(c: number): string {
  if (c >= 0.85) return "High confidence";
  if (c >= 0.65) return "Medium confidence";
  return "Low confidence, check by hand";
}

export function TriagePage() {
  const [filter, setFilter] = useState<MessageKind | "all">("all");

  const classified = useMemo<Classified[]>(() => {
    const messages = Array.isArray(inbox?.messages) ? inbox.messages : [];
    return messages
      .map((msg) => ({ msg, ...classifyMessage(msg) }))
      .sort((a, b) => Date.parse(b.msg.receivedAt) - Date.parse(a.msg.receivedAt));
  }, []);

  const counts = useMemo(() => {
    const c = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<MessageKind, number>;
    for (const m of classified) c[m.kind] = (c[m.kind] ?? 0) + 1;
    return c;
  }, [classified]);

  const labelled = classified.filter((m) => m.msg.humanLabel);
  const agree = labelled.filter((m) => m.msg.humanLabel === m.kind).length;
  const shown = filter === "all" ? classified : classified.filter((m) => m.kind === filter);

  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        title="Inbox triage"
        subtitle="Everything that lands in the shared sales mailbox, sorted into five streams with the reason for each. Customer demand and our own setup work are never mixed."
        meta={
          <>
            <SyntheticBadge label="Fictional sample messages" />
          </>
        }
      />

      {/* Sits flush under the page header, whose hairline is its top rule */}
      <Notice
        tone="phase2"
        lead={<span className="text-foreground">Rules-based today; Phase 2: in-tenant LLM triage on the shared mailbox.</span>}
        action={<Phase2Badge label="LLM triage" className="mt-2" />}
        className="border-b border-border py-3"
      >
        Every message is sorted live in your browser by transparent rules. No AI service is called.
      </Notice>

      {/* ---------------------------------------------------------------- streams */}
      <section aria-labelledby="streams-title">
        <SectionHeading
          id="streams-title"
          title="Five streams, five different jobs"
          subtitle="Only purchase orders count as demand. The others are pipeline, early signals, service or our own internal work."
        />
        <ReadoutStrip columns="auto" gridClassName="lg:[&>[data-lead]]:flex-[1.25]">
          {KINDS.map((k) => {
            const m = KIND_META[k];
            return (
              <Readout
                key={k}
                lead={k === "po"}
                label={
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <KindDot kind={k} />
                    {m.plural}
                  </span>
                }
                value={counts[k]}
                caption={
                  <>
                    <span className="block font-medium text-foreground">= {m.role}</span>
                    <span className="mt-1 block">{m.counted}</span>
                  </>
                }
                footnote={
                  k === "mdm" ? (
                    <Link
                      href="/requests/new?domain=customer"
                      data-testid="triage-create-mdm"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}
                    >
                      <FilePlus2 aria-hidden />
                      Create MDM request
                    </Link>
                  ) : undefined
                }
              />
            );
          })}
        </ReadoutStrip>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------------------------------------------------------------- inbox */}
        <Panel
          titleId="inbox-title"
          title="The mailbox, sorted"
          description={
            labelled.length
              ? `On these ${labelled.length} sample messages the rules agree with a person's label on ${agree}.`
              : "Each message shows the stream it was sorted into and why."
          }
          flush
        >
          <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2" role="group" aria-label="Filter by stream">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} testId="triage-filter-all" label="All" count={classified.length} />
            {KINDS.map((k) => (
              <FilterChip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                testId={`triage-filter-${k}`}
                label={KIND_META[k].plural}
                count={counts[k]}
                kind={k}
              />
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={classified.length ? "No messages in this stream" : "The mailbox is empty"}
                description={classified.length ? "Pick another stream above, or show all messages." : "Sample messages appear here once the data pipeline has run."}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="triage-list">
              {shown.map((c) => (
                <MessageRow key={c.msg.id} c={c} />
              ))}
            </ul>
          )}
        </Panel>

        {/* ---------------------------------------------------------------- evaluation */}
        <EvalCard />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  testId,
  label,
  count,
  kind,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  label: string;
  count: number;
  kind?: MessageKind;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-sm px-2.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
      )}
    >
      {kind ? <KindDot kind={kind} /> : null}
      {label}
      <span className={cn("num text-xs", active ? "text-muted-foreground" : "text-subtle")}>{count}</span>
    </button>
  );
}

function MessageRow({ c }: { c: Classified }) {
  const meta = KIND_META[c.kind];
  const human = c.msg.humanLabel;
  const agrees = human ? human === c.kind : null;
  const low = c.confidence < 0.65;
  return (
    <li className="grid gap-x-6 gap-y-2 px-4 py-3.5 md:grid-cols-[10rem_minmax(0,1fr)]" data-testid={`triage-msg-${c.msg.id}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:block">
        <span className="inline-flex items-center gap-2 text-[0.8125rem] leading-5 font-semibold text-foreground">
          <KindDot kind={c.kind} />
          {meta.label}
        </span>
        <span className={cn("block text-xs leading-4 md:mt-1", low ? "text-warn-ink" : "text-subtle")}>{confidenceLabel(c.confidence)}</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="min-w-0 text-[0.9375rem] leading-5 font-semibold text-foreground">{c.msg.subject}</h3>
          {agrees === null ? null : agrees ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-subtle">
              <Check aria-hidden className="size-3.5" /> Matches a person&apos;s label
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-warn-ink">
              <TriangleAlert aria-hidden className="size-3.5" /> A person labelled it {KIND_META[human!].label.toLowerCase()}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {c.msg.company} ({c.msg.country}) · {formatSgtDateTime(c.msg.receivedAt)}
        </p>
        <p className="mt-2 line-clamp-2 text-sm text-secondary-foreground">{c.msg.body}</p>
        <div className="mt-2.5 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)]">
          <p className="text-xs leading-5 font-medium text-subtle">Why it went here</p>
          <ul className="space-y-0.5 text-[0.8125rem] leading-5 text-foreground">
            {c.reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-[1px] bg-subtle" />
                {r}
              </li>
            ))}
          </ul>
        </div>
        {c.kind === "mdm" ? (
          <Link href="/requests/new?domain=customer" className={cn("mt-2.5 inline-flex items-center gap-1 text-sm font-medium", LINK)}>
            Create MDM request from this
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function EvalCard() {
  const e = triageEval;
  const valid =
    e &&
    e.testSetSize > 0 &&
    Array.isArray(e.labels) &&
    e.labels.length > 0 &&
    Array.isArray(e.confusion) &&
    e.confusion.length === e.labels.length;

  if (!valid) {
    return (
      <Panel as="aside" titleId="eval-title" title="How well do the rules sort?" className="xl:sticky xl:top-[4.5rem]">
        <EmptyState
          size="sm"
          icon={FlaskConical}
          title="No test results yet"
          description="The accuracy check runs on a separate set of messages written independently of the rules. Run the analytics pipeline to fill it in."
        />
      </Panel>
    );
  }

  const max = Math.max(1, ...e.confusion.flat());
  const pct = Math.round(e.accuracy * 100);

  return (
    <Panel
      as="aside"
      titleId="eval-title"
      title="How well do the rules sort?"
      description={`Tested on ${e.testSetSize} messages written independently of the rules.`}
      action={<IllustrativeMarker />}
      className="xl:sticky xl:top-[4.5rem]"
      testId="triage-eval"
    >
      <div className="flex items-end gap-4">
        <div>
          <p className="num font-wide text-[2.25rem] leading-none font-semibold text-foreground">{pct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">sorted into the right stream</p>
        </div>
        <div className="pb-1 text-sm text-secondary-foreground">
          Each of the five streams scores about the same (
          <Figure
            formula={
              <>
                Macro-averaged F1 score across the five streams: {e.macroF1.toFixed(2)}. F1 balances how many of a stream&apos;s messages the rules catch
                with how many they wrongly add.
              </>
            }
          >
            ≈{Math.round(e.macroF1 * 100)}%
          </Figure>
          )
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">{e.plain}</p>

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rows: what it really was · Columns: where the rules put it</p>
        <table className="w-full table-fixed border-separate border-spacing-[3px] text-center text-[0.8125rem]">
          <caption className="sr-only">Confusion matrix: actual stream by predicted stream</caption>
          <thead>
            <tr>
              <th className="w-[26%]" />
              {e.labels.map((l) => (
                <th key={l} scope="col" className="pb-1 text-xs font-medium text-muted-foreground">
                  {shortKind(l)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {e.labels.map((actual, r) => (
              <tr key={actual}>
                <th scope="row" className="pr-1 text-left text-xs font-medium text-muted-foreground">
                  {shortKind(actual)}
                </th>
                {e.labels.map((pred, ci) => {
                  const v = e.confusion[r]?.[ci] ?? 0;
                  const diag = r === ci;
                  const share = v / max;
                  return (
                    <td
                      key={pred}
                      title={`${v} ${KIND_META[actual]?.label ?? actual} message${v === 1 ? "" : "s"} sorted as ${KIND_META[pred]?.label ?? pred}`}
                      className={cn("num h-9 rounded-[2px] font-medium", diag ? "font-semibold" : "", v === 0 && "text-subtle")}
                      style={{
                        background:
                          v === 0 ? "var(--secondary)" : `color-mix(in oklch, ${diag ? "var(--ok)" : "var(--stuck)"} ${Math.round(14 + share * 66)}%, var(--card))`,
                        color: v > 0 && share > 0.55 ? (diag ? "var(--ok-foreground)" : "var(--stuck-foreground)") : undefined,
                      }}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[1px]" style={{ background: "var(--ok)" }} /> Right stream
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[1px]" style={{ background: "var(--stuck)" }} /> Wrong stream
          </span>
        </p>
      </div>

      {Array.isArray(e.perClass) && e.perClass.length ? (
        <ul className="mt-3 divide-y divide-border border-t border-border text-[0.8125rem]">
          {e.perClass.map((p) => (
            <li key={p.kind} className="flex justify-between gap-3 py-1.5">
              <span className="inline-flex items-center gap-2 text-secondary-foreground">
                <KindDot kind={p.kind} />
                {KIND_META[p.kind]?.plural ?? p.kind}
              </span>
              <span className="num text-foreground">finds {Math.round(p.recall * 100)} of 100</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Notice tone="warn" className="mt-3 border-t border-border pt-3 [&>div]:text-foreground">
        Rules alone miss many tricky messages, so every sort shows its reasons and a person confirms the routing. Phase 2 replaces the rules with an
        in-tenant LLM reading the shared mailbox.
      </Notice>
    </Panel>
  );
}

function shortKind(k: MessageKind): string {
  switch (k) {
    case "po":
      return "PO";
    case "pr":
      return "PR";
    case "enquiry":
      return "Enquiry";
    case "followup":
      return "Follow-up";
    case "mdm":
      return "MDM";
    default:
      return String(k);
  }
}
