# Tesseract production flows: Power Automate specification

This is the build spec for the Microsoft 365 version of Tesseract. The prototype's routing engine (`src/lib/engine/routing.ts`, `sla.ts`) implements the same logic, so each prototype behaviour below maps to a named flow action.

**Licensing summary.** Flows 1 to 3 use **standard connectors only** (SharePoint, Approvals, Microsoft Teams, Office 365 Outlook, Office 365 Users). They run on the Microsoft 365 licences Lives Group already has. Only Flow 4, which writes to SAP Business One, uses a premium connector. It runs under **one Power Automate Process licence**, not per-user Premium.

---

## 1. Data model (SharePoint, default environment)

All state lives in SharePoint lists on one site, `MDM`. There is no Dataverse and no model-driven app, so all ~250 requestors stay on M365 rights. (The Approvals connector stores its own records in the default environment's Dataverse, which Microsoft provisions automatically and which needs no extra licence. It has no backups, which is why the SharePoint list, not the Approvals history, is the system of record.)

| List | Key columns | Written by |
|---|---|---|
| **MDM Requests** | `RequestId` (REQ-####), `Domain` (Customer / Vendor / Item / Cost centre / Extend), `Title`, `Requestor` (Person), `Entity`, `Country`, `Status` (In approval / Needs info / MDM review / Created / Rejected), `DataJson` (multi-line, the form payload), `ConfigVersion`, `ExpectedBy`, `SapCode`, `BlockedPRs` | Power Apps form, Flows 1–3 |
| **Approval Steps** | `RequestId` (lookup), `StageIndex`, `StageMode` (Parallel / Sequential), `Role`, `Approver` (Person), `OriginalApprover`, `Status`, `ActivatedAt`, `DecidedAt`, `Comment`, `ReminderSentAt`, `EscalatedAt`, `PausedMinutes`, `AddedBecause`, `ApprovalId` | Flow 1 |
| **Approval Matrix** | `Domain`, `Entity`, `StageIndex`, `StageMode`, `Role`, `ConditionField`, `ConditionOp`, `ConditionValue`, `Label` | Admin screen (config, versioned) |
| **Role Assignments** | `Entity`, `Role`, `Person`, `Delegate`, `OutOfOffice`, `Manager` | Admin screen |
| **Business Calendar** | `Country`, `Date`, `Holiday` | MDM team, once a year |
| **Audit Log** | `Seq`, `RequestId`, `At`, `Actor`, `Action`, `Detail`, `Before`, `After`, `PrevHash`, `Hash` | Every flow (append-only; list permissions deny edit and delete to everyone except the flow service account) |

Sensitive columns (bank details, credit limit, payment terms) are kept in a separate **MDM Requests – Restricted** list that only the Finance and MDM security groups can read. The main list holds only the masked value (`•••• 1234`).

---

## 2. Flow 1: Route MDM request (automated, standard connectors)

**Trigger:** SharePoint · *When an item is created* (Site `MDM`, List `MDM Requests`). Trigger condition: `@equals(triggerOutputs()?['body/Status/Value'], 'In approval')`.

**Concurrency:** trigger concurrency off (each request is its own run). Flow run duration limit is 30 days, well beyond the 4-business-day target.

### 2.1 Build the route

1. **Get items** · `Approval Matrix`, filter `Domain eq '<Domain>' and (Entity eq '<Entity>' or Entity eq 'All')`, order by `StageIndex`.
2. **Get items** · `Role Assignments`, filter `Entity eq '<Entity>'`.
3. **Filter array** · keep matrix rows whose condition holds against `DataJson`:
   - `equals`: `equals(string(body('Parse_DataJson')?[item()?['ConditionField']]), item()?['ConditionValue'])`
   - `in`: `contains(split(item()?['ConditionValue'], ';'), string(...))`
   - `gt`: `greater(float(...), float(item()?['ConditionValue']))`
   - Examples: `creditLimit gt 50000` adds the Finance Director; `category in IVD reagent;Medical device` adds QA/RA with `AddedBecause = "Category = IVD reagent → regulatory review required"`.
4. **Select** · resolve each row's role to a person from Role Assignments. If `OutOfOffice` is true and `Delegate` is set, use the delegate and keep `OriginalApprover`.
5. **Append** the MDM final-check stage (role `mdm`, always last).
6. **Apply to each** route row → **Create item** in `Approval Steps` (Status `Waiting`).
7. **Update item** · `MDM Requests.ExpectedBy` = start date + (number of stages × 2 business days), using the Business Calendar.
8. **Append audit** (child flow "Append audit event", see section 6) · action `submitted`.

### 2.2 Run each stage

**Apply to each** distinct `StageIndex`, **concurrency control on, degree 1**, so stages run strictly in order.

Inside, **Apply to each** step of the stage:

- Parallel stage: **concurrency degree 20**, so every step's approval starts at the same time.
- Sequential stage: **degree 1**.

For each step, run the block below.

```
Scope "Step"
├─ Update item (Approval Steps): Status = Pending, ActivatedAt = utcNow()
├─ Parallel branch A: the decision
│   └─ Start and wait for an approval        ← Approvals connector (standard)
│        Approval type: Custom Responses – Wait for one response
│        Response options: Approve | Reject | Ask a question
│        Title: "<Title> · <Step label>"
│        Assigned to: <Approver email>
│        Details (Markdown): request summary, role-filtered facts, "Why you're seeing this: <AddedBecause>"
│        Item link: Power Apps request screen URL
│        Settings → Timeout: P10D (hard stop; escalation fires long before)
│     └─ Set variable StepDone = true
├─ Parallel branch B: reminders and escalation
│   └─ Do until  StepDone = true          (limits: count 40, timeout P10D)
│        ├─ Delay 1 hour
│        ├─ Get item (Approval Steps)  → current Status, PausedMinutes
│        ├─ Compose ElapsedBD = business days since ActivatedAt − PausedMinutes/1440
│        ├─ Condition: Status = Pending AND ElapsedBD ≥ 1 AND ReminderSentAt is empty
│        │    └─ Post adaptive card in a chat (Flow bot → Approver): reminder card
│        │       Update item: ReminderSentAt = utcNow(); Append audit "reminder"
│        └─ Condition: Status = Pending AND ElapsedBD ≥ 3 AND EscalatedAt is empty
│             └─ Escalate:
│                  Target = Delegate ?? Manager (Role Assignments)
│                  Post adaptive card in a chat (Flow bot → Target): approval-card.json
│                  Send an email (V2) to the original approver: "Escalated to <Target>"
│                  Update item: OriginalApprover = Approver, Approver = Target, EscalatedAt = utcNow()
│                  Append audit "escalated"
└─ Switch on outcome (after branch A)
    ├─ Approve  → Update item: Status Approved, DecidedAt, Comment; Append audit "approved"
    ├─ Reject   → Update item: Status Rejected; MDM Requests.Status = Rejected;
    │             Post card to requestor with the reason; Append audit "rejected";
    │             Terminate (Succeeded)
    └─ Ask a question → Run child flow "Ask requestor" (section 2.3), then loop back to branch A
                         for the SAME approver (the chain does not restart)
```

Reminder and escalation each fire **once per step**: the `ReminderSentAt` and `EscalatedAt` checks make the loop idempotent. This is the same rule the prototype's `slaTick` unit test enforces.

An escalation does not cancel the original approval. The original approver and the escalation target can both still act; the first response recorded wins. This uses the Approvals connector as designed, with no unsupported "reassign" call.

### 2.3 Child flow: Ask requestor (standard)

1. **Update item** (Approval Steps) · `Status = Question`, `PausedAt = utcNow()`. MDM Requests `Status = Needs info`.
2. **Post adaptive card and wait for a response** (Microsoft Teams, Flow bot → requestor). The card shows the approver's question and an `Input.Text` answer box. It renders in Teams mobile, which covers requestors who are travelling.
3. On response: **Update item** · `PausedMinutes += minutes since PausedAt`, `Status = Pending`, store the Q&A. MDM Requests `Status = In approval`.
4. Append audit `question` and `answered`.
5. Return the answer to the parent flow, which re-issues the approval to the same approver with the Q&A in the details.

The SLA clock is paused for exactly the time the question was open.

### 2.4 After the last business stage

- **Update item** · MDM Requests `Status = MDM review`.
- **Post adaptive card in a channel** · `MDM Team › Queue`: "REQ-1042 is approved and ready for SAP B1", with an "Open in MDM console" link.

The MDM final-check stage is a normal step (role `mdm`). Approving it means "checked and ready to load". The flow then waits for Flow 2.

---

## 3. Flow 2: Record created in SAP B1 (automated, standard)

**Trigger:** SharePoint · *When an item is created or modified* (`MDM Requests`). Trigger condition: `Status = Created` and `SapCode` is not empty.

1. **Post adaptive card in a chat** (Flow bot → requestor): "Your record is live in SAP B1: `I-A-000813`".
2. **Send an email (V2)** to the requestor with the same message (for Outlook-first users).
3. **Get items** · `Purchase Requests` where `BlockedByRequestId eq <RequestId>` → **Update item** each: `Status = Open`, `CustomerCode` or `ItemCode` = SapCode.
4. **Post message in a chat** to each PR owner (sales): "PR-5521 can now be converted to a sales order".
5. Append audit `created_in_sap`.

**Phase 1 (DTW):** the MDM analyst sets `Status = Created` and the SAP code after loading the DTW files (see `../sap/README.md`). The analyst is the person in the loop.

**Phase 2:** Flow 4 sets `Status` and `SapCode` automatically.

---

## 4. Flow 3: Daily SLA digest (scheduled, standard)

**Trigger:** Recurrence · weekdays 08:30, time zone Singapore Standard Time.

1. **Get items** · Approval Steps where `Status eq 'Pending'`.
2. **Filter array** · elapsed business days ≥ 2.
3. **Create HTML table** → **Send an email (V2)** to the MDM team: one digest instead of one email per breach.
4. **Post adaptive card in a channel** `MDM Team › SLA` with the breach count.

This flow also keeps Teams under the connector throttle (about 100 calls per connection per 60 seconds): the digest is one call, not one per step.

---

## 5. Flow 4: Post to SAP B1 Service Layer (Phase 2, premium, Process licence)

Built with the SAP partner. Not part of the Phase 1 go-live.

**Trigger:** SharePoint · *When an item is created or modified* (`MDM Requests`), with the trigger condition `Status = MDM approved`.

```
Scope "Try"
├─ Get secret (Azure Key Vault): b1-integration-user          ← premium
├─ HTTP / custom connector: POST https://<b1-server>:50000/b1s/v2/Login
│     body {"CompanyDB": "...", "UserName": "...", "Password": "..."}
│     → SessionId, cookies B1SESSION + ROUTEID (idle timeout 30 min)
├─ Compose payload from DataJson + Restricted list (field map = sapField in config)
├─ HTTP: POST /b1s/v2/$batch  (BusinessPartners + addresses + contacts + bank in one changeset)
│     or POST /b1s/v2/Items  |  POST /b1s/v2/ProfitCenters
├─ Parse JSON → CardCode / ItemCode / CenterCode
├─ Update item: SapCode, Status = Created   (fires Flow 2)
└─ HTTP: POST /b1s/v2/Logout  (204)
Scope "Catch" (run after: Try failed / timed out)
├─ Update item: Status = MDM review, add the error text
├─ Post adaptive card in a channel: MDM Team › Integration errors
└─ Append audit "sap_post_failed"
```

- **Connectivity.** If B1 is on-premises, the custom connector runs through the on-premises data gateway (premium). If the partner hosts B1 with a reachable Service Layer, no gateway is needed, but the HTTP or custom connector is still premium.
- **Identity.** B1 records the integration user as the creator. The approving M365 user and the request ID are written to the UDF `U_TesseractRef` so the audit trail joins up.
- **Atomicity.** `$batch` with one changeset rolls the whole business partner back if any child row fails.
- **Closing the loop.** On B1 10.0 FP 2602 or later, Service Layer webhooks (`BusinessPartners` Created/Updated) can notify a HTTP-triggered flow when someone creates a record outside the workflow, so MDM governance sees it. Webhooks are off by default and need the Webhook Messenger Service.

---

## 6. Child flow: Append audit event (standard)

Every flow calls this child flow; none of them writes the Audit Log list directly.

1. **Get items** · Audit Log, order by `Seq desc`, top 1 → `PrevHash` (`0` × 64 for the first event).
2. **Compose** the canonical JSON of the event (`seq, requestId, at, actorId, action, detail, before, after, prevHash`).
3. **Hash.** Power Automate has no built-in SHA-256 expression. Use a small Azure Function (the same one that hosts the duplicate matcher) to return the SHA-256 of `PrevHash + JSON`. The prototype's `src/lib/engine/audit.ts` is the reference implementation.
4. **Create item** · Audit Log.

Tampering with any row breaks every later hash, which the MDM console's "Verify chain" check reports.

---

## 7. Licensing and limits

| Item | Covered by | Notes |
|---|---|---|
| Flows 1–3 and both child flows | Microsoft 365 licences (standard connectors) | SharePoint, Approvals, Microsoft Teams, Office 365 Outlook and Office 365 Users are all standard connectors. "Any license that grants access to Power Automate and the ability to use standard connectors is sufficient to create approval flows" (Microsoft Learn). |
| Power Apps request form | Microsoft 365 licences | Canvas app on a SharePoint list in the default environment. No Dataverse tables, so no premium. |
| Flow 4 (SAP posting) | **1 × Power Automate Process licence**, about USD 150/month (USD 1,800/year) | HTTP, custom connectors, Azure Key Vault and the on-premises data gateway are premium. Under Microsoft's multiplexing rule, a requestor who indirectly triggers a premium flow and gets value back would need Premium too. A Process licence licenses the flow itself, so the 250 requestors don't. One licence covers a flow group of up to 25 solution-aware flows in one environment. |
| Flow maker | 1 × Power Automate Premium (about USD 15/user/month) for the person who builds and maintains Flow 4 | Only if that maker also runs premium flows outside the Process-licensed group. |
| Action volume | 6,000 actions per user per day on M365 (not pooled) | The reminder loop polls hourly: about 10 actions per step per business day, comfortably inside the limit. |
| Teams card size | About 28 KB per card | `../teams/approval-card.json` is about 4 KB with data. |

Compared with licensing all 250 users for Premium (about USD 45,000 a year), the Process-licence design costs about USD 1,800 a year plus at most one maker licence.

---

## 8. Mapping to the prototype

| Prototype behaviour | Production action |
|---|---|
| Route preview and expected completion date | Flow 1 §2.1 steps 1–7 |
| Conditional QA/RA and Finance Director steps (`addedBecause`) | Approval Matrix conditions, Filter array |
| Parallel stage activating 3 approvers at once | Apply to each, concurrency degree 20 |
| Teams approval card (Approve / Reject / Ask a question) | Start and wait for an approval (Custom Responses), `approval-card.json` |
| "Ask a question" pausing the clock and returning to the same approver | Child flow "Ask requestor", `PausedMinutes` |
| Fast-forward → one reminder, then one escalation | Parallel branch B, Do until with `ReminderSentAt` and `EscalatedAt` guards |
| Out-of-office delegate | Role Assignments `OutOfOffice` + `Delegate` in §2.1 step 4 |
| MDM console → DTW files → "Created in SAP B1" | Phase 1 manual DTW load, then Flow 2 |
| "Push via Service Layer (Phase 2)" | Flow 4 |
| Hash-chained audit trail | Child flow "Append audit event" |
