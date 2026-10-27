# OneRecord

**One hospital. One record.** OneRecord is a workflow for Lives Group's master data: a team member requests a new customer, item, vendor or cost centre, approvers sign off, and the approved record is handed to SAP Business One. It also includes the regional business view that clean master data makes possible.

Built for the SMU Data Science & Analytics case competition 2026.

- All data is **synthetic and illustrative**.
- Microsoft Teams, Outlook, SAP B1 and the clock are **simulated** in the browser.
- There is no server, no database and no live AI service.

| | |
|---|---|
| Live prototype | https://onerecord.vercel.app |
| Demo video (2:45) | https://youtu.be/REPLACE_ME |
| Repository | https://github.com/ethantyh03/onerecord |

> The app reads these links from `src/lib/links.ts` and nowhere else.

## The thesis

Messy master data hides money.

Today, every new master-data record is requested by email. That causes four problems:

- Requests arrive incomplete.
- Approvals happen one at a time.
- Nobody can see where a request stands.
- Duplicates slip into SAP B1, and those duplicates then make the regional numbers wrong.

OneRecord fixes both ends of the problem.

- **Clean in:**
  - One form with the right rules built in.
  - A duplicate check before anyone approves.
  - Parallel approvals in Teams, each on a 2-business-day SLA.
  - A final MDM check.
  - An SAP B1 import file built from the approved request.
- **Money out:** Regional Pulse shows:
  - orders for Products A, B and C across five countries
  - growth measured year on year, on de-duplicated customers
  - a seasonal forecast, tested against today's rolling average
  - the customer orders stuck behind master-data setup

Amy needed one new item code. It took eighteen days, a bounced request and three approvers one at a time — and her sales order still failed. With OneRecord the target is a **median of 14 days → ≤ 4 business days**.

## 60-second tour

Open the live prototype and pick a persona with the switcher (top right), or load a scene at `/demo`. In production, people would sign in with Microsoft Entra ID single sign-on.

| Route | What you see | Try it as |
|---|---|---|
| `/` | How OneRecord works, end to end | anyone |
| `/requests/new` | The request form: paste an email to fill it, the IVD rule, the live duplicate check, and a route preview with the expected live date | Amy (Product Manager) |
| `/requests`, `/requests/view?id=REQ-1042` | Where each request stands, step by step | Amy, Marcus |
| `/approvals` | "Waiting on me", plus the simulated Teams and Outlook cards | Wei Jie (Finance) |
| `/mdm` | The MDM queue: masked sensitive fields, the audit trail, generating the SAP import, marking a record created | Priya (MDM) |
| `/sap` | Simulated SAP B1: the DTW import wizard, master-data forms, the phase-2 Service Layer payload | Priya |
| `/pulse` | Regional Pulse: growth, demand streams, the duplicate reveal, the forecast, actions per country | management |
| `/triage` | The shared mailbox sorted into orders, open requests, enquiries, follow-ups and setup requests | anyone |
| `/architecture` | How a record lands in SAP B1: the swimlane, prototype → production, and the field-by-field SAP mapping | IT, finance |
| `/impact` | The business case: hours, cost, payback at 40/80/120 requests a month, alternatives, the pilot | finance |
| `/assumptions`, `/scope` | Every labelled assumption; what we left out on purpose, and the roadmap | anyone |
| `/admin` | Add a business unit, its approvers and an extra step, without IT | Priya |

**Personas.** The story follows four people:
- Amy, a requestor in SPD
- Marcus, head of the new business unit MLS
- Wei Jie, Finance Manager
- Priya, MDM Analyst

Other approvers include Daniel (BU Head, SPD), Siti (Business Support), Dr Ploy (QA/RA), Rachel (Finance Director) and Aisha (BU Head, QTG).

**The golden path:**
1. Amy raises a request for a new lab consumable.
2. The form makes the regulatory licence mandatory and adds QA/RA to the route.
3. The approvers decide in parallel in Teams.
4. Priya generates the SAP B1 import and marks the record created.
5. The customer orders waiting on that item are released, and stuck demand drops live on Regional Pulse.

## Run it locally

```bash
npm i
npm run dev              # http://localhost:3000
npm test                 # unit tests (routing, SLA, audit chain, matcher, DTW export, business case…)
python analytics/run_all.py   # regenerate the synthetic data and analytics JSON in src/data/
```

**Requirements:**
- Node 20+
- Python 3.12+ with pandas, numpy, statsmodels, rapidfuzz, scikit-learn and pyyaml

