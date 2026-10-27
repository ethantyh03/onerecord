"""Headline growth matrix, growth bridge and the de-duplication impact (DS judge's binding decisions 1, 6, 7).

Decision 1 (headline growth):
    Growth   = PO value (Oct 2025–Sep 2026) ÷ PO value (Oct 2024–Sep 2025) − 1, per country × product,
               on de-duplicated customers (golden IDs). SGD across products; units within a product.
    Momentum = PO value (Jul–Sep 2026) ÷ PO value (Jul–Sep 2025) − 1.
Decision 6: merging customer duplicates alone does NOT change country × product totals; only misattribution
(wrong country) and miscategorisation (wrong product) do, and every output says so.

Views: raw = recorded_country × recorded_product, customers = SAP records (record_card_code).
       dedup = true_country × true_product, customers = golden IDs. The dedup view uses the generator's
       ground-truth golden_id column; the matcher's own crosswalk is evaluated separately (matcher_eval.json).

Outputs (shapes in src/data/contract.ts): build_matrix() -> matrix.json, build_bridge() -> bridge.json,
build_dedup() -> dedup.json.
Run:  python analytics/growth.py
"""
from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (COUNTRIES, COUNTRY_NAMES, PRODUCTS, SRC_DATA, add_months, load_params,  # noqa: E402
                    month_range, monthly_series, read_json, read_table, scenario_dir, windows, write_json)

GROWTH_FORMULA = ("Growth = PO value (Oct 2025–Sep 2026) ÷ PO value (Oct 2024–Sep 2025) − 1, per country × product, "
                  "on de-duplicated customers (golden IDs). PO value in SGD for cross-product totals; PO units within "
                  "a product.")
MOMENTUM_FORMULA = "Momentum = PO value (Jul–Sep 2026) ÷ PO value (Jul–Sep 2025) − 1"
MEASURE_NOTE = ("Confirmed customer POs only (PRs, enquiries, follow-ups and MDM requests are not volume). PO value in "
                "SGD at fixed illustrative FX for cross-product totals; PO units within a product. We compare the same "
                "12 months a year apart, never half-years, so dengue season, fiscal-year flushes and CNY/Tet do not "
                "show up as growth.")
ADJ = {"SG": "Singaporean", "MY": "Malaysian", "TH": "Thai", "VN": "Vietnamese", "MM": "Myanmar"}
GOLDEN_NOTE = ("The de-duplicated view uses the synthetic data's ground-truth golden IDs; the matcher that would build "
               "them in production is scored separately on held-out countries.")
FLAT_BAND = 0.10  # |YoY| < 10% = "flat" in the top-accounts status


def _window(params: dict) -> dict:
    t = params["time"]
    return {"label": "Oct 2025 – Sep 2026", "start": t["window_start"], "end": t["window_end"],
            "priorStart": t["prior_start"], "priorEnd": t["prior_end"], "momentumStart": t["momentum_start"],
            "momentumEnd": t["momentum_end"], "historyStart": t["history_start"], "historyEnd": t["history_end"],
            "forecastStart": add_months(t["history_end"], 1), "forecastEnd": add_months(t["history_end"], 3)}


def yoy(cur: float, pri: float) -> float | None:
    return None if not pri else round(float(cur) / float(pri) - 1, 4)


def money(x: float) -> int:
    return int(round(float(x)))


def fmt_sgd(x: float) -> str:
    x = float(x)
    if abs(x) >= 1e6:
        return f"S${x / 1e6:.1f}M"
    if abs(x) >= 1e3:
        return f"S${x / 1e3:.0f}k"
    return f"S${x:.0f}"


def pct(x: float | None, signed: bool = True) -> str:
    if x is None:
        return "n/a"
    return f"{x * 100:+.0f}%" if signed else f"{x * 100:.0f}%"


@lru_cache(maxsize=None)
def data(scenario: str = "base") -> dict:
    return {"pos": read_table("pos", scenario), "cr": read_table("customers_records", scenario),
            "gold": read_table("golden_customers", scenario), "items": read_table("items", scenario),
            "plants": read_json(scenario_dir(scenario) / "plants.json")}


