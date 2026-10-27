"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, FileJson, FileSpreadsheet, FileText, FolderGit2, Lock, Workflow } from "lucide-react";
import { PageHeader, Phase2Badge } from "@/components/common";
import { useSandbox } from "@/lib/store";
import { LINKS } from "@/lib/links";
import { cn } from "@/lib/utils";
import { buildFieldMap } from "./field-map";
import { BUILDER_META, Swimlane } from "./swimlane";
import { NoteChip, SectionHeading } from "./story-ui";

type Builder = keyof typeof BUILDER_META;

interface MappingRow {
  part: string;
  prototype: string;
  href?: string;
  production: string;
  who: { b: Builder; text: string }[];
  phase2?: boolean;
}

const MAPPING: MappingRow[] = [
  {
    part: "Request form",
    prototype: "New request",
    href: "/requests/new",
    production: "Power Apps canvas app (or Microsoft Forms) in the default environment. No Dataverse or model-driven app, so no premium licence. Paste-to-fill uses rules in phase 1; an in-tenant LLM is phase 2.",
    who: [
      { b: "lean", text: "Lean team builds" },
      { b: "mdm", text: "MDM configures fields" },
    ],
  },
  {
    part: "Where requests are stored",
    prototype: "Your browser (a private sandbox per visitor)",
    production: "SharePoint List. Bank and credit fields go in a separate restricted list with item-level permissions; SharePoint has no column-level security.",
    who: [{ b: "lean", text: "Lean team" }],
  },
  {
    part: "Duplicate check",
    prototype: "Live check while typing",
    href: "/requests/new?domain=customer",
    production:
      "A nightly job writes normalised match keys to a SharePoint list through Microsoft Graph (app registration); the canvas app does a delegable key and tax-ID lookup. No premium HTTP connector.",
    who: [{ b: "outside", text: "DS contractor, ~15 days" }],
  },
  {
    part: "Routing and approvals",
    prototype: "Approvals, Teams and Outlook panels (simulated)",
    href: "/approvals",
    production: "Power Automate standard Approvals connector → Teams Adaptive Cards and Outlook actionable messages. Parallel steps, SLA, reminders.",
    who: [
      { b: "lean", text: "Lean team builds" },
      { b: "mdm", text: "MDM edits routes" },
    ],
  },
  {
    part: "Audit trail",
    prototype: "Timeline with a tamper-evident hash chain",
    href: "/mdm",
    production: "SharePoint version history + Microsoft Purview approval logs + a hash column.",
    who: [{ b: "lean", text: "Lean team" }],
  },
  {
    part: "SAP landing, phase 1",
    prototype: "Data Transfer Workbench import wizard (simulated SAP B1)",
    href: "/sap",
    production: "DTW import file, daily batch, loaded by MDM after the final check.",
    who: [{ b: "mdm", text: "MDM team, no build" }],
  },
  {
    part: "SAP landing, phase 2",
    prototype: "Service Layer payload preview, marked “not sent”",
    href: "/sap",
    production:
      "Process-licensed flow → custom connector → on-premises data gateway → Service Layer POST /b1s/v2/BusinessPartners, /Items, /ProfitCenters (PATCH to extend an existing customer).",
    who: [{ b: "outside", text: "SAP partner, ~15 days" }],
    phase2: true,
  },
  {
    part: "Regional Pulse",
    prototype: "Regional Pulse on synthetic data",
    href: "/pulse",
    production:
      "Power BI on SAP B1 extracts (ORDR/RDR1 → orders, OQUT → open requests, OCRD, OITM) + the golden-ID crosswalk. Power BI Pro for ~10 viewers (≈USD 14/user/month, approx.) only if not already owned; the pilot analytics run without it.",
    who: [
      { b: "lean", text: "Lean team analyst" },
      { b: "outside", text: "DS contractor" },
    ],
  },
  {
    part: "Forms, routes, business units",
    prototype: "Admin",
    href: "/admin",
    production: "A configuration list in SharePoint that the MDM team edits; every change is versioned.",
    who: [{ b: "mdm", text: "MDM team" }],
  },
  {
    part: "Sign-in",
    prototype: "Persona switcher",
    production: "Microsoft Entra ID single sign-on, already in place.",
    who: [{ b: "mdm", text: "Nothing to build" }],
  },
];

