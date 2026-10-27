"""Leak-free, pre-registered forecast backtest + the clean-data x method 2x2.

DS judge's binding decisions implemented here:
  2. 6 rolling origins (end of Mar..Aug 2026), horizons 1-3, refit at EVERY origin on data <= origin only.
     Methods: rolling-6, rolling-12 (today's method, per the brief), seasonal-naive, damped ETS
     (statsmodels ExponentialSmoothing, additive damped trend + additive seasonality, period 12).
     Metrics: volume-weighted WAPE + bias per country x product; win/loss INCLUDING baseline wins.
     Product C excluded from the headline and shown separately.
  4. Clean-data x method 2x2: {raw SAP records, golden IDs} x {rolling-12, ours}. Both rows are scored
     against the same de-duplicated (true) demand: the question is "how well do we forecast what each
     country really ordered?", and raw records give the model a series with a fake level shift (the
     SG-coded duplicates for MY/VN hospitals from Jan 2026, and TH reagent kits coded as consumables).
  7. Plain-language subtitles for every metric.

Golden IDs: the "dedup" view uses the generator's ground-truth golden_id / true_country / true_product
columns (the matcher's own crosswalk is evaluated separately in matcher_eval.json).

Outputs (shapes in src/data/contract.ts): build_backtest() -> backtest.json, build_cleanxmethod() -> cleanxmethod.json.
Run:  python analytics/forecast.py            (writes src/data/backtest.json + cleanxmethod.json)
"""
from __future__ import annotations

import math
import sys
import warnings
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (COUNTRIES, PRODUCTS, SRC_DATA, add_months, load_params, month_range,  # noqa: E402
                    monthly_series, read_table, write_json)

# ---------------------------------------------------------------- pre-registered design (fixed before any result)
ORIGINS = ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]
HORIZONS = [1, 2, 3]
HEADLINE_PRODUCTS = ["A", "B"]
METHOD_IDS = ["rolling6", "rolling12", "seasonalNaive", "etsDamped"]
BASELINE = "rolling12"
OURS = "etsDamped"
SEASON = 12
P_LO, P_HI = 0.10, 0.90

METHODS = [
    {"id": "rolling6", "label": "Rolling 6-month average", "role": "baseline",
     "description": "Mean of the last 6 months of PO units, held flat for the next 1–3 months."},
    {"id": "rolling12", "label": "Rolling 12-month average (today's method)", "role": "baseline",
     "description": "Mean of the last 12 months of PO units, held flat. This is the current method described in the brief."},
    {"id": "seasonalNaive", "label": "Seasonal naive", "role": "challenger",
     "description": "Same month last year (PO units 12 months before the forecast month)."},
    {"id": "etsDamped", "label": "Damped Holt-Winters ETS (ours)", "role": "ours",
     "description": "statsmodels ExponentialSmoothing: additive damped trend + additive seasonality, period 12, "
                    "parameters and initial states estimated by maximum likelihood; refit at every origin; "
                    "forecasts floored at 0."},
]

WAPE_FORMULA = "WAPE = Σ|actual − forecast| ÷ Σ actual"
BIAS_FORMULA = "Bias = Σ(forecast − actual) ÷ Σ actual"

PRE_REGISTRATION = (
    "Fixed before any result was seen: 6 rolling origins (end of Mar, Apr, May, Jun, Jul, Aug 2026); horizons "
    "1–3 months; 4 methods (rolling-6, rolling-12 = today's method, seasonal naive, damped Holt-Winters ETS); "
    "metrics WAPE and bias on PO units per country × product; headline = Products A + B on de-duplicated "
    "customers (golden IDs), each cell's units valued at its average S$ price so a reagent kit and a box of "
    "pipette tips count by value; Product C reported separately. At each origin every method is refit on data up "
    "to and including the origin month only, then scored on the next 1–3 months that exist (to Sep 2026): "
    "15 scored points per cell (the Jul-2026 origin contributes h=1–2, Aug-2026 h=1). Leak test: overwriting "
    "every month after the origin with garbage leaves every forecast unchanged."
)
INTERVAL_METHOD = (
    "Oct–Dec 2026: damped ETS refit on all 36 months. P10/P90 = ETS point forecast × the 10th/90th percentile "
    "of actual ÷ forecast ratios from this backtest, pooled across the 5 countries within each product and "
    "horizon (empirical, from backtest residuals; no normality assumption). P50 = the ETS point forecast."
)


