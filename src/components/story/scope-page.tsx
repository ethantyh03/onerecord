"use client";

import type React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader, Phase2Badge, RowNumber } from "@/components/common";
import { formatSgd } from "@/components/common/format";
import { cn } from "@/lib/utils";
import { computePhase2Case, BASE_VOLUME } from "./business-case";
import { BriefMap } from "./brief-map";
import { LINK, NoteChip, Panel } from "./story-ui";

interface NotInV1 {
  title: string;
  why: string;
  link?: { href: string; label: string };
}

export function ScopePage() {
  const p2 = computePhase2Case(BASE_VOLUME);
  const notInV1: NotInV1[] = [
    {
      title: "Automatic posting to SAP B1 through the Service Layer",
      why: `At ${BASE_VOLUME} requests a month it saves about ${Math.round(p2.hoursSavedPerMonth)} hours a month (${formatSgd(p2.savingSgdPerYear)} a year) against ≈${formatSgd(
        p2.licencesSgdPerYear + p2.maintenanceSgdPerYear,
        { compact: true },
      )} a year of licences and maintenance, so it does not pay back on hours (~${Math.round(p2.paybackYearsProcess)} years). The import file plus the MDM check is the right version 1; revisit at higher volume or for same-day posting.`,
      link: { href: "/impact#payback-title", label: "See the calculation" },
    },
    {
      title: "Merging or retiring existing duplicate SAP records",
      why: "That is a separate data-stewardship project. Version 1 stops new duplicates and uses a read-only golden-ID crosswalk so reports count each customer once. The handful of high-value merges Regional Pulse flags are done by hand in SAP by the MDM team; v1 doesn't automate them.",
    },
    {
      title: "A separate security model",
      why: "Single sign-on, encryption and data-loss prevention already come from Microsoft 365 and Entra ID. OneRecord adds role masking and a restricted list for bank and credit fields.",
    },
    {
      title: "A drag-and-drop workflow designer",
      why: "Form-based settings (fields, required flags, approvers, extra steps per business unit) are enough for the MDM team to change things without IT.",
      link: { href: "/admin", label: "Open Admin" },
    },
    {
      title: "Deep-learning forecasting",
      why: "Monthly data at this scale cannot support it. A seasonal model that beats the rolling average in most cells is enough.",
      link: { href: "/pulse", label: "Open Regional Pulse" },
    },
    {
      title: "Changes to existing records, apart from Extend",
      why: "Extending a customer to a new entity is the common case and is built. Other edits (address, bank details) follow once the new-record flow is trusted.",
    },
  ];

  const roadmap: { title: string; detail: string; next?: boolean }[] = [
    {
      title: "6-week Microsoft 365 pilot build",
      detail: "Canvas app + SharePoint List + Power Automate, Singapore and Malaysia, Customer and Item. The analytics rerun on SAP B1 extracts in week 1.",
      next: true,
    },
    {
      title: "Vendor bank-detail change with dual Finance control",
      detail: "Until then: call-back verification to an independently sourced number, plus a Finance Director step.",
    },
    {
      title: "Delegation chains and holiday-aware SLA clocks",
      detail: "Single-delegate out-of-office is already in v1. Next: delegation from the Entra ID manager chain, and SLA clocks that skip each country's public holidays and time zone.",
    },
    { title: "In-tenant AI for paste-to-fill and inbox sorting", detail: "An LLM inside the Microsoft tenant, reading the shared mailbox directly." },
    {
      title: "Add a whole new request type from Admin",
      detail: "The configuration already supports it; in-flight requests stay pinned to the version they started on.",
    },
    { title: "Catch records created outside the workflow", detail: "Service Layer webhooks (FP 2602 and later) flag any record keyed straight into SAP." },
    {
      title: "Regional Pulse as a scheduled Power BI report",
      detail: "After the pilot's one-off rerun: a refreshed report, tender-pipeline planning for Product C, and a pooled machine-learning forecaster once real history is loaded.",
    },
    { title: "Audit PDF export, map view, mobile, more languages", detail: "Quality-of-life items, after adoption is proven." },
  ];

  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        title="Scope & roadmap"
        subtitle="Version 1 covers how master data gets in and how the regional numbers are counted. Below: the screen that handles each problem, what version 1 leaves out and why, and the roadmap."
      />

      <BriefMap />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel titleId="not-v1-title" title="Not in version 1, and why" className="scroll-mt-24" flush>
          <ul className="divide-y divide-border" data-testid="scope-not-in-v1">
            {notInV1.map((n) => (
              <li key={n.title} className="px-4 py-3.5">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-[0.9375rem] leading-5 font-semibold text-foreground">{n.title}</h3>
                  <p className="text-sm leading-relaxed text-secondary-foreground">{n.why}</p>
                  {n.link ? (
                    <Link href={n.link.href} className={cn("inline-flex items-center gap-1 text-sm font-medium", LINK)}>
                      {n.link.label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel titleId="roadmap-title" title="Roadmap, in order" flush>
          <div data-testid="scope-roadmap">
            <RoadmapGroup label={<NoteChip tone="ok">Next</NoteChip>} items={roadmap.filter((r) => r.next)} start={1} />
            <RoadmapGroup
              label={<Phase2Badge />}
              items={roadmap.filter((r) => !r.next)}
              start={roadmap.filter((r) => r.next).length + 1}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** One phase of the roadmap: the phase label once, then numbered items as hairline-divided rows. */
function RoadmapGroup({ label, items, start }: { label: React.ReactNode; items: { title: string; detail: string }[]; start: number }) {
  if (items.length === 0) return null;
  return (
    <div className="border-border not-first:border-t">
      <div className="flex items-center gap-3 px-4 pt-3 pb-1">
        {label}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <ol start={start} className="divide-y divide-border">
        {items.map((r, i) => (
          <li key={r.title} className="flex gap-3 px-4 py-3">
            <RowNumber n={start + i} className="pt-px" />
            <div className="min-w-0">
              <h3 className="text-[0.9375rem] leading-5 font-semibold text-foreground">{r.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-secondary-foreground">{r.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
