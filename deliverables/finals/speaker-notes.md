# OneRecord finals: speaker notes and run card

**Fri 30 Oct 2026, 14:50–15:10 SGT** · CTFudders (Joash, Ethan) · 15:00 max talk + 5:00 Q&A · one screen, mirrored.
Plan **13:26** (slides 4:08 → live demo 5:00 → slides 4:18). Realistic 13:30–14:30: the demo decides it.
Generated from the deck itself (`src/components/deck/slides-config.ts`), so these are the exact words on the slides' notes.
All data is synthetic and illustrative; every figure is in the numbers ledger of `docs/superpowers/deck-content.md`.

---

## 1. Run card (print this page; the non-speaker holds it and keeps time on a phone)

| # | Who | Clock | Presses | Open with |
|---|---|---|---|---|
| 1 OneRecord | Joash | 0:00–0:10 | 2 (build) | Good afternoon. We're Joash and Ethan from CTFudders. |
| 2 Amy needed one item code | Joash | 0:10–0:45 | 1 | Amy is a product manager. She needed one new item code for a lab consumable her team was importing. |
| 3 One hospital, three customers | Joash | 0:45–1:10 | 1 | The same email habit creates customer records. |
| 4 Merged: Malaysia's #2 account, down 32% | Joash | 1:10–1:38 | 1 | Merge them, and it's one hospital: Malaysia's second-biggest account, down thirty-two percent. |
| 5 One root cause, five symptoms | Joash | 1:38–2:13 | 1 | We read the brief as one root cause with five symptoms. |
| 6 Four rules for a good fix | Ethan | 2:13–2:53 | 1 | Thanks, Joash. Before building anything, we set four rules. |
| 7 OneRecord in one picture | Ethan | 2:53–3:48 | 2 (build) | Here's OneRecord in one picture. Amy's email becomes a form that knows an IVD item needs a licence number, and the bank details are stripped out. |
| 8 Now the live demo | Ethan | 3:48–4:08 | 1 → demo | Now the live demo. Five people, one request, about five minutes. |
| **LIVE DEMO** (5 beats) | Ethan | 4:08–9:08 | | "She pastes her old email, and the form fills itself." Back with **Ctrl+1** → slide 9 |
| 9 What Regional Pulse tells a manager | Ethan | 9:08–9:53 | 1 | Here's what you just saw, the way a manager reads it. |
| 10 14 days to 4 business days or less | Joash | 9:53–10:33 | 2 (build) | Thanks, Ethan. Today a new record takes a median of fourteen days: it waits, it bounces, then three approvers sign one after another. |
| 11 The business case | Joash | 10:33–11:18 | 1 | Phase one costs thirty-nine thousand nine hundred dollars, and most of that is internal time. |
| 12 The six-week pilot | Joash | 11:18–12:08 | 1 | We'd prove it in six weeks, in Singapore and Malaysia, on customers and items, for two business units. |
| 13 Risks and adoption | Joash | 12:08–12:48 | 1 | The biggest risk isn't technology; it's habit. |
| 14 One hospital. One record. | Joash | 12:48–13:26 | 1 | So, our ask. Approve phase one: thirty-nine thousand nine hundred dollars, mostly internal time, no new licences, and a six-week pilot in Singapore and Malaysia, judged at the week-six gate. |

**Checkpoints**

- Demo starts by 4:15. Behind? Cut in this order: Marcus's admin scene (one line instead), Wei Jie's detail view, slide 13.
- Demo ends by 9:15 (after 9:40: cut slide 13).
- Close (slide 14) starts by 13:00; never after 14:15.
- If the live demo breaks: play deliverables/video/OneRecord-demo.mp4 (2:54), then slide 9.

**Handoffs:** Joash → Ethan at slide 6 ("Thanks, Joash."). Ethan → Joash at slide 10 ("Thanks, Ethan."). Joash opens and closes.

---

## 2. Before you go on (by 14:30)

1. **Freeze `src` by 14:00** and present from a production build (Vercel after commit + push, or `npm run build` then
   `npm run start -- -p 3200`). From `next dev`, a teammate's save can reload the page mid-demo.
