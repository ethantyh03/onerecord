import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Code, Figure, Glyph, Headline, ReadoutRow, SlideFrame, type SlideProps } from "../primitives";

/** Backup slides for Q&A (deck content doc §7). Denser than the main flow; still ≥ 22 px. */

const H = 52;

function Rows({ rows, cols, top = 268 }: { rows: { k: ReactNode; v: ReactNode }[]; cols: string; top?: number }) {
  return (
    <dl className="absolute left-[112px] w-[1696px] border-t border-border-strong" style={{ top }}>
      {rows.map((r, i) => (
        <div key={i} className={cn("grid items-baseline gap-x-[48px] border-b border-border py-[22px]", cols)}>
          <dt className="font-semibold text-foreground" style={{ fontSize: 28, lineHeight: 1.15, fontStretch: "108%" }}>
            {r.k}
          </dt>
          <dd className="text-[25px] leading-[34px] text-secondary-foreground">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- A1

type Mark = "y" | "p" | "n" | "na";
const MARK: Record<Mark, { ch: string; sr: string; cls: string }> = {
  y: { ch: "✓", sr: "yes", cls: "text-foreground" },
  p: { ch: "~", sr: "partly", cls: "text-muted-foreground" },
  n: { ch: "✗", sr: "no", cls: "text-subtle" },
  na: { ch: "—", sr: "not applicable", cls: "text-subtle" },
};

const OPTIONS: { name: string; cost: string; marks: Mark[]; note?: string; ours?: boolean }[] = [
  { name: "Better email template + shared tracker", cost: "~S$0", marks: ["p", "n", "n", "y", "n"] },
  { name: "SAP B1 approval procedures", cost: "S$0", marks: ["n", "n", "na", "na", "n"] },
  { name: "Teams Approvals only", cost: "~S$0", marks: ["p", "n", "y", "y", "n"] },
  { name: "Power Apps + SharePoint + Power Automate only", cost: "~S$30k", marks: ["y", "p", "y", "y", "n"], note: "exact match only" },
  { name: "Buy an MDM suite / B1 add-on", cost: "High (not verified) + IT", marks: ["y", "y", "y", "p", "p"] },
  { name: "OneRecord", cost: "~S$40k, no new licences for the workflow", marks: ["y", "y", "y", "y", "y"], ours: true },
];

export function A1Alternatives({ position }: SlideProps) {
  const cols = "grid grid-cols-[540px_400px_repeat(5,1fr)] gap-x-[20px]";
  return (
    <SlideFrame
      position={position}
      label="SAP B1 approval procedures cover sales, purchasing, inventory and payment documents (SAP Learning, “Implementing the approval processes in SAP Business One”)."
    >
      <Headline size={H}>
        SAP Business One&apos;s built-in approvals are document-centric, and the simpler options fix only half the problem.
      </Headline>
      <div className="absolute top-[262px] left-[112px] w-[1696px]">
        <div className={cn(cols, "items-end border-b border-border-strong px-5 pb-3 text-[19px] leading-[23px] text-subtle")}>
          <span>Option</span>
          <span>One-off</span>
          <span>Stops incomplete</span>
          <span>Stops duplicates</span>
          <span>Fast + visible approvals</span>
          <span>MDM changes it without IT</span>
          <span>Regional analytics</span>
        </div>
        {OPTIONS.map((o) => (
          <div
            key={o.name}
            className={cn(cols, "items-center border-b border-border px-5 py-[17px]", o.ours && "bg-secondary")}
          >
            <span className={cn("text-[25px] leading-[31px]", o.ours ? "font-semibold text-foreground" : "text-foreground")}>{o.name}</span>
            <span className={cn("num text-[23px] leading-[29px]", o.ours ? "font-semibold text-foreground" : "text-secondary-foreground")}>
              {o.cost}
            </span>
            {o.marks.map((m, i) => (
              <span key={i} className={cn("text-[30px] leading-none", MARK[m].cls)}>
                <span aria-hidden>{MARK[m].ch}</span>
                <span className="sr-only">{MARK[m].sr}</span>
                {o.note && i === 1 ? <span className="ml-2 align-middle text-[18px] text-muted-foreground">{o.note}</span> : null}
              </span>
            ))}
          </div>
        ))}
        <p className="mt-5 text-[20px] text-subtle">✓ yes · ~ partly · ✗ no · — not applicable</p>
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A2

const PARTS: [string, string, string, string][] = [
  ["Request form", "Power Apps canvas app, default environment, no Dataverse", "Existing Microsoft 365", "Lean team; MDM configures fields"],
  ["Store", "SharePoint list, plus a restricted list for bank and credit fields", "Existing", "Lean team"],
  ["Routing + approvals", "Power Automate, standard Approvals connector → Teams cards / Outlook", "Standard connector", "Lean team; MDM edits routes"],
  ["Duplicate check", "Nightly job writes match keys to a SharePoint list; the form looks them up", "Existing", "Contractor, ~15 days"],
  ["Audit", "SharePoint version history + Purview logs + a hash column", "Existing", "Lean team"],
  ["Landing in SAP B1", "Import file via SAP's Data Transfer Workbench, loaded daily", "S$0, ships with SAP B1", "MDM team, no build"],
  [
    "Regional Pulse",
    "Power BI on SAP B1 extracts",
    "Power BI Pro for ~10 viewers (≈USD 14/user/month, approx.), only if not already owned",
    "Lean team analyst",
  ],
  [
    "Phase 2 posting",
    "Process licence + 1 Premium maker → Service Layer",
    "≤ USD 1,980 a year (≈S$2,633); pay-as-you-go is cheaper below ~250 runs a month",
    "SAP partner, ~15 days",
  ],
];

export function A2WhoBuilds({ position }: SlideProps) {
  const cols = "grid grid-cols-[250px_620px_470px_1fr] gap-x-[28px]";
  return (
    <SlideFrame
      position={position}
      label="This web app is the demo vehicle. The repo ships the production kit: Teams card JSON, the flow spec, import templates and the SharePoint schema."
    >
      <Headline size={H}>
        Phase 1 is configuration on Microsoft 365, built by a lean team of two, with no new licences for the workflow.
      </Headline>
      <div className="absolute top-[262px] left-[112px] w-[1696px]">
        <div className={cn(cols, "border-b border-border-strong pb-3 text-[19px] leading-none text-subtle")}>
          <span>Part</span>
          <span>In production</span>
          <span>Licence</span>
          <span>Who builds it</span>
        </div>
        {PARTS.map(([part, prod, lic, who]) => (
          <div
            key={part}
            className={cn(cols, "items-baseline border-b border-border py-[13px] text-[22px] leading-[28px]")}
          >
            <span className={cn("font-semibold", part.startsWith("Phase 2") ? "text-phase2-ink" : "text-foreground")}>{part}</span>
            <span className="text-secondary-foreground">{prod}</span>
            <span className="num text-secondary-foreground">{lic}</span>
            <span className="text-muted-foreground">{who}</span>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A3

const BUILD: { line: ReactNode; result: ReactNode }[] = [
  {
    line: "Hours saved per request: rework 0.40 (40% bounce × 1.0 h) + forwarding and chasing 0.50 + keying vs import file 0.35",
    result: "1.25 h",
  },
  { line: "80 requests × 1.25 h + ≈1.47 duplicates stopped × 4 h", result: "105.9 h a month" },
  { line: "+ regional consolidation, 5 analysts × 1 day", result: "40 h a month" },
  { line: "= 1,751 h a year × S$50 = S$87,528 − S$5,985 run cost", result: "S$81,543 net a year" },
  { line: "S$39,900 ÷ (S$81,543 ÷ 12); 8.3 months on workflow hours alone", result: "5.9 months" },
];

export function A3Payback({ position }: SlideProps) {
  return (
    <SlideFrame
      position={position}
      label="S$50/h is derived from the MOM 2025 median wage plus bonus and CPF ÷ 1,872 h. All inputs are labelled assumptions (A12–A26)."
    >
      <Headline size={H}>Payback counts hard hours only: 1.25 hours saved per request, valued at S$50 an hour.</Headline>
      <ol className="absolute top-[262px] left-[112px] w-[1696px] border-t border-border-strong">
        {BUILD.map((b, i) => (
          <li key={i} className="grid grid-cols-[1fr_520px] items-baseline gap-x-[48px] border-b border-border py-[24px]">
            <span className="num text-[27px] leading-[36px] text-secondary-foreground">{b.line}</span>
            <span className="text-right">
              <Figure size={44} className={i === BUILD.length - 1 ? "text-foreground" : "text-foreground"}>
                {b.result}
              </Figure>
            </span>
          </li>
        ))}
      </ol>
      <p className="absolute top-[860px] left-[112px] max-w-[1600px] text-[25px] leading-[34px] text-muted-foreground">
        <span className="font-semibold text-foreground">Not counted:</span> approver time (S$85–110/h), stuck-demand revenue, an
        EDGE grant of ≈S$16k if Lives qualifies as an SME.
      </p>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A4

const STEPS = [
  "Clean the name: case, punctuation, legal forms such as Sdn Bhd, abbreviations such as Natl / Univ / Hosp",
  "Score it: the better of Jaro-Winkler and token-set similarity",
  "The same tax ID lifts the score to 97%; the same postcode, phone or email domain adds 3 points each",
  "MDM decides",
];

export function A4DuplicateCheck({ position }: SlideProps) {
  return (
    <SlideFrame position={position} label="Synthetic, illustrative data.">
      <Headline size={H}>
        The duplicate check catches 87 of 100 duplicates in countries it never saw, and 93 of 100 warnings are real.
      </Headline>
      <ol className="absolute top-[268px] left-[112px] grid w-[1696px] grid-cols-[1fr_1fr_1fr_0.6fr] border-t border-border-strong">
        {STEPS.map((s, i) => (
          <li key={s} className="border-l border-border-strong px-7 pt-5 first:border-l-0 first:pl-0">
            <span className="num block text-[22px] leading-none text-subtle">{i + 1}</span>
            <span className="mt-3 block text-[25px] leading-[33px] text-foreground">{s}</span>
          </li>
        ))}
      </ol>
      <p className="absolute top-[560px] left-[112px] max-w-[1600px] text-[26px] leading-[35px] text-secondary-foreground">
        <span className="font-semibold text-foreground">How we tested it:</span> threshold tuned on Singapore + Malaysia, frozen,
        then scored once on Thailand, Vietnam and Myanmar.
      </p>
      <ReadoutRow
        className="absolute top-[680px] left-[112px] w-[1696px] border-t border-border pt-7"
        cells={[
          { value: <span className="num">Precision 0.929</span>, caption: "93 of 100 warnings are real" },
          { value: <span className="num">Recall 0.867</span>, caption: "87 of 100 duplicates caught" },
          { value: <span className="num">13 found · 2 missed · 1 false alarm</span>, caption: "Held-out countries only", flex: 1.3 },
        ]}
      />
      <p className="absolute top-[900px] left-[112px] text-[25px] leading-[34px] text-muted-foreground">
        <span className="font-semibold text-foreground">Weakest cases, shown:</span> romanisation variants and blank tax IDs (6 of 8
        caught each).
      </p>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A5

export function A5RealData({ position }: SlideProps) {
  return (
    <SlideFrame position={position} label="Synthetic, illustrative data.">
      <Headline size={H}>All data is synthetic, and the same scripts run unchanged on Lives&apos;s SAP extracts in week 1.</Headline>
      <Rows
        cols="grid-cols-[400px_1fr]"
        rows={[
          {
            k: "One seeded script",
            v: "Seed 42; 36 months, Oct 2023–Sep 2026; every parameter published; every planted pattern listed and checked (a hidden decline behind duplicates; orders booked to the wrong country; a false cross-sell gap).",
          },
          { k: "What a good score proves", v: "The pipeline can find these patterns, not that they exist at Lives." },
          {
            k: "Week 1 of the pilot",
            v: (
              <>
                Rerun on SAP B1 extracts: orders (<Code>ORDR</Code>/<Code>RDR1</Code>), quotations (<Code>OQUT</Code>), business
                partners (<Code>OCRD</Code>), items (<Code>OITM</Code>).
              </>
            ),
          },
          {
            k: "Names",
            v: "People and hospitals are fictional; the brief's example hospital appears only as a master record, with no sales. Amy's 18 days is from the brief; the day split is ours.",
          },
        ]}
      />
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A6

export function A6Forecast({ position }: SlideProps) {
  return (
    <SlideFrame position={position} label="Synthetic, illustrative data.">
      <Headline size={H}>
        Our seasonal forecast beats today&apos;s rolling average on months it never saw, and we show where it loses.
      </Headline>
      <Rows
        cols="grid-cols-[360px_1fr]"
        rows={[
          {
            k: "Today vs ours",
            v: "Today: rolling 12-month average. Ours: a damped seasonal model (Holt-Winters) per country × product, Products A and B.",
          },
          {
            k: "Test fixed in advance",
            v: "6 starting points (end of Mar to end of Aug 2026), 1–3 months ahead, refitted each time on past data only.",
          },
          {
            k: "Result",
            v: (
              <>
                Off by <span className="num font-semibold text-foreground">11 → 9 units per 100 ordered</span>; wins 7 of 10 country ×
                product cells; loses MY·A, TH·B and MM·B.
              </>
            ),
          },
          {
            k: "Honest limits",
            v: (
              <>
                The gain is seasonal (off-season it is +0.2 points). With seasonality switched off our advantage is −0.6 points (≈ 0),
                so it doesn&apos;t invent signal; another seed with half the dengue effect still wins by 2.3 points.{" "}
                <span className="font-semibold text-foreground">
                  On uncleaned records ours is worse (15 vs 13 per 100): clean first, then model.
                </span>{" "}
                Product C (instruments) is planned from tenders, not forecast.
              </>
            ),
          },
        ]}
      />
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A7

const CONTROLS: { lead: string; text: ReactNode }[] = [
  {
    lead: "Bank and credit",
    text: "The Teams card shows “•••• · view in OneRecord (Finance and MDM only)”. In production: a restricted SharePoint list with item-level permissions through Entra ID (SharePoint has no column-level security, hence a separate list). Every view is logged. Vendor bank details need a call-back to an independently sourced number, logged.",
  },
  {
    lead: "Segregation of duties",
    text: "The requestor and their delegate can't approve; nobody holds or decides two steps of one request (so the Finance approver can't be the MDM keyer); any bank field, or a credit limit over S$50k, adds a Finance Director step.",
  },
  {
    lead: "When nobody acts",
    text: "A reminder after 1 business day; after 3, the step escalates to the approver's delegate, else their manager, skipping anyone who raised the request or holds another step on it; if nobody is eligible, MDM is told. Out-of-office goes straight to the delegate.",
  },
  { lead: "Audit", text: "Every view and decision on a SHA-256 hash chain; any edit after the fact breaks it." },
];

export function A7Controls({ position }: SlideProps) {
  return (
    <SlideFrame position={position} label="In the prototype, masking is enforced in the interface only, and the screens say so.">
      <Headline size={H}>
        Sensitive values never travel in a message, and nobody approves their own request, even after an escalation.
      </Headline>
      <div className="absolute top-[268px] left-[112px] grid w-[1696px] grid-cols-2 border-t border-border-strong">
        {CONTROLS.map((c, i) => (
          <div
            key={c.lead}
            className={cn("border-border py-7", i % 2 === 0 ? "pr-12" : "border-l pl-12", i < 2 && "border-b")}
          >
            <p className="font-semibold text-foreground" style={{ fontSize: 30, lineHeight: 1.1, fontStretch: "108%" }}>
              {c.lead}
            </p>
            <p className="mt-3 text-[23px] leading-[32px] text-secondary-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------- A8

const NOT_BUILT = [
  "automatic posting to SAP",
  "merging existing SAP duplicates (a separate stewardship project; v1 uses a read-only crosswalk)",
  "our own security model (Microsoft 365 and Entra ID provide it)",
  "a drag-and-drop workflow designer",
  "deep-learning forecasts (not justified on monthly data at this scale)",
  "change requests other than Extend",
];

export function A8SapLandingScope({ position }: SlideProps) {
  return (
    <SlideFrame position={position}>
      <Headline size={H}>We land records through SAP&apos;s own import tool, and we left six things out on purpose.</Headline>
      <div className="absolute top-[268px] left-[112px] grid w-[1696px] grid-cols-2 border-t border-border-strong">
        <div className="pt-7 pr-12">
          <p className="font-semibold text-foreground" style={{ fontSize: 32, lineHeight: 1.1, fontStretch: "108%" }}>
            Import file now, Service Layer later.
          </p>
          <p className="mt-4 text-[24px] leading-[33px] text-secondary-foreground">
            The import file keeps MDM&apos;s human check before anything enters SAP. Automatic posting saves only the load step,
            ≈0.15 h a request: 12 h a month at 80 requests = S$7,200 a year, minus S$2,633 licences and S$3,375 maintenance ={" "}
            <span className="font-semibold text-foreground">S$1,192 net a year → the S$22.5k build pays back in ~19 years</span>{" "}
            (~7.4 on pay-as-you-go; ~4.7 at 120 requests a month). The Service Layer payload is already generated and validated,
            marked “not sent”. Extending a customer is one update to the shared business-partner record, never a second record.
          </p>
        </div>
        <div className="border-l border-border pt-7 pl-12">
          <p className="flex items-center gap-3 font-semibold text-foreground" style={{ fontSize: 32, lineHeight: 1.1, fontStretch: "108%" }}>
            <Glyph tone="phase2" hollow size={14} /> Not in version 1, by design
          </p>
          <ul className="mt-4">
            {NOT_BUILT.map((n) => (
              <li key={n} className="border-b border-border py-2.5 text-[23px] leading-[31px] text-secondary-foreground">
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[22px] leading-[30px] text-muted-foreground">
            The prototype also runs no live AI model: rules plus cached examples, badged; in-tenant AI is phase 2.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
