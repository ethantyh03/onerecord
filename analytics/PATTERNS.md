# Planted patterns in the Tesseract synthetic data

All data in Tesseract is **synthetic and illustrative**. It comes from one seeded script,
`analytics/generate.py`, and every number it uses is in `analytics/params.yaml`, where each value is
commented with its source. This page lists every pattern we planted on purpose, the parameter that controls it, where the
number comes from, and what the base run actually produced. Because the patterns are known in advance, a good score here
shows that the pipeline **can** find them. It does not show that they exist in Lives Group's real data. The stress
test in the last section checks that our forecasting method finds no structure when there is none.

```
python analytics/generate.py --seed 42 --scenario base       --out analytics/out/base        # ~2 s
python analytics/generate.py --seed 42 --scenario nosignal   --out analytics/out/nosignal
python analytics/generate.py --seed 7  --scenario halfdengue --out analytics/out/halfdengue
```

Outputs are the CSVs in `analytics/SCHEMA.md`, plus two JSON files:
- `plants.json`: ground truth for each pattern (codes, names, measured sizes).
- `manifest.json`: summary statistics and the PASS/FAIL result of every data-level assertion in final-model §5.6.

The base run passes all 36 of these assertions.

The run is deterministic. The random draws are split per customer and per component (structure, A/B demand,
instruments, streams), so changing one parameter never reshuffles unrelated accounts.