# ---------------------------------------------------------------- matrix.json
def build_matrix(scenario: str = "base") -> dict:
    P = load_params()
    W = windows(P)
    d = data(scenario)
    pos = d["pos"]
    hist_end = P["time"]["history_end"]
    months24 = month_range(add_months(hist_end, -23), hist_end)
    cur, pri, m3, m3p = W["current"], W["prior"], W["momentum"], W["momentum_prior"]

    frames = {v: {"units": monthly_series(pos, v, "units"), "sgd": monthly_series(pos, v, "sgd")}
              for v in ("raw", "dedup")}

    def tot(df: pd.DataFrame, months: list[str], cols) -> float:
        return float(df.loc[months, cols].to_numpy().sum())

    delta = {}
    for c in COUNTRIES:
        for p in PRODUCTS:
            delta[(c, p)] = money(tot(frames["dedup"]["sgd"], cur, [(c, p)])) - money(tot(frames["raw"]["sgd"], cur, [(c, p)]))

    views = {}
    for v in ("raw", "dedup"):
        U, S = frames[v]["units"], frames[v]["sgd"]
        cells = []
        for c in COUNTRIES:
            for p in PRODUCTS:
                k = [(c, p)]
                s12, sp12 = tot(S, cur, k), tot(S, pri, k)
                u12, up12 = tot(U, cur, k), tot(U, pri, k)
                s3, sp3 = tot(S, m3, k), tot(S, m3p, k)
                u3, up3 = tot(U, m3, k), tot(U, m3p, k)
                cells.append({
                    "country": c, "product": p,
                    "sgd12m": money(s12), "sgdPrior12m": money(sp12), "yoy": yoy(s12, sp12),
                    "units12m": money(u12), "unitsPrior12m": money(up12), "unitsYoy": yoy(u12, up12),
                    "sgd3m": money(s3), "sgdPrior3m": money(sp3), "momentum": yoy(s3, sp3),
                    "momentumUnits": yoy(u3, up3),
                    "series": [{"month": m, "sgd": money(S.at[m, (c, p)]), "units": money(U.at[m, (c, p)])}
                               for m in months24],
                    "deltaVsRaw": delta[(c, p)] if v == "dedup" else 0,
                    "changedByCleaning": delta[(c, p)] != 0,
                })

        def total(key: str, cols, with_units: bool = False) -> dict:
            s12, sp12 = tot(S, cur, cols), tot(S, pri, cols)
            out = {"key": key, "sgd12m": money(s12), "sgdPrior12m": money(sp12), "yoy": yoy(s12, sp12),
                   "momentum": yoy(tot(S, m3, cols), tot(S, m3p, cols))}
            if with_units:
                out["units12m"] = money(tot(U, cur, cols))
            out["series"] = [{"month": m, "sgd": money(S.loc[m, cols].sum())} for m in months24]
            return out

        views[v] = {
            "cells": cells,
            "countryTotals": [total(c, [(c, p) for p in PRODUCTS]) for c in COUNTRIES],
            "productTotals": [total(p, [(c, p) for c in COUNTRIES], with_units=True) for p in PRODUCTS],
            "group": total("ALL", [(c, p) for c in COUNTRIES for p in PRODUCTS]),
        }

    g_raw, g_ded = views["raw"]["group"]["sgd12m"], views["dedup"]["group"]["sgd12m"]
    c12 = pos[pos["month"].isin(cur)]
    mis = c12.loc[c12["true_country"] != c12["recorded_country"], "sgd"].sum()
    cat = c12.loc[c12["true_product"] != c12["recorded_product"], "sgd"].sum()
    changed = [f"{x['country']}·{x['product']}" for x in views["dedup"]["cells"] if x["changedByCleaning"]]
    cleaning_note = (
        f"Merging duplicate customers alone does not change country × product totals: the group's 12-month PO value is "
        f"{fmt_sgd(g_ded)} in both views (raw {money(g_raw):,} vs de-duplicated {money(g_ded):,}). Only two things move "
        f"value between cells: misattribution ({fmt_sgd(mis)} of MY and VN hospitals' POs booked to SG-coded duplicate "
        f"records from Jan 2026) and miscategorisation ({fmt_sgd(cat)} of reagent test kits coded as Product B, mostly "
        f"in TH). Cells changed by cleaning carry a Δ badge: {', '.join(changed)}. {GOLDEN_NOTE}")
    return {
        "isMock": False,
        "window": _window(P),
        "months": months24,
        "growthFormula": GROWTH_FORMULA,
        "momentumFormula": MOMENTUM_FORMULA,
        "measureNote": MEASURE_NOTE,
        "views": views,
        "cleaningNote": cleaning_note,
    }


