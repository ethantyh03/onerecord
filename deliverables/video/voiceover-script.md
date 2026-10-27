# OneRecord demo: voice-over script

Read this over the silent cut (`OneRecord-demo-silent.mp4`, **2:53**). Each beat below gives its window in the video and the moment to **start speaking** (the TTS take, en-US-AndrewNeural at +3%, starts there in `OneRecord-demo.mp4`). The TTS voice-over itself runs **2:42**; the rest is holds. The hard ceiling is 2:55. The same text is in `recording/storyboard.json`, and the captions are in `OneRecord-demo.srt`.

**Pace.** Aim for about **150 words a minute**. That is slower than you think, so read as if you were explaining it to a friend across a table. If a beat runs long, cut a hold, not your breath.
- `/` means a short pause (about half a second).
- `//` means a full stop and a breath (about one second).
- **Bold** words carry the stress. Lift them a little; don't shout them.
- Numbers are written out the way you say them. Say "S$" as "dollars".

**Mic tips**
- Use a headset or USB mic, about **two fingers from the corner of your mouth** and slightly off to the side, so P and B sounds don't pop.
- Record in a small, soft room: a wardrobe, or a bedroom with the curtains shut. Turn off fans and air-con, and silence your phone.
- Record a **10-second room-tone** gap first (silence), so the editor can clean noise.
- Do the whole script **one beat at a time**: say the beat, pause two seconds, then go on. If you stumble, pause and re-read from the start of that sentence. Cut the mistakes later.
- Stand up or sit tall, smile on the hook and the close, and drink water, not coffee.
- Set your input level so the loudest word peaks around −6 dB. Export WAV or 192 kbps MP3.

The data is **synthetic and illustrative**. Never name the real company. SAP Business One is "**document-centric**". Never say it "can't" approve master data.

---

### 1. Hook (0:00–0:10)
**Start speaking at 0:00** (0.6 s) · TTS line lasts 8.5 s · window 10.8 s

**On screen:** Black screen; the day counter runs 1 → 18 as the faded email trail builds up ("Scenario from case brief, Appendix C").

> Amy needed **one** new item code. // It took **eighteen days**, / a **bounced** request / and three approvers **one at a time**, / and her sales order **still failed**.

*(Slow and flat, then let "still failed" land. Leave about two seconds of silence while the counter finishes.)*

### 2. Frame (0:10–0:22)
**Start speaking at 0:11** (11.1 s) · TTS line lasts 10.8 s · window 11.8 s

**On screen:** Home. The badge "Runs on Microsoft 365 · lands in SAP Business One", the three spellings caught at intake, then a slow scroll to the process diagram with its CLEAN IN and MONEY OUT labels.

> At Lives Group, / master data is created **by email**. // Records arrive **incomplete** or **duplicated**, / so the regional numbers **can't be trusted**. // OneRecord fixes **both ends**.

### 3. Clean in: Amy (0:22–0:49)
**Start speaking at 0:22** (22.8 s) · TTS line lasts 25.7 s · window 26.7 s

**On screen:** Amy's new-item form. "Amy's old email" fills the paste box, "Fill the form" fills 10 fields (K2EDTA Blood Collection Tube 4 mL, 100/pk), the category is "Lab consumable – IVD medical device" and Dr Ploy Srisuk (QA/RA) joins the route. She types the licence HSA-DE-0012345, attaches the sample certificate, picks the storage condition, and the card reads "Expected live in SAP B1: Tue 3 Nov". Submit → REQ-1100 with 3 waiting customer orders (S$36,000) linked.

> Amy's item is a **blood collection tube**: / a lab consumable regulated as an **IVD**, / an **in-vitro diagnostic** device. // She pastes her **old email**, / and the form **fills itself**. // As an IVD, / it **needs a licence number**, / and **Quality** joins the route **automatically**: / the step she **missed** last time. // Before submitting, / she sees her approvers, / all **in parallel**, / and her go-live date: / **Tuesday, the third of November**.

### 4. Clean in: Marcus (0:49–1:05)
**Start speaking at 0:49** (49.5 s) · TTS line lasts 15.7 s · window 16.5 s

**On screen:** Admin: "Add business unit" opens prefilled for MLS — Meridian Life Sciences; Save → "Config v2 live". Cut to Marcus's form: he retypes "Natl Univ Hosp", the amber card finds National University Hospital · C-SG-00017 (100%, same tax ID), he clicks "Extend to my entity", sets "Changes credit terms? = Yes" and Tan Wei Jie (Finance) joins Business Support before the MDM check.

> Marcus is from a **new** business unit, / Meridian Life Sciences. // He types a hospital **in shorthand**, / and OneRecord finds it **already on file**. // So he **extends** that record to his entity, / instead of creating a **duplicate**. // Business Support and **Finance** check it, / then MDM.

### 5. Clean in: Wei Jie (1:05–1:21)
**Start speaking at 1:06** (66.0 s) · TTS line lasts 15.1 s · window 15.9 s