const FIELD_DOMAINS = [
  { id: "item", label: "New item" },
  { id: "customer", label: "New customer" },
  { id: "extend", label: "Extend a customer" },
] as const;

const SAP_LEARNING_URL =
  "https://learning.sap.com/courses/implementing-sap-business-one/implementing-the-approval-processes-in-sap-business-one";

function repoUrl(path: string, dir = false): string {
  return `${LINKS.github.replace(/\/$/, "")}/${dir ? "tree" : "blob"}/master/${path}`;
}

const KIT = [
  { path: "integrations/teams/approval-card.json", what: "Teams approval card (real Adaptive Card JSON)", icon: FileJson },
  { path: "integrations/teams/approval-card.data.json", what: "Sample data bound into the card", icon: FileJson },
  { path: "integrations/power-automate/flow-spec.md", what: "Power Automate flow specification", icon: Workflow },
  { path: "integrations/sap/dtw-templates", what: "DTW header templates for every SAP object", icon: FileSpreadsheet, dir: true },
  { path: "integrations/sap/service-layer-samples.json", what: "Service Layer request samples (phase 2)", icon: FileJson },
  { path: "integrations/sap/README.md", what: "How the import is loaded, step by step", icon: FileText },
];

export function ArchitecturePage() {
  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-12 pb-10">
      <PageHeader
        title="How it lands in SAP B1"
        subtitle="Approvals live in Microsoft 365, where people already work. SAP Business One stays the system of record. Each box is coloured by who builds it, so a company without a development team can see exactly what it takes on."
        meta={<NoteChip tone="ok">No new licences for the workflow (phase 1)</NoteChip>}
      />

      <Swimlane />

      <WhyNotSapApprovals />

      <section aria-labelledby="map-title">
        <SectionHeading
          id="map-title"
          title="Prototype → production"
          subtitle="What you click in this prototype, and what it becomes in the Microsoft 365 build."
        />
        <div className="overflow-x-auto rounded-xl border bg-card shadow-raised">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-muted/60 text-left text-[0.8125rem] text-muted-foreground">
              <tr>
                <th className="w-[15%] px-4 py-2.5 font-medium">Part</th>
                <th className="w-[22%] px-4 py-2.5 font-medium">In this prototype</th>
                <th className="px-4 py-2.5 font-medium">In production</th>
                <th className="w-[20%] px-4 py-2.5 font-medium">Who builds it</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((r) => (
                <tr key={r.part} className="border-t align-top">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.part}
                      {r.phase2 ? <Phase2Badge /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.href ? (
                      <Link href={r.href} className="inline-flex items-start gap-1 text-primary underline-offset-4 hover:underline">
                        {r.prototype}
                        <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-secondary-foreground">{r.prototype}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.production}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {r.who.map((w) => (
                        <li key={w.text} className="flex items-center gap-2 text-secondary-foreground">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: BUILDER_META[w.b].color }} />
                          {w.text}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <FieldMapSection />

      <ProductionKit />
    </div>
  );
}

function WhyNotSapApprovals() {
  return (
    <section
      aria-labelledby="why-not-title"
      className="grid gap-4 rounded-xl border border-primary/20 bg-primary-soft/50 p-5 md:grid-cols-[auto_1fr] md:items-start"
    >
      <BookOpenCheck aria-hidden className="size-7 text-primary" strokeWidth={1.75} />
      <div className="space-y-2">
        <h2 id="why-not-title" className="text-[1.0625rem] font-semibold text-foreground">
          Why not SAP&apos;s own approvals?
        </h2>
        <p className="max-w-[90ch] text-[0.9375rem] text-foreground">
          SAP B1&apos;s approval procedures are designed around documents (sales, purchasing, inventory, payments). They are
          document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. Purchase-order
          approvals can stay in SAP; master-data requests are approved in Microsoft 365, and SAP receives a clean, approved record.
        </p>
        <p className="text-xs text-muted-foreground">
          Source:{" "}
          <a href={SAP_LEARNING_URL} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            SAP Learning, “Implementing the approval processes in SAP Business One”
          </a>{" "}
          (approval processes “can be established for various sales, purchasing, inventory and payment documents”).
        </p>
      </div>
    </section>
  );
}