# ---------------------------------------------------------------- shared: customer values per view
def customer_values(scenario: str, view: str) -> pd.DataFrame:
    """One row per customer (raw: SAP record; dedup: golden ID) with country, prior/current 12M S$ and last PO month."""
    P = load_params()
    W = windows(P)
    pos = data(scenario)["pos"]
    key, cc = ("record_card_code", "recorded_country") if view == "raw" else ("golden_id", "true_country")
    g = pos.groupby([cc, key])
    df = pd.DataFrame({
        "cur": pos[pos["month"].isin(W["current"])].groupby([cc, key])["sgd"].sum(),
        "pri": pos[pos["month"].isin(W["prior"])].groupby([cc, key])["sgd"].sum(),
        "last_po": g["month"].max(),
        "first_po": g["month"].min(),
    }).fillna({"cur": 0.0, "pri": 0.0}).reset_index()
    df.columns = ["country", "id", "cur", "pri", "last_po", "first_po"]
    return df


def bridge_steps(cv: pd.DataFrame, window_label: str, prior_label: str) -> list[dict]:
    pri, cur = cv["pri"], cv["cur"]
    new = cv[(pri == 0) & (cur > 0)]
    lost = cv[(pri > 0) & (cur == 0)]
    both = cv[(pri > 0) & (cur > 0)]
    exp = both[both["cur"] >= both["pri"]]
    dec = both[both["cur"] < both["pri"]]
    s_prior = money(pri.sum())
    s_new = money(new["cur"].sum())
    s_exp = money((exp["cur"] - exp["pri"]).sum())
    s_dec = money((dec["cur"] - dec["pri"]).sum())
    s_lost = -money(lost["pri"].sum())
    s_cur = money(cur.sum())  # = matrix country total
    resid = s_cur - (s_prior + s_new + s_exp + s_dec + s_lost)  # whole-dollar rounding only
    assert abs(resid) <= 5, resid
    s_exp += resid  # prior + new + expanding + declining + lost = current, exactly
    return [
        {"key": "prior", "label": f"Prior 12M ({prior_label})", "sgd": s_prior, "customers": int((pri > 0).sum())},
        {"key": "new", "label": "New customers", "sgd": s_new, "customers": int(len(new))},
        {"key": "expanding", "label": "Expanding", "sgd": s_exp, "customers": int(len(exp))},
        {"key": "declining", "label": "Declining", "sgd": s_dec, "customers": int(len(dec))},
        {"key": "lost", "label": "Lost customers", "sgd": s_lost, "customers": int(len(lost))},
        {"key": "current", "label": f"Current 12M ({window_label})", "sgd": s_cur, "customers": int((cur > 0).sum())},
    ]


def _records_of(cr: pd.DataFrame, golden_id: str) -> list[dict]:
    r = cr[cr["golden_id"] == golden_id].sort_values("card_code")
    return [{"cardCode": x.card_code, "cardName": x.card_name, "entity": x.entity, "country": x.recorded_country}
            for x in r.itertuples()]