The app never calls Python at runtime: it imports the committed JSON. "Reset demo" in the top bar reseeds your browser's sandbox.

## Architecture

### The prototype

- **Framework:** a static Next.js 15 app (App Router, TypeScript, Tailwind, shadcn/ui).
- **State:** all demo state lives in one Zustand store, persisted to your browser's localStorage, so every visitor gets a private sandbox. That covers requests, approvals, purchase requests, config and the audit trail.
- **Logic:** pure TypeScript modules under `src/lib/engine/`, all unit-tested:
  - routing, with segregation of duties
  - SLA
  - the hash-chained audit trail
  - duplicate matching
  - DTW export
  - rules-based extraction
  - inbox sorting
- **Analytics:** computed offline in Python (`analytics/`) and committed as typed JSON (`src/data/contract.ts`).

### Production

Production is a Microsoft 365 build that the MDM team can own. See `/architecture` for the swimlane, coloured by who builds each part.

| Prototype | Production | Who builds it |
|---|---|---|
| Request form | Power Apps canvas app in the default environment (no Dataverse, no premium) | Lean team; MDM configures fields |
| Store | SharePoint List, plus a restricted list for bank and credit fields | Lean team |
| Routing + Teams card | Power Automate standard Approvals → Teams Adaptive Cards / Outlook actionable messages | Lean team; MDM edits routes |
| Duplicate check | A nightly job writes normalised match keys to a SharePoint list via Microsoft Graph; the canvas app does a delegable key / tax-ID lookup | Data-science contractor (~15 days) |
| Audit | SharePoint version history + Purview approval logs + a hash column | Lean team |
| SAP landing, phase 1 | DTW import file, daily batch, loaded by MDM after the final check | MDM team (no build) |
| SAP landing, phase 2 | Process-licensed flow → custom connector → gateway → Service Layer | SAP partner (~15 days) |
| Regional Pulse | Power BI on SAP B1 extracts (ORDR/RDR1, OQUT, OCRD, OITM) + the golden-ID crosswalk | Lean team analyst |

**Licences:**
- **Phase 1:** no new licences for the workflow. It uses standard connectors only.
- **Phase 2:** adds a Process licence plus one Premium maker licence, ≤ USD 1,980 a year.
- **Power BI:** Pro licences for ~10 viewers (≈USD 14/user/month, approx.), only if Lives does not already own them.

**Why not SAP's own approvals?** SAP B1 approval procedures cover documents (sales, purchasing, inventory, payments), not master data. SAP B1's built-in approvals are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. (Source: SAP Learning, "Implementing the approval processes in SAP Business One".)

## How it lands in SAP B1

### Phase 1: Data Transfer Workbench

- **Import files:** the approved request becomes DTW CSV files: `oBusinessPartners`, `BPAddresses`, `BPBankAccounts`, `oItems`, `Items_Prices` and `oProfitCenter`.
- **Header rows:**
  - Row 1 holds the DI API / Service Layer property names.
  - Row 2 holds the database column names, in tables OCRD, CRD1, OCRB, OITM, ITM1 and OPRC.
- **Loading:** MDM loads the files once a day, after the final check.
- **Caveat:** column names follow the DTW template convention for SAP B1 10.0. Confirm them against the installed DTW Templates folder.

### Extending a customer (assumption A28)

In SAP B1, all entities share one business-partner record. Extending a customer is therefore an update to that record:
- The entity is added to the user-defined field `U_Entities`.
- Any Finance-approved change to payment terms or credit is applied.
- In DTW, this is an update row keyed by CardCode.
- In phase 2, it is the Service Layer call `PATCH /b1s/v2/BusinessPartners('C-SG-00017')`.

### Phase 2: Service Layer

- The calls are `POST /b1s/v2/BusinessPartners`, `/Items` and `/ProfitCenters`.
- The app shows each one as a validated payload marked "not sent".
- At ~80 requests a month it saves about 12 hours a month. That does not pay back on hours (see `/impact`), so phase 2 waits for the pilot.

## Data honesty

**The data is fictional:**
- All customers, orders, messages and people are fictional.
- "National University Hospital" (C-SG-00017) appears only as a master record with zero transactions. It is there to demonstrate the duplicate check.

**How the synthetic history is made:**
- It covers 36 months (Oct 2023 – Sep 2026), generated by `analytics/generate.py` from `analytics/params.yaml`.
- Seasonality is built in: dengue season, fiscal-year flushes, and Chinese New Year / Tet / Songkran.
- Patterns are planted on purpose:
  - a hidden decline behind duplicate records
  - misattributed orders
  - a false cross-sell gap
