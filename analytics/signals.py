"""Customer signals on golden IDs: drop-off risk and cross-sell gaps -> src/data/signals.json.

Everything is computed on merged customers (golden IDs, true country x true product), because a hospital that
buys through SPD, QTG and QTS on three SAP records is one customer. The same rules are also run on raw SAP
records to count what duplicates hide or invent (written to `rawViewCheck`, not shown as revenue).

Pre-registered rules (constants below; chosen before looking at which accounts they flag):

Drop-off risk, per golden customer x product (A, B; C is tender-driven and planned from the PR pipeline):
  - trend      = orders Apr-Sep 2026 / orders Apr-Sep 2025 - 1 (same six months a year earlier, so dengue
                 season, fiscal flushes and holidays do not masquerade as decline)
  - slope      = OLS slope of the last 12 months after dividing by the country x product seasonal index,
                 as % of the mean month (a confirmation, not the trigger)
  - recency    = days since the last PO at 30 Sep 2026 vs the median gap between order dates (24 months)
  - flagged if material (>= S$10k in Apr-Sep 2025) and still ordering (a PO in Apr-Sep 2026; accounts with no
    order at all are "lost" in the growth bridge, not "drop-off"), and
      (trend <= -25% and slope < 0)  or  (days since last PO > 1.5 x median gap and trend <= -10%)
  - S$ at risk = the customer's Oct 2025-Sep 2026 value in that product, BEFORE any save rate.

Cross-sell gaps, per golden customer x target product, on Oct 2025-Sep 2026 spend:
  - peers = customers in the same country and segment (fallback: same segment region-wide if < 4 peers).
  - expected = own spend on the anchor product x peers' median (target / anchor) ratio, capped at the peers'
    90th percentile of the target (scale-free, so a Myanmar hospital is not judged against a Singapore one).
  - B gap ("buys A from SPD but never B from QTG"): anchor A; flag if own B < 30% of expected and gap >= S$15k.
  - installed-base pull-through ("C installed, low A"; DS decision 10: a SIGNAL, never a forecast feature):
    anchor B among peers with our analyser installed; flag if own A < 50% of expected and gap >= S$15k.
  - S$ addressable = expected - own (the peer gap), a year, BEFORE conversion.

Assumed rates are team assumptions [T], shown next to every S$; the only citable benchmark in the research log
is a 25-30% tender win rate (one MY broker note, low confidence), so both rates sit at or below it.

Usage:  python analytics/signals.py [--scenario base] [--out src/data/signals.json]
"""
from __future__ import annotations

import argparse
from datetime import date

import numpy as np
import pandas as pd

from common import (COUNTRY_NAMES, SRC_DATA, add_months, load_all, load_params, month_range, windows,
                    write_json)

# ---------------------------------------------------------------- pre-registered parameters
DROP_SAVE_RATE = 0.25          # [T] share of flagged at-risk value a timely account call keeps
XSELL_CONVERSION = 0.15        # [T] share of the peer gap a targeted bundle offer converts in a year
DROP_MIN_PRIOR6 = 10_000       # S$ in Apr-Sep 2025: below this a swing is noise, not a signal
DROP_TREND = -0.25             # trend trigger
DROP_TREND_RECENCY = -0.10     # trend needed alongside an overdue reorder
DROP_RECENCY_MULT = 1.5        # overdue = days since last PO > 1.5 x median reorder gap
XSELL_LOW_SHARE = 0.30         # own spend < 30% of expected = gap
XSELL_INSTALLED_LOW_SHARE = 0.50
XSELL_MIN_GAP = 15_000         # S$ a year
MIN_PEERS = 4
AS_OF = "2026-09-30"           # last day of the stated window
PRODUCT_WORDS = {"A": "test kits (A)", "B": "lab consumables (B)", "C": "instruments (C)"}
ENTITY_OF = {"A": "SPD", "B": "QTG", "C": "QTS"}
SEGMENT_PLURAL = {
    "Public hospital": "public hospitals", "Private hospital": "private hospitals", "Diagnostic lab": "diagnostic labs",
    "Clinic": "clinics", "Research/academic": "research and academic labs", "Industry": "industrial labs",
}