def hero_example(scenario: str, c: str) -> dict:
    """The planted key account of country c: raw = a 'lost' record + a 'new' record (+ a flat one in MY);
    de-duplicated = one top account shrinking ~30%."""
    d = data(scenario)
    h = d["plants"]["hero"][c]
    cv = customer_values(scenario, "dedup")
    cv = cv[cv["country"] == c].sort_values("cur", ascending=False).reset_index(drop=True)
    rank = int(cv.index[cv["id"] == h["golden_id"]][0]) + 1
    row = cv[cv["id"] == h["golden_id"]].iloc[0]
    y = yoy(row["cur"], row["pri"])
    parts = []
    for r in h["records"]:
        lp, fp = r["last_po_month"], r["first_po_month"]
        tag = f"{r['card_code']} “{r['card_name']}” ({r['entity']})"
        if lp < P_LAST_6M_START:
            parts.append(f"{tag} stops ordering after {_mon(lp)}, so it looks lost")
        elif fp >= load_params()["time"]["window_start"]:
            parts.append(f"{tag} first orders in {_mon(fp)}, so it looks like a new customer")
        else:
            parts.append(f"{tag} looks flat")
    n = len(h["records"])
    title = (f"A top-{rank} account is shrinking, hidden behind a 'new' customer" if rank <= 3
             else f"A key account is shrinking, hidden behind a 'new' customer")
    return {
        "country": c, "goldenId": h["golden_id"], "title": title,
        "records": _records_of(d["cr"], h["golden_id"]),
        "rawStory": "Raw SAP records: " + "; ".join(parts) + ".",
        "dedupStory": (f"De-duplicated: {n} records are one customer, {h['name']}, #{rank} in {COUNTRY_NAMES[c]} by "
                       f"12-month PO value ({fmt_sgd(row['cur'])}), down {abs(y) * 100:.0f}% year on year "
                       f"({fmt_sgd(row['pri'])} → {fmt_sgd(row['cur'])})."),
    }


P_LAST_6M_START = "2026-04"  # "lost" in the top-accounts list = no PO in Apr–Sep 2026


def _mon(m: str) -> str:
    return pd.Timestamp(m + "-01").strftime("%b %Y")


def raw_status(cur: float, pri: float, last_po: str) -> str:
    if pri == 0 and cur > 0:
        return "new"
    if last_po < P_LAST_6M_START:
        return "lost"
    y = cur / pri - 1
    if abs(y) < FLAT_BAND:
        return "flat"
    return "expanding" if y > 0 else "declining"


# ---------------------------------------------------------------- bridge.json
def build_bridge(scenario: str = "base", top_n: int = 10) -> dict:
    P = load_params()
    d = data(scenario)
    cr, gold = d["cr"], d["gold"]
    names_raw = cr.set_index("card_code")["card_name"].to_dict()
    gid_of = cr.set_index("card_code")["golden_id"].to_dict()
    names_gold = gold.set_index("golden_id")["canonical_name"].to_dict()
    n_records = cr.groupby("golden_id").size().to_dict()
    cv_raw, cv_ded = customer_values(scenario, "raw"), customer_values(scenario, "dedup")
    heroes = d["plants"]["hero"]
    out = []
    for c in COUNTRIES:
        r, g = cv_raw[cv_raw["country"] == c], cv_ded[cv_ded["country"] == c]
        hero_gid = heroes[c]["golden_id"]
        hero_codes = {x["card_code"] for x in heroes[c]["records"]}
        # top accounts, raw (+ the hero's records so the reveal is visible)
        rt = r.sort_values("cur", ascending=False)
        rt = pd.concat([rt.head(top_n), rt[rt["id"].isin(hero_codes) & ~rt["id"].isin(rt.head(top_n)["id"])]])
        rt = rt.sort_values("cur", ascending=False)
        top_raw = [{"cardCode": x.id, "name": names_raw[x.id], "goldenId": gid_of[x.id], "sgd12m": money(x.cur),
                    "sgdPrior12m": money(x.pri), "yoy": yoy(x.cur, x.pri),
                    "status": raw_status(x.cur, x.pri, x.last_po)} for x in rt.itertuples()]
        gt = g.sort_values("cur", ascending=False)
        gt = pd.concat([gt.head(top_n), gt[(gt["id"] == hero_gid) & ~gt["id"].isin(gt.head(top_n)["id"])]])
        top_ded = []
        for x in gt.itertuples():
            row = {"goldenId": x.id, "name": names_gold[x.id], "sgd12m": money(x.cur), "sgdPrior12m": money(x.pri),
                   "yoy": yoy(x.cur, x.pri), "records": int(n_records.get(x.id, 1))}
            if x.id == hero_gid:
                row["hero"] = True
            top_ded.append(row)
        out.append({
            "country": c,
            "raw": bridge_steps(r, "Oct 2025–Sep 2026", "Oct 2024–Sep 2025"),
            "dedup": bridge_steps(g, "Oct 2025–Sep 2026", "Oct 2024–Sep 2025"),
            "example": hero_example(scenario, c),
            "topAccounts": {"raw": top_raw, "dedup": top_ded},
        })
    return {
        "isMock": False,
        "window": _window(P),
        "definition": ("Prior 12M + new + expanding − declining − lost = current 12M (PO value, S$). New = no POs in the "
                       "prior 12 months; lost = no POs in the current 12 months; expanding/declining = ordered in both. "
                       "Customers are counted on the selected view: raw SAP records, or de-duplicated golden IDs. In the "
                       "top-accounts list, status describes the account today: new = first order inside the window, "
                       "lost = no order since Mar 2026, flat = within ±10% year on year. " + GOLDEN_NOTE),
        "countries": out,
    }