- `analytics/PATTERNS.md` lists the planted patterns and the assertions that check them.

**How Regional Pulse measures growth:**
- Window: **Oct 2025 – Sep 2026 (12 months) · compared with the same 12 months a year earlier.**
- Assumption A27: SAP B1 already holds ≥ 24–36 months of order history. The 6–12-month limit is a spreadsheet habit, not a data limit.
- Product C (instruments) is planned from the pipeline, not with a time-series model. The forecast is open request and tender value × historical request-to-order conversion by country.

**How the models are tested:**
- Forecast accuracy is backtested on six months the model never saw.
- A stress test shows the method does not invent signal when the seasonality is removed.

**Inbox sorting is rules-based, and honest about it:**
- On 60 messages written independently of the rules, it sorts about half correctly.
- So every result shows its reasons, and a person confirms the routing.
- Phase 2 is in-tenant LLM triage.

**Labels:** every chart is labelled "Synthetic, illustrative", and every simulated surface (Teams, Outlook, SAP B1, the clock) is labelled "Simulated".

## Assumptions

Every assumption is numbered (A1–A28) and listed in the app at `/assumptions`.

**Business-case inputs (`/impact`):**

| Input | Value | Ref |
|---|---|---|
| Loaded cost | S$50/h | — |
| Requests a month | 40 / 80 / 120 | A12 |
| Bounce rate; duplicate rate | 40%; 6% | A13 |
| Hours saved per request | 1.25 | A19 |
| Duplicate cost | 4 h rework per duplicate; 70% caught at intake | A20 |
| Regional consolidation | 40 h a month | A21 |
| Phase-1 one-off | S$39,900 | A22 |
| SAP partner | S$22,500 (low confidence) | A23 |
| Leak rate on stuck demand (opportunity column only) | 10% | A24 |
| Exchange rate | USD 1 = S$1.33 | A25 |
| Baseline median cycle time | 14 days | A26 |

**Base case (80 requests a month):**
- ≈1,751 hours a year back (≈0.94 FTE)
- net ≈S$81,543 a year
- phase-1 payback of **5.9 months** (9.6 at 40 requests, 4.2 at 120)
- ≈43% of the time saving needs no new software, because approving in parallel is a policy change

The calculator and its unit tests live in `src/components/story/business-case.ts`.

## The production kit

These are real artefacts in `integrations/` that the lean team can start from:

- `integrations/teams/approval-card.json`: the Teams approval card, as Adaptive Card JSON. Sensitive values never appear on the card. Sample data is in `approval-card.data.json`.
- `integrations/power-automate/flow-spec.md`: the Power Automate flow, step by step.
- `integrations/sap/dtw-templates/`: DTW header templates for each SAP object.
- `integrations/sap/service-layer-samples.json`: phase-2 Service Layer request samples.
- `integrations/sap/README.md`: how MDM loads the import.

## Deliberately not built, and the roadmap

**Not in version 1, by choice** (details at `/scope`):
- **Automatic posting to SAP B1 through the Service Layer.** It does not pay back on hours at our volumes.
- **Merging or retiring existing duplicate SAP records.** That is a separate stewardship project; v1 uses a read-only golden-ID crosswalk.
- **A security model of our own.** SSO, encryption and DLP come from Microsoft 365 and Entra ID.
- **A drag-and-drop workflow designer.** Form-based settings are enough for the MDM team.
- **Deep-learning forecasting.** It is not justified on monthly data at this scale.
- **Changes to existing records, apart from Extend.**

**Roadmap, in order:**
1. A 6-week Microsoft 365 pilot (SG + MY, Customer + Item).
2. Vendor bank-detail changes with dual Finance control.
3. Delegation and SLA calendars per time zone.
4. In-tenant LLM for paste-to-fill and inbox sorting.
5. Adding a whole request type from Admin.
6. Service Layer webhooks to catch records created outside the workflow.
7. Regional Pulse in Power BI on real extracts.
8. Audit PDF export, map view, mobile and more languages.

## Credits

Built for the SMU Data Science & Analytics case competition 2026, with Claude Code as a pair programmer.

The case company, people and data are fictional; any resemblance to real organisations is coincidental.

Open-source building blocks: Next.js, React, Tailwind CSS, shadcn/ui and Base UI, Zustand, Recharts, lucide icons, pandas, statsmodels and rapidfuzz.
