"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderGit2, Lock } from "lucide-react";
import { PageHeader, Phase2Badge } from "@/components/common";
import { useSandbox } from "@/lib/store";
import { LINKS } from "@/lib/links";
import { cn } from "@/lib/utils";
import { buildFieldMap } from "./field-map";
import { BUILDER_META, Swimlane } from "./swimlane";
import { LINK, NoteChip, Panel, SectionHeading, T } from "./story-ui";

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

const KIT: { path: string; what: string; dir?: boolean }[] = [
  { path: "integrations/teams/approval-card.json", what: "Teams approval card (real Adaptive Card JSON)" },
  { path: "integrations/teams/approval-card.data.json", what: "Sample data bound into the card" },
  { path: "integrations/power-automate/flow-spec.md", what: "Power Automate flow specification" },
  { path: "integrations/sap/dtw-templates", what: "DTW header templates for every SAP object", dir: true },
  { path: "integrations/sap/service-layer-samples.json", what: "Service Layer request samples (phase 2)" },
  { path: "integrations/sap/README.md", what: "How the import is loaded, step by step" },
];

/** SAP B1 table codes named in the field-map footnote, set as identifiers. */
const SAP_TABLE_NOTE: [string, string][] = [
  ["OCRD", "business partners"],
  ["CRD1", "addresses"],
  ["OCRB", "bank accounts"],
  ["OITM", "items"],
  ["ITM1", "prices"],
  ["OPRC", "cost centres"],
];

