/**
 * The labelled assumptions register shown on /assumptions.
 * A1–A18 from the design doc §4 (A5 and A8 amended by the final model), A19–A26 from the final model §6.1,
 * A27–A28 added in the red-team pass.
 */

export type AssumptionTag = "illustrative" | "research" | "team-estimate" | "amended" | "policy" | "low-confidence";

export interface Assumption {
  id: string;
  title: string;
  value: string;
  basis: string;
  tags: AssumptionTag[];
  /** Where in the app this assumption shows up */
  usedIn?: string;
}

export interface AssumptionGroup {
  id: string;
  title: string;
  blurb: string;
  items: Assumption[];
}

export const TAG_META: Record<AssumptionTag, { label: string; cls: string; hint: string }> = {
  illustrative: {
    label: "Illustrative",
    cls: "border-border bg-secondary text-secondary-foreground",
    hint: "A plausible value we chose to make the prototype concrete. Replace with real figures in the pilot.",
  },
  research: {
    label: "From research",
    cls: "border-ok/40 bg-ok-soft text-ok-ink",
    hint: "Taken from a cited public source in our research log.",
  },
  "team-estimate": {
    label: "Team estimate",
    cls: "border-border-strong text-foreground",
    hint: "Our own estimate, shown with its arithmetic so it can be challenged.",
  },
  amended: {
    label: "Amended 28 Oct",
    cls: "border-foreground/35 text-foreground",
    hint: "Changed from the original design after review.",
  },
  policy: {
    label: "Policy choice",
    cls: "border-warn/40 bg-warn-soft text-warn-ink",
    hint: "A process decision Lives Group would need to agree, not a fact.",
  },
  "low-confidence": {
    label: "Low confidence",
    cls: "border-stuck/40 bg-stuck-soft text-stuck-ink",
    hint: "The research range is wide; treat as an order of magnitude.",
  },
};