# ---------------------------------------------------------------- dedup.json
def build_dedup(scenario: str = "base") -> dict:
    P = load_params()
    W = windows(P)
    d = data(scenario)
    pos, cr, items, plants = d["pos"], d["cr"], d["items"], d["plants"]
    c12 = pos[pos["month"].isin(W["current"])]

    sizes = cr.groupby("golden_id").size()
    golden_country = cr.groupby("golden_id")["true_country"].first()
    customers = {
        "rawRecords": int(len(cr)),
        "goldenCustomers": int(cr["golden_id"].nunique()),
        "duplicateRecords": int(len(cr) - cr["golden_id"].nunique()),
        "duplicateRate": round((len(cr) - cr["golden_id"].nunique()) / len(cr), 4),
        "clustersOf2": int((sizes == 2).sum()),
        "clustersOf3Plus": int((sizes >= 3).sum()),
    }
    ded_country = c12.groupby("true_country")["sgd"].sum()
    by_country = []
    for c in COUNTRIES:
        gids = golden_country[golden_country == c].index
        n_gold = int(len(gids))
        n_true_recs = int(cr["golden_id"].isin(gids).sum())
        sin = c12.loc[(c12["recorded_country"] == c) & (c12["true_country"] != c), "sgd"].sum()
        sout = c12.loc[(c12["true_country"] == c) & (c12["recorded_country"] != c), "sgd"].sum()
        net = sout - sin
        by_country.append({
            "country": c,
            "rawRecords": int((cr["recorded_country"] == c).sum()),
            "goldenCustomers": n_gold,
            "duplicateRecords": n_true_recs - n_gold,
            "sgdMisattributedIn12m": money(sin),
            "sgdMisattributedOut12m": money(sout),
            "netCorrectionSgd12m": money(net),
            "pctOfCountry12m": round(float(net / ded_country.get(c, np.nan)), 4),
        })

    mis_rows = pos[pos["true_country"] != pos["recorded_country"]]
    mis_total = money(c12.loc[c12["true_country"] != c12["recorded_country"], "sgd"].sum())
    ma = plants["misattribution"]
    hosp = [h for cc in ("MY", "VN") for h in ma[cc]["hospitals"]]
    desc = (f"From {_mon(mis_rows['month'].min())}, {len(hosp)} SG-coded duplicate records (created by SG staff, blank tax "
            f"ID) captured POs of {len(ma['MY']['hospitals'])} Malaysian and {len(ma['VN']['hospitals'])} Vietnamese "
            f"hospitals: " + "; ".join(f"{h['sg_record']} “{_sg_name(cr, h['sg_record'])}” is really {h['name']} "
                                         f"({h['true_record']})" for h in hosp)
            + f". Raw SG gains a level of {fmt_sgd(mis_total)} over the 12 months; MY loses "
              f"{ma['MY']['share_of_country_12m'] * 100:.1f}% and VN {ma['VN']['share_of_country_12m'] * 100:.1f}% of "
              f"their 12-month value. This is the level shift the clean × method test detects.")

    mc = items[items["recorded_product"] != items["true_product"]]
    mc12 = c12[c12["true_product"] != c12["recorded_product"]]
    main_c = mc12.groupby("true_country")["sgd"].sum().idxmax()
    mcc = mc12[mc12["true_country"] == main_c]
    other = mc12[mc12["true_country"] != main_c].groupby("true_country")["sgd"].sum()
    miscat = {
        "country": main_c,
        "fromProduct": "A",
        "toProduct": "B",
        "units12m": money(mcc["units"].sum()),
        "sgd12m": money(mcc["sgd"].sum()),
        "items": [{"itemCode": x.item_code, "itemName": x.item_name, "recordedProduct": x.recorded_product,
                   "trueProduct": x.true_product, "recordedCategory": x.category, "trueCategory": x.true_category}
                  for x in mc.itertuples()],
    }

    examples = [
        _mis_example(cr, plants, "SG", "MY"),
        hero_example(scenario, "MY"),
        _plain_example(cr, plants["th_false_crosssell"][0], "TH", pos, W,
                       "A hospital that looks like two half-customers",
                       "Raw: {a} buys only Product A from SPD and {b} buys only Product C from QTS, so it looks "
                       "like an A-only and a C-only customer, each a cross-sell lead.",
                       "De-duplicated: one hospital, {name}, already buys A and C; the real gap is Product B "
                       "(lab consumables), which it buys from nobody in the group."),
        _mis_example(cr, plants, "VN", "VN"),
        _plain_example(cr, plants["mm_romanisation"][0], "MM", pos, W,
                       "Two spellings of one Myanmar hospital",
                       "Raw: {a}, {sa} over 12 months, and {b}, {sb}, are two separate customers on two entities.",
                       "De-duplicated: one hospital, {name}, worth {sgd} over 12 months across SPD and QTG; "
                       "Burmese names have no single romanisation, so spelling alone cannot find it."),
    ]
    note = (f"Merging duplicate customers alone does not change country × product totals. Only the misattributed "
            f"value (SG-coded records for MY/VN hospitals, from {_mon(mis_rows['month'].min())}: {fmt_sgd(mis_total)} "
            f"in the 12 months) and the miscategorised value (reagent test kits coded as Product B: "
            f"{fmt_sgd(mc12['sgd'].sum())}, of which {main_c} {fmt_sgd(mcc['sgd'].sum())}"
            + (", " + ", ".join(f"{k} {fmt_sgd(v)}" for k, v in other.items()) if len(other) else "")
            + ") move between cells. SG's raw record count includes the "
              f"{len(hosp)} SG-coded records that belong to MY/VN customers. Duplicates do change customer counts, account rankings and the growth bridge "
              "(a 'lost' plus a 'new' customer becomes one shrinking account). " + GOLDEN_NOTE)
    return {
        "isMock": False,
        "customers": customers,
        "byCountry": by_country,
        "misattribution": {"startedMonth": mis_rows["month"].min(), "totalSgdMoved12m": mis_total, "description": desc},
        "miscategorisation": miscat,
        "examples": examples,
        "note": note,
    }


