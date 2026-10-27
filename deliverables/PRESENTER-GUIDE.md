# OneRecord presenter guide

**SMU DSA 2026 Data Case Competition · "Modernizing Master Data Management at Lives Group"**
Submission due **12:00 SGT, Wed 28 Oct** (aim for **11:30**) · Finals **Fri 30 Oct**

Every instruction below was checked against the running production build on 28 Oct. Screens were captured at 1920×1080 with 125% zoom.

> **Five rules for anything you say out loud**
> 1. All data is **synthetic and illustrative**. Say so whenever you show a number from Regional Pulse.
> 2. Never name the real company behind the case, and never name a real hospital except the brief's *National University Hospital*. It appears only as a master record, with no sales.
> 3. Never say SAP B1 "cannot" approve master data. Say **"SAP Business One's built-in approvals are document-centric."**
> 4. **18 days** is Amy's case and belongs only in the hook. The target is always **"median 14 days → ≤ 4 business days."**
> 5. Every number comes from `src/data/summary.json` or `business-case.ts`. If a number isn't in this guide, don't improvise one.

---

## 1. The 30-second version

**What it is.** OneRecord is a single front door for new customers, vendors, items and cost centres across Lives Group. It runs on the **Microsoft 365** Lives already owns (Power Apps form, Teams approvals, SharePoint) and **lands in SAP Business One** through SAP's own import tool, the Data Transfer Workbench (DTW).

**The thesis.** *Messy master data hides money.*
- **Clean in:** requests arrive complete, duplicates are caught before anyone approves, approvers decide in parallel inside Teams, and SAP gets an import file instead of hand-keyed data.
- **Money out:** once each hospital is one record, the regional numbers can be trusted. Growth, hidden declines and stuck orders show up.

**The three numbers to remember**

