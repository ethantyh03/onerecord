"""Five country action cards for executives -> src/data/actions.json.

Each card = an implication sentence grounded in that country's own numbers (headline growth, 3-month momentum,
the account that merging duplicates reveals, and the top signals) -> 2-3 actions with an owner role, a date, the
S$ addressable BEFORE conversion (null when the action protects existing orders or fixes data) and the KPI to
watch next quarter.

Every number is computed here from the generator CSVs (merged-customer view, DS decision 1) or read from
src/data/signals.json and src/data/streams.json (run signals.py and streams.py first). If backtest.json has
been produced for real (isMock false), the SG card quotes its P90 band; otherwise it names the band without a
number. Growth = (Oct 2025–Sep 2026) ÷ (Oct 2024–Sep 2025) − 1; momentum = Jul–Sep 2026 ÷ Jul–Sep 2025 − 1.

Usage:  python analytics/actions.py [--scenario base] [--out src/data/actions.json]
"""
from __future__ import annotations

import argparse

import numpy as np
import pandas as pd

from common import COUNTRIES, COUNTRY_NAMES, SRC_DATA, load_all, read_json, windows, write_json

FY_END_QUARTER = {"SG": ["01", "02", "03"], "MM": ["01", "02", "03"], "MY": ["10", "11", "12"],
                  "VN": ["10", "11", "12"], "TH": ["07", "08", "09"]}


# ---------------------------------------------------------------- formatting
def sgd(v: float) -> str:
    v = float(v)
    if abs(v) >= 1_000_000:
        return f"S${v / 1_000_000:.1f}M" if abs(v) >= 10_000_000 else f"S${v / 1_000_000:.2f}M"
    if abs(v) >= 1_000:
        return f"S${v / 1_000:.0f}k"
    return f"S${v:.0f}"


def pct(v: float | None, signed: bool = True) -> str:
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return "n/a"
    s = f"{abs(v) * 100:.1f}%" if abs(v) < 0.1 else f"{abs(v) * 100:.0f}%"
    if not signed:
        return s
    return ("+" if v > 0 else "−" if v < 0 else "") + s


def yoy(c: float, p: float) -> float | None:
    return None if not p else c / p - 1


WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine"}


def word(n: int, capital: bool = False) -> str:
    w = WORDS.get(n, str(n))
    return w.capitalize() if capital else w


def join_and(xs: list[str]) -> str:
    xs = list(xs)
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def month_span(months: list[str]) -> str:
    a, b = min(months), max(months)
    fa, fb = pd.Timestamp(a + "-01"), pd.Timestamp(b + "-01")
    return fa.strftime("%b %Y") if a == b else f"{fa.strftime('%b')}–{fb.strftime('%b %Y')}"