def _sg_name(cr: pd.DataFrame, code: str) -> str:
    return cr.loc[cr["card_code"] == code, "card_name"].iloc[0]


def _mis_example(cr: pd.DataFrame, plants: dict, shown_in: str, source: str) -> dict:
    """Misattribution named example. shown_in='SG' tells it from SG's side (SG loses value when cleaned)."""
    ne = plants["misattribution"][source]["named_example"]
    sg = next(r for r in ne["records"] if r["card_code"] == ne["sg_record"])
    tr = next(r for r in ne["records"] if r["card_code"] == ne["true_record"])
    cname = COUNTRY_NAMES[source]
    adj = ADJ[source]
    if shown_in == "SG":
        title = f"An SG-coded customer is really a {adj} hospital"
        raw = (f"Raw: {sg['card_code']} “{sg['card_name']}” was created in SG on {sg['created_at']} with a blank tax "
               f"ID; from {_mon(sg['first_po_month'])} it books {fmt_sgd(ne['sgd_moved_12m'])} of POs a year to "
               f"Singapore, which looks like SG growth.")
        ded = (f"De-duplicated: it is {ne['name']} ({tr['card_code']}), a {adj} hospital. SG gives back "
               f"{fmt_sgd(ne['sgd_moved_12m'])}; {source} gets {ne['share_of_country_12m'] * 100:.1f}% of its 12-month "
               f"value back.")
    else:
        title = f"A {adj} hospital's orders were booked to Singapore"
        raw = (f"Raw: from {_mon(sg['first_po_month'])} most of {tr['card_name']}'s orders go to SG-coded "
               f"{sg['card_code']} “{sg['card_name']}”, so {tr['card_code']} looks like a declining {source} account "
               f"and {source} loses {fmt_sgd(ne['sgd_moved_12m'])} in the 12 months.")
        ded = (f"De-duplicated: one hospital, {ne['name']}, in {cname}. {source} gets back "
               f"{ne['share_of_country_12m'] * 100:.1f}% of its 12-month value; the romanised name and blank tax ID "
               f"are why a name match alone would miss it.")
    return {"country": shown_in, "goldenId": ne["golden_id"], "title": title,
            "records": _records_of(cr, ne["golden_id"]), "rawStory": raw, "dedupStory": ded}