def sgd_short(v: float) -> str:
    v = float(v)
    if abs(v) >= 1_000_000:
        return f"S${v / 1_000_000:.2f}M"
    if abs(v) >= 1_000:
        return f"S${v / 1_000:.0f}k"
    return f"S${v:.0f}"


def pct(v: float) -> str:
    return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v) * 100:.0f}%"


def month_label(m: str) -> str:
    return date(int(m[:4]), int(m[5:7]), 1).strftime("%b %Y")


# ---------------------------------------------------------------- inputs
def load_inputs(scenario: str) -> dict:
    d = load_all(scenario)
    pos = d["pos"].copy()
    pos["d"] = pd.to_datetime(pos["date"])
    d["pos"] = pos
    return d


def seasonal_index(pos: pd.DataFrame, country_col: str, product_col: str, hist: list[str]) -> dict:
    """Calendar-month index per (country, product): mean over fiscal years of month / that year's mean month."""
    g = pos.groupby(["month", country_col, product_col]).sgd.sum()
    idx = {}
    for (c, p), s in g.groupby(level=[1, 2]):
        s = s.droplevel([1, 2]).reindex(hist).fillna(0.0)
        vals = s.values.reshape(-1, 12)  # 3 years Oct..Sep
        means = vals.mean(axis=1, keepdims=True)
        means[means == 0] = 1.0
        ratio = (vals / means).mean(axis=0)
        ratio[ratio <= 0] = 1.0
        idx[(c, p)] = dict(zip([m[5:] for m in hist[:12]], ratio))
    return idx


def deseasonalised_slope(monthly: pd.Series, idx: dict) -> float:
    """OLS slope over the given months of value / seasonal index, as a share of the mean deseasonalised month."""
    y = np.array([v / idx.get(m[5:], 1.0) for m, v in monthly.items()], dtype=float)
    if y.mean() <= 0:
        return 0.0
    x = np.arange(len(y), dtype=float)
    slope = np.polyfit(x, y, 1)[0]
    return float(slope / y.mean())


# ---------------------------------------------------------------- drop-off
def drop_off_table(pos: pd.DataFrame, cust_col: str, country_col: str, product_col: str, W: dict) -> pd.DataFrame:
    hist = W["history"]
    t6 = month_range("2026-04", "2026-09")
    p6 = month_range("2025-04", "2025-09")
    last12 = W["current"]
    recency_window = month_range("2024-10", "2026-09")
    idx = seasonal_index(pos, country_col, product_col, hist)
    asof = pd.Timestamp(AS_OF)
    ab = pos[pos[product_col].isin(["A", "B"])]
    rows = []
    for (cid, country, prod), df in ab.groupby([cust_col, country_col, product_col]):
        prior6 = df.loc[df.month.isin(p6), "sgd"].sum()
        trail6 = df.loc[df.month.isin(t6), "sgd"].sum()
        cur12 = df.loc[df.month.isin(last12), "sgd"].sum()
        prior12 = df.loc[df.month.isin(W["prior"]), "sgd"].sum()
        monthly = df[df.month.isin(last12)].groupby("month").sgd.sum().reindex(last12).fillna(0.0)
        dates = np.sort(df.loc[df.month.isin(recency_window), "d"].unique())
        if len(dates) < 4:
            dates = np.sort(df["d"].unique())
        gaps = np.diff(dates).astype("timedelta64[D]").astype(int) if len(dates) > 1 else np.array([])
        med_gap = float(np.median(gaps)) if len(gaps) else np.nan
        if np.isnan(med_gap) and len(dates):
            med_gap = 365.0
        last = pd.Timestamp(df["d"].max())
        rows.append(dict(
            cid=cid, country=country, product=prod, prior6=prior6, trail6=trail6, cur12=cur12, prior12=prior12,
            trend=(trail6 / prior6 - 1) if prior6 > 0 else np.nan,
            slope=deseasonalised_slope(monthly, idx.get((country, prod), {})),
            med_gap=max(1.0, round(med_gap)), days_since=int((asof - last).days), n_orders=len(dates),
        ))
    t = pd.DataFrame(rows)
    material = (t.prior6 >= DROP_MIN_PRIOR6) & (t.trail6 > 0)
    by_trend = (t.trend <= DROP_TREND) & (t.slope < 0)
    overdue = t.days_since > DROP_RECENCY_MULT * t.med_gap
    by_recency = overdue & (t.trend <= DROP_TREND_RECENCY)
    t["overdue"] = overdue
    t["flag"] = material & (by_trend | by_recency)
    t["trigger"] = np.where(by_trend & by_recency, "trend+recency", np.where(by_trend, "trend", "recency"))
    return t


