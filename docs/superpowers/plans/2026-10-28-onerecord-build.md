# OneRecord Implementation Plan (one-night build, 28 Oct 2026)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this build, tasks are dispatched as parallel Workflow agents with strict file ownership; a lead integrator verifies each wave.

**Goal:** Ship a working, demo-ready OneRecord prototype: an MDM request → approval → SAP B1 hand-off workflow, plus a Regional Pulse business view, deployed for judges by 07:00 SGT 28 Oct 2026.

**Architecture:** Next.js 15 App Router. All mutable demo state lives in one Zustand store persisted to localStorage, which acts as the per-visitor sandbox (each judge's browser is isolated, and "Reset demo" reseeds it). Pure-TypeScript engine modules (routing, SLA, audit hash chain, duplicate matching, DTW export, rules extraction, triage) carry the logic and are unit-tested. Python, run offline, generates the synthetic data and analytics as committed JSON. SAP B1, Teams and Outlook are faithful in-app simulations with real artefacts: DTW templates, Service Layer payloads and Adaptive Card JSON.

**Tech Stack:**
- Next.js 15.5, React 19, TypeScript 5, Tailwind v4, shadcn/ui
- Zustand 5 (persist), Recharts 3, motion, lucide-react
- Vitest 5, Playwright 1.64, @anthropic-ai/sdk (optional; rules fallback)
- Python 3.14: pandas, numpy, statsmodels, rapidfuzz, scikit-learn, pyyaml

**Spec:**
- `C:\Users\ethan\OneDrive - Singapore Management University\04 Competitions & Hackathons\Data Case Competition 2026\docs\superpowers\specs\2026-10-23-onerecord-design.md` (design)
- `...\docs\superpowers\specs\2026-10-28-final-model.md` (final scope after the judge panel; it wins on conflicts)
- `...\docs\research\2026-10-23-business-case-facts.md` (numbers)

## Global Constraints
- Repo: `C:\Users\ethan\dev\onerecord`.
  - **Never edit `src/lib/types.ts`.** It is the shared contract; ask the lead if it must change.
  - **Never edit `package.json` or install packages.** All dependencies are already installed.
- Only touch files in your task's **Files** list. Other agents are editing other files at the same time.
- Do NOT run `next build` or `next dev` during the fan-out waves; they collide on `.next/`.
  - Verify with `npx tsc --noEmit` (filter output to your files) and `npx vitest run <your tests>`.
- Do NOT `git commit`. The lead commits after each wave.
- All data is **synthetic and fictional**:
  - Never name the real company the case is modelled on.
  - Use "Lives Group" and its entities SPD / QTS / QTG.
  - Email domain: `livesgroup.example`.
- Countries: SG, MY, TH, VN, MM (Myanmar). Currency SGD. Window: **Oct 2025 – Sep 2026**.
  - Growth = (Apr–Sep 2026 volume) ÷ (Oct 2025–Mar 2026 volume) − 1, on de-duplicated customers.
- **Sensitive fields:** bank account details, credit limit, payment terms.
  - Only roles finance, finance_director, financial_controller and mdm see them.
  - Everyone else sees `•••• 1234`.
  - Each reveal is audit-logged.
- Every page label that shows analytics carries a visible "Synthetic, illustrative data" tag.
- Anything not built is labelled **"Phase 2"** and never shown as working.
- Production framing on screen: "Prototype mirrors the target Microsoft 365 build (Power Apps + Power Automate + Teams) and SAP B1."
- Pinned demo facts. Every agent must use exactly these:
  - Existing master record: **National University Hospital**:
    - cardCode `C-SG-00017`, entity SPD, country SG
    - licTradNum `198500123K`, street `5 Lower Kent Ridge Road`, zipCode `119074`, phone1 `+65 6779 5555`
    - `hasTransactions: false` (master record only)
  - Duplicate demo input: requestor types **"Natl Univ Hosp"** (country SG). It must match C-SG-00017 with score ≥ 0.85 and reasons including the name match.
  - Amy's demo item:
    - itemName **"Dengue NS1 Ag Rapid Test 25T"**, Product A, category **IVD reagent**
    - Category IVD reagent / Medical device ⇒ field `regLicenceNo` (HSA / MDA licence) becomes required, and a QA/RA step is auto-added with `addedBecause: "Category = IVD reagent → regulatory review required"`.
  - Personas (ids): `amy` (Amy Lim, Product Manager SPD, SG), `weijie` (Tan Wei Jie, Finance Manager, SG), `priya` (Priya Nair, MDM Analyst, SG, roles mdm+admin), `marcus` (Marcus Wong, Head of new BU, SG).
  - Approver ids: `daniel` (Daniel Ong, BU Head SPD), `siti` (Siti Rahman, Business Support MY), `ploy` (Dr Ploy Srisuk, QA/RA TH), `lan` (Nguyen Thi Lan, Sales Manager VN), `kyaw` (Kyaw Zin Htet, Business Support MM), `rachel` (Rachel Koh, Finance Director), `hafiz` (Hafiz Ismail, Procurement Head MY), `meiling` (Chua Mei Ling, Financial Controller), `jun` (Lim Jun Hao, BU Head QTS), `aisha` (Aisha Karim, BU Head QTG).
  - Seeded request ids start at `REQ-1001`. The demo's "ready for MDM" item request is **REQ-1042** (Dengue IgG/IgM Combo 30T, Product A, SPD, MY). It blocks **PR-5521** (Sungai Permai Medical Centre MY, S$48,600) and **PR-5527** (Pulau Mutiara General Hospital MY, S$21,400).
  - SAP code format: `C-SG-00123` (customer), `V-MY-00045` (vendor), `I-A-000812` (item: product group, not country), `CC-SG-0031` (cost centre).

## Review Focus
1. **Fresh visitor with empty or corrupted localStorage.** The app must seed and render, never a blank page. Test: the store rehydrate-with-garbage test in Task W1-B.
2. **Duplicate check on short or empty names** ("a", "", "Hospital"). Expect no crash and no false 90% matches on generic words. Test: in W1-A, `findDuplicates("Hospital")` returns nothing above 0.85.
3. **Approve clicked on an already-decided step** (double-click, or a stale tab). Must be a no-op, not a second audit event. Test: in W1-B, `approveStep` twice gives one event.
4. **Fast-forward far past every SLA** (e.g. +200h). Exactly one reminder and one escalation per step, never repeated. Test: in W1-A, `slaTick` is idempotent.
5. **Paste-to-fill with no API key, or with junk text.** Falls back to rules with an "offline extraction" badge, never throws. Test: in W1-A extract tests plus W2-A route fallback.

---

## Wave 1: Foundation (parallel; ~01:10–02:10)

### Task W1-A: Engine (pure functions + tests)
**Files:** create `src/lib/engine/{conditions,routing,sla,audit,dedupe,masking,codes,dtw,extract,triage,index}.ts` and `src/lib/engine/__tests__/*.test.ts`.

**Interfaces (Produces; exact signatures):**
```ts
// conditions.ts
evalCondition(c: Condition | undefined, data: Record<string, FieldValue>): boolean // undefined → true; 'in' compares String(value); 'gt' numeric
isFieldRequired(f: FieldDef, data): boolean   // f.required || evalCondition(f.requiredIf)
isFieldVisible(f: FieldDef, data): boolean    // !f.showIf || evalCondition(f.showIf)
validateRequest(domain: DomainConfig, data): { ok: boolean; errors: Record<string, string> } // required (visible only), pattern, maxLength, number type
// routing.ts
MDM_STAGE_ID = "mdm-final"
resolveAssignee(role: RoleId, bu: BusinessUnit | undefined, people: Person[]): { assigneeId: string; originalAssigneeId?: string } // bu.roleAssignments[role] ?? first person with role; if assignee.outOfOffice && delegateId → delegate
buildRoute(a: { domain: DomainConfig; bu?: BusinessUnit; data: Record<string, FieldValue>; people: Person[] }): ApprovalStep[] // domain stages (conditional steps filtered, addedBecause set) + bu.extraStages + MDM final stage (role mdm); all 'waiting', pausedMs 0
activateNext(steps: ApprovalStep[], nowIso: string): ApprovalStep[] // lowest stageIndex with non-final steps: parallel → all its waiting steps 'pending'; sequential → first waiting one
applyDecision(steps, stepId, decision: "approved" | "rejected", nowIso, comment?): { steps: ApprovalStep[]; outcome: "continue" | "rejected" | "business_approved" | "completed" | "noop" } // noop if step not pending/question; business_approved when only the MDM stage remains; completed when MDM step approved
expectedCompletion(steps: ApprovalStep[], startIso: string, sla: SlaConfig): string // each stage costs sla.stepBusinessDays (parallel counts once) via addBusinessDays
// sla.ts
addBusinessDays(iso: string, days: number): string // skips Sat/Sun; fractional days ok
businessDaysBetween(aIso: string, bIso: string): number // fractional, excludes weekends
slaTick(req: MdmRequest, nowIso: string, sla: SlaConfig, people: Person[]): { steps: ApprovalStep[]; events: { kind: "reminder" | "escalation"; stepId: string; toId: string; fromId?: string }[] } // pending steps only (question = paused); elapsed = businessDaysBetween(activatedAt, now) − pausedMs; reminder once ≥ reminderAfter; escalation once ≥ escalateAfter → reassign to delegate ?? managerId, keep originalAssigneeId; idempotent
// audit.ts
sha256Hex(s: string): string // synchronous pure-JS SHA-256 (no WebCrypto)
appendAudit(chain: AuditEvent[], e: Omit<AuditEvent, "seq" | "prevHash" | "hash">): AuditEvent[] // GENESIS prevHash = "0".repeat(64)
verifyChain(chain: AuditEvent[]): { ok: boolean; brokenAt?: number }
// dedupe.ts
normalizeName(s: string): string // lowercase, strip punctuation, drop legal suffixes (pte ltd, sdn bhd, co ltd, plc, ltd, inc, jsc, company limited), expand hosp→hospital, natl/nat'l→national, univ→university, gen→general, med→medical, ctr/cntr→centre, center→centre, st→saint (only leading), intl→international, dept→department
jaroWinkler(a: string, b: string): number
tokenSetRatio(a: string, b: string): number // 0..1, rapidfuzz-style token_set_ratio
scorePair(input: DupInput, rec: CustomerMaster): { score: number; reasons: string[] }
  // DupInput = { name: string; country?: CountryCode; taxId?: string; zipCode?: string; phone?: string; email?: string }
  // name = max(jaroWinkler, tokenSetRatio) on normalized names; exact taxId → score max(score, 0.97) + "Same tax ID"; zip/phone/email-domain each +0.03 with reason; cap 1.0
findDuplicates(input: DupInput, masters: CustomerMaster[], opts?: { limit?: number; threshold?: number }): DuplicateMatch[] // default limit 3, threshold 0.75; blocks on country if given (plus any taxId hit); names < 3 normalized chars → []; generic-only tokens (hospital, clinic, medical, centre, laboratory, lab, the) can't by themselves exceed 0.85
// masking.ts
SENSITIVE_ROLES: RoleId[] = ["finance", "finance_director", "financial_controller", "mdm"]
canSeeSensitive(p: Person): boolean
maskValue(v: FieldValue): string // null → "—"; else "•••• " + last 4 chars
// codes.ts
nextSapCode(prefix: string, scope: string, existing: string[]): string // ("C","SG",["C-SG-00122"]) → "C-SG-00123"; items scope = product group, 6 digits: "I-A-000812"; cost centre "CC-SG-0031" (4 digits); customer/vendor 5 digits
// dtw.ts
buildDtwFiles(req: MdmRequest, domain: DomainConfig, sapCode: string): DtwFile[] // BP: oBusinessPartners + BPAddresses (+ BPBankAccounts for vendor); item: oItems; cost centre: oProfitCenter; extend: BPAddresses only. Row 1 SAP field names, row 2 DB column names (CardCode/CardName/CardType/GroupCode/FederalTaxID…)
dtwToCsv(f: DtwFile): string // RFC4180 quoting, CRLF
toServiceLayerPayload(req: MdmRequest, domain: DomainConfig, sapCode: string): { method: "POST"; path: string; body: Record<string, unknown> } // path "/b1s/v2/BusinessPartners" | "/b1s/v2/Items" | "/b1s/v2/ProfitCenters"
// extract.ts
redactSensitive(text: string): { text: string; redactions: number } // account numbers (≥8 digits), IBAN, SWIFT/BIC, "credit limit … <amount>"
extractFieldsRules(text: string, domain: DomainConfig): { values: Record<string, FieldValue>; confidence: Record<string, number>; missing: string[] } // regex/keyword per field key + label match "Label: value"; missing = required visible fields still empty
// triage.ts
classifyMessage(m: { subject: string; body: string; from: string }): { kind: MessageKind; reasons: string[]; confidence: number } // PO number pattern (PO[-#: ]?\d{4,}) + qty → po; quote accepted/intend to order + qty + sku → pr; question words w/o qty → enquiry; references existing order/delivery/invoice → followup; new customer/vendor/item code/setup → mdm
```
**Tests (must pass, `npx vitest run src/lib/engine`):**
- conditions: `in` with ["IVD reagent", "Medical device"] makes `regLicenceNo` required.
- routing: item + IVD category ⇒ the QA/RA step is present with addedBecause.
- routing: customer + creditLimit 80000 ⇒ the finance_director step is present; 30000 ⇒ absent.
- routing: parallel stage activates 3 steps at once.
- routing: applyDecision on an approved step ⇒ "noop".
- routing: an OOO assignee ⇒ delegate, with originalAssigneeId set.
- sla: Fri 10:00 + 1 business day = Mon 10:00.
- sla: slaTick at +1.2 bd ⇒ 1 reminder; at +3.5 bd ⇒ 1 escalation (reassigned to managerId); a second tick ⇒ 0 events.
- sla: paused time excluded.
- audit: chain of 3 verifies; mutating event 1's detail ⇒ `{ ok: false, brokenAt: 1 }`; sha256Hex("abc") = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
- dedupe: "Natl Univ Hosp" vs "National University Hospital" ≥ 0.85.
- dedupe: findDuplicates("Hospital") has no match ≥ 0.85.
- dedupe: same taxId ⇒ reason "Same tax ID".
- dedupe: a different SG hospital name vs "National University Hospital" < 0.75.
- codes: next code after C-SG-00122 is C-SG-00123.
- dtw: customer request ⇒ oBusinessPartners.csv with headers[0] "CardCode" and the CardName row value.
- extract: the redaction removes "1234567890".
- extract: rules extraction of the pinned Amy email (fixture in test) fills itemName and category; missing includes regLicenceNo.
- triage: "PO-778812 for 40 boxes" ⇒ po; "Do you carry dengue NS1 kits? price?" ⇒ enquiry; "When will PO-55120 be delivered" ⇒ followup.

### Task W1-B: Config, seed scenario, store
**Files:** create `src/config/default-config.ts`, `src/config/people.ts`, `src/lib/seed.ts`, `src/lib/store.ts`, `src/lib/selectors.ts`, `src/lib/__tests__/store.test.ts`.

**Consumes:** W1-A signatures (written concurrently; import from `@/lib/engine/*` exactly as above).

**Produces:**
```ts
// default-config.ts
export const DEFAULT_CONFIG: AppConfig
  // version 1
  // 5 domains: customer (sapObject oBusinessPartners, prefix C), vendor (oBusinessPartners, V),
  //   item (oItems, I), costcentre (oProfitCenter, CC), extend (oBusinessPartners, C)
  // fields with sapField + maxLength mirroring SAP: CardName 100, LicTradNum 32, E_Mail 100, Phone1 20, ItemName 100, PrcCode 8
  // A9 approval matrix as stages:
  //   customer:   [bu_head·business_support] → finance (+finance_director if creditLimit gt 50000)
  //   vendor:     [procurement·qa_ra if suppliesRegulated equals "Yes"] → finance
  //   item:       [qa_ra if category in IVD reagent/Medical device · bu_head · business_support]
  //   costcentre: [financial_controller·bu_head]
  //   extend:     business_support (+finance if changesCreditTerms equals "Yes")
  // 3 BUs SPD/QTS/QTG with roleAssignments using pinned ids; sla {2,1,3}
// store.ts
export const useSandbox // zustand + persist(localStorage key "onerecord-sandbox-v1", version 1, migrate → reseed on mismatch/garbage)
// State:
//   personaId, clockOffsetMs, config, requests, prs, audit, notifications, sapRecords, idCounter, hydrated
// Actions (exact):
//   setPersona(id); nowIso(): string
//   createDraft(domainId, initial?): string
//   updateDraft(id, patch, aiKeys?)
//   setDuplicateDecision(id, d | undefined)
//   submitRequest(id): { ok; errors } // validate → buildRoute → activateNext → expectedBy → audit "submitted" → Teams + Outlook notifications to pending assignees
//   approveStep(requestId, stepId, comment?)
//   rejectStep(requestId, stepId, comment)
//   askQuestion(requestId, stepId, text) // step → question, pausedAt, status needs_info, notify requestor
//   answerQuestion(requestId, stepId, answer) // back to SAME approver, pausedMs += …
//   fastForward(hours)
//   setOutOfOffice(personId, delegateId | null)
//   logSensitiveReveal(requestId, fieldKey)
//   generateDtw(requestId): DtwFile[]
//   markCreatedInSap(requestId): SapRecord // nextSapCode, sapRecords push, blocked PRs → "open" with customerCode/itemCode, requestor notified (teams + outlook), audit
//   markNotificationRead(id)
//   updateConfig(next, summary)
//   resetSandbox()
// selectors.ts
useCurrentPerson(): Person
personById(s, id): Person | undefined
selectWaitingOn(s, personId): { request: MdmRequest; step: ApprovalStep }[] // pending or question steps assigned to person
selectStuckDemand(s): { totalSgd: number; count: number; byCountry: Record<CountryCode, { sgd: number; count: number; maxDaysWaiting: number }>; prs: PurchaseRequest[] } // PR status "blocked"
selectMyRequests(s, personId): MdmRequest[]
selectPipelineStats(s): { inFlight: number; breached: number; medianDaysToCreate: number; byStatus: Record<RequestStatus, number> }
```
**Seed (`seed.ts` → `buildSeed(nowIso): Pick<State, "requests" | "prs" | "audit" | "notifications" | "sapRecords">`):**
- ~14 in-flight requests across all domains, countries and statuses, including:
  - REQ-1042 at mdm_review, blocking PR-5521 and PR-5527
  - a customer request **REQ-1038** pending Wei Jie (finance) with bank/credit fields, creditLimit 80000 ⇒ the finance_director step follows
  - one step with an open question
  - one step already 2.5 business days old, so fast-forward triggers escalation
- ~30 completed historical requests, so pipeline stats have a median.
- 12 blocked PRs totalling ≈ S$310k across 5 countries; plus 20 open/converted PRs.
- The audit chain must verify.

**Tests:**
- Seed's audit chain verifies.
- The submit → approve-all → markCreatedInSap path flips the linked PRs to open and lowers stuck demand by their SGD.
- Double approve ⇒ one event.
- Corrupted localStorage JSON ⇒ store reseeds.

### Task W1-C: App shell, design system, landing
**Files:** `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/shell/**`, `src/components/common/**`.

Invoke the `frontend-design:frontend-design` skill first. The shell provides:
- left nav: Home, New request, My requests, Approvals, MDM console, SAP B1, Regional Pulse, Inbox triage, Impact, Admin
- top bar:
  - persona switcher showing avatar + role
  - simulated clock with a "Fast-forward" menu (+4h, +1 business day, +3 business days)
  - Teams/Outlook notification bell counts
  - "Reset demo"
- a hydration gate
- the footer label "Prototype · synthetic data · mirrors Microsoft 365 + SAP B1 target"

The landing page shows the **end-to-end process diagram**: Request (Power Apps) → Checks (duplicates / completeness) → Approvals in Teams/Outlook → MDM final check → SAP B1 (DTW → Service Layer, phase 2) → Regional Pulse. Each node links to its screen. Below it sit headline numbers (18 days → ≤ 4 business days) and persona cards ("Start as Amy").

Common components:
- `PageHeader`, `StatusBadge` (RequestStatus / StepStatus), `PersonChip`, `SlaChip`, `SyntheticBadge`, `Phase2Badge`, `SapCode` (monospace)
- `MaskedValue({ value, requestId, fieldKey })`: uses canSeeSensitive and reveal logging

### Task W1-D: Simulated surfaces (Teams, Outlook, SAP B1) + real integration artefacts
**Files:** `src/components/mocks/**`, `src/app/sap/**`, `integrations/**`.

- `TeamsApprovalCard({ request, step, onApprove, onReject, onAsk })`: a pixel-faithful Teams Approvals Adaptive Card look. Sensitive rows use MaskedValue.
- `TeamsPanel`: the persona's Teams activity feed from notifications.
- `OutlookMessage`: an actionable message.
- `PhoneFrame`: Amy answering a question on mobile.
- `/sap`: "SAP Business One — Simulated sandbox" window chrome with:
  - (1) Data Transfer Workbench import wizard. Choose object → shows the DTW CSV from `generateDtw` → "Simulate" → "Import" → log "1 object(s) imported. CardCode C-MY-00123", which calls markCreatedInSap.
  - (2) Business Partner Master Data form (General / Contact Persons / Addresses / Payment Terms / Accounting tabs) and Item Master Data form, read from sapRecords, with a lookup list.
  - (3) a Service Layer tab with the POST payload, clearly badged "Phase 2".
- `integrations/teams/approval-card.json`: a valid Adaptive Card 1.5.
- `integrations/power-automate/flow-spec.md`
- `integrations/sap/dtw-templates/*.csv`
- `integrations/sap/service-layer-samples.json`

### Task W1-E: Synthetic data + data science (Python) → app JSON
Spec is in the final-model doc §5. Files: `analytics/**`, `src/data/**`. Details in Wave 1 prompt.

---

## Wave 2: Features (parallel; ~02:15–03:45)
- W2-A Intake (`src/app/requests/new/**`, `src/components/intake/**`, `src/app/api/extract/route.ts`)
- W2-B Approvals (`src/app/approvals/**`, `src/components/approvals/**`)
- W2-C Tracker + MDM console (`src/app/requests/page.tsx`, `src/app/requests/[id]/**`, `src/app/mdm/**`, `src/components/tracker/**`, `src/components/mdm/**`)
- W2-D Admin config (`src/app/admin/**`, `src/components/admin/**`)
- W2-E Regional Pulse (`src/app/pulse/**`, `src/components/pulse/**`)
- W2-F Inbox triage + Impact/business case (`src/app/triage/**`, `src/app/impact/**`, `src/components/impact/**`)

Each feature's acceptance criteria are in the Wave 2 prompts, derived from the final-model doc §3.

## Wave 3: Integrate and verify (~03:45–05:00)
- `next build` is green; `vitest` is green.
- Playwright `e2e/demo.spec.ts` walks the full demo path.
- Screenshot review of every page at 1440×900, then a fix loop.

## Wave 4: Ship (~05:00–07:00)
- README
- demo recording (Playwright video at 1920×1080 + ffmpeg)
- voiceover script
- 2-slide summary (pptx + pdf)
- secrets scan
- Vercel deploy (needs the user's 1-minute login)