# ---------------------------------------------------------------- formatting (mirror contract.ts helpers)
def _half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def plain_wape(w: float) -> str:
    return f"off by {_half_up(w * 100)} units per 100 ordered"


def plain_bias(b: float) -> str:
    v = abs(_half_up(b * 1000) / 10)
    return f"tends to {'over' if b > 0 else 'under'}-forecast by {v:g}%"


def r4(x: float | None) -> float | None:
    return None if x is None or not np.isfinite(x) else round(float(x), 4)


def pts(x: float) -> float:
    return round(float(x) * 100, 1)


# ---------------------------------------------------------------- the four methods (each sees ONLY the training array)
def fc_rolling(train: np.ndarray, k: int, H: int) -> np.ndarray:
    return np.full(H, float(np.mean(train[-k:])))


def fc_seasonal_naive(train: np.ndarray, H: int) -> np.ndarray:
    return np.array([float(train[len(train) - SEASON + h - 1]) for h in range(1, H + 1)])


ETS_LOG = {"estimated": 0, "heuristic": 0, "seasonal_naive_fallback": 0}


def fc_ets(train: np.ndarray, H: int) -> np.ndarray:
    """ETS(A,Ad,A). Pre-registered fallback chain if the optimiser fails: heuristic initial states, then
    seasonal naive. Usage is counted in ETS_LOG and reported."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    for init in ("estimated", "heuristic"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fit = ExponentialSmoothing(np.asarray(train, float), trend="add", damped_trend=True,
                                           seasonal="add", seasonal_periods=SEASON,
                                           initialization_method=init).fit(optimized=True)
                f = np.asarray(fit.forecast(H), float)
            if np.all(np.isfinite(f)):
                ETS_LOG[init] += 1
                return np.maximum(f, 0.0)
        except Exception:  # noqa: BLE001 - any optimiser failure falls through to the next pre-registered step
            pass
    ETS_LOG["seasonal_naive_fallback"] += 1
    return fc_seasonal_naive(train, H)


def forecast_all(train: np.ndarray, H: int) -> dict[str, np.ndarray]:
    return {
        "rolling6": fc_rolling(train, 6, H),
        "rolling12": fc_rolling(train, 12, H),
        "seasonalNaive": fc_seasonal_naive(train, H),
        "etsDamped": fc_ets(train, H),
    }


# ---------------------------------------------------------------- backtest of one series
def backtest_series(train_series: pd.Series, origins: list[str] = ORIGINS, horizons: list[int] = HORIZONS) -> list[dict]:
    """Forecast from each origin using ONLY train_series.loc[:origin]. Returns one dict per origin with the
    forecast for every method at every horizon whose target month exists in the history."""
    last = train_series.index[-1]
    H = max(horizons)
    out = []
    for o in origins:
        train = train_series.loc[:o].to_numpy(float)  # data <= origin only (leak-free by construction)
        assert train_series.index[len(train) - 1] == o
        f = forecast_all(train, H)
        targets = [(h, add_months(o, h)) for h in horizons if add_months(o, h) <= last]
        out.append({"origin": o, "targets": targets, "f": {m: f[m][: len(targets)] for m in METHOD_IDS}})
    return out


def score(runs: list[dict], actual: pd.Series, method: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(actuals, forecasts, horizons) for one method across all origins."""
    a, f, h = [], [], []
    for r in runs:
        for i, (hh, m) in enumerate(r["targets"]):
            a.append(float(actual.loc[m]))
            f.append(float(r["f"][method][i]))
            h.append(hh)
    return np.array(a), np.array(f), np.array(h)


def wape_bias(a: np.ndarray, f: np.ndarray, w: float = 1.0) -> tuple[float, float, float, float]:
    """Returns (wape, bias, Σ|e|·w, Σa·w) — the weighted sums let cells be pooled."""
    sa = float(a.sum())
    ae, e = float(np.abs(a - f).sum()), float((f - a).sum())
    return (ae / sa if sa else float("nan"), e / sa if sa else float("nan"), ae * w, sa * w, e * w)  # type: ignore[return-value]


