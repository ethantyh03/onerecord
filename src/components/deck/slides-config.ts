/**
 * The finals deck: order, speakers, timing and speaker notes. Copied from docs/superpowers/deck-content.md
 * (run sheet §1, slides §4 and §6, appendix §7). Change the words there first, then here.
 */

export type Speaker = "Joash" | "Ethan";

export type SlideId =
  | "s01-title"
  | "s02-hook"
  | "s03-three-records"
  | "s04-merged"
  | "s05-root-causes"
  | "s06-principles"
  | "s07-one-picture"
  | "s08-demo-handoff"
  | "s09-regional"
  | "s10-impact"
  | "s11-business-case"
  | "s12-pilot"
  | "s13-risks"
  | "s14-close"
  | "a1-alternatives"
  | "a2-who-builds"
  | "a3-payback"
  | "a4-duplicate-check"
  | "a5-real-data"
  | "a6-forecast"
  | "a7-controls"
  | "a8-sap-landing-and-scope";

export interface SlideMeta {
  id: SlideId;
  /** Shown in the footer and the index: "4" or "A4". */
  label: string;
  title: string;
  speaker: Speaker;
  /** Planned seconds on this slide (main flow only). */
  seconds?: number;
  /** Planned clock window, talk time (m:ss). */
  clock?: [string, string];
  /** Build steps within the slide (default 1). */
  steps?: number;
  /** Slides whose arrival plays this slide's signature transition (otherwise: any forward arrival plays its build). */
  playFrom?: SlideId[];
  /** What happens on screen that the speaker should know about. */
  cue?: string;
  /** What to say (deck content doc "Say"). */
  say: string;
  appendix?: boolean;
  /** Appendix: the question it answers and the 10-second live fallback. */
  question?: string;
  fallback?: string;
}

