"""Entity resolution for OneRecord: blocking -> pair scoring -> threshold tuned on SG+MY -> clusters (golden IDs).

Outputs
- analytics/out/<scenario>/crosswalk.csv   one row per SAP customer record -> predicted golden ID (+ evidence)
- src/data/matcher_eval.json               held-out evaluation (contract: MatcherEval)       [base only]
- src/data/master.json                     customers (goldenId from this crosswalk) + items  [base only]
- analytics/matcher_fixture.json           25-pair TS/Python parity fixture                  [base only]

Honesty rules (DS decision 5)
- The scorer below is a line-by-line port of src/lib/engine/dedupe.ts (same normaliser, same Jaro-Winkler, same
  token-set ratio, same distinctive-word guard, same +0.03 boosts and 0.97 tax-ID floor). Nothing in it was
  written for the generator's perturbations: typos, word reorder, Thai/Vietnamese romanisation, blank tax IDs and
  address formats are NOT mirrored in the normaliser. src/lib/engine/__tests__/parity.test.ts checks the port.
- Model choices (blocking design, threshold) are made on SG+MY only. TH/VN/MM are scored once, at the frozen
  threshold. Ground truth (golden_id / true_country / dup_truth.csv) is read only for scoring and, after the
  clusters are fixed, to give each predicted cluster a display label in the generator's G-XX-NNNN namespace.

Run:  PYTHONIOENCODING=utf-8 python analytics/resolve.py [--scenario base|nosignal|halfdengue]
"""
from __future__ import annotations

import argparse
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ANALYTICS, SRC_DATA, read_csv, scenario_dir, write_csv, write_json  # noqa: E402

TUNE = ["SG", "MY"]
HOLDOUT = ["TH", "VN", "MM"]

# =====================================================================================================
# 1. Port of src/lib/engine/dedupe.ts  (keep in lock-step; parity.test.ts runs the TS side on the fixture)
# =====================================================================================================

EXPANSIONS = {
    "hosp": "hospital", "hosps": "hospitals", "hospl": "hospital", "natl": "national", "univ": "university",
    "uni": "university", "gen": "general", "genl": "general", "med": "medical", "ctr": "centre", "cntr": "centre",
    "center": "centre", "centers": "centres", "intl": "international", "dept": "department", "mt": "mount",
    "lab": "laboratory", "labs": "laboratories", "diag": "diagnostic", "spec": "specialist",
    "kl": "kuala lumpur", "jb": "johor bahru", "hcmc": "ho chi minh city",
}
LEGAL_ANYWHERE = {"pte", "ltd", "sdn", "bhd", "berhad", "plc", "inc", "jsc", "llc", "tnhh", "pcl", "limited", "corp"}
LEGAL_TRAILING = {"co", "company", "corporation", "public", "private", "incorporated"}
GENERIC = {
    "the", "of", "and", "hospital", "hospitals", "clinic", "clinics", "polyclinic", "medical", "centre", "centres",
    "laboratory", "laboratories", "general", "specialist", "specialists", "health", "healthcare", "diagnostic",
    "diagnostics", "klinik", "makmal", "benh", "vien",
}

_COMBINING = re.compile("[̀-ͯ]")
_NATL = re.compile(r"\bnat['’`]l\b", re.ASCII)
_INTL = re.compile(r"\bint['’`]l\b", re.ASCII)
_SPORE = re.compile(r"\bs['’`]pore\b", re.ASCII)
_QUOTES = re.compile("['’`]")
_NON_ALNUM = re.compile(r"[^a-z0-9\s]+")


def _cap(w: str) -> str:
    return w[:1].upper() + w[1:]


def strip_diacritics(s: str) -> str:
    return _COMBINING.sub("", unicodedata.normalize("NFKD", s))


def normalize_detailed(raw) -> tuple[str, list[str]]:
    s = strip_diacritics(str(raw if raw is not None else "")).lower()
    s = _NATL.sub("natl", s)
    s = _INTL.sub("intl", s)
    s = _SPORE.sub("singapore", s)
    s = _QUOTES.sub("", s).replace("&", " and ")
    s = _NON_ALNUM.sub(" ", s)
    tokens = s.split()
    # Vietnamese "Cong ty" (company) prefix
    if len(tokens) >= 2 and tokens[0] == "cong" and tokens[1] == "ty":
        tokens = tokens[2:]
    elif tokens and tokens[0] == "cty":
        tokens = tokens[1:]
    tokens = [t for t in tokens if t not in LEGAL_ANYWHERE]
    while len(tokens) > 1 and tokens[-1] in LEGAL_TRAILING:
        tokens.pop()
    if len(tokens) == 1 and tokens[0] in LEGAL_TRAILING:
        tokens = []
    expansions, out = [], []
    for i, t in enumerate(tokens):
        x = EXPANSIONS.get(t)
        if t == "st" and i == 0:
            x = "saint"
        if x and x != t:
            expansions.append(f"{_cap(t)} → {' '.join(_cap(w) for w in x.split(' '))}")
            out.extend(x.split(" "))
        else:
            out.append(t)
    return " ".join(out), expansions


def normalize_name(s) -> str:
    return normalize_detailed(s)[0]