2. Chrome, **zoom 125%** on the deck's address (Ctrl + `+` twice). Pre-warm every scene once, then **Reset demo**.
3. **Tab 1:** `/deck?standby=1` (the return tab). **Tab 2:** `/deck` (present from here). Then **F11**.
4. Do not press **N** on stage (mirrored screen: the notes would go on the projector). Use this card.
5. Rehearse the return twice: on slide 8 press →, click around the app, then **Ctrl+1**: tab 1 is on slide 9.

## 3. Keys

| Key | Does |
|---|---|
| → · Space · PageDown (clicker) | Next. Slide 1: the first press flickers the wordmark in and starts the talk clock |
| ← · PageUp | Back |
| Shift+→ on slide 8 | Skip the demo, straight to slide 9 |
| **Ctrl+1** (or Ctrl+Tab) | After the demo: back to the return tab, already on slide 9. **Never the Back button** |
| Number, then wait · End | Jump (1 4 = slide 14) · End = slide 14 |
| A then a number | Appendix slide for Q&A (A 4 = duplicate check) · **I** = index of all slides |
| B or . | Black screen (again to return) |
| T | Restart the talk clock |
| F11 | Full screen (browser) |

Two slides are **two-press builds**: **7** (the form fills and holds; → draws the flow) and **10** (today's 14 days
hold; → shrinks them). The [→] in the script below marks the press.

---

## 4. Slide by slide

### 1 · OneRecord

**Joash** · 10 s · clock 0:00–0:10 · 22 words · 2 presses

*On screen / cue:* Up while the room settles. Press → on “Good afternoon”: the wordmark flickers in (T1). Press → again for the hook.

> Good afternoon. We're Joash and Ethan from CTFudders. Our case is master data at Lives Group, and we'll start with one request.

### 2 · Amy needed one item code

**Joash** · 35 s · clock 0:10–0:45 · 81 words

*On screen / cue:* The day counter runs 1 → 18 by itself (≤ 4 s). Let it finish before the money line.

> Amy is a product manager. She needed one new item code for a lab consumable her team was importing. She copied an old email to the MDM mailbox. It bounced for a missing Quality field, then went to three approvers, one at a time. Eighteen days later, she tried to raise a sales order, and the item still wasn't in SAP. In our illustrative data, one point three four million dollars of customer orders waited on setups like hers last year.

### 3 · One hospital, three customers

**Joash** · 25 s · clock 0:45–1:10 · 37 words

> The same email habit creates customer records. Here are three customers from our illustrative SAP data. One looks flat, one looks lost, and one looks brand new. A sales team would write one off and celebrate another.

### 4 · Merged: Malaysia's #2 account, down 32%

**Joash** · 28 s · clock 1:10–1:38 · 41 words

*On screen / cue:* T2 plays on arrival from slide 3: slide 3's headline holds while the rows fuse (≈1 s), turns into “down 32%” as the merged row lands, then 388 dots become 363 (≈1.5 s). Start talking as the headline changes.

> Merge them, and it's one hospital: Malaysia's second-biggest account, down thirty-two percent. Nobody calls, because on paper nothing looks wrong. Across five countries, twenty-five of three hundred and eighty-eight customer records are duplicates. That's our thesis: messy master data hides money.

### 5 · One root cause, five symptoms

**Joash** · 35 s · clock 1:38–2:13 · 68 words

*On screen / cue:* Last Joash line before the handoff. Step back on the last word.

> We read the brief as one root cause with five symptoms. Requests arrive as free text, so they bounce. Nobody can check whether a record exists, so duplicates get in. Approvals go one person at a time, so a setup takes a median of fourteen days. Sensitive fields travel in email, and every new business unit needs IT. And the regional numbers are built on those same records.

### 6 · Four rules for a good fix

**Ethan** · 40 s · clock 2:13–2:53 · 79 words

*On screen / cue:* Handoff: Ethan starts with “Thanks, Joash.”

> Thanks, Joash. Before building anything, we set four rules. One: use what Lives already owns. Microsoft 365 is the front door, and SAP Business One stays the system of record, because its built-in approvals are document-centric. Two: one record per real customer. Three: fix the process before buying software, so approvers decide in parallel. Four: the MDM team owns the rules, not IT. A better template, or Teams Approvals alone, each fix half of this. We wanted both halves.

### 7 · OneRecord in one picture

**Ethan** · 55 s · clock 2:53–3:48 · 106 words · 2 presses

