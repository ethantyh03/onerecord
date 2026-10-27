"""Falsification / stress test (DS judge's binding decision 3): "Our method doesn't invent signal".

The identical pre-registered backtest (forecast.py: same origins, horizons, methods, metric, A + B headline
scope on golden IDs) is rerun on:
  (a) no_signal   - same generator, seasonality AND trend switched off (noise and data-quality plants kept).
                    Expected: our advantage ≈ 0 (|Δ| ≤ 2 points).
  (b) half_dengue - a different seed (7) with dengue amplitude halved. Expected: the advantage persists.

Optional real-series check: the same four methods and the same rolling-origin design on a real public monthly
series, Singapore's weekly dengue cases (data.gov.sg, MOH Weekly Infectious Disease Bulletin, 2012-W01 to
2022-W52, Dengue Fever + Dengue Haemorrhagic Fever) summed to months. The series is embedded below, so reruns
work offline; fetch_dengue_monthly() rebuilds it from the API.

Output: build_stress() -> src/data/stress.json (shape in src/data/contract.ts; the real-series check is an extra
top-level key `realSeriesCheck` so the 3 contract scenarios stay unchanged).
Run:  python analytics/stress.py
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import forecast as F  # noqa: E402
from common import SRC_DATA, add_months, load_params, write_json  # noqa: E402

NO_SIGNAL_TOLERANCE_PTS = 2.0

DENGUE_SOURCE = {
    "name": "Singapore weekly dengue cases (Dengue Fever + Dengue Haemorrhagic Fever), summed to months",
    "publisher": "Ministry of Health via data.gov.sg (Weekly Infectious Disease Bulletin)",
    "url": "https://data.gov.sg/api/action/datastore_search?resource_id=d_ca168b2cb763640d72c4600a68f9909e&q=Dengue",
    "retrieved": "2026-10-28",
    "weekToMonth": "each epi-week is assigned to the month containing its 4th day",
}
# monthly cases, 2012-01 .. 2022-12 (132 months), built by fetch_dengue_monthly() on 2026-10-28
DENGUE_MONTHLY = {"2012-01": 253, "2012-02": 343, "2012-03": 231, "2012-04": 275, "2012-05": 426, "2012-06": 468, "2012-07": 507, "2012-08": 530, "2012-09": 322, "2012-10": 520, "2012-11": 368, "2012-12": 389, "2013-01": 825, "2013-02": 1158, "2013-03": 1453, "2013-04": 1945, "2013-05": 3102, "2013-06": 3271, "2013-07": 1915, "2013-08": 1650, "2013-09": 1573, "2013-10": 1748, "2013-11": 2041, "2013-12": 1513, "2014-01": 1653, "2014-02": 1071, "2014-03": 1057, "2014-04": 1002, "2014-05": 1687, "2014-06": 2187, "2014-07": 3090, "2014-08": 2252, "2014-09": 1443, "2014-10": 1127, "2014-11": 824, "2014-12": 775, "2015-01": 1139, "2015-02": 657, "2015-03": 612, "2015-04": 477, "2015-05": 734, "2015-06": 882, "2015-07": 1078, "2015-08": 1168, "2015-09": 991, "2015-10": 940, "2015-11": 1263, "2015-12": 1520, "2016-01": 2443, "2016-02": 2467, "2016-03": 1456, "2016-04": 992, "2016-05": 1028, "2016-06": 802, "2016-07": 958, "2016-08": 1216, "2016-09": 727, "2016-10": 497, "2016-11": 317, "2016-12": 276, "2017-01": 302, "2017-02": 246, "2017-03": 190, "2017-04": 157, "2017-05": 256, "2017-06": 290, "2017-07": 234, "2017-08": 254, "2017-09": 191, "2017-10": 247, "2017-11": 218, "2017-12": 191, "2018-01": 250, "2018-02": 165, "2018-03": 187, "2018-04": 188, "2018-05": 322, "2018-06": 267, "2018-07": 199, "2018-08": 296, "2018-09": 228, "2018-10": 242, "2018-11": 430, "2018-12": 511, "2019-01": 889, "2019-02": 737, "2019-03": 597, "2019-04": 525, "2019-05": 1569, "2019-06": 1797, "2019-07": 2507, "2019-08": 2534, "2019-09": 1206, "2019-10": 954, "2019-11": 1629, "2019-12": 1054, "2020-01": 1359, "2020-02": 1905, "2020-03": 1509, "2020-04": 1418, "2020-05": 2774, "2020-06": 4852, "2020-07": 6636, "2020-08": 6825, "2020-09": 2925, "2020-10": 2731, "2020-11": 1300, "2020-12": 887, "2021-01": 841, "2021-02": 578, "2021-03": 647, "2021-04": 427, "2021-05": 576, "2021-06": 511, "2021-07": 341, "2021-08": 306, "2021-09": 350, "2021-10": 340, "2021-11": 268, "2021-12": 273, "2022-01": 603, "2022-02": 730, "2022-03": 2004, "2022-04": 3322, "2022-05": 6458, "2022-06": 5073, "2022-07": 4210, "2022-08": 3697, "2022-09": 2012, "2022-10": 1460, "2022-11": 1434, "2022-12": 1172}  # noqa: E501


def fetch_dengue_monthly(timeout: int = 30) -> dict[str, int]:
    """Re-download the weekly series from data.gov.sg and sum it to months (not called by default)."""
    with urllib.request.urlopen(DENGUE_SOURCE["url"] + "&limit=5000", timeout=timeout) as r:  # noqa: S310
        recs = json.loads(r.read().decode("utf-8"))["result"]["records"]
    out: dict[str, int] = {}
    for x in recs:
        y, w = x["epi_week"].split("-W")
        d = dt.date(int(y), 1, 1) + dt.timedelta(days=7 * (int(w) - 1) + 3)
        k = f"{d.year:04d}-{d.month:02d}"
        out[k] = out.get(k, 0) + int(float(x["no._of_cases"]))
    return dict(sorted(out.items()))


# ---------------------------------------------------------------- the three contract scenarios
SCENARIO_TEXT = {
    "base": ("base", "Base dataset", "The dataset used everywhere in the app.", "Ours ahead"),
    "nosignal": ("no_signal", "Seasonality and trend switched off",
                 "Same generator, seed and pipeline; seasonal, dengue, holiday, fiscal-flush and trend effects removed, "
                 "noise and data-quality problems kept.",
                 f"Advantage ≈ 0 (|Δ| ≤ {NO_SIGNAL_TOLERANCE_PTS:g} points)"),
    "halfdengue": ("half_dengue", "Different seed, dengue amplitude halved",
                   "Seed 7 instead of 42 and a dengue season half as strong; everything else identical.",
                   "Advantage persists"),
}


def scenario_row(scenario: str) -> dict:
    P = load_params()
    sid, label, desc, expected = SCENARIO_TEXT[scenario]
    h = F.headline_numbers(scenario, "dedup")
    adv = round(h["advantagePts"], 1)
    if scenario == "nosignal":
        passed = abs(adv) <= NO_SIGNAL_TOLERANCE_PTS
    else:
        passed = adv > 0
    return {"id": sid, "label": label, "description": desc, "seed": int(P["scenarios"][scenario]["seed"]),
            "baselineWape": F.r4(h["baselineWape"]), "oursWape": F.r4(h["oursWape"]), "advantagePts": adv,
            "expected": expected, "passed": bool(passed)}


# ---------------------------------------------------------------- real-series check
def _score_series(y: pd.Series, origins: list[str], train_months: int | None) -> dict[str, dict]:
    """Same four methods, refit at every origin on data <= origin (optionally only the last train_months)."""
    a_all: dict[str, list[float]] = {m: [] for m in F.METHOD_IDS}
    f_all: dict[str, list[float]] = {m: [] for m in F.METHOD_IDS}
    last = y.index[-1]
    for o in origins:
        tr = y.loc[:o]
        if train_months:
            tr = tr.iloc[-train_months:]
        f = F.forecast_all(tr.to_numpy(float), max(F.HORIZONS))
        for i, h in enumerate(F.HORIZONS):
            t = add_months(o, h)
            if t > last:
                continue
            for m in F.METHOD_IDS:
                a_all[m].append(float(y.loc[t]))
                f_all[m].append(float(f[m][i]))
    out = {}
    for m in F.METHOD_IDS:
        w, b, *_ = F.wape_bias(np.array(a_all[m]), np.array(f_all[m]))
        out[m] = {"wape": F.r4(w), "bias": F.r4(b), "n": len(a_all[m])}
    return out


def real_series_check() -> dict:
    y = pd.Series(DENGUE_MONTHLY, dtype=float)
    end = y.index[-1]
    # (1) identical design: 36 months of history, origins = the 6 months before the last, horizons 1-3
    y36 = y.iloc[-36:]
    origins_same = [add_months(end, -k) for k in range(6, 0, -1)]
    same = _score_series(y36, origins_same, None)
    # (2) longer replay: every month-end origin with a trailing 36-month window (more scored points)
    first_origin = add_months(y.index[0], 35)
    origins_long = [m for m in y.index if first_origin <= m < end]
    longer = _score_series(y, origins_long, 36)

    def adv(s: dict) -> float:
        return round((s[F.BASELINE]["wape"] - s[F.OURS]["wape"]) * 100, 1)

    a1, a2 = adv(same), adv(longer)
    best_long = min(F.METHOD_IDS, key=lambda m: longer[m]["wape"])
    if a2 > 0:
        reading = (f"On a real, outbreak-driven series ours also beats the rolling 12-month average, by {a2:g} points "
                   f"over {longer[F.OURS]['n']} scored forecasts ({same[F.OURS]['n']} in the identical 6-origin design: "
                   f"{a1:+g} points), so the advantage is not only a property of our synthetic data. But every method "
                   f"is far off on epidemic data (ours {F.plain_wape(longer[F.OURS]['wape']).replace('units', 'cases').replace('ordered', 'reported')}).")
    else:
        reading = (f"On a real, outbreak-driven series ours does NOT beat the rolling average over "
                   f"{longer[F.OURS]['n']} scored forecasts ({a2:g} points); multi-year epidemics swamp the seasonal "
                   "pattern ETS relies on. This is why the pilot re-runs the same backtest on real SAP order history "
                   "before anyone plans stock with it.")
    reading += (" Dengue case counts are not orders: this checks the method on real seasonal data, it does not "
                "validate the synthetic order data.")
    return {
        "title": "Real-series check",
        "series": DENGUE_SOURCE,
        "months": {"start": y.index[0], "end": end, "n": int(len(y))},
        "sameDesign": {
            "description": (f"Identical design: last 36 months ({y36.index[0]}–{end}), 6 origins "
                            f"({origins_same[0]}–{origins_same[-1]}), horizons 1–3, refit at every origin."),
            "scores": same, "baselineWape": same[F.BASELINE]["wape"], "oursWape": same[F.OURS]["wape"],
            "advantagePts": a1,
            "plainBaseline": f"Rolling 12-month average is {F.plain_wape(same[F.BASELINE]['wape']).replace('units', 'cases').replace('ordered', 'reported')}",
            "plainOurs": f"Ours is {F.plain_wape(same[F.OURS]['wape']).replace('units', 'cases').replace('ordered', 'reported')}",
        },
        "longerReplay": {
            "description": (f"Same methods, {len(origins_long)} monthly origins ({origins_long[0]}–{origins_long[-1]}), "
                            "each trained on the 36 months up to the origin, horizons 1–3."),
            "scores": longer, "baselineWape": longer[F.BASELINE]["wape"], "oursWape": longer[F.OURS]["wape"],
            "advantagePts": a2, "bestMethod": best_long,
        },
        "reading": reading,
    }


# ---------------------------------------------------------------- stress.json
def build_stress(include_real_series: bool = True) -> dict:
    rows = [scenario_row(s) for s in ("base", "nosignal", "halfdengue")]
    base, nos, half = rows
    smaller = half["advantagePts"] < base["advantagePts"]
    verdict = (
        f"With seasonality and trend switched off our advantage is {nos['advantagePts']:+g} points "
        f"({'within' if nos['passed'] else 'OUTSIDE'} ±{NO_SIGNAL_TOLERANCE_PTS:g}, i.e. ≈ 0), so the method is "
        f"{'not finding patterns that are not there' if nos['passed'] else 'finding something in pure noise; treat the headline with caution'}. "
        f"With a different seed and half the dengue effect it "
        + (f"still wins by {half['advantagePts']:g} points" if half["passed"] else
           f"no longer wins ({half['advantagePts']:+g} points)")
        + (f" (smaller than the base {base['advantagePts']:g}, as expected with less seasonality)." if half["passed"] and smaller
           else f" (base: {base['advantagePts']:g})."))
    out = {
        "isMock": False,
        "title": "Our method doesn't invent signal",
        "scope": ("Products A + B, all 5 countries, golden IDs, S$-weighted WAPE; the identical pre-registered backtest "
                  "(6 origins, horizons 1–3, refit at every origin) rerun on each dataset."),
        "scenarios": rows,
        "verdict": verdict,
    }
    if include_real_series:
        try:
            out["realSeriesCheck"] = real_series_check()
        except Exception as e:  # noqa: BLE001 - optional extra, never blocks the contract output
            print(f"real-series check skipped: {e}")
    return out


def main() -> None:
    s = build_stress()
    write_json(s, SRC_DATA / "stress.json")
    for r in s["scenarios"]:
        print(f"{r['id']:<12} seed {r['seed']:<3} today {r['baselineWape']:.4f} ours {r['oursWape']:.4f} "
              f"adv {r['advantagePts']:+.1f} pts  expected: {r['expected']}  {'PASS' if r['passed'] else 'FAIL'}")
    print(s["verdict"])
    rc = s.get("realSeriesCheck")
    if rc:
        print(f"real series (same design): today {rc['sameDesign']['baselineWape']} ours {rc['sameDesign']['oursWape']} "
              f"adv {rc['sameDesign']['advantagePts']} | longer replay: today {rc['longerReplay']['baselineWape']} "
              f"ours {rc['longerReplay']['oursWape']} adv {rc['longerReplay']['advantagePts']} best {rc['longerReplay']['bestMethod']}")
        print(rc["reading"])


if __name__ == "__main__":
    main()