export const ASSUMPTION_GROUPS: AssumptionGroup[] = [
  {
    id: "company",
    title: "Company and scope",
    blurb: "Who Lives Group is, for the purposes of this prototype.",
    items: [
      {
        id: "A1",
        title: "Five countries",
        value: "Singapore (HQ), Malaysia, Thailand, Vietnam, Myanmar.",
        basis:
          "The public footprint of the kind of company the case describes. The company itself is never named, because the brief anonymises it on purpose.",
        tags: ["research"],
        usedIn: "Regional Pulse, routing time zones",
      },
      {
        id: "A2",
        title: "Business entities",
        value:
          "SPD sells Product A (diagnostics) to hospital and diagnostic labs; QTS sells Product C (instruments) to hospitals; QTG sells Product B (lab essentials) to research, industry and hospital labs. Large hospitals buy from all three, so each entity created its own customer record.",
        basis: "Brief S2 and S4. The shared-customer pattern is the root of the duplicate and cross-sell problem.",
        tags: ["illustrative"],
        usedIn: "Intake, duplicate check, Pulse merge toggle",
      },
      {
        id: "A3",
        title: "Products",
        value:
          "A = IVD reagents and test kits (recurring, seasonal disease peaks). B = lab consumables (steady, budget-cycle effects). C = instruments (lumpy, tender-driven, fiscal-year flushes). Each instrument installed pulls through Product A demand.",
        basis: "Brief S2 product groups; the reagent-rental pattern is standard in IVD distribution.",
        tags: ["illustrative"],
        usedIn: "Pulse matrix, forecast, signals",
      },
      {
        id: "A4",
        title: "Currency",
        value: "All values in SGD, using fixed illustrative FX rates for MYR, THB, VND and MMK.",
        basis: "Keeps cross-country totals comparable. Real rates would come from SAP B1's exchange-rate table.",
        tags: ["illustrative"],
        usedIn: "Every S$ figure on Pulse",
      },
    ],
  },
  {
    id: "time",
    title: "Time window and definitions",
    blurb: "What counts as volume and growth, and over which months.",
    items: [
      {
        id: "A5",
        title: "Time window",
        value:
          "Window: Oct 2025 – Sep 2026 (12 months) · compared with the same 12 months a year earlier. Synthetic history runs Oct 2023 – Sep 2026 (36 months). Forecast horizon Oct–Dec 2026. Backtest from six origins, end of Mar to end of Aug 2026.",
        basis:
          "Sep 2026 is the last complete month. 36 months gives the seasonal model three full dengue seasons (originally 24 months).",
        tags: ["amended"],
        usedIn: "Pulse header, forecast, scorecard",
      },
      {
        id: "A6",
        title: "Record types",
        value:
          "Purchase order (PO) = confirmed order, counted as volume. Purchase request (PR) = intent or accepted quote, shown as pipeline. Enquiry = leading indicator only. Follow-up = excluded. MDM setup request = internal work, never demand; a PR can be blocked by one (stuck demand).",
        basis: "The brief never defines these terms, so these are our definitions.",
        tags: ["policy"],
        usedIn: "Streams panel, inbound sorting, stuck demand",
      },
      {
        id: "A7",
        title: "Volume measure",
        value: "Units ordered on POs within a product; order value in SGD across products.",
        basis: "Units avoid price effects inside a product; SGD is the only common unit across A, B and C.",
        tags: ["policy"],
        usedIn: "Pulse units/SGD toggle",
      },
      {
        id: "A8",
        title: "Growth measure",
        value:
          "Growth = PO value (Oct 2025–Sep 2026) ÷ PO value (Oct 2024–Sep 2025) − 1, per country × product, on de-duplicated customers (golden IDs). PO value in SGD for cross-product totals; PO units within a product. Confirmed POs only. Momentum = PO value (Jul–Sep 2026) ÷ PO value (Jul–Sep 2025) − 1.",
        basis:
          "12-month year-on-year. Comparing half-years would measure dengue season, fiscal-year flushes and CNY/Tet rather than growth (originally Apr–Sep vs Oct–Mar).",
        tags: ["amended"],
        usedIn: "Pulse matrix and KPI tiles",
      },
    ],
  },
  {
    id: "process",
    title: "Process",
    blurb: "How requests are approved, and how often things go wrong today.",
    items: [
      {
        id: "A9",
        title: "Approval matrix",
        value:
          "New customer: [BU Head or Sales Manager · Business Support] in parallel → Finance (+ Finance Director if credit limit > S$50k) → MDM. New vendor: [Procurement Head · QA/RA if regulated] → Finance (bank details verified by call-back) → MDM. New item: [QA/RA if IVD or medical device · BU Head · Business Support] → MDM. Cost centre: [Financial Controller · BU Head] → MDM. Extend: Business Support (+ Finance if credit terms change) → MDM.",
        basis:
          "Built from fragments in S2, App B and App C. Running independent checks in parallel is a policy change from App A's ordered chain, not a software trick.",
        tags: ["policy"],
        usedIn: "Route preview, approvals, admin",
      },
      {
        id: "A10",
        title: "Service levels",
        value:
          "2 business days per approval step in the approver's local time zone (production configuration; the prototype runs on SGT). Reminder after 1 business day; escalation to the delegate or manager after 3. Asking the requestor a question pauses the step's clock.",
        basis: "Team proposal, sized so the median request finishes within the 4-business-day target.",
        tags: ["policy"],
        usedIn: "Tracker, fast-forward, Teams reminders",
      },
      {
        id: "A11",
        title: "Cycle time, today vs target",
        value:
          "Median 14 days (Amy's took 18) → ≤ 4 business days. Amy's 18 days are from the case brief, Appendix C.",
        basis:
          "18 days is App C. The 14-day median sits between S4's \"2–3 weeks\" and App C (see A26). The 2/5/9/2-day split is our breakdown of App C (illustrative).",
        tags: ["illustrative"],
        usedIn: "Impact page, pitch close",
      },
      {
        id: "A12",
        title: "Request volume",
        value: "About 80 MDM requests a month group-wide (customers 35, items 30, vendors 10, cost centres 5). Business case shown at 40 / 80 / 120.",
        basis: "Not in the brief; sized for five countries and three entities, with a sensitivity range.",
        tags: ["illustrative"],
        usedIn: "Business case",
      },
      {
        id: "A13",
        title: "Error rates today",
        value: "40% of requests bounce at least once for missing information. 6% of new customer records duplicate an existing one.",
        basis: "Illustrative, consistent with App C's bounced request and S4's duplicate complaints. The pilot measures the real duplicate rate on OCRD.",
        tags: ["illustrative"],
        usedIn: "Business case, duplicate matcher test",
      },
    ],
  },
  {
    id: "tech",
    title: "Technology and data",
    blurb: "Where the solution runs, how it lands in SAP B1, and what the data is.",
    items: [
      {
        id: "A14",
        title: "Production platform",
        value:
          "Canvas Power Apps form on a SharePoint List, Power Automate routing with the standard Approvals connector, Teams and Outlook approvals, Entra ID roles. No new licences for the workflow (phase 1): standard connectors only. The duplicate matcher runs as a nightly job that writes normalised match keys to a SharePoint list via Microsoft Graph; the form does a delegable key and tax-ID lookup, so no premium HTTP connector is needed. Regional Pulse in production = Power BI, with Pro licences for about 10 viewers (≈ USD 14/user/month, approx.) if not already owned.",
        basis:
          "Microsoft licensing documentation in the research log: Approvals and Teams are standard connectors included with Microsoft 365. Avoids Dataverse to stay clear of premium enforcement.",
        tags: ["research"],
        usedIn: "Architecture page, business case",
      },
      {
        id: "A15",
        title: "SAP B1 landing",
        value:
          "Phase 1: an approved request generates Data Transfer Workbench (DTW) import files with SAP's own field names; MDM checks and loads them. Phase 2: automatic creation through the Service Layer API, built with an SAP partner.",
        basis:
          "SAP B1's built-in approvals are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. So approvals live in Microsoft 365 and SAP stays the system of record.",
        tags: ["research"],
        usedIn: "MDM console, SAP sandbox, architecture",
      },
      {
        id: "A16",
        title: "Sensitive fields",
        value:
          "Bank details, credit limit and payment terms are visible only to Finance and MDM roles and masked for everyone else. Every reveal is logged.",
        basis:
          "Role-enforced in the prototype; in production by a restricted SharePoint list with Entra ID permissions.",
        tags: ["policy"],
        usedIn: "Teams card, MDM console, tracker",
      },
      {
        id: "A17",
        title: "Data",
        value:
          "All data is synthetic, generated from one seed with documented planted patterns, and labelled illustrative everywhere. Customer names are fictional. National University Hospital exists only as a master record for the duplicate demo, with no transactions.",
        basis: "No real Lives Group data is available. The loader reads a documented CSV schema so real SAP B1 extracts can replace it.",
        tags: ["illustrative"],
        usedIn: "Every analytics view",
      },
      {
        id: "A18",
        title: "Business-case unit costs",
        value: "Salaries, licence prices and consultant day rates come from the verified research log, with sources cited. No unsourced numbers.",
        basis: "Research log of 23 Oct 2026 (four researchers plus a sceptical verifier). The generator reads every value from one parameter file.",
        tags: ["research"],
        usedIn: "Impact page",
      },
      {
        id: "A27",
        title: "History available in SAP B1",
        value: "SAP B1 already holds ≥ 24–36 months of PO history; the 6–12-month limit is a spreadsheet habit, not a data limit.",
        basis: "Sales orders (ORDR/RDR1) are kept in the company database; the pilot confirms the depth per entity in week 1.",
        tags: ["team-estimate"],
        usedIn: "Forecast, pilot plan",
      },
      {
        id: "A28",
        title: "Extending a customer to another entity",
        value:
          "In SAP B1 one business-partner record is shared by all entities, so Extend is an update of the existing record: add the entity to the user-defined field U_Entities, plus any Finance-approved payment-terms or credit change, and a new ship-to address row if given. DTW: an oBusinessPartners update row keyed by CardCode. Service Layer: PATCH /b1s/v2/BusinessPartners('C-SG-00017').",
        basis: "Assumes one shared company database with an entity UDF. A per-entity database design would need one record per database instead.",
        tags: ["team-estimate"],
        usedIn: "Marcus's extension, DTW wizard",
      },
    ],
  },
  {
    id: "business",
    title: "Business case inputs",
    blurb: "The numbers behind payback. Opportunity figures never enter payback.",
    items: [
      {
        id: "A19",
        title: "Hours saved per request",
        value: "1.25 h = rework 0.40 (40% × 1.0 h) + manual forwarding and chasing 0.50 + manual keying vs DTW 0.35. Valued at S$50/hr loaded cost.",
        basis:
          "Team estimate. S$50/hr is derived from the MOM Occupational Wage Survey 2025 median for a data analyst, plus a 1.8-month bonus and 17% CPF, over 1,872 productive hours. Approver time is not counted.",
        tags: ["team-estimate"],
        usedIn: "Impact page",
      },
      {
        id: "A20",
        title: "Cost of a duplicate",
        value: "4 hours of rework per duplicate customer record; 70% intercepted at intake.",
        basis: "Team estimate, informed by the 1-10-100 data-quality heuristic (research log).",
        tags: ["team-estimate"],
        usedIn: "Impact page",
      },
      {
        id: "A21",
        title: "Regional consolidation time",
        value: "5 country analysts × 1 day a month saved = about 40 hours a month.",
        basis: "Team estimate of today's manual extract-and-reconcile work for the regional report.",
        tags: ["team-estimate"],
        usedIn: "Pulse KPI tile, impact page",
      },
      {
        id: "A22",
        title: "Phase-1 build cost",
        value:
          "Lean team 2 people × 6 weeks × 40 h × S$50 = S$24,000; data-science / Power Platform contractor 15 days × S$650 = S$9,750; MDM configuration 48 h = S$2,400; onboarding 150 people × 0.5 h = S$3,750. Run cost 15% a year.",
        basis: "Day rate at the upper end of the research-derived S$450–650 range (low confidence). Run cost from the research range of 15–25%.",
        tags: ["team-estimate", "low-confidence"],
        usedIn: "Impact page, payback",
      },
      {
        id: "A23",
        title: "Phase-2 SAP partner and licences",
        value:
          "SAP partner 15 days × S$1,500 = S$22,500. Licences for automatic posting: one Process licence USD 150/month + one Premium maker USD 15/month = USD 1,980 a year ≈ S$2,633.",
        basis:
          "Partner rate derived from a USD 150–350/hr global proxy (low confidence). Licence prices from Microsoft (research log). Pay-as-you-go at USD 0.60 per run is cheaper below about 250 postings a month.",
        tags: ["research", "low-confidence"],
        usedIn: "Impact page, scope",
      },
      {
        id: "A24",
        title: "Leak rate on stuck demand",
        value: "10% of stuck-demand value is assumed lost to delay. Opportunity column only, never in payback.",
        basis: "Team assumption through a CFO lens; deliberately kept out of the hard benefit.",
        tags: ["team-estimate", "illustrative"],
        usedIn: "Impact page opportunity column",
      },
      {
        id: "A25",
        title: "Exchange rate",
        value: "USD 1 = S$1.33.",
        basis: "Research log range S$1.30–1.35.",
        tags: ["research"],
        usedIn: "Licence costs",
      },
      {
        id: "A26",
        title: "Baseline median cycle time",
        value: "14 calendar days (Amy's case in the case brief, Appendix C: 18).",
        basis: "Between S4's \"2–3 weeks\" for a request needing five approvals and App C's 18 days.",
        tags: ["illustrative"],
        usedIn: "Impact page, pitch close",
      },
    ],
  },
];

export const ALL_ASSUMPTIONS: Assumption[] = ASSUMPTION_GROUPS.flatMap((g) => g.items);
