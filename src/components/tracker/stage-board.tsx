"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Database, MessageCircleQuestion } from "lucide-react";
import type { MdmRequest } from "@/lib/types";
import { useSandbox } from "@/lib/store";
import { personById } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import {
  PersonAvatar,
  SapCode,
  SlaChip,
  StatusBadge,
  formatDays,
  formatSgd,
  formatSgtDateTime,
} from "@/components/common";
import {
  BOARD_COLUMNS,
  activeSteps,
  boardColumnOf,
  boardSortKey,
  countryName,
  demandFor,
  requestAgeBusinessDays,
  stageProgress,
  worstActiveStep,
  type BoardColumn,
  type BoardColumnId,
  type LinkedDemand,
  type StageProgress,
} from "./tracker-utils";

/** Closed columns grow long (31 records created in the seed); the latest few show, the rest on request. */
const CLOSED_PREVIEW = 6;

/** Stage meter: grey behind, bright for the current stage; colour only for a paused or stopped stage. */
const METER: Record<StageProgress, string> = {
  done: "bg-muted-foreground/70",
  active: "bg-foreground",
  paused: "bg-warn",
  failed: "bg-stuck",
  upcoming: "bg-border-strong",
};

/** Route meter: one segment per approval stage plus the MDM final check. */
function RouteMeter({ req }: { req: MdmRequest }) {
  const segs = stageProgress(req);
  if (segs.length === 0) return null;
  const at = segs.findIndex((s) => s.state !== "done");
  const current = at === -1 ? segs.length : at + 1;
  const label = `Stage ${Math.min(current, segs.length)} of ${segs.length}${at === -1 ? "" : `: ${segs[at].label}`}`;
  return (
    <span className="flex w-16 shrink-0 gap-0.5" role="img" aria-label={label} title={label}>
      {segs.map((s, i) => (
        <span key={i} className={cn("h-1 min-w-0 flex-1", METER[s.state])} />
      ))}
    </span>
  );
}

function WaitingOn({ req }: { req: MdmRequest }) {
  const config = useSandbox((s) => s.config);
  const view = { config };
  const active = activeSteps(req);

  const question = active.find((s) => s.status === "question");
  // Ready for SAP B1: the import file exists and MDM loads it next, so say that instead of repeating the stage name.
  const stageLabel: ReactNode = req.dtwGeneratedAt ? (
    <span className="flex items-center gap-1" title={`SAP B1 import file (DTW) generated ${formatSgtDateTime(req.dtwGeneratedAt)}`}>
      <Database aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">SAP B1 import file (DTW) generated</span>
    </span>
  ) : question ? (
    `${question.stageLabel} · question asked`
  ) : (
    (active[0]?.stageLabel ?? "—")
  );
  let who: ReactNode;
  if (question) {
    const requestor = personById(view, req.requestorId);
    who = (
      <>
        <MessageCircleQuestion aria-hidden className="size-4 shrink-0 text-warn-ink" />
        <span className="truncate">Answer from {requestor?.name ?? "requestor"}</span>
      </>
    );
  } else {
    const people = active.map((s) => personById(view, s.assigneeId));
    who = (
      <>
        {/* A light overlap only: each pair of initials stays readable (PS DO SR, not "P( D( SR"). */}
        <span className="flex shrink-0 -space-x-0.5">
          {people.slice(0, 3).map((p, i) => (
            <PersonAvatar key={i} person={p} size="xs" className="ring-2 ring-card" />
          ))}
        </span>
        <span className="truncate">
          {people.length === 1 ? (people[0]?.name ?? "Unassigned") : `${people.length} approvers in parallel`}
        </span>
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{stageLabel}</div>
        <RouteMeter req={req} />
      </div>
      <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-foreground">{who}</p>
    </div>
  );
}

function BoardCard({ req, now, demand }: { req: MdmRequest; now: string; demand: LinkedDemand }) {
  const col = boardColumnOf(req);
  const inFlight = col === "approval" || col === "mdm" || col === "ready";
  const age = requestAgeBusinessDays(req, now);
  const worst = inFlight ? worstActiveStep(req, now) : undefined;
  const href = `/requests/view?id=${encodeURIComponent(req.id)}`;

  return (
    <li>
      <article
        data-testid={`board-card-${req.id}`}
        data-status={req.status}
        className={cn(
          "group/card relative flex flex-col gap-2 overflow-hidden rounded-md border border-border bg-card px-3 pt-2.5 pb-2.5 transition-colors",
          "hover:border-border-strong has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring",
        )}
      >

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm">
            <SapCode code={req.id} variant="plain" className="text-muted-foreground" />
          </span>
          <span className="truncate text-xs text-muted-foreground" title={`${req.entity} · ${countryName(req.country)}`}>
            {req.entity} · {req.country}
          </span>
        </div>

        <h3 className="text-sm leading-snug font-medium text-foreground">
          <Link
            href={href}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:content-[''] group-hover/card:underline group-hover/card:decoration-border-strong group-hover/card:underline-offset-4"
          >
            {req.title}
          </Link>
        </h3>

        {inFlight ? <WaitingOn req={req} /> : null}

        {/* Footer: the state in words (SLA reading or SAP code), the age, then the money. No rail, no chip. */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {inFlight ? (
            worst ? (
              <span className="relative z-10">
                <SlaChip step={worst} />
              </span>
            ) : null
          ) : col === "created" ? (
            <SapCode code={req.sapCode} className="text-xs text-foreground" />
          ) : (
            <StatusBadge status={req.status} size="sm" />
          )}
          {age !== null ? (
            <span className="num text-xs text-subtle" title="Business days since submission">
              {formatDays(age)} d
            </span>
          ) : null}
          <span className="ml-auto">
            {demand.blockedCount ? (
              <span className="num text-[0.8125rem] font-semibold text-stuck-ink" title={`${demand.blockedCount} purchase request(s) blocked`}>
                {formatSgd(demand.blockedSgd)}
              </span>
            ) : demand.releasedCount ? (
              <span className="num text-xs text-ok-ink" title="Released when the record went live">
                {formatSgd(demand.releasedSgd)} released
              </span>
            ) : null}
          </span>
        </div>
      </article>
    </li>
  );
}

function Column({
  column,
  items,
  now,
  demandMap,
  next,
}: {
  column: BoardColumn;
  items: MdmRequest[];
  now: string;
  demandMap: Map<string, LinkedDemand>;
  next: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const capped = column.id === "created" && !expanded && items.length > CLOSED_PREVIEW + 1;
  const shown = capped ? items.slice(0, CLOSED_PREVIEW) : items;
  const headingId = `board-col-${column.id}-h`;

  return (
    <section aria-labelledby={headingId} data-testid={`board-col-${column.id}`} className="flex min-w-0 flex-col">
      <header className="relative flex h-10 items-center gap-2 border-b border-border px-3" title={column.hint}>
        <h2 id={headingId} className="font-wide truncate text-[0.8125rem] font-semibold text-foreground">
          {column.label}
        </h2>
        <span
          className={cn("num text-sm", items.length ? "text-muted-foreground" : "text-subtle")}
          aria-label={`${items.length} request${items.length === 1 ? "" : "s"}`}
        >
          {items.length}
        </span>
        {next ? (
          // Flow marker on the lane divider (requests move left to right): a bare chevron that breaks the rule. No box.
          <span
            aria-hidden
            className="absolute top-1/2 -right-2 z-10 inline-flex h-5 w-4 -translate-y-1/2 items-center justify-center bg-canvas text-subtle"
          >
            <ChevronRight className="size-3.5" strokeWidth={2.25} />
          </span>
        ) : null}
      </header>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-subtle">Nothing at this stage</p>
      ) : (
        <ol className="flex flex-col gap-2 p-2" aria-label={column.label}>
          {shown.map((r) => (
            <BoardCard key={r.id} req={r} now={now} demand={demandFor(demandMap, r.id)} />
          ))}
        </ol>
      )}
      {column.id === "created" && items.length > CLOSED_PREVIEW + 1 ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mx-3 mb-2.5 self-start rounded-sm py-1 text-left text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          aria-expanded={expanded}
          data-testid="board-created-more"
        >
          {expanded ? "Show the latest only" : `Show all ${items.length}`}
        </button>
      ) : null}
    </section>
  );
}

