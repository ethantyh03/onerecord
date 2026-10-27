"""Shared helpers for the OneRecord analytics pipeline.

Paths, parameters, country/product constants, month arithmetic and CSV/JSON IO, so every script
(generator, matcher, backtest, signals, business case) reads the same files the same way.

Import from a script inside analytics/:      from common import load_params, read_table
Import from the repo root:                   from analytics.common import load_params, read_table
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import yaml

# ---------------------------------------------------------------- paths
ANALYTICS = Path(__file__).resolve().parent
REPO = ANALYTICS.parent
PARAMS_PATH = ANALYTICS / "params.yaml"
OUT = ANALYTICS / "out"
SRC_DATA = REPO / "src" / "data"

# ---------------------------------------------------------------- constants (mirror src/lib/types.ts)
COUNTRIES = ["SG", "MY", "TH", "VN", "MM"]
COUNTRY_NAMES = {"SG": "Singapore", "MY": "Malaysia", "TH": "Thailand", "VN": "Vietnam", "MM": "Myanmar"}
FY_START_MONTH = {"SG": 4, "MY": 1, "TH": 10, "VN": 1, "MM": 4}
PRODUCTS = ["A", "B", "C"]
PRODUCT_LABELS = {
    "A": "Product A · IVD reagents & test kits",
    "B": "Product B · Lab consumables",
    "C": "Product C · Instruments & equipment",
}
ENTITIES = ["SPD", "QTS", "QTG"]
PRODUCT_ENTITY = {"A": "SPD", "B": "QTG", "C": "QTS"}
SEGMENTS = ["Public hospital", "Private hospital", "Diagnostic lab", "Clinic", "Research/academic", "Industry"]
TZ = "+08:00"

# CSV files the generator writes (analytics/SCHEMA.md)
TABLES = [
    "customers_records", "golden_customers", "items", "pos", "prs",
    "enquiries", "followups", "mdm_requests_hist", "dup_truth",
]
# columns that should be parsed as numbers / booleans when reading
_NUMERIC = {
    "pos": {"line_no": int, "units": int, "sgd": float},
    "prs": {"units": int, "sgd": float},
    "items": {"unit_price_sgd": float},
    "mdm_requests_hist": {"bounces": int, "cycle_days": float, "notice_days": float, "bounce_days": float,
                          "approval_days": float, "mdm_days": float, "approval_steps": int},
    "golden_customers": {},
    "customers_records": {},
}
_BOOL = {
    "customers_records": ["has_transactions"],
    "golden_customers": ["installed_c"],
    "mdm_requests_hist": ["was_duplicate"],
}


# ---------------------------------------------------------------- params
def load_params(path: Path | str = PARAMS_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def scenario_dir(scenario: str = "base") -> Path:
    """analytics/out/<scenario>/ — where generate.py writes that scenario's CSVs."""
    return OUT / scenario


