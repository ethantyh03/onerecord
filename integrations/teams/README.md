# Teams approval card (Adaptive Card 1.5)

`approval-card.json` is the production card that the Tesseract flow posts to each approver in Microsoft Teams and inside Outlook actionable messages. The in-app "Teams" mock (`src/components/mocks/TeamsApprovalCard.tsx`) renders the same content, so what judges click in the prototype is what approvers will see in Teams.

| File | What it is |
|---|---|
| `approval-card.json` | Card template: Adaptive Card schema 1.5 with `${...}` template bindings |
| `approval-card.data.json` | Sample data for one request (REQ-1042, the QA/RA step) to preview the template |

## Preview it in the Adaptive Cards Designer (2 minutes, no sign-in)

1. Open <https://adaptivecards.io/designer/>.
2. In the top bar, set **Select host app** to **Microsoft Teams** (light or dark). Set the target version to **1.5**.
3. Click into **Card Payload Editor** (bottom left), select all, and paste the contents of `approval-card.json`.
4. Click into **Sample Data Editor** (bottom right), select all, and paste the contents of `approval-card.data.json`.
5. Click **Preview mode**. The bindings resolve, and you see the card exactly as an approver would: the SLA chip, the facts, the "why you're seeing this" line, a comment box, and the four actions.

Try **Ask a question**: the card expands in place with a required question box, the same behaviour as in the prototype.

## What each part does

| Element | Binding | Purpose |
|---|---|---|
| Header strip | `${sla.label}`, `${sla.overdue}` | Business-day SLA from the approval matrix. Turns red (`Attention`) once overdue |
| Title + subtitle | `${request.title}`, `${request.id}`, `${requestor.name}`, `${request.entity}`, `${request.countryName}` | What is being approved and for whom |
| `FactSet` | `"$data": "${facts}"` | Repeats one fact per array item. The flow builds this array per approver |
| "Why you're seeing this" | `${step.label}`, `${step.addedBecause}` | Explains conditional steps (e.g. "Category = IVD reagent → regulatory review required"). Hidden with `$when` when the step is standard |
| `Input.Text` `comment` | – | Optional on approve, required on reject (the flow checks it and re-posts the card if empty) |
| `Action.Execute` `approve` / `reject` | `data.requestId`, `data.stepId` | Universal Actions (schema 1.4+). The same card works in Teams and in Outlook |
| `Action.ShowCard` → `Action.Execute` `ask` | `question` input | Pauses the SLA clock and routes the question to the requestor |
| `Action.OpenUrl` | `${detailsUrl}` | Opens the request in the Tesseract app (SharePoint list item / Power Apps screen in production) |

All three `Action.Execute` actions send `associatedInputs: "auto"`, so the comment or question travels with the decision.

## Production notes

- **Sensitive fields.** The flow builds `facts` for each approver separately. Bank details, credit limit and payment terms are included only for Finance and MDM approvers, and are masked as `•••• 1234` for everyone else. The card never carries more than the approver's role allows.
- **Size.** The Teams connector rejects messages above about 28 KB. This card is about 4 KB with data. Keep the facts to a short summary and link to the record for the rest.
- **Throttling.** The Teams connector allows about 100 calls per connection per 60 seconds. Group reminders into one scheduled run rather than one flow run per step.
- **Channels.** Post to 1:1 chats with the approver (Flow bot) or standard channels. Private channels are not supported by "Post adaptive card".
- **Execute vs Submit.** `Action.Execute` is the Universal Actions model and works in both Teams and Outlook. If your tenant's "Post adaptive card and wait for a response" action does not capture the response, change the three `Action.Execute` actions to `Action.Submit`. The `data` payload stays the same.
- **Outlook.** Actionable messages need Exchange Online and, since 8 Jun 2026, Microsoft Entra ID token authentication for custom integrations. They do not render in Office Professional Plus (Click-to-Run), Exchange on-premises OWA or OWA in a mobile browser. Those users get the plain email with the "Open in Tesseract" link.
- **Mobile.** The Power Automate mobile app was retired on 31 Aug 2026. Approvers act from Teams mobile, Outlook mobile or the Power Automate portal. The card renders in Teams mobile unchanged.

The full routing, reminder and escalation logic is specified in [`../power-automate/flow-spec.md`](../power-automate/flow-spec.md).