/** Requests outside the pipeline: private drafts and requests stopped before SAP B1. */
function OffPipeline({ groups }: { groups: { column: BoardColumn; items: MdmRequest[] }[] }) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 border-t border-border px-4 py-3 lg:flex-row lg:gap-12" data-testid="board-off-pipeline">
      {shown.map(({ column, items }) => (
        <section key={column.id} aria-labelledby={`board-off-${column.id}`} className="min-w-0" data-testid={`board-col-${column.id}`}>
          <h2 id={`board-off-${column.id}`} className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground" title={column.hint}>
            <span className="font-medium text-secondary-foreground">{column.label}</span>
            <span className="num">{items.length}</span>
            <span className="text-subtle">· {column.hint}</span>
          </h2>
          {/* Plain rows (ID, title, status in words), not chips: these requests are off the board. */}
          <ul className="flex flex-col">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/view?id=${encodeURIComponent(r.id)}`}
                  data-testid={`board-card-${r.id}`}
                  data-status={r.status}
                  className="group/off -mx-1.5 flex max-w-[34rem] items-center gap-2.5 rounded-sm px-1.5 py-1 text-sm transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <SapCode code={r.id} variant="plain" className="text-muted-foreground" />
                  <span className="min-w-0 truncate text-foreground underline-offset-4 group-hover/off:underline group-hover/off:decoration-border-strong">
                    {r.title}
                  </span>
                  <StatusBadge status={r.status} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The stage board: every request as a card in the pipeline column it is in now (in approval → MDM final check →
 * ready for SAP B1 → created in SAP B1). Columns come from the request status and the DTW timestamp, so a card moves
 * the moment an approver decides or MDM generates the import.
 */
export function StageBoard({ rows, now, demandMap }: { rows: MdmRequest[]; now: string; demandMap: Map<string, LinkedDemand> }) {
  const by = new Map<BoardColumnId, MdmRequest[]>();
  for (const c of BOARD_COLUMNS) by.set(c.id, []);
  for (const r of rows) by.get(boardColumnOf(r))!.push(r);
  for (const list of by.values()) list.sort((a, b) => boardSortKey(a, now) - boardSortKey(b, now) || a.id.localeCompare(b.id));

  const pipeline = BOARD_COLUMNS.filter((c) => c.pipeline);
  const off = BOARD_COLUMNS.filter((c) => !c.pipeline).map((column) => ({ column, items: by.get(column.id)! }));

  return (
    <div data-testid="requests-board">
      <div className="overflow-x-auto bg-canvas scrollbar-thin">
        <div className="grid min-w-[52rem] grid-cols-4 divide-x divide-border">
          {pipeline.map((c, i) => (
            <Column key={c.id} column={c} items={by.get(c.id)!} now={now} demandMap={demandMap} next={i < pipeline.length - 1} />
          ))}
        </div>
      </div>
      <OffPipeline groups={off} />
    </div>
  );
}
