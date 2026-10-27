"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, FilePlus2, FlaskConical, Info, TriangleAlert } from "lucide-react";
import { EmptyState, PageHeader, Phase2Badge, SyntheticBadge, formatSgtDateTime } from "@/components/common";
import { inbox, triageEval, type InboxMessage } from "@/data/contract";
import { classifyMessage } from "@/lib/engine/triage";
import type { MessageKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./story-ui";

const KINDS: MessageKind[] = ["po", "pr", "enquiry", "followup", "mdm"];

const KIND_META: Record<MessageKind, { label: string; plural: string; role: string; counted: string; chip: string; dot: string }> = {
  po: {
    label: "Purchase order",
    plural: "Purchase orders",
    role: "Demand",
    counted: "Counted as volume in Regional Pulse.",
    chip: "border-ok/35 bg-ok-soft text-ok-ink",
    dot: "var(--ok)",
  },
  pr: {
    label: "Purchase request",
    plural: "Purchase requests",
    role: "Pipeline",
    counted: "Quote accepted or intent to buy, no PO yet. Tracked as pipeline, not counted as volume.",
    chip: "border-primary/30 bg-primary-soft text-primary",
    dot: "var(--primary)",
  },
  enquiry: {
    label: "Enquiry",
    plural: "Enquiries",
    role: "Leading indicator",
    counted: "Price, stock or spec questions. Counted as a signal of demand to come.",
    chip: "border-warn/45 bg-warn-soft text-warn-ink",
    dot: "var(--warn)",
  },
  followup: {
    label: "Follow-up",
    plural: "Follow-ups",
    role: "Service",
    counted: "Delivery or invoice questions on existing orders. Excluded from demand so nothing is counted twice.",
    chip: "border-border-strong bg-secondary text-secondary-foreground",
    dot: "var(--chart-5)",
  },
  mdm: {
    label: "Master-data setup",
    plural: "Master-data setup",
    role: "Internal work, not demand",
    counted: "A new customer, item or vendor to set up. Goes into OneRecord as a request, never into the sales numbers.",
    chip: "border-dashed border-border-strong bg-card text-foreground",
    dot: "var(--muted-foreground)",
  },
};

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
    <div className="mx-auto w-full max-w-[1320px] space-y-8 pb-10">
      <PageHeader
        title="Inbound sorting"
        subtitle="Everything that lands in the shared sales mailbox, sorted into five streams with the reason for each. Customer demand and our own setup work are never mixed."
        meta={
          <>
            <SyntheticBadge label="Fictional sample messages" />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-phase2/60 bg-phase2-soft/40 px-4 py-3 text-sm">
        <Info aria-hidden className="size-4 shrink-0 text-phase2-ink" />
        <span className="font-medium text-foreground">Rules-based today; Phase 2: in-tenant LLM triage on the shared mailbox.</span>
        <Phase2Badge label="LLM triage" />
        <span className="text-muted-foreground">Every message is sorted live in your browser by transparent rules. No AI service is called.</span>
      </div>

      {/* ---------------------------------------------------------------- streams */}
      <section aria-labelledby="streams-title">
        <SectionHeading
          id="streams-title"
          title="Five streams, five different jobs"
          subtitle="Only purchase orders count as demand. The others are pipeline, early signals, service or our own internal work."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {KINDS.map((k) => {
            const m = KIND_META[k];
            return (
              <div key={k} className={cn("flex flex-col rounded-xl border bg-card p-4 shadow-raised", k === "mdm" && "border-dashed border-border-strong")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: m.dot }} />
                    {m.plural}
                  </span>
                  <span className="num text-lg font-semibold text-foreground">{counts[k]}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-primary">= {m.role}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-secondary-foreground">{m.counted}</p>
                {k === "mdm" ? (
                  <Link
                    href="/requests/new?domain=customer"
                    data-testid="triage-create-mdm"
                    className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-primary-soft/70"
                  >
                    <FilePlus2 aria-hidden className="size-4" />
                    Create MDM request
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------------------------------------------------------------- inbox */}
        <section aria-labelledby="inbox-title" className="min-w-0">
          <SectionHeading
            id="inbox-title"
            title="The mailbox, sorted"
            subtitle={
              labelled.length
                ? `On these ${labelled.length} sample messages the rules agree with a person's label on ${agree}.`
                : "Each message shows the stream it was sorted into and why."
            }
          />
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by stream">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} testId="triage-filter-all" label="All" count={classified.length} />
            {KINDS.map((k) => (
              <FilterChip
                key={k}
                active={filter === k}
                onClick={() => setFilter(k)}
                testId={`triage-filter-${k}`}
                label={KIND_META[k].plural}
                count={counts[k]}
                dot={KIND_META[k].dot}
              />
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              title={classified.length ? "No messages in this stream" : "The mailbox is empty"}
              description={classified.length ? "Pick another stream above, or show all messages." : "Sample messages appear here once the data pipeline has run."}
            />
          ) : (
            <ul className="space-y-3" data-testid="triage-list">
              {shown.map((c) => (
                <MessageRow key={c.msg.id} c={c} />
              ))}
            </ul>
          )}
        </section>

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
  dot,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-secondary-foreground hover:bg-muted",
      )}
    >
      {dot ? <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} /> : null}
      {label}
      <span className={cn("num rounded-full px-1.5 text-xs", active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{count}</span>
    </button>
  );
}

function MessageRow({ c }: { c: Classified }) {
  const meta = KIND_META[c.kind];
  const human = c.msg.humanLabel;
  const agrees = human ? human === c.kind : null;
  return (
    <li className="rounded-xl border bg-card p-4 shadow-raised" data-testid={`triage-msg-${c.msg.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold", meta.chip)}>{meta.label}</span>
            <span className="text-xs text-muted-foreground">{confidenceLabel(c.confidence)}</span>
          </div>
          <h3 className="mt-1.5 font-semibold text-foreground">{c.msg.subject}</h3>
          <p className="text-[0.8125rem] text-muted-foreground">
            {c.msg.company} ({c.msg.country}) · {formatSgtDateTime(c.msg.receivedAt)}
          </p>
        </div>
        {agrees === null ? null : agrees ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ok-ink">
            <Check aria-hidden className="size-3.5" /> Matches a person&apos;s label
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warn-ink">
            <TriangleAlert aria-hidden className="size-3.5" /> A person labelled it {KIND_META[human!].label.toLowerCase()}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-secondary-foreground">{c.msg.body}</p>
      <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Why it went here</p>
        <ul className="mt-1 space-y-0.5 text-[0.8125rem] text-foreground">
          {c.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-muted-foreground" />
              {r}
            </li>
          ))}
        </ul>
      </div>
      {c.kind === "mdm" ? (
        <Link
          href="/requests/new?domain=customer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Create MDM request from this
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      ) : null}
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
      <aside aria-labelledby="eval-title" className="rounded-xl border bg-card p-5 shadow-raised xl:sticky xl:top-4">
        <h2 id="eval-title" className="mb-3 font-semibold text-foreground">
          How well do the rules sort?
        </h2>
        <EmptyState
          size="sm"
          icon={FlaskConical}
          title="No test results yet"
          description="The accuracy check runs on a separate set of messages written independently of the rules. Run the analytics pipeline to fill it in."
        />
      </aside>
    );
  }

  const max = Math.max(1, ...e.confusion.flat());
  const pct = Math.round(e.accuracy * 100);

  return (
    <aside aria-labelledby="eval-title" className="rounded-xl border bg-card p-5 shadow-raised xl:sticky xl:top-4" data-testid="triage-eval">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="eval-title" className="font-semibold text-foreground">
          How well do the rules sort?
        </h2>
        <SyntheticBadge />
      </div>
      <p className="mt-1 text-[0.8125rem] text-muted-foreground">Tested on {e.testSetSize} messages written independently of the rules.</p>

      <div className="mt-4 flex items-end gap-4">
        <div>
          <p className="num text-[2.25rem] leading-none font-semibold tracking-[-0.02em] text-foreground">{pct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">sorted into the right stream</p>
        </div>
        <div className="pb-1 text-sm text-secondary-foreground">
          <span className="num font-semibold text-foreground">{e.macroF1.toFixed(2)}</span> average F1 across streams
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">{e.plain}</p>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Rows: what it really was · Columns: where the rules put it</p>
        <table className="w-full table-fixed border-separate border-spacing-[3px] text-center text-[0.8125rem]">
          <caption className="sr-only">Confusion matrix: actual stream by predicted stream</caption>
          <thead>
            <tr>
              <th className="w-[26%]" />
              {e.labels.map((l) => (
                <th key={l} scope="col" className="pb-1 text-[0.6875rem] font-medium text-muted-foreground">
                  {shortKind(l)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {e.labels.map((actual, r) => (
              <tr key={actual}>
                <th scope="row" className="pr-1 text-left text-[0.6875rem] font-medium text-muted-foreground">
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
                      className={cn("num h-9 rounded-[4px] font-medium", diag ? "font-semibold" : "", v === 0 && "text-muted-foreground/60")}
                      style={{
                        background: v === 0 ? "var(--muted)" : `color-mix(in oklch, ${diag ? "var(--primary)" : "var(--stuck)"} ${Math.round(14 + share * 66)}%, var(--card))`,
                        color: v > 0 && share > 0.55 ? "var(--primary-foreground)" : undefined,
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
            <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: "var(--primary)" }} /> Right stream
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: "var(--stuck)" }} /> Wrong stream
          </span>
        </p>
      </div>

      {Array.isArray(e.perClass) && e.perClass.length ? (
        <ul className="mt-4 space-y-1 border-t pt-3 text-[0.8125rem]">
          {e.perClass.map((p) => (
            <li key={p.kind} className="flex justify-between gap-3">
              <span className="text-secondary-foreground">{KIND_META[p.kind]?.plural ?? p.kind}</span>
              <span className="num text-foreground">
                finds {Math.round(p.recall * 100)} of 100
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 rounded-lg bg-warn-soft/70 px-3 py-2 text-[0.8125rem] text-foreground">
        Rules alone miss many tricky messages, so every sort shows its reasons and a person confirms the routing. Phase 2 replaces the rules with an
        in-tenant LLM reading the shared mailbox.
      </p>
    </aside>
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
