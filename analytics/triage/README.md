# Inbox triage: rules, dev set and blind test

`classifyMessage()` in `src/lib/engine/triage.ts` sorts each inbound message into one of five streams:

| Label | Meaning |
|---|---|
| `po` | Confirmed order that carries a PO number (PO, P.O., LPO, Purchase Order No.) |
| `pr` | Intent to buy a specific product and quantity ("quote accepted", "please proceed", "we'd like to order", "PO to follow"), with no PO number yet |
| `enquiry` | Questions about price, availability, specs or lead time, with no commitment. A quantity may be mentioned hypothetically. |
| `followup` | About an existing order, PO, delivery, invoice, backorder, return or credit note |
| `mdm` | Asks to set up, extend or change a customer, vendor, item or cost-centre record (new account, new ship-to, bill-to change, bank details, new item code, new branch) |

## Method

The classifier uses transparent weighted rules. It has no model and learns no weights.

1. **Detectors.** Regex detectors look for signals, and each signal adds weight to one class and attaches a readable reason, such as
   `Contains PO number PO-778812` or `Refers to an existing order or delivery ("not received")`. All weights are kept together in `TRIAGE_WEIGHTS`:
   - **mdm**: an explicit setup or change request scores 8. A softer hint ("update your records", "new purchasing email") scores 3. A bare mention of an "item code" scores 1. An internal sender adds 1.
   - **po**: a new PO number (at least 3 digits) scores 5. Order wording ("please find", "kindly supply", "as per PO") adds 1, and a quantity adds 0.5.
   - **pr**: a commitment ("accept your quotation", "please proceed", "intend to order", "pls book") scores 3. "PO to follow / will raise PO" scores 2, repeat-order wording scores 2, "please supply/arrange N…" scores 2 and a quantity adds 0.5.
   - **enquiry**: a topic word (price, stock, lead time, spec, brochure, demo…) scores 2, plus 1 when there are several. A question adds 1. A no-commitment phrase ("if we order", "not an order yet", "indicative") adds 2.
   - **followup**: delivery chasing, a problem with goods (partial, damaged, wrong item, return, short expiry), amending or cancelling an order, and delivery documents (DO, COA, "received yesterday") each score 3. Billing (invoice, credit note, SOA, payment made) scores 2, and a reference to a past order ("our order last week", SO-12345) scores 2.
2. **Scoring.** The scores for each class are summed and the highest score wins.
3. **Precedence.** Ties are broken in this order: `mdm > followup > po > pr > enquiry` (`TRIAGE_PRECEDENCE`).
4. **Confidence.** Confidence is `1 − exp(−margin / 2.5)`, where *margin* is the top score minus the runner-up score. When the margin is under 2, the reasons also say what the message *also* looks like, so the person routing it sees the alternative.
5. **Fallback.** A message with no signals is filed as an enquiry with confidence 0.2.

### Precedence rules for the hard cases

- **PO number inside a follow-up → follow-up.** If any follow-up signal fires (delivery chase, problem, amend or cancel, documents, billing query, or a past-order reference), the PO number is treated as a *reference*. It then adds only 1 to `followup` and 1 to `po`, instead of 5 to `po`.
  Two weaker signals count only when the message has no quantity and no order wording: a plain "invoice" word, and "advise delivery date". A brand-new PO often contains these as instructions.
- **Enquiry with a quantity → enquiry.** A quantity adds only 0.5. Without commitment wording, a quantity cannot outweigh question and price signals, and hypothetical wording ("if we order 500 boxes") adds to `enquiry`.
- **MDM request inside an order email → MDM.** An explicit setup or change request scores 8, which is more than a PO number plus wording plus quantity (6.5). The order cannot be booked until the record (ship-to, account, item code) exists, so MDM must act first.
  The low margin gives low confidence, and the reasons add "Also looks like a PO", so the order is not lost.
- **PR that says "PO to follow" → pr.** Phrases like "PO to follow", "will raise PO" and "official LO will be issued" add to `pr`. They count only when no PO number follows. A real PO number (5) outweighs a quote acceptance (3).
- **Proforma invoice** is a pre-order document. It is removed before the billing detector runs.

## Data and the honesty rule

| Set | File | Who wrote it | Used for |
|---|---|---|---|
| Dev | `analytics/triage/devset.json`: 80 messages, 16 per label, 33 marked `hard` | The author of the rules | Writing and tuning the rules; regression test in `src/lib/engine/__tests__/triage.test.ts` (accuracy ≥ 0.85, recall for each class ≥ 0.75) |
| Dev | `src/data/inbox.json`: 25 demo messages with `humanLabel` | Earlier in the project | Extra dev material (regression test: agreement ≥ 0.9) |
| Blind test | `analytics/triage/testset.json`: 60 messages, 12 per label | **A different agent, written blind** | Final scoring only, by `npx tsx analytics/triage/eval_triage.ts` → `src/data/triage_eval.json` |

**Honesty rule:** the rules were tuned only on the dev material above. The rules author never opened, read, grepped or printed the blind test set, its per-message eval output (`eval_detail.json`) or the error examples in `triage_eval.json`. After the final rules were frozen, the eval script was run once, and only the aggregate accuracy and per-class recall were looked at.
Whatever that number is, it is reported as is. Tuning the rules on test-set errors would make it a dev set, and the score would no longer measure anything.

Dev accuracy is by construction close to 100%, because the rules were written against these messages. The blind test accuracy is the honest estimate of how the rules perform on new mail.

## Results (rules frozen, single blind run)

| | Accuracy | po | pr | enquiry | followup | mdm |
|---|---|---|---|---|---|---|
| Dev (80) | 1.000 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| Demo inbox (25) | 1.000 | | | | | |
| Previous rules, blind test (60) | 0.467 | | | | | |
| **New rules, blind test (60)** | **0.917** (macro-F1 0.917; hard 0.879, easy 0.963) | 0.833 | 0.833 | 1.000 | 1.000 | 0.917 |

The per-class columns show recall. The individual blind-test errors were not inspected.

## Reproduce

```bash
cd C:/Users/ethan/dev/onerecord
npx vitest run src/lib/engine/__tests__/triage.test.ts   # dev-set regression + unit tests
npx tsx analytics/triage/eval_triage.ts                   # blind test → src/data/triage_eval.json
```
