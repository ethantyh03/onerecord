# OneRecord analytics

Python pipeline that generates the **synthetic** data and every analytics number the app shows. The app never reads
the CSVs: it reads the JSON in `src/data/`, typed by `src/data/contract.ts`. All data is synthetic and illustrative,
and all names are fictional. The one exception is the pinned demo master record, National University Hospital
(`C-SG-00017`), which has no transactions.

## Run it

```bash
cd C:/Users/ethan/dev/onerecord
PYTHONIOENCODING=utf-8 python analytics/run_all.py           # everything, ~70–80 s
PYTHONIOENCODING=utf-8 python analytics/run_all.py --from forecast --no-triage   # resume from a step
PYTHONIOENCODING=utf-8 python analytics/build_summary.py --check-only            # just the consistency checks
```

The run is idempotent. Two runs give byte-identical `src/data/*.json`, apart from the `generatedAt` timestamps. It
stops at the first failure: a failed leak test, a business case that no longer reproduces final model §6, a failed
consistency check, or a `src/data` type error.

| # | Step | Script | Writes |
|---|---|---|---|
| 1 | Generate base (seed 42), no-signal (seed 42, seasonality and trend off) and half-dengue (seed 7, dengue × 0.5) | `generate.py` | `out/<scenario>/*.csv`, `plants.json`, `manifest.json` (36 plant assertions) |
| 2 | Entity resolution: Python port of `src/lib/engine/dedupe.ts`; threshold tuned on SG+MY, reported on TH/VN/MM | `resolve.py` | `matcher_eval.json`, `master.json`, `matcher_fixture.json`, `out/base/crosswalk.csv` |
| 3 | Growth matrix, bridge, de-dup stories | `growth.py` | `matrix.json`, `bridge.json`, `dedup.json` |
| 4 | Pre-registered backtest + clean × method 2×2 + leak test | `forecast.py` | `backtest.json`, `cleanxmethod.json` |
| 5 | Falsification ("our method doesn't invent signal") + real dengue series check | `stress.py` | `stress.json` |
| 6 | Drop-off and cross-sell signals | `signals.py` | `signals.json` |
| 7 | Three streams + sample inbox | `streams.py` | `streams.json`, `inbox.json` |
| 8 | Five country cards | `actions.py` | `actions.json` |
| 9 | Business case, final model §6 | `business_case.py` | `impact.json` |
| 10 | Headline numbers, meta, ~100 consistency checks | `build_summary.py` | `summary.json`, `meta.json`, `out/base/robustness.json` |
| 11 | Blind triage eval (Node) | `triage/eval_triage.ts` | `triage_eval.json` |
| 12 | `npx tsc --noEmit`, failing only on `src/data` errors | (in `run_all.py`) | — |

Parameters: `params.yaml`, where every number carries its source tag. Raw schemas are in `SCHEMA.md` and planted
patterns in `PATTERNS.md`.

## One source of truth for headline numbers

`src/data/summary.json` holds the 5 headline numbers, in the contract's order: growth, forecast, duplicates,
cycle_time, payback. It also holds a `supporting` list. Each entry has a ready-to-print `display` and a plain-language
`sentence`, which the app, the video voice-over and the slides quote verbatim. Each also names the `sourceFile` /
`sourcePath` it was copied from, and `build_summary.py` fails if any of them drift.

Current values (seed 42):

| Headline | Display |
|---|---|
| growth | S$53.4M (+4.0% YoY), momentum (Jul–Sep YoY) +7.6% |
| forecast (Pulse only, never in the close) | 11 → 9 per 100, A+B; ours wins 7 of 10 cells and the 3 losses are shown |
| duplicates | 25 of 388 records (6.4%). MY #2 account Bukit Damai is −32% once merged; re-coding 3 SG records moves S$1.06M to MY/VN |
| cycle_time | 18 days → ≤4 business days; ≈43% of the saving is process change only |
| payback | 5.9 months on S$39.9k; 1,751 h/yr (≈0.94 FTE); no new licences |

Supporting numbers:

| Number | Value |
|---|---|
| Clean data first | 1.7 of the 4.5-point gain |
| Matcher (held-out) | catches 87 of 100 real duplicates; 93 of 100 warnings are real |
| Stress test | +2.8 / −0.6 / +2.3 points |
| Triage | 92 of 100 sorted correctly |
| Drop-off at risk, before save rate | S$2.64M |
| Cross-sell addressable, before conversion | S$1.02M |

## Business case (`impact.json`, final model §6 exactly)

Every number is `{value, unit, formula, source, display}`. `value: null` means not finite, for example "never pays
back". The three columns are never summed together:
- **hard:** hours × S$50. This is the only column payback counts.
- **soft:** calendar days returned.
- **opportunity:** synthetic S$, before conversion.

`checks` holds 27 comparisons with the final model's published figures, and all 27 match. These include:
- 1,115 / 1,751 / 2,386 h/yr
- net S$49,779 / 81,543 / 113,307
- payback 9.6 / 5.9 / 4.2 months
- workflow-only payback 18.6 / 8.3 / 5.4 months
- 3-year net S$109k / 205k / 300k
- phase 2 at ~19 years (Process) / ~7 (PAYG) / ~4.7 (Process, at 120 requests/month)
- 640 request-days returned
- 43% process-only share
- EDGE ≈ S$16k

`src/data/contract.ts` exports it as `impact` (`Impact` interface). The /impact page currently computes the same
figures in `src/components/story/business-case.ts`, using the same inputs, and the two agree.

## Honesty notes the presenters must keep

1. **Synthetic data with known planted patterns.** Good scores show the pipeline works and is honest. They don't show
   the patterns exist in real data. Everything is re-measured in the pilot, week 1 on SAP B1 extracts.
2. **The de-duplicated view uses the generator's ground-truth golden IDs.** The matcher's own crosswalk mis-clusters 8
   of 388 records and recovers 61% of the S$1.06M misattribution. MY is fully recovered. VN is missed: Song Sen is a
   translation, not a spelling variant. The TH key account (Chao Phraya Rim / Jao Praya Rim) is also a matcher miss.
3. **The forecast gain is season-dependent.** This check is not pre-registered and is reported as a robustness check
   only.
   - The pre-registered months (Apr–Sep 2026) are the rise of the dengue season, when today's method under-forecasts
     by 10%.
   - At 6 off-season origins the gain is +0.2 points (9.7 vs 9.5 per 100).
   - Over all 12 origins it is +1.5 points (10.5 vs 9.0).
   - Both are in `meta.json` → `modelCard.limitations` and `summary.json` → `headlines[forecast].caveat`.
4. **Clean first, then model.** On raw records the seasonal model is worse than today's method (15 vs 13 per 100):
   it learns the fake Jan-2026 jump.
5. **Product C is excluded from the forecast headline.** Ours is worse there (35 vs 31 per 100), and C is planned from
   the tender/PR pipeline.
6. **Merging customer duplicates alone changes no country × product total.** Only misattribution (country) and
   miscategorisation (reagent kits coded as Product B: S$350k in all, S$276k of it in TH) do. `build_summary.py` checks this exactly.
7. **Signal S$ are addressable before conversion, and never summed.** The rates are team assumptions: 25% save rate
   for drop-off, 15% conversion for cross-sell.
8. **Triage scored 0.917 on the 60-message blind set** after the rules were rebuilt on a separate dev set (0.467
   before). The rules author never opened the blind set (`triage/README.md`), but the earlier blind-run report listed
   failure patterns. If those reached the rules author, call it "after one fix round".