*On screen / cue:* Two presses. Arriving from slide 6 plays T3 (≈2 s): Amy's email fills the form, the bank number is struck out, “Regulatory licence no.” shows Needed, and it HOLDS. Say the first two sentences, pointing at Needed and the struck-out number. Press → on “That form is step one”: the form shrinks into step 1 and the flow draws (≈1.5 s).

> Here's OneRecord in one picture. Amy's email becomes a form that knows an IVD item needs a licence number, and the bank details are stripped out. **[→]** That form is step one. Before any approver sees it, we check that it's complete and not a duplicate. Approvers decide in parallel, on a Teams card, with a two-business-day clock. MDM does one final check, and SAP gets an import file through its own import tool. Once every hospital is one record, the regional numbers can be trusted. A lean team of two builds it, with about fifteen days of outside help and no new licences for the workflow.

### 8 · Now the live demo

**Ethan** · 20 s · clock 3:48–4:08 · 29 words

*On screen / cue:* Press → (or click the dimmed app frame): the sandbox resets to “Clean in: Amy raises a new item” and the frame zooms into the live app (T4). Shift+→ skips the demo. Coming back: the return tab (tab 1, /deck?standby=1) has already jumped to slide 9, so press Ctrl+1 (or Ctrl+Tab). Never the Back button.

> Now the live demo. Five people, one request, about five minutes. Everything runs live in this browser. Teams, SAP and the clock are simulated, and the data is synthetic.

#### Live demo (Ethan, 5:00). Scenes from `/demo` → Load scene; never reload `/pulse` before leaving it.