# ---------------------------------------------------------------- facts per country
def country_facts(d: dict, W: dict) -> dict:
    pos, gold, items, prs, recs = d["pos"], d["golden_customers"].set_index("golden_id"), d["items"], d["prs"], d["customers_records"]
    cur, prior = W["current"], W["prior"]
    mom, mom_p = W["momentum"], W["momentum_prior"]
    pos = pos.join(items.set_index("item_code")[["item_group"]], on="item_code")

    def tot(df, months):
        return float(df.loc[df.month.isin(months), "sgd"].sum())

    F = {}
    for c in COUNTRIES:
        pc = pos[pos.true_country == c]
        f = {"value12": tot(pc, cur), "prior12": tot(pc, prior), "mom3": tot(pc, mom), "momp3": tot(pc, mom_p)}
        f["yoy"] = yoy(f["value12"], f["prior12"])
        f["momentum"] = yoy(f["mom3"], f["momp3"])
        f["product"] = {}
        for p in ("A", "B", "C"):
            pp = pc[pc.true_product == p]
            f["product"][p] = {"value12": tot(pp, cur), "yoy": yoy(tot(pp, cur), tot(pp, prior))}
        # raw (as recorded in SAP) vs merged country total: only misattribution moves value between countries
        raw = pos[pos.recorded_country == c]
        f["raw12"] = tot(raw, cur)
        f["rawGap"] = f["raw12"] - f["value12"]
        # the account merging reveals: biggest multi-record customer that is down >= 20% once merged
        win = pc[pc.month.isin(cur + prior)]
        nrec = win.groupby("golden_id").record_card_code.nunique()
        multi = nrec[nrec >= 2].index
        cand = []
        for gid in multi:
            gp = pc[pc.golden_id == gid]
            v, pv = tot(gp, cur), tot(gp, prior)
            if pv and v / pv - 1 <= -0.20:
                cand.append((v, gid, v / pv - 1))
        if cand:
            v, gid, y = max(cand)
            rank = int((pc[pc.month.isin(cur)].groupby("golden_id").sgd.sum() > v).sum()) + 1
            codes = sorted(win.loc[win.golden_id == gid, "record_card_code"].unique())
            f["hero"] = {"goldenId": gid, "name": gold.loc[gid, "canonical_name"], "value12": v, "yoy": y,
                         "rank": rank, "records": codes}
        # enquiry / PR facts
        f["contracts_q1_2027"] = [
            {"goldenId": gid, "name": r.canonical_name, "end": r.contract_end,
             "value12": tot(pc[pc.golden_id == gid], cur)}
            for gid, r in gold[(gold.country == c) & gold.contract_end.between("2027-01", "2027-03")].iterrows()]
        # contracts that ended inside the window and whose test-kit (A) orders then stopped = lost at expiry
        f["contracts_lost_window"] = []
        for gid, r in gold[(gold.country == c) & gold.contract_end.between(cur[0], cur[-1])].iterrows():
            ga = pc[(pc.golden_id == gid) & (pc.true_product == "A")]
            if len(ga) and ga.month.max() < "2026-07":
                f["contracts_lost_window"].append({
                    "goldenId": gid, "name": r.canonical_name, "end": r.contract_end,
                    "lostPerYear": tot(ga, prior) - tot(ga, cur)})
        # growth concentration: top-3 customer contributions to the country's change in value
        cg = pc[pc.month.isin(cur)].groupby("golden_id").sgd.sum()
        pg = pc[pc.month.isin(prior)].groupby("golden_id").sgd.sum()
        idx = cg.index.union(pg.index)
        delta = cg.reindex(idx).fillna(0) - pg.reindex(idx).fillna(0)
        top3 = delta.sort_values(ascending=False).head(3)
        f["growthDelta"] = float(delta.sum())
        f["top3"] = [{"goldenId": g, "name": gold.loc[g, "canonical_name"], "delta": float(v)} for g, v in top3.items()]
        # seasonality facts
        fyq = pc[(pc.true_product == "C") & pc.month.isin(cur)]
        f["cFyEndShare"] = float(fyq.loc[fyq.month.str[5:].isin(FY_END_QUARTER[c]), "sgd"].sum() / max(fyq.sgd.sum(), 1))
        a = pc[pc.true_product == "A"]
        den, oth = a[a.item_group == "dengue"], a[a.item_group != "dengue"]
        f["dengueYoy"] = yoy(tot(den, cur), tot(den, prior))
        f["otherAYoy"] = yoy(tot(oth, cur), tot(oth, prior))
        m = pc.groupby("month").sgd.sum()
        f["febDip"] = float(m.get("2026-02", 0) / ((m.get("2026-01", 0) + m.get("2026-03", 0)) / 2) - 1)
        # miscategorised A (recorded as B)
        mis = pc[(pc.true_product == "A") & (pc.recorded_product == "B") & pc.month.isin(cur)]
        f["miscatShareA"] = float(mis.sgd.sum() / max(f["product"]["A"]["value12"], 1))
        f["miscatItems"] = sorted(mis.item_code.unique())
        # PRs
        pr = prs[(prs.country == c)].assign(month=lambda x: x.created_at.str[:7])
        prw = pr[pr.month.isin(cur)]
        f["prLost12"] = float(prw.loc[prw.status == "lost", "sgd"].sum())
        f["prOpenC"] = float(pr.loc[(pr.status == "open") & (pr["product"] == "C"), "sgd"].sum())
        f["prOpenCCount"] = int(((pr.status == "open") & (pr["product"] == "C")).sum())
        F[c] = f
    # misattribution: SG-coded records that hold other countries' orders
    mis = pos[(pos.recorded_country != pos.true_country) & pos.month.isin(cur)]
    F["_misattrib"] = (mis.groupby(["record_card_code", "true_country"]).sgd.sum().reset_index()
                       .merge(recs[["card_code", "golden_id"]], left_on="record_card_code", right_on="card_code"))
    F["_misattrib"]["name"] = F["_misattrib"].golden_id.map(gold.canonical_name)
    pinned = prs[prs.blocked_by_request_id.eq("REQ-1042")]
    F["_req1042"] = {"prs": pinned[["pr_id", "customer_name", "sgd"]].to_dict("records"),
                     "sgd": float(pinned.sgd.sum()), "item": pinned.item_name.iloc[0] if len(pinned) else ""}
    return F