def jaro_winkler(a: str, b: str) -> float:
    if a == b:
        return 1.0 if len(a) else 0.0
    l1, l2 = len(a), len(b)
    if not l1 or not l2:
        return 0.0
    window = max(0, max(l1, l2) // 2 - 1)
    m1, m2 = [False] * l1, [False] * l2
    matches = 0
    for i in range(l1):
        lo, hi = max(0, i - window), min(l2, i + window + 1)
        for j in range(lo, hi):
            if not m2[j] and a[i] == b[j]:
                m1[i] = m2[j] = True
                matches += 1
                break
    if not matches:
        return 0.0
    transpositions, k = 0, 0
    for i in range(l1):
        if not m1[i]:
            continue
        while not m2[k]:
            k += 1
        if a[i] != b[k]:
            transpositions += 1
        k += 1
    jaro = (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3
    if jaro <= 0.7:
        return jaro
    prefix = 0
    while prefix < min(4, l1, l2) and a[prefix] == b[prefix]:
        prefix += 1
    return jaro + prefix * 0.1 * (1 - jaro)


def _lcs_length(a: str, b: str) -> int:
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            cur[j] = prev[j - 1] + 1 if ai == b[j - 1] else max(prev[j], cur[j - 1])
        prev = cur
    return prev[len(b)]


def _ratio(a: str, b: str) -> float:
    total = len(a) + len(b)
    if not total:
        return 1.0
    return (2 * _lcs_length(a, b)) / total


def token_set_ratio(a: str, b: str) -> float:
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    inter = sorted(t for t in ta if t in tb)
    diff_a = sorted(t for t in ta if t not in tb)
    diff_b = sorted(t for t in tb if t not in ta)
    if inter and (not diff_a or not diff_b):
        return 1.0
    sect = " ".join(inter)
    comb_a = " ".join(x for x in [sect, " ".join(diff_a)] if x)
    comb_b = " ".join(x for x in [sect, " ".join(diff_b)] if x)
    scores = [_ratio(comb_a, comb_b)]
    if sect:
        scores += [_ratio(sect, comb_a), _ratio(sect, comb_b)]
    return max(scores)


TOKEN_MATCH_MIN = 0.88
GENERIC_ONLY_CAP = 0.5


def _coverage(frm: list[str], to: list[str]) -> float:
    total, hit = 0, 0.0
    for t in frm:
        best = 0.0
        for u in to:
            best = max(best, 1.0 if t == u else jaro_winkler(t, u))
        total += len(t)
        if best >= TOKEN_MATCH_MIN:
            hit += len(t) * best
    return hit / total if total else 0.0


def name_similarity_normalized(na: str, nb: str) -> float:
    if not na or not nb:
        return 0.0
    ta, tb = na.split(" "), nb.split(" ")
    da = [t for t in ta if t not in GENERIC]
    db = [t for t in tb if t not in GENERIC]
    chars = max(jaro_winkler(na, nb), token_set_ratio(na, nb))
    if not da or not db:
        return min(chars, GENERIC_ONLY_CAP)
    if na == nb:
        return 1.0
    distinctive = (_coverage(da, db) + _coverage(db, da)) / 2
    return min(chars, distinctive)


def name_similarity(a: str, b: str) -> float:
    return name_similarity_normalized(normalize_name(a), normalize_name(b))


_INITIALS_RE = re.compile(r"^[a-z]{3,6}$")


def _initials_match(input_norm: str, rec_norm: str) -> bool:
    if not _INITIALS_RE.match(input_norm):
        return False
    initials = "".join(t[0] for t in rec_norm.split(" ") if t not in ("the", "of", "and") and t)
    return initials == input_norm


FREE_MAIL = {"gmail.com", "yahoo.com", "yahoo.com.sg", "yahoo.com.my", "hotmail.com", "outlook.com", "live.com",
             "icloud.com", "singnet.com.sg", "streamyx.com"}
_NOT_TAX = re.compile(r"[^A-Z0-9]")
_NOT_DIGIT = re.compile(r"\D", re.ASCII)
_EMAIL_DOMAIN = re.compile(r"@([^\s@>]+)\s*$")
SIGNAL_BONUS = 0.03
TAX_ID_FLOOR = 0.97
INITIALS_SCORE = 0.88


def norm_tax(s) -> str:
    return _NOT_TAX.sub("", (s or "").upper())


def _digits(s) -> str:
    return _NOT_DIGIT.sub("", s or "")


def email_domain(s) -> str:
    m = _EMAIL_DOMAIN.search((s or "").strip().lower())
    return m.group(1) if m else ""


def _js_round(x: float) -> int:
    return math.floor(x + 0.5)


def round3(n: float) -> float:
    return math.floor(n * 1000 + 0.5) / 1000


def score_pair(inp: dict, rec: dict) -> tuple[float, list[str], float]:
    """Port of scorePair(input: DupInput, rec: CustomerMaster). Returns (score, reasons, name_score)."""
    in_norm, in_exp = normalize_detailed(inp.get("name") or "")
    rec_norm = normalize_name(rec.get("cardName") or "")
    reasons: list[str] = []
    name = name_similarity_normalized(in_norm, rec_norm)
    if name >= 0.6:
        pct = _js_round(name * 100)
        via = pct == 100 and len(in_exp) > 0 and (inp.get("name") or "").strip().lower() != (rec.get("cardName") or "").strip().lower()
        reasons.append(f"100% name match after expanding {', '.join(in_exp)}" if via else f"{pct}% name match")
    if _initials_match(in_norm, rec_norm) and name < INITIALS_SCORE:
        name = INITIALS_SCORE
        reasons.append(f"Initials match ({(inp.get('name') or '').strip().upper()} = {rec.get('cardName')})")
    score = name
    tax = norm_tax(inp.get("taxId"))
    if len(tax) >= 5 and tax == norm_tax(rec.get("licTradNum")):
        score = max(score, TAX_ID_FLOOR)
        reasons.insert(0, "Same tax ID")
    zp = _digits(inp.get("zipCode"))
    if len(zp) >= 4 and zp == _digits(rec.get("zipCode")):
        score += SIGNAL_BONUS
        reasons.append("Same postcode")
    p1, p2 = _digits(inp.get("phone")), _digits(rec.get("phone1"))
    if len(p1) >= 7 and len(p2) >= 7 and p1[-8:] == p2[-8:]:
        score += SIGNAL_BONUS
        reasons.append("Same phone number")
    d1 = email_domain(inp.get("email"))
    if d1 and d1 not in FREE_MAIL and d1 == email_domain(rec.get("email")):
        score += SIGNAL_BONUS
        reasons.append(f"Same email domain ({d1})")
    return round3(min(1.0, score)), reasons, name


# =====================================================================================================
# 2. Records, blocking
# =====================================================================================================

def as_input(r: dict) -> dict:
    """A customers_records row as the TS DupInput (the newer record plays 'input')."""
    return {"name": r["card_name"], "country": r["recorded_country"], "taxId": r["lic_trad_num"],
            "zipCode": r["zip_code"], "phone": r["phone1"], "email": r["email"]}


def as_master(r: dict, golden_id: str = "") -> dict:
    """A customers_records row as the TS CustomerMaster (blank optional fields omitted)."""
    m = {"cardCode": r["card_code"], "cardName": r["card_name"], "entity": r["entity"], "country": r["recorded_country"]}
    for k_out, k_in in [("licTradNum", "lic_trad_num"), ("street", "street"), ("zipCode", "zip_code"),
                        ("phone1", "phone1"), ("email", "email")]:
        if r.get(k_in):
            m[k_out] = r[k_in]
    m["goldenId"] = golden_id
    m["segment"] = r["segment"]
    m["hasTransactions"] = str(r["has_transactions"]).lower() == "true"
    return m


_SOUNDEX = {**dict.fromkeys("bfpv", "1"), **dict.fromkeys("cgjkqsxz", "2"), **dict.fromkeys("dt", "3"),
            "l": "4", **dict.fromkeys("mn", "5"), "r": "6"}


def soundex(token: str) -> str:
    """American Soundex (standard; nothing tuned to the data). Digit-only tokens key on themselves."""
    t = re.sub(r"[^a-z]", "", token)
    if not t:
        return token
    out, prev = [], _SOUNDEX.get(t[0], "")
    for ch in t[1:]:
        code = _SOUNDEX.get(ch, "")
        if code and code != prev:
            out.append(code)
        if ch not in "hw":
            prev = code
    return (t[0].upper() + "".join(out) + "000")[:4]


def significant_tokens(norm: str) -> list[str]:
    """Distinctive name words for blocking: not a generic facility/filler word (same GENERIC list as the TS
    scorer) and at least 3 letters; falls back to any non-generic word."""
    toks = [t for t in norm.split(" ") if t and t not in GENERIC]
    long = [t for t in toks if len(t) >= 3]
    return long or toks


DIAL_CODES = {"65": "SG", "60": "MY", "66": "TH", "84": "VN", "95": "MM"}


def phone_country(phone: str) -> str:
    """Country implied by an international dialling code (+65 SG, +60 MY, +66 TH, +84 VN, +95 MM)."""
    p = (phone or "").strip()
    if not p.startswith("+"):
        return ""
    d = _digits(p)
    return DIAL_CODES.get(d[:2], "")


def block_keys(r: dict, mode: str) -> set[tuple]:
    """mode: 'first'   = recorded country + Soundex(first significant word)
             'token'   = recorded country + Soundex(any significant word)
             'token+cc'= 'token', and a record whose phone dialling code points to another country is ALSO
                         blocked under that country (country-consistency check)
       All modes add exact tax ID across countries."""
    norm = normalize_name(r["card_name"])
    sig = significant_tokens(norm)
    countries = {r["recorded_country"]}
    if mode == "token+cc":
        pc = phone_country(r["phone1"])
        if pc:
            countries.add(pc)
    words = sig[:1] if mode == "first" else sig
    keys = {("name", c, soundex(t)) for c in countries for t in words}
    tax = norm_tax(r["lic_trad_num"])
    if len(tax) >= 5:
        keys.add(("tax", tax))
    return keys


def candidate_pairs(recs: list[dict], mode: str) -> set[tuple[str, str]]:
    index: dict[tuple, list[str]] = defaultdict(list)
    for r in recs:
        for k in block_keys(r, mode):
            index[k].append(r["card_code"])
    pairs = set()
    for codes in index.values():
        for a, b in combinations(sorted(set(codes)), 2):
            pairs.add((a, b))
    return pairs


def pair_score(ra: dict, rb: dict) -> tuple[float, list[str], float]:
    """Score an existing-record pair the way the live check would: the newer record is the 'input', the
    older one the master record (ties broken by card code)."""
    older, newer = sorted([ra, rb], key=lambda r: (r["created_at"] or "9999", r["card_code"]))
    return score_pair(as_input(newer), as_master(older))


# =====================================================================================================
# 3. Clustering + evaluation
# =====================================================================================================

def clusters_at(codes: list[str], scored: dict[tuple[str, str], float], threshold: float) -> dict[str, str]:
    """Union-find over pairs scoring >= threshold. Returns card_code -> root card_code."""
    parent = {c: c for c in codes}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for (a, b), s in scored.items():
        if s >= threshold:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[max(ra, rb)] = min(ra, rb)
    return {c: find(c) for c in codes}


def predicted_pairs(root: dict[str, str]) -> set[tuple[str, str]]:
    groups = defaultdict(list)
    for c, r in root.items():
        groups[r].append(c)
    out = set()
    for members in groups.values():
        for a, b in combinations(sorted(members), 2):
            out.add((a, b))
    return out


def prf(pred: set, truth: set) -> dict:
    tp, fp, fn = len(pred & truth), len(pred - truth), len(truth - pred)
    p = tp / (tp + fp) if tp + fp else 1.0
    r = tp / (tp + fn) if tp + fn else 1.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f1, 3), "tp": tp, "fp": fp, "fn": fn}


