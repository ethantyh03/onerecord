# analytics/ — raw CSV schemas (generator outputs)

The generator (`analytics/run_all.py --seed 42`) writes these CSVs to `analytics/out/`. Every modeller
(matcher, forecast/backtest, signals, bridge, business case) reads **only** these columns. The app never reads
CSVs: it reads the JSON in `src/data/`, whose shapes are fixed in `src/data/contract.ts`.

Conventions
- UTF-8, comma-separated, header row, `\n` line endings. Empty string = missing (never `NA`/`null`).
- Dates `YYYY-MM-DD`; months `YYYY-MM`; timestamps ISO 8601 with `+08:00`.
- Money: `sgd`, in SGD at fixed illustrative FX (A4), 2 dp. Units: integers.
- Countries `SG|MY|TH|VN|MM`. Entities `SPD|QTS|QTG`. Products `A|B|C`.
- Codes: customer `C-SG-00017`, golden `G-SG-0001`, item `I-A-000812`, PO `PO-<6 digits>`, PR `PR-<4 digits>`,
  enquiry `ENQ-<5 digits>`, follow-up `FUP-<5 digits>`, MDM request `REQ-<4 digits>`.
- History: Oct 2023 – Sep 2026 (36 months). Window: Oct 2025 – Sep 2026. Prior: Oct 2024 – Sep 2025.
- `true_*` columns are ground truth (known only because the data is synthetic). `recorded_*` columns are what SAP
  holds. Models may only use `recorded_*` plus the golden-ID crosswalk they produce; `true_*` is for scoring and for
  the "dedup" view (A6, decision 6).

Pinned rows (must exist exactly):
- `customers_records.csv`: `C-SG-00017, National University Hospital, SPD, SG, 198500123K, 5 Lower Kent Ridge Road, 119074, +65 6779 5555`, `has_transactions=false`, its own golden ID, **no rows in pos.csv**.
- `prs.csv`: `PR-5521` (Sungai Permai Medical Centre, MY, S$48,600) and `PR-5527` (Pulau Mutiara General Hospital, MY, S$21,400), both `status=blocked`, `blocked_by_request_id=REQ-1042`, item "Dengue IgG/IgM Combo 30T", Product A, SPD.

---

## customers_records.csv — one row per SAP customer record (OCRD), ~300 rows incl. ~6% duplicates
| column | type | notes |
|---|---|---|
| card_code | str | `C-SG-00017`; unique |
| card_name | str | as typed in SAP (variants, typos, romanisation) |
| entity | str | SPD/QTS/QTG — the entity that created the record |
| recorded_country | str | country on the record (may be wrong: misattribution) |
| lic_trad_num | str | tax ID / UEN / SSM / MST; may be blank on duplicates |
| street | str | |
| zip_code | str | SG 6 digits, MY/TH/MM 5, VN 6 |
| phone1 | str | `+65 6779 5555` |
| email | str | `*@*.example` |
| segment | str | `Public hospital` · `Private hospital` · `Diagnostic lab` · `Clinic` · `Research/academic` · `Industry` |
| created_at | date | record creation date (misattributed SG duplicates: Jan 2026) |
| has_transactions | bool | `true`/`false` |
| golden_id | str | **ground-truth** cluster id (do not use as a matcher feature) |
| true_country | str | ground truth |
| perturbation | str | blank for the canonical record; else one of `abbreviation|typo|word_reorder|romanisation|blank_tax_id|address_format|cross_entity` (`;`-joined if several) |

## golden_customers.csv — one row per real-world customer (ground truth), ~284 rows
| column | type | notes |
|---|---|---|
| golden_id | str | `G-MY-0001` |
| canonical_name | str | |
| country | str | true country |
| segment | str | as above |
| size_tier | str | `L|M|S` |
| first_po_month | str | `YYYY-MM`, blank if none |
| churn_month | str | `YYYY-MM` if it churns, else blank |
| installed_c | bool | owns a Product C instrument (pull-through signal) |
| planted | str | blank or `hero_my|misattribution_my|misattribution_vn|false_crosssell_th|romanisation_mm` |

## items.csv — one row per SAP item (OITM), ~120 rows
| column | type | notes |
|---|---|---|
| item_code | str | `I-A-000812` (prefix = recorded product group) |
| item_name | str | |
| recorded_product | str | A/B/C as held in SAP |
| true_product | str | differs for the planted miscategorised items |
| category | str | `IVD reagent` · `Medical device` · `Lab consumable` · `Instrument` (recorded) |
| true_category | str | |
| entity | str | owning entity |
| unit_price_sgd | float | list price used to value POs |
| uom | str | `kit`, `box`, `pack`, `unit` |