# ---------------------------------------------------------------- whole-scenario runs (cached)
@lru_cache(maxsize=None)
def series(scenario: str = "base") -> dict[str, pd.DataFrame]:
    pos = read_table("pos", scenario)
    return {
        "dedup_units": monthly_series(pos, "dedup", "units"),
        "dedup_sgd": monthly_series(pos, "dedup", "sgd"),
        "raw_units": monthly_series(pos, "raw", "units"),
    }


def cell_prices(scenario: str = "base") -> dict[tuple[str, str], float]:
    """Average S$ per unit per (country, product) over the 36-month history (de-duplicated). Used only to
    weight cells when pooling the headline, never as a forecast input."""
    s = series(scenario)
    u, v = s["dedup_units"].sum(), s["dedup_sgd"].sum()
    return {k: (float(v[k]) / float(u[k]) if u[k] else 0.0) for k in u.index}


@lru_cache(maxsize=None)
def run_scenario(scenario: str = "base", train_view: str = "dedup", products: tuple[str, ...] = tuple(PRODUCTS)) -> dict:
    """Backtest every (country, product) cell. Training series = train_view; scoring = de-duplicated actuals."""
    s = series(scenario)
    train_df = s[f"{train_view}_units"]
    actual_df = s["dedup_units"]
    out = {}
    for c in COUNTRIES:
        for p in products:
            runs = backtest_series(train_df[(c, p)])
            out[(c, p)] = {"runs": runs, "actual": actual_df[(c, p)]}
    return out


def pooled(scenario: str, train_view: str, products: list[str], method: str) -> dict:
    """SGD-value-weighted WAPE/bias pooled over countries x products."""
    res = run_scenario(scenario, train_view, tuple(PRODUCTS))
    price = cell_prices(scenario)
    ae = sa = e = 0.0
    n = 0
    for c in COUNTRIES:
        for p in products:
            r = res[(c, p)]
            a, f, _ = score(r["runs"], r["actual"], method)
            _, _, ae_w, sa_w, e_w = wape_bias(a, f, price[(c, p)])
            ae, sa, e, n = ae + ae_w, sa + sa_w, e + e_w, n + len(a)
    return {"wape": ae / sa, "bias": e / sa, "n": n}


def headline_numbers(scenario: str = "base", train_view: str = "dedup") -> dict:
    b = pooled(scenario, train_view, HEADLINE_PRODUCTS, BASELINE)
    o = pooled(scenario, train_view, HEADLINE_PRODUCTS, OURS)
    return {"baselineWape": b["wape"], "oursWape": o["wape"], "baselineBias": b["bias"], "oursBias": o["bias"],
            "advantagePts": (b["wape"] - o["wape"]) * 100}


# ---------------------------------------------------------------- intervals from backtest residuals
def interval_ratios(scenario: str = "base") -> dict[tuple[str, int], tuple[float, float]]:
    res = run_scenario(scenario, "dedup", tuple(PRODUCTS))
    ratios: dict[tuple[str, int], list[float]] = {}
    for (c, p), r in res.items():
        a, f, h = score(r["runs"], r["actual"], OURS)
        for ai, fi, hi in zip(a, f, h):
            if fi > 0:
                ratios.setdefault((p, int(hi)), []).append(ai / fi)
    return {k: (float(np.quantile(v, P_LO)), float(np.quantile(v, P_HI))) for k, v in ratios.items()}


# ---------------------------------------------------------------- leak test
def leak_test(scenario: str = "base", cells: tuple[tuple[str, str], ...] = (("SG", "A"), ("VN", "B"), ("TH", "C"))) -> bool:
    """Overwrite every month after each origin with garbage; every method's forecast must be unchanged."""
    s = series(scenario)["dedup_units"]
    for cp in cells:
        y = s[cp]
        clean = backtest_series(y)
        for i, o in enumerate(ORIGINS):
            g = y.copy()
            g.loc[g.index > o] = 1e9
            dirty = backtest_series(g, origins=[o])[0]
            for m in METHOD_IDS:
                if not np.allclose(clean[i]["f"][m], dirty["f"][m]):
                    return False
    return True


