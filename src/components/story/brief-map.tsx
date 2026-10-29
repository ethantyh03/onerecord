"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LINK, Panel, T } from "./story-ui";

interface Row {
  brief: string;
  answer: string;
  links: { href: string; label: string }[];
}

/** Problems with today's email process, grouped by area. */
const PAIN_POINTS: { group: string; rows: Row[] }[] = [
  {
    group: "Data quality",
    rows: [
      {
        brief: "No standard intake form; incomplete requests bounce by email",
        answer: "One form per request type; it cannot be submitted until the required fields, and the regulatory rule for IVD items, are filled",
        links: [{ href: "/requests/new", label: "New request" }],
      },
      {
        brief: "The same customer created again under a slightly different name",
        answer: "Duplicate check while you type (name and tax ID); MDM sees the match again at the final check",
        links: [{ href: "/requests/new?domain=customer", label: "New customer" }],
      },
    ],
  },
  {
    group: "Speed and visibility",
    rows: [
      {
        brief: "Requestors can only ask for status; approvers don't know a request is waiting",
        answer: "A tracker with the expected live date; approvals arrive as Teams and Outlook cards with reminders",
        links: [
          { href: "/requests", label: "My requests" },
          { href: "/approvals", label: "Approvals" },
        ],
      },
      {
        brief: "Five approvals take two to three weeks even when each approver is fast",
        answer: "Approvers sign in parallel, with a 2-business-day clock, a reminder at day 1 and escalation to a delegate at day 3",
        links: [
          { href: "/approvals", label: "Approvals" },
          { href: "/impact", label: "Where the days go" },
        ],
      },
    ],
  },
  {
    group: "Governance and audit",
    rows: [
      {
        brief: "No reliable record of who approved what, or when",
        answer: "Every step lands in an append-only timeline with a tamper-evident hash chain",
        links: [{ href: "/mdm", label: "MDM console" }],
      },
      {
        brief: "Bank details and credit terms travel through ordinary email",
        answer: "Sensitive fields are masked by role and never travel on the approval card",
        links: [{ href: "/mdm", label: "MDM console" }],
      },
    ],
  },
  {
    group: "Flexibility",
    rows: [
      {
        brief: "A new business unit, field or approval step means redrafting templates and lists",
        answer: "MDM adds the business unit, its approvers, an extra step or a required field in Admin; every change is versioned",
        links: [{ href: "/admin", label: "Admin" }],
      },
    ],
  },
  {
    group: "Forecasting and commercial growth",
    rows: [
      {
        brief: "Forecasts are compiled by hand from simple averages, missing cross-sell, seasonality and drop-off",
        answer: "A seasonal forecast backtested against today's rolling average, plus drop-off and cross-sell signals",
        links: [{ href: "/pulse", label: "Regional Pulse" }],
      },
      {
        brief: "Duplicate records across SPD, QTS and QTG block a clean regional view",
        answer: "Each customer counted once through a golden-ID crosswalk, with a toggle to see what the duplicates hide",
        links: [{ href: "/pulse", label: "Regional Pulse" }],
      },
    ],
  },
];

/** Requirements. */
const PROMPTS: Row[] = [
  {
    brief: "Submit Customer, Item, Vendor or Cost Center requests; stop incomplete and duplicate ones",
    answer: "Configurable forms, completeness gate, live duplicate check",
    links: [{ href: "/requests/new", label: "New request" }],
  },
  {
    brief: "Tell real purchase requests and orders apart from enquiries and follow-ups",
    answer: "Mailbox sorted into five streams, with the reason for each",
    links: [{ href: "/triage", label: "Inbox triage" }],
  },
  {
    brief: "Faster approvals; everyone knows where a request stands",
    answer: "Parallel approvals in Teams with a clock; a live tracker",
    links: [
      { href: "/approvals", label: "Approvals" },
      { href: "/requests", label: "My requests" },
    ],
  },
  {
    brief: "A trustworthy approval record; protected sensitive fields",
    answer: "Audit timeline with hash chain; role masking",
    links: [{ href: "/mdm", label: "MDM console" }],
  },
  {
    brief: "Add a domain, field or approval step without IT",
    answer: "Fields, steps and business units in Admin; a whole new request type is on the roadmap",
    links: [{ href: "/admin", label: "Admin" }],
  },
  {
    brief: "Use data science to improve the 6–12-month forecast and find growth",
    answer: "Seasonal forecast, backtest, drop-off and cross-sell signals",
    links: [{ href: "/pulse", label: "Regional Pulse" }],
  },
  {
    brief: "What version 1 leaves out",
    answer: "Six items, each with its reason, below",
    links: [{ href: "#not-v1-title", label: "Not in version 1" }],
  },
];