## pos.csv — confirmed customer PO **lines** (ORDR/RDR1). Volume = this table only (A6)
| column | type | notes |
|---|---|---|
| po_id | str | `PO-778812`; one PO may have several lines |
| line_no | int | 0-based |
| date | date | PO date |
| month | str | `YYYY-MM` (derived from date) |
| record_card_code | str | the SAP customer record the PO was booked to |
| golden_id | str | ground-truth customer |
| true_country | str | the customer's real country |
| recorded_country | str | country of `record_card_code` (≠ true_country for misattribution) |
| entity | str | selling entity |
| item_code | str | |
| true_product | str | |
| recorded_product | str | product of `item_code` in SAP (≠ true_product for miscategorisation) |
| units | int | > 0 |
| sgd | float | units × price × (1 − discount) |

Views: **raw** = group by `recorded_country × recorded_product`, customers by `record_card_code`.
**dedup** = group by `true_country × true_product`, customers by `golden_id`. Merging duplicates alone never changes
country × product totals; only rows with `recorded_country ≠ true_country` or `recorded_product ≠ true_product` do.

## prs.csv — customer purchase requests / accepted quotes (OQUT). Pipeline, not volume
| column | type | notes |
|---|---|---|
| pr_id | str | `PR-5521` |
| created_at | timestamp | |
| customer_name | str | as written by the customer |
| record_card_code | str | blank when the customer isn't set up yet |
| golden_id | str | |
| country | str | true country |
| entity | str | |
| item_code | str | blank when the item isn't set up yet |
| item_name | str | |
| product | str | true product |
| units | int | |
| sgd | float | |
| status | str | `open|blocked|converted|lost` |
| blocked_by_request_id | str | `REQ-1042` when blocked by a pending MDM request, else blank |
| converted_po_id | str | PO id when converted, else blank |

## enquiries.csv — price/availability/spec questions (leading indicator; counts only)
| column | type | notes |
|---|---|---|
| enquiry_id | str | `ENQ-00001` |
| received_at | timestamp | |
| golden_id | str | blank for prospects |
| customer_name | str | |
| country | str | |
| product | str | product asked about (A/B/C) |
| channel | str | `email|phone|web|rep` |
| converted_pr_id | str | PR id if it led to a PR, else blank |

## followups.csv — messages about an existing PO (excluded from demand)
| column | type | notes |
|---|---|---|
| followup_id | str | `FUP-00001` |
| received_at | timestamp | |
| po_id | str | the PO referenced |
| golden_id | str | |
| country | str | |
| topic | str | `delivery|invoice|return|credit_note|other` |

## mdm_requests_hist.csv — historic internal MDM setup requests (NOT demand; own axis)
| column | type | notes |
|---|---|---|
| request_id | str | `REQ-0001`… (seeded demo ids REQ-1001+ live in the app store, not here) |
| domain | str | `customer|vendor|item|costcentre|extend` |
| entity | str | |
| country | str | |
| requestor_role | str | `requestor|sales_manager|...` (RoleId) |
| submitted_at | timestamp | |
| created_in_sap_at | timestamp | blank if rejected/cancelled |
| status | str | `created|rejected|cancelled` |
| bounces | int | times sent back for missing info (A13: ~40% have ≥1) |
| cycle_days | float | calendar days submitted → created (as-is baseline, median ≈14; A26) |
| sap_code | str | code created (`C-SG-00123`, `I-A-000812`…), blank if not created |
| was_duplicate | bool | the record created duplicated an existing one |
| blocked_pr_ids | str | `;`-joined PR ids that waited on it |

## dup_truth.csv — ground-truth duplicate pairs (for matcher evaluation)
| column | type | notes |
|---|---|---|
| card_code_a | str | lexicographically smaller code |
| card_code_b | str | |
| golden_id | str | shared cluster |
| country_a | str | recorded country of a |
| country_b | str | recorded country of b (≠ a for misattribution pairs) |
| perturbation | str | perturbation(s) applied to b; `;`-joined |
| split | str | `tune` (SG+MY) or `holdout` (TH+VN+MM), by golden customer's true country |

Every pair of records that share a golden ID appears once. Pairs not listed are non-duplicates.

---

## Outputs → app JSON (src/data/, shapes in contract.ts)
| JSON | Built from |
|---|---|
| meta.json | params.yaml + planted-pattern assertions |
| master.json | customers_records.csv (→ CustomerMaster) + items.csv (→ ItemMaster, recorded values) |
| matrix.json | pos.csv, raw and dedup views |
| streams.json | enquiries.csv, prs.csv, pos.csv, mdm_requests_hist.csv |
| bridge.json | pos.csv by record (raw) vs golden_id (dedup) |
| backtest.json, stress.json, cleanxmethod.json | pos.csv monthly units per true_country × true_product (and raw for the 2×2) |
| matcher_eval.json | customers_records.csv + dup_truth.csv |
| signals.json, actions.json | pos.csv + golden_customers.csv |
| dedup.json | customers_records.csv + pos.csv + items.csv |
| summary.json | the 5 headline numbers from the files above + business case |
| triage_eval.json | blind labelled message set (triage-eval agent) |
| inbox.json | hand-written sample messages |