# ---------------------------------------------------------------- backtest.json
def _window(params: dict) -> dict:
    t = params["time"]
    return {"label": "Oct 2025 – Sep 2026", "start": t["window_start"], "end": t["window_end"],
            "priorStart": t["prior_start"], "priorEnd": t["prior_end"], "momentumStart": t["momentum_start"],
            "momentumEnd": t["momentum_end"], "historyStart": t["history_start"], "historyEnd": t["history_end"],
            "forecastStart": add_months(t["history_end"], 1), "forecastEnd": add_months(t["history_end"], 3)}


def build_backtest(scenario: str = "base") -> dict:
    params = load_params()
    hist_end = params["time"]["history_end"]
    fmonths = [add_months(hist_end, h) for h in HORIZONS]
    s = series(scenario)
    res = run_scenario(scenario, "dedup", tuple(PRODUCTS))
    ratios = interval_ratios(scenario)
    sgd12 = s["dedup_sgd"].iloc[-12:].sum()
    u12 = s["dedup_units"].iloc[-12:].sum()

    cells = []
    for c in COUNTRIES:
        for p in PRODUCTS:
            r = res[(c, p)]
            actual = r["actual"]
            scores = {}
            for m in METHOD_IDS:
                a, f, _ = score(r["runs"], actual, m)
                w, b, *_ = wape_bias(a, f)
                scores[m] = {"wape": r4(w), "bias": r4(b), "n": int(len(a))}
            winner = min(METHOD_IDS, key=lambda m: (scores[m]["wape"], METHOD_IDS.index(m)))
            bw, ow = scores[BASELINE]["wape"], scores[OURS]["wape"]
            # next 3 months: ETS on all 36 months + empirical P10/P90
            point = fc_ets(actual.to_numpy(float), len(HORIZONS))
            price12 = float(sgd12[(c, p)]) / float(u12[(c, p)]) if u12[(c, p)] else cell_prices(scenario)[(c, p)]
            next3 = []
            for i, h in enumerate(HORIZONS):
                lo, hi = ratios.get((p, h), (1.0, 1.0))
                p50 = float(point[i])
                p10, p90 = min(p50, p50 * lo), max(p50, p50 * hi)
                next3.append({"month": fmonths[i], "p10": int(round(max(p10, 0))), "p50": int(round(p50)),
                              "p90": int(round(p90)), "p50Sgd": int(round(p50 * price12))})
            cells.append({
                "country": c, "product": p, "measure": "units", "inHeadline": p in HEADLINE_PRODUCTS,
                "actuals": [{"month": m, "value": int(round(v))} for m, v in actual.items()],
                "origins": [{"origin": run["origin"],
                             "forecasts": {m: [{"month": tm, "h": h, "value": int(round(float(run["f"][m][i])))}
                                               for i, (h, tm) in enumerate(run["targets"])] for m in METHOD_IDS}}
                            for run in r["runs"]],
                "scores": scores, "winner": winner, "baselineWape": bw, "oursWape": ow,
                "deltaWapePts": round((ow - bw) * 100, 1), "oursBeatsBaseline": bool(ow < bw),
                "next3": next3,
            })

    hb = pooled(scenario, "dedup", HEADLINE_PRODUCTS, BASELINE)
    ho = pooled(scenario, "dedup", HEADLINE_PRODUCTS, OURS)
    h6 = pooled(scenario, "dedup", HEADLINE_PRODUCTS, "rolling6")
    hs = pooled(scenario, "dedup", HEADLINE_PRODUCTS, "seasonalNaive")
    cb = pooled(scenario, "dedup", ["C"], BASELINE)
    co = pooled(scenario, "dedup", ["C"], OURS)

    hl = [x for x in cells if x["inHeadline"]]
    ours_w = [x for x in hl if x["oursWape"] < x["baselineWape"]]
    base_w = [x for x in hl if x["oursWape"] > x["baselineWape"]]
    ties = len(hl) - len(ours_w) - len(base_w)
    by_prod = {p: {"oursWins": sum(1 for x in ours_w if x["product"] == p),
                   "baselineWins": sum(1 for x in base_w if x["product"] == p)} for p in HEADLINE_PRODUCTS}
    base_cells = [f"{x['country']}·{x['product']}" for x in base_w]
    sentence = (f"Ours beats today's method in {len(ours_w)} of {len(hl)} country × product cells "
                f"(A: {by_prod['A']['oursWins']} of 5, B: {by_prod['B']['oursWins']} of 5); today's method wins "
                f"{len(base_w)}" + (f" ({', '.join(base_cells)})" if base_cells else "")
                + (f", {ties} tied" if ties else "") + ". Losses are shown, not hidden.")

    return {
        "isMock": False,
        "origins": ORIGINS,
        "horizons": HORIZONS,
        "forecastMonths": fmonths,
        "preRegistration": PRE_REGISTRATION,
        "methods": METHODS,
        "baselineMethod": BASELINE,
        "oursMethod": OURS,
        "wapeFormula": WAPE_FORMULA,
        "biasFormula": BIAS_FORMULA,
        "headline": {
            "scope": "Products A + B, all 5 countries, de-duplicated customers (golden IDs); cells weighted by S$ value",
            "weighting": "sgd",
            "baselineWape": r4(hb["wape"]),
            "oursWape": r4(ho["wape"]),
            "baselineBias": r4(hb["bias"]),
            "oursBias": r4(ho["bias"]),
            "rolling6Wape": r4(h6["wape"]),
            "seasonalNaiveWape": r4(hs["wape"]),
            "improvementPts": pts(hb["wape"] - ho["wape"]),
            "plainBaseline": f"Today's method is {plain_wape(hb['wape'])}",
            "plainOurs": f"Ours is {plain_wape(ho['wape'])}",
            "plainBiasBaseline": f"Today's method {plain_bias(hb['bias'])}",
            "plainBiasOurs": f"Ours {plain_bias(ho['bias'])}",
        },
        "winLoss": {"cells": len(hl), "oursWins": len(ours_w), "baselineWins": len(base_w), "ties": ties,
                    "byProduct": by_prod, "baselineWinCells": base_cells, "sentence": sentence},
        "productC": {
            "baselineWape": r4(cb["wape"]), "oursWape": r4(co["wape"]),
            "baselineBias": r4(cb["bias"]), "oursBias": r4(co["bias"]),
            "note": (f"Product C (instruments) is lumpy and tender-driven: today's method is {plain_wape(cb['wape'])}, "
                     f"ours {plain_wape(co['wape'])}; neither is good enough to plan with. C is planned from the "
                     "tender/PR pipeline, not from a time-series forecast, and is excluded from the headline."),
        },
        "intervalMethod": INTERVAL_METHOD,
        "cells": cells,
    }