def p90_note(country: str = "SG", product: str = "A") -> tuple[str, str]:
    """(phrase for the action, KPI) from backtest.json if it is real; else a numberless phrase."""
    try:
        bt = read_json(SRC_DATA / "backtest.json")
    except FileNotFoundError:
        bt = {"isMock": True}
    if not bt.get("isMock", True):
        cell = next((c for c in bt.get("cells", []) if c["country"] == country and c["product"] == product), None)
        if cell and cell.get("next3"):
            p50 = sum(p["p50"] for p in cell["next3"])
            p90 = sum(p["p90"] for p in cell["next3"])
            return (f"the forecast's P90 band ({p90:,.0f} units for Oct–Dec vs a {p50:,.0f}-unit median)",
                    f"Forecast off by ≤{round(cell['oursWape'] * 100)} units per 100 ordered; 0 dengue stock-outs")
    return ("the forecast's P90 (upper) band rather than the 12-month average",
            "0 dengue-kit stock-outs in Oct–Dec; forecast error vs today's method")


# ---------------------------------------------------------------- cards
def build(scenario: str = "base") -> dict:
    W = windows()
    d = load_all(scenario)
    F = country_facts(d, W)
    sig = read_json(SRC_DATA / "signals.json")
    streams = {c["country"]: c for c in read_json(SRC_DATA / "streams.json")["countries"]}
    drop = pd.DataFrame(sig["dropOff"])
    xs = pd.DataFrame(sig["crossSell"])
    save, conv = sig["assumptions"]["dropOffSaveRate"], sig["assumptions"]["crossSellConversion"]

    def drop_sgd(gid: str) -> int:
        return int(drop.loc[drop.goldenId == gid, "sgdAddressable"].sum()) if len(drop) else 0

    def drop_row(gid: str, product: str = "A"):
        r = drop[(drop.goldenId == gid) & (drop["product"] == product)]
        return r.iloc[0] if len(r) else None

    mis = F["_misattrib"]
    cards = []

    # ---------------- SG
    f = F["SG"]
    h = f["hero"]
    sg_codes = sorted(mis.record_card_code.unique())
    moved = mis.groupby("true_country").sgd.sum()
    p90_phrase, p90_kpi = p90_note("SG", "A")
    hr = drop_row(h["goldenId"])
    cards.append({
        "country": "SG",
        "implication": (
            f"Singapore grew {pct(f['yoy'])} to {sgd(f['value12'])} ({pct(f['momentum'])} in Jul–Sep), but test kits are "
            f"flat ({pct(f['product']['A']['yoy'])}) because of a weak dengue season (dengue kits {pct(f['dengueYoy'])}, "
            f"other kits {pct(f['otherAYoy'])}), not lost customers. Raw SAP overstates Singapore by {sgd(f['rawGap'])} "
            f"({pct(f['rawGap'] / f['value12'], False)}): {word(len(sg_codes))} Singapore-coded billing records hold Malaysian "
            f"and Vietnamese hospitals' orders."),
        "signalSource": "matrix + backtest + dedup + signals.dropOff",
        "kpi": "Dengue-kit stock-outs in the Oct–Dec peak (target 0) and value booked to the wrong country (target S$0)",
        "actions": [
            {"ownerRole": "Supply planner, SPD Singapore",
             "action": (f"Set Oct–Dec test-kit safety stock at {p90_phrase}, so a late dengue upswing does not "
                        f"cause stock-outs; review again in January."),
             "byWhen": "2026-11-13", "sgdAddressable": None, "kpi": p90_kpi},
            {"ownerRole": "Key account manager, Singapore",
             "action": (f"Meet {h['name']}: merged, it is down {pct(h['yoy'], False)} on last year"
                        + (f" (test kits {pct(hr.trend6m)} in Apr–Sep)" if hr is not None else "")
                        + f" since its orders moved to a second record ({', '.join(h['records'][1:])}). "
                        f"Agree one account plan and ask MDM to merge the records."),
             "byWhen": "2026-11-20", "sgdAddressable": drop_sgd(h["goldenId"]) or None,
             "kpi": "Account back within −10% of last year by Mar 2027"},
            {"ownerRole": "MDM team",
             "action": (f"Re-code the {word(len(sg_codes))} SG billing records ({', '.join(sg_codes)}) to their Malaysian and "
                        f"Vietnamese customers, moving {sgd(moved.get('MY', 0))} back to Malaysia and "
                        f"{sgd(moved.get('VN', 0))} to Vietnam. Merging duplicates alone changes no country total; "
                        f"this re-coding does."),
             "byWhen": "2026-11-06", "sgdAddressable": None, "kpi": "Value booked to the wrong country = S$0"},
        ],
    })

    # ---------------- MY
    f = F["MY"]
    h = f["hero"]
    hr = drop_row(h["goldenId"])
    top3 = f["top3"]
    top3_sum = sum(t["delta"] for t in top3)
    ren = f["contracts_q1_2027"]
    ren_val = sum(r["value12"] for r in ren)
    lost = [x for x in f["contracts_lost_window"] if x["lostPerYear"] > 0]
    req = F["_req1042"]
    ren_names = join_and([r["name"] for r in ren])
    ren_month = month_span([r["end"] for r in ren]) if ren else ""
    slipping = [r["name"] for r in ren if drop_row(r["goldenId"]) is not None]
    cards.append({
        "country": "MY",
        "implication": (
            f"Malaysia grew {pct(f['yoy'])} to {sgd(f['value12'])} ({pct(f['momentum'])} in Jul–Sep), and three "
            f"customers delivered {pct(top3_sum / f['growthDelta'], False)} of the {sgd(f['growthDelta'])} increase. "
            f"Merged, {h['name']}, the #{h['rank']} account, is down {pct(h['yoy'], False)}; on raw SAP records it "
            f"looks like one lost customer and one new one. {word(len(ren), True)} reagent-rental contracts worth "
            f"{sgd(ren_val)} a year expire in {ren_month}."),
        "signalSource": "bridge + dedup + signals.dropOff + matrix",
        "kpi": f"{h['name']} quarterly value vs last year, and all {word(len(ren))} {ren_month} renewals signed",
        "actions": [
            {"ownerRole": "BU Head, SPD Malaysia",
             "action": (f"Call {h['name']} this month with one account plan across SPD and QTS. Its test-kit orders "
                        f"moved from {h['records'][0]} to a new record ({h['records'][-1]}) in April; Apr–Sep orders were "
                        f"{pct(-hr.trend6m, False) if hr is not None else ''} below the same months last year."),
             "byWhen": "2026-11-13", "sgdAddressable": drop_sgd(h["goldenId"]) or None,
             "kpi": "Test-kit orders back within −10% of last year by Q1 2027"},
            {"ownerRole": "Key account manager, Malaysia",
             "action": (f"Renewal plan for {ren_names} before their contracts expire in {ren_month}"
                        + (f"; {join_and(slipping)} is already ordering less" if slipping else "")
                        + (f". The {word(len(lost))} contracts lost at expiry earlier this year cost "
                           f"{sgd(sum(x['lostPerYear'] for x in lost))} of test kits a year." if lost else ".")),
             "byWhen": "2026-12-31", "sgdAddressable": int(round(ren_val)) or None,
             "kpi": f"All {word(len(ren))} contracts renewed before expiry"},
            {"ownerRole": "MDM team",
             "action": (f"Finish REQ-1042 ({req['item']}) so "
                        + " and ".join(f"{p['pr_id']} ({p['customer_name']}, {sgd(p['sgd'])})" for p in req["prs"])
                        + " can become orders. This is delayed revenue, not new revenue."),
             "byWhen": "2026-10-30", "sgdAddressable": int(round(req["sgd"])) or None,
             "kpi": "Stuck demand in Malaysia = S$0; item setups in ≤4 business days"},
        ],
    })

    # ---------------- TH
    f = F["TH"]
    h = f["hero"]
    th_x = xs[(xs.country == "TH") & (xs["product"] == "B")].sort_values("sgdAddressable", ascending=False)
    sri = th_x.iloc[0] if len(th_x) else None
    cards.append({
        "country": "TH",
        "implication": (
            f"Thailand grew {pct(f['yoy'])} to {sgd(f['value12'])} ({pct(f['momentum'])} in Jul–Sep). Instrument (C) "
            f"orders bunch up in Jul–Sep ({pct(f['cFyEndShare'], False)} of the year) because the Thai fiscal year ends "
            f"in September, so FY2027 tenders are won now. {pct(f['miscatShareA'], False)} of test-kit value is booked "
            f"as consumables through {word(len(f['miscatItems']))} duplicate item codes, and merged, {h['name']} is down "
            f"{pct(h['yoy'], False)}."),
        "signalSource": "matrix + signals.crossSell + dedup",
        "kpi": "FY2027 instrument tenders submitted by end-Dec vs last year",
        "actions": [
            {"ownerRole": "Sales manager, QTS Thailand",
             "action": (f"Line up FY2027 instrument tenders in Oct–Dec, while new budgets are released; start with the "
                        f"{word(f['prOpenCCount'])} open instrument requests worth {sgd(f['prOpenC'])}."),
             "byWhen": "2026-12-15", "sgdAddressable": int(round(f["prOpenC"])) or None,
             "kpi": "Tenders submitted and won vs FY2026"},
            {"ownerRole": "Account manager, QTG Thailand",
             "action": ((f"Offer {sri['name']} a consumables (B) bundle. Its SPD record buys only A and its QTS record "
                         f"only C, so SAP suggests gaps in both; merged, it already buys A and C and the real gap is B.")
                        if sri is not None else "Offer consumables bundles to hospitals buying A and C but not B."),
             "byWhen": "2026-11-30", "sgdAddressable": int(sri["sgdAddressable"]) if sri is not None else None,
             "kpi": "First consumables order by Q1 2027"},
            {"ownerRole": "MDM team",
             "action": (f"Retire the {word(len(f['miscatItems']))} duplicate item codes ({', '.join(f['miscatItems'])}) that "
                        f"book test kits as consumables and map them to their Product A codes, so A is not understated."),
             "byWhen": "2026-11-20", "sgdAddressable": None, "kpi": "Test-kit value booked under B = S$0"},
        ],
    })

    # ---------------- VN
    f = F["VN"]
    h = f["hero"]
    vn_b = xs[(xs.country == "VN") & (xs["product"] == "B") & (xs.signalSource.str.contains("public hospitals"))]
    vn_b = vn_b.sort_values("sgdAddressable", ascending=False)
    hr = drop_row(h["goldenId"])
    cards.append({
        "country": "VN",
        "implication": (
            f"Vietnam is the fastest-growing market, {pct(f['yoy'])} to {sgd(f['value12'])} (test kits "
            f"{pct(f['product']['A']['yoy'])}; {pct(f['momentum'])} in Jul–Sep). Yet {word(len(vn_b))} public hospitals buy "
            f"test kits but no consumables (B), and merged, {h['name']} is down {pct(h['yoy'], False)} after its "
            f"orders moved to an unaccented duplicate record. Expect the Tet dip: February orders were "
            f"{pct(-f['febDip'], False)} below January and March this year."),
        "signalSource": "matrix + signals.crossSell + signals.dropOff + dedup",
        "kpi": f"Consumables orders from the {word(len(vn_b))} hospitals, and no stock-outs after Tet",
        "actions": [
            {"ownerRole": "Account manager, QTG Vietnam",
             "action": (f"Offer a consumables (B) bundle to the {word(len(vn_b))} hospitals that buy test kits but never B: "
                        + join_and(list(vn_b.name)) + "."),
             "byWhen": "2026-12-11", "sgdAddressable": int(vn_b.sgdAddressable.sum()) or None,
             "kpi": f"At least two of the {word(len(vn_b))} placing B orders by Mar 2027"},
            {"ownerRole": "Key account manager, Vietnam",
             "action": (f"Visit {h['name']}: since its orders moved to {h['records'][-1]}, Apr–Sep test-kit orders were "
                        f"{pct(-hr.trend6m, False) if hr is not None else ''} below last year. Agree one account plan "
                        f"and merge the two records."),
             "byWhen": "2026-11-27", "sgdAddressable": drop_sgd(h["goldenId"]) or None,
             "kpi": "Account back within −10% of last year by Q1 2027"},
            {"ownerRole": "Supply planner, SPD Vietnam",
             "action": ("Build stock in early January for the Tet holiday (from 6 Feb 2027), when orders drop, and for the "
                        "restock that follows in March."),
             "byWhen": "2027-01-08", "sgdAddressable": None, "kpi": "0 stock-outs in Feb–Mar 2027"},
        ],
    })

    # ---------------- MM
    f = F["MM"]
    h = f["hero"]
    s = streams["MM"]
    others = [streams[c]["prToPoConversion"] for c in COUNTRIES if c != "MM"]
    mm_drop = drop[(drop.country == "MM") & (drop.goldenId != h["goldenId"])].sort_values("sgdAddressable", ascending=False)
    overdue = mm_drop[mm_drop.daysSinceLastPo > 1.5 * mm_drop.medianReorderDays].head(2)
    if len(overdue) < 2:
        overdue = mm_drop.head(2)
    cards.append({
        "country": "MM",
        "implication": (
            f"Myanmar is shrinking, {pct(f['yoy'])} to {sgd(f['value12'])} ({pct(f['momentum'])} in Jul–Sep), even "
            f"though enquiries are up {pct(s['enquiryYoy'], False)}: only {pct(s['prToPoConversion'], False)} of "
            f"purchase requests become orders against {min(others) * 100:.0f}–{max(others) * 100:.0f}% elsewhere, "
            f"so demand is lost between quote and order. Merged, {h['name']} is down {pct(h['yoy'], False)}."),
        "signalSource": "streams + signals.dropOff + dedup",
        "kpi": f"Purchase-request-to-order conversion, from {pct(s['prToPoConversion'], False)} towards 55% by Mar 2027",
        "actions": [
            {"ownerRole": "Country lead, Myanmar",
             "action": (f"Review why requests are lost: quote turnaround, pricing and stock for the {sgd(f['prLost12'])} "
                        f"of purchase requests lost in the last 12 months; answer every enquiry within 1 business day."),
             "byWhen": "2026-11-20", "sgdAddressable": int(round(f["prLost12"])) or None,
             "kpi": "Conversion up 10 points by Q1 2027"},
            {"ownerRole": "Key account manager, Myanmar",
             "action": (f"Win back {h['name']}: its orders moved to a misspelt second record ({h['records'][-1]}) and "
                        f"fell {pct(h['yoy'], False)}. Agree an account plan and merge the records."),
             "byWhen": "2026-11-27", "sgdAddressable": drop_sgd(h["goldenId"]) or None,
             "kpi": "Account back within −10% of last year by Q1 2027"},
            {"ownerRole": "Sales representative, Myanmar",
             "action": ("Call " + join_and(list(overdue.name)) + ": both are ordering less than a year ago and are "
                        "overdue on their usual reorder."),
             "byWhen": "2026-11-13", "sgdAddressable": int(overdue.sgdAddressable.sum()) or None,
             "kpi": "Both reordering within their usual interval"},
        ],
    })

    xcheck = sig.get("rawViewCheck", {}).get("dropOff", {})
    note = (f"S$ addressable is before conversion: drop-off S$ is the account's last-12-month value at risk "
            f"(assumed save rate {save:.0%}); cross-sell S$ is the yearly gap to similar customers (assumed conversion "
            f"{conv:.0%}); blocked requests are delayed, not new, revenue. Never summed into a revenue headline. "
            f"Signals run on merged customers: on raw SAP records the same rules would miss "
            f"{len(xcheck.get('hiddenByDuplicates', []))} real drop-offs and raise "
            f"{len(xcheck.get('falseOnRawRecords', []))} false alarms.")
    return {"isMock": False, "scenario": scenario, "note": note, "cards": cards}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scenario", default="base")
    ap.add_argument("--out", default=str(SRC_DATA / "actions.json"))
    a = ap.parse_args(argv)
    out = build(a.scenario)
    write_json(out, a.out)
    for c in out["cards"]:
        print(f"[{c['country']}] {c['implication']}")
        for x in c["actions"]:
            amt = f"S${x['sgdAddressable']:,}" if x["sgdAddressable"] else "—"
            print(f"   - {x['ownerRole']} by {x['byWhen']} ({amt}): {x['action']}")


if __name__ == "__main__":
    main()