/** User roles. */
const PERSONAS: Row[] = [
  {
    brief: "Requestor (product manager): unsure of some SAP fields",
    answer: "Paste an old email and the form fills itself; the regulatory rule asks the right question",
    links: [{ href: "/requests/new", label: "New request" }],
  },
  {
    brief: "Finance approver: misses requests in the inbox",
    answer: "A Teams card to approve in place, with a reminder",
    links: [{ href: "/approvals", label: "Approvals" }],
  },
  {
    brief: "MDM analyst: keys records by hand, spots duplicates from memory",
    answer: "The duplicate check does the remembering; approved records go out as one SAP import file",
    links: [
      { href: "/mdm", label: "MDM console" },
      { href: "/sap", label: "SAP B1" },
    ],
  },
  {
    brief: "New business unit: requests routed to the wrong people",
    answer: "MDM adds the business unit and its routes in Admin; the duplicate check catches near-copies",
    links: [{ href: "/admin", label: "Admin" }],
  },
];

function RouteLinks({ links }: { links: Row["links"] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {links.map((l) => (
        <Link key={l.href + l.label} href={l.href} className={cn("inline-flex items-center gap-0.5 font-medium whitespace-nowrap", LINK)}>
          {l.label}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      ))}
    </span>
  );
}

function MiniTable({ title, rows, briefHead }: { title: string; rows: Row[]; briefHead: string }) {
  return (
    <Panel title={title} level={3} flush>
      <table className={T.table}>
        <thead className="sr-only">
          <tr>
            <th>{briefHead}</th>
            <th>Where OneRecord covers it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.brief} className={T.row}>
              <td className={cn(T.cell, "w-[44%] text-secondary-foreground")}>{r.brief}</td>
              <td className={cn(T.cell, "text-foreground")}>
                {r.answer}
                <span className="mt-1 block">
                  <RouteLinks links={r.links} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** "What version 1 covers": problems, requirements and user roles, each linked to its screen. */
export function BriefMap() {
  return (
    <section aria-labelledby="brief-map-title" data-testid="scope-brief-map" className="space-y-4">
      <Panel
        as="div"
        titleId="brief-map-title"
        title="What version 1 covers"
        description="Each problem, and the screen that handles it."
        flush
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className={cn(T.table, "min-w-[860px]")}>
            <thead>
              <tr className={T.headRow}>
                <th className={cn(T.head, "w-[16%]")}>Area</th>
                <th className={cn(T.head, "w-[30%]")}>Problem today</th>
                <th className={T.head}>What OneRecord does</th>
                <th className={cn(T.head, "w-[17%]")}>See it</th>
              </tr>
            </thead>
            <tbody>
              {PAIN_POINTS.flatMap((g) =>
                g.rows.map((r, i) => (
                  <tr key={r.brief} className={cn("border-border", i === 0 ? "border-t first:border-t-0" : "border-t border-border/60")}>
                    {i === 0 ? (
                      <th scope="row" rowSpan={g.rows.length} className={cn(T.cell, "border-r border-border text-left font-semibold text-foreground")}>
                        {g.group}
                      </th>
                    ) : null}
                    <td className={cn(T.cell, "text-secondary-foreground")}>{r.brief}</td>
                    <td className={cn(T.cell, "text-foreground")}>{r.answer}</td>
                    <td className={T.cell}>
                      <RouteLinks links={r.links} />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MiniTable title="Requirements" briefHead="Requirement" rows={PROMPTS} />
        <MiniTable title="User roles" briefHead="Role" rows={PERSONAS} />
      </div>
    </section>
  );
}
