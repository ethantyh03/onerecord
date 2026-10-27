# OneRecord demo: voice-over script

Read this over the silent screen recording. The timings come from the TTS take (`vo/*.mp3`, en-US-AndrewNeural at +3%). Its voice-over runs **2:36**, and the suggested edit is **2:49** once the holds are in. The hard ceiling is 2:55. The same text, with the screen notes, is in `recording/storyboard.json`.

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

### 1. Hook (0:00–0:12)
**On screen:** black screen with "18 days." The day counter ticks 1 → 18 over a faded email collage. Caption: "Scenario from case brief, App C".

> Amy needed **one** new item code. // It took **eighteen days**, / a **bounced** request / and three approvers **one at a time**, / and her sales order **still failed**.

*(Slow and flat, then let "still failed" land. Leave about two seconds of silence while the counter finishes.)*

### 2. Frame (0:12–0:24)
**On screen:** Home, split "Clean in │ Money out". Badge: "Runs on Microsoft 365 · lands in SAP Business One".

> At Lives Group, / master data is created **by email**. // Records arrive **incomplete** or **duplicated**, / so the regional numbers **can't be trusted**. // OneRecord fixes **both ends**.

### 3. Clean in: Amy (0:24–0:50)
**On screen:** scene amy-intake. Paste the old email and the fields fill ("K2EDTA Blood Collection Tube 4 mL, 100/pk", badge "cached for demo"). The category becomes "IVD medical device", the licence field turns red and required, and the QA/RA chip slides into the route. Footer: "QA/RA · BU Head · Business Support in parallel → MDM · Expected live Tue 3 Nov". Side note: 3 waiting orders, S$36,000.

> Amy's item is a **blood collection tube**: / a lab consumable regulated as an **IVD**, / an **in-vitro diagnostic** device. // She pastes her **old email**, / and the form **fills itself**. // As an IVD, / it **needs a licence number**, / and **Quality** joins the route **automatically**: / the step she **missed** last time. // Before submitting, / she sees her approvers, / all **in parallel**, / and her go-live date: / **Tuesday, the third of November**.

### 4. Clean in: Marcus (0:50–1:07)
**On screen:** a 4-second admin-marcus insert ("MLS — Meridian Life Sciences + approvers · Saved"), then marcus-dup. He types "Natl Univ Hosp" and an amber card appears: "National University Hospital · C-SG-00017 · same tax ID". He clicks **Extend to my entity**, and the route shows "Business Support + Finance (Wei Jie) → MDM".

> Marcus is from a **new** business unit, / Meridian Life Sciences. // He types a hospital **in shorthand**, / and OneRecord finds it **already on file**. // So he **extends** that record to his entity, / instead of creating a **duplicate**. // Business Support and **Finance** check it, / then MDM.

### 5. Clean in: Wei Jie (1:07–1:22)
**On screen:** weijie-teams. The Teams card shows "Credit terms: •••• · view in OneRecord (Finance only)". He opens the details (values visible to Wei Jie), then a 2-second persona flip to Amy shows ••••. He clicks Approve, and the tracker step turns green. Chip: "Reminder after 1 business day".

> Wei Jie in Finance approves on a **Teams card**, / where he **already works**. // Credit terms **never travel** in the message. / Only **Finance** can open them, / inside OneRecord. // **Reminders** go out before anything stalls, / and **every decision** is logged.

### 6. Lands in SAP B1 (1:22–1:54)
**On screen:** a 4-second /architecture swimlane with the path highlighted. Then priya-sap: "Generate SAP B1 import", and the DTW preview with SAP field names and the two header rows highlighted. Then the Service Layer tab ("Phase 2 · not sent"), then "Mark created in SAP B1".

> SAP Business One is **document-centric**: / its approvals are built for **documents** like sales orders, / not master data. // So approvals live in **Microsoft 365**, / and SAP stays the **system of record**. // Priya clicks **Generate SAP B1 import**, / and gets a **Data Transfer Workbench** file: / the import format SAP **already reads**, / with SAP's **own field names**. // Sending it **automatically**, / through SAP's Service Layer, / is **phase two**. // Today, / she loads the file / and marks the item **created**.

### 7. Bridge (1:54–2:05)
**On screen:** toast "Amy: your item is live". Cut to the Pulse stuck-demand tile counting down from S$345,800 to S$309,800. Toast: "S$36,000 of customer orders unblocked".

> Amy is told **the moment** it's live. // And stuck demand drops by **thirty-six thousand dollars**: / **three** customer orders / that were waiting on **that one record**.

*(Hold while the counter finishes.)*

### 8. Money out: Regional Pulse (2:05–2:32)
**On screen:** the Pulse header ("Oct 2025 – Sep 2026 vs the same 12 months a year earlier" plus the formula; hold 2 s). Then the tile "S$53.4M · +4.0%" and the matrix. Then the **merge toggle**, which shows Bukit Damai Specialist Hospital (MY #2) at "−32%". Then the forecast replay, "11 → 9 per 100 ordered (A + B)". The "Synthetic, illustrative" badge stays visible throughout.

> Now, / **money out**, / on **synthetic** data. // Regional Pulse compares the **twelve months** to September 2026 / with **the year before**, / on **de-duplicated** customers. // Orders are **fifty-three point four million** dollars, / **up four percent**. // Merge the duplicates, / and Bukit Damai, / Malaysia's **number-two** account, / is really **down thirty-two percent**. // And for Products A and B, / our seasonal forecast is off by **nine** units per hundred ordered, / not **eleven**.

### 9. Close (2:32–2:49)
**On screen:** /pitch/close with the tiles "Median 14 days → ≤ 4 business days" · "≈1,750 hours a year back · payback ≈ 6 months" · "No new licences for the workflow in phase 1", plus "One hospital. One record." and the YouTube / GitHub / live URLs.

> Median setup drops from **fourteen days** / to **four business days** or less. // About **seventeen hundred and fifty hours** a year come back, / paying back in about **six months**. // **No new licences** for the workflow / in phase one. // **One hospital.** / **One record.**

*(Slow down on the last line and leave about two seconds of silence before the end card cuts.)*

---

**TTS takes** (in `deliverables/video/vo/`): hook 8.5 s · frame 10.8 s · amy 25.7 s · marcus 15.7 s · weijie 14.1 s · sap 31.4 s · bridge 8.5 s · pulse 26.6 s · close 15.0 s · **total 2:36.3**. Alternate hook voices to compare: `alt-hook-en-GB-RyanNeural.mp3` (9.7 s) and `alt-hook-en-SG-WayneNeural.mp3` (10.2 s).