# =====================================================================================================
# 4. Explanations for the "what we missed, and why" examples (text only; never used for scoring)
# =====================================================================================================

# Words a human reads as the same thing across languages. Used ONLY to explain a miss in plain words.
TRANSLATION_HINTS = {
    ("quoc", "te"): "International", ("a", "khoa"): "General", ("xn",): "Laboratory (xét nghiệm)",
    ("phong", "kham"): "Clinic", ("institut",): "Institute", ("penyelidikan",): "Research",
}

PERTURBATION_LABELS = {
    "abbreviation": "Abbreviations (Hosp, Med Ctr, S/B)",
    "typo": "Typos",
    "word_reorder": "Word reorder",
    "romanisation": "Thai/Vietnamese/Burmese romanisation variants",
    "blank_tax_id": "Blank tax ID on the duplicate",
    "address_format": "Different address format",
    "cross_entity": "Created by another entity (SPD/QTS/QTG)",
    "misattributed_country": "Booked under the wrong country",
}


def explain(ra: dict, rb: dict, score: float, reasons: list[str], name: float, threshold: float, kind: str,
            compared: bool, perts: list[str]) -> str:
    na, nb = normalize_name(ra["card_name"]), normalize_name(rb["card_name"])
    da = [t for t in na.split(" ") if t and t not in GENERIC]
    db = [t for t in nb.split(" ") if t and t not in GENERIC]
    shared = [t for t in da if t in db]
    only_a = [t for t in da if t not in db]
    only_b = [t for t in db if t not in da]
    signals = [x for x in reasons if not x.endswith("name match") and "name match after" not in x]
    if kind == "missed":
        if not compared:
            return (f"Never compared. One record is booked under {ra['recorded_country']} and the other under "
                    f"{rb['recorded_country']}, the duplicate has no tax ID, and no name word or dialling code put "
                    f"them in the same block.")
        lead = []
        hints = []
        for words, meaning in TRANSLATION_HINTS.items():
            side_a = all(w in na.split(" ") for w in words)
            side_b = all(w in nb.split(" ") for w in words)
            if side_a != side_b:
                hints.append(f"'{' '.join(words)}' means '{meaning}'")
        if "misattributed_country" in perts:
            wrong = ra if ra["recorded_country"] != ra["true_country"] else rb
            lead.append(f"One record is booked under {wrong['recorded_country']}, but its "
                        f"{wrong['phone1'].split(' ')[0]} phone number put it next to the {wrong['true_country']} "
                        f"record, so the pair was compared.")
        if hints:
            lead.append("The names are a translation, not a spelling variant (" + "; ".join(hints)
                        + "), and the normaliser does not translate, so only '" + " ".join(shared)
                        + "' matches on both sides.")
        elif "romanisation" in perts or "typo" in perts:
            diff = [f"{x.capitalize()}/{y.capitalize()}" for x, y in zip(only_a, only_b)]
            lead.append("The distinctive words are romanised differently (" + ", ".join(diff[:3]) + ")"
                        + (f", so only '{' '.join(shared)}' matches on both sides." if shared else "."))
        sig = [x.replace("Same ", "").split(" (")[0] for x in signals]
        sig_txt = ""
        if sig:
            sig_txt = ("; same " + (", ".join(sig[:-1]) + " and " + sig[-1] if len(sig) > 1 else sig[0])
                       + f" added +{SIGNAL_BONUS * len(sig):.2f}")
        tail = (f"Name scored {name:.2f}{sig_txt}, so the total ({score:.2f}) stayed under the "
                f"{threshold:g} threshold.")
        return " ".join(lead + [tail])
    # false positive
    if "Same tax ID" in reasons:
        return (f"Two sister sites of one group that share a single tax ID ({ra['lic_trad_num']}). A shared tax ID "
                f"lifts any pair to 0.97, so the matcher treats them as one customer. They are separate sites "
                f"with separate orders.")
    if not only_a and not only_b:
        fa = [t for t in na.split(" ") if t in GENERIC and t not in nb.split(" ")]
        fb = [t for t in nb.split(" ") if t in GENERIC and t not in na.split(" ")]
        return (f"Different organisations with the same distinctive name, differing only by facility word "
                f"({'/'.join(fa) or '-'} vs {'/'.join(fb) or '-'}). Facility words are deliberately treated as "
                f"generic so 'Hosp' vs 'Hospital' still matches, which makes a hospital and a clinic of the same "
                f"name look alike. Score {score:.2f}.")
    return (f"Different organisations whose names overlap ('{' '.join(shared)}'); differing words "
            f"{', '.join(only_a + only_b)} were not enough to pull the score ({score:.2f}) under {threshold:g}.")


