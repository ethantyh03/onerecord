# OneRecord

**One hospital. One record.** OneRecord is a workflow for Lives Group's master data: a team member requests a new customer, item, vendor or cost centre, approvers sign off, and the approved record is handed to SAP Business One. It also includes the regional business view that clean master data makes possible.

Built by **Team CTFudders** for the SMU Data Science & Analytics case competition 2026.

- All data is **synthetic and illustrative**.
- Microsoft Teams, Outlook, SAP B1 and the clock are **simulated** in the browser.
- There is no server, no database and no live AI service.

| | |
|---|---|
| Live prototype | https://onerecord-lives-dsa26.vercel.app |
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

## Guided tour for judges (about 10 minutes)

Open **https://onerecord-lives-dsa26.vercel.app** on a laptop. Your browser is your own private sandbox: nothing you do reaches anyone else. **Reset demo** (top right) puts everything back to the start at any time.

- **Who you are** is shown top left under "Viewing as". The **Start as …** buttons on Home switch it for you.
- Teams, Outlook, SAP B1 and the clock are look-alike screens inside the browser. The checks behind them are real code running in your browser.
- Some steps could look scripted. For those, **How it really works** says what we actually built, and **Try it yourself** gives you an input that proves the check is real.
- Optional shortcut: [`/demo`](https://onerecord-lives-dsa26.vercel.app/demo) is the console we used to record the video. Each scene resets the sandbox and replays our clicks up to that moment; the checks behind them still run live.

**1. Home.** Read the headline and the "Three requests, three spellings, one record" card. Scroll to "Walk through it as one of the four people in the case" and click **Start as Amy**. The New request form opens.

**2. Paste an old email (Amy).** Under "Paste to fill", click **Amy's old email**, then **Fill the form**. The form switches to New Item and shows:
- "Filled 10 fields on New Item"
- "1 sensitive value removed before extraction" (the bank account in the email)
- a list of what is still needed

> **How it really works:** no AI model runs in this prototype. The two built-in examples ("Amy's old email" and "Customer spreadsheet row") return a stored result, so the demo is the same every time. Any other text goes through a rules-based extractor (labels such as "Item:", keywords, and price, country and code patterns) in your browser. Bank and credit details are stripped before extraction. The small "AI" tag on a field only marks that it came from the paste. In production this step would use an LLM inside Lives Group's own Microsoft tenant.
>
> **Try it yourself:** click **Paste again**, replace the text with this email and click **Fill the form**:
> ```
> Hi MDM team, pls create item code for a new test kit. Item: Malaria Pf/Pv Ag Rapid Test 25T. Manufacturer: Acme Diagnostics. Category: IVD reagent. Cost SGD 40.00, selling SGD 65.00. Entity SPD, for SG and MY. Supplier bank account: 123-456789-001. Thanks
> ```
> You get "Filled 8 fields on New Item", "1 sensitive value removed before extraction" and "Rules extraction (offline): not one of the cached demo inputs". Item description becomes "Malaria Pf/Pv Ag Rapid Test 25T". Afterwards, click **Paste again** → **Amy's old email** → **Fill the form** to carry on with Amy's item.

**3. The rules change the form and the route.** On the right, **Who approves** shows three approvers in parallel, including **Dr Ploy Srisuk · QA/RA**, with the reason "QA/RA added · Category = Lab consumable – IVD medical device → regulatory (QA/RA) review required". "Regulatory licence no." is marked required, and the expected live date in SAP B1 is shown.

> **How it really works:** the route is worked out from the approval rules that Admin edits (step 10). Each step can have an "Only when…" condition. The expected live date is counted in business days.
>
> **Try it yourself:** change **Category** to `Instrument`. QA/RA disappears (3 in parallel → 2 in parallel), the licence is no longer required, and Completeness goes from "10 of 13 required" to "10 of 11 required". Change it back to `Lab consumable – IVD medical device` and both return.

**4. Submit and track it.**
1. Choose any **Storage condition**, type any **Regulatory licence no.** (e.g. `HSA-DE-0012345`) and click **Attach sample certificate**.
2. Optionally add a word to the end of the **Item description** (e.g. your initials). You will see your text again in the SAP file in step 8. Waiting customer orders are linked to the request by item name, so keep the rest of the name as it is.
3. Click **Submit for approval**. You get a request number (REQ-1100 in a fresh sandbox), Teams cards to three approvers, and "3 waiting customer orders (S$36,000) linked to this request".

> **Try it yourself (segregation of duties):** click **Approvals** in the left menu. Under "Your requests, from the approver's side", click **Open approver card** next to REQ-1100 (your request), then **Approve** on the Teams card. It is refused: "Segregation of duties: you can't approve your own request … you raised REQ-1100, so someone else must approve it."

Then click **Track** next to your request to open the step-by-step tracker. At the bottom, open **Demo control — simulates approvers acting** and click **Approve all pending steps as their assignees**. Each decision is recorded under the approver's own name, and the request moves on to the MDM final check.

**5. Duplicate check (still Amy).** Click **New request** in the left menu, then **New Customer**. Set **Country** to `SG · Singapore` and type `Natl Univ Hosp` as the **Customer name**. A panel appears: "This customer may already exist in SAP B1 · 100% match · National University Hospital · C-SG-00017", with the reason "100% name match after expanding Natl → National, Univ → University, Hosp → Hospital". Submit stays blocked until you choose **Use existing**, **Extend to my entity** or **Override**.

> **How it really works:** a fuzzy matcher re-runs as you type, against all 388 customer records in the seeded SAP master data (plus any created in your sandbox). First it cleans the name: lower case, legal forms such as Pte Ltd and Sdn Bhd removed, and abbreviations such as Hosp, Natl, Univ and Spec expanded. Then it scores the name with Jaro-Winkler and token-set similarity against records in the chosen country. An exact tax ID scores at least 97% in any country, and the same postcode, phone number or email domain adds a little. It shows up to 3 matches scoring 75% or more.
>
> **Try it yourself** (change the Country or name and watch the panel):
>
> | Country | Customer name | What you see |
> |---|---|---|
> | SG | `Bedok Hil Polyclinic` (typo) | 98% match · Bedok Hill Polyclinic · C-SG-00009 |
> | SG | `NUH` | 88% match · "Initials match (NUH = National University Hospital)" |
> | MY | `Bukit Damai Spec Hosp` | Three 100% matches: C-MY-00029, C-MY-00061 and C-MY-00091. This is the same hospital that Regional Pulse merges in step 9 |
> | SG | `Sunrise Valley Clinic` (made up) | "No existing customer looks like this" |
> | MY | `Bedok Hil Polyclinic` | "No existing customer looks like this" (a similar name in another country is not flagged on name alone) |
> | SG | `Sunrise Valley Clinic`, plus **Tax / registration no.** `198908925N` | 97% match · Bedok Hill Polyclinic · "Same tax ID" |

**6. Credit limits and SAP format checks (same form).**
- Type `80000` in **Credit limit (SGD)**. Who approves adds **Rachel Koh · Finance Director**, with "Finance Director added · Credit limit 80,000 > 50,000 → Finance Director approval required".
- Type `30000` and she disappears. `50000` does not add her either, because the rule is "greater than 50,000".
- Type `accounts@sunrise` in **Accounts payable email**: "Accounts payable email must be a valid email address".
- Type `1234` in **Postcode**: "5–6 digits, e.g. 119074 (SG) or 47500 (MY)". Completeness shows "SAP B1 field rules (length, format) · 2 to fix".
- Click **Change type** → **New Cost Centre** and type `MY-QTS002` as **Proposed centre code**. The counter shows 9/8 and the hint "3–8 capital letters, digits or dashes, e.g. MY-QTS02", because SAP B1 profit-centre codes stop at 8 characters.

**7. Approve in Teams (Wei Jie).** Go to **Home** → **Start as Wei Jie**. Approvals lists what is waiting on him, closest deadline first, with business days left. The Teams card for REQ-1038 (Bangkok Riverside Hospital) hides payment terms, credit limit and bank details as "••••". Click **Approve**. The confirmation reads "Next: Rachel Koh has the approval card in Teams". The Finance Director step was added because this customer's credit limit is above S$50,000 (the same rule as step 6).

**8. Audit trail and the SAP import (Priya).** Go to **Home** → **Start as Priya** to open the MDM console. Click **Review** on REQ-1042 (Dengue IgG/IgM Combo 30T).
- In **Audit trail**, click **Verify chain**. You see "✓ Chain intact · … events".
- Click **Simulate tamper**. You see "Integrity broken at event #278 — any edit after the fact is detectable".
- Click **Restore** to undo it.
- Click **Generate SAP B1 import**. This previews `oItems.csv` and `Items_Prices.csv`, using SAP's own field names in row 1 and database column names in row 2.
- Click **Mark created in SAP B1**. The confirmation reads "I-A-000813 created · Amy notified · S$70,000 of customer orders unblocked". The **Stuck demand** tile drops by exactly S$70,000 (S$345,800 → S$275,800 in a fresh sandbox).

> **How it really works:** each audit entry stores a SHA-256 fingerprint of its own content plus the previous entry's fingerprint. **Verify chain** recalculates every fingerprint in your browser. **Simulate tamper** changes Daniel Ong's approval comment (event #278) in a copy of the log and runs the same check. The break is found by the maths, not shown from a script. The import file is built from the request's fields through the field-to-SAP mapping in the config. Stuck demand is the live sum of open customer orders waiting on records that do not exist yet.
>
> **Try it yourself:** go back to **MDM queue** and click **Review** on your own request from step 4. Click **Generate SAP B1 import**. The `oItems.csv` row carries exactly what you typed: your item description, `HSA-DE-0012345` and the storage condition you chose. **Mark created in SAP B1** then releases a further S$36,000.

**9. Regional Pulse.** Click **Regional Pulse** in the left menu. The **Stuck demand** tile is marked "Live" and shows the lower figure from step 8 (lower again if you did the Try). Scroll down to "Duplicates hide the truth: Malaysia's top accounts" and click **Show raw SAP records**, then **Merge the duplicates**:
- Raw: Bukit Damai appears as three separate records: "Lost customer", "Flat" and "New customer".
- Merged: it is one hospital, ranked #2 in Malaysia and down 32% year on year.

> **How it really works:** growth, the forecast backtest and the duplicate figures were calculated in advance by our Python pipeline (`analytics/`) over 36 months of synthetic orders, and shipped with the app as data files. The merged view groups records by the synthetic data's known true identities. The matcher's accuracy is measured separately (open **What's real here?** on the page). Only **Stuck demand** and **Setup requests in flight** are live from your sandbox.

**10. Change the rules without IT (Marcus, Admin).** Go to **Home** → **Start as Marcus** to open Admin. A banner says MLS (the newly acquired business) "has people but no business-unit setup".
1. In **Test a route**, set Request type `New Item` and Business unit `MLS — Meridian Life Sciences · not configured yet`. The request goes to SPD's Daniel Ong. This is how Marcus's requests got misrouted.
2. Click **Set up MLS**, then **Save business unit**. You see "Config v2 live …".
3. Choose MLS again in **Test a route**. It now goes to Henry Goh (MLS's BU Head) and adds a "Molecular regulatory pre-check" stage.

> **Try it yourself:** open **Approval routes** → **New Customer**. In the Finance Director step, change the "Only when" value from `50000` to `100000` and click **Save route**. Then go to **New request** → **New Customer**: a credit limit of `80000` no longer adds the Finance Director, and `120000` does ("Credit limit 120,000 > 100,000 → Finance Director approval required"). In **Fields & rules**, switch **Customer bank** to Required, and the form now marks it "(required)". **Change history** lists every save as a new version, by who and when. (The hint under Credit limit, "Above S$50,000 adds a Finance Director approval.", and the step's name are fixed text, so they still say S$50,000.)

**11. Fast-forward the clock.** Go to **Home** → **Start as Wei Jie**. On Approvals:
- Click **+1 business day**. The clock moves to Thu 29 Oct. His cards now say "A reminder went to the approver".
- Click **+3 business days**. The clock jumps to Tue 3 Nov, because Saturday and Sunday don't count. His overdue approvals move to his delegate, Rachel Koh. A notice in the corner counts the reminders and escalations across all open requests.

> **How it really works:** each step's clock is counted in business days from when the step opened. A reminder goes out after 1 business day and an escalation after 3. Every move is written to the audit trail: click **My requests** → **All requests** → REQ-1037, or go to `/requests/view?id=REQ-1037`, to see "Escalated to Rachel Koh after 3 business days with no decision from Tan Wei Jie".

When you are done, click **Reset demo** → **Reset demo** to start again.

### Screen map

In production, people would sign in with Microsoft Entra ID single sign-on. In the prototype you pick who you are from the switcher at top left.

| Route | What you see | Try it as |
|---|---|---|
| `/` | How OneRecord works, end to end | anyone |
| `/requests/new` | The request form: paste an email to fill it, the IVD rule, the live duplicate check, and a route preview with the expected live date | Amy (Product Manager) |
| `/requests`, `/requests/view?id=REQ-1042` | Where each request stands, step by step | Amy, Marcus |
| `/approvals` | "Waiting on me", plus the look-alike Teams and Outlook cards | Wei Jie (Finance) |
| `/mdm` | The MDM queue: masked sensitive fields, the audit trail, generating the SAP import, marking a record created | Priya (MDM) |
| `/sap` | Look-alike SAP B1: the DTW import wizard, master-data forms, the phase-2 Service Layer payload | Priya |
| `/pulse` | Regional Pulse: growth, demand streams, the duplicate reveal, the forecast, actions per country | management |
| `/triage` | The shared mailbox sorted into orders, open requests, enquiries, follow-ups and setup requests | anyone |
| `/architecture` | How a record lands in SAP B1: the swimlane, prototype → production, and the field-by-field SAP mapping | IT, finance |
| `/impact` | The business case: hours, cost, payback at 40/80/120 requests a month, alternatives, the pilot | finance |
| `/assumptions`, `/scope` | Every labelled assumption; what we left out on purpose, and the roadmap | anyone |
| `/admin` | Add a business unit, its approvers and an extra step, without IT | Marcus, Priya |

Other approvers in the story include Daniel (BU Head, SPD), Siti (Business Support), Dr Ploy (QA/RA), Rachel (Finance Director), Henry (BU Head, MLS) and Aisha (BU Head, QTG).

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
- **Power BI:** Pro licences for ~10 viewers (≈USD 14/user/month, approx.), only if Lives does not already own them. The pilot analytics run without Power BI.

**Why not SAP's own approvals?** SAP B1's approval procedures are designed around documents (sales, purchasing, inventory, payments). They are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests. (Source: SAP Learning, "Implementing the approval processes in SAP Business One".)

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
- **Merging or retiring existing duplicate SAP records.** That is a separate stewardship project; v1 uses a read-only golden-ID crosswalk. The few high-value merges Regional Pulse flags are done by hand in SAP by the MDM team.
- **A security model of our own.** SSO, encryption and DLP come from Microsoft 365 and Entra ID.
- **A drag-and-drop workflow designer.** Form-based settings are enough for the MDM team.
- **Deep-learning forecasting.** It is not justified on monthly data at this scale.
- **Changes to existing records, apart from Extend.**

**Roadmap, in order:**
1. A 6-week Microsoft 365 pilot (SG + MY, Customer + Item); the analytics rerun on SAP B1 extracts in week 1. *(Phase 1, next; items 2–8 are phase 2.)*
2. Vendor bank-detail changes with dual Finance control.
3. Delegation chains and SLA clocks that skip each country's public holidays (single-delegate out-of-office is already in v1).
4. In-tenant LLM for paste-to-fill and inbox sorting (phase 1 uses rules).
5. Adding a whole request type from Admin.
6. Service Layer webhooks to catch records created outside the workflow.
7. Regional Pulse as a scheduled Power BI report.
8. Audit PDF export, map view, mobile and more languages.

## Credits

Built by Team CTFudders for the SMU Data Science & Analytics case competition 2026.

The case company, people and data are fictional; any resemblance to real organisations is coincidental.

Open-source building blocks: Next.js, React, Tailwind CSS, shadcn/ui and Base UI, Zustand, Recharts, lucide icons, pandas, statsmodels and rapidfuzz.