| # | Number | Where it comes from |
|---|---|---|
| 1 | **Median 14 days → ≤ 4 business days** to set up a record (Amy's took 18) | `summary.json` · cycle_time |
| 2 | **≈1,750 hours a year back, payback ≈ 6 months** (5.9 months on a S$39.9k phase-1 one-off, at 80 requests a month) | `summary.json` · payback, hours |
| 3 | **No new licences for the workflow in phase 1** | `business-case.ts` · ALTERNATIVES |

**One insight to land:** merge the duplicates and **Bukit Damai Specialist Hospital, Malaysia's #2 account, is down 32%**. On raw SAP records it looked like a lost customer, a new one and a flat one.

**Say it in 30 seconds:**
> "At Lives Group, master data is created by email. Requests arrive incomplete or duplicated, approvals go one person at a time, and Amy waited eighteen days for one item code. OneRecord is one front door on the Microsoft 365 they already own, and it lands in SAP Business One through SAP's own import tool. Median setup drops from fourteen days to four business days or less. About seventeen hundred and fifty hours a year come back, paying back in about six months, with no new licences for the workflow in phase one. And because each hospital becomes one record, the regional numbers become trustworthy: merge the duplicates, and Malaysia's number-two account turns out to be down thirty-two percent. One hospital. One record."

---

## 2. The live demo, click by click (≈ 2:45)

Use this for the **finals on 30 Oct**, or if you record the demo yourself instead of using the auto-recorded video.

### Before you start (10 minutes ahead)

1. **Open a fresh incognito window** with no extensions, so there is no sandbox state left over and no password pop-ups.
2. Go to the **live URL: `https://onerecord-lives-dsa26.vercel.app`**. Check `src/lib/links.ts` after the deploy in case it changed.
3. Set **zoom to 125%** (Ctrl + `+` twice from 100% gives 110% then 125%), then press **F11** for full screen.
4. Open **`/demo`** (the Director's console) and click **Reset demo** at the top right. The toast reads "Back to the starting scenario: Wed 28 Oct, 09:00 SGT, Amy selected."
5. **Pre-warm:** click **Load scene** once on each of the six scenes, so nothing shows a loading state on stage. Finish with **Reset demo** again.
6. Turn on Windows **Do not disturb**, close every other tab, mute your phone, and put the MP4 (`deliverables/video/OneRecord-demo.mp4`) on the desktop as a backup.
7. Keep **`/demo` as your home base.** Every "Load scene" button resets the sandbox and replays the scripted steps, so any scene can be retaken from an identical state.

> **Universal fallback.** If anything misbehaves, go back to `/demo` (type it, or press **Esc** on a full-screen pitch frame) and click that scene's **Load scene** again. Expect about 3 seconds to recover. If the live site itself is down, switch to the MP4 and talk over it.

The **Voice-over** line for each beat is exactly what to say. **Bold** marks stressed words, `/` a short pause, `//` a breath.

---

### Beat 1 · Hook (0:00–0:12)

- **Load:** on `/demo`, in "Hook: 18 days", click **Open** to show `/pitch/hook`.
- **What happens:** a black screen. The day counter runs to **"18 days."** over a faded email trail, and the bar splits into 2 days unnoticed · 5 days bounced · 9 days three approvers one at a time · 2 days keyed into SAP by hand. The caption reads "Scenario from case brief, Appendix C".
- **Say:**
  > "Amy needed **one** new item code. // It took **eighteen days**, / a **bounced** request / and three approvers **one at a time**, / and her sales order **still failed**."
- **Point at:** the red line at the bottom, "Sales order failed: item code not found".
- **If it misbehaves:** press **R** to replay, or **Esc** to go back to `/demo`. The "Final frame" link under Open shows the frozen end state.

### Beat 2 · Frame (0:12–0:24)

- **Load:** press **Esc** to return to `/demo`. In "Frame: clean in, money out", click **Reset and open**. This resets the sandbox, selects Amy and opens Home.
- **Point at:**
  1. The badge above the headline, **"Runs on Microsoft 365 · lands in SAP Business One"**.
  2. The headline, **"Messy master data hides money. One hospital, one record."**
  3. The card on the right: three spellings (Natl Univ Hosp · National Universit… · Nat'l University Ho…), each "Caught at intake", resolving to **National University Hospital · C-SG-00017**.
  4. The strip at the bottom, split **CLEAN IN** (steps 1–5) │ **MONEY OUT** (step 6, Regional Pulse).
- **Say:**
  > "At Lives Group, / master data is created **by email**. // Records arrive **incomplete** or **duplicated**, / so the regional numbers **can't be trusted**. // OneRecord fixes **both ends**."

### Beat 3 · Clean in: Amy (0:24–0:50)

- **Load:** `/demo` → **Load scene** on *Clean in: Amy raises a new item*. This opens the empty New Item form as Amy Lim (Product Manager, SPD).
- **Click, in order:**
  1. In **Paste to fill**, click **"Amy's old email"**, then **"Fill the form"**.
  2. *(Point)* The green chip **"1 sensitive value removed before extraction"** and the badge **"Rules + cached example · in-tenant LLM in phase 2"**.
  3. *(Point)* Category is now **"Lab consumable – IVD medical device"**. In the right-hand panel, **Dr Ploy Srisuk · QA/RA** has joined the route, with the note "QA/RA added · Category = Lab consumable – IVD medical device → regulatory (QA/RA) review required". The **Regulatory licence no.** field is flagged *Needed*.
  4. Type the licence no. **`HSA-DE-0012345`** and click **"Attach sample certificate"**.
  5. Scroll down a little to **Storage condition** and pick **"Ambient (15–30 °C)"**. Completeness reads **13 of 13 required**.
  6. *(Point)* **Who approves:** "Product checks · 3 in parallel · 2 business days each" (QA/RA · BU Head · Business Support) → MDM final check. Then the card **"Expected live in SAP B1: Tue 3 Nov"**, with "Today by email: median 14 days (Amy's took 18)" under it.
  7. Click **Submit for approval**. The receipt shows **REQ-1100**, "Teams approval cards sent to Dr Ploy Srisuk, Daniel Ong and Siti Rahman", and **"3 waiting customer orders (S$36,000) linked to this request"**.
- **Say:**
  > "Amy's item is a **blood collection tube**: / a lab consumable regulated as an **IVD**, / an **in-vitro diagnostic** device. // She pastes her **old email**, / and the form **fills itself**. // As an IVD, / it **needs a licence number**, / and **Quality** joins the route **automatically**: / the step she **missed** last time. // Before submitting, / she sees her approvers, / all **in parallel**, / and her go-live date: / **Tuesday, the third of November**. / And it links the **three** customer orders, / **thirty-six thousand dollars**, / that are waiting on it."
- **If it misbehaves:** if the paste doesn't fill, click **Paste again** and repeat, or reload the scene. If **Submit** stays grey, the hint under it names what is still empty (usually Storage condition).

### Beat 4 · Clean in: Marcus (0:50–1:07), in two parts

**4a. Admin insert, 4–5 seconds**
- **Load:** `/demo` → **Load scene** on *Admin adds Marcus's business unit*. This opens Admin settings → Business units as Priya (MDM). The amber banner reads "MLS (Meridian Life Sciences, newly acquired) has people but no business-unit setup".
- **Click:** **Add business unit**. The sheet opens **prefilled for MLS — Meridian Life Sciences**: BU Head **Henry Goh**, Business Support **Siti Rahman**, extra stage **"Molecular regulatory pre-check"**. Click **Save business unit**. The header badge changes to **"Config v2 live"** and the MLS card appears.
- **Say:**
  > "Marcus is from a **new** business unit, / Meridian Life Sciences. // The MDM team added it **themselves**: / **no IT ticket**."

**4b. Duplicate catch**
- **Load:** `/demo` → **Load scene** on *Clean in: Marcus is stopped from creating a duplicate*. Marcus Wong's draft for **"Natl Univ Hosp"** (SG, tax ID 198500123K, MLS) opens.
- **Point at:** the **amber card**, which is visible without scrolling: **"This customer may already exist in SAP B1 · 100% match · National University Hospital · C-SG-00017 · Same tax ID · 100% name match after expanding Natl → National, Univ → University, Hosp → Hospital"**.
- **Click:** **Extend to my entity**. The form switches to **"Extend a record"** for C-SG-00017, with **"+ MLS"** next to "Sold by: SPD". A toast reads "Switched to Extend Existing Record".
- *(Optional, +3 s)* Scroll down and set **"Changes credit terms?" = Yes**. **Tan Wei Jie · Finance** joins the route, with the note "Finance added · Changes credit terms = Yes → Finance review required".
- **Say:**
  > "He types a hospital **in shorthand**, / and OneRecord finds it **already on file**, / before any approver sees it. // So he **extends** that record to his entity, / instead of creating a **duplicate**. // Business Support and **Finance** check it, / then MDM."

### Beat 5 · Clean in: Wei Jie (1:07–1:22)

- **Load:** `/demo` → **Load scene** on *Clean in: Wei Jie approves in Teams*. This opens Approvals as Tan Wei Jie (Finance Manager), with **REQ-1101 preselected** under "Waiting on me". Check the Teams card title, **"Extend: National University Hospital → MLS"**, before you speak.
- **Point at:**
  1. **"New payment terms 🔒 •••• · view in OneRecord (Finance and MDM only)"**, and the same for the credit limit.
  2. **"Why you're seeing this: you're assigned the Finance — revised credit terms step."**
  3. **"Due in 2 business days"** at the top right of the card.
- **Click:** **Approve**, the purple button at the bottom-left of the card (about two-thirds of the way down the screen). The card shows **"Approved by Tan Wei Jie · Wed 28 Oct, 10:05"**, and the toast reads "Next: Priya Nair has the approval card in Teams. Marcus Wong was told."
- *(Optional, +6 s)* Click **Open details ↗** to open `/requests/view?id=REQ-1101#request-data`. Then click **"Show credit & bank values (logged)"**: **Net 60** and **45,000** appear, the toast reads "View recorded in the audit trail", and the audit trail gains a row **"Tan Wei Jie · Sensitive value viewed"**.
- **Say:**
  > "Wei Jie in Finance approves on a **Teams card**, / where he **already works**. // Credit terms **never travel** in the message. / Only **Finance and MDM** can open them, / inside OneRecord, / and **every view** is logged. // **Reminders** go out before anything stalls."
- **If it misbehaves:** if REQ-1101 isn't selected, click the **REQ-1101** row in the left list. If you clicked Approve too early, just reload the scene.

### Beat 6 · Architecture insert (hold 8–10 s)

- **Load:** click **Architecture** in the left sidebar (under "The case"). Nothing needs resetting.
- **Point at:** the six lanes (Requestor → OneRecord checks → Approvers → MDM final check → **SAP Business One** → Regional Pulse). Then the green chip **"S$0 · ships with SAP B1"** on the DTW import file, the dashed **"Service Layer · Phase 2 · not built"** box, the "Who builds it" legend (MDM team configures · Lean team builds · Outside help), and the **"Phase 1 in numbers"** box (~6 weeks · S$39.9k · S$0 new workflow licences · ≈6 months payback).
- **Say:**
  > "SAP Business One's built-in approvals are **document-centric**, / designed around documents like sales orders. // So approvals for master data live in **Microsoft 365**, / and SAP stays the **system of record**. // Each box is coloured by **who builds it**, / so a company with no dev team / sees exactly what it takes on."

### Beat 7 · Lands in SAP B1: Priya, then the bridge (1:22–2:05)

- **Load:** `/demo` → **Load scene** on *Lands in SAP B1: Priya imports Amy's item*. This opens the MDM console for **REQ-1100 (Amy's K2EDTA item)**, approved in parallel by 13:26. The top row shows **"Customer orders waiting S$36,000 · 3 orders"** and the red **Stuck demand S$345,800 (Live)** tile.
- **Click, in order:**
  1. **Generate SAP B1 import.** The page scrolls to the DTW preview, **oItems.csv**, with its **two header rows** highlighted (Row 1 property names, Row 2 database column names), then `I-B-000535 · K2EDTA Blood Collection Tube 4 mL, 100/pk`.
  2. **Point at (don't open)** the **Service Layer (Phase 2)** tab while you say "phase two". Opening it shows a JSON body, which is code on screen.
  3. **2-second glimpse:** on the right, point at the **Audit trail** ("Every action on REQ-1100… SHA-256 fingerprint", with #303 Amy Lim Submitted).
  4. **Mark created in SAP B1.** Step 3 turns green with "I-B-000535 created". The toast reads **"I-B-000535 created · Amy notified · S$36,000 of customer orders unblocked"**.
  5. **Bridge:** click **Regional Pulse** in the sidebar. The **Stuck demand** tile now reads **S$309,800**.
- **Say:**
  > "Priya clicks **Generate SAP B1 import**, / and gets a **Data Transfer Workbench** file: / the import format SAP **already reads**, / with SAP's **own field names**. // Sending it **automatically**, / through SAP's Service Layer, / is **phase two**. // Today, / she loads the file / and marks the item **created**. // Amy is told **the moment** it's live. // And stuck demand drops by **thirty-six thousand dollars**: / **three** customer orders / that were waiting on **that one record**."
- **Don't click** "Open in SAP B1 (simulated)" on stage, because it leaves the page. **If it misbehaves:** reload the scene. Stuck demand always starts at S$345,800 and drops by exactly S$36,000.

### Beat 8 · Money out: Regional Pulse (2:05–2:32)

- **Load:** **Don't reload.** The bridge left you on `/pulse` (as Priya, **Merged customers** view, Stuck demand **S$309,800**). Click **Raw SAP records** at the top right, then scroll to the Malaysia card.
- **Point at:**
  1. **(hold 2 s)** The formula bar: **"Growth = Oct 2025–Sep 2026 vs Oct 2024–Sep 2025 · de-duplicated customers · confirmed POs only"**, and the badge **"Synthetic, illustrative data"**.
  2. The **Customer orders** tile, **S$53.4M**, "+4.0% on the same 12 months a year earlier. Latest quarter: +7.6%".
  3. The **Forecast error, Products A and B** tile, **"11 → 9 per 100"**, with its season caveat underneath: "Backtested on 6 months the model never saw. Scored Apr–Sep 2026, the dengue rise. Off-season the two are about level (+0.2)…".
- **Click:** scroll down (about three screens, past the matrix and the streams) to **"Duplicates hide the truth: Malaysia's top accounts"**. Raw, Bukit Damai shows up as **three rows**: #7 *Flat*, #10 *Lost customer −66%* and #11 *New customer*. Click **Merge the duplicates** (top right of the card). They animate into one row: **#2 Bukit Damai Specialist Hospital · 3 SAP records merged · G-MY-0002 · S$1.08M · −32%**. The side card reads "S$1.59M → S$1.08M, −32% year on year". Then point at **"What we do about it"** under it: the action, the owner (**BU Head, SPD Malaysia**), the date (**By 13 Nov 2026**) and **S$620k addressable**.
- **Say:**
  > "Now, / **money out**, / on **synthetic** data. // Regional Pulse compares the **twelve months** to September 2026 / with **the year before**, / on **de-duplicated** customers. // Orders are **fifty-three point four million** dollars, / **up four percent**. // On our illustrative data, / today's method is off by **eleven** units per hundred ordered; / ours by **nine**. // And merge the duplicates, / and Bukit Damai, / Malaysia's **number-two** account, / is really **down thirty-two percent**. // Each country card names an **owner**, / an **action** / and the **dollars at stake**."
- **If it misbehaves:** if the card already shows merged, click **Show raw SAP records** first. **Load scene** on *Clean out: Regional Pulse* is the last resort only: it opens `/pulse?view=raw` as Wei Jie but **resets Stuck demand to S$345,800**, contradicting the bridge you just showed. If you can't find the card, use the **Merged customers / Raw SAP records** toggle at the top right of the page.

### Beat 9 · Close (2:32–2:49)

- **Load:** go to `/demo` and, in "Close: one hospital, one record", click **Open** (or type `/pitch/close`). Use `/pitch/close?still=1` for a frozen final frame.
- **On screen:** "≤ 4 business days" (Today: median 14 days (Amy's took 18) → ≤ 4 business days) · "≈1,750 hours a year … Payback in about 6 months" · "No new licences for the workflow (phase 1)" · **"One hospital. One record."** · the live URL and GitHub link.
- **Say:**
  > "Median setup drops from **fourteen days** / to **four business days** or less. // About **seventeen hundred and fifty hours** a year come back, / paying back in about **six months**. // **No new licences** for the workflow / in phase one. // **One hospital.** / **One record.**"
- Slow down on the last line and hold about 2 seconds of silence.

### Never show on stage
Code, terminals or notebooks · loading spinners (pre-warm) · WAPE or precision/recall tables as headlines · anything Phase 2 "working" (the Service Layer stays "not sent") · Ask a question, escalation or Inbox triage (keep them for Q&A: see §4, "Show if asked") · scrolling long tables · real hospital names attached to sales.

---

## 3. The 2-minute pitch over the 2 slides

The slides are the **2-slide PDF** (built from `/pitch/summary`). Spend about **60 seconds per slide**, point at one zone at a time, and don't read the table aloud.

### Slide 1: "Messy master data hides money. OneRecord fixes it at the front door." (≈ 60 s)

**Left (Problem), about 20 s.** Point at Amy's waterfall.
> "Amy needed one item code. It took eighteen days: two unnoticed in an inbox, five bounced for a missing licence number, nine waiting for three approvers one at a time, two keyed into SAP by hand. With OneRecord, that's about four calendar days. And notice the highlighted bar: about **43% of the saving is a process change**, approving in parallel, which needs no new software at all. Behind it are three pains: incomplete and duplicate records, invisible approvals with no audit trail, and regional numbers nobody trusts. One fact matters here: **SAP Business One's built-in approvals are document-centric.**"

**Centre (Solution), about 25 s.** Trace the six boxes left to right.
> "So we put one front door on Microsoft 365. A Power Apps form, a duplicate and completeness check, Teams approvals in parallel with a two-business-day SLA, one final MDM check in a SharePoint list, then a DTW import file in SAP's own field names, which costs nothing because it ships with SAP B1. The colours show who builds each box: the MDM team configures, a lean team of two builds, and outside help is about fifteen days. Automatic posting through the Service Layer is phase two, and only if the pilot proves it."

**Right (Why this), about 15 s.** Point at the highlighted OneRecord row.
> "We compared five alternatives. A better email template doesn't fix chasing. Teams Approvals alone is a good zero-build first step, but it has no duplicate check and no SAP-ready output. An MDM suite is over-sized for about eighty requests a month. OneRecord is the only option that fixes **both the workflow and the numbers**."

### Slide 2: "Impact, cost and how we get it adopted" (≈ 60 s)

**Top tiles, about 15 s.**
> "Median setup from **fourteen days to four business days** or less. About **seventeen hundred and fifty hours a year** handed back, which is capacity, not headcount. **Payback in about six months.** And **no new licences** for the workflow in phase one."

**Business case, about 20 s.** Point at the highlighted 80 row.
> "That counts hard hours only, at fifty dollars an hour. At our base of eighty requests a month, phase one costs **S$39.9k** one-off plus about six thousand a year to run, and pays back in **5.9 months**, or 9.6 at forty requests and 4.2 at a hundred and twenty. Phase two automatic posting would save only the import step, so its payback on hours is roughly nineteen years. That makes it a speed decision, taken after the pilot. Grants and approver time are upside we don't count."

**Pilot and adoption, about 15 s.**
> "We pilot for six weeks in Singapore and Malaysia, on customers and items, for SPD and QTS. Targets: ninety percent of requests through OneRecord, median four business days, bounces under fifteen percent. At week six, if the median is over six business days or adoption is under seventy percent, we fix or stop. Adoption comes from removing the old path: the MDM mailbox auto-replies with the form link, approvals take one click in Teams, and status is visible to everyone."

**Insight, about 10 s.**
> "And on the money-out side, on illustrative data: merging twenty-five duplicate records shows that Malaysia's number-two hospital is down thirty-two percent. That's a call to make this month. **One hospital. One record.**"

---

## 4. Finals Q&A bank

All data in OneRecord is **synthetic and illustrative**. Quote numbers only as they appear in `src/data/summary.json`, `impact.json` and `meta.json`. Never name the real company behind the case.

*Verified against the live build and source on 28 Oct: payback 5.9 / 9.6 / 4.2 months, workflow-only 8.3; Phase-2 ~19 years; matcher precision 0.929 / recall 0.867 (13 found, 2 missed, 1 false alarm); Finance Director step above S$50k; Extend = U_Entities update, PATCH `/b1s/v2/BusinessPartners('C-SG-00017')`; reminder after 1 business day, escalation after 3; stuck demand S$345,800 → S$309,800.*

### Numbers to know by heart

| Topic | Say |
|---|---|
| Amy's case (brief, App C) | 18 days, a bounced request, three approvers one after another, and the sales order still failed |
| Target | Median **14 days → ≤ 4 business days**. Amy's item goes live **Tue 3 Nov** |
| Stuck demand | Amy's item unblocks **3 customer orders worth S$36,000**: S$345,800 → S$309,800 at seed |
| Business case | Phase 1 **S$39.9k** one-off, **no new licences for the workflow**, **≈1,750 h/yr** back (≈0.94 FTE), **payback ≈ 6 months** (5.9), 3-year net S$205k |
| Pulse | Oct 2025–Sep 2026 vs the 12 months before: **S$53.4M, +4.0%** (+7.6% Jul–Sep) |
| Hidden decline | Bukit Damai Specialist Hospital, Malaysia's #2 account, is **−32%** once its 3 records are merged |
| Forecast (Pulse only, never in the close) | Off by **11 → 9 per 100 ordered** (Products A + B, illustrative) |
| Duplicate matcher (held-out TH/VN/MM) | **Precision 0.929 / recall 0.867**: 93 of 100 warnings are real, and it catches 87 of 100 duplicates |
| Inbox triage (blind) | **0.917**: 92 of 100 sorted correctly on 60 unseen messages |

★ = the five questions we are most likely to get. Answer in 2–4 sentences, then stop. Questions 1–15 are the core set; 16–18 are extras.

### 1. ★ Why not just use SAP Business One's own approval procedures?
B1's approval procedures are **document-centric**: they gate sales, purchasing, inventory and payment documents. SAP's own course material lists no business-partner, item or cost-centre object among them. Even with a workaround, you would still lack structured intake, a duplicate check, Teams routing and parallel approvals with an SLA, and those are exactly the problems in the brief. So approvals run in Microsoft 365, where people already work, and **SAP B1 stays the system of record**: every approved record still lands there.

### 2. ★ The brief says there is no dev team. Why build a custom app?
The Next.js prototype is only a **demo vehicle**. Every screen has an "In production" badge, and `/architecture` maps each screen to its **M365 equivalent**: a Power Apps canvas app, a SharePoint List, Power Automate with the *standard* Approvals connector, and Teams Adaptive Cards. There is no Dataverse and no premium connector. A **lean team of 2 people builds it in 6 weeks**. The **MDM team configures** fields, routes and new BUs without IT; a **contractor works ~15 days** on the matcher and forecast; an SAP partner is needed only in phase 2. The repo already ships the production kit: the Adaptive Card JSON, a flow spec, DTW templates and the SharePoint schema.

### 3. ★ What does this cost in licences?
**Phase 1 needs no new licences for the workflow**, because it uses SharePoint, the standard Approvals connector, Teams and DTW, all covered by the M365 Lives already pays for. Phase 2, which posts records automatically through the Service Layer and happens only after the pilot proves the KPIs, adds **≈ USD 1,980/yr** (Process licence USD 150/month + 1 Premium maker USD 15/month ≈ S$2,633). Pay-as-you-go is cheaper below about 250 runs a month. The one possible extra is **Power BI Pro for the ~10 regional viewers**, if Lives doesn't already license it; that is for the regional dashboard, not the workflow.

### 4. How does the duplicate check work, and how accurate is it?
The check first normalises the name: case, punctuation, legal suffixes, and abbreviations such as Natl / Univ / Hosp. It then scores the name with token-set and Jaro-Winkler similarity and adds exact tax-ID and postcode matches. That is how "Natl Univ Hosp" finds National University Hospital C-SG-00017. We tuned the threshold on Singapore and Malaysia and report accuracy on **Thailand, Vietnam and Myanmar, which the matcher never saw: precision 0.929, recall 0.867** (13 found, 2 missed, 1 false alarm). The test data includes romanisation variants, typos and blank tax IDs that the normaliser was *not* built for. The matcher only suggests; **MDM confirms**, and an override needs a written reason that is logged and flagged.

### 5. ★ Is this real data?
No. **It is synthetic and labelled that way on every chart.** One seeded script generates it, every parameter is published in `analytics/params.yaml`, and every pattern we planted is listed in `analytics/PATTERNS.md`. A good score therefore shows that the pipeline *can* find these patterns, not that they exist at Lives. That is why **week 1 of the pilot reruns the same scripts unchanged on SAP B1 extracts**: ORDR/RDR1 (orders), OQUT (quotations), OCRD (business partners) and OITM (items).

### 6. Why should we believe the forecast improvement?
The backtest is **leak-free and pre-registered**: six origins (end of Mar to end of Aug 2026), 1–3 months ahead, with the model refitted at each origin on data up to that point only. It wins 7 of 10 country × product cells and we show the 3 losses. We're upfront that **the gain is seasonal**: at off-season origins it shrinks to 0.2 points. In the stress test, switching seasonality off makes our advantage ≈ 0 (−0.6 points), so the method does not invent signal. Two more caveats: **on uncleaned records our model is worse than today's method (15 vs 13 per 100)**, which is why we clean the data first; and Product C (instruments) is planned from the tender pipeline, not forecast.

### 7. How do you protect bank details and credit terms?
Sensitive values **never travel in a message**. The Teams card shows "•••• · view in OneRecord (Finance and MDM only)". In production the values sit in a **restricted SharePoint list with item-level permissions** behind Entra ID; SharePoint has no column-level security, which is why they live in a separate list. Vendor bank details also need a **call-back to an independently sourced number**, logged with who verified it and when. **Segregation of duties** is built into routing: requestors and their delegates can't approve their own request, the Finance approver can't be the MDM keyer, and any bank field or a credit limit over S$50k adds a Finance Director step. Every view and decision goes on an **audit trail with a SHA-256 hash chain**. In the prototype, masking is enforced only in the UI, and the screens say so.

### 8. How do you get people to stop using email?
We remove the alternative and make the new way easier. After 4 weeks, **the MDM mailbox auto-replies with the form link**. **Approvals happen inside Teams** in one click. Requestors can see status, so they stop chasing. Each entity and country has a **champion**, onboarding takes 30 minutes, and a weekly **SLA scoreboard** shows who is waiting on whom. The target is **≥ 90% of requests through OneRecord by week 6**.

### 9. ★ What sits behind "payback in about 6 months"?
The rate is **S$50 an hour** loaded cost, derived from the MOM 2025 median wage plus bonus and CPF. **1.25 hours are saved per request** (rework 0.40 + forwarding and chasing 0.50 + keying vs DTW 0.35). The base volume is **80 requests a month**, and we add 40 h a month of regional consolidation. That gives ≈ 1,751 h a year, or S$81.5k net after run cost. **Phase 1 costs S$39.9k, so payback is 5.9 months.** It is **9.6 months at 40 requests and 4.2 at 120**, and 8.3 months at base on workflow hours alone. Approver time and stuck-demand revenue are *not* counted in payback.

### 10. What happens when an approver is on leave?
An out-of-office approver's step goes **automatically to their delegate**. If nobody acts, there is a **reminder after 1 business day** and an **escalation after 3 business days**, to the delegate or else the manager. The original approver stays on the audit trail. Segregation-of-duties rules still apply to the delegate, so a delegate can't approve their own manager's request.

### 11. Lives runs in five countries. What about time zones?
The spread is small: Myanmar is UTC+6:30 and Singapore and Malaysia are UTC+8, so the gap is at most 1.5 hours. Approvals are **asynchronous in Teams**, so nobody needs to be online at the same moment. Every request carries its entity and country. In production, SLAs count **business days in the approver's own time zone and holiday calendar**. The prototype uses one simulated SGT clock, and per-country SLA calendars are on the roadmap.

### 12. Why a DTW import file in phase 1 instead of posting through the Service Layer?
The DTW file **keeps an MDM human check** before anything enters SAP, a control we want anyway while trust in the new process builds. Automatic posting saves only the load step, about 0.15 h per request: **≈ 12 h a month at 80 requests**. Against S$2,633 of licences and S$3,375 of maintenance a year, that nets about S$1.2k, so the S$22.5k build would take **~19 years to pay back** (~4.7 years at 120 requests a month). Phase 2 is therefore justified by speed (same-day posting) or scale, not hours. We already generate and validate the Service Layer payload ("Phase 2: not sent"), so we can switch it on later.

### 13. What did you deliberately not build, and why?
These were design choices, not time cuts:
- **Automatic SAP posting** doesn't pay back at this volume (Q12).
- **Merging existing SAP duplicates** is a separate stewardship project.
- **A security model of our own** isn't needed: SSO, encryption and DLP come from M365 and Entra ID.
- **A drag-and-drop workflow designer** isn't needed, because form-based config is enough for the MDM team.
- **Deep-learning forecasting** can't be justified on monthly data at this scale.
- **Change requests** other than Extend are out of scope.

The prototype also runs **no live LLM**: paste-to-fill uses rules plus cached extractions, badged as such, and an in-tenant LLM is on the roadmap.

### 14. How does "Extend to my entity" work in SAP B1?
There is **one shared business-partner record**: one hospital, one record. Extending it does not create a second customer. It **updates the existing BP**: the new entity is added to the **U_Entities UDF**, and if credit terms change, the Finance-approved payment terms and credit limit are added too. That's why Marcus's request routes to **Business Support + Finance (Wei Jie) → MDM**. In phase 1 it is a DTW update row keyed by CardCode; in phase 2 it is a `PATCH /b1s/v2/BusinessPartners('C-SG-00017')`. This is labelled as an assumption (A28). If the entities run separate B1 company databases, we would instead create a linked record carrying the same golden ID.

### 15. How exactly do you define growth, and why not compare half-years?
**Growth = PO value (Oct 2025–Sep 2026) ÷ PO value (Oct 2024–Sep 2025) − 1**, per country × product, on de-duplicated customers. We use SGD across products and units within a product. Momentum compares Jul–Sep 2026 with Jul–Sep 2025 (+7.6%). We don't compare half-years because the dengue season (May–Oct), fiscal-year flushes (SG/MM Mar, MY/VN Dec, TH Sep) and CNY/Tet would make that comparison measure **seasonality, not growth**. Only confirmed POs count as demand. PRs are pipeline, enquiries are a leading indicator, and MDM setups are internal work on their own axis.

### 16. How accurate is the inbox sorting?
On a **blind set of 60 messages written without seeing the rules, it sorts 92 of 100 correctly (0.917)**, and 88 of 100 on the 33 deliberately tricky ones. It is rules-based and shows the rule that fired, so every decision can be explained. An earlier version scored only 47% blind, so we rebuilt the rules on an independent development set; that is why we test blind. **A person still confirms every routing.**

### 17. What happens to the duplicates already in SAP?
Version 1 **does not touch existing SAP records**. A **read-only golden-ID crosswalk** links duplicate CardCodes to one customer for analytics, and that crosswalk is what reveals Bukit Damai at −32%. The intake check stops *new* duplicates. Retiring old records that have open documents and history needs Finance sign-off and cut-over planning, so it is a **separate stewardship project**, prioritised by the crosswalk.

### 18. ★ What is the biggest risk to adoption, and how will you measure success in the pilot?
The biggest risk is **habit**: requestors keep emailing, and approvers ignore one more notification. The mailbox auto-reply, approvals inside Teams and the weekly SLA scoreboard target exactly that. The pilot runs **6 weeks in SG + MY, on the Customer and Item domains, for SPD and QTS**. KPIs: **≥ 90% of requests through OneRecord**, **median ≤ 4 business days** (baseline 14 calendar days), **bounce < 15%** (baseline 40%), duplicates intercepted, and a falling stuck-demand trend. **Kill or scale at week 6**: if the median is above 6 business days or adoption is below 70%, we fix or stop; otherwise we roll out to TH/VN/MM and the Vendor and Cost-centre domains.

### Show if asked (live, about 10 seconds each, never in the main demo)

| If they ask about… | Do this |
|---|---|
| Approver has a question | Load *weijie-teams* → **Ask a question** on the Teams card |
| Reminders and escalation | On Approvals, the **Simulated time** card → **+1 business day** (reminder), **+3 business days** (escalation) |
| Approver on leave | Approvals → **Out of office** toggle → the delegate (e.g. Rachel Koh) takes the step |
| Inbox sorting | Sidebar → **Inbox triage** (rule shown for each message; a person confirms) |
| Tamper-evident audit | Any request page → Audit trail → **Verify chain**, then **Simulate tamper** |
| "What if volume is lower?" | Sidebar → **Impact** → 40 / 80 / 120 buttons or the slider; everything recomputes |
| "Which numbers are assumptions?" | Sidebar → **Assumptions** (A1–A28, searchable), or "What's real here?" on Regional Pulse |
| Forecast detail | Regional Pulse → Forecast check → **Replay**; pick a country and product; the scorecard shows wins *and* losses |

---

## 5. Morning checklist (wake 07:30 · target 11:30 · hard deadline 12:00 SGT)

Decision rule: **if you reach 10:30 without a YouTube link, upload the neural-voice video as-is.** Don't let polish push you past the deadline.

| # | When (duration) | Do this | If it fails |
|---|---|---|---|
| 1 | 07:30–07:40 (10 min) | Open the submission form **signed in with your SMU Google account**. Both links in the brief redirect to the same Google Form, and it needs sign-in. Note every required field and file (format and size limit for the PDF). **Don't submit yet.** | Try an incognito window signed in with the SMU account only, then the other link in the brief. If it is still blocked, email the organisers now with a timestamp; don't wait until 11:30. |
| 2 | 07:40–07:50 (10 min) | Tell Claude **"deploy"**. Run `! npx vercel login` → **Continue with GitHub** (1 min). Claude deploys with `--prod` and gives you the live URL. Open it in incognito and click Home, `/demo` and `/pulse`. | If Vercel fails, submit with the **GitHub link + the video**; the video is the main proof. Claude can try the GitHub Pages fallback, but don't spend more than 15 minutes on it. |
| 3 | 07:50–08:40 (5–50 min) | Watch `deliverables/video/OneRecord-demo.mp4` all the way through. **Either** upload it as-is (neural voice) **or** record your own voice over `OneRecord-demo-silent.mp4` using `voiceover-script.md`. In Clipchamp: Create video → import the silent MP4 → Record → Voiceover. You don't need a screen recorder (Win+Alt+R), because the screen is already recorded. Keep it under 3:00 and export in 1080p. | If your own take drifts or runs long, or it is 09:00 and you're not done, **use the neural-voice MP4 as-is**. |
| 4 | 08:40–09:00 (20 min) | Upload to YouTube as **Unlisted** (*not* Private), title **"OneRecord — Lives Group MDM (SMU DSA 2026)"**, Made for kids = No. Wait about 10 minutes for HD to process, then **play it in an incognito window**. | If HD is still processing, SD playback is fine, so carry on. If the upload fails, use a Google Drive link set to "Anyone with the link can view" and check it in incognito. |
| 5 | 09:00–09:20 (20 min) | Give Claude the YouTube link **and your team name** (both slide footers say only "SMU DSA 2026" until then). Claude updates the **slides, README and `/pitch/close`**, re-exports the **2-slide PDF** and redeploys. Open the PDF and check that the links and QR codes work. | Paste the links straight into the form fields, and edit the README on GitHub's website. A PDF without the video link still counts if the link is in the form. |
| 6 | 09:20–09:30 (10 min) | Say **"make the repo public"** (the secrets scan is already done). Open **github.com/ethantyh03/onerecord** in incognito and confirm it loads without sign-in. | Do it by hand on GitHub: Settings → Danger Zone → Change visibility → Public. |
| 7 | 09:30–11:30 (≈ 20 min of work + buffer) | Fill in the form with the **YouTube link, GitHub link, live URL and the 2-slide PDF**. Check each link once more, then **submit by 11:30** and **screenshot the confirmation page**. Use the spare time to read the Q&A bank above. | If the PDF upload is rejected (size or type), link the PDF from the repo or Drive in a text field. If the form breaks, email the organisers every link and the PDF **before 12:00**, along with your screenshot. |

**Own-voice tips for step 3.** If Clipchamp's voiceover recorder misbehaves, record each beat in the Windows **Sound Recorder** app instead, then drag the `.m4a` files onto the timeline under the silent video and line each one up with its beat. Read the script **one beat at a time** with a 2-second gap, and record 10 seconds of room silence first.

---

## 6. What is real and what is simulated

Use this table when a judge asks "is that real?" Answer plainly and point to the label on screen; every simulated element is badged in the app.

| Element | Status | What to say |
|---|---|---|
| Customers, items, orders, PRs, enquiries, MDM history | **Synthetic** | Generated by one seeded script (seed 42) with published parameters and planted patterns. All names are fictional except the brief's National University Hospital, which appears as a master record only, with no sales. |
| Amy's 18 days | **From the brief** (App C) | The split into 2 / 5 / 9 / 2 days is our illustrative breakdown. |
| Paste to fill | **Rules + cached example** | No live LLM in the prototype. An in-tenant LLM is phase 2, and the badge says so. |
| Duplicate matcher | **Real algorithm** | It runs in the browser. Accuracy (0.929 / 0.867) was measured on held-out synthetic TH/VN/MM records. |
| Routing, completeness rules, SLA dates, config versions | **Real logic** | The real engine, running in a per-browser sandbox. Production equivalent: Power Automate + SharePoint. |
| Teams card and Outlook email | **Simulated display** | The Adaptive Card JSON is real (Card JSON tab). In production, Power Automate posts it. |
| Clock | **Simulated** | Fixed at Wed 28 Oct 09:00 SGT, with fast-forward. |
| Masking of credit and bank values | **UI-enforced in the prototype** | Production: a restricted SharePoint list + Entra ID item-level permissions. |
| Audit trail hash chain | **Real SHA-256, in the browser** | Production: SharePoint version history, Purview logs and a hash column. |
| DTW import files | **Real CSVs** in DTW template format, downloadable | Never loaded into a real SAP (no licence). The SAP B1 window is a labelled simulation. |
| Service Layer payload | **Generated and validated, never sent** | Phase 2, "not sent". |
| Stuck demand (S$345,800 → S$309,800) | **Live from the sandbox** | Computed on synthetic PRs. |
| Regional Pulse figures (S$53.4M, −32%, 25 of 388) | **Real pipeline, synthetic data** | Computed by the Python analytics pipeline. The method is real; the values are not Lives's. |
| Forecast backtest and stress test | **Real method, synthetic data** | Pre-registered and leak-tested. The gain must be re-measured on 24–36 months of real B1 orders in the pilot. |
| Business case (5.9 months, 1,751 h) | **Computed from labelled assumptions** | A12–A26. Each input is shown on `/impact` and `/assumptions`. |
| Inbox triage | **Real rules, blind-tested** | Tested on 60 synthetic messages. A person confirms every routing. |
| Personas (Amy, Marcus, Wei Jie, Priya…) | **Fictional** | Built from the roles in the brief. |
| The web app itself | **Demo vehicle** | Production is Power Apps + SharePoint + Power Automate + Teams, as shown on `/architecture`. |