# ---------------------------------------------------------------- cross-sell
def _peers(s: pd.DataFrame, cid, mask: pd.Series) -> tuple[pd.DataFrame, str]:
    """Peers in the same country and segment (fallback: same segment region-wide if fewer than MIN_PEERS)."""
    row = s.loc[cid]
    base = (s.index != cid) & mask
    local = base & (s.country == row.country) & (s.segment == row.segment)
    seg = SEGMENT_PLURAL.get(row.segment, row.segment)
    if local.sum() >= MIN_PEERS:
        return s[local], f"{seg} in {COUNTRY_NAMES[row.country]}"
    return s[base & (s.segment == row.segment)], f"{seg} across the region"


def cross_sell_table(spend: pd.DataFrame, installed: pd.Series) -> pd.DataFrame:
    """Peer-gap cross-sell. spend: index customer, columns A/B/C (12M S$) + country + segment.

    Sizing is scale-free (peers' median ratio x the customer's own anchor spend), so a small Myanmar hospital is
    not compared with a large Singapore one; it is capped at the peers' 90th percentile of the target product so a
    minor anchor cannot extrapolate into an implausible gap.
      - B gap (task example "buys A from SPD but never B from QTG"): anchor A, ratio B/A, all peers buying A.
      - A gap, installed-base pull-through ("C installed, low A"): anchor B, ratio A/B, peers with our analyser.
    Product C is not a target: instruments are tender-driven and planned from the PR/tender pipeline.
    """
    s = spend.copy()
    s["installed"] = installed.reindex(s.index).astype("boolean").fillna(False).astype(bool)
    out = []
    rules = (
        # target, anchor, peer mask, low-share threshold, kind
        ("B", "A", lambda: s["A"] > 0, XSELL_LOW_SHARE, "portfolio"),
        ("A", "B", lambda: s.installed & (s["B"] > 0), XSELL_INSTALLED_LOW_SHARE, "installed"),
    )
    for target, anchor, mask_fn, low_share, kind in rules:
        mask = mask_fn()
        for cid, row in s.iterrows():
            if row[anchor] <= 0 or (kind == "installed" and not row.installed):
                continue
            peers, peer_label = _peers(s, cid, mask)
            if len(peers) < MIN_PEERS:
                continue
            ratio = float(np.median(peers[target] / peers[anchor]))
            cap = float(np.percentile(peers[target], 90))
            expected = min(row[anchor] * ratio, cap)
            gap = expected - row[target]
            if row[target] < low_share * expected and gap >= XSELL_MIN_GAP:
                out.append(dict(cid=cid, product=target, kind=kind, expected=expected, own=row[target], gap=gap,
                                ratio=ratio, capped=expected < row[anchor] * ratio, anchor=anchor,
                                own_anchor=row[anchor], peer_label=peer_label, n_peers=len(peers),
                                installed=kind == "installed"))
    return pd.DataFrame(out)


