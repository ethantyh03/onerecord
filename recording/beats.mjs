// Beat scripts for the Tesseract demo video (storyboard §7.1). Times are beat-local seconds on the
// virtual clock; the VO starts at voOffset. Sentence starts (VO-local) are noted from vo/<beat>.srt.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tid = (id) => `[data-testid="${id}"]`;

async function loadScene(r, id) {
  const { page } = r;
  await page.goto("/demo");
  await page.locator(tid(`scene-load-${id}`)).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/demo"), { timeout: 15000 });
  await r.settle(900);
}

async function waitToastsGone(page) {
  await page.waitForFunction(() => document.querySelectorAll("[data-sonner-toast]").length === 0, null, { timeout: 12000 }).catch(() => {});
}

export const BEATS = {
  // VO: s1 0.0 "Amy needed one new item code." s2 1.84 "It took eighteen days ..." (8.52 s)
  hook: {
    onScreen: "Black screen; the day counter runs 1 → 18 as the faded email trail builds up (\"Scenario from case brief, Appendix C\").",
    voOffset: 0.6, tail: 1.9, cursor: false, settleMs: 0,
    capLeft: 0, capRight: 0, capBottom: 34, capMax: 1000,
    async setup(r) {
      await r.page.goto("/pitch/hook");
      await r.page.waitForSelector('[data-testid="pitch-hook"][data-done="true"]', { timeout: 20000 });
      await r.page.keyboard.press("r"); // replay from day 1
      await sleep(950); // previous run's emails fade out off-camera
    },
    async run(r) {},
  },

  // VO: s1 0.05 "At Lives Group ... by email." s2 3.45 "Records arrive ..." s3 8.62 "Tesseract fixes both ends." (10.78 s)
  frame: {
    onScreen: "Home. The badge \"Runs on Microsoft 365 · lands in SAP Business One\", the three spellings caught at intake, then a slow scroll to the process diagram with its CLEAN IN and MONEY OUT labels.",
    voOffset: 0.3, tail: 0.8, startMouse: [900, 620],
    async setup(r) { await r.page.goto("/"); },
    async run(r) {
      await r.at(0.4); await r.hover(tid("home-platform-badge"), { ms: 900 });
      await r.at(3.0); await r.hover("text=Three requests, three spellings, one record", { ms: 900 });
      await r.at(4.6); await r.hover("text=Caught at intake", { ms: 600 });
      await r.at(6.0); await r.scrollBy(470, 2200);
      await r.at(8.9); await r.hover("text=CLEAN IN", { ms: 700 });
      await r.at(10.2); await r.hover("text=MONEY OUT", { ms: 700 });
    },
  },

  // VO: s1 0.05 item is an IVD  s2 7.54 pastes email  s3 10.89 licence + QA/RA  s4 17.68 approvers + date (25.73 s)
  amy: {
    onScreen: "Amy's new-item form. \"Amy's old email\" fills the paste box, \"Fill the form\" fills 10 fields (K2EDTA Blood Collection Tube 4 mL, 100/pk), the category is \"Lab consumable – IVD medical device\" and Dr Ploy Srisuk (QA/RA) joins the route. She types the licence HSA-DE-0012345, attaches the sample certificate, picks the storage condition, and the card reads \"Expected live in SAP B1: Tue 3 Nov\". Submit → REQ-1100 with 3 waiting customer orders (S$36,000) linked.",
    voOffset: 0.3, tail: 0.9, startMouse: [700, 560], xfadeIn: 0.12, // short fade from Home: a 0.25 s one ghosts both pages
    async setup(r) { await loadScene(r, "amy-intake"); },
    async run(r) {
      const p = r.page;
      await r.at(0.5); await r.hover(tid("paste-input"), { ms: 800, fx: 0.3 });
      await r.at(1.8); await r.click(tid("paste-example-amy"));
      await r.at(3.6); await r.hover(tid("paste-input"), { ms: 900, fx: 0.45, fy: 0.4 });
      await r.at(8.0); await r.click(tid("paste-apply"));
      await sleep(1200);
      await r.at(9.6); await r.hover(tid("paste-result"), { ms: 800, fx: 0.25, fy: 0.25 });
      await r.at(11.3); await r.reveal(tid("field-category"), { at: 118, ms: 900 });
      await r.at(12.3); await r.hover(tid("field-category"), { ms: 600, fx: 0.35 });
      await r.at(13.4); await r.hover(tid("route-step-qa_ra"), { ms: 800, fx: 0.35 });
      await r.at(14.9); await r.type(tid("field-regLicenceNo"), "HSA-DE-0012345", { delay: 48 });
      await r.at(16.3); await r.click(tid("field-regCertificate-sample"));
      await r.at(17.2); await r.select(tid("field-storage"), 1); // Ambient (15–30 °C), as in the priya-sap scene
      await r.at(18.6); await r.hover(tid("route-preview"), { ms: 800, fx: 0.55, fy: 0.08 });
      await r.at(20.6); await r.hover(tid("expected-date"), { ms: 800, fx: 0.4 });
      await r.at(23.9); await r.click(tid("submit-request"));
      await p.locator(tid("submit-success")).waitFor({ timeout: 8000 });
      await r.at(25.0); await r.hover(tid("success-linked"), { ms: 700, fx: 0.4, fy: 0.12 });
    },
  },

  // VO: s1 0.05 Marcus, new BU  s2 3.75 types shorthand  s3 8.33 extends  s4 12.44 BS + Finance → MDM (15.74 s)
  marcus: {
    onScreen: "Admin: \"Add business unit\" opens prefilled for MLS — Meridian Life Sciences; Save → \"Config v2 live\". Cut to Marcus's form: he retypes \"Natl Univ Hosp\", the amber card finds National University Hospital · C-SG-00017 (100%, same tax ID), he clicks \"Extend to my entity\", sets \"Changes credit terms? = Yes\" and Tan Wei Jie (Finance) joins Business Support before the MDM check.",
    voOffset: 0.3, tail: 0.7, startMouse: [700, 500],
    async setup(r) { await loadScene(r, "admin-marcus"); },
    async run(r) {
      const p = r.page;
      await r.at(0.3); await r.click(tid("admin-add-bu"), { ms: 600 });
      await r.at(1.3); await r.hover(tid("bu-name"), { ms: 550, fx: 0.25 });
      await r.at(2.0); await r.click(tid("bu-save"), { ms: 550, revealOpts: { skip: true } });
      await r.at(3.0); await r.hover(tid("admin-config-version"), { ms: 500 });
      await r.at(4.3);
      await r.cut(async () => { await loadScene(r, "marcus-dup"); });
      await r.type(tid("field-customerName"), "Natl Univ Hosp", { delay: 55, clear: true });
      await sleep(400);
      await r.at(6.4); await r.hover(tid("dup-match-0"), { ms: 800, fx: 0.3, fy: 0.35 });
      await r.at(8.9); await r.click(tid("dup-choice-extend"));
      await r.at(10.2); await r.hover("text=Existing record in SAP B1", { ms: 700 });
      await r.at(11.8); await r.select(tid("field-changesCreditTerms"), "Yes");
      await sleep(500);
      await r.at(13.3); await r.hover(tid("route-step-finance"), { ms: 700, fx: 0.4 });
      await r.at(14.9); await r.hover(tid("route-step-mdm"), { ms: 600, fx: 0.4 });
    },
  },

  // VO: s1 0.05 approves on Teams  s2 4.17 credit terms never travel  s3 6.76 Finance and MDM  s4 10.72 reminders + logged (15.07 s)
  weijie: {
    onScreen: "Wei Jie's Approvals page with the Teams card: credit terms show \"•••• · view in Tesseract (Finance and MDM only)\". He clicks Approve (toast), opens the details, reveals the credit values (the view is logged), and the audit trail shows his approval and the logged view.",
    voOffset: 0.3, tail: 0.8, startMouse: [1100, 420],
    async setup(r) {
      await loadScene(r, "weijie-teams");
      await r.page.locator(tid("teams-card")).waitFor();
    },
    async run(r) {
      const p = r.page;
      await r.at(0.4); await r.hover("text=Extend: National University Hospital → MLS >> nth=1", { ms: 800, fx: 0.3 }).catch(() => r.hover(tid("teams-card"), { fy: 0.2 }));
      await r.at(2.5); await r.click(tid("teams-approve"));
      await r.at(4.4); await r.hover(p.locator(tid("teams-masked")).first(), { ms: 700, fx: 0.2 });
      await r.at(5.5); await r.hover(p.locator(tid("teams-masked")).nth(1), { ms: 500, fx: 0.2 });
      await r.at(6.8); await r.click(tid("teams-open-details"));
      await r.cut(async () => { await p.waitForURL(/\/requests\/view/, { timeout: 10000 }); await r.settle(800); });
      await r.at(7.7); await r.click(tid("reveal-all-sensitive"));
      await r.at(8.9); await r.hover(tid("field-paymentTerms"), { ms: 600, fx: 0.6 });
      await r.at(11.2); await r.reveal(tid("audit-verify"), { at: 300, ms: 900 });
      await r.at(12.4); await r.hover(p.locator('[data-testid^="audit-event-"]').last(), { ms: 700, fx: 0.25 });
    },
  },

  // VO: s1 0.05 built-in approvals document-centric  s2 6.23 approvals live in M365  s3 13.12 Generate → DTW
  //     s4 23.83 Service Layer = phase 2  s5 28.12 loads file, marks created (31.58 s)
  sap: {
    onScreen: "The /architecture swimlane (about 10 s): Power Apps form → Teams approvals → DTW import file, SAP Business One as the system of record. Cut to Priya's MDM console: \"Generate SAP B1 import\", the DTW preview with SAP's own field names in the two header rows, a hover on the \"Service Layer (Phase 2)\" tab (not opened, so no JSON on screen), 2 s on the audit trail, then the \"Mark created in SAP B1\" button.",
    voOffset: 0.3, tail: 0.6, startMouse: [760, 300],
    async setup(r) {
      await r.page.goto("/architecture");
      await r.page.locator(tid("arch-swimlane")).waitFor();
      // The sidebar footer reads "Config v1" here (fresh sandbox) between scenes that show v2; hide it for this shot.
      await r.page.addStyleTag({ content: "aside nav + div{visibility:hidden !important}" });
    },
    async run(r) {
      const p = r.page;
      await r.at(0.4); await r.hover("text=Power Apps form", { ms: 900 });
      await r.at(2.4); await r.hover("text=Teams approvals", { ms: 900 });
      await r.at(4.6); await r.hover("text=DTW import file", { ms: 900 });
      await r.at(6.7); await r.hover("text=Teams approvals", { ms: 900 });
      await r.at(8.4); await r.hover("text=System of record", { ms: 800 });
      await r.at(10.0);
      await r.cut(async () => { await loadScene(r, "priya-sap"); });
      await r.hover("text=SAP B1 hand-off", { ms: 800 });
      await r.at(13.4); await r.click(tid("mdm-generate-dtw"));
      await p.locator(tid("mdm-dtw-preview")).waitFor({ timeout: 8000 });
      await sleep(900);
      await r.at(15.6); await r.hover("text=Row 1:", { ms: 700 });
      await r.at(16.9); await p.locator(tid("mdm-dtw-preview")).locator("text=ItemCode").first().waitFor();
      await r.hover(p.locator(tid("mdm-dtw-preview")).locator("text=ItemCode").first(), { ms: 700 });
      await r.at(18.6); await r.hover(p.locator(tid("mdm-dtw-preview")).locator("text=ItmsGrpCod").first(), { ms: 800 });
      await r.at(20.6); await r.hover("text=Items_Prices.csv", { ms: 800 });
      await r.at(23.6); await r.hover(tid("mdm-tab-sl"), { ms: 1200 }); // hover only: the Service Layer tab holds a JSON body (no code on screen)
      await r.at(27.2); await r.reveal(tid("audit-verify"), { at: 170, ms: 900 });
      await r.at(28.3); await r.hover(p.locator('[data-testid^="audit-event-"]').first(), { ms: 700, fx: 0.3 });
      await r.at(30.3); await r.reveal(tid("mdm-mark-created"), { at: 420, ms: 900 });
      await r.hover(tid("mdm-mark-created"), { ms: 600 });
    },
  },

  // VO: s1 0.05 Amy told  s2 1.99 stuck demand drops S$36,000 (8.52 s)
  bridge: {
    onScreen: "Priya clicks \"Mark created in SAP B1\": toast \"I-B-000535 created · Amy notified · S$36,000 of customer orders unblocked\"; stuck demand counts down S$345,800 → S$309,800 (−S$36,000); \"Orders released S$36,000 · 3 orders\".",
    voOffset: 0.3, tail: 1.2, startMouse: [700, 560],
    async setup(r) {
      const p = r.page;
      await loadScene(r, "priya-sap");
      await p.locator(tid("mdm-generate-dtw")).click();
      await p.locator(tid("mdm-dtw-preview")).waitFor();
      await waitToastsGone(p);
      await p.evaluate(() => window.scrollTo(0, 0));
    },
    async run(r) {
      await r.at(0.3); await r.click(tid("mdm-mark-created"), { ms: 800 });
      await r.at(2.4); await r.hover(tid("stuck-demand-value"), { ms: 800 });
      await r.at(5.4); await r.hover("text=Orders released", { ms: 800 }).catch(() => {});
      await r.at(7.6); await r.hover("text=Amy notified in Teams and Outlook", { ms: 700 }).catch(() => {});
    },
  },

  // VO: s1 0.05 money out  s2 2.62 window + de-dup  s3 9.70 S$53.4M +4%  s4 13.64 merge → Bukit Damai −32%
  //     s5 20.16 owner, action, dollars  s6 24.31 forecast 11 → 9 (31.73 s)
  pulse: {
    onScreen: "Regional Pulse, reached from the sidebar after the bridge (stuck demand still S$309,800), switched to raw SAP records: the growth definition line, the S$53.4M tile (+4.0%), the country × product matrix, then \"Merge the duplicates\": Bukit Damai Specialist Hospital becomes Malaysia's #2 at −32%, with its action card. The \"What we do about it\" box names the owner (BU Head, SPD Malaysia), the date and S$620k addressable. Then the KPI tile \"Forecast error, Products A and B\" reads 11 → 9 per 100 (Illustrative), with the season caveat underneath.",
    voOffset: 0.3, tail: 0.8, startMouse: [900, 420],
    async setup(r) {
      // Continue from the bridge's state (stuck demand S$309,800), not a fresh pulse scene, which resets it to S$345,800.
      const p = r.page;
      await loadScene(r, "priya-sap");
      await p.locator(tid("mdm-generate-dtw")).click();
      await p.locator(tid("mdm-dtw-preview")).waitFor();
      await p.locator(tid("mdm-mark-created")).click();
      await waitToastsGone(p);
      await p.locator("aside nav a[href^='/pulse']").first().click();
      await p.waitForURL((u) => u.pathname.startsWith("/pulse"));
      await p.locator(tid("pulse-toggle-raw")).click();
      await p.evaluate(() => scrollTo(0, 0));
      await r.settle(2600); // let the stuck-demand counter finish on S$309,800
    },
    async run(r) {
      const p = r.page;
      await r.at(0.5); await r.hover("text=Synthetic, illustrative data >> nth=0", { ms: 800 });
      await r.at(3.0); await r.hover(tid("pulse-definition"), { ms: 900, fx: 0.12 });
      await r.at(5.0); await r.hover(tid("pulse-definition"), { ms: 2200, fx: 0.62 });
      await r.at(10.0); await r.hover("text=S$53.4M", { ms: 800 });
      await r.at(12.0); await r.reveal(tid("pulse-matrix"), { at: 95, ms: 1000 });
      await r.hover(tid("pulse-matrix"), { ms: 500, fx: 0.3, fy: 0.02 }); // header strip, not a cell (cell tooltips cover the SG row)
      await r.at(13.6); await r.reveal(tid("pulse-hero"), { at: 92, ms: 1300 });
      await r.at(15.2); await r.click(tid("pulse-hero-merge"));
      await sleep(1400);
      await r.at(17.0); await r.hover(tid("pulse-hero-golden"), { ms: 800, fx: 0.7, fy: 0.6 });
      await r.at(20.4); await r.hover("text=What we do about it", { ms: 800 }).catch(() => {});
      await r.at(21.7); await r.hover("text=BU Head, SPD Malaysia", { ms: 700 }).catch(() => {});
      await r.at(22.9); await r.hover("text=addressable", { ms: 700 }).catch(() => {});
      await r.at(24.4); await r.reveal("text=Forecast error, Products A and B", { at: 300, ms: 1100 });
      await r.hover("text=Forecast error, Products A and B", { ms: 700, fx: 0.4, dy: 52 });
      await r.at(28.6); await r.hover("text=/Backtested on 6 months/", { ms: 900, fx: 0.3 }).catch(() => {});
    },
  },

  // VO: s1 0.05 14 → ≤4  s2 4.78 1,750 h, payback ~6 months  s3 9.96 no new licences  s4 13.02 One hospital.  s5 14.03 One record. (15.0 s)
  close: {
    onScreen: "/pitch/close: \"≤ 4 business days\" (today median 14 days, Amy's took 18) · \"≈1,750 hours a year\" (payback in about 6 months) · \"No new licences for the workflow (phase 1)\", then \"One hospital. One record.\" and the live-prototype and GitHub links.",
    voOffset: 0.3, tail: 2.0, cursor: false, settleMs: 0, noSettle: true,
    capLeft: 900, capRight: 90, capBottom: 214, capMax: 540,
    async setup(r) {
      await r.page.goto("/pitch/close");
      await r.page.locator(tid("pitch-close-tagline")).waitFor();
      await sleep(3500);
      await r.page.keyboard.press("r"); // replay the reveal; capture starts ~immediately
      await sleep(30);
    },
    async run(r) {},
  },
};

export const ORDER = ["hook", "frame", "amy", "marcus", "weijie", "sap", "bridge", "pulse", "close"];
