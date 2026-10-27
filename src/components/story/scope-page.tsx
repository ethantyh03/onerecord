"use client";

import Link from "next/link";
import { ArrowUpRight, CircleSlash2 } from "lucide-react";
import { PageHeader, Phase2Badge } from "@/components/common";
import { formatSgd } from "@/components/common/format";
import { computePhase2Case, BASE_VOLUME } from "./business-case";
import { NoteChip, SectionHeading } from "./story-ui";

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
      why: "That is a separate data-stewardship project. Version 1 stops new duplicates and uses a read-only golden-ID crosswalk so reports count each customer once.",
    },
    {
      title: "A security model of our own",
      why: "Single sign-on, encryption and data-loss prevention already come from Microsoft 365 and Entra ID. We add role masking and a restricted list for bank and credit fields.",
    },
    {
      title: "A drag-and-drop workflow designer",
      why: "Form-based settings (fields, required flags, approvers, extra steps per business unit) are enough for the MDM team to change things without IT.",
      link: { href: "/admin", label: "Open Admin" },
    },
    {
      title: "Deep-learning forecasting",
      why: "It cannot be justified on monthly data at this scale. A seasonal model that beats today's rolling average, and admits where it doesn't, is more useful.",
      link: { href: "/pulse", label: "Open Regional Pulse" },
    },
    {
      title: "Changes to existing records, apart from Extend",
      why: "Extending a customer to a new entity is the common case and is built. Other edits (address, bank details) follow once the new-record flow is trusted.",
    },
  ];

  const roadmap: { title: string; detail: string }[] = [
    { title: "6-week Microsoft 365 pilot build", detail: "Canvas app + SharePoint List + Power Automate, Singapore and Malaysia, Customer and Item." },
    {
      title: "Vendor bank-detail change with dual Finance control",
      detail: "Until then: call-back verification to an independently sourced number, plus a Finance Director step.",
    },
    { title: "Delegation and out-of-office", detail: "Plus SLA calendars per country time zone and public holidays." },
    { title: "In-tenant AI for paste-to-fill and inbox sorting", detail: "An LLM inside the Microsoft tenant, reading the shared mailbox directly." },
    {
      title: "Add a whole new request type from Admin",
      detail: "The configuration already supports it; in-flight requests stay pinned to the version they started on.",
    },
    { title: "Catch records created outside the workflow", detail: "Service Layer webhooks (FP 2602 and later) flag any record keyed straight into SAP." },
    {
      title: "Regional Pulse in Power BI on real SAP B1 extracts",
      detail: "Tender-pipeline planning for Product C; a pooled machine-learning forecaster once real history is loaded.",
    },
    { title: "Audit PDF export, map view, mobile, more languages", detail: "Quality-of-life items, after adoption is proven." },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-8 pb-10">
      <PageHeader
        title="What we left out, on purpose"
        subtitle="Version 1 fixes how master data gets in and makes the regional numbers trustworthy. Everything below was a choice, not a time cut, and comes with the reason."
        meta={<NoteChip tone="brand">Answers the brief&apos;s “what you will not build”</NoteChip>}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="not-v1-title">
          <SectionHeading id="not-v1-title" title="Deliberately not in v1, and why" />
          <ul className="space-y-3" data-testid="scope-not-in-v1">
            {notInV1.map((n) => (
              <li key={n.title} className="flex gap-3 rounded-xl border bg-card p-4 shadow-raised">
                <CircleSlash2 aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-semibold text-foreground">{n.title}</h3>
                  <p className="text-sm text-secondary-foreground">{n.why}</p>
                  {n.link ? (
                    <Link href={n.link.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                      {n.link.label}
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="roadmap-title">
          <SectionHeading id="roadmap-title" title="Roadmap, in order" aside={<Phase2Badge label="not built" />} />
          <ol className="relative space-y-0" data-testid="scope-roadmap">
            {roadmap.map((r, i) => (
              <li key={r.title} className="relative grid grid-cols-[2.25rem_1fr] gap-3 pb-5 last:pb-0">
                {i < roadmap.length - 1 ? (
                  <span aria-hidden className="absolute top-9 bottom-0 left-[1.0625rem] w-px border-l border-dashed border-phase2/60" />
                ) : null}
                <span className="num relative z-10 inline-flex size-9 items-center justify-center rounded-full border border-dashed border-phase2 bg-phase2-soft text-sm font-semibold text-phase2-ink">
                  {i + 1}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-semibold text-foreground">{r.title}</h3>
                  <p className="text-sm text-secondary-foreground">{r.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