Source tags:
- **[R: …]**: a section of the research log `docs/research/2026-10-23-business-case-facts.md`.
- **[A#]**: the assumption register.
- **[FM]**: the final model.
- **[DS#]**: the data-science judge's decisions.
- **[T]**: a team assumption, labelled because no source exists.

## Scope and definitions

| Item | Value | Source |
|---|---|---|
| History | Oct 2023 – Sep 2026 (36 months, daily-dated PO lines; aggregate monthly) | FM decision 21 |
| Window | Oct 2025 – Sep 2026, compared with Oct 2024 – Sep 2025. Momentum compares Jul–Sep 2026 with Jul–Sep 2025 | DS1 |
| Volume | Confirmed PO lines only (`pos.csv`). PRs, enquiries, follow-ups and MDM requests are separate streams | A6 |
| Countries | SG, MY, TH, VN, MM. Weights SG > MY > TH > VN > MM: S$17.0 / 14.5 / 9.8 / 8.0 / 3.8M at Apr 2025 | R: IVD market size (SG and MY/TH/VN/MM); MM assumed small |
| Customers | 363 real-world (golden) customers and 388 SAP records across 6 segments, L/M/S size tiers | R: Customer base size [T] |
| Items | 120 SKUs: 50 A (IVD reagents/kits), 40 B (consumables), 25 C (instruments), 5 planted duplicates | A3 [T prices] |
| Entities | SPD sells A, QTG sells B, QTS sells C. Records belong to the entity that created them | A2 |
| Base result (12M, de-duplicated) | **S$53.4M, +4.0% YoY.** SG 17.1 · MY 13.7 · TH 10.0 · VN 9.3 · MM 3.3 (S$M). A 31.4 · B 12.2 · C 9.8 | |

## Data-quality patterns (what "duplicates hide the truth" is built on)

| # | Pattern | How it is planted | Parameter | Source | Measured (base, seed 42) |
|---|---|---|---|---|---|
| D1 | **Duplicate customer records, about 6%** | Some large customers get a second (or third) record. It is usually created by another entity (`cross_entity`), sometimes by the same entity under a different requestor | `duplicates.*` | A13, DS6 | 25 of 388 records (6.4%). 26 true pairs: 11 in the tuning set (SG+MY), 15 held out (TH+VN+MM) |
| D2 | **Realistic perturbations, deliberately not mirrored in the normaliser** | Typos; word reorder ("Hospital, Sabe Zaw"); Thai and Myanmar romanisation (Chaloem→Chalerm, Myittar→Myitta, Chao Phraya→Jao Praya); Vietnamese ↔ English ↔ unaccented forms (Bệnh viện Đa khoa Hồng Lạc / Benh vien Da khoa Hong Lac / BVĐK…); blank tax IDs; different address formats; plus the abbreviations (Hosp, Gen, Med Ctr, Spec) | `duplicates.name_perturbations`, `blank_tax_id_p` | DS5 | Count of pairs carrying each perturbation: blank tax ID 16, abbreviation 14, cross-entity 11, word reorder 8, romanisation 8, address 6, typo 5. Ground truth is in `dup_truth.csv` |
| D3 | **Near-miss non-duplicates** (sister sites), so that precision can fall below 1 | One pair per country: Lavender Bay Pathology Lab (Bedok) / (Jurong East); Seri Mutiara Family Clinic Ipoh / Klang (**same group tax ID**); Siam Riverside Hospital Chiang Mai / Phuket; Bệnh viện Đa khoa Bình An / Phòng khám Đa khoa Bình An; Thiri Mingalar Hospital / Clinic | `duplicates.near_miss_pairs` | DS5 ("a suspiciously perfect score fails") | 5 pairs. Everything else is name-guarded: no two unrelated customers look alike by accident |
| D4 | **Country misattribution from Jan 2026** | SG-based staff create SG-coded duplicates ("regional billing") for a MY and a VN hospital, and those hospitals' SPD/QTG POs book to SG from 7–12 Jan 2026. The SG-coded records have blank tax IDs, so a matcher that blocks on country misses them (an honest miss) | `plants.misattribution` | DS4, DS6, FM §5.6 #2 | **MY 4.7%** of 12M value: Hospital Taman Seri C-MY-00066 → C-SG-00074 (3.5%), plus Hospital Permatang Sutera → C-SG-00075 (1.2%). **VN 4.5%**: Bệnh viện Quốc tế Sông Sen C-VN-00035 → C-SG-00076. In the raw view SG is +6.2%, MY −4.7% and VN −4.5%. Group total unchanged |
| D5 | **Miscategorisation: A test kits re-created under Product B** | 5 duplicate item codes `I-B-0009xx` (category "Lab consumable") for real A kits: influenza, chikungunya, malaria, urine strips, typhoid. TH (and some VN/MM) staff use them from 2025 | `plants.miscategorisation` | DS lead prompt "~3–5%" [T] | 5 of 120 items (4%). S$350k (1.1% of A); TH 4.6% of its A value, VN 1.1%, MM 0.4% |
| D6 | **Merging duplicates alone does not change country × product totals** | Only D4 and D5 move value between cells. Raw and de-duplicated group totals are identical | (by construction) | DS6 | Assertion passes (Δ = S$0) |
| D7 | **Pinned demo master record** | National University Hospital C-SG-00017, SPD, SG, 198500123K, 5 Lower Kent Ridge Road 119074, +65 6779 5555. `has_transactions=false`, golden ID G-SG-0000. No other SG name contains national, university, natl or univ, so nothing else can match "Natl Univ Hosp" | `pinned.nuh` | Plan pinned facts, A17 | Exact row; 0 PO lines |

## Demand patterns

| # | Pattern | How it is planted | Parameter | Source | Measured (base) |
|---|---|---|---|---|---|
| P1 | **Country trends** | Organic log-linear growth by country × product: VN fast (A and B +15%/yr); SG/MY steady; TH mixed (A up, B flat); MM declining (−7%/yr) with larger shocks | `countries.*.trend`, `macro_sd` | R: IVD market size (4–7%/yr); VN 2026 surge [T] | YoY: SG +2.5%, MY +6.8%, TH +3.5%, VN +8.9% (A +20.7%), MM −9.6% |
| P2 | **Dengue seasonality on A, with amplitude that varies by year** | Dengue-test demand = floor + case index × monthly shape. Peaks: SG May–Oct, TH Jun–Sep, VN Jul–Nov, MM Jun–Aug, MY mild Nov–Mar. Year index: SG 2024 = 1.0, 2025 = 0.29, 2026 = 0.25; MY 2025 = 0.45 × 2024; VN 2026 = 2.5 × 2025 | `dengue.*`, `product_a_groups.dengue_share` | R: Disease seasonality – dengue (SG / MY / TH, VN, MM) | SG dengue-kit units May–Oct 2025 are **−46%** vs 2024, peak in July. 12M dengue-kit value: SG −13% (other A +3%, so **SG A is flat because of the weak dengue season, not lost customers**), VN +42% |
| P3 | **Respiratory seasonality** | SG peaks Dec–Mar and May–Aug; TH Jun–Aug plus Dec–Feb. One SG wave (May–Jun 2025, ×1.3) plus two small unsourced waves | `respiratory.*` | R: Disease seasonality – influenza/respiratory | Built into A |
| P4 | **Holiday dips and pre-holiday stocking** | Day-level calendar: CNY (SG/MY), Tet 9 days (VN), Songkran (TH), Thingyan (MM), Hari Raya (MY/SG), year-end. Holiday days run at 5% weight, the days after long breaks at 60%, with +10–30% stocking beforehand. Lunar dates move (CNY Feb 2024 / Jan 2025 / Feb 2026) | `calendar.*` | R: Holiday effects (dates sourced; size is an assumption) | Feb 2026 against its neighbours: VN −29% (Tet), SG −26% (CNY); Apr 2026: TH −17% (Songkran), MM −39% (Thingyan) |
| P5 | **Fiscal-year budget flush on C (instruments)** | Monthly weights by fiscal year: SG and MM Apr–Mar (Feb–Mar peak), MY and VN Jan–Dec (Q4 peak; VN spills into Jan), TH Oct–Sep (Jul–Sep peak plus an Oct–Dec signing bump). Full effect for public hospitals and academia, 30% for private | `product_c.flush_weights` | R: Fiscal year SG/MY/TH/VN/MM | Share of C value in the FY-end quarter: SG 32%, MM 33%, MY 29%, VN 46%, TH 40% (an even spread would be 25%) |
| P6 | **Thai FY2024 budget delay** | TH public capex ×0.5 in Oct 2023–Mar 2024, then ×1.5 catch-up in Apr–Sep 2024 | `product_c.th_budget_delay` | R: Budget-delay shocks – Thailand | TH public C: S$228k, then S$771k, against a normal half-year of ~S$431k |
| P7 | **Myanmar earthquake (28 Mar 2025) and instability** | Emergency spike in Apr–May 2025 (B ×1.22, A ×1.12) and a Feb 2024 disruption. Higher macro noise | `myanmar.shocks` | R: Demand shocks – Myanmar | MM B in Apr–May 2025 is +13% vs 2024 while the trend is −7% |
| P8 | **B seasonality** | Academic calendar for research and academic customers (Jun and Dec dips, Aug–Sep high). Public FY-end flush on consumables (+30%), slow first FY month | `product_b.*` | [T] (no source quantifies a flush; R: Gaps) | Built into B |
| P9 | **C installs pull A through (razor and blade)** | 35% of analyser POs are new placements, and each adds 25%/yr of its price to that customer's A run-rate from the next month. Used as a **cross-sell signal, not a forecast feature** | `product_c.new_placement_share`, `pull_through_ratio` | R: Razor-and-blade evidence; DS10 | 196 placements. `golden_customers.installed_c` = 163 customers |
| P10 | **Value mix A ≈ 3 × C** | Per-country A:B:C targets of 0.595 : 0.225 : 0.18 at the reference month | `product_mix_target` | R: Razor-and-blade (Sysmex reagents 61.6% vs instruments 20.6%) | A:C = **3.21** (12M) |
| P11 | **Stable baskets, lumpy reorders** | Each customer runs a fixed set of SKUs. A SKU is re-ordered when its accumulated need passes a reorder value, which is redrawn ±50% after each order, so reorders are not periodic | `customer_dynamics.basket_size`, `reorder_*` | [T] | 54,100 PO lines in 40,511 POs |

## Customer-level patterns (for the bridge, signals and country cards)

| # | Pattern | How it is planted | Parameter | Source | Measured (base) |
|---|---|---|---|---|---|
| C1 | **Hero account, MY (the #2 MY hospital)** | Bukit Damai Specialist Hospital G-MY-0002 has 3 records. C-MY-00029 (SPD) has its last PO in Mar 2026 ("lost"). C-MY-00091 "Bukit Damai Spec Hospital" (SPD, new requestor, blank tax ID) has its first PO in Apr 2026 ("new"). C-MY-00061 "Specialist Hospital Bukit Damai" (QTS) carries B and is flat. Each record looks small; merged, the account is declining | `plants.hero.MY` | FM §5.6 #1, DS lead prompt | Merged **−32% YoY, #2 MY account by 12M value**. Flat record +4% |
| C2 | **Key account per country, split across records** | SG Tanjong Rhu Crest Medical Centre (C-SG-00033 → "Med Ctr" C-SG-00077 from Feb 2026). TH Chao Phraya Rim Hospital (→ QTG record "Jao Praya Rim Hospital" from May 2026). VN Bệnh viện Đa khoa Hồng Lạc (→ unaccented record from Jan 2026). MM Thukha Yeik Specialist Hospital (→ "Thuak Yeit…" from Dec 2025) | `plants.hero.*` | DS lead prompt | Merged YoY: SG −34%, TH −26%, VN −29%, MM −31% |
| C3 | **False cross-sell gap (TH)** | Sri Chaloem Hospital: the SPD record (C-TH-00001) buys only A, and the QTS record "Si Chalerm Hosp" (C-TH-00063) buys only C. Raw, each looks like a 2-product gap; merged, the only real gap is B | `plants.th_false_xsell` | FM §5.6 #3 | Assertion passes |
| C4 | **VN: "4 hospitals buy A but never B"** | 4 VN hospitals with B switched off: Bệnh viện Thuận Phong, Bệnh viện Đa khoa Ngọc Thành, Bệnh viện Đa khoa Đông Khang, Bệnh viện Đức Nghĩa | `plants.vn_xsell_gap` | FM §5.5 VN | Peer-gap signal for B |
| C5 | **MY reagent-rental churn at contract expiry** | 3–4-year contracts with clustered expiries. 6 expire Jan–Mar 2026 and 2 are lost: A tapers over 5 months, then stops (Hospital Daerah Desa Perdana, Feb 2026; Hospital Daerah Ulu Mawar, Mar 2026). 2 more expire in Q1 2027 (`contract_end`) | `plants.my_contracts` | R: Reagent rental / placement contracts – Malaysia | Assertion passes. The Q1 2027 renewals are the MY card's action |
| C6 | **MY: growth sits in 3 hospitals** | A +50% ramp from Apr to Oct 2025 at 3 MY hospitals | `plants.my_expanders` | FM §5.5 MY | A YoY: +46%, +68%, +81% |
| C7 | **Gradual churners and new customers** | 5% of customers taper over 4 months, then stop. 10% start mid-history, with a 3-month ramp and the record created 10–45 days before the first PO | `customer_dynamics.*` | [T] | 18 churners and 36 new customers (`golden_customers.planted`) |
| C8 | **Romanisation pair (MM)** | Aung Myittar Hospital: an SPD record plus a QTG record "Aong Myitta Hospital" | `plants` (romanisation_mm) | DS5 | Held-out matcher case |

## Streams (A6) and the as-is MDM process

| # | Pattern | How it is planted | Parameter | Source | Measured (base) |
|---|---|---|---|---|---|
| S1 | **PRs (accepted quotes = pipeline)** | 3.5% of A lines, 3% of B lines and 85% of C lines come through a PR 5–35 days earlier. Lost PRs are added. Open PRs are dated 20 Aug – 25 Oct 2026 | `streams.pr_*` | A6 [T] | 4,240 PRs. 12M PR→PO conversion: SG 73%, VN 73%, MY 71%, TH 65%, **MM 41%** |
| S2 | **Enquiries lead POs by ~1 month** | Half of the PRs are preceded by an enquiry, and the rest follow next month's seasonality. MM enquiries rise while MM POs fall | `streams.enquir*` | FM §5.5 MM | 10,818 enquiries. YoY: MM +15%, VN +13% |
| S3 | **Follow-ups (excluded from demand)** | 10% of POs get a delivery, invoice, return or credit-note message | `streams.followup_*` | A6 | 4,009 follow-ups |
| S4 | **Stuck demand** | PR-5521 (Sungai Permai Medical Centre, S$48,600) and PR-5527 (Pulau Mutiara General Hospital, S$21,400): Dengue IgG/IgM Combo 30T, blocked by REQ-1042 (the item is not in the master). Plus 10 more blocked PRs across 5 countries (REQ-1031…1049) | `pinned.prs`, `streams.blocked_*` | Plan pinned facts, FM §5.6 #6 | **S$335k over 12 PRs**. Both pinned customers are new MY records (Sep 2026) with no POs. Their names are fictional, like every name except NUH |
| S5 | **As-is MDM history** | ~80 requests/month (customer 30, item 30, vendor 10, extend 5, cost centre 5), Oct 2025 – Sep 2026, ids REQ-0001…REQ-0990 (below the app's REQ-1001+). Each request has sequential hand-offs; 40% bounce at least once. Components are stored per request: notice, bounce, approval and MDM days | `mdm_history.*` | A12, A13, A26, FM §6.7 | **Median 14.1 calendar days** (items 16.0, customers 13.9). 40% bounced. 83 requests link to records created in the window; 84 list the PRs that waited on them |

## Stress scenarios (DS3): "our method doesn't invent signal"

| Scenario | What changes | Purpose |
|---|---|---|
| `nosignal` (seed 42) | No trend, seasonality, holidays, dengue, flush, shocks, lifecycle or pull-through: flat noise around the same level. The data-quality plants stay, so the pipeline is identical | The forecast advantage should be ≈ 0 |
| `halfdengue` (seed 7) | A different random universe, and dengue amplitude × 0.5 | The advantage should persist, smaller |

We sanity-checked the generator with our own replica of the pre-registered backtest. It is not the official number,
which comes from the backtest script. The replica used 6 origins (Mar–Aug 2026), horizons 1–3, refit at each origin,
units per country × product on golden IDs, and damped additive Holt-Winters ETS with period 12.

| | Rolling-12 WAPE | ETS WAPE | Advantage | ETS wins (A / B) |
|---|---|---|---|---|
| base | 11.1 | 9.4 | **+1.7 pts** | 4/5 · 3/5 |
| nosignal | 4.4 | 5.7 | −1.3 pts (≈ 0: ETS slightly overfits pure noise) | 2/5 · 0/5 |
| halfdengue | 10.9 | 9.0 | +1.9 pts | 4/5 · 3/5 |

Rolling-12 still wins some cells honestly in base: MY A (narrowly), TH B and MM B. MM B loses because ETS learns the
Apr-2025 earthquake spike as seasonality. Product C is lumpy, and neither method is good there (rolling-12 30%,
ETS 34%), which is why C is planned from the tender/PR pipeline.

The same base run also gives the 2×2 of clean data × method. Both rows are scored on true (de-duplicated) actuals,
so they answer "how well do we forecast real demand?":

| | Rolling-12 | ETS |
|---|---|---|
| Raw records (dirty history) | 11.5 | 12.3 |
| Golden IDs (clean history) | 11.1 | **9.4** |

On dirty data the better method is *worse*, because it chases the fake SG jump from January 2026. The gain needs
clean master data first.

## Known limits (said out loud)
- The patterns are planted. The stress tests and the published parameters are the answer to "you generated
  seasonality, then found it".
- Several effect sizes have no published source and are labelled [T]: flush sizes, holiday dips, churn rates and
  prices. The research log's Gaps section lists them.
- Country weights rest on vendor market-size estimates that disagree by up to 4×. Myanmar's weight is an assumption.
- The only real hospital name is the NUH master record (pinned, no sales). The two pinned PR customers (Sungai Permai
  Medical Centre, Pulau Mutiara General Hospital) are fictional and set up as new records with no PO history. Every
  other name is fictional and guarded against look-alikes.