export function ArchitecturePage() {
  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        title="How it lands in SAP B1"
        subtitle="Approvals live in Microsoft 365, where people already work. SAP Business One stays the system of record. Each box is coloured by who builds it, so a company without a development team can see exactly what it takes on."
        meta={<NoteChip tone="ok">No new licences for the workflow (phase 1)</NoteChip>}
      />

      <Swimlane />

      <WhyNotSapApprovals />

      <Panel
        titleId="map-title"
        title="Prototype → production"
        description="What you click in this prototype, and what it becomes in the Microsoft 365 build."
        flush
      >
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className={cn(T.table, "min-w-[960px]")}>
            <thead>
              <tr className={T.headRow}>
                <th className={cn(T.head, "w-[15%]")}>Part</th>
                <th className={cn(T.head, "w-[22%]")}>In this prototype</th>
                <th className={T.head}>In production</th>
                <th className={cn(T.head, "w-[20%]")}>Who builds it</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING.map((r) => (
                <tr key={r.part} className={T.row}>
                  <td className={cn(T.cell, "font-medium text-foreground")}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {r.part}
                      {r.phase2 ? <Phase2Badge /> : null}
                    </span>
                  </td>
                  <td className={T.cell}>
                    {r.href ? (
                      <Link href={r.href} className={cn("inline-flex items-start gap-1", LINK)}>
                        {r.prototype}
                        <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      </Link>
                    ) : (
                      <span className="text-secondary-foreground">{r.prototype}</span>
                    )}
                  </td>
                  <td className={cn(T.cell, "text-foreground")}>{r.production}</td>
                  <td className={T.cell}>
                    <ul className="space-y-1">
                      {r.who.map((w) => (
                        <li key={w.text} className="flex items-center gap-2 text-secondary-foreground">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-[1px]" style={{ background: BUILDER_META[w.b].color }} />
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
      </Panel>

      <FieldMapSection />

      <ProductionKit />
    </div>
  );
}

function WhyNotSapApprovals() {
  return (
    <section aria-labelledby="why-not-title">
      <SectionHeading id="why-not-title" title="Why not SAP's own approvals?" />
      <p className="max-w-[96ch] text-[0.9375rem] leading-relaxed text-foreground">
        SAP B1&apos;s approval procedures are designed around documents (sales, purchasing, inventory, payments). They are document-centric: no
        structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. Purchase-order approvals can stay in SAP;
        master-data requests are approved in Microsoft 365, and SAP receives a clean, approved record.
      </p>
      <p className="mt-2 max-w-[96ch] text-xs leading-5 text-muted-foreground">
        Source:{" "}
        <a href={SAP_LEARNING_URL} target="_blank" rel="noreferrer" className={LINK}>
          SAP Learning, “Implementing the approval processes in SAP Business One”
        </a>{" "}
        (approval processes “can be established for various sales, purchasing, inventory and payment documents”).
      </p>
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
    <Panel
      titleId="fields-title"
      title="Every form field has a home in SAP"
      description="Built live from the current form configuration and the same generator that writes the import file. Add a field in Admin with an SAP property and it appears here."
      action={<NoteChip>Config version {version}</NoteChip>}
      flush
      footer={
        <>
          Each import file has two header rows: SAP property names, then database column names. Column names follow DTW template convention for SAP B1
          10.0; confirm against the installed DTW Templates folder. Tables:{" "}
          {SAP_TABLE_NOTE.map(([code, what], i) => (
            <span key={code}>
              <span className="text-sm">
                <code className="mono-id text-secondary-foreground">{code}</code>
              </span>{" "}
              {what}
              {i < SAP_TABLE_NOTE.length - 1 ? ", " : "."}
            </span>
          ))}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="inline-flex gap-0.5 rounded-md border border-border bg-canvas p-0.5" role="tablist" aria-label="Request type">
          {FIELD_DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={domainId === d.id}
              data-testid={`arch-fields-${d.id}`}
              onClick={() => setDomainId(d.id)}
              className={cn(
                "h-7 rounded-sm border px-3 text-sm font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                domainId === d.id ? "border-transparent bg-secondary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      {domainId === "extend" ? (
        <p className="max-w-[110ch] border-b border-border px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
          In SAP B1 one business-partner record is shared by every entity, so extending a customer is an <strong className="text-foreground">update</strong> of
          the existing record: the entity is added to the user-defined field <code className="mono-id text-foreground">U_Entities</code>, plus any
          Finance-approved payment-terms or credit change. The import file is an update row keyed by <code className="mono-id text-foreground">CardCode</code>;
          in phase 2 the Service Layer call is{" "}
          <code className="mono-id whitespace-nowrap text-foreground">PATCH /b1s/v2/BusinessPartners(&apos;C-SG-00017&apos;)</code>
          . <span className="text-muted-foreground">Assumption A28.</span>
        </p>
      ) : null}
      {!domain ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          This request type is switched off in Admin, so it has no SAP mapping to show.
        </p>
      ) : (
        <div className="scrollbar-thin relative overflow-x-auto">
          <table className={cn(T.table, "min-w-[900px]")}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.head}>Form field</th>
                <th className={T.head}>SAP property (DTW / Service Layer)</th>
                <th className={T.head}>Import file</th>
                <th className={T.head}>Database column</th>
                <th className={cn(T.head, "text-right")}>Max length</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={T.row}>
                  <td className={cn(T.cell, "py-2")}>
                    <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                      {r.label}
                      {r.sensitive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-warn-ink">
                          <Lock aria-hidden className="size-3.5" /> Finance &amp; MDM only
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.source === "system" ? "Set by OneRecord" : r.required === "always" ? "Required" : r.required === "conditional" ? "Required when it applies" : "Optional"}
                    </span>
                  </td>
                  <td className={cn(T.cell, "py-2")}>
                    {r.sapProperty ? <code className="mono-id text-foreground">{r.sapProperty}</code> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn(T.cell, "py-2")}>
                    {r.dtwFile ? <code className="mono-id text-secondary-foreground">{r.dtwFile}</code> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn(T.cell, "py-2")}>
                    {r.dbColumn ? (
                      <code className="mono-id text-foreground">{r.dbColumn}</code>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.note}</span>
                    )}
                    {r.dbColumn && r.note ? <span className="block text-xs text-muted-foreground">{r.note}</span> : null}
                  </td>
                  <td className={cn(T.cell, "num py-2 text-right text-secondary-foreground")}>{r.maxLength ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ProductionKit() {
  return (
    <Panel
      titleId="kit-title"
      title="The production kit"
      description="Real artefacts in the repository, ready for the lean team to start from."
      action={
        <a
          href={LINKS.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-[0.8125rem] font-medium text-foreground transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <FolderGit2 aria-hidden className="size-3.5" /> Open the repository
        </a>
      }
      flush
    >
      <ul className="grid lg:grid-cols-2">
        {KIT.map((k, i) => (
          <li key={k.path} className={cn("border-border", i > 0 && "border-t", i === 1 && "lg:border-t-0", i % 2 === 1 && "lg:border-l")}>
            <a
              href={repoUrl(k.path, k.dir)}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full items-start gap-3 px-4 py-3 transition-colors outline-none hover:bg-secondary/55 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{k.what}</span>
                <span className="block truncate text-sm">
                  <code className="mono-id text-muted-foreground">{k.path}</code>
                </span>
              </span>
              <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle transition-colors group-hover:text-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