export const SLIDES: SlideMeta[] = [
  {
    id: "s01-title",
    label: "1",
    title: "Tesseract",
    speaker: "Joash",
    seconds: 10,
    clock: ["0:00", "0:10"],
    steps: 2,
    cue: "Up while the room settles. Press → on “Good afternoon”: the wordmark flickers in (T1). Press → again for the hook.",
    say: "Good afternoon. We're Joash and Ethan from CTFudders. Our case is master data at Lives Group, and we'll start with one request.",
  },
  {
    id: "s02-hook",
    label: "2",
    title: "Amy needed one item code",
    speaker: "Joash",
    seconds: 35,
    clock: ["0:10", "0:45"],
    cue: "The day counter runs 1 → 18 by itself (≤ 4 s). Let it finish before the money line.",
    say: "Amy is a product manager. She needed one new item code for a lab consumable her team was importing. She copied an old email to the MDM mailbox. It bounced for a missing Quality field, then went to three approvers, one at a time. Eighteen days later, she tried to raise a sales order, and the item still wasn't in SAP. In our illustrative data, one point three four million dollars of customer orders waited on setups like hers last year.",
  },
  {
    id: "s03-three-records",
    label: "3",
    title: "One hospital, three customers",
    speaker: "Joash",
    seconds: 25,
    clock: ["0:45", "1:10"],
    say: "The same email habit creates customer records. Here are three customers from our illustrative SAP data. One looks flat, one looks lost, and one looks brand new. A sales team would write one off and celebrate another.",
  },
  {
    id: "s04-merged",
    label: "4",
    title: "Merged: Malaysia's #2 account, down 32%",
    speaker: "Joash",
    seconds: 28,
    clock: ["1:10", "1:38"],
    playFrom: ["s03-three-records"],
    cue: "T2 plays on arrival from slide 3: slide 3's headline holds while the rows fuse (≈1 s), turns into “down 32%” as the merged row lands, then 388 dots become 363 (≈1.5 s). Start talking as the headline changes.",
    say: "Merge them, and it's one hospital: Malaysia's second-biggest account, down thirty-two percent. Nobody calls, because on paper nothing looks wrong. Across five countries, twenty-five of three hundred and eighty-eight customer records are duplicates. That's our thesis: messy master data hides money.",
  },
  {
    id: "s05-root-causes",
    label: "5",
    title: "One root cause, five symptoms",
    speaker: "Joash",
    seconds: 35,
    clock: ["1:38", "2:13"],
    cue: "Last Joash line before the handoff. Step back on the last word.",
    say: "We read the brief as one root cause with five symptoms. Requests arrive as free text, so they bounce. Nobody can check whether a record exists, so duplicates get in. Approvals go one person at a time, so a setup takes a median of fourteen days. Sensitive fields travel in email, and every new business unit needs IT. And the regional numbers are built on those same records.",
  },
  {
    id: "s06-principles",
    label: "6",
    title: "Four rules for a good fix",
    speaker: "Ethan",
    seconds: 40,
    clock: ["2:13", "2:53"],
    cue: "Handoff: Ethan starts with “Thanks, Joash.”",
    say: "Thanks, Joash. Before building anything, we set four rules. One: use what Lives already owns. Microsoft 365 is the front door, and SAP Business One stays the system of record, because its built-in approvals are document-centric. Two: one record per real customer. Three: fix the process before buying software, so approvers decide in parallel. Four: the MDM team owns the rules, not IT. A better template, or Teams Approvals alone, each fix half of this. We wanted both halves.",
  },
  {
    id: "s07-one-picture",
    label: "7",
    title: "Tesseract in one picture",
    speaker: "Ethan",
    seconds: 55,
    clock: ["2:53", "3:48"],
    steps: 2,
    playFrom: ["s06-principles"],
    cue: "Two presses. Arriving from slide 6 plays T3 (≈2 s): Amy's email fills the form, the bank number is struck out, “Regulatory licence no.” shows Needed, and it HOLDS. Say the first two sentences, pointing at Needed and the struck-out number. Press → on “That form is step one”: the form shrinks into step 1 and the flow draws (≈1.5 s).",
    say: "Here's Tesseract in one picture. Amy's email becomes a form that knows an IVD item needs a licence number, and the bank details are stripped out. [→] That form is step one. Before any approver sees it, we check that it's complete and not a duplicate. Approvers decide in parallel, on a Teams card, with a two-business-day clock. MDM does one final check, and SAP gets an import file through its own import tool. Once every hospital is one record, the regional numbers can be trusted. A lean team of two builds it, with about fifteen days of outside help and no new licences for the workflow.",
  },
  {
    id: "s08-demo-handoff",
    label: "8",
    title: "Now the live demo",
    speaker: "Ethan",
    seconds: 20,
    clock: ["3:48", "4:08"],
    cue: "Press → (or click the dimmed app frame): the sandbox resets to “Clean in: Amy raises a new item” and the frame zooms into the live app (T4). Shift+→ skips the demo. Coming back: the return tab (tab 1, /deck?standby=1) has already jumped to slide 9, so press Ctrl+1 (or Ctrl+Tab). Never the Back button.",
    say: "Now the live demo. Five people, one request, about five minutes. Everything runs live in this browser. Teams, SAP and the clock are simulated, and the data is synthetic.",
  },
  {
    id: "s09-regional",
    label: "9",
    title: "What Regional Pulse tells a manager",
    speaker: "Ethan",
    seconds: 45,
    clock: ["9:08", "9:53"],
    cue: "Back from the app with Ctrl+1. The only slide with the forecast figure. End on “Joash, what's it worth?” If asked: growth is Oct 2025–Sep 2026 vs the 12 months before; the forecast is scored on 6 months the model never saw and loses 3 of 10 cells (A6); customer orders are demand, MDM setups are our own work, counted apart.",
    say: "Here's what you just saw, the way a manager reads it. Growth compares the same twelve months a year apart, on de-duplicated customers, so dengue season doesn't look like growth. Orders are fifty-three point four million dollars, up four percent. On our illustrative data, today's forecast is off by eleven units per hundred ordered; ours by nine, and we show where it loses. And every country gets an owner and a date: Malaysia's BU head calls Bukit Damai by the thirteenth of November. Joash, what's it worth?",
  },
  {
    id: "s10-impact",
    label: "10",
    title: "14 days to 4 business days or less",
    speaker: "Joash",
    seconds: 40,
    clock: ["9:53", "10:33"],
    steps: 2,
    playFrom: ["s09-regional"],
    cue: "Handoff to Joash. Two presses. Arriving draws today's 14 days (≈1.5 s): waiting and a bounce, three approvers one after another, then the MDM queue. It HOLDS. Say the first sentence, then press →: the approvers go parallel and the bar shrinks to ≤ 4 business days inside the dashed 14-day outline (≈2 s). If asked “43% of what?”: in Amy's case, 6 of the 14 days saved come from approving in parallel, with no new software.",
    say: "Thanks, Ethan. Today a new record takes a median of fourteen days: it waits, it bounces, then three approvers sign one after another. [→] With one form, parallel approvals and an import file, the target is four business days or less. About forty-three percent of that saving is a pure process change: approving in parallel needs no new software. Across the region that's about seventeen hundred and fifty hours a year back: capacity for customer work, not a headcount cut.",
  },
  {
    id: "s11-business-case",
    label: "11",
    title: "The business case",
    speaker: "Joash",
    seconds: 45,
    clock: ["10:33", "11:18"],
    cue: "The 80 row shows first; 40 and 120 follow.",
    say: "Phase one costs thirty-nine thousand nine hundred dollars, and most of that is internal time. There are no new licences for the workflow. We count hard hours only, at fifty dollars an hour. At eighty requests a month it pays back in five point nine months; at half that volume, still under ten. Automatic posting into SAP would take about nineteen years to pay back on hours, so that's phase two, and only if the pilot says speed is worth it.",
  },
  {
    id: "s12-pilot",
    label: "12",
    title: "The six-week pilot",
    speaker: "Joash",
    seconds: 50,
    clock: ["11:18", "12:08"],
    cue: "If the demo ended after 9:40, skip slide 13: say “The biggest risk is habit, so after four weeks the MDM mailbox auto-replies with the form link.” here, then press End for the close.",
    say: "We'd prove it in six weeks, in Singapore and Malaysia, on customers and items, for two business units. In week one we rerun our analysis on real SAP extracts, so every number today gets re-measured. Success is ninety percent of requests through Tesseract, a four-business-day median, and fewer than fifteen percent bounced. At week six there's a gate: if the median is over six business days, or adoption is under seventy percent, we fix it or stop. If it works, we roll out to the other three countries, then add in-tenant AI and automatic posting.",
  },
  {
    id: "s13-risks",
    label: "13",
    title: "Risks and adoption",
    speaker: "Joash",
    seconds: 40,
    clock: ["12:08", "12:48"],
    cue: "First cut if running long. Close must start by 13:00, never after 14:15.",
    say: "The biggest risk isn't technology; it's habit. So we take the old path away: after four weeks, the MDM mailbox replies with the form link. Approving is one click in Teams, reminders go out after one business day, and a weekly scoreboard shows who's waiting on whom. Credit terms and bank details never travel in a message, and every view is logged. And because our data is synthetic, week one re-measures it on real SAP extracts.",
  },
  {
    id: "s14-close",
    label: "14",
    title: "One hospital. One record.",
    speaker: "Joash",
    seconds: 38,
    clock: ["12:48", "13:26"],
    playFrom: ["s12-pilot", "s13-risks"],
    cue: "The line flickers in on arrival (T1, the bookend). Slow down on the last two lines; hold 2 seconds of silence before “Thank you.” No forecast figure here.",
    say: "So, our ask. Approve phase one: thirty-nine thousand nine hundred dollars, mostly internal time, no new licences, and a six-week pilot in Singapore and Malaysia, judged at the week-six gate. Setup goes from a median of fourteen days to four business days or less. About seventeen hundred and fifty hours a year come back, paying back in about six months. And the hospital hiding a thirty-two percent decline gets a call. One hospital. One record. Thank you.",
  },
  // ------------------------------------------------------------------ appendix (Q&A)
  {
    id: "a1-alternatives",
    label: "A1",
    title: "Why not SAP's own approvals?",
    speaker: "Ethan",
    appendix: true,
    question: "Why not SAP B1's own approval procedures? Why this, not something simpler?",
    fallback: "/impact → alternatives",
    say: "SAP Business One's built-in approvals are document-centric: they gate sales, purchasing, inventory and payment documents, and SAP's own course lists no business partner, item or cost-centre object among them. Even with a workaround, you'd still have no structured form, no duplicate check, no Teams routing and no parallel approvals on a clock. So approvals run in Microsoft 365, and SAP stays the system of record: every approved record still lands there.",
  },
  {
    id: "a2-who-builds",
    label: "A2",
    title: "Who builds it, and licences",
    speaker: "Ethan",
    appendix: true,
    question: "No dev team: why custom? What does it cost in licences?",
    fallback: "/architecture",
    say: "The web app is only a demo vehicle; production is a Power Apps form, a SharePoint list and Power Automate with the standard Approvals connector, posting Teams cards. That needs no new licences for the workflow, because it's all inside the Microsoft 365 Lives already pays for. A lean team of two builds it in six weeks, the MDM team configures fields and routes without IT, and a contractor spends about fifteen days on the duplicate check. The only possible extra is Power BI Pro for about ten regional viewers, and only if Lives doesn't already have it.",
  },
  {
    id: "a3-payback",
    label: "A3",
    title: "What sits behind the payback",
    speaker: "Joash",
    appendix: true,
    question: "What sits behind “payback in about 6 months”?",
    fallback: "/impact → 40 / 80 / 120 buttons",
    say: "We value time at fifty dollars an hour, derived from the national median wage plus bonus and CPF. Each request saves one and a quarter hours: rework, chasing, and keying replaced by an import file. At eighty requests a month, plus forty hours of regional consolidation, that's seventeen hundred and fifty-one hours a year, or eighty-one and a half thousand dollars net. So five point nine months to pay back; nine point six at forty requests. Approver time and revenue aren't counted.",
  },
  {
    id: "a4-duplicate-check",
    label: "A4",
    title: "How the duplicate check works",
    speaker: "Ethan",
    appendix: true,
    question: "How does the duplicate check work, and how accurate is it?",
    fallback: "New request → New Customer → MY · “Bukit Damai Spec Hosp”",
    say: "It cleans the name first, expanding abbreviations like “Hosp” and dropping “Sdn Bhd”, then scores how similar the names are, and an identical tax ID is near-certain. We tuned it on Singapore and Malaysia, froze it, and tested it once on the other three countries: it catches eighty-seven of every hundred duplicates, and ninety-three of every hundred warnings are real. It struggles most with romanised names and blank tax IDs, and we show those misses. It only suggests; MDM decides, and an override needs a logged reason.",
  },
  {
    id: "a5-real-data",
    label: "A5",
    title: "Is this real data?",
    speaker: "Ethan",
    appendix: true,
    question: "Would these numbers hold on Lives's real SAP data?",
    fallback: "Pulse → “About this data”",
    say: "No. It's synthetic and labelled that way on every chart. One seeded script generates it, and every pattern we planted is listed, so a good score shows the pipeline can find these patterns, not that they exist at Lives. That's why week one of the pilot reruns the same scripts, unchanged, on SAP Business One extracts.",
  },
  {
    id: "a6-forecast",
    label: "A6",
    title: "Why believe the forecast?",
    speaker: "Ethan",
    appendix: true,
    question: "Why believe the forecast improvement?",
    fallback: "Pulse → Forecast check → Replay",
    say: "The test was fixed before we saw any result: six starting points, one to three months ahead, refitted each time on past data only. Ours is off by nine units per hundred ordered against eleven for today's method, and it loses in three of ten cells, which we show. The gain is seasonal; off-season it nearly disappears, and when we switch seasonality off, the advantage goes to zero, so it isn't inventing patterns. And on uncleaned records our model is actually worse, which is why we clean the data first.",
  },
  {
    id: "a7-controls",
    label: "A7",
    title: "Bank data, duties, escalation",
    speaker: "Ethan",
    appendix: true,
    question: "Bank and credit data? Segregation of duties? Approver on leave or not responding?",
    fallback: "Approvals → Sandbox clock → +1 / +3 business days; audit trail → Verify chain",
    say: "Credit terms and bank details never appear in a message; the card links back to Tesseract, where only Finance and MDM can open them, and every view is logged. In production they sit in a restricted SharePoint list behind Entra ID. Nobody can approve their own request, and nobody can hold two steps of the same request. If an approver doesn't act, there's a reminder after one business day and an escalation after three, and the escalation follows the same rules.",
  },
  {
    id: "a8-sap-landing-and-scope",
    label: "A8",
    title: "Import file now, and what we left out",
    speaker: "Joash",
    appendix: true,
    question: "Why an import file, not the Service Layer? What did you deliberately not build?",
    fallback: "/scope",
    say: "The import file keeps a person checking before anything enters SAP, which we want while trust builds. Automatic posting only saves the load step, about twelve hours a month, so after licences and maintenance it takes about nineteen years to pay back. That makes it a speed decision for after the pilot, and the payload is already built and validated. We also left out merging old duplicates, our own security model and deep-learning forecasts, on purpose.",
  },
];

