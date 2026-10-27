"""summary.json (the 5 headline numbers the app, video script and slides all use) + meta.json, then the
cross-file consistency checks.

    PYTHONIOENCODING=utf-8 python analytics/build_summary.py              # build + check
    PYTHONIOENCODING=utf-8 python analytics/build_summary.py --check-only # check the files as they are

Reads only the generated JSON in src/data/ (and params.yaml / the generator manifest for meta), so every headline
is a copy of a number another script computed: one source of truth (DS judge decision 9). The checks fail the run
(exit 1) on any inconsistency: totals that don't reconcile, a summary number that drifted from its source file,
NaN/Infinity anywhere, a missing pinned NUH record, or a planted pattern outside its band.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import SRC_DATA, add_months, load_params, read_json, scenario_dir, write_json  # noqa: E402

SGT = dt.timezone(dt.timedelta(hours=8))
APP_FILES = ["meta", "master", "matrix", "streams", "bridge", "backtest", "stress", "cleanxmethod", "matcher_eval",
             "signals", "actions", "triage_eval", "inbox", "summary", "dedup", "impact"]


def L(name: str) -> dict:
    return read_json(SRC_DATA / f"{name}.json")


def pct(x: float, signed: bool = True, dp: int = 1) -> str:
    s = f"{x * 100:+.{dp}f}%" if signed else f"{x * 100:.{dp}f}%"
    return s.replace("-", "−")


def money(x: float) -> str:
    a = abs(x)
    if a >= 1e7:
        s = f"S${a / 1e6:.1f}M"
    elif a >= 1e6:
        s = f"S${a / 1e6:.2f}M"
    else:
        s = f"S${a / 1e3:.0f}k" if a >= 1e3 else f"S${a:,.0f}"
    return ("−" if x < 0 else "") + s


def per100(w: float) -> int:
    return int(round(w * 100))


def month_label(m: str) -> str:
    y, mm = m.split("-")
    return dt.date(int(y), int(mm), 1).strftime("%b %Y")


# ---------------------------------------------------------------- summary.json
def build_summary() -> dict:
    mx, bt, cx, dd, me, br, imp, st, tri, sig = (L("matrix"), L("backtest"), L("cleanxmethod"), L("dedup"),
                                                 L("matcher_eval"), L("bridge"), L("impact"), L("stress"),
                                                 L("triage_eval"), L("signals"))
    w = mx["window"]
    g = mx["views"]["dedup"]["group"]
    h = bt["headline"]
    hero = next(a for c in br["countries"] if c["country"] == "MY" for a in c["topAccounts"]["dedup"] if a.get("hero"))
    hero_rank = 1 + next(i for c in br["countries"] if c["country"] == "MY"
                         for i, a in enumerate(c["topAccounts"]["dedup"]) if a.get("hero"))
    cu = dd["customers"]
    mis = dd["misattribution"]["totalSgdMoved12m"]
    hm = me["heldOutMetrics"]
    wf = imp["waterfall"]["totals"]
    med = imp["soft"]["cycleTime"]["baselineMedian"]["value"]
    hb = imp["headline"]
    clean_share = cx["fromCleaningPts"] / cx["totalImprovementPts"] if cx["totalImprovementPts"] else 0.0
    rob = forecast_robustness(reuse=True)

    headlines = [
        {
            "id": "growth",
            "label": f"Group PO value, {w['label']}",
            "value": g["sgd12m"],
            "baseline": g["sgdPrior12m"],
            "display": f"{money(g['sgd12m'])} ({pct(g['yoy'])} YoY)",
            "unit": "SGD",
            "sentence": (f"Confirmed customer orders were {money(g['sgd12m'])} in {w['label']}, {pct(g['yoy'])} on the 12 months "
                         f"before ({pct(g['momentum'])} in Jul–Sep), counted on de-duplicated customers. Synthetic, illustrative data."),
            "sourceFile": "matrix.json",
            "sourcePath": "views.dedup.group.sgd12m",
            "useIn": ["app", "video", "slides"],
        },
        {
            "id": "forecast",
            "label": "Forecast error, today's method vs ours (Products A + B)",
            "value": h["oursWape"],
            "baseline": h["baselineWape"],
            "display": f"{per100(h['baselineWape'])} → {per100(h['oursWape'])} per 100",
            "unit": "WAPE",
            "sentence": (f"Today's rolling 12-month average is off by {per100(h['baselineWape'])} units per 100 ordered; our "
                         f"seasonal model is off by {per100(h['oursWape'])}, on 6 backtest months it never saw. It wins "
                         f"{bt['winLoss']['oursWins']} of {bt['winLoss']['cells']} country × product cells and loses "
                         f"{bt['winLoss']['baselineWins']}, which we show. Illustrative, synthetic data."),
            "sourceFile": "backtest.json",
            "sourcePath": "headline.oursWape",
            "useIn": ["app (Pulse)", "video (VO only)"],
            "note": "Final model decision 7: shown on Pulse with the stress test; never in the close or the slide headline tiles.",
            "caveat": (f"The 6 pre-registered backtest months (Apr–Sep 2026) cover the rise of the dengue season, where a rolling average "
                       f"lags most. Not pre-registered: at six off-season origins the gain is {rob['offSeason']['advantagePts']:+.1f} "
                       f"points ({rob['offSeason']['baselineWape'] * 100:.1f} vs {rob['offSeason']['oursWape'] * 100:.1f} per 100); over all "
                       f"12 origins {rob['all12']['baselineWape'] * 100:.1f} vs {rob['all12']['oursWape'] * 100:.1f} per 100."),
        },
        {
            "id": "duplicates",
            "label": "Duplicate customer records found",
            "value": cu["duplicateRecords"],
            "baseline": cu["rawRecords"],
            "display": f"{cu['duplicateRecords']} of {cu['rawRecords']} ({pct(cu['duplicateRate'], False)})",
            "unit": "records",
            "sentence": (f"{cu['duplicateRecords']} of {cu['rawRecords']} customer records are duplicates of "
                         f"{cu['goldenCustomers']} real customers. Merging them changes no country total, but it shows that "
                         f"{hero['name']}, Malaysia's #{hero_rank} account, is down {abs(hero['yoy']) * 100:.0f}%; re-coding three "
                         f"Singapore records moves {money(mis)} of orders back to Malaysia and Vietnam."),
            "sourceFile": "dedup.json",
            "sourcePath": "customers.duplicateRecords",
            "useIn": ["app", "video", "slides"],
        },
        {
            "id": "cycle_time",
            "label": "Setup time for a new record",
            "value": 4,
            "baseline": med,
            "display": f"median {med:.0f} days (Amy's took {wf['beforeDays']['value']}) → ≤ 4 business days",
            "unit": "days",
            "sentence": (f"Today's median is {med:.0f} days (Amy's item took {wf['beforeDays']['value']}). One form, parallel approvals in Teams with a "
                         f"2-business-day SLA, and an SAP import file bring the target median to 4 business days or less; "
                         f"about {wf['processShare']['value'] * 100:.0f}% of the time saved is a process change that needs no new software."),
            "sourceFile": "impact.json",
            "sourcePath": "soft.cycleTime.target.value",
            "useIn": ["app", "video", "slides"],
        },
        {
            "id": "payback",
            "label": "Phase-1 payback",
            "value": hb["paybackMonths"]["value"],
            "display": f"{hb['paybackMonths']['value']:.1f} months on S${hb['phase1OneOffSgd']['value'] / 1000:.1f}k",
            "unit": "months",
            "sentence": hb["sentence"],
            "sourceFile": "impact.json",
            "sourcePath": "headline.paybackMonths.value",
            "useIn": ["app", "video", "slides"],
        },
    ]

    hero_rec = next(c for c in br["countries"] if c["country"] == "MY")["example"]
    supporting = [
        {
            "id": "clean_first",
            "label": "Forecast gain from cleaning master data first (points per 100 ordered)",
            "value": cx["fromCleaningPts"],
            "share": round(clean_share, 3),
            "display": f"{cx['fromCleaningPts']:.1f} of {cx['totalImprovementPts']:.1f} points ({clean_share * 100:.0f}%)",
            "sentence": (f"Cleaning master data alone cuts today's forecast error by {cx['fromCleaningPts']:.1f} points per 100 "
                         f"ordered; on clean data our model cuts a further {cx['fromModellingPts']:.1f}. On uncleaned records our "
                         f"model is worse than today's ({per100(cx['table']['raw']['ours'])} vs "
                         f"{per100(cx['table']['raw']['rolling'])} per 100): clean first, then model."),
            "sourceFile": "cleanxmethod.json", "sourcePath": "fromCleaningPts",
        },
        {
            "id": "matcher",
            "label": "Duplicate matcher on countries it was not tuned on (TH, VN, MM)",
            "value": hm["recall"],
            "precision": hm["precision"],
            "display": f"catches {per100(hm['recall'])} of 100 · {per100(hm['precision'])} of 100 warnings real",
            "sentence": (f"On Thailand, Vietnam and Myanmar, which it was never tuned on, the matcher catches "
                         f"{per100(hm['recall'])} of every 100 real duplicates, and of 100 duplicate warnings "
                         f"{per100(hm['precision'])} are real ({hm['tp']} found, {hm['fn']} missed, {hm['fp']} false alarm)."),
            "sourceFile": "matcher_eval.json", "sourcePath": "heldOutMetrics.recall",
        },
        {
            "id": "hero_my",
            "label": "Malaysia key account revealed by merging duplicates",
            "value": hero["yoy"],
            "display": f"{hero['name']}: {pct(hero['yoy'], dp=0)} YoY (#{hero_rank} in MY)",
            "sentence": (f"On raw SAP records {hero['name']} looks like one lost customer, one new one and one flat one "
                         f"({hero['records']} records); merged, it is Malaysia's #{hero_rank} account and down "
                         f"{abs(hero['yoy']) * 100:.0f}% on last year."),
            "sourceFile": "bridge.json", "sourcePath": "countries[MY].topAccounts.dedup[hero].yoy",
            "goldenId": hero["goldenId"], "records": [r["cardCode"] for r in hero_rec["records"]],
        },
        {
            "id": "stress",
            "label": "Falsification test: our advantage with the signal switched off",
            "value": next(s["advantagePts"] for s in st["scenarios"] if s["id"] == "no_signal"),
            "display": " · ".join(f"{s['label']}: {s['advantagePts']:+.1f} pts" for s in st["scenarios"]),
            "sentence": st["verdict"],
            "sourceFile": "stress.json", "sourcePath": "scenarios[no_signal].advantagePts",
        },
        {
            "id": "triage",
            "label": "Inbox sorting accuracy on a blind test set",
            "value": tri["accuracy"],
            "display": f"{per100(tri['accuracy'])} of 100 sorted correctly ({tri['testSetSize']} messages)",
            "sentence": tri["plain"],
            "sourceFile": "triage_eval.json", "sourcePath": "accuracy",
        },
        {
            "id": "hours",
            "label": "Hard benefit: capacity released at 80 requests a month",
            "value": hb["hoursPerYear"]["value"],
            "display": hb["hoursPerYear"]["display"],
            "sentence": (f"{hb['hoursPerYear']['display']} of analyst, requestor and MDM time at S$50/h = "
                         f"{hb['netSgdPerYear']['display']} a year after run cost; 3-year net {hb['threeYearNetSgd']['display']}."),
            "sourceFile": "impact.json", "sourcePath": "headline.hoursPerYear.value",
        },
        {
            "id": "opportunity",
            "label": "Opportunity (illustrative, before conversion; never summed)",
            "value": sig["totals"]["dropOffAddressableSgd"],
            "display": (f"drop-off {money(sig['totals']['dropOffAddressableSgd'])} at risk · cross-sell "
                        f"{money(sig['totals']['crossSellAddressableSgd'])} addressable"),
            "sentence": (f"{money(sig['totals']['dropOffAddressableSgd'])} of last-year orders sit with accounts showing "
                         f"drop-off (before a {sig['assumptions']['dropOffSaveRate']:.0%} assumed save rate) and "
                         f"{money(sig['totals']['crossSellAddressableSgd'])} of cross-sell is addressable (before a "
                         f"{sig['assumptions']['crossSellConversion']:.0%} assumed conversion). Synthetic data; never added to "
                         "payback or to each other."),
            "sourceFile": "signals.json", "sourcePath": "totals.dropOffAddressableSgd",
        },
    ]
    return {
        "isMock": False,
        "generatedAt": dt.datetime.now(SGT).isoformat(timespec="seconds"),
        "window": w["label"],
        "headlines": headlines,
        "supporting": supporting,
        "rule": ("One source of truth: every number here is copied from the file and path named next to it; the app, "
                 "video script and slides quote these sentences verbatim. Forecast accuracy stays on Pulse, not in the close."),
    }


# ---------------------------------------------------------------- meta.json
FX = [("SG", "SGD", 1.0), ("MY", "MYR", 0.30), ("TH", "THB", 0.039), ("VN", "VND", 0.000052), ("MM", "MMK", 0.00063)]

ASSUMPTIONS = [
    ("A1", "Five countries: Singapore (HQ), Malaysia, Thailand, Vietnam, Myanmar."),
    ("A2", "Entities: SPD sells Product A (diagnostics), QTS Product C (instruments), QTG Product B (lab essentials); large hospitals buy from all three, so each entity created its own customer record."),
    ("A3", "Products: A = IVD reagents and test kits (recurring, seasonal); B = lab consumables (steady); C = instruments (lumpy, tender-driven, fiscal-year flushes; each placement pulls through A)."),
    ("A4", "SGD with fixed illustrative FX rates."),
    ("A5", "History Oct 2023 – Sep 2026 (36 months, amended so seasonal ETS has ≥2 full seasons); window Oct 2025 – Sep 2026; forecast Oct–Dec 2026; backtest origins end-Mar to end-Aug 2026."),
    ("A6", "Only confirmed POs are volume; PRs (quote accepted) are pipeline; enquiries are a leading indicator; follow-ups are excluded; MDM setup requests are internal work, linked to demand only as stuck demand."),
    ("A7", "Units within a product; SGD across products."),
    ("A8", "Growth (amended) = trailing-12-month YoY on de-duplicated customers; momentum = Jul–Sep 2026 vs Jul–Sep 2025. Half-on-half dropped: it would measure seasonality."),
    ("A9", "Approval matrix with parallel stage 1 (a policy change); conditional QA/RA for IVD items; Finance Director above S$50k credit."),
    ("A10", "SLA 2 business days per step in the approver's time zone; reminder after 1, escalation after 3; a question pauses the clock."),
    ("A11", "Baseline 18 calendar days for Amy's item (App C); target ≤4 business days median."),
    ("A12", "~80 MDM requests a month (customers incl. extend 35, items 30, vendors 10, cost centres 5); sensitivity 40 / 120."),
    ("A13", "40% of requests bounce at least once; 6% of new customer records are duplicates."),
    ("A14", "Production on Microsoft 365: canvas Power Apps + SharePoint List + Power Automate standard Approvals + Teams; only phase-2 SAP posting needs premium."),
    ("A15", "SAP B1 landing: phase 1 DTW import files loaded by MDM after the final check; phase 2 Service Layer via an SAP partner."),
    ("A16", "Sensitive fields (bank, credit limit, payment terms) visible to Finance and MDM only; reveals logged (UI-enforced in the prototype)."),
    ("A17", "All data synthetic with documented planted patterns; National University Hospital exists only as a master record with no transactions."),
    ("A18", "Unit costs come from the verified research log, with sources."),
    ("A19", "1.25 h saved per request = rework 0.40 + forwarding/chasing 0.50 + manual keying 0.35 (team estimate)."),
    ("A20", "4 h rework per duplicate customer; 70% intercepted at intake (team estimate)."),
    ("A21", "Regional consolidation: 5 country analysts × 1 day a month = 40 h/month (team estimate)."),
    ("A22", "Phase-1 build S$39,900 one-off (lean team S$24,000, contractor S$9,750, MDM config S$2,400, onboarding S$3,750); run cost 15%/yr."),
    ("A23", "Phase-2 SAP partner 15 days × S$1,500 = S$22,500 (low confidence)."),
    ("A24", "10% leak rate on stuck demand (opportunity column only, never in payback)."),
    ("A25", "FX USD 1 = S$1.33."),
    ("A26", "Baseline median cycle time 14 calendar days (Amy's case: 18)."),
]

PLANT_SPECS = [
    ("hero_my", "Hidden shrinking account (MY)", "Brief S4 (duplicates hide drop-off)",
     "3 records (2 SPD spellings + 1 QTS): one stops after Mar 2026, one starts Apr 2026, one flat; merged it is a top-3 MY account.",
     "hero MY: merged YoY in [-40%, -30%]"),
    ("misattribution", "Country misattribution from Jan 2026", "Brief S4 (regional numbers wrong); DS decision 4/6",
     "SG-coded duplicates capture two Malaysian and one Vietnamese hospital's POs from Jan 2026: a level shift in the raw series.",
     "misattribution MY: 3-8% of 12M value"),
    ("false_crosssell", "False cross-sell gap (TH)", "Brief S4 (cross-sell blind spot)",
     "One hospital looks 'A only' (SPD record) plus 'C only' (QTS record); merged, the real gap is B.",
     "false cross-sell TH: records look A-only + C-only, merged gap is B"),
    ("duplicates", "≈6% duplicate customer records", "A13; DS decision 6",
     "Duplicates with typos, word reorder, Thai/Vietnamese romanisation, blank tax IDs, address formats and cross-entity creation.",
     "duplicate rate ~6% of customer records"),
    ("dengue", "Dengue seasonality and the 2024 → 2025 swing", "Research log: dengue (SG/MY/TH/VN/MM)",
     "Dengue kits peak May–Oct in SG with a 2024 high and a 2025 seven-year low.",
     "dengue: SG May-Oct 2024 test units well above 2025"),
    ("holidays", "CNY / Tet / Songkran / Thingyan dips", "Research log: holiday effects",
     "Order dips in each country's main holiday month.", "holiday dip: VN Tet month below neighbours"),
    ("fiscal", "Fiscal-year flushes on instruments", "Research log: fiscal years",
     "SG/MM Mar, MY/VN Dec, TH Sep year-ends pull instrument orders into the last quarter.",
     "fiscal flush: TH instruments, FY-end quarter share > 25%"),
    ("contract_churn", "MY reagent-rental churn at contract expiry", "Research log: reagent rental contracts (MY)",
     "Two hospitals stop ordering test kits when their rental contract expires.",
     "MY reagent-rental churn at contract expiry (A stops)"),
    ("value_mix", "Value mix A ≈ 3× C", "Sysmex FY3/2026: reagents 61.6%, instruments 20.6%",
     "Reagents and kits about three times instruments by value.", "value mix A ~3x C (12M)"),
    ("stuck_demand", "Stuck demand S$150–450k", "Final model §5.6 #6",
     "PRs blocked by pending MDM setups, incl. pinned PR-5521 / PR-5527 behind REQ-1042.", "stuck demand S$150-450k"),
    ("nuh", "NUH is a master record only", "Brief S4 example; plan pinned facts",
     "C-SG-00017 National University Hospital exists with no transactions, for the intake duplicate demo.",
     "NUH C-SG-00017 master record exact, 0 transactions"),
]


ROBUSTNESS_CACHE = scenario_dir("base") / "robustness.json"
OFF_SEASON_ORIGINS = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]


def forecast_robustness(reuse: bool = False) -> dict:
    """NOT pre-registered; a robustness diagnostic only. The pre-registered origins (end Mar-Aug 2026) forecast
    Apr-Sep 2026, i.e. the dengue season, where a rolling average lags most. Rerun the identical method at the six
    off-season origins (end Sep 2025 - Feb 2026) and over all 12, so the lead can state how season-dependent the gain is."""
    if reuse and ROBUSTNESS_CACHE.exists():
        return read_json(ROBUSTNESS_CACHE)
    import forecast as F  # local import: statsmodels is slow to load

    s = F.series("base")
    price = F.cell_prices("base")

    def run(origins):
        tot = {m: [0.0, 0.0, 0.0] for m in F.METHOD_IDS}
        wins = 0
        for c in ["SG", "MY", "TH", "VN", "MM"]:
            for p in F.HEADLINE_PRODUCTS:
                act = s["dedup_units"][(c, p)]
                runs = F.backtest_series(act, origins=origins)
                cell = {}
                for m in F.METHOD_IDS:
                    a, f, _ = F.score(runs, act, m)
                    _, _, ae, sa, e = F.wape_bias(a, f, price[(c, p)])
                    tot[m][0] += ae
                    tot[m][1] += sa
                    tot[m][2] += e
                    cell[m] = ae / sa
                wins += cell[F.OURS] < cell[F.BASELINE]
        res = {m: {"wape": round(v[0] / v[1], 4), "bias": round(v[2] / v[1], 4)} for m, v in tot.items()}
        return {"origins": origins, "baselineWape": res[F.BASELINE]["wape"], "oursWape": res[F.OURS]["wape"],
                "baselineBias": res[F.BASELINE]["bias"], "oursBias": res[F.OURS]["bias"],
                "advantagePts": round((res[F.BASELINE]["wape"] - res[F.OURS]["wape"]) * 100, 1), "oursWins": int(wins),
                "cells": 10}

    out = {"note": ("Not pre-registered: a robustness diagnostic. Same methods, horizons 1-3, refit at every origin, "
                    "A + B, S$-weighted, golden IDs; only the origins differ."),
           "offSeason": run(OFF_SEASON_ORIGINS), "all12": run(OFF_SEASON_ORIGINS + F.ORIGINS)}
    write_json(out, ROBUSTNESS_CACHE)
    return out


def matcher_recovery() -> dict:
    """How much of the planted misattribution the matcher's OWN crosswalk recovers (no ground truth): country of a
    PO = recorded country of its cluster's survivor record. The app's de-duplicated view uses ground-truth golden IDs."""
    import pandas as pd
    d = scenario_dir("base")
    cw = pd.read_csv(d / "crosswalk.csv", dtype=str, keep_default_na=False)
    pos = pd.read_csv(d / "pos.csv", dtype={"sgd": float}, keep_default_na=False)
    t = load_params()["time"]
    win = pos[pos["month"].between(t["window_start"], t["window_end"])].copy()
    surv = cw.set_index("card_code")["survivor_card_code"]
    rc = cw.set_index("card_code")["recorded_country"]
    win["pred_country"] = win["record_card_code"].map(surv).map(rc)
    raw = win.groupby("recorded_country")["sgd"].sum()
    pred = win.groupby("pred_country")["sgd"].sum().reindex(raw.index, fill_value=0)
    true = win.groupby("true_country")["sgd"].sum().reindex(raw.index, fill_value=0)
    need_c = (true - raw).clip(lower=0)
    got_c = (pred - raw).clip(lower=0).clip(upper=need_c)
    need, got = float(need_c.sum()), float(got_c.sum())
    by = {c: {"truthCorrection": round(float(true[c] - raw[c])), "matcherCorrection": round(float(pred[c] - raw[c]))}
          for c in raw.index}
    wrong = cw[cw["correct"] != "true"]
    return {"misattributionSgd12m": round(need), "recoveredSgd12m": round(got),
            "recoveredShare": round(got / need, 3) if need else 1.0,
            "byCountry": by, "recordsMisclustered": int(len(wrong)), "records": int(len(cw))}


def build_meta(reuse_robustness: bool = False) -> dict:
    P = load_params()
    t = P["time"]
    mx, bt, dd, me, st, sig, cx, imp, tri = (L("matrix"), L("backtest"), L("dedup"), L("matcher_eval"), L("stress"),
                                             L("signals"), L("cleanxmethod"), L("impact"), L("triage_eval"))
    man = read_json(scenario_dir("base") / "manifest.json")
    asserts = {a["name"]: a for a in man["assertions"]}
    master = L("master")
    window = dict(mx["window"])
    if "forecastStart" not in window:
        window.update(forecastStart=add_months(t["history_end"], 1), forecastEnd=add_months(t["history_end"], 3))

    plants = []
    for pid, name, src, desc, akey in PLANT_SPECS:
        a = asserts.get(akey)
        measured = f" Measured: {a['value']} (target {a['target']}, {'pass' if a['ok'] else 'FAIL'})." if a else ""
        plants.append({"id": pid, "name": name, "description": desc, "source": src,
                       "assertion": f"{akey}.{measured}"})
    wl = bt["winLoss"]["byProduct"]
    plants.append({"id": "forecast", "name": "Forecast plant check", "source": "Final model §5.6 #4",
                   "description": "Seasonal ETS should beat rolling-12 on A in ≥3 of 5 countries and on B in ≥2; stress (a) |Δ| ≤ 2 points; stress (b) advantage persists.",
                   "assertion": (f"A {wl['A']['oursWins']}/5, B {wl['B']['oursWins']}/5; stress: "
                                 + ", ".join(f"{s['id']} {s['advantagePts']:+.1f} pts ({'pass' if s['passed'] else 'FAIL'})" for s in st["scenarios"]))})
    hm = me["heldOutMetrics"]
    plants.append({"id": "matcher", "name": "Matcher band", "source": "Final model §5.6 #5",
                   "description": "Held-out precision and recall each between 0.80 and 0.97 (a suspiciously perfect score fails).",
                   "assertion": f"held-out P {hm['precision']}, R {hm['recall']}, F1 {hm['f1']} at threshold {me['threshold']}"})

    mis = dd["byCountry"]
    misshare = {c["country"]: c["pctOfCountry12m"] for c in mis}
    rob = forecast_robustness(reuse_robustness)
    rec = matcher_recovery()
    off, a12 = rob["offSeason"], rob["all12"]
    full = [c for c, v in rec["byCountry"].items() if v["truthCorrection"] > 0 and v["matcherCorrection"] >= v["truthCorrection"] - 2]
    missed = [c for c, v in rec["byCountry"].items() if v["truthCorrection"] > 0 and v["matcherCorrection"] < v["truthCorrection"] - 2]
    return {
        "isMock": False,
        "generatedAt": dt.datetime.now(SGT).isoformat(timespec="seconds"),
        "seed": int(P["scenarios"]["base"]["seed"]),
        "synthetic": True,
        "generator": "analytics/run_all.py (generate → resolve → growth → forecast → stress → signals → streams → actions → business_case → build_summary)",
        "window": window,
        "growthFormula": mx["growthFormula"],
        "momentumFormula": mx["momentumFormula"],
        "wapeFormula": bt["wapeFormula"],
        "biasFormula": bt["biasFormula"],
        "seasonalityNote": ("We do not compare half-years: dengue season, fiscal-year flushes and CNY/Tet would make that "
                            "seasonality, not growth."),
        "currency": "SGD",
        "fx": [{"country": c, "currency": cur, "sgdPerUnit": r} for c, cur, r in FX],
        "params": {
            "seed": int(P["scenarios"]["base"]["seed"]),
            "historyMonths": 36,
            "historyStart": t["history_start"], "historyEnd": t["history_end"],
            "customerRecords": dd["customers"]["rawRecords"],
            "customersGolden": dd["customers"]["goldenCustomers"],
            "duplicateRecords": dd["customers"]["duplicateRecords"],
            "duplicateRate": dd["customers"]["duplicateRate"],
            "items": len(master["items"]),
            "misattributionStart": dd["misattribution"]["startedMonth"],
            "misattributionSgd12m": dd["misattribution"]["totalSgdMoved12m"],
            "misattributionShareSG": misshare.get("SG", 0.0),
            "misattributionShareMY": misshare.get("MY", 0.0),
            "misattributionShareVN": misshare.get("VN", 0.0),
            "miscategorisationSgd12m_TH": dd["miscategorisation"]["sgd12m"],
            "backtestOrigins": ",".join(bt["origins"]),
            "backtestHorizons": ",".join(str(h) for h in bt["horizons"]),
            "forecastScope": bt["headline"]["scope"],
            "matcherThreshold": me["threshold"],
            "matcherTunedOn": ",".join(me["tunedOn"]),
            "matcherHeldOut": ",".join(me["heldOut"]),
            "dropOffSaveRate": sig["assumptions"]["dropOffSaveRate"],
            "crossSellConversion": sig["assumptions"]["crossSellConversion"],
            "stuckDemandLeakRate": 0.10,
            "hourlyRateSgd": 50,
            "requestsPerMonthBase": imp["baseVolume"],
            "backtestOffSeasonAdvantagePts": off["advantagePts"],
            "backtestAll12OriginsAdvantagePts": a12["advantagePts"],
            "misattributionRecoveredByMatcherShare": rec["recoveredShare"],
            "scenarioNoSignal": "seed 42, seasonality and trend off",
            "scenarioHalfDengue": "seed 7, dengue amplitude × 0.5",
        },
        "modelCard": {
            "purpose": ("Give regional management one consistent view of customer demand by country × product, show how much "
                        "clean master data changes it, and test whether a seasonal forecast beats today's rolling average."),
            "intendedUse": ("Illustrative prototype on synthetic data. The same scripts are meant to be rerun unchanged on SAP B1 "
                            "extracts (ORDR/RDR1, OQUT, OCRD, OITM) in week 1 of the pilot."),
            "notIntendedFor": [
                "Real stock, budget or headcount decisions before the pilot re-measures every number on real orders",
                "Forecasting Product C (instruments): it is planned from the tender / PR pipeline",
                "Automatically merging SAP records: the matcher suggests, the MDM team decides",
            ],
            "methods": [
                {"name": "Growth", "detail": mx["growthFormula"] + " " + mx["momentumFormula"]},
                {"name": "Entity resolution", "detail": me["method"]},
                {"name": "Forecast", "detail": bt["preRegistration"]},
                {"name": "Falsification", "detail": f"{st['title']}: {st['scope']}"},
                {"name": "Clean × method", "detail": cx["scope"]},
                {"name": "Signals", "detail": ("Drop-off: Apr–Sep 2026 vs the same months of 2025, a de-seasonalised trend and an "
                                               "overdue-reorder check (> 1.5 × the usual gap). Cross-sell: gap to similar customers "
                                               "(same country and type), sized to the customer's own spend; installed-base pull-through "
                                               "is a signal only, never a forecast feature (leakage).")},
                {"name": "Inbox sorting", "detail": "Transparent weighted rules (no model); scored once on a blind 60-message test set."},
                {"name": "Business case", "detail": "Final model §6: hours × S$50, payback on hard hours only; soft and opportunity kept in separate columns."},
            ],
            "limitations": [
                "All data is synthetic and the planted patterns are known in advance: good scores show the pipeline works and is honest, not that the patterns exist in Lives Group's data.",
                (f"The de-duplicated view uses the generator's ground-truth golden IDs (the true picture the matcher aims at). "
                 f"The matcher's own crosswalk mis-clusters {rec['recordsMisclustered']} of {rec['records']} records and recovers "
                 f"{rec['recoveredShare']:.0%} of the S${rec['misattributionSgd12m'] / 1e6:.2f}M misattribution "
                 f"(recovered: {', '.join(full) or 'none'}; missed: {', '.join(missed) or 'none'}, the pairs shown as misses in "
                 "the matcher evaluation). "
                 "In production the view would use the matcher's crosswalk after MDM review."),
                (f"The pre-registered backtest scores Apr–Sep 2026, the rise of the dengue season, where a rolling average lags most "
                 f"(today's method under-forecasts by {abs(bt['headline']['baselineBias']) * 100:.0f}%). A non-pre-registered rerun at "
                 f"the six off-season origins (end Sep 2025 – Feb 2026, scoring Oct 2025 – May 2026) gives {off['baselineWape'] * 100:.1f} vs "
                 f"{off['oursWape'] * 100:.1f} per 100 ({off['advantagePts']:+.1f} points; ours wins {off['oursWins']} of 10 cells); over "
                 f"all 12 origins {a12['baselineWape'] * 100:.1f} vs {a12['oursWape'] * 100:.1f} ({a12['advantagePts']:+.1f} points). "
                 "The gain is concentrated where the season turns, which is where today's method fails."),
                f"Forecast: ours beats today's method in {bt['winLoss']['oursWins']} of {bt['winLoss']['cells']} A/B cells and loses {bt['winLoss']['baselineWins']} ({', '.join(bt['winLoss']['baselineWinCells'])}); on Product C it is worse ({per100(bt['productC']['oursWape'])} vs {per100(bt['productC']['baselineWape'])} per 100).",
                f"On uncleaned records the seasonal model is worse than today's method ({per100(cx['table']['raw']['ours'])} vs {per100(cx['table']['raw']['rolling'])} per 100): it learns the fake Jan-2026 level shift. Clean first.",
                "P10/P90 bands are empirical (backtest actual ÷ forecast ratios pooled across countries), from only 6 origins.",
                "Signal S$ are addressable before conversion, with team-assumed save (25%) and conversion (15%) rates.",
                "Fixed illustrative FX rates; prices are order-of-magnitude list prices with no source.",
                "The TypeScript matcher used at intake is a port of the same scorer (parity-tested on 25 fixture pairs); the live intake warns at 0.75 and blocks at 0.85, the batch merge threshold is 0.905.",
            ],
        },
        "dataHonesty": [
            {"item": "Customers, items, orders, PRs, enquiries, MDM history", "status": "synthetic",
             "detail": "Generated by analytics/generate.py from params.yaml with seed 42; all names fictional except the pinned demo record."},
            {"item": "Dengue seasonality and year swings", "status": "synthetic",
             "detail": "Shapes and the 2024 high → 2025 low taken from NEA / MOH / KKM case data (research log)."},
            {"item": "Fiscal-year flushes, holiday dips", "status": "synthetic",
             "detail": "SG/MM Apr–Mar, MY/VN Jan–Dec, TH Oct–Sep; CNY / Tet / Songkran / Thingyan (research log)."},
            {"item": "Value mix A ≈ 3× C", "status": "assumption", "detail": "Sysmex FY3/2026: reagents 61.6%, instruments 20.6%."},
            {"item": "Backtest method and metrics", "status": "validated",
             "detail": "Pre-registered, leak-tested (forecasts unchanged when future data is overwritten), losses reported; synthetic data only."},
            {"item": "Falsification test", "status": "validated", "detail": st["verdict"]},
            {"item": "Season dependence of the forecast gain", "status": "validated",
             "detail": (f"Not pre-registered: off-season origins give {off['advantagePts']:+.1f} points, all 12 origins "
                        f"{a12['advantagePts']:+.1f}, vs {bt['headline']['improvementPts']:+.1f} pre-registered.")},
            {"item": "Matcher precision / recall", "status": "validated",
             "detail": f"Held-out TH/VN/MM: {me['plain']['precision']}; {me['plain']['recall']}. Perturbations not mirrored in the normaliser."},
            {"item": "Inbox sorting accuracy", "status": "validated", "detail": tri["plain"]},
            {"item": "Forecast gain on real orders", "status": "needs_pilot", "detail": "Must be re-measured on 24–36 months of real B1 orders."},
            {"item": "Real duplicate and misattribution rates", "status": "needs_pilot", "detail": "A13 assumes 6%; the pilot measures it on OCRD."},
            {"item": "Save rate on drop-off / conversion on cross-sell", "status": "assumption",
             "detail": f"{sig['assumptions']['dropOffSaveRate']:.0%} / {sig['assumptions']['crossSellConversion']:.0%}, shown next to every S$ figure; never summed into revenue."},
            {"item": "Hours saved and costs (A19–A26)", "status": "assumption",
             "detail": "Team estimates and research-log prices; payback counts hard hours only (impact.json)."},
        ],
        "plantedPatterns": plants,
        "validatedVsPilot": {
            "validatedHere": [
                "The pipeline runs end to end from one seed and reproduces (analytics/run_all.py)",
                "The backtest is leak-free and its losses are reported",
                "The matcher is measured on countries it was not tuned on",
                "No advantage appears when there is no signal (falsification test)",
                "Cleaning alone moves forecast error before any modelling (clean × method)",
                "Business-case arithmetic reproduces the final model §6 figures",
            ],
            "needsPilot": [
                "Forecast gain on real orders",
                "Real duplicate and misattribution rates",
                "Save and conversion rates",
                "Hours saved per request (A19) and analyst hours (A21)",
                "Bounce rate and median cycle time baselines (A13, A26)",
            ],
        },
        "pilotPlan": {
            "summary": imp["adoption"]["pilot"]["summary"],
            "weeks": imp["adoption"]["pilot"]["weeks"],
            "scope": imp["adoption"]["pilot"]["scope"],
            "sapMapping": [
                {"sapTable": "ORDR / RDR1", "sapDescription": "Sales order header / lines", "feeds": "Purchase orders (volume)",
                 "ourFile": "pos.csv", "keyFields": ["DocEntry", "DocDate", "CardCode", "ItemCode", "Quantity", "LineTotal"]},
                {"sapTable": "OQUT / QUT1", "sapDescription": "Sales quotations", "feeds": "Purchase requests (pipeline)",
                 "ourFile": "prs.csv", "keyFields": ["DocEntry", "DocDate", "CardCode", "DocStatus", "DocTotal"]},
                {"sapTable": "OCRD / CRD1", "sapDescription": "Business partner master / addresses",
                 "feeds": "Customer records for de-duplication", "ourFile": "customers_records.csv",
                 "keyFields": ["CardCode", "CardName", "LicTradNum", "Phone1", "E_Mail", "ZipCode"]},
                {"sapTable": "OITM / OITB", "sapDescription": "Item master / item groups", "feeds": "Item → product group mapping",
                 "ourFile": "items.csv", "keyFields": ["ItemCode", "ItemName", "ItmsGrpCod"]},
            ],
            "steps": [
                "Week 1: extract ORDR/RDR1, OQUT, OCRD, OITM per entity database; run analytics/run_all.py unchanged on the extracts",
                "Week 2: MDM team reviews the top 50 duplicate suggestions; measure real precision",
                "Weeks 3–6: rerun the backtest monthly against today's rolling average; report losses too",
                f"Week 6: keep / kill on the KPIs: {imp['adoption']['killScale']['kill']}",
            ],
        },
        "assumptions": [{"id": a, "text": txt} for a, txt in ASSUMPTIONS],
    }


# ---------------------------------------------------------------- consistency checks
class Checker:
    def __init__(self):
        self.rows: list[tuple[bool, str, str]] = []

    def __call__(self, ok: bool, name: str, detail: str = "") -> None:
        self.rows.append((bool(ok), name, detail))

    @property
    def failed(self):
        return [r for r in self.rows if not r[0]]


def _strict_load(path: Path):
    def bad(c):
        raise ValueError(f"non-finite constant {c}")
    with open(path, encoding="utf-8") as f:
        return json.load(f, parse_constant=bad)


def _walk_nonfinite(o, path="$"):
    if isinstance(o, float) and not math.isfinite(o):
        yield path
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from _walk_nonfinite(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from _walk_nonfinite(v, f"{path}[{i}]")


def _resolve(obj, path: str):
    for part in path.split("."):
        obj = obj[int(part)] if isinstance(obj, list) else obj[part]
    return obj


def verify() -> Checker:
    ck = Checker()
    D = {}
    for n in APP_FILES:
        p = SRC_DATA / f"{n}.json"
        try:
            D[n] = _strict_load(p)
            nf = list(_walk_nonfinite(D[n]))
            ck(not nf, f"{n}.json: no NaN/Infinity", ", ".join(nf[:3]))
        except Exception as e:  # noqa: BLE001
            ck(False, f"{n}.json parses strictly", str(e))
    if len(D) < len(APP_FILES):
        return ck
    for n, d in D.items():
        if isinstance(d, dict) and "isMock" in d:
            ck(d["isMock"] is False, f"{n}.json isMock false")

    # pinned NUH
    nuh = [c for c in D["master"]["customers"] if c.get("cardCode") == "C-SG-00017"]
    ok = (len(nuh) == 1 and nuh[0].get("cardName") == "National University Hospital" and nuh[0].get("hasTransactions") is False
          and nuh[0].get("licTradNum") == "198500123K" and nuh[0].get("zipCode") == "119074" and nuh[0].get("country") == "SG"
          and nuh[0].get("entity") == "SPD")
    ck(ok, "master.json: pinned NUH C-SG-00017 exact, hasTransactions=false", json.dumps(nuh[0] if nuh else None, ensure_ascii=False)[:160])

    # matrix vs streams
    mx, sm, dd = D["matrix"], D["streams"], D["dedup"]
    dv, rv = mx["views"]["dedup"], mx["views"]["raw"]
    dct = {t["key"]: t["sgd12m"] for t in dv["countryTotals"]}
    rct = {t["key"]: t["sgd12m"] for t in rv["countryTotals"]}
    for c in sm["countries"]:
        diff = c["poSgd12m"] - dct[c["country"]]
        ck(abs(diff) <= 2, f"streams PO 12M = matrix dedup total ({c['country']})", f"{c['poSgd12m']:,} vs {dct[c['country']]:,}")
    cell_sum = sum(x["sgd12m"] for x in dv["cells"])
    ck(abs(cell_sum - dv["group"]["sgd12m"]) <= 15, "matrix dedup: Σ cells = group total", f"{cell_sum:,} vs {dv['group']['sgd12m']:,}")
    ck(abs(dv["group"]["sgd12m"] - rv["group"]["sgd12m"]) <= 2, "matrix: raw group total = de-duplicated group total",
       f"{rv['group']['sgd12m']:,} vs {dv['group']['sgd12m']:,}")

    # raw vs dedup differ only by misattribution (country) and miscategorisation (product)
    by = {c["country"]: c for c in dd["byCountry"]}
    for k in dct:
        diff = dct[k] - rct[k]
        ck(abs(diff - by[k]["netCorrectionSgd12m"]) <= 2, f"dedup − raw ({k}) = misattribution correction",
           f"{diff:+,} vs {by[k]['netCorrectionSgd12m']:+,}")
    moved = sum(c["sgdMisattributedIn12m"] for c in dd["byCountry"])
    ck(abs(moved - dd["misattribution"]["totalSgdMoved12m"]) <= 2, "Σ misattributed in = misattribution total",
       f"{moved:,} vs {dd['misattribution']['totalSgdMoved12m']:,}")
    ck(abs(sum(c["netCorrectionSgd12m"] for c in dd["byCountry"])) <= 2, "misattribution corrections net to zero")
    dpt = {t["key"]: t["sgd12m"] for t in dv["productTotals"]}
    rpt = {t["key"]: t["sgd12m"] for t in rv["productTotals"]}
    man = read_json(scenario_dir("base") / "manifest.json")["summary"]
    miscat = man.get("miscategorised_sgd_12m")
    ck(abs((dpt["A"] - rpt["A"]) - (rpt["B"] - dpt["B"])) <= 2 and abs(dpt["C"] - rpt["C"]) <= 2,
       "product totals: raw vs dedup differ only by A↔B miscategorisation", f"A {dpt['A'] - rpt['A']:+,}, B {dpt['B'] - rpt['B']:+,}, C {dpt['C'] - rpt['C']:+,}")
    if miscat is not None:
        ck(abs((dpt["A"] - rpt["A"]) - miscat) <= 2, "A dedup − A raw = miscategorised S$ (generator manifest)",
           f"{dpt['A'] - rpt['A']:,} vs {miscat:,.0f}")
    changed_c = [x for x in dv["cells"] if x["product"] == "C" and x["deltaVsRaw"] != 0]
    ck(not changed_c, "no Product C cell changes on cleaning")

    # plants within bands
    for c in ("MY", "VN"):
        ck(0.03 <= by[c]["pctOfCountry12m"] <= 0.08, f"misattribution {c} within 3–8% of country value", f"{by[c]['pctOfCountry12m']:.2%}")
    ck(0.03 <= abs(by["SG"]["pctOfCountry12m"]) <= 0.08, "SG overstatement within 3–8%", f"{by['SG']['pctOfCountry12m']:.2%}")
    ck(0.05 <= dd["customers"]["duplicateRate"] <= 0.07, "duplicate rate ≈6%", f"{dd['customers']['duplicateRate']:.2%}")
    br = D["bridge"]
    my = next(c for c in br["countries"] if c["country"] == "MY")
    hero = [a for a in my["topAccounts"]["dedup"] if a.get("hero")]
    ck(len(hero) == 1 and -0.40 <= hero[0]["yoy"] <= -0.30 and my["topAccounts"]["dedup"].index(hero[0]) < 3,
       "MY hero: merged top-3 account, YoY in [−40%, −30%]", f"{hero[0]['name']} {hero[0]['yoy']:+.1%}" if hero else "missing")
    for c in br["countries"]:
        for view in ("raw", "dedup"):
            s = {x["key"]: x["sgd"] for x in c[view]}
            tot = s["prior"] + s["new"] + s["expanding"] + s["declining"] + s["lost"]
            ck(tot == s["current"], f"bridge {c['country']} {view}: steps sum exactly", f"{tot:,} vs {s['current']:,}")
        cur = next(x["sgd"] for x in c["dedup"] if x["key"] == "current")
        ck(abs(cur - dct[c["country"]]) <= 2, f"bridge {c['country']} current = matrix dedup total", f"{cur:,} vs {dct[c['country']]:,}")
    ac = dpt["A"] / dpt["C"]
    ck(2.5 <= ac <= 3.6, "value mix A ≈ 3× C", f"{ac:.2f}")

    # forecast / stress / 2x2
    bt, cx, st = D["backtest"], D["cleanxmethod"], D["stress"]
    wl = bt["winLoss"]["byProduct"]
    ck(wl["A"]["oursWins"] >= 3 and wl["B"]["oursWins"] >= 2, "forecast plant: ours wins A ≥3/5 and B ≥2/5",
       f"A {wl['A']['oursWins']}, B {wl['B']['oursWins']}")
    ck(abs(cx["table"]["golden"]["ours"] - bt["headline"]["oursWape"]) < 1e-3
       and abs(cx["table"]["golden"]["rolling"] - bt["headline"]["baselineWape"]) < 1e-3,
       "2×2 golden row = backtest headline")
    ck(abs(cx["fromCleaningPts"] + cx["fromModellingPts"] - cx["totalImprovementPts"]) <= 0.11, "2×2 parts add up")
    base = next(s for s in st["scenarios"] if s["id"] == "base")
    ck(abs(base["oursWape"] - bt["headline"]["oursWape"]) < 1e-3, "stress base = backtest headline")
    ck(all(s["passed"] for s in st["scenarios"]), "stress test: all 3 scenarios behave as pre-registered",
       ", ".join(f"{s['id']} {s['advantagePts']:+.1f}" for s in st["scenarios"]))
    ns = next(s for s in st["scenarios"] if s["id"] == "no_signal")
    ck(abs(ns["advantagePts"]) <= 2.0, "no-signal advantage within ±2 points", f"{ns['advantagePts']:+.1f}")
    ck(0 < bt["headline"]["improvementPts"] <= 10, "forecast gain plausible (0–10 points)", f"{bt['headline']['improvementPts']}")
    wins = sum(1 for x in bt["cells"] if x["inHeadline"] and x["oursBeatsBaseline"])
    ck(wins == bt["winLoss"]["oursWins"], "win/loss count matches the cells", f"{wins} vs {bt['winLoss']['oursWins']}")

    # matcher
    me = D["matcher_eval"]["heldOutMetrics"]
    ck(0.80 <= me["precision"] <= 0.97 and 0.80 <= me["recall"] <= 0.97, "matcher held-out P and R in [0.80, 0.97]",
       f"P {me['precision']} R {me['recall']}")
    ck(abs(D["matcher_eval"]["duplicateRate"] - dd["customers"]["duplicateRate"]) < 1e-3, "matcher duplicate rate = dedup.json")

    # signals / actions
    sg = D["signals"]
    ck(abs(sum(r["sgdAddressable"] for r in sg["dropOff"]) - sg["totals"]["dropOffAddressableSgd"]) <= 2, "signals drop-off total = Σ rows")
    ck(abs(sum(r["sgdAddressable"] for r in sg["crossSell"]) - sg["totals"]["crossSellAddressableSgd"]) <= 2, "signals cross-sell total = Σ rows")
    ck(all(r["assumedConversion"] in (sg["assumptions"]["dropOffSaveRate"], sg["assumptions"]["crossSellConversion"])
           for r in sg["dropOff"] + sg["crossSell"]), "every signal row shows its assumed rate")
    ck(len(D["actions"]["cards"]) == 5 and all(2 <= len(c["actions"]) <= 3 for c in D["actions"]["cards"]),
       "actions: 5 country cards with 2–3 actions")
    my_text = json.dumps(next(c for c in D["actions"]["cards"] if c["country"] == "MY"), ensure_ascii=False)
    ck("REQ-1042" in my_text and "PR-5521" in my_text and "PR-5527" in my_text, "MY card cites REQ-1042 / PR-5521 / PR-5527")

    # impact
    imp = D["impact"]
    ck(imp.get("checksPassed") is True, "impact.json reproduces the final model §6 figures",
       f"{sum(c['ok'] for c in imp['checks'])}/{len(imp['checks'])}")
    ck(abs(imp["headline"]["paybackMonths"]["value"] - 5.9) < 0.05, "base payback = 5.9 months (final model §6.3)")

    # summary = sources
    sm_ = D["summary"]
    ids = [h["id"] for h in sm_["headlines"]]
    ck(ids == ["growth", "forecast", "duplicates", "cycle_time", "payback"], "summary: 5 headlines in contract order", str(ids))
    for h in sm_["headlines"] + sm_.get("supporting", []):
        src = D[h["sourceFile"].replace(".json", "")] if h["sourceFile"].replace(".json", "") in D else None
        path = h["sourcePath"]
        if src is None or "[" in path:
            continue
        try:
            v = _resolve(src, path)
        except Exception as e:  # noqa: BLE001
            ck(False, f"summary {h['id']}: source path resolves", f"{h['sourceFile']}:{path} {e}")
            continue
        ck(isinstance(v, (int, float)) and abs(v - h["value"]) < 1e-6 * max(1, abs(v)),
           f"summary {h['id']} = {h['sourceFile']}:{path}", f"{h['value']} vs {v}")
    tri = D["triage_eval"]
    ck(abs(sum(sum(r) for r in tri["confusion"]) - tri["testSetSize"]) == 0, "triage confusion matrix sums to the test-set size")
    return ck


def print_checks(ck: Checker) -> None:
    for ok, name, detail in ck.rows:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))
    print(f"consistency checks: {len(ck.rows) - len(ck.failed)}/{len(ck.rows)} pass")


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check-only", action="store_true")
    ap.add_argument("--reuse-robustness", action="store_true",
                    help="reuse analytics/out/base/robustness.json instead of refitting the off-season backtest")
    a = ap.parse_args(argv)
    if not a.check_only:
        write_json(build_meta(a.reuse_robustness), SRC_DATA / "meta.json")  # also writes the robustness cache
        s = build_summary()
        write_json(s, SRC_DATA / "summary.json")
        for h in s["headlines"]:
            print(f"  {h['id']:<11} {h['display']:<34} {h['sentence']}")
        for h in s["supporting"]:
            print(f"  +{h['id']:<10} {h['display']}")
    ck = verify()
    print_checks(ck)
    if ck.failed:
        raise SystemExit(f"{len(ck.failed)} consistency check(s) failed")


if __name__ == "__main__":
    main()