# ---------------------------------------------------------------- record splits (what duplicates hide)
def record_story(recs: pd.DataFrame, pos_g: pd.DataFrame, product: str) -> str:
    """Describe how one golden customer's orders in `product` are split across SAP records."""
    p = pos_g[pos_g.true_product == product]
    per = p.groupby("record_card_code").agg(first=("month", "min"), last=("month", "max"), sgd=("sgd", "sum"))
    if len(per) < 2:
        return ""
    lost = per[per["last"] <= "2026-03"]
    new = per[per["first"] >= "2025-10"]
    codes = ", ".join(per.index)
    if len(lost) and len(new):
        lo, nw = lost.index[0], new.index[0]
        return (f" In SAP these orders sit on {len(per)} records ({codes}): {lo} stopped after "
                f"{month_label(lost.loc[lo, 'last'])} and {nw} started in {month_label(new.loc[nw, 'first'])}, so raw "
                f"reports show a lost customer and a new one, not a decline.")
    if len(new):
        nw = new.index[0]
        return (f" Orders moved to a second SAP record ({nw}, from {month_label(new.loc[nw, 'first'])}); "
                f"each record on its own hides the fall.")
    return f" Orders are split across {len(per)} SAP records ({codes}); only the merged view shows the fall."


# ---------------------------------------------------------------- main build
def build(scenario: str = "base") -> dict:
    params = load_params()
    W = windows(params)
    d = load_inputs(scenario)
    pos, gold, recs = d["pos"], d["golden_customers"].set_index("golden_id"), d["customers_records"]
    items = d["items"]

    # ---- drop-off on golden IDs
    dt = drop_off_table(pos, "golden_id", "true_country", "true_product", W)
    flagged = dt[dt.flag].copy()
    flagged["sgdAddressable"] = flagged.cur12.round(0)
    flagged = flagged.sort_values("sgdAddressable", ascending=False)
    rec_count = recs.groupby("golden_id").card_code.nunique()

    drop_rows = []
    for _, r in flagged.iterrows():
        g = gold.loc[r.cid]
        pos_g = pos[pos.golden_id == r.cid]
        bits = [f"Orders of {PRODUCT_WORDS[r['product']]} Apr–Sep 2026 were {sgd_short(r.trail6)}, "
                f"{pct(r.trend)} on the same months of 2025"]
        if r.slope < -0.005:
            bits.append(f"and still falling about {abs(r.slope) * 100:.0f}% a month after removing seasonality")
        reason = " ".join(bits) + "."
        if r.overdue:
            reason += f" No order for {r.days_since} days against a usual {int(r.med_gap)}-day reorder gap."
        reason += record_story(recs, pos_g, r["product"])
        if "contract_q1_2027_my" in str(g.planted) and g.contract_end:
            reason += f" Its reagent-rental contract ends {month_label(g.contract_end)}."
        drop_rows.append(dict(
            goldenId=r.cid, name=g.canonical_name, country=r.country, entity=ENTITY_OF[r["product"]],
            product=r["product"], reason=reason, sgdAddressable=int(r.sgdAddressable),
            assumedConversion=DROP_SAVE_RATE,
            signalSource=("drop-off: Apr–Sep 2026 vs Apr–Sep 2025 (seasonally aligned) + deseasonalised slope"
                          + (" + overdue reorder" if r.overdue else "")),
            trailing6mSgd=int(round(r.trail6)), prior6mSgd=int(round(r.prior6)),
            daysSinceLastPo=int(r.days_since), medianReorderDays=int(r.med_gap),
            # extra (not in the TS contract; for the report): trend, slope and record count
            trend6m=round(float(r.trend), 4), slopePerMonth=round(float(r.slope), 4),
            sapRecords=int(rec_count.get(r.cid, 1)), trigger=r.trigger,
        ))

    # ---- cross-sell on golden IDs (12M spend, active customers only)
    cur = pos[pos.month.isin(W["current"])]
    spend = cur.groupby(["golden_id", "true_product"]).sgd.sum().unstack(fill_value=0.0)
    spend = spend.reindex(columns=["A", "B", "C"], fill_value=0.0)
    spend = spend[spend.sum(axis=1) > 0]
    spend = spend.join(gold[["country", "segment"]])
    installed_g = gold["installed_c"]
    xs = cross_sell_table(spend, installed_g)

    xsell_rows = []
    for _, r in xs.sort_values("gap", ascending=False).iterrows():
        g = gold.loc[r.cid]
        nrec = int(rec_count.get(r.cid, 1))
        sized = (f"capped at what the top tenth of peers spend, {sgd_short(r.expected)}" if r.capped
                 else f"that is {sgd_short(r.expected)}")
        own_txt = f"It buys {sgd_short(r.own)} from us." if r.own >= 1000 else "It buys none from us."
        if r.kind == "portfolio":
            reason = (f"Similar {r.peer_label} spend S${r.ratio:.2f} on {PRODUCT_WORDS[r['product']]} for every S$1 of "
                      f"{PRODUCT_WORDS[r.anchor]}; at its {sgd_short(r.own_anchor)} a year of {r.anchor}, {sized}. "
                      f"{own_txt}")
        else:
            opener = (f"Runs our analyser (QTS), yet buys only {sgd_short(r.own)} of test kits (A) a year."
                      if r.own >= 1000 else "Runs our analyser (QTS), yet buys no test kits (A) from us.")
            reason = (f"{opener} Similar {r.peer_label} with our analyser spend S${r.ratio:.1f} on kits per S$1 of "
                      f"consumables; at its {sgd_short(r.own_anchor)} of consumables, {sized}. The reagents are "
                      f"probably bought elsewhere.")
        last_a = pos.loc[(pos.golden_id == r.cid) & (pos.true_product == "A"), "month"].max()
        if (r.installed and g.contract_end and g.contract_end <= W["current"][-1] and isinstance(last_a, str)
                and last_a < add_months(W["current"][-1], -2)):
            reason += (f" Its reagent-rental contract ended {month_label(g.contract_end)} and kit orders stopped after "
                       f"{month_label(last_a)}: a win-back at the next tender, not a quick sale.")
        if "false_crosssell" in str(g.planted) or (nrec > 1 and r["product"] == "B"):
            per = pos[(pos.golden_id == r.cid) & pos.month.isin(W["current"])].groupby(
                ["record_card_code", "true_product"]).sgd.sum().unstack(fill_value=0)
            if len(per) > 1:
                desc = "; ".join(
                    f"{code} buys only {'+'.join(p for p in ['A', 'B', 'C'] if per.loc[code].get(p, 0) > 0) or 'nothing'}"
                    for code in per.index)
                reason += (f" Raw SAP shows {len(per)} records ({desc}), which suggests gaps in the products the other "
                           f"record already buys; merged, the only real gap is {r['product']}.")
        xsell_rows.append(dict(
            goldenId=r.cid, name=g.canonical_name, country=g.country, entity=ENTITY_OF[r["product"]],
            product=r["product"], reason=reason, sgdAddressable=int(round(r.gap)),
            assumedConversion=XSELL_CONVERSION,
            signalSource=("cross-sell: installed-base pull-through (C installed, low A)" if r.installed
                          else f"cross-sell: peer gap vs {r.n_peers} {r.peer_label}"),
            peerMedianSgd=int(round(r.expected)), installedBase=bool(r.installed),
            # extra (not in the TS contract)
            ownSgd12m=int(round(r.own)), peers=int(r.n_peers), sapRecords=nrec,
        ))

    # ---- raw-view check: the same rules on SAP records as recorded
    raw_dt = drop_off_table(pos, "record_card_code", "recorded_country", "recorded_product", W)
    raw_flag = raw_dt[raw_dt.flag]
    rec_to_g = recs.set_index("card_code").golden_id
    raw_flag_g = set(zip(raw_flag.cid.map(rec_to_g), raw_flag["product"]))
    gold_flag = set(zip(flagged.cid, flagged["product"]))
    raw_cur = cur.groupby(["record_card_code", "recorded_product"]).sgd.sum().unstack(fill_value=0.0)
    raw_cur = raw_cur.reindex(columns=["A", "B", "C"], fill_value=0.0)
    raw_cur = raw_cur[raw_cur.sum(axis=1) > 0].join(
        recs.set_index("card_code")[["recorded_country", "segment"]].rename(columns={"recorded_country": "country"}))
    analysers = set(items.loc[items.analyser.astype(str).str.lower() == "true", "item_code"])
    raw_installed = pd.Series(True, index=pos.loc[pos.item_code.isin(analysers), "record_card_code"].unique())
    raw_xs = cross_sell_table(raw_cur, raw_installed)
    raw_xs_g = set(zip(raw_xs.cid.map(rec_to_g), raw_xs["product"])) if len(raw_xs) else set()
    gold_xs = set(zip(xs.cid, xs["product"])) if len(xs) else set()
    raw_check = {
        "description": ("The same pre-registered rules run on raw SAP records (no merging). 'hidden' = flagged on "
                        "golden IDs but on no single record; 'false' = flagged on a record but not on the merged "
                        "customer."),
        "dropOff": {"flaggedGolden": len(gold_flag), "flaggedRawRecords": int(len(raw_flag)),
                    "hiddenByDuplicates": sorted(f"{g}·{p}" for g, p in gold_flag - raw_flag_g),
                    "falseOnRawRecords": sorted(f"{g}·{p}" for g, p in raw_flag_g - gold_flag)},
        "crossSell": {"flaggedGolden": len(gold_xs), "flaggedRawRecords": int(len(raw_xs)),
                      "hiddenByDuplicates": sorted(f"{g}·{p}" for g, p in gold_xs - raw_xs_g),
                      "falseOnRawRecords": sorted(f"{g}·{p}" for g, p in raw_xs_g - gold_xs)},
    }

    out = {
        "isMock": False,
        "scenario": scenario,
        "assumptions": {
            "dropOffSaveRate": DROP_SAVE_RATE,
            "crossSellConversion": XSELL_CONVERSION,
            "label": ("S$ shown are addressable, before conversion: drop-off = the account's last-12-month value "
                      "at risk, cross-sell = the yearly gap to similar customers. Multiply by the assumed rate for "
                      "an expected value. Rates are team assumptions, below the 25–30% tender win rate in our "
                      "research. Never summed into a revenue headline."),
        },
        "dropOff": drop_rows,
        "crossSell": xsell_rows,
        "totals": {
            "dropOffAddressableSgd": int(sum(r["sgdAddressable"] for r in drop_rows)),
            "crossSellAddressableSgd": int(sum(r["sgdAddressable"] for r in xsell_rows)),
        },
        "method": {
            "dropOff": ("Per merged customer x product (A, B). Trend = Apr–Sep 2026 vs Apr–Sep 2025; slope = OLS on "
                        "the last 12 months after removing the country x product seasonal index; recency = days "
                        "since last PO at 30 Sep 2026 vs the median gap between order dates. Flag if S$10k+ a year "
                        "earlier, still ordering, and (trend <= −25% with a falling slope) or (overdue by 1.5x the "
                        "usual gap with trend <= −10%). S$ at risk = last-12-month value."),
            "crossSell": ("Peer gap within country and segment (region-wide if fewer than 4 peers), sized to the "
                          "customer: expected = own spend on the anchor product x peers' median ratio, capped at the "
                          "peers' 90th percentile. B gap: anchor A, flag if B is below 30% of expected and the gap is "
                          "S$15k+. Installed-base pull-through (C installed, low A): anchor B among peers with our "
                          "analyser, flag if A is below 50% of expected and the gap is S$15k+. A signal only; never a "
                          "forecast feature (no leakage)."),
            "productC": "Product C (instruments) is tender-driven and planned from the PR/tender pipeline, not flagged here.",
        },
        "rawViewCheck": raw_check,
    }
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scenario", default="base")
    ap.add_argument("--out", default=str(SRC_DATA / "signals.json"))
    a = ap.parse_args(argv)
    out = build(a.scenario)
    write_json(out, a.out)
    t = out["totals"]
    print(f"signals.json: {len(out['dropOff'])} drop-off rows (S${t['dropOffAddressableSgd']:,} at risk before save), "
          f"{len(out['crossSell'])} cross-sell rows (S${t['crossSellAddressableSgd']:,} addressable before conversion)")
    rc = out["rawViewCheck"]
    print(f"raw-view check: drop-off hidden {len(rc['dropOff']['hiddenByDuplicates'])}, false "
          f"{len(rc['dropOff']['falseOnRawRecords'])}; cross-sell hidden {len(rc['crossSell']['hiddenByDuplicates'])}, "
          f"false {len(rc['crossSell']['falseOnRawRecords'])}")


if __name__ == "__main__":
    main()