# =====================================================================================================
# 5. Pipeline
# =====================================================================================================

BLOCKING_MODES = ["first", "token", "token+cc"]
CHOSEN_MODE = "token+cc"   # chosen on SG+MY (see blockingAblation in matcher_eval.json)
GRID = [round(x * 0.01, 2) for x in range(60, 100)]


def tune_threshold(codes, scored, truth_tune, in_tune) -> tuple[float, list[dict]]:
    """F1-max on SG+MY; ties -> median of the tied thresholds (middle of the plateau), pre-registered."""
    rows = []
    for t in GRID:
        pred = {p for p in predicted_pairs(clusters_at(codes, scored, t)) if in_tune(p)}
        m = prf(pred, truth_tune)
        rows.append({"threshold": t, **m})
    best = max(r["f1"] for r in rows)
    tied = [r["threshold"] for r in rows if r["f1"] == best]
    thr = tied[len(tied) // 2] if len(tied) % 2 else round((tied[len(tied) // 2 - 1] + tied[len(tied) // 2]) / 2, 3)
    return round(thr, 3), rows


def run(scenario: str = "base", write_app: bool = True, verbose: bool = True) -> dict:
    d = scenario_dir(scenario)
    cr = read_csv(d / "customers_records.csv")
    truth_df = read_csv(d / "dup_truth.csv")
    recs = cr.to_dict("records")
    by_code = {r["card_code"]: r for r in recs}
    codes = sorted(by_code)
    true_country = {r["card_code"]: r["true_country"] for r in recs}

    def split_of(pair) -> str:
        cs = {true_country[pair[0]], true_country[pair[1]]}
        return "holdout" if cs & set(HOLDOUT) else "tune"

    def in_tune(p):
        return split_of(p) == "tune"

    def in_hold(p):
        return split_of(p) == "holdout"

    truth = {(min(a, b), max(a, b)) for a, b in zip(truth_df.card_code_a, truth_df.card_code_b)}
    truth_tune = {p for p in truth if in_tune(p)}
    truth_hold = {p for p in truth if in_hold(p)}
    truth_pert = {}
    for _, t in truth_df.iterrows():
        p = (min(t.card_code_a, t.card_code_b), max(t.card_code_a, t.card_code_b))
        ps = [x for x in t.perturbation.split(";") if x]
        if t.country_a != t.country_b:
            ps.append("misattributed_country")
        truth_pert[p] = ps

    # ---- score the union of all blocking variants once (each variant's pairs are a subset)
    cand = {m: candidate_pairs(recs, m) for m in BLOCKING_MODES}
    all_pairs = set().union(*cand.values())
    details = {}
    for a, b in all_pairs:
        s, reasons, name = pair_score(by_code[a], by_code[b])
        details[(a, b)] = (s, reasons, name)

    # ---- blocking ablation + threshold, chosen on SG+MY only
    ablation = []
    tuned = {}
    for m in BLOCKING_MODES:
        scored = {p: details[p][0] for p in cand[m]}
        thr, rows = tune_threshold(codes, scored, truth_tune, in_tune)
        best = next(r for r in rows if r["threshold"] == round(thr, 2)) if round(thr, 2) in GRID else \
            prf({p for p in predicted_pairs(clusters_at(codes, scored, thr)) if in_tune(p)}, truth_tune)
        tuned[m] = (thr, scored)
        ablation.append({"blocking": m, "pairsScoredTune": sum(1 for p in cand[m] if in_tune(p)),
                         "threshold": thr, "tuneF1": best["f1"], "tuneRecall": best["recall"],
                         "tunePrecision": best["precision"]})
    threshold, scored = tuned[CHOSEN_MODE]

    root = clusters_at(codes, scored, threshold)
    pred = predicted_pairs(root)
    tune_m = prf({p for p in pred if in_tune(p)}, truth_tune)
    hold_m = prf({p for p in pred if in_hold(p)}, truth_hold)
    pairs_scored_hold = sum(1 for p in scored if in_hold(p))
    n_hold_records = sum(1 for c in codes if true_country[c] in HOLDOUT)

    # PR curve on the held-out countries (threshold sweep, same clustering)
    curve_t = sorted(set([0.70, 0.75, 0.80, 0.83, 0.85, 0.88, 0.90, 0.93, 0.95, 0.97, threshold]))
    pr_curve = []
    for t in curve_t:
        m = prf({p for p in predicted_pairs(clusters_at(codes, scored, t)) if in_hold(p)}, truth_hold)
        pr_curve.append({"threshold": t, "precision": m["precision"], "recall": m["recall"]})

    # per-perturbation recall on held-out true pairs
    per_pert = []
    for key, label in PERTURBATION_LABELS.items():
        ps = [p for p in truth_hold if key in truth_pert[p]]
        if not ps:
            continue
        per_pert.append({"type": key, "label": label, "n": len(ps),
                         "recall": round(sum(1 for p in ps if p in pred) / len(ps), 3)})

    # ---- examples: errors at the frozen threshold, held-out first
    def side(code):
        r = by_code[code]
        return {"cardCode": code, "cardName": r["card_name"], "country": r["recorded_country"]}

    def example(p, kind):
        a, b = p
        s, reasons, name = details.get(p) or pair_score(by_code[a], by_code[b])
        why = explain(by_code[a], by_code[b], s, reasons, name, threshold, kind, p in scored,
                      truth_pert.get(p, []))
        split = split_of(p)
        return {"kind": kind, "a": side(a), "b": side(b), "score": s, "why": why, "_split": split,
                "_compared": p in scored}

    fns = [example(p, "missed") for p in sorted(truth - pred)]
    fps = [example(p, "false_positive") for p in sorted(pred - truth)]
    # rank: held-out first; among misses prefer "never compared", then closest to the threshold
    fns.sort(key=lambda e: (e["_split"] != "holdout", e["_compared"], -e["score"]))
    fps.sort(key=lambda e: (e["_split"] != "holdout", -e["score"]))
    examples = []
    # 2 misses + 1 false positive when available, else fill from whichever exists
    examples += fns[:2]
    examples += fps[:1]
    for e in fns[2:] + fps[1:]:
        if len(examples) >= 3:
            break
        examples.append(e)
    examples = examples[:3]

    # ---- golden IDs: label each predicted cluster in the generator's namespace (display only; grouping fixed)
    groups = defaultdict(list)
    for c in codes:
        groups[root[c]].append(c)
    gt = {r["card_code"]: r["golden_id"] for r in recs}
    created = {r["card_code"]: (r["created_at"] or "9999", r["card_code"]) for r in recs}
    # bigger / older clusters claim their majority label first
    order = sorted(groups.values(), key=lambda ms: (-len(ms), min(created[m] for m in ms)))
    used, label = set(), {}
    max_num = defaultdict(int)
    for g in gt.values():
        cc, num = g.split("-")[1], int(g.split("-")[2])
        max_num[cc] = max(max_num[cc], num)
    pending = []
    for ms in order:
        votes = Counter(gt[m] for m in ms)
        top = sorted(votes.items(), key=lambda kv: (-kv[1], min(created[m] for m in ms if gt[m] == kv[0])))
        choice = next((g for g, _ in top if g not in used), None)
        if choice is None:
            pending.append(ms)
            continue
        used.add(choice)
        for m in ms:
            label[m] = choice
    for ms in pending:   # a true customer split by a missed duplicate: the fragment gets a fresh ID
        survivor = min(ms, key=lambda m: created[m])
        cc = by_code[survivor]["recorded_country"]
        max_num[cc] += 1
        g = f"G-{cc}-{max_num[cc]:04d}"
        for m in ms:
            label[m] = g

    # crosswalk rows
    best_link = {}
    for (a, b), s in scored.items():
        if s >= threshold and root[a] == root[b]:
            for x, y in ((a, b), (b, a)):
                if x not in best_link or s > best_link[x][1]:
                    best_link[x] = (y, s, details[(a, b)][1])
    cw = []
    for c in codes:
        r = by_code[c]
        ms = groups[root[c]]
        survivor = min(ms, key=lambda m: created[m])
        link = best_link.get(c)
        cw.append({
            "card_code": c, "card_name": r["card_name"], "entity": r["entity"],
            "recorded_country": r["recorded_country"], "golden_id": label[c], "cluster_size": len(ms),
            "survivor_card_code": survivor, "is_survivor": c == survivor,
            "matched_to": link[0] if link else "", "match_score": link[1] if link else "",
            "match_reasons": "; ".join(link[2]) if link else "",
            "truth_golden_id": r["golden_id"],
            "correct": all((gt[m] == gt[c]) == (root[m] == root[c]) for m in codes if gt[m] == gt[c] or root[m] == root[c]),
        })
    cw_df = pd.DataFrame(cw)
    write_csv(cw_df, d / "crosswalk.csv")

    n_rec, n_gold_true, n_gold_pred = len(codes), len(set(gt.values())), len(groups)
    result = {
        "scenario": scenario, "threshold": threshold, "tune": tune_m, "holdout": hold_m,
        "pairsScoredHoldout": pairs_scored_hold, "holdoutRecords": n_hold_records, "ablation": ablation,
        "prCurve": pr_curve, "perPerturbation": per_pert, "examples": examples,
        "records": n_rec, "goldenTrue": n_gold_true, "goldenPred": n_gold_pred,
        "allPairs": n_rec * (n_rec - 1) // 2, "pairsScored": len(scored),
        "truthTune": len(truth_tune), "truthHold": len(truth_hold),
    }
    if verbose:
        print(f"[{scenario}] records={n_rec} true golden={n_gold_true} predicted golden={n_gold_pred}")
        for a in ablation:
            print(f"  blocking={a['blocking']:9s} tune pairs={a['pairsScoredTune']:5d} thr={a['threshold']:.3f} "
                  f"tune P/R/F1={a['tunePrecision']}/{a['tuneRecall']}/{a['tuneF1']}")
        print(f"  chosen={CHOSEN_MODE} threshold={threshold} tune={tune_m}")
        print(f"  HOLDOUT {hold_m} pairs scored={pairs_scored_hold}")
        for e in examples:
            print(f"  EX {e['kind']:14s} {e['a']['cardName']} | {e['b']['cardName']} -> {e['score']}  [{e['_split']}]")
            print(f"     {e['why']}")

    if write_app and scenario == "base":
        write_app_files(result, recs, label, cw_df, d)
        write_fixture(recs, by_code, truth, details)
    return result


# =====================================================================================================
# 6. App JSON (contract shapes in src/data/contract.ts)
# =====================================================================================================

NUH_PINNED = {
    "cardCode": "C-SG-00017", "cardName": "National University Hospital", "entity": "SPD", "country": "SG",
    "licTradNum": "198500123K", "street": "5 Lower Kent Ridge Road", "zipCode": "119074", "phone1": "+65 6779 5555",
    "goldenId": "G-SG-0000", "segment": "Public hospital", "hasTransactions": False,
}


def plain_precision(p: float) -> str:
    return f"Of 100 duplicate warnings, {_js_round(p * 100)} are real"


def plain_recall(r: float) -> str:
    return f"Catches {_js_round(r * 100)} of every 100 real duplicates"


def write_app_files(res: dict, recs: list[dict], label: dict, cw_df: pd.DataFrame, d: Path) -> None:
    hold = res["holdout"]
    abl = {a["blocking"]: a for a in res["ablation"]}
    method = (
        "Blocking: same recorded country and a shared Soundex code on any distinctive name word, or the same tax ID "
        "in any country; a record whose phone dialling code points to another country is also compared in that "
        "country. Score: the live intake scorer (src/lib/engine/dedupe.ts, ported 1:1 to Python and parity-tested): "
        "max(Jaro-Winkler, token-set ratio) on the normalised name (lowercase, punctuation and legal suffixes "
        "removed, abbreviations expanded), capped by how much of the distinctive wording both names share; the same "
        "tax ID lifts it to 0.97; same postcode, phone or company email domain add 0.03 each. Matches are grouped "
        f"into golden IDs (transitive). Blocking design and threshold ({res['threshold']:g}, the middle of the "
        "F1-best range) were chosen on SG+MY only, then frozen and scored once on TH/VN/MM. The duplicates were "
        "generated with typos, word reorder, romanisation, blank tax IDs and other address formats that the "
        "normaliser does not know about."
    )
    tp_fp = hold["tp"] + hold["fp"]
    out = {
        "isMock": False,
        "threshold": res["threshold"],
        "tunedOn": TUNE,
        "heldOut": HOLDOUT,
        "method": method,
        "heldOutMetrics": {**hold, "pairsScored": res["pairsScoredHoldout"], "truePairs": res["truthHold"]},
        "tuningMetrics": res["tune"],
        "plain": {"precision": plain_precision(hold["precision"]), "recall": plain_recall(hold["recall"])},
        "prCurve": res["prCurve"],
        "perPerturbation": res["perPerturbation"],
        "examples": [{k: v for k, v in e.items() if not k.startswith("_")} for e in res["examples"]],
        "duplicateRate": round((res["records"] - res["goldenTrue"]) / res["records"], 4),
        # ---- extra detail (not in the contract type; safe to ignore)
        "predictedDuplicateRate": round((res["records"] - res["goldenPred"]) / res["records"], 4),
        "records": res["records"],
        "goldenCustomersTrue": res["goldenTrue"],
        "goldenCustomersPredicted": res["goldenPred"],
        "heldOutRecords": res["holdoutRecords"],
        "comparisons": {"allPossiblePairs": res["allPairs"], "pairsScored": res["pairsScored"],
                        "reductionRatio": round(1 - res["pairsScored"] / res["allPairs"], 4)},
        "blockingAblation": [
            {"blocking": {"first": "country + Soundex of first distinctive word",
                          "token": "country + Soundex of any distinctive word",
                          "token+cc": "any distinctive word + dialling-code country check (chosen)"}[a["blocking"]],
             "pairsScoredSGMY": a["pairsScoredTune"], "threshold": a["threshold"], "f1SGMY": a["tuneF1"],
             "recallSGMY": a["tuneRecall"], "precisionSGMY": a["tunePrecision"]}
            for a in res["ablation"]],
        "notes": [
            f"{hold['tp']} of {res['truthHold']} held-out duplicate pairs found; {hold['fp']} of {tp_fp} warnings was a false alarm.",
            "Small sample: one pair moves recall by about 7 points on the held-out countries.",
            "Merging duplicate records alone does not change any country x product total; only records booked "
            "under the wrong country or product do.",
        ],
    }
    write_json(out, SRC_DATA / "matcher_eval.json")

    # master.json
    customers = []
    for r in sorted(recs, key=lambda r: r["card_code"]):
        if r["card_code"] == NUH_PINNED["cardCode"]:
            customers.append(dict(NUH_PINNED))
            continue
        customers.append(as_master(r, label[r["card_code"]]))
    items = read_csv(d / "items.csv")
    item_rows = [{"itemCode": i.item_code, "itemName": i.item_name, "productGroup": i.recorded_product,
                  "category": i.category, "entity": i.entity}
                 for i in items.sort_values("item_code").itertuples()]
    write_json({"isMock": False, "customers": customers, "items": item_rows}, SRC_DATA / "master.json")


# =====================================================================================================
# 7. TS/Python parity fixture (25 pairs)
# =====================================================================================================

def _fixture_entry(pid: str, kind: str, note: str, inp: dict, rec: dict) -> dict:
    s, reasons, _ = score_pair(inp, rec)
    n_in, n_rec = normalize_name(inp.get("name") or ""), normalize_name(rec.get("cardName") or "")
    return {"id": pid, "kind": kind, "note": note, "input": inp, "record": rec,
            "expected": {"score": s, "nameSimilarity": round(name_similarity_normalized(n_in, n_rec), 6),
                         "reasons": reasons, "normalizedInput": n_in, "normalizedRecord": n_rec}}


def write_fixture(recs, by_code, truth, details) -> None:
    """25 pairs: 8 true duplicates (6 scored on name + tax ID only so the name score is visible, 2 with every
    signal), 4 hardest non-duplicates, 4 mid-range non-duplicates, 8 hand-written edge cases, 1 low pair."""
    def inp_of(code, name_only=False):
        i = as_input(by_code[code])
        keep = ("name", "country", "taxId") if name_only else tuple(i)
        return {k: v for k, v in i.items() if v and k in keep}

    def rec_of(code):
        return as_master(by_code[code], by_code[code]["golden_id"])

    entries = []
    # (a) true duplicates: one per perturbation flavour, then a misattributed and two Vietnamese pairs
    tp_sorted = sorted(truth)
    pert = {p: by_code[p[1]]["perturbation"] or by_code[p[0]]["perturbation"] for p in tp_sorted}
    picked = []
    for w in ["abbreviation", "typo", "word_reorder", "romanisation", "cross_entity"]:
        p = next((q for q in tp_sorted if q not in picked and w in pert[q].split(";")), None)
        if p:
            picked.append(p)
    vn = [q for q in tp_sorted if q not in picked and by_code[q[0]]["recorded_country"] == "VN"
          and by_code[q[1]]["recorded_country"] == "VN"][:2]
    cross = [q for q in tp_sorted if q not in picked
             and by_code[q[0]]["recorded_country"] != by_code[q[1]]["recorded_country"]][:1]
    picked = (picked[:5] + vn + cross)[:8]
    for k, (a, b) in enumerate(picked):
        older, newer = sorted([by_code[a], by_code[b]], key=lambda r: (r["created_at"] or "9999", r["card_code"]))
        name_only = k < 6
        entries.append(_fixture_entry(
            f"T{k + 1:02d}", "true_duplicate",
            f"{pert[(a, b)]} ({newer['recorded_country']}/{older['recorded_country']})"
            + ("; name + tax ID only" if name_only else "; all signals"),
            inp_of(newer["card_code"], name_only), rec_of(older["card_code"])))
    # (b) hard non-duplicates: highest-scoring pairs that are NOT duplicates (all signals)
    nondup = sorted(((v[0], p) for p, v in details.items() if p not in truth), reverse=True)
    for k, (_, (a, b)) in enumerate(nondup[:4]):
        entries.append(_fixture_entry(f"N{k + 1:02d}", "non_duplicate", "hardest non-duplicates (all signals)",
                                      inp_of(b), rec_of(a)))
    # (c) ordinary non-duplicates across the score range (name only)
    mid = [x for x in nondup if 0.3 <= x[0] < 0.8]
    step = max(1, len(mid) // 4)
    for k, (_, (a, b)) in enumerate(mid[::step][:4]):
        entries.append(_fixture_entry(f"M{k + 1:02d}", "non_duplicate", "mid-range non-duplicate (name only)",
                                      inp_of(b, True), rec_of(a)))
    # (d) hand-written edge cases (pinned demo facts and normaliser corners)
    nuh = dict(NUH_PINNED)
    edge = [
        ("Natl Univ Hosp vs NUH, no tax ID (pinned demo: >= 0.85)", {"name": "Natl Univ Hosp", "country": "SG"}, nuh),
        ("Natl Univ Hosp with NUH's tax ID", {"name": "Natl Univ Hosp", "country": "SG", "taxId": "198500123K"}, nuh),
        ("Generic word only must stay <= 0.5", {"name": "Hospital", "country": "SG"}, nuh),
        ("Different hospital must stay < 0.75", {"name": "Mount Elizabeth Hospital", "country": "SG"}, nuh),
        ("Initials", {"name": "NUH", "country": "SG"}, nuh),
        ("Apostrophe, leading St, Gen, ampersand, postcode with letters",
         {"name": "St. Luke's Gen Hosp & Lab", "country": "SG", "zipCode": "S(119074)"},
         {**nuh, "cardCode": "C-SG-99001", "cardName": "Saint Lukes General Hospital and Laboratory", "goldenId": "G-SG-9001"}),
        ("Vietnamese: Cong ty / TNHH / diacritics incl. D-stroke (TS drops the D-stroke letter)",
         {"name": "Công ty TNHH Bệnh viện Đa khoa Hòa Bình", "country": "VN", "phone": "+84 28 1234 5678"},
         {"cardCode": "C-VN-99001", "cardName": "Benh vien Da khoa Hoa Binh", "entity": "SPD", "country": "VN",
          "phone1": "+84 28 1234 5678", "goldenId": "G-VN-9001", "segment": "Private hospital", "hasTransactions": True}),
        ("Thai company suffix, free-mail domain ignored",
         {"name": "Bangkok Central Lab Co., Ltd.", "country": "TH", "email": "buyer@gmail.com"},
         {"cardCode": "C-TH-99001", "cardName": "Bangkok Central Laboratory Public Company Limited", "entity": "QTG",
          "country": "TH", "email": "lab@gmail.com", "goldenId": "G-TH-9001", "segment": "Diagnostic lab",
          "hasTransactions": True}),
    ]
    for k, (note, inp, rec) in enumerate(edge):
        entries.append(_fixture_entry(f"E{k + 1:02d}", "edge_case", note, inp, rec))
    # top up to exactly 25 with low-scoring pairs
    extra = [x for x in nondup if x[0] < 0.3]
    k = 0
    while len(entries) < 25 and k < len(extra):
        _, (a, b) = extra[(k * 7) % len(extra)]
        entries.append(_fixture_entry(f"L{k + 1:02d}", "non_duplicate", "low-scoring non-duplicate (name only)",
                                      inp_of(b, True), rec_of(a)))
        k += 1
    entries = entries[:25]
    fixture = {
        "description": "TS/Python parity fixture for the duplicate scorer. 'expected' comes from analytics/resolve.py "
                       "(a port of src/lib/engine/dedupe.ts); src/lib/engine/__tests__/parity.test.ts runs scorePair "
                       "on every pair and requires |TS - Python| <= tolerance, identical normalised names and reasons.",
        "generatedBy": "analytics/resolve.py",
        "tolerance": 0.02,
        "pairs": entries,
    }
    write_json(fixture, ANALYTICS / "matcher_fixture.json")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scenario", default="base", choices=["base", "nosignal", "halfdengue", "all"])
    ap.add_argument("--no-app", action="store_true", help="do not write src/data/*.json or the fixture")
    a = ap.parse_args()
    scen = ["base", "nosignal", "halfdengue"] if a.scenario == "all" else [a.scenario]
    for s in scen:
        if (scenario_dir(s) / "customers_records.csv").exists():
            run(s, write_app=not a.no_app)


if __name__ == "__main__":
    main()