| Beat | Clock | Scene | Do |
|---|---|---|---|
| 1 · Amy | 0:00–1:10 | Clean in: Amy raises a new item (the deck loads it) | Paste to fill → Amy's old email → Fill the form. IVD → licence + QA/RA. Optional: Category = Instrument, then back. HSA-DE-0012345, sample certificate, Ambient. Submit → REQ-1100, 3 orders (S$36,000) linked. |
| 2 · Marcus | 1:10–2:05 | Admin adds Marcus's business unit, then Clean in: Marcus is stopped from creating a duplicate | Add business unit (MLS) → Save → “Config v2 live”. FIRST CUT if behind: skip the admin scene, just say “MDM added the business unit itself, no IT ticket.” Amber card: 100% match, C-SG-00017, same tax ID → Extend to my entity. Don't say the hospital's name. |
| 3 · Wei Jie | 2:05–2:50 | Clean in: Wei Jie approves in Teams | REQ-1101: payment terms 🔒, “Why you're seeing this”, due in 2 business days. Approve → Priya next. Optional (second cut): Open details → show values (logged). |
| 4 · Priya | 2:50–3:50 | Lands in SAP B1: Priya imports Amy's item | S$36,000 · 3 orders. Generate SAP B1 import (oItems.csv). Point at Service Layer (Phase 2), don't open. Mark created → I-B-000535. Regional Pulse: S$345,800 → S$309,800. |
| 5 · Pulse | 3:50–4:45 | Stay on /pulse (don't reload: it resets stuck demand) | Synthetic badge. Raw SAP records → Bukit Damai #7 / #10 / #11. Merge the duplicates → #2, −32%. “What we do about it”: BU Head, SPD Malaysia, by 13 Nov, S$620k. |
| Return | 4:45–5:00 | Ctrl+1 to the return tab (tab 1, already on slide 9) | “What does that mean for the region?” Never the Back button. |

If the live demo breaks: play `deliverables/video/OneRecord-demo.mp4` (2:54), then slide 9.

### 9 · What Regional Pulse tells a manager

**Ethan** · 45 s · clock 9:08–9:53 · 87 words

*On screen / cue:* Back from the app with Ctrl+1. The only slide with the forecast figure. End on “Joash, what's it worth?” If asked: growth is Oct 2025–Sep 2026 vs the 12 months before; the forecast is scored on 6 months the model never saw and loses 3 of 10 cells (A6); customer orders are demand, MDM setups are our own work, counted apart.

> Here's what you just saw, the way a manager reads it. Growth compares the same twelve months a year apart, on de-duplicated customers, so dengue season doesn't look like growth. Orders are fifty-three point four million dollars, up four percent. On our illustrative data, today's forecast is off by eleven units per hundred ordered; ours by nine, and we show where it loses. And every country gets an owner and a date: Malaysia's BU head calls Bukit Damai by the thirteenth of November. Joash, what's it worth?

### 10 · 14 days to 4 business days or less

**Joash** · 40 s · clock 9:53–10:33 · 79 words · 2 presses

*On screen / cue:* Handoff to Joash. Two presses. Arriving draws today's 14 days (≈1.5 s): waiting and a bounce, three approvers one after another, then the MDM queue. It HOLDS. Say the first sentence, then press →: the approvers go parallel and the bar shrinks to ≤ 4 business days inside the dashed 14-day outline (≈2 s). If asked “43% of what?”: in Amy's case, 6 of the 14 days saved come from approving in parallel, with no new software.

> Thanks, Ethan. Today a new record takes a median of fourteen days: it waits, it bounces, then three approvers sign one after another. **[→]** With one form, parallel approvals and an import file, the target is four business days or less. About forty-three percent of that saving is a pure process change: approving in parallel needs no new software. Across the region that's about seventeen hundred and fifty hours a year back: capacity for customer work, not a headcount cut.

### 11 · The business case

**Joash** · 45 s · clock 10:33–11:18 · 81 words

*On screen / cue:* The 80 row shows first; 40 and 120 follow.

> Phase one costs thirty-nine thousand nine hundred dollars, and most of that is internal time. There are no new licences for the workflow. We count hard hours only, at fifty dollars an hour. At eighty requests a month it pays back in five point nine months; at half that volume, still under ten. Automatic posting into SAP would take about nineteen years to pay back on hours, so that's phase two, and only if the pilot says speed is worth it.

### 12 · The six-week pilot

**Joash** · 50 s · clock 11:18–12:08 · 95 words

*On screen / cue:* If the demo ended after 9:40, skip slide 13: say “The biggest risk is habit, so after four weeks the MDM mailbox auto-replies with the form link.” here, then press End for the close.

> We'd prove it in six weeks, in Singapore and Malaysia, on customers and items, for two business units. In week one we rerun our analysis on real SAP extracts, so every number today gets re-measured. Success is ninety percent of requests through OneRecord, a four-business-day median, and fewer than fifteen percent bounced. At week six there's a gate: if the median is over six business days, or adoption is under seventy percent, we fix it or stop. If it works, we roll out to the other three countries, then add in-tenant AI and automatic posting.

### 13 · Risks and adoption

**Joash** · 40 s · clock 12:08–12:48 · 76 words

*On screen / cue:* First cut if running long. Close must start by 13:00, never after 14:15.

> The biggest risk isn't technology; it's habit. So we take the old path away: after four weeks, the MDM mailbox replies with the form link. Approving is one click in Teams, reminders go out after one business day, and a weekly scoreboard shows who's waiting on whom. Credit terms and bank details never travel in a message, and every view is logged. And because our data is synthetic, week one re-measures it on real SAP extracts.

### 14 · One hospital. One record.

**Joash** · 38 s · clock 12:48–13:26 · 77 words

*On screen / cue:* The line flickers in on arrival (T1, the bookend). Slow down on the last two lines; hold 2 seconds of silence before “Thank you.” No forecast figure here.

> So, our ask. Approve phase one: thirty-nine thousand nine hundred dollars, mostly internal time, no new licences, and a six-week pilot in Singapore and Malaysia, judged at the week-six gate. Setup goes from a median of fourteen days to four business days or less. About seventeen hundred and fifty hours a year come back, paying back in about six months. And the hospital hiding a thirty-two percent decline gets a call. One hospital. One record. Thank you.

---

## 5. Q&A: appendix slides (A then the number; answer in 2–4 sentences, then stop)

| Slide | Question it answers | Owner | Live fallback (≈10 s) |
|---|---|---|---|
| A1 Why not SAP's own approvals? | Why not SAP B1's own approval procedures? Why this, not something simpler? | Ethan | /impact → alternatives |
| A2 Who builds it, and licences | No dev team: why custom? What does it cost in licences? | Ethan | /architecture |
| A3 What sits behind the payback | What sits behind “payback in about 6 months”? | Joash | /impact → 40 / 80 / 120 buttons |
| A4 How the duplicate check works | How does the duplicate check work, and how accurate is it? | Ethan | New request → New Customer → MY · “Bukit Damai Spec Hosp” |
| A5 Is this real data? | Would these numbers hold on Lives's real SAP data? | Ethan | Pulse → “What's real here?” |
| A6 Why believe the forecast? | Why believe the forecast improvement? | Ethan | Pulse → Forecast check → Replay |
| A7 Bank data, duties, escalation | Bank and credit data? Segregation of duties? Approver on leave or not responding? | Ethan | Approvals → Simulated time → +1 / +3 business days; audit trail → Verify chain |
| A8 Import file now, and what we left out | Why an import file, not the Service Layer? What did you deliberately not build? | Joash | /scope |

### A1 · Why not SAP's own approvals? (Ethan)

> SAP Business One's built-in approvals are document-centric: they gate sales, purchasing, inventory and payment documents, and SAP's own course lists no business partner, item or cost-centre object among them. Even with a workaround, you'd still have no structured form, no duplicate check, no Teams routing and no parallel approvals on a clock. So approvals run in Microsoft 365, and SAP stays the system of record: every approved record still lands there.

### A2 · Who builds it, and licences (Ethan)

> The web app is only a demo vehicle; production is a Power Apps form, a SharePoint list and Power Automate with the standard Approvals connector, posting Teams cards. That needs no new licences for the workflow, because it's all inside the Microsoft 365 Lives already pays for. A lean team of two builds it in six weeks, the MDM team configures fields and routes without IT, and a contractor spends about fifteen days on the duplicate check. The only possible extra is Power BI Pro for about ten regional viewers, and only if Lives doesn't already have it.

### A3 · What sits behind the payback (Joash)

> We value time at fifty dollars an hour, derived from the national median wage plus bonus and CPF. Each request saves one and a quarter hours: rework, chasing, and keying replaced by an import file. At eighty requests a month, plus forty hours of regional consolidation, that's seventeen hundred and fifty-one hours a year, or eighty-one and a half thousand dollars net. So five point nine months to pay back; nine point six at forty requests. Approver time and revenue aren't counted.

### A4 · How the duplicate check works (Ethan)

> It cleans the name first, expanding abbreviations like “Hosp” and dropping “Sdn Bhd”, then scores how similar the names are, and an identical tax ID is near-certain. We tuned it on Singapore and Malaysia, froze it, and tested it once on the other three countries: it catches eighty-seven of every hundred duplicates, and ninety-three of every hundred warnings are real. It struggles most with romanised names and blank tax IDs, and we show those misses. It only suggests; MDM decides, and an override needs a logged reason.

### A5 · Is this real data? (Ethan)

> No. It's synthetic and labelled that way on every chart. One seeded script generates it, and every pattern we planted is listed, so a good score shows the pipeline can find these patterns, not that they exist at Lives. That's why week one of the pilot reruns the same scripts, unchanged, on SAP Business One extracts.

### A6 · Why believe the forecast? (Ethan)

> The test was fixed before we saw any result: six starting points, one to three months ahead, refitted each time on past data only. Ours is off by nine units per hundred ordered against eleven for today's method, and it loses in three of ten cells, which we show. The gain is seasonal; off-season it nearly disappears, and when we switch seasonality off, the advantage goes to zero, so it isn't inventing patterns. And on uncleaned records our model is actually worse, which is why we clean the data first.

### A7 · Bank data, duties, escalation (Ethan)

> Credit terms and bank details never appear in a message; the card links back to OneRecord, where only Finance and MDM can open them, and every view is logged. In production they sit in a restricted SharePoint list behind Entra ID. Nobody can approve their own request, and nobody can hold two steps of the same request. If an approver doesn't act, there's a reminder after one business day and an escalation after three, and the escalation follows the same rules.

### A8 · Import file now, and what we left out (Joash)

> The import file keeps a person checking before anything enters SAP, which we want while trust builds. Automatic posting only saves the load step, about twelve hours a month, so after licences and maintenance it takes about nineteen years to pay back. That makes it a speed decision for after the pilot, and the payload is already built and validated. We also left out merging old duplicates, our own security model and deep-learning forecasts, on purpose.

---

## 6. Lines never to say

- Never "18 → 4": the target is always "a median of 14 days → 4 business days or less" (Amy's 18 days is one case).
- The forecast figure (11 → 9 per 100) is on slide 9 only, never in the close.
- Never name a real hospital or the real company behind Lives Group. In the demo, don't read Marcus's hospital name aloud.
- Stuck demand: only ever S$345,800 → S$309,800 (what the screen shows).
- "43% of what?" → in Amy's case, 6 of the 14 days saved come from approving in parallel, with no new software.
