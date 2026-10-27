"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./story-ui";

interface Row {
  brief: string;
  answer: string;
  links: { href: string; label: string }[];
}

/** Brief §4 pain points, in the brief's own order and groupings. */
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
        brief: "Duplicates like “National University Hospital” under a slightly different name",
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
        answer: "A seasonal forecast tested against today's rolling average (and shown where it loses), plus drop-off and cross-sell signals",
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

/** Brief §5 design prompts. */
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
    answer: "Seasonal forecast, honest backtest, drop-off and cross-sell signals",
    links: [{ href: "/pulse", label: "Regional Pulse" }],
  },
  {
    brief: "What you would deliberately not build first",
    answer: "Six choices, each with its reason, below",
    links: [{ href: "#not-v1-title", label: "Not in v1" }],
  },
];

/** Brief Appendix B personas. */
const PERSONAS: Row[] = [
  {
    brief: "Amy, Product Manager: guesses SAP fields she isn't sure of",
    answer: "Paste an old email and the form fills itself; the regulatory rule asks the question for her",
    links: [{ href: "/requests/new", label: "New request" }],
  },
  {
    brief: "Wei Jie, Finance Manager: doesn't see requests in his inbox",
    answer: "A Teams card he can approve in place, with a reminder",
    links: [{ href: "/approvals", label: "Approvals" }],
  },
  {
    brief: "Priya, MDM Analyst: keys every record by hand; catches duplicates only from memory",
    answer: "The duplicate check remembers for her; approved records go out as one SAP import file",
    links: [
      { href: "/mdm", label: "MDM console" },
      { href: "/sap", label: "SAP B1" },
    ],
  },
  {
    brief: "Marcus, new business unit: his first requests went to the wrong people",
    answer: "MDM adds his business unit and routes in Admin; the duplicate check catches his near-copy",
    links: [{ href: "/admin", label: "Admin" }],
  },
];

function RouteLinks({ links }: { links: Row["links"] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5">
      {links.map((l) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          className="inline-flex items-center gap-0.5 font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
        >
          {l.label}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      ))}
    </span>
  );
}

function MiniTable({ title, rows, briefHead }: { title: string; rows: Row[]; briefHead: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-raised">
      <p className="border-b bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground">{title}</p>
      <table className="w-full text-[0.8125rem]">
        <thead className="sr-only">
          <tr>
            <th>{briefHead}</th>
            <th>Where OneRecord answers it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.brief} className="border-t align-top first:border-t-0">
              <td className="w-[44%] px-4 py-2.5 text-secondary-foreground">{r.brief}</td>
              <td className="px-4 py-2.5 text-foreground">
                {r.answer}
                <span className="mt-1 block">
                  <RouteLinks links={r.links} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "What the brief asked → where OneRecord answers it": §4 pain points, §5 prompts and Appendix B personas, each linked to its screen. */
export function BriefMap() {
  return (
    <section aria-labelledby="brief-map-title" data-testid="scope-brief-map">
      <SectionHeading
        id="brief-map-title"
        title="What the brief asked → where OneRecord answers it"
        subtitle="Every pain point in Section 4, every design prompt in Section 5 and every Appendix B persona, with the screen that answers it."
      />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-raised">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/60 text-left text-[0.8125rem] text-muted-foreground">
            <tr>
              <th className="w-[16%] px-4 py-2.5 font-medium">Brief, Section 4</th>
              <th className="w-[30%] px-4 py-2.5 font-medium">Pain point</th>
              <th className="px-4 py-2.5 font-medium">What OneRecord does</th>
              <th className="w-[17%] px-4 py-2.5 font-medium">See it</th>
            </tr>
          </thead>
          <tbody>
            {PAIN_POINTS.flatMap((g) =>
              g.rows.map((r, i) => (
                <tr key={r.brief} className="border-t align-top">
                  {i === 0 ? (
                    <th scope="row" rowSpan={g.rows.length} className="px-4 py-2.5 text-left font-semibold text-foreground">
                      {g.group}
                    </th>
                  ) : null}
                  <td className="px-4 py-2.5 text-secondary-foreground">{r.brief}</td>
                  <td className="px-4 py-2.5 text-foreground">{r.answer}</td>
                  <td className="px-4 py-2.5">
                    <RouteLinks links={r.links} />
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MiniTable title="Section 5 design prompts" briefHead="Design prompt" rows={PROMPTS} />
        <MiniTable title="Appendix B personas" briefHead="Persona" rows={PERSONAS} />
      </div>
    </section>
  );
}