# ---------------------------------------------------------------- cleanxmethod.json
def build_cleanxmethod(scenario: str = "base") -> dict:
    raw_b = pooled(scenario, "raw", HEADLINE_PRODUCTS, BASELINE)["wape"]
    raw_o = pooled(scenario, "raw", HEADLINE_PRODUCTS, OURS)["wape"]
    gol_b = pooled(scenario, "dedup", HEADLINE_PRODUCTS, BASELINE)["wape"]
    gol_o = pooled(scenario, "dedup", HEADLINE_PRODUCTS, OURS)["wape"]
    from_clean = pts(raw_b - gol_b)
    from_model = pts(gol_b - gol_o)
    total = pts(raw_b - gol_o)
    raw_gap = pts(raw_b - raw_o)  # >0: ours better even on raw records
    # the cell where training on raw records hurts our method most (for a concrete, checkable sentence)
    rr, rd = run_scenario(scenario, "raw", tuple(PRODUCTS)), run_scenario(scenario, "dedup", tuple(PRODUCTS))
    worst, worst_d, worst_bias = None, -1.0, 0.0
    for c in COUNTRIES:
        for p in HEADLINE_PRODUCTS:
            a, f, _ = score(rr[(c, p)]["runs"], rr[(c, p)]["actual"], OURS)
            w_raw, b_raw, *_ = wape_bias(a, f)
            a2, f2, _ = score(rd[(c, p)]["runs"], rd[(c, p)]["actual"], OURS)
            w_ded, *_ = wape_bias(a2, f2)
            if w_raw - w_ded > worst_d:
                worst, worst_d, worst_bias = f"{c} Product {p}", w_raw - w_ded, b_raw
    shift = (f"in {worst} it {plain_bias(worst_bias)} because the SG-coded duplicates of MY/VN hospitals add a fake "
             "jump from Jan 2026")
    if raw_gap < 0:
        dirty = (f"On raw records our method is worse than today's ({_half_up(raw_o * 100)} vs "
                 f"{_half_up(raw_b * 100)} per 100 ordered): it faithfully learns the fake level shifts; {shift}. "
                 "A better model on dirty data makes things worse.")
    else:
        dirty = f"On raw records our method is already {raw_gap:g} points better, but it still learns the fake level shifts; {shift}."
    verb = "cuts" if from_clean >= 0 else "raises"
    sentence = (f"{dirty} Cleaning master data alone {verb} today's error by {abs(from_clean):g} points per 100 "
                f"ordered; on clean data ours cuts a further {from_model:g}, {total:g} points in all. "
                "Clean the data first, then model.")
    return {
        "isMock": False,
        "scope": ("Headline scope (Products A + B, all 5 countries, S$-weighted), the same pre-registered backtest as "
                  "backtest.json. Rows change only the series the model is trained on: raw SAP records (recorded "
                  "country × recorded product) or golden IDs (true country × true product). Both rows are scored "
                  "against the same de-duplicated actuals, i.e. what each country really ordered. Raw differs from "
                  "golden where misattribution (SG-coded duplicates of MY/VN hospitals from Jan 2026) and "
                  "miscategorisation (reagent kits coded as Product B) shift the series."),
        "rows": ["raw", "golden"],
        "cols": ["rolling", "ours"],
        "rowLabels": {"raw": "Raw customer records", "golden": "Golden IDs (de-duplicated, re-attributed)"},
        "colLabels": {"rolling": "Rolling 12-month average (today)", "ours": "Damped ETS (ours)"},
        "table": {"raw": {"rolling": r4(raw_b), "ours": r4(raw_o)},
                  "golden": {"rolling": r4(gol_b), "ours": r4(gol_o)}},
        "fromCleaningPts": from_clean,
        "fromModellingPts": from_model,
        "totalImprovementPts": total,
        "sentence": sentence,
        "plain": {"raw": {"rolling": plain_wape(raw_b), "ours": plain_wape(raw_o)},
                  "golden": {"rolling": plain_wape(gol_b), "ours": plain_wape(gol_o)}},
    }