function FieldMapSection() {
  const domains = useSandbox((s) => s.config.domains);
  const version = useSandbox((s) => s.config.version);
  const [domainId, setDomainId] = useState<(typeof FIELD_DOMAINS)[number]["id"]>("item");
  const domain = domains.find((d) => d.id === domainId);
  const rows = useMemo(() => (domain ? buildFieldMap(domain) : []), [domain]);

  return (
    <section aria-labelledby="fields-title">
      <SectionHeading
        id="fields-title"
        title="Every form field has a home in SAP"
        subtitle="Built live from the current form configuration and the same generator that writes the import file. Add a field in Admin with an SAP property and it appears here."
        aside={<NoteChip>Config version {version}</NoteChip>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Request type">
        {FIELD_DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={domainId === d.id}
            data-testid={`arch-fields-${d.id}`}
            onClick={() => setDomainId(d.id)}
            className={cn(
              "h-8 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              domainId === d.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-secondary-foreground hover:bg-muted",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      {domainId === "extend" ? (
        <p className="mb-3 max-w-[100ch] text-sm text-secondary-foreground">
          In SAP B1 one business-partner record is shared by every entity, so extending a customer is an <strong>update</strong> of the existing
          record: the entity is added to the user-defined field U_Entities, plus any Finance-approved payment-terms or credit change. The import file is
          an update row keyed by CardCode; in phase 2 the Service Layer call is{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[0.8125rem]">PATCH /b1s/v2/BusinessPartners(&apos;C-SG-00017&apos;)</code>.{" "}
          <span className="text-muted-foreground">Assumption A28.</span>
        </p>
      ) : null}
      {!domain ? (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          This request type is switched off in Admin, so it has no SAP mapping to show.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-raised">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-[0.8125rem] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Form field</th>
                <th className="px-4 py-2.5 font-medium">SAP property (DTW / Service Layer)</th>
                <th className="px-4 py-2.5 font-medium">Import file</th>
                <th className="px-4 py-2.5 font-medium">Database column</th>
                <th className="px-4 py-2.5 text-right font-medium">Max length</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={cn("border-t align-top", r.source === "system" && "bg-muted/30")}>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                      {r.label}
                      {r.sensitive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-1.5 text-[0.6875rem] font-medium text-warn-ink">
                          <Lock aria-hidden className="size-3" /> Finance &amp; MDM only
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.source === "system" ? "Set by OneRecord" : r.required === "always" ? "Required" : r.required === "conditional" ? "Required when it applies" : "Optional"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.sapProperty ? <code className="text-[0.8125rem] text-foreground">{r.sapProperty}</code> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.dtwFile ? <code className="text-[0.8125rem] text-secondary-foreground">{r.dtwFile}</code> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.dbColumn ? (
                      <code className="text-[0.8125rem] font-medium text-primary">{r.dbColumn}</code>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.note}</span>
                    )}
                    {r.dbColumn && r.note ? <span className="block text-xs text-muted-foreground">{r.note}</span> : null}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-secondary-foreground">{r.maxLength ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Each import file has two header rows: SAP property names, then database column names. Column names follow DTW template convention for SAP B1
        10.0; confirm against the installed DTW Templates folder. Tables: OCRD business partners, CRD1 addresses, OCRB bank accounts, OITM items, ITM1
        prices, OPRC cost centres.
      </p>
    </section>
  );
}

function ProductionKit() {
  return (
    <section aria-labelledby="kit-title">
      <SectionHeading
        id="kit-title"
        title="The production kit"
        subtitle="Real artefacts in the repository, ready for the lean team to start from."
        aside={
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <FolderGit2 aria-hidden className="size-4" /> Open the repository
          </a>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {KIT.map((k) => (
          <li key={k.path}>
            <a
              href={repoUrl(k.path, k.dir)}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 shadow-raised transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <k.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{k.what}</span>
                <code className="block truncate text-xs text-muted-foreground">{k.path}</code>
              </span>
              <ArrowUpRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