**On screen:** Wei Jie's Approvals page with the Teams card: credit terms show "•••• · view in OneRecord (Finance and MDM only)". He clicks Approve (toast), opens the details, reveals the credit values (the view is logged), and the audit trail shows his approval and the logged view.

> Wei Jie in Finance approves on a **Teams card**, / where he **already works**. // Credit terms **never travel** in the message. / Only **Finance and MDM** can open them, / inside OneRecord. // **Reminders** go out before anything stalls, / and **every decision** is logged.

### 6. Lands in SAP B1 (1:21–1:53)
**Start speaking at 1:21** (81.9 s) · TTS line lasts 31.6 s · window 32.2 s

**On screen:** The /architecture swimlane (about 10 s): Power Apps form → Teams approvals → DTW import file, SAP Business One as the system of record. Cut to Priya's MDM console: "Generate SAP B1 import", the DTW preview with SAP's own field names in the two header rows, a hover on the "Service Layer (Phase 2)" tab (not opened, so no JSON on screen), 2 s on the audit trail, then the "Mark created in SAP B1" button.

> SAP Business One's **built-in approvals** are **document-centric**, / designed around **documents** like sales orders. // So approvals for master data live in **Microsoft 365**, / and SAP stays the **system of record**. // Priya clicks **Generate SAP B1 import**, / and gets a **Data Transfer Workbench** file: / the import format SAP **already reads**, / with SAP's **own field names**. // Sending it **automatically**, / through SAP's Service Layer, / is **phase two**. // Today, / she loads the file / and marks the item **created**.

### 7. Bridge (1:53–2:03)
**Start speaking at 1:54** (114.1 s) · TTS line lasts 8.5 s · window 9.8 s

**On screen:** Priya clicks "Mark created in SAP B1": toast "I-B-000535 created · Amy notified · S$36,000 of customer orders unblocked"; stuck demand counts down S$345,800 → S$309,800 (−S$36,000); "Orders released S$36,000 · 3 orders".

> Amy is told **the moment** it's live. // And stuck demand drops by **thirty-six thousand dollars**: / **three** customer orders / that were waiting on **that one record**.

*(Hold while the counter finishes.)*

### 8. Money out: Regional Pulse (2:03–2:36)
**Start speaking at 2:03** (123.9 s) · TTS line lasts 31.7 s · window 32.6 s

**On screen:** Regional Pulse, reached from the sidebar after the bridge (stuck demand still S$309,800), switched to raw SAP records: the growth definition line, the S$53.4M tile (+4.0%), the country × product matrix, then "Merge the duplicates": Bukit Damai Specialist Hospital becomes Malaysia's #2 at −32%, with its action card. The "What we do about it" box names the owner (BU Head, SPD Malaysia), the date and S$620k addressable. Then the KPI tile "Forecast error, Products A and B" reads 11 → 9 per 100 (Illustrative), with the season caveat underneath.

> Now, / **money out**, / on **synthetic** data. // Regional Pulse compares the **twelve months** to September 2026 / with **the year before**, / on **de-duplicated** customers. // Orders are **fifty-three point four million** dollars, / **up four percent**. // Merge the duplicates, / and Bukit Damai, / Malaysia's **number-two** account, / is really **down thirty-two percent**. // Each country card names an **owner**, / an **action** / and the **dollars at stake**. // On this **illustrative** data, / today's forecasting method is off by **eleven** units per hundred ordered; / ours, / by **nine**.

### 9. Close (2:36–2:53)
**Start speaking at 2:36** (156.5 s) · TTS line lasts 15.0 s · window 17.3 s

**On screen:** /pitch/close: "≤ 4 business days" (today median 14 days, Amy's took 18) · "≈1,750 hours a year" (payback in about 6 months) · "No new licences for the workflow (phase 1)", then "One hospital. One record." and the live-prototype and GitHub links.

> Median setup drops from **fourteen days** / to **four business days** or less. // About **seventeen hundred and fifty hours** a year come back, / paying back in about **six months**. // **No new licences** for the workflow / in phase one. // **One hospital.** / **One record.**

*(Slow down on the last line and leave about two seconds of silence before the end card cuts.)*

---

**TTS takes** (in `deliverables/video/vo/`, en-US-AndrewNeural at +3%): hook 8.5 s · frame 10.8 s · amy 25.7 s · marcus 15.7 s · weijie 15.1 s · sap 31.6 s · bridge 8.5 s · pulse 31.7 s · close 15.0 s · **total 2:42**. Video: **2:53** (173.5 s).

**Re-render after a change.** Edit the beat in `recording/beats.mjs` (or its VO in `recording/storyboard.json`, then `python recording/tts.py <beat>`), re-record just that beat with `node recording/record.mjs <beat>`, and re-run `node recording/assemble.mjs`. For example, if the live URL on the close card changes: rebuild/restart the app, then `node recording/record.mjs close && node recording/assemble.mjs` (about 2 minutes).