# ---------------------------------------------------------------- main
def main() -> None:
    import time

    t0 = time.time()
    bt = build_backtest("base")
    cx = build_cleanxmethod("base")
    ok = leak_test("base")
    if not ok:
        raise SystemExit("LEAK TEST FAILED: a forecast changed when future data was altered")
    write_json(bt, SRC_DATA / "backtest.json")
    write_json(cx, SRC_DATA / "cleanxmethod.json")
    h = bt["headline"]
    print(f"backtest (A+B, S$-weighted): today {h['baselineWape']:.4f}  ours {h['oursWape']:.4f}  "
          f"improvement {h['improvementPts']} pts | rolling6 {h['rolling6Wape']} snaive {h['seasonalNaiveWape']}")
    print(f"  bias: today {h['baselineBias']}  ours {h['oursBias']}")
    print(f"  {bt['winLoss']['sentence']}")
    print(f"  product C: today {bt['productC']['baselineWape']} ours {bt['productC']['oursWape']}")
    for x in bt["cells"]:
        print(f"  {x['country']}·{x['product']}  r12 {x['baselineWape']:.3f}  ets {x['oursWape']:.3f}  "
              f"snaive {x['scores']['seasonalNaive']['wape']:.3f}  r6 {x['scores']['rolling6']['wape']:.3f}  "
              f"winner {x['winner']}")
    print(f"2x2: {cx['table']}  cleaning {cx['fromCleaningPts']} model {cx['fromModellingPts']} total {cx['totalImprovementPts']}")
    print(f"leak test: {'PASS' if ok else 'FAIL'} | ETS fits: {ETS_LOG} | {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