# ---------------------------------------------------------------- months
def ym(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def add_months(month: str, k: int) -> str:
    y, m = int(month[:4]), int(month[5:7])
    t = y * 12 + (m - 1) + k
    return ym(t // 12, t % 12 + 1)


def month_range(start: str, end: str) -> list[str]:
    """Inclusive list of 'YYYY-MM' from start to end."""
    out, cur = [], start
    while cur <= end:
        out.append(cur)
        cur = add_months(cur, 1)
    return out


def months_between(a: str, b: str) -> int:
    """Number of months from a to b (b - a)."""
    return (int(b[:4]) * 12 + int(b[5:7])) - (int(a[:4]) * 12 + int(a[5:7]))


def windows(params: dict | None = None) -> dict:
    """The stated windows (DS decision 1) as month lists plus labels."""
    p = (params or load_params())["time"]
    return {
        "history": month_range(p["history_start"], p["history_end"]),
        "current": month_range(p["window_start"], p["window_end"]),
        "prior": month_range(p["prior_start"], p["prior_end"]),
        "momentum": month_range(p["momentum_start"], p["momentum_end"]),
        "momentum_prior": month_range(add_months(p["momentum_start"], -12), add_months(p["momentum_end"], -12)),
        "label": "Oct 2025 – Sep 2026",
    }


# ---------------------------------------------------------------- IO
def write_csv(df: pd.DataFrame, path: Path | str) -> None:
    """UTF-8, header, '\\n' line endings, empty string for missing, booleans as true/false."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    out = df.copy()
    for c in out.columns:
        if out[c].dtype == bool:
            out[c] = np.where(out[c], "true", "false")
    out.to_csv(path, index=False, encoding="utf-8", lineterminator="\n", na_rep="")


def write_json(obj, path: Path | str, indent: int | None = 1) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    def _default(o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            f = float(o)
            return None if math.isnan(f) else f
        if isinstance(o, (np.bool_,)):
            return bool(o)
        if isinstance(o, (pd.Timestamp,)):
            return o.isoformat()
        raise TypeError(f"not JSON serialisable: {type(o)}")

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent, default=_default)
        f.write("\n")


def read_json(path: Path | str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_csv(path: Path | str) -> pd.DataFrame:
    """Read a generator CSV as strings ('' for missing). Use read_table for typed columns."""
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8")


def read_table(name: str, scenario: str = "base", out_dir: Path | str | None = None) -> pd.DataFrame:
    """Read one generator table with numeric and boolean columns typed.

    name: one of TABLES (e.g. "pos"). scenario: base | nosignal | halfdengue.
    """
    d = Path(out_dir) if out_dir else scenario_dir(scenario)
    df = read_csv(d / f"{name}.csv")
    for col, typ in _NUMERIC.get(name, {}).items():
        if col in df.columns:
            s = pd.to_numeric(df[col].replace("", np.nan), errors="coerce")
            df[col] = s.astype("Int64") if typ is int else s.astype(float)
    for col in _BOOL.get(name, []):
        if col in df.columns:
            df[col] = df[col].str.lower().eq("true")
    return df


def load_all(scenario: str = "base", out_dir: Path | str | None = None) -> dict[str, pd.DataFrame]:
    return {t: read_table(t, scenario, out_dir) for t in TABLES}


# ---------------------------------------------------------------- common aggregations
def monthly_series(pos: pd.DataFrame, view: str = "dedup", measure: str = "units",
                   products: Iterable[str] = PRODUCTS, months: list[str] | None = None) -> pd.DataFrame:
    """Monthly PO totals per (country, product), as a wide frame indexed by month.

    view='dedup' -> true_country x true_product (golden IDs; DS decision 1 headline basis)
    view='raw'   -> recorded_country x recorded_product (what SAP shows today)
    measure: 'units' (within a product) or 'sgd' (across products).
    Missing months are filled with 0 so every series has the full history.
    """
    cc, pc = ("true_country", "true_product") if view == "dedup" else ("recorded_country", "recorded_product")
    df = pos[pos[pc].isin(list(products))]
    g = df.groupby(["month", cc, pc])[measure].sum().unstack([1, 2])
    if months is None:
        p = load_params()["time"]
        months = month_range(p["history_start"], p["history_end"])
    g = g.reindex(months).fillna(0)
    cols = pd.MultiIndex.from_product([COUNTRIES, list(products)], names=["country", "product"])
    return g.reindex(columns=cols, fill_value=0).fillna(0)


def window_value(pos: pd.DataFrame, months: list[str], view: str = "dedup", measure: str = "sgd") -> pd.DataFrame:
    """Total over a list of months per country x product (rows country, columns product)."""
    cc, pc = ("true_country", "true_product") if view == "dedup" else ("recorded_country", "recorded_product")
    df = pos[pos["month"].isin(months)]
    t = df.groupby([cc, pc])[measure].sum().unstack(pc)
    return t.reindex(index=COUNTRIES, columns=PRODUCTS).fillna(0)


def yoy(current: float, prior: float) -> float | None:
    return None if not prior else current / prior - 1