export const MAIN_COUNT = SLIDES.filter((s) => !s.appendix).length; // 14
export const DEMO_AFTER: SlideId = "s08-demo-handoff";

/** The live demo between slides 8 and 9 (deck content doc §5), for the presenter view. */
export const DEMO_BEATS: { beat: string; clock: string; scene: string; line: string }[] = [
  {
    beat: "1 · Amy",
    clock: "0:00–1:10",
    scene: "Clean in: Amy raises a new item (the deck loads it)",
    line: "Paste to fill → Amy's old email → Fill the form. IVD → licence + QA/RA. Optional: Category = Instrument, then back. HSA-DE-0012345, sample certificate, Ambient. Submit → REQ-1100, 3 orders (S$36,000) linked.",
  },
  {
    beat: "2 · Marcus",
    clock: "1:10–2:05",
    scene: "Admin adds Marcus's business unit, then Clean in: Marcus is stopped from creating a duplicate",
    line: "Add business unit (MLS) → Save → “Config v2 live”. FIRST CUT if behind: skip the admin scene, just say “MDM added the business unit itself, no IT ticket.” Amber card: 100% match, C-SG-00017, same tax ID → Extend to my entity. Don't say the hospital's name.",
  },
  {
    beat: "3 · Wei Jie",
    clock: "2:05–2:50",
    scene: "Clean in: Wei Jie approves in Teams",
    line: "REQ-1101: payment terms 🔒, “Why you're seeing this”, due in 2 business days. Approve → Priya next. Optional (second cut): Open details → show values (logged).",
  },
  {
    beat: "4 · Priya",
    clock: "2:50–3:50",
    scene: "Lands in SAP B1: Priya imports Amy's item",
    line: "S$36,000 · 3 orders. Generate SAP B1 import (oItems.csv). Point at Service Layer (planned), don't open. Mark created → I-B-000535. Regional Pulse: S$345,800 → S$309,800.",
  },
  {
    beat: "5 · Pulse",
    clock: "3:50–4:45",
    scene: "Stay on /pulse (don't reload: it resets stuck demand)",
    line: "Top-bar tag “Sandbox · synthetic data”. Raw SAP records → Bukit Damai #7 / #10 / #11. Merge the duplicates → #2, −32%. “Recommended action”: BU Head, SPD Malaysia, by 13 Nov, S$620k.",
  },
  { beat: "Return", clock: "4:45–5:00", scene: "Ctrl+1 to the return tab (tab 1, already on slide 9)", line: "“What does that mean for the region?” Never the Back button." },
];

export const CHECKPOINTS = [
  "Demo starts by 4:15. Behind? Cut in this order: Marcus's admin scene (one line instead), Wei Jie's detail view, slide 13.",
  "Demo ends by 9:15 (after 9:40: cut slide 13).",
  "Close (slide 14) starts by 13:00; never after 14:15.",
  "If the live demo breaks: play the backup demo video (2:54; youtu.be/5tieuSmd2Aw or the downloaded copy), then slide 9.",
];

export function clockToSeconds(c: string): number {
  const [m, s] = c.split(":").map(Number);
  return m * 60 + s;
}
