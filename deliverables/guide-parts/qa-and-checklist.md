# Presenter guide: finals Q&A bank and morning checklist

All data in OneRecord is **synthetic and illustrative**. Quote numbers only as they appear in `src/data/summary.json`, `impact.json` and `meta.json`. Never name the real company behind the case.

## Numbers to know by heart

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

---

## A) Finals Q&A bank (18 questions)

★ = the five questions we are most likely to get. Answer in 2–4 sentences, then stop.

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
Sensitive values **never travel in a message**. The Teams card shows "•••• · view in OneRecord (Finance only)". In production the values sit in a **restricted SharePoint list with item-level permissions** behind Entra ID; SharePoint has no column-level security, which is why they live in a separate list. Vendor bank details also need a **call-back to an independently sourced number**, logged with who verified it and when. **Segregation of duties** is built into routing: requestors and their delegates can't approve their own request, the Finance approver can't be the MDM keyer, and any bank field or a credit limit over S$50k adds a Finance Director step. Every view and decision goes on an **audit trail with a SHA-256 hash chain**. In the prototype, masking is enforced only in the UI, and the screens say so.

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

---

## B) Morning checklist (wake 07:30 · target 11:30 · hard deadline 12:00 SGT)

Decision rule: **if you reach 10:30 without a YouTube link, upload the neural-voice video as-is.** Don't let polish push you past the deadline.

| # | When (duration) | Do this | If it fails |
|---|---|---|---|
| 1 | 07:30–07:40 (10 min) | Open the submission form **signed in with your SMU Google account**. Both links in the brief redirect to the same Google Form, and it needs sign-in. Note every required field and file (format and size limit for the PDF). **Don't submit yet.** | Try an incognito window signed in with the SMU account only, then the other link in the brief. If it is still blocked, email the organisers now with a timestamp; don't wait until 11:30. |
| 2 | 07:40–07:50 (10 min) | Tell Claude **"deploy"**. Run `! npx vercel login` → **Continue with GitHub** (1 min). Claude deploys with `--prod` and gives you the live URL. Open it in incognito and click Home, `/demo` and `/pulse`. | If Vercel fails, submit with the **GitHub link + the video**; the video is the main proof. Claude can try the GitHub Pages fallback, but don't spend more than 15 minutes on it. |
| 3 | 07:50–08:40 (5–50 min) | Watch `deliverables/video/OneRecord-demo.mp4` all the way through. **Either** upload it as-is (neural voice) **or** record your own voice over `OneRecord-demo-silent.mp4` using `voiceover-script.md`. In Clipchamp: Create video → import the silent MP4 → Record → Voiceover. You don't need a screen recorder (Win+Alt+R), because the screen is already recorded. Keep it under 3:00 and export in 1080p. | If your own take drifts or runs long, or it is 09:00 and you're not done, **use the neural-voice MP4 as-is**. |
| 4 | 08:40–09:00 (20 min) | Upload to YouTube as **Unlisted** (*not* Private), title **"OneRecord — Lives Group MDM (SMU DSA 2026)"**, Made for kids = No. Wait about 10 minutes for HD to process, then **play it in an incognito window**. | If HD is still processing, SD playback is fine, so carry on. If the upload fails, use a Google Drive link set to "Anyone with the link can view" and check it in incognito. |
| 5 | 09:00–09:20 (20 min) | Give Claude the YouTube link. Claude updates the **slides, README and `/pitch/close`**, re-exports the **2-slide PDF** and redeploys. Open the PDF and check that the links and QR codes work. | Paste the links straight into the form fields, and edit the README on GitHub's website. A PDF without the video link still counts if the link is in the form. |
| 6 | 09:20–09:30 (10 min) | Say **"make the repo public"** (the secrets scan is already done). Open **github.com/ethantyh03/onerecord** in incognito and confirm it loads without sign-in. | Do it by hand on GitHub: Settings → Danger Zone → Change visibility → Public. |
| 7 | 09:30–11:30 (≈ 20 min of work + buffer) | Fill in the form with the **YouTube link, GitHub link, live URL and the 2-slide PDF**. Check each link once more, then **submit by 11:30** and **screenshot the confirmation page**. Use the spare time to read the Q&A bank above. | If the PDF upload is rejected (size or type), link the PDF from the repo or Drive in a text field. If the form breaks, email the organisers every link and the PDF **before 12:00**, along with your screenshot. |