def _plain_example(cr, plant: dict, c: str, pos, W, title: str, raw_t: str, ded_t: str) -> dict:
    recs = plant["records"]
    a = f"{recs[0]['card_code']} “{recs[0]['card_name']}” ({recs[0]['entity']})"
    b = f"{recs[1]['card_code']} “{recs[1]['card_name']}” ({recs[1]['entity']})"
    sa, sb = fmt_sgd(recs[0]["sgd_12m"]), fmt_sgd(recs[1]["sgd_12m"])
    sgd = pos.loc[(pos["golden_id"] == plant["golden_id"]) & pos["month"].isin(W["current"]), "sgd"].sum()
    return {"country": c, "goldenId": plant["golden_id"], "title": title, "records": _records_of(cr, plant["golden_id"]),
            "rawStory": raw_t.format(a=a, b=b, sa=sa, sb=sb), "dedupStory": ded_t.format(name=plant["name"], sgd=fmt_sgd(sgd))}


# ---------------------------------------------------------------- main
def main() -> None:
    m, b, dd = build_matrix("base"), build_bridge("base"), build_dedup("base")
    write_json(m, SRC_DATA / "matrix.json")
    write_json(b, SRC_DATA / "bridge.json")
    write_json(dd, SRC_DATA / "dedup.json")
    g = m["views"]["dedup"]["group"]
    print(f"group 12M {g['sgd12m']:,} YoY {g['yoy']} momentum {g['momentum']}")
    for t in m["views"]["dedup"]["countryTotals"]:
        print(f"  {t['key']} {t['sgd12m']:,} YoY {t['yoy']} momentum {t['momentum']}")
    for t in m["views"]["dedup"]["productTotals"]:
        print(f"  {t['key']} {t['sgd12m']:,} YoY {t['yoy']} momentum {t['momentum']}")
    print("changed cells:", [(x['country'], x['product'], x['deltaVsRaw']) for x in m['views']['dedup']['cells'] if x['changedByCleaning']])
    print("dedup:", dd["customers"])
    for c in dd["byCountry"]:
        print("  ", c)
    for c in b["countries"]:
        print(c["country"], "raw", [s["sgd"] for s in c["raw"]], "dedup", [s["sgd"] for s in c["dedup"]])


if __name__ == "__main__":
    main()
