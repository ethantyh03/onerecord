#!/usr/bin/env python
"""Tesseract seeded synthetic data generator.

Usage (from the repo root):
    python analytics/generate.py --seed 42 --scenario base       --out analytics/out/base
    python analytics/generate.py --seed 42 --scenario nosignal   --out analytics/out/nosignal
    python analytics/generate.py --seed 7  --scenario halfdengue --out analytics/out/halfdengue
(--seed and --out default to the scenario's seed in params.yaml and analytics/out/<scenario>.)

Writes the CSVs documented in analytics/SCHEMA.md, plus
  plants.json   ground truth for every planted pattern (codes, names, measured sizes)
  manifest.json params snapshot, row counts and the summary stats printed at the end.
Every number comes from analytics/params.yaml; every planted pattern is listed in analytics/PATTERNS.md.
All names are fictional except the pinned NUH master record (no sales); the two pinned PR customers are fictional too.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import unicodedata
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (COUNTRIES, PRODUCTS, REPO, TZ, add_months, load_params, month_range,  # noqa: E402
                    scenario_dir, windows, write_csv, write_json)

HOSP = ("Public hospital", "Private hospital")
INF = 10 ** 9

def strip_diacritics(s: str) -> str:
    s = s.replace("Đ", "D").replace("đ", "d")
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


# ====================================================================== fictional name pools
# Place-like stems and brand words. Real hospital names are avoided on purpose (see PATTERNS.md).
SG_PLACES = ["Keppel", "Marina", "Tanjong Rhu", "Telok Ayer", "Serangoon", "Pasir Panjang", "Tampines", "Bedok",
             "Punggol", "Holland", "Bishan", "Clementi", "Sembawang", "Yishun", "Queenstown", "Katong", "Siglap",
             "Hougang", "Pioneer", "Lavender", "Orchard", "Kallang", "Simei", "Loyang", "Mandai", "Seletar", "Dover",
             "Rochor", "Tiong Bahru", "Jalan Kayu", "Pasir Ris", "Bukit Batok", "Choa Chu Kang", "Ang Mo Kio",
             "Geylang", "Kembangan", "Tuas", "Redhill", "Boon Lay", "Kranji"]
SG_SUFFIX = ["Vale", "Park", "Crest", "Hill", "Grove", "Bay", "Point", "Vista", "Gardens", "Heights", "Quay", "Green"]
SG_BRANDS = ["Lumen", "Crescent", "Harbourline", "Meridian", "Straits", "Orchid", "Banyan", "Tembusu", "Angsana",
             "Merlion", "Halcyon", "Vireo", "Arcadia", "Helix", "Kingfisher", "Sapphire", "Silverlake", "Cendana",
             "Pandan", "Senja", "Bayfront", "Lighthouse", "Equator", "Monsoon", "Coral", "Jadeleaf", "Tidewater",
             "Starfruit", "Kopitiam", "Saffron", "Tanglin Labs", "Palmyra", "Nutmeg", "Cinnamon", "Ember",
             "Northstar", "Bluewater", "Evergreen", "Sunbird", "Hornbill"]
MY_PREFIX = ["Bukit", "Taman", "Kota", "Bandar", "Sungai", "Seri", "Desa", "Lembah", "Tanjung", "Kuala", "Padang",
             "Ulu", "Permatang"]
MY_SUFFIX = ["Permai", "Indah", "Mutiara", "Hijau", "Cahaya", "Kenanga", "Bayu", "Kencana", "Mawar", "Melati",
             "Cempaka", "Aman", "Bestari", "Murni", "Harmoni", "Delima", "Intan", "Seroja", "Teratai", "Kenari",
             "Gemilang", "Nilam", "Suria", "Lestari", "Sejahtera", "Makmur", "Bahagia", "Mulia", "Perdana",
             "Baiduri", "Zamrud", "Nirwana", "Impian", "Idaman", "Puteri", "Mahkota", "Sutera", "Cemerlang",
             "Anggerik", "Perkasa", "Dahlia", "Orkid", "Selasih", "Kesuma", "Tropika", "Wangi"]
MY_BRANDS = ["Kenari", "Rimba", "Wira", "Andalas", "Merbau", "Jati", "Nusantara", "Puncak", "Halia", "Serai",
             "Meranti", "Kasturi", "Tualang", "Bunga Raya", "Kemboja", "Belian", "Keruing", "Sena", "Cengal",
             "Damar", "Rotan", "Pelangi", "Kirana", "Embun", "Tiara"]
TH_FIRST = ["Sri", "Nakhon", "Rattana", "Chai", "Kasem", "Thep", "Wiset", "Phon", "Sap", "Rung", "Siri", "Charoen",
            "Saeng", "Bua", "Prasert", "Sombat", "Thawi", "Chok", "Pracha", "Lanna", "Isan", "Andaman", "Kanchana",
            "Suphan", "Sakon", "Udon", "Khun", "Mongkhon", "Anan", "Boon", "Chanthra", "Duang", "Kaew", "Mani",
            "Narin", "Pradit", "Thanya", "Uthai", "Wanna", "Yupha", "Ruen", "Phisit", "Nopphon", "Sirin", "Ploen",
            "Rawi", "Somjit", "Thip"]
TH_SECOND = ["Wattana", "Suk", "Thong", "Charoen", "Phatthana", "Mongkhon", "Prasit", "Phon", "Rattana", "Arun",
             "Luang", "Thep", "Chaloem", "Mitr", "Sawang", "Phaet", "Wet", "Kit", "Sombun", "Phithak", "Udom",
             "Thani", "Ngam", "Satit", "Phiban", "Raksa", "Sanit", "Kamon", "Thada", "Nimit", "Prida", "Sakun",
             "Phakdi", "Witthaya", "Chuen", "Pracharak", "Khemmarat", "Sukkasem", "Thammarak", "Rungrot"]
TH_BRANDS = ["Chaiyo", "Thai Sabai", "Lotus Siam", "Naga", "Kinnaree", "Mekong Delta", "Sukhothai", "Lanna Gene",
             "Isan Health", "Bodhi", "Benjarong", "Mali", "Champa", "Kraisorn", "Phaya", "Ratchaphruek", "Siam Helix",
             "Golden Teak", "Saeng Thai", "Chalerm Labs", "Orchid Siam", "Tuk Tuk Bio"]
VN_FIRST = ["An", "Bình", "Phú", "Hòa", "Thiện", "Phúc", "Minh", "Hưng", "Bảo", "Gia", "Thanh", "Hải", "Ngọc",
            "Trường", "Đông", "Tân", "Vĩnh", "Kim", "Nam", "Quang", "Hoàng", "Đức", "Phước", "Thái", "Khánh",
            "Tường", "Thuận", "Thịnh", "Trúc", "Lộc", "Cẩm", "Diệu", "Gia Lâm", "Hiếu", "Kiến", "Lạc", "Mộc",
            "Nhật", "Phương", "Sáng", "Thiên", "Tuệ", "Vạn", "Xuân", "Yên"]
VN_SECOND = ["Khang", "Phát", "Lộc", "Tâm", "Thịnh", "Hòa", "Vân", "Đăng", "Lan", "Sơn", "Hải", "Ngân", "Phong",
             "Minh", "Long", "Thành", "Phúc", "Thọ", "Lâm", "Nguyên", "Hưng", "Quý", "Tín", "Nghĩa", "Hiền",
             "Bảo", "Châu", "Dương", "Định", "Hạnh", "Khôi", "Linh", "Mai", "Nhân", "Quân", "Sang", "Trí", "Tú",
             "Uyên", "Việt"]
VN_AVOID = {"Hưng Hưng", "Bảo Bảo", "Phú Thọ", "Vĩnh Đức", "Bảo Sơn", "An Phước", "Tâm Đức", "Hồng Ngọc", "Thái Hòa", "Đức Phúc", "Gia An",
            "Bình An", "Hòa Hòa", "An Khang", "Minh Long", "Hưng Thịnh", "Phúc Lâm", "Hoàng Long", "Thanh Nhàn",
            "Tân Phú", "Bình Phước", "Phú Hòa", "Thịnh Phát"}
VN_BRANDS = ["Sen Vàng", "Việt Tín", "Sao Mai", "Ánh Dương", "Trường Thịnh", "Tân Á", "Đại Việt", "Lạc Việt",
             "An Bình", "Hưng Phát", "Kim Long", "Bách Việt", "Nam Việt", "Hồng Hà", "Phương Nam", "Mê Kông",
             "Cửu Long", "Bạch Đằng"]
MM_FIRST = ["Shwe", "Yadanar", "Ngwe", "Sein", "Myint", "Thazin", "Kyal", "Hninn", "Mya", "Moe", "Pyi", "Lin",
            "Thit", "Ywar", "Padamyar", "Sabe", "Pan", "Nan", "Kan", "Wun", "Zay", "Nwe", "Hla", "Phyo"]
MM_SECOND = ["Mingalar", "Myay", "Taung", "Pann", "Mo", "Padauk", "Sin", "Thida", "Lin", "Kaung", "Win", "Yaung",
             "Zin", "Sar", "Kyar", "Thu", "Nyo", "Taw", "Thar", "Yadanar", "Aye", "Htet", "Khaing", "Maung", "Oo",
             "Pyae", "Soe", "Thet", "Wai", "Yee", "Zaw", "Hlaing", "Khin"]
MM_BRANDS = ["Golden Lotus", "Shwe Labs", "Padauk", "Thazin", "Ayar", "Sein", "Ngwe", "Mya", "Zay", "Hla", "Phyo",
             "Thant", "Nwe", "Moe", "Lotus Myanmar", "Ruby"]

TEMPLATES = {
    "SG": {"Public hospital": ["{s} General Hospital", "{s} Community Hospital", "{s} Hospital"],
           "Private hospital": ["{s} Medical Centre", "{s} Specialist Hospital", "{s} Surgical Centre"],
           "Diagnostic lab": ["{b} Diagnostics Pte Ltd", "{s} Pathology Lab", "{b} Clinical Laboratories Pte Ltd"],
           "Clinic": ["{s} Family Clinic", "{s} Medical Clinic", "{b} Health Clinic", "{s} Polyclinic"],
           "Research/academic": ["{b} Institute of Molecular Medicine", "{b} Research Institute",
                                 "{s} College of Life Sciences"],
           "Industry": ["{b} Biotech Pte Ltd", "{b} Pharma Pte Ltd", "{b} Food Testing Pte Ltd",
                        "{b} Biologics Pte Ltd"]},
    "MY": {"Public hospital": ["Hospital {s}", "Hospital Daerah {s}"],
           "Private hospital": ["{s} Specialist Hospital", "{s} Medical Centre", "Pusat Perubatan {s}"],
           "Diagnostic lab": ["{b} Diagnostic Laboratories Sdn Bhd", "Makmal Patologi {s}", "{b} Pathology Sdn Bhd"],
           "Clinic": ["Klinik {s}", "{s} Family Clinic", "Poliklinik {s}"],
           "Research/academic": ["Institut Penyelidikan {b}", "{b} Medical Research Institute",
                                 "{s} Biotech Research Centre"],
           "Industry": ["{b} Bioscience Sdn Bhd", "{b} Pharma Sdn Bhd", "{b} Halal Testing Sdn Bhd",
                        "{b} Gloves Sdn Bhd"]},
    "TH": {"Public hospital": ["{s} Hospital", "{s} General Hospital"],
           "Private hospital": ["{s} International Hospital", "{s} Hospital", "{s} Medical Center"],
           "Diagnostic lab": ["{s} Lab Co., Ltd.", "{b} Medical Laboratory Co., Ltd."],
           "Clinic": ["{s} Clinic", "{s} Polyclinic"],
           "Research/academic": ["{s} Institute of Tropical Medicine", "{b} Research Center"],
           "Industry": ["{b} Biotech Co., Ltd.", "{b} Food Lab Co., Ltd.", "{b} Pharma Co., Ltd."]},
    "VN": {"Public hospital": ["general_hospital", "hospital"],
           "Private hospital": ["intl_hospital", "hospital"],
           "Diagnostic lab": ["lab_centre", "lab_company"],
           "Clinic": ["polyclinic", "clinic"],
           "Research/academic": ["research", "bio_research"],
           "Industry": ["pharma", "biotech"]},
    "MM": {"Public hospital": ["{s} General Hospital", "{s} Township Hospital", "{s} Hospital"],
           "Private hospital": ["{s} Specialist Hospital", "{s} Hospital", "{s} Medical Centre"],
           "Diagnostic lab": ["{s} Diagnostic Centre", "{b} Laboratory Co., Ltd."],
           "Clinic": ["{s} Clinic", "{s} Polyclinic"],
           "Research/academic": ["{b} Medical Research Centre", "{s} Institute of Medicine"],
           "Industry": ["{b} Pharma Co., Ltd.", "{b} Biotech Co., Ltd."]},
}
VN_KINDS = {  # kind: (Vietnamese, English, Vietnamese abbreviation, uses brand)
    "general_hospital": ("Bệnh viện Đa khoa {s}", "{s} General Hospital", "BVĐK {s}", False),
    "hospital": ("Bệnh viện {s}", "{s} Hospital", "BV {s}", False),
    "intl_hospital": ("Bệnh viện Quốc tế {s}", "{s} International Hospital", "BV Quốc tế {s}", False),
    "lab_centre": ("Trung tâm Xét nghiệm {s}", "{s} Laboratory Centre", "TT Xét nghiệm {s}", False),
    "lab_company": ("Công ty TNHH Xét nghiệm {s}", "{s} Laboratory Co., Ltd.", "Cty TNHH XN {s}", True),
    "polyclinic": ("Phòng khám Đa khoa {s}", "{s} Polyclinic", "PKĐK {s}", False),
    "clinic": ("Phòng khám {s}", "{s} Clinic", "PK {s}", False),
    "research": ("Viện Nghiên cứu {s}", "{s} Research Institute", "Viện NC {s}", False),
    "bio_research": ("Viện Sinh học {s}", "{s} Institute of Biology", "Viện SH {s}", False),
    "pharma": ("Công ty CP Dược {s}", "{s} Pharmaceutical JSC", "CTCP Dược {s}", True),
    "biotech": ("Công ty TNHH Sinh học {s}", "{s} Biotech Co., Ltd.", "Cty TNHH SH {s}", True),
}
ABBREV = [("International", "Intl"), ("Specialist", "Spec"), ("Hospital", "Hosp"), ("General", "Gen"),
          ("Medical", "Med"), ("Centre", "Ctr"), ("Center", "Ctr"), ("Laboratories", "Labs"), ("Laboratory", "Lab"),
          ("Diagnostics", "Diag"), ("Diagnostic", "Diag"), ("Institute", "Inst"), ("Research", "Res"),
          ("Community", "Comm"), ("Pathology", "Path"), ("Sdn Bhd", "S/B"), ("Pte Ltd", "Pte. Ltd."),
          ("Co., Ltd.", "Co Ltd"), ("Hospital Daerah", "Hosp. Daerah"), ("Pusat Perubatan", "Pusat Perubatan")]
ROMAN = {
    "TH": {"Chaloem": "Chalerm", "Sri": "Si", "Nakhon": "Nakorn", "Thep": "Dhep", "Rattana": "Ratana",
           "Wattana": "Vadhana", "Phraya": "Praya", "Charoen": "Jaroen", "Phon": "Pol", "Prasit": "Prasith",
           "Mongkhon": "Mongkol", "Thong": "Tong", "Suk": "Sook", "Chai": "Jai", "Phatthana": "Pattana",
           "Prasert": "Prasoet", "Sombat": "Sombut", "Thawi": "Tawee", "Kasem": "Kasame", "Wiset": "Wised",
           "Saeng": "Sang", "Rung": "Roong", "Arun": "Aroon", "Sap": "Sub", "Luang": "Lueang", "Chok": "Chock",
           "Phaet": "Paet", "Kanchana": "Karnjana", "Chao": "Jao", "Lanna": "Lana", "Isan": "Esan", "Sakon": "Sakol",
           "Udon": "Udorn", "Khun": "Kun", "Mitr": "Mit", "Sawang": "Savang", "Siri": "Sirri", "Bua": "Boa",
           "Pracha": "Bracha", "Suphan": "Suphun"},
    "MM": {"Myittar": "Myitta", "Mingalar": "Mingala", "Yadanar": "Yadana", "Thukha": "Thuka", "Yeik": "Yeit",
           "Taung": "Daung", "Pann": "Pan", "Kyal": "Kyel", "Hninn": "Hnin", "Shwe": "Shway", "Myay": "Mye",
           "Thazin": "Tharzin", "Thida": "Thidar", "Lin": "Linn", "Zin": "Zinn", "Kaung": "Gaung", "Win": "Winn",
           "Sar": "Sa", "Ywar": "Ywa", "Kyar": "Kya", "Padamyar": "Padamya", "Sabe": "Sabei", "Nyo": "Nyoe",
           "Nan": "Nann", "Taw": "Daw", "Thar": "Tha", "Wun": "Wunn", "Moe": "Mo", "Sein": "Sane", "Ngwe": "Ngway",
           "Myint": "Myintt", "Phyo": "Pyo", "Aung": "Aong", "Thiri": "Thirri", "Padauk": "Padouk"},
}
GENERIC_TOKENS = {"hospital", "general", "medical", "centre", "center", "clinic", "specialist", "international",
                  "laboratory", "laboratories", "lab", "diagnostics", "diagnostic", "institute", "research", "pte",
                  "ltd", "sdn", "bhd", "co", "jsc", "company", "of", "the", "and", "family", "polyclinic",
                  "community", "township", "health", "molecular", "medicine", "life", "sciences", "college",
                  "surgical", "pathology", "biotech", "pharma", "testing", "food", "biologics", "klinik", "daerah",
                  "pusat", "perubatan", "makmal", "patologi", "institut", "penyelidikan", "poliklinik", "bioscience",
                  "halal", "gloves", "tropical", "pharmaceutical", "biology", "bệnh", "viện", "đa", "khoa", "quốc",
                  "tế", "phòng", "khám", "trung", "tâm", "xét", "nghiệm", "công", "ty", "tnhh", "cp", "dược",
                  "sinh", "học", "nghiên", "cứu"}
GENERIC_ASCII = {strip_diacritics(t) for t in GENERIC_TOKENS} | {
    "benh", "vien", "da", "khoa", "quoc", "te", "phong", "kham", "trung", "xet", "nghiem", "cong", "ty", "duoc",
    "sinh", "hoc", "nghien", "cuu", "rong", "phayaban", "hosp", "gen", "med", "ctr", "spec", "inst", "res", "intl",
    "diag", "labs", "comm", "path", "pte", "bhd", "sdn", "s", "b", "north", "east", "west", "south", "central"}
NEW_ITEM_NAMES = ["HbA1c Point-of-Care Cartridge 10T", "Dengue NS1 Ag ELISA 192T", "Leptospira IgM ELISA 96T",
                  "Melioidosis Ab Rapid Test 20T", "Scrub Typhus IgM Rapid 25T", "Mpox PCR Kit 48T"]
PROSPECT_STEMS = {"SG": ["Rivervale", "Fernvale", "Canberra", "Tengah"], "MY": ["Bayan Lepas", "Batu Maung", "Nibong Tebal"],
                  "TH": ["Bang Na", "Lat Krabang", "Hua Hin"], "VN": ["Thủ Đức", "Long Biên", "Biên Hòa"],
                  "MM": ["Hlaing Thar", "Dagon Seikkan", "Bago"]}


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", strip_diacritics(s).lower())[:18] or "customer"


def ord_to_iso(o: int) -> str:
    return date.fromordinal(int(o)).isoformat()


def ts(o: int, minutes: int) -> str:
    """ordinal day + minutes after midnight -> ISO timestamp in SGT."""
    d = date.fromordinal(int(o))
    h, m = divmod(int(minutes), 60)
    return f"{d.isoformat()}T{h:02d}:{m:02d}:00{TZ}"


def month_of(o: int) -> str:
    d = date.fromordinal(int(o))
    return f"{d.year:04d}-{d.month:02d}"


def next_business_day(o: int) -> int:
    while date.fromordinal(o).weekday() >= 5:
        o += 1
    return o


# ====================================================================== generator
class Generator:
    def __init__(self, P: dict, scenario: str, seed: int):
        self.P = P
        self.scenario = scenario
        sc = P["scenarios"][scenario]
        self.signal = bool(sc["signal"])
        self.dengue_scale = float(sc["dengue_scale"])
        self.seed = seed
        # independent random streams, so re-tuning one component never reshuffles another:
        # structure (customers, records, names), A/B demand, C demand, streams (PRs, enquiries, MDM history)
        ss = np.random.SeedSequence(seed).spawn(4)
        self.rng = np.random.default_rng(ss[0])
        self.rng_ab = np.random.default_rng(ss[1])
        self.rng_c = np.random.default_rng(ss[2])
        self.rng_s = np.random.default_rng(ss[3])
        tp = P["time"]
        self.months = month_range(tp["history_start"], tp["history_end"])
        self.T = len(self.months)
        self.mi = {m: i for i, m in enumerate(self.months)}
        self.t_ref = self.mi[tp["reference_month"]]
        self.win = windows(P)
        self.mon = np.array([int(m[5:7]) for m in self.months])
        self.year = np.array([int(m[:4]) for m in self.months])
        self.d_first = date.fromisoformat(tp["history_start"] + "-01").toordinal()
        self.d_last = date.fromisoformat(add_months(tp["history_end"], 1) + "-01").toordinal() - 1
        self.today = date(2026, 10, 28).toordinal()
        self.month_first = np.array([date.fromisoformat(m + "-01").toordinal() for m in self.months])
        self.stats: dict = {}

    def mo(self, ym: str) -> int:
        """ordinal of the first day of a 'YYYY-MM' month."""
        return date.fromisoformat(ym + "-01").toordinal()

    # ------------------------------------------------------------------ calendar
    def build_calendar(self):
        cal = self.P["calendar"]
        ords = np.arange(self.d_first, self.d_last + 1)
        dow = np.array([date.fromordinal(int(o)).weekday() for o in ords])
        base = np.where(dow < 5, cal["weekday_weight"], np.where(dow == 5, cal["saturday_weight"],
                                                                  cal["sunday_weight"])).astype(float)
        mon_idx = np.array([self.mi[month_of(o)] for o in ords])
        n = len(ords)
        self.day_w, self.wd = {}, {}
        for c in COUNTRIES:
            w = base.copy()
            if self.signal:
                for h in cal["holidays"]:
                    if c not in h["countries"]:
                        continue
                    for a, b in h["days"]:
                        ia = date.fromisoformat(a).toordinal() - self.d_first
                        ib = date.fromisoformat(b).toordinal() - self.d_first
                        if ib < 0 or ia >= n:
                            continue
                        k, j = 0, ia - 1
                        while k < h["bump_days"] and j >= 0:
                            if base[j] >= 1:
                                w[j] *= h["bump"]
                                k += 1
                            j -= 1
                        w[max(ia, 0):min(ib, n - 1) + 1] = np.minimum(w[max(ia, 0):min(ib, n - 1) + 1],
                                                                      cal["holiday_weight"])
                        k, j = 0, ib + 1
                        while k < h["slow_after"] and j < n:
                            if base[j] >= 1:
                                w[j] *= cal["slow_weight"]
                                k += 1
                            j += 1
            self.day_w[c] = w
            msum = np.bincount(mon_idx, weights=w, minlength=self.T)
            self.wd[c] = msum / msum.mean() if self.signal else np.ones(self.T)
        self.day_choice = {}
        for c in COUNTRIES:
            lst = []
            for t in range(self.T):
                sel = np.where(mon_idx == t)[0]
                w = self.day_w[c][sel]
                lst.append((ords[sel], w / w.sum()))
            self.day_choice[c] = lst

    def pick_days(self, c: str, t: int, n: int, rng=None) -> np.ndarray:
        o, p = self.day_choice[c][t]
        return (rng or self.rng).choice(o, size=n, p=p)

    # ------------------------------------------------------------------ monthly factors
    def build_factors(self):
        P, T, sig = self.P, self.T, self.signal
        tt = (np.arange(T) - self.t_ref) / 12.0
        ones = np.ones(T)
        self.trend = {c: {p: (np.exp(P["countries"][c]["trend"][p] * tt) if sig else ones.copy())
                          for p in PRODUCTS} for c in COUNTRIES}
        dg, rs = P["dengue"], P["respiratory"]
        self.D, self.R, self.compA, self.seasA = {}, {}, {}, {}
        for c in COUNTRIES:
            shape = np.array(dg["shape"][c], float)
            shape /= shape.mean()
            yi = {int(k): v for k, v in dg["year_index"][c].items()}
            ybar = np.mean(list(yi.values()))
            D = dg["floor"] + (1 - dg["floor"]) * np.array([yi[y] for y in self.year]) / ybar * shape[self.mon - 1]
            D = 1 + self.dengue_scale * (D - 1)
            rsh = np.array(rs["shape"][c], float)
            rsh /= rsh.mean()
            R = rsh[self.mon - 1].copy()
            for wv in rs["waves"]:
                if wv["country"] == c:
                    for m in wv["months"]:
                        if m in self.mi:
                            R[self.mi[m]] *= wv["mult"]
            if not sig:
                D, R = ones.copy(), ones.copy()
            self.D[c], self.R[c] = D, R
            wdg = P["product_a_groups"]["dengue_share"][c]
            wrs = P["product_a_groups"]["respiratory_share"][c]
            parts = np.vstack([wdg * D, wrs * R, np.full(T, 1 - wdg - wrs)]).T
            self.compA[c] = parts / parts.sum(1, keepdims=True)
            self.seasA[c] = self.wd[c] * parts.sum(1)
        pb = P["product_b"]
        acad = np.array(pb["academic_shape"], float)
        acad = acad / acad.mean()
        self.acad = acad[self.mon - 1] if sig else ones.copy()
        self.pubflush = {}
        for c in COUNTRIES:
            fy0 = P["countries"][c]["fy_start_month"]
            fy_end = (fy0 - 2) % 12 + 1
            f = np.where(self.mon == fy_end, pb["fy_end_flush"], np.where(self.mon == fy0, pb["fy_start_dip"], 1.0))
            self.pubflush[c] = f if sig else ones.copy()
        self.cflush = {}
        for c in COUNTRIES:
            fw = np.array(P["product_c"]["flush_weights"][c], float)
            fw /= fw.mean()
            self.cflush[c] = fw[self.mon - 1] if sig else ones.copy()
        self.th_delay = ones.copy()
        if sig:
            d = P["product_c"]["th_budget_delay"]
            for m in d["cut_months"]:
                if m in self.mi:
                    self.th_delay[self.mi[m]] = d["cut"]
            for m in d["catchup_months"]:
                if m in self.mi:
                    self.th_delay[self.mi[m]] = d["catchup"]
        self.shock = {c: {p: ones.copy() for p in PRODUCTS} for c in COUNTRIES}
        if sig:
            for m, mult in P["myanmar"]["shocks"].items():
                if m in self.mi:
                    for p in PRODUCTS:
                        self.shock["MM"][p][self.mi[m]] = mult[p]
        self.macro = {}
        for c in COUNTRIES:
            sd = P["countries"][c]["macro_sd"]
            self.macro[c] = np.exp(self.rng.normal(0, sd, T) - sd * sd / 2)

    def seasB(self, c: str, seg: str) -> np.ndarray:
        fl = self.P["segments"][seg]["flush"]
        s = self.wd[c] * (1 + fl * (self.pubflush[c] - 1))
        if seg == "Research/academic":
            s = s * self.acad
        return s

    def seasC(self, c: str, seg: str) -> np.ndarray:
        fl = self.P["segments"][seg]["flush"]
        s = 1 + fl * (self.cflush[c] - 1)
        if c == "TH" and seg in ("Public hospital", "Research/academic"):
            s = s * self.th_delay
        return s

    # ------------------------------------------------------------------ items
    def build_items(self):
        P = self.P
        rows = []
        nums = {"A": 801, "B": 801, "C": 801}
        reserved = set(P["pinned"]["reserved_item_names"])
        for p, key in (("A", "items_a"), ("B", "items_b"), ("C", "items_c")):
            for it in P["items"][key]:
                name = it["name"]
                assert name not in reserved, f"reserved demo item in catalog: {name}"
                code = f"I-{p}-{nums[p]:06d}"
                nums[p] += int(self.rng.integers(1, 4))
                rows.append(dict(item_code=code, item_name=name, recorded_product=p, true_product=p,
                                 category=it["category"], true_category=it["category"],
                                 entity=P["product_entity"][p], unit_price_sgd=float(it["price"]),
                                 uom=it["uom"], item_group=it.get("group", {"A": "routine", "B": "consumable",
                                                                            "C": "instrument"}[p]),
                                 analyser=bool(it.get("analyser", False)), kind=it.get("kind", ""),
                                 weight=float(it["w"]), created_at="", miscat_of=""))
        # planted miscategorised duplicates: an A test kit re-created under Product B
        nb = 901
        for m in P["plants"]["miscategorisation"]["items"]:
            src = next(r for r in rows if r["item_name"] == m["true_item"])
            rows.append(dict(src, item_code=f"I-B-{nb:06d}", item_name=m["dup_name"], recorded_product="B",
                             true_product="A", category="Lab consumable", true_category=src["category"],
                             entity="QTG", created_at=m["created"], miscat_of=src["item_code"], weight=0.0))
            nb += int(self.rng.integers(2, 6))
        self.items = pd.DataFrame(rows)
        it = self.items
        self.item_idx = {n: i for i, n in enumerate(it["item_name"])}
        live = it["miscat_of"] == ""
        self.grp_items = {}
        for g in ("dengue", "respiratory", "routine"):
            idx = np.where(live & (it["true_product"] == "A") & (it["item_group"] == g))[0]
            w = it.loc[idx, "weight"].to_numpy()
            self.grp_items[g] = (idx, w / w.sum())
        idx = np.where(live & (it["true_product"] == "B"))[0]
        w = it.loc[idx, "weight"].to_numpy()
        self.b_items = (idx, w / w.sum())
        self.c_items = np.where(live & (it["true_product"] == "C"))[0]

    def c_weights(self, seg: str) -> np.ndarray:
        kw = self.P["c_kind_weights"][seg]
        it = self.items.loc[self.c_items]
        w = it["weight"].to_numpy() * np.array([kw[k] for k in it["kind"]])
        return w / w.sum()

    # ------------------------------------------------------------------ golden customers
    def build_customers(self):
        P, rng = self.P, self.rng
        segs = list(P["segments"])
        rows = []
        for c in COUNTRIES:
            n = P["countries"][c]["n_golden"]
            shares = np.array([P["segments"][s]["share"][c] for s in segs], float)
            shares /= shares.sum()
            counts = np.floor(shares * n).astype(int)
            for k in np.argsort(-(shares * n - counts))[: n - counts.sum()]:
                counts[k] += 1
            seg_list = [s for s, k in zip(segs, counts) for _ in range(k)]
            rng.shuffle(seg_list)
            for seg in seg_list:
                sp = P["segments"][seg]
                tiers = list(sp["tier_p"])
                tp = np.array([sp["tier_p"][t] for t in tiers], float)
                tier = tiers[rng.choice(len(tiers), p=tp / tp.sum())]
                td = P["size_tiers"][tier]
                size = float(rng.lognormal(np.log(td["median"]), td["sd"]))
                buys = {p: bool(rng.random() < sp["p_buy"][p]) for p in PRODUCTS}
                if not any(buys.values()):
                    buys[max(sp["mix"], key=sp["mix"].get)] = True
                rows.append(dict(country=c, segment=seg, tier=tier, size=size, buys=buys, plant=[],
                                 idio=float(rng.normal(0, P["customer_dynamics"]["idio_growth_sd"])),
                                 start_t=0, churn_t=None, contract_end="", contract_lost=False,
                                 hero=None, expander=False))
        self.cust = rows
        self.assign_plants()
        # value per product, scaled per country so totals and the A:B:C mix hit params
        mixT = P["product_mix_target"]
        for c in COUNTRIES:
            idx = [i for i, r in enumerate(rows) if r["country"] == c]
            V = np.zeros((len(idx), 3))
            for k, i in enumerate(idx):
                r = rows[i]
                mix = np.array([P["segments"][r["segment"]]["mix"][p] * r["buys"][p] for p in PRODUCTS])
                if mix.sum() == 0:
                    mix = np.array([1.0 * r["buys"][p] for p in PRODUCTS])
                V[k] = r["size"] * mix / mix.sum()
            tot = P["countries"][c]["value_sgd"]
            for j, p in enumerate(PRODUCTS):
                s = V[:, j].sum()
                if s > 0:
                    V[:, j] *= mixT[p] * tot / s
            for k, i in enumerate(idx):
                rows[i]["base"] = {p: float(V[k, j]) for j, p in enumerate(PRODUCTS)}
        # hero sizing: the planted hero sits at its configured rank among ALL customers of its country, with a
        # margin over the next one so that, after the planted decline, it is still a top account
        tot = lambda i: sum(rows[i]["base"].values())  # noqa: E731

        def scale(i, f):
            for p in PRODUCTS:
                rows[i]["base"][p] *= f

        for c, share in P["plants"]["misattribution"]["size_share"].items():
            i = self.mis_primary[c]
            scale(i, share * P["countries"][c]["value_sgd"] / tot(i))
        for c, h in P["plants"]["hero"].items():
            idx = [i for i, r in enumerate(rows) if r["country"] == c]
            hi = next(i for i in idx if rows[i]["hero"])
            if not h.get("margin"):
                # key account: as big as the rank-th largest other account; nobody else is resized
                others = sorted([i for i in idx if i != hi], key=lambda i: -tot(i))
                scale(hi, tot(others[h["rank"] - 1]) / tot(hi))
                continue
            above = sorted([i for i in idx if rows[i].get("hero_above") == c], key=lambda i: -tot(i))
            below = sorted([i for i in idx if i != hi and i not in above], key=lambda i: -tot(i))
            target = tot(below[0]) * h["margin"]
            scale(hi, target / tot(hi))
            for k, i in enumerate(above):
                need = target * (1.12 + 0.1 * (len(above) - 1 - k))
                if tot(i) < need:
                    scale(i, need / tot(i))
        # keep each country's product totals on target: one uniform factor per country x product
        for c in COUNTRIES:
            idx = [i for i, r in enumerate(rows) if r["country"] == c]
            for p in PRODUCTS:
                cur = sum(rows[i]["base"][p] for i in idx)
                if cur > 0:
                    f = mixT[p] * P["countries"][c]["value_sgd"] / cur
                    for i in idx:
                        rows[i]["base"][p] *= f
        # golden IDs by size within country
        for c in COUNTRIES:
            idx = sorted([i for i, r in enumerate(rows) if r["country"] == c],
                         key=lambda i: -sum(rows[i]["base"].values()))
            for k, i in enumerate(idx):
                rows[i]["golden_id"] = f"G-{c}-{k + 1:04d}"
                rows[i]["rank"] = k + 1

    def assign_plants(self):
        P, rng, rows = self.P, self.rng, self.cust
        taken: set[int] = set()

        def hospitals(c, lo=1, hi=999, need_A=False):
            hs = sorted([i for i, r in enumerate(rows) if r["country"] == c and r["segment"] in HOSP],
                        key=lambda i: -rows[i]["size"])
            return [i for k, i in enumerate(hs, 1) if lo <= k <= hi and i not in taken
                    and (not need_A or rows[i]["buys"]["A"])]

        for c, h in P["plants"]["hero"].items():
            hs_all = hospitals(c)
            i = hs_all[h["rank"] - 1] if h["rank"] - 1 < len(hs_all) else hs_all[0]
            for j in hs_all[: h["rank"] - 1]:
                rows[j]["hero_above"] = c
                taken.add(j)
            r = rows[i]
            r["hero"] = c
            r["plant"].append(f"hero_{c.lower()}")
            r["buys"].update(A=True, B=True, C=False)
            if c == "MY":
                r["segment"] = "Private hospital"
            r["tier"] = "L"
            r["idio"] = 0.0
            taken.add(i)
        # misattribution primary hospital (sized in build_customers so the moved share lands in 3-8%)
        self.mis_primary = {}
        for c in P["plants"]["misattribution"]["target_share"]:
            i = hospitals(c, 1, 12, need_A=True)[0]
            rows[i]["mis_primary"] = c
            rows[i]["buys"].update(A=True, B=True)
            taken.add(i)
            self.mis_primary[c] = i
        # TH false cross-sell gap: A (SPD record) + C (QTS record), never B
        i = hospitals("TH", 4, 14)[0]
        rows[i]["buys"].update(A=True, B=False, C=True)
        rows[i]["plant"].append("false_crosssell_th")
        taken.add(i)
        # MM romanisation pair: SPD record + QTG record with a different romanisation
        i = hospitals("MM", 3, 12)[0]
        rows[i]["buys"].update(A=True, B=True)
        rows[i]["plant"].append("romanisation_mm")
        taken.add(i)
        # VN: hospitals that buy A but never B
        for i in hospitals("VN", 4, 40)[: P["plants"]["vn_xsell_gap"]["count"]]:
            rows[i]["buys"].update(A=True, B=False)
            rows[i]["plant"].append("xsell_gap_vn")
            taken.add(i)
        # MY expanders: growth sits in 3 hospitals
        for i in hospitals("MY", 8, 30, need_A=True)[: P["plants"]["my_expanders"]["count"]]:
            rows[i]["expander"] = True
            rows[i]["plant"].append("expander_my")
            taken.add(i)
        # MY reagent-rental contracts: clustered expiries (wave 1 in the window, wave 2 in Q1 2027)
        mc = P["plants"]["my_contracts"]
        pool = hospitals("MY", 1, 999, need_A=True)
        rng.shuffle(pool)
        pool.sort(key=lambda i: rows[i]["segment"] != "Public hospital")
        wave1 = pool[: mc["wave1_count"]]
        lost = sorted(wave1, key=lambda i: -rows[i]["size"])[1: 1 + mc["wave1_lost"]]
        for i in wave1:
            rows[i]["contract_end"] = str(rng.choice(mc["wave1_expiry"]))
            if i in lost:
                rows[i]["contract_lost"] = True
                rows[i]["plant"].append("contract_churn_my")
                taken.add(i)
        wave2 = [i for i in pool[mc["wave1_count"]:] if i not in taken][: mc["wave2_count"]]
        for i in wave2:
            rows[i]["contract_end"] = str(rng.choice(mc["wave2_expiry"]))
            rows[i]["plant"].append("contract_q1_2027_my")
        for i, r in enumerate(rows):
            if r["country"] == "MY" and r["segment"] in HOSP and not r["contract_end"]:
                r["contract_end"] = add_months("2026-04", int(rng.integers(0, 42)))
        # misattribution candidates (chosen after demand is generated, by share of country value)
        self.mis_cands = {c: [self.mis_primary[c]] + [i for i in hospitals(c, 2, 12, need_A=True) if i not in taken]
                          for c in P["plants"]["misattribution"]["target_share"]}
        reserved = taken | {i for v in self.mis_cands.values() for i in v}
        # near-miss NON-duplicates (sister sites with near-identical names)
        self.near_miss = []
        for c, k in P["duplicates"]["near_miss_pairs"].items():
            cand = [i for i, r in enumerate(rows) if r["country"] == c and i not in reserved
                    and r["segment"] in ("Private hospital", "Clinic", "Diagnostic lab")]
            for _ in range(k):
                if len(cand) < 2:
                    break
                a, b = cand[0], cand[1]
                cand = cand[2:]
                rows[a]["segment"] = rows[b]["segment"] = rows[a]["segment"]
                rows[a]["plant"].append("near_miss")
                rows[b]["plant"].append("near_miss")
                self.near_miss.append((a, b))
                reserved |= {a, b}
        # generic duplicates
        self.generic_dups = []
        for c, k in P["duplicates"]["generic_per_country"].items():
            cand = [i for i, r in enumerate(rows) if r["country"] == c and i not in reserved
                    and r["segment"] != "Clinic"]
            w = np.array([rows[i]["size"] ** 0.7 for i in cand])
            pick = rng.choice(cand, size=min(k, len(cand)), replace=False, p=w / w.sum())
            for i in pick:
                rows[i]["plant"].append("generic_dup")
                self.generic_dups.append(int(i))
                reserved.add(int(i))
        # lifecycle: new customers and generic churners (signal scenarios only)
        cd = P["customer_dynamics"]
        free = [i for i, r in enumerate(rows) if i not in reserved]
        rng.shuffle(free)
        n_new = int(round(cd["new_customer_share"] * len(rows)))
        n_churn = int(round(cd["churn_share"] * len(rows)))
        new = [i for i in free if rows[i]["tier"] != "L"][:n_new]
        churn = [i for i in free if i not in new][:n_churn]
        if self.signal:
            for i in new:
                rows[i]["start_t"] = int(rng.integers(3, self.T - 3))
                rows[i]["plant"].append("new_customer")
            for i in churn:
                rows[i]["churn_t"] = int(rng.integers(8, self.T - 1))
                rows[i]["plant"].append("churner")

    # ------------------------------------------------------------------ demand
    def lifecycle(self, r: dict) -> dict:
        """Per-product multiplier path for one customer (start, churn, planted patterns)."""
        T, P = self.T, self.P
        L = {p: np.ones(T) for p in PRODUCTS}
        if not self.signal:
            return L
        if r["start_t"] > 0:
            ramp = P["customer_dynamics"]["new_customer_ramp"]
            for p in PRODUCTS:
                L[p][: r["start_t"]] = 0
                for k, v in enumerate(ramp):
                    if r["start_t"] + k < T:
                        L[p][r["start_t"] + k] *= v
        if r["churn_t"] is not None:
            tap = P["customer_dynamics"]["churn_taper_months"]
            ct = r["churn_t"]
            for p in PRODUCTS:
                for k in range(tap):
                    t = ct - tap + k
                    if 0 <= t < T:
                        L[p][t] *= 1 - 0.75 * (k + 1) / tap
                L[p][ct:] = 0
        if r["contract_lost"]:
            e = self.mi.get(r["contract_end"], T)
            tap = P["plants"]["my_contracts"]["taper_months"]
            for k in range(tap):
                t = e - tap + k
                if 0 <= t < T:
                    L["A"][t] *= 1 - 0.7 * (k + 1) / tap
            L["A"][e:] = 0
            L["B"][e:] *= 0.7
        if r["expander"]:
            ex = P["plants"]["my_expanders"]
            a, b = self.mi[ex["ramp_start"]], self.mi[ex["ramp_end"]]
            for t in range(T):
                f = 0 if t < a else (1 if t >= b else (t - a) / (b - a))
                L["A"][t] *= 1 + ex["lift"] * f
        if r["hero"]:
            h = P["plants"]["hero"][r["hero"]]
            p0, p1 = self.mi[P["time"]["prior_start"]], self.mi[P["time"]["prior_end"]]
            rs, sw = self.mi[h["ramp_start"]], self.mi[h["switch"]]
            m = np.ones(T)
            for t in range(T):
                if p0 <= t <= p1:
                    m[t] = 1 - h["prior_decline"] * (t - p0) / max(p1 - p0, 1)
                elif rs <= t < sw:
                    m[t] = h["ramp_from"] + (h["ramp_to"] - h["ramp_from"]) * (t - rs) / max(sw - 1 - rs, 1)
                elif t >= sw:
                    m[t] = h["level"]
            L["A"] *= m
            if r["hero"] != "MY":
                L["B"] *= m
        return L

    def build_demand(self):
        P, T = self.P, self.T
        rng = self.rng_ab
        rc = self.rng_c
        cd = P["customer_dynamics"]
        p_join = cd["lines_per_po_p"]
        it = self.items
        prices = it["unit_price_sgd"].to_numpy()
        pc = P["product_c"]
        cols = defaultdict(list)
        self.po_counter = 0
        self.uplift_log = []

        def add_lines(i, c, entity, prod, t, item_idx, units, sgd, r=None):
            r = r or rng
            n = len(item_idx)
            n_po = 1 + int(r.binomial(n - 1, 1 - p_join)) if n > 1 else 1
            po_of = np.concatenate([np.arange(n_po), r.integers(0, n_po, n - n_po)])
            days = self.pick_days(c, t, n_po, r)
            u = r.random(n_po)
            cols["gi"].extend([i] * n)
            cols["entity"].extend([entity] * n)
            cols["product"].extend([prod] * n)
            cols["item"].extend(item_idx.tolist())
            cols["units"].extend(units.tolist())
            cols["sgd"].extend(sgd.tolist())
            cols["date"].extend(days[po_of].tolist())
            cols["po_key"].extend((self.po_counter + po_of).tolist())
            cols["u"].extend(u[po_of].tolist())
            self.po_counter += n_po

        for i, r in enumerate(self.cust):
            # per-customer random streams: changing one account's parameters never reshuffles another's draws
            rng = np.random.default_rng([self.seed, 1, i])
            rc = np.random.default_rng([self.seed, 2, i])
            c, seg, tier = r["country"], r["segment"], r["tier"]
            td = P["size_tiers"][tier]
            k_shape = 1.0 / td["noise_cv"] ** 2
            disc = float(np.clip(td["discount"] + rng.normal(0, 0.01), 0, 0.3))
            r["discount"] = disc
            npf = P["countries"][c]["price_factor"] * (1 - disc)
            growth = np.exp(r["idio"] * (np.arange(T) - self.t_ref) / 12) if self.signal else np.ones(T)
            L = self.lifecycle(r)
            U = np.zeros(T)
            # ---- Product C: rare, lumpy instrument POs, timed by fiscal-year flush
            if r["base"]["C"] > 0:
                w = self.c_weights(seg)
                exp_price = float((prices[self.c_items] * w).sum())
                lam0 = r["base"]["C"] / (exp_price * npf) / 12
                s = self.seasC(c, seg) * self.trend[c]["C"] * growth * L["C"] * self.shock[c]["C"]
                ns = rc.poisson(lam0 * s)
                for t in np.nonzero(ns)[0]:
                    k = int(ns[t])
                    items = self.c_items[rc.choice(len(self.c_items), size=k, p=w)]
                    units = np.where((prices[items] < 15000) & (rc.random(k) < 0.3), 2, 1)
                    sgd = np.round(units * prices[items] * npf, 2)
                    for j in range(k):
                        add_lines(i, c, "QTS", "C", int(t), items[j:j + 1], units[j:j + 1], sgd[j:j + 1], rc)
                        if (self.signal and it.at[items[j], "analyser"] and r["buys"]["A"]
                                and rc.random() < pc["new_placement_share"] and t + 1 < T):
                            add = float(sgd[j]) * pc["pull_through_ratio"] / 12
                            U[t + 1:] += add
                            self.uplift_log.append((i, int(t), float(sgd[j])))
            r["uplift_end"] = float(U[-1])
            # ---- Products A and B
            for p in ("A", "B"):
                if r["base"][p] <= 0:
                    continue
                if p == "A":
                    seas = self.seasA[c]
                else:
                    seas = self.seasB(c, seg)
                lvl = r["base"][p] / 12 * self.trend[c][p] * growth
                if p == "A":
                    lvl = lvl + U  # installed-base pull-through (a cross-sell signal, never a forecast feature)
                E = lvl * L[p] * seas * self.shock[c][p] * self.macro[c]
                V = E * rng.gamma(k_shape, 1 / k_shape, T)
                ent = P["product_entity"][p]
                # stable basket: each customer buys a fixed set of SKUs in fixed proportions; each SKU is
                # re-ordered when the accumulated need passes its reorder value (per-item backlog)
                bk = cd["basket_size"][p][tier]
                if p == "A":
                    items, gw, grp = [], [], []
                    for g, gname in enumerate(("dengue", "respiratory", "routine")):
                        gi_, gpw = self.grp_items[gname]
                        k = min(len(gi_), int(rng.integers(bk[gname][0], bk[gname][1] + 1)))
                        pick = rng.choice(len(gi_), size=k, replace=False, p=gpw)
                        w = rng.dirichlet(np.full(k, 2.0)) * gpw[pick]
                        items += gi_[pick].tolist()
                        gw += (w / w.sum()).tolist()
                        grp += [g] * k
                    items, gw, grp = np.array(items), np.array(gw), np.array(grp)
                    alloc = V[:, None] * self.compA[c][:, grp] * gw[None, :]
                else:
                    bi, bw = self.b_items
                    k = min(len(bi), int(rng.integers(bk[0], bk[1] + 1)))
                    pick = rng.choice(len(bi), size=k, replace=False, p=bw)
                    w = rng.dirichlet(np.full(k, 2.0)) * bw[pick]
                    items, gw = bi[pick], w / w.sum()
                    alloc = V[:, None] * gw[None, :]
                net = prices[items] * npf
                base_ro = cd["reorder_value_sgd"][p] * rng.uniform(0.6, 1.4, len(items))
                reorder = np.maximum(net, base_ro)
                bl = rng.uniform(0, 1, len(items)) * reorder  # start mid-cycle
                for t in range(T):
                    if L[p][t] == 0:
                        bl[:] = 0
                        continue
                    bl += alloc[t]
                    o = bl >= reorder
                    if not o.any():
                        continue
                    units = np.floor(bl[o] / net[o]).astype(int)
                    keep = units > 0
                    if not keep.any():
                        continue
                    idx = np.nonzero(o)[0][keep]
                    units = units[keep]
                    sgd = np.round(units * net[idx], 2)
                    bl[idx] -= units * net[idx]
                    # order sizes vary: redraw the next reorder point, so reorders are not strictly periodic
                    j = cd["reorder_jitter"]
                    reorder[idx] = np.maximum(net[idx], base_ro[idx] * rng.uniform(1 - j, 1 + j, len(idx)))
                    add_lines(i, c, ent, p, t, items[idx], units, sgd)
        L = pd.DataFrame(cols)
        L["country"] = [self.cust[g]["country"] for g in L["gi"]]
        L["month"] = [month_of(o) for o in L["date"]]
        self.lines = L

    # ------------------------------------------------------------------ records, routing, plants
    def new_record(self, gi, entity, country, created, canonical, perturbation="", name=None, **kw):
        rec = dict(rid=len(self.records), gi=gi, entity=entity, recorded_country=country, created=int(created),
                   canonical=canonical, perturbation=perturbation, card_name=name)
        rec.update(kw)
        self.records.append(rec)
        return rec["rid"]

    def build_records(self):
        P, rng, L = self.P, self.rng, self.lines
        self.records = []
        self.rules = defaultdict(list)  # gi -> [(entities|None, from_ord, to_ord, prob, rid)]
        first = L.groupby("gi")["date"].min()
        ent_val = L.groupby(["gi", "entity"])["sgd"].sum()
        lo, hi = date(2008, 1, 1).toordinal(), date(2023, 6, 30).toordinal()
        cdays = P["customer_dynamics"]["record_created_before_first_po_days"]
        for i, r in enumerate(self.cust):
            if i in ent_val.index.get_level_values(0):
                ev = ent_val.loc[i]
                ent = ev.idxmax()
            else:
                ent = P["product_entity"][max(r["base"], key=r["base"].get)]
            if r["start_t"] > 0 and i in first.index:
                created = int(first.loc[i]) - int(rng.integers(cdays[0], cdays[1] + 1))
            else:
                created = int(rng.integers(lo, hi))
            r["canon_entity"] = ent
            r["canon_rid"] = self.new_record(i, ent, r["country"], created, True)
        hero_p = P["plants"]["hero"]
        # heroes
        for i, r in enumerate(self.cust):
            if not r["hero"]:
                continue
            c = r["hero"]
            h = hero_p[c]
            sw = self.mo(h["switch"])
            r["created_override"] = int(rng.integers(date(2012, 1, 1).toordinal(), date(2016, 12, 31).toordinal()))
            self.records[r["canon_rid"]]["created"] = r["created_override"]
            self.records[r["canon_rid"]]["entity"] = "SPD"
            created2 = sw - int(rng.integers(8, 25))
            if c == "MY":
                rid2 = self.new_record(i, "SPD", c, created2, False, "abbreviation;blank_tax_id",
                                       role="hero_new", force_blank_tax=True)
                rid3 = self.new_record(i, "QTS", c, date(2019, 8, 14).toordinal(), False,
                                       "word_reorder;cross_entity", role="hero_flat")
                self.rules[i].append(({"SPD"}, sw, INF, 1.0, rid2))
                self.rules[i].append(({"QTG", "QTS"}, -INF, INF, 1.0, rid3))
                self.records[r["canon_rid"]]["role"] = "hero_lost"
            else:
                pert = {"SG": "abbreviation;address_format", "TH": "romanisation;cross_entity;blank_tax_id",
                        "VN": "romanisation;blank_tax_id", "MM": "romanisation;typo"}[c]
                ent2 = "QTG" if c == "TH" else "SPD"
                rid2 = self.new_record(i, ent2, c, created2, False, pert, role="hero_new",
                                       force_blank_tax="blank_tax_id" in pert)
                self.rules[i].append((None, sw, INF, 1.0, rid2))
                self.records[r["canon_rid"]]["role"] = "hero_lost"
        # TH false cross-sell: QTS record carries all C
        for i, r in enumerate(self.cust):
            if "false_crosssell_th" in r["plant"]:
                self.records[r["canon_rid"]]["entity"] = "SPD"
                rid = self.new_record(i, "QTS", "TH", self.mo(P["plants"]["th_false_xsell"]["created"][:7]) + 11,
                                      False, "romanisation;abbreviation;cross_entity", role="xsell_c_only")
                self.rules[i].append(({"QTS"}, -INF, INF, 1.0, rid))
                self.records[r["canon_rid"]]["role"] = "xsell_a_only"
            if "romanisation_mm" in r["plant"]:
                self.records[r["canon_rid"]]["entity"] = "SPD"
                rid = self.new_record(i, "QTG", "MM", date(2021, 2, 3).toordinal(), False,
                                      "romanisation;cross_entity", role="romanisation_qtg")
                self.rules[i].append(({"QTG"}, -INF, INF, 1.0, rid))
        # generic duplicates
        dp = P["duplicates"]
        for i in self.generic_dups:
            r = self.cust[i]
            c = r["country"]
            ents = sorted({P["product_entity"][p] for p in PRODUCTS if r["buys"][p] and r["base"][p] > 0})
            other = [e for e in ents if e != r["canon_entity"]]
            if other and rng.random() < 0.7:
                ent = str(rng.choice(other))
                cross = True
            else:
                ent, cross = r["canon_entity"], False
            if rng.random() < 0.6:
                created = int(rng.integers(self.mo("2023-11"), self.mo("2026-07")))
            else:
                created = int(rng.integers(date(2016, 1, 1).toordinal(), self.d_first - 30))
            created = max(created, self.records[r["canon_rid"]]["created"] + 30)
            perts = [str(rng.choice(dp["name_perturbations"][c]))]
            if rng.random() < dp["second_perturbation_p"]:
                extra = [x for x in dp["name_perturbations"][c] if x not in perts]
                if extra:
                    perts.append(str(rng.choice(extra)))
            if rng.random() < dp["blank_tax_id_p"][c]:
                perts.append("blank_tax_id")
            if rng.random() < dp["address_format_p"]:
                perts.append("address_format")
            if cross:
                perts.append("cross_entity")
            used = rng.random() > dp["generic_no_transactions_share"]
            rid = self.new_record(i, ent, c, created, False, ";".join(perts), role="generic_dup",
                                  force_blank_tax="blank_tax_id" in perts)
            if used:
                self.rules[i].append(({ent}, created, INF, 1.0 if cross else 0.5, rid))

    def route(self):
        L = self.lines
        rid = np.array([self.cust[g]["canon_rid"] for g in L["gi"]])
        ent = L["entity"].to_numpy()
        d = L["date"].to_numpy()
        u = L["u"].to_numpy()
        gi = L["gi"].to_numpy()
        for g, rules in self.rules.items():
            m0 = gi == g
            for ents, a, b, prob, r in rules:
                m = m0 & (d >= a) & (d < b) & (u < prob)
                if ents is not None:
                    m &= np.isin(ent, list(ents))
                rid[m] = r
        L["rid"] = rid

    def plant_misattribution(self):
        P, L = self.P, self.lines
        mp = P["plants"]["misattribution"]
        start = self.mo(mp["start"])
        cur = set(self.win["current"])
        L_cur = L[L["month"].isin(cur)]
        ctot = L_cur.groupby("country")["sgd"].sum()
        self.mis = {}
        for c, target in mp["target_share"].items():
            created = date.fromisoformat(mp["record_created"][c]).toordinal()
            need = target
            for n_h, i in enumerate(self.mis_cands[c][:2]):
                m_all = (L["gi"] == i) & (L["date"] >= created)
                m_cur = m_all & L["month"].isin(cur)
                ents = list(mp["entities"])
                share = L.loc[m_cur & L["entity"].isin(ents), "sgd"].sum() / ctot[c]
                if share < need:
                    ents = ["SPD", "QTG"]
                    share = L.loc[m_cur & L["entity"].isin(ents), "sgd"].sum() / ctot[c]
                q = min(1.0, need / share) if share > 0 else 1.0
                r = self.cust[i]
                tag = f"misattribution_{c.lower()}" + ("" if n_h == 0 else "_2")
                r["plant"].append(tag)
                pert = "abbreviation;blank_tax_id" if c == "MY" else "romanisation;blank_tax_id"
                rid = self.new_record(i, "SPD", "SG", created + 3 * n_h, False, pert, role="misattributed_sg",
                                      force_blank_tax=True)
                m = m_all & L["entity"].isin(ents) & (L["u"] < q)
                L.loc[m, "rid"] = rid
                self.mis.setdefault(c, []).append(dict(gi=i, rid=rid, q=q, entities=ents))
                need -= share * q
                if need <= 0.002:
                    break

    def plant_miscategorisation(self):
        P, L, it = self.P, self.lines, self.items
        L["item_rec"] = L["item"]
        for m in P["plants"]["miscategorisation"]["items"]:
            src = self.item_idx[m["true_item"]]
            dup = self.item_idx[m["dup_name"]]
            created = date.fromisoformat(m["created"]).toordinal()
            sel = ((L["item"] == src) & L["country"].isin(m["countries"]) & (L["date"] >= created)
                   & (self.rng.random(len(L)) < m["use_share"]))
            L.loc[sel, "item_rec"] = dup

    # ------------------------------------------------------------------ names, addresses, ids
    def build_names(self):
        """Fictional names. A similarity guard stops accidental near-duplicates between different customers,
        so the only look-alike non-duplicates are the planted near-miss pairs."""
        from rapidfuzz import fuzz
        from rapidfuzz.distance import JaroWinkler
        P, rng = self.P, self.rng
        pools = {
            "SG": ([f"{a} {b}" for a in SG_PLACES for b in SG_SUFFIX], SG_BRANDS),
            "MY": ([f"{a} {b}" for a in MY_PREFIX for b in MY_SUFFIX], MY_BRANDS),
            "TH": ([f"{a} {b}" for a in TH_FIRST for b in TH_SECOND if a != b], TH_BRANDS),
            "VN": ([f"{a} {b}" for a in VN_FIRST for b in VN_SECOND if a != b and f"{a} {b}" not in VN_AVOID],
                   VN_BRANDS),
            "MM": ([f"{a} {b}" for a in MM_FIRST for b in MM_SECOND if a != b], MM_BRANDS),
        }
        stems_left, brands_left = {}, {}
        for c, (st, br) in pools.items():
            st, br = list(st), list(br)
            rng.shuffle(st)
            rng.shuffle(br)
            stems_left[c], brands_left[c] = st, br
        used_names: set[str] = set()
        used_norm = defaultdict(list)
        used_tok = defaultdict(lambda: defaultdict(int))

        def norm(s):
            s = strip_diacritics(s).lower()
            s = re.sub(r"[^a-z0-9 ]", " ", s)
            s = re.sub(r"(pte ltd|sdn bhd|co ltd|jsc|tnhh|cong ty|cp)", " ", s)
            return " ".join(s.split())

        def ok(name, c):
            n = norm(name)
            dn = {t for t in n.split() if t not in GENERIC_ASCII}
            for m in used_norm[c]:
                dm = {t for t in m.split() if t not in GENERIC_ASCII}
                if dn == dm or fuzz.token_set_ratio(n, m) >= 95:
                    return False
                if dn & dm and (fuzz.token_set_ratio(n, m) >= 80 or fuzz.ratio(n, m) >= 80
                                or JaroWinkler.normalized_similarity(n, m) >= 0.90):
                    return False
            return True

        def register(name, c):
            used_names.add(name)
            used_norm[c].append(norm(name))
            for t in norm(name).split():
                if t not in GENERIC_TOKENS:
                    used_tok[c][t] += 1

        plant_names = {
            "hero_my": ("Bukit Damai", "{s} Specialist Hospital"),
            "hero_sg": ("Tanjong Rhu Crest", "{s} Medical Centre"),
            "hero_th": ("Chao Phraya Rim", "{s} Hospital"),
            "hero_vn": ("Hồng Lạc", "general_hospital"),
            "hero_mm": ("Thukha Yeik", "{s} Specialist Hospital"),
            "false_crosssell_th": ("Sri Chaloem", "{s} Hospital"),
            "romanisation_mm": ("Aung Myittar", "{s} Hospital"),
            "misattribution_my": ("Taman Seri", None),
            "misattribution_vn": ("Sông Sen", None),
        }
        near_stems = {"SG": "Lavender Bay", "MY": "Seri Mutiara", "TH": "Siam Riverside", "VN": "Bình An",
                      "MM": "Thiri Mingalar"}
        near_suffix = {"SG": ("(Bedok)", "(Jurong East)"), "MY": ("Ipoh", "Klang"), "TH": ("Chiang Mai", "Phuket"),
                       "VN": None, "MM": None}
        nm_members = {}
        for a, b in self.near_miss:
            nm_members[a] = (b, 0)
            nm_members[b] = (a, 1)
        # pass 1: planted and near-miss names (fixed)
        for i, r in enumerate(self.cust):
            c, seg = r["country"], r["segment"]
            key = next((k for k in r["plant"] if k in plant_names), None)
            if key:
                stem, tpl = plant_names[key]
                if tpl is None:
                    if c == "VN":
                        tpl = "general_hospital" if seg == "Public hospital" else "intl_hospital"
                    elif c == "MY":
                        tpl = "Hospital {s}" if seg == "Public hospital" else "{s} Medical Centre"
                    else:
                        tpl = TEMPLATES[c][seg][0]
            elif i in nm_members:
                stem = near_stems[c]
                k = nm_members[i][1]
                if c == "VN":
                    tpl = ["general_hospital", "polyclinic"][k]
                elif c == "MM":
                    tpl = ["{s} Hospital", "{s} Clinic"][k]
                elif c == "TH":
                    tpl = "{s} Hospital " + near_suffix[c][k]
                else:
                    tpl = {"Private hospital": "{s} Medical Centre", "Clinic": "{s} Family Clinic",
                           "Diagnostic lab": "{s} Pathology Lab"}.get(seg, "{s} Medical Centre") + " " + near_suffix[c][k]
            else:
                continue
            r["stem"], r["tpl"] = stem, tpl
            r["vn_lang"] = "vi" if c == "VN" else ""
            r["name"] = self.render(r)
            register(r["name"], c)
        # pass 2: everyone else
        for i, r in enumerate(self.cust):
            if r.get("name"):
                continue
            c, seg = r["country"], r["segment"]
            r["vn_lang"] = ("vi" if rng.random() < 0.7 else "en") if c == "VN" else ""
            tpls = list(TEMPLATES[c][seg])
            rng.shuffle(tpls)
            done = False
            for tpl in tpls:
                is_brand = VN_KINDS[tpl][3] if c == "VN" else "{b}" in tpl
                pool = brands_left[c] if is_brand else stems_left[c]
                for k in range(len(pool) - 1, -1, -1):
                    r["stem"], r["tpl"] = pool[k], tpl.replace("{b}", "{s}")
                    name = self.render(r)
                    if name not in used_names and ok(name, c):
                        pool.pop(k)
                        done = True
                        break
                if done:
                    break
            if not done:  # pools exhausted: fall back to a stem with a district qualifier
                for k in range(len(stems_left[c]) - 1, -1, -1):
                    for q in ("North", "East", "West", "South", "Central"):
                        r["stem"], r["tpl"] = f"{stems_left[c][k]} {q}", tpls[0].replace("{b}", "{s}")
                        name = self.render(r)
                        if name not in used_names and ok(name, c):
                            done = True
                            break
                    if done:
                        stems_left[c].pop(k)
                        break
            if not done:
                raise RuntimeError(f"could not name a {seg} in {c}")
            r["name"] = self.render(r)
            register(r["name"], c)
        # guard the pinned NUH demo: no SG name may contain national/university tokens
        for r in self.cust:
            if r["country"] == "SG":
                low = r["name"].lower()
                assert not re.search(r"(national|natl|university|univ|nuh)", low), r["name"]

    def render(self, r: dict, lang: str | None = None) -> str:
        c = r["country"]
        if c == "VN":
            vi, en, ab, _ = VN_KINDS[r["tpl"]]
            lang = lang or r["vn_lang"]
            if lang == "vi":
                return vi.format(s=r["stem"])
            if lang == "vi_ascii":
                return strip_diacritics(vi.format(s=r["stem"]))
            if lang == "abbr":
                return ab.format(s=r["stem"])
            return en.format(s=strip_diacritics(r["stem"]))
        return r["tpl"].format(s=r["stem"])

    # ---- perturbations (deliberately NOT mirrored in the TS normaliser, except abbreviations) [DS5]
    def p_abbreviation(self, name: str, r: dict) -> str:
        if r["country"] == "VN":
            return self.render(r, "abbr")
        out = name
        hits = [(a, b) for a, b in ABBREV if a in out and a != b]
        if not hits:
            return out
        k = min(len(hits), 1 + int(self.rng.random() < 0.6))
        for a, b in hits[:k]:
            out = out.replace(a, b, 1)
        return out

    def p_typo(self, name: str, r: dict) -> str:
        toks = name.split()
        cand = [k for k, t in enumerate(toks) if len(t) >= 4 and t.lower().strip(".,") not in GENERIC_TOKENS]
        if not cand:
            cand = [k for k, t in enumerate(toks) if len(t) >= 4] or [0]
        k = int(self.rng.choice(cand))
        t = toks[k]
        op = int(self.rng.integers(0, 4))
        j = int(self.rng.integers(1, max(2, len(t) - 1)))
        if op == 0 and j + 1 < len(t):
            t = t[:j] + t[j + 1] + t[j] + t[j + 2:]
        elif op == 1:
            t = t[:j] + t[j + 1:]
        elif op == 2:
            t = t[:j] + t[j] + t[j:]
        else:
            vow = {"a": "e", "e": "a", "i": "y", "o": "u", "u": "o"}
            vs = [q for q in range(1, len(t)) if t[q] in vow]
            if vs:
                q = int(self.rng.choice(vs))
                t = t[:q] + vow[t[q]] + t[q + 1:]
            else:
                t = t[:j] + t[j + 1:]
        toks[k] = t
        return " ".join(toks)

    def p_word_reorder(self, name: str, r: dict) -> str:
        stem = r["stem"]
        if r["country"] == "VN":
            return self.render(r, "en" if r["vn_lang"] != "en" else "vi_ascii")
        if name.startswith(stem):
            rest = name[len(stem):].strip()
            return f"{rest}, {stem}" if rest else name
        if name.endswith(stem):
            rest = name[: -len(stem)].strip()
            return f"{stem} {rest}"
        if stem in name:
            pre, post = name.split(stem, 1)
            return f"{stem} {pre.strip()} {post.strip()}".strip()
        toks = name.split()
        return " ".join(toks[1:] + toks[:1])

    def p_romanisation(self, name: str, r: dict) -> str:
        c = r["country"]
        if c == "VN":
            alt = {"vi": ["en", "vi_ascii"], "en": ["vi", "vi_ascii"]}[r["vn_lang"]]
            return self.render(r, str(self.rng.choice(alt)))
        mp = ROMAN.get(c, {})
        stem = r["stem"]
        toks = stem.split()
        new = [mp.get(t, t) for t in toks]
        if new == toks:
            new = ["".join(toks)] if len(toks) > 1 else [toks[0] + "h"]
        elif len(new) > 1 and self.rng.random() < 0.3:
            new = ["".join(new)]
        nstem = " ".join(new)
        out = name.replace(stem, nstem)
        if c == "TH" and out.endswith(" Hospital") and self.rng.random() < 0.35:
            out = "Rong Phayaban " + out[: -len(" Hospital")]
        return out

    def perturb(self, r: dict, perts: str) -> str:
        name = r["name"]
        order = ["romanisation", "word_reorder", "abbreviation", "typo"]
        for p in sorted(perts.split(";"), key=lambda x: order.index(x) if x in order else 9):
            f = getattr(self, f"p_{p}", None)
            if f is not None:
                name = f(name, r)
        if name == r["name"]:
            name = self.p_typo(name, r)
        return name

    def address(self, r: dict) -> dict:
        rng, c = self.rng, r["country"]
        st = strip_diacritics(r["stem"]).split()[0]
        n = int(rng.integers(1, 400))
        if c == "SG":
            road = str(rng.choice(["Road", "Avenue", "Street", "Drive", "Crescent", "Lane"]))
            return dict(street=f"{n} {r['stem'].split()[0]} {road}", zip=f"{int(rng.integers(1, 83)):02d}{int(rng.integers(0, 10000)):04d}",
                        phone=f"+65 6{int(rng.integers(100, 999))} {int(rng.integers(1000, 9999))}")
        if c == "MY":
            return dict(street=f"No. {n}, Jalan {st} {int(rng.integers(1, 12))}, Taman {str(rng.choice(MY_SUFFIX))}",
                        zip=f"{int(rng.integers(10000, 90000)):05d}",
                        phone=f"+60 {int(rng.integers(3, 10))}-{int(rng.integers(1000, 9999))} {int(rng.integers(1000, 9999))}")
        if c == "TH":
            return dict(street=f"{n} Moo {int(rng.integers(1, 15))}, Tambon {st}, Amphoe Mueang",
                        zip=f"{int(rng.integers(10, 97)):02d}{int(rng.integers(0, 1000)):03d}",
                        phone=f"+66 {int(rng.integers(2, 8))} {int(rng.integers(100, 999))} {int(rng.integers(1000, 9999))}")
        if c == "VN":
            q = int(rng.integers(1, 12))
            return dict(street=f"{n} Đường {r['stem']}, Phường {int(rng.integers(1, 20))}, Quận {q}",
                        zip=f"{str(rng.choice(['70', '10', '55']))}{int(rng.integers(0, 10000)):04d}",
                        phone=f"+84 {str(rng.choice(['28', '24', '236']))} {int(rng.integers(1000, 9999))} {int(rng.integers(1000, 9999))}")
        return dict(street=f"No. {n}, {st} Road, {str(rng.choice(['Kamayut', 'Sanchaung', 'Mayangone', 'Hlaing', 'Tamwe', 'Chanmyathazi']))} Township",
                    zip=f"{int(rng.integers(11000, 11999)):05d}",
                    phone=f"+95 {int(rng.integers(1, 10))} {int(rng.integers(100, 999))} {int(rng.integers(100, 999))}")

    def reformat_address(self, a: dict, c: str) -> dict:
        s = a["street"]
        for x, y in [("Road", "Rd"), ("Avenue", "Ave"), ("Street", "St"), ("Drive", "Dr"), ("Crescent", "Cres"),
                     ("Jalan", "Jln"), ("Taman", "Tmn"), ("No. ", ""), ("Moo", "M."), ("Tambon", "T."),
                     ("Amphoe", "A."), ("Đường", "Đ."), ("Phường", "P."), ("Quận", "Q."), ("Township", "Tsp")]:
            s = s.replace(x, y)
        zipc = a["zip"] if self.rng.random() < 0.5 else ""
        if c == "SG" and zipc == "":
            s = s + f", Singapore {a['zip']}"
        phone = re.sub(r"[^0-9+]", "", a["phone"])
        return dict(street=s, zip=zipc, phone=phone)

    def tax_id(self, c: str) -> str:
        rng = self.rng
        if c == "SG":
            return f"{int(rng.integers(1975, 2021))}{int(rng.integers(0, 100000)):05d}{chr(65 + int(rng.integers(0, 26)))}"
        if c == "MY":
            return f"{int(rng.integers(1990, 2021))}0{int(rng.integers(1, 3))}{int(rng.integers(0, 1000000)):06d}"
        if c == "TH":
            return f"0{int(rng.integers(105, 995))}{int(rng.integers(0, 10 ** 9)):09d}"
        if c == "VN":
            return f"0{int(rng.integers(100000000, 999999999))}"
        return f"{int(rng.integers(100000000, 999999999))}"

    def finalize_records(self):
        """Names, addresses, tax IDs and SAP card codes for every record."""
        P, rng = self.P, self.rng
        dp = P["duplicates"]
        for r in self.cust:
            a = self.address(r)
            r["addr"] = a
            r["tax"] = self.tax_id(r["country"]) if (r["segment"] != "Clinic" or rng.random() < 0.6) else ""
            r["email"] = f"procurement@{slug(r['stem'])}.example"
        # sister sites of one MY group share the group's tax ID (a classic false-positive trap)
        for a, b in self.near_miss:
            if self.cust[a]["country"] == "MY":
                self.cust[b]["tax"] = self.cust[a]["tax"]
        for rec in self.records:
            r = self.cust[rec["gi"]]
            if rec.get("fixed"):
                continue
            if rec["canonical"]:
                rec.update(card_name=r["name"], lic_trad_num=r["tax"], street=r["addr"]["street"],
                           zip_code=r["addr"]["zip"], phone1=r["addr"]["phone"], email=r["email"])
                continue
            perts = rec["perturbation"]
            name = self.perturb(r, perts)
            if rec.get("role") == "hero_flat":
                name = f"Specialist Hospital {r['stem']}"
            a = dict(r["addr"])
            if "address_format" in perts:
                a = self.reformat_address(a, r["country"])
            tax = "" if rec.get("force_blank_tax") or "blank_tax_id" in perts else r["tax"]
            email = r["email"] if rng.random() < 0.6 else f"lab.{slug(r['stem'])}@{slug(r['stem'])}.example"
            rec.update(card_name=name, lic_trad_num=tax, street=a["street"], zip_code=a["zip"], phone1=a["phone"],
                       email=email)
        # ensure no two records share an exact name (would make matching trivial or ambiguous)
        seen = {}
        for rec in self.records:
            if rec["card_name"] in seen and seen[rec["card_name"]] != rec["gi"]:
                rec["card_name"] = rec["card_name"] + " (2)"
            seen.setdefault(rec["card_name"], rec["gi"])
        # transactions flag
        used = set(self.lines["rid"].unique())
        for rec in self.records:
            rec["has_transactions"] = rec["rid"] in used

    def add_pinned_customers(self):
        """NUH (master record only) and the two pinned PR customers (records set up Sep 2026, no POs yet)."""
        P = self.P
        nuh = P["pinned"]["nuh"]
        self.cust.append(dict(country="SG", segment=nuh["segment"], tier="L", base={p: 0 for p in PRODUCTS},
                              plant=["pinned_nuh"], golden_id=nuh["golden_id"], name=nuh["card_name"],
                              stem="National University", start_t=0, churn_t=None, contract_end="", hero=None,
                              buys={p: False for p in PRODUCTS}, rank=0))
        gi = len(self.cust) - 1
        self.nuh_rid = self.new_record(gi, "SPD", "SG", 0, True, "", name=nuh["card_name"],
                                       lic_trad_num=nuh["lic_trad_num"], street=nuh["street"],
                                       zip_code=nuh["zip_code"], phone1=nuh["phone1"], email=nuh["email"],
                                       has_transactions=False, pinned_code=nuh["card_code"], fixed=True)
        self.pr_cust = {}
        nmy = sum(1 for r in self.cust if r["country"] == "MY" and r.get("golden_id"))
        for k, pr in enumerate(P["pinned"]["prs"]):
            stem = pr.get("stem") or pr["customer_name"].split()[0]  # address stem, e.g. "Jalan Permai 10"
            self.cust.append(dict(country=pr["country"], segment=pr["segment"], tier="M",
                                  base={p: 0 for p in PRODUCTS}, plant=["pinned_pr_customer"],
                                  golden_id=f"G-MY-{nmy + k + 1:04d}", name=pr["customer_name"], stem=stem,
                                  start_t=0, churn_t=None, contract_end="", hero=None,
                                  buys={p: False for p in PRODUCTS}, rank=nmy + k + 1))
            gi = len(self.cust) - 1
            r = self.cust[gi]
            a = self.address(r)
            created = date(2026, 9, 8 + 7 * k).toordinal()
            rid = self.new_record(gi, "SPD", "MY", created, True, "", name=pr["customer_name"],
                                  lic_trad_num=self.tax_id("MY"), street=a["street"], zip_code=a["zip"],
                                  phone1=a["phone"], email=f"procurement@{slug(pr['customer_name'])}.example",
                                  has_transactions=False, fixed=True)
            self.pr_cust[pr["pr_id"]] = (gi, rid)

    def assign_codes(self):
        recs = self.records
        for c in COUNTRIES:
            rs = sorted([r for r in recs if r["recorded_country"] == c and not r.get("pinned_code")],
                        key=lambda r: (r["created"], r["rid"]))
            k = 1
            for r in rs:
                if c == "SG" and k == 17:
                    k += 1
                r["card_code"] = f"C-{c}-{k:05d}"
                k += 1
            if c == "SG":
                nuh = recs[self.nuh_rid]
                nuh["card_code"] = nuh["pinned_code"]
                before = [r["created"] for r in rs if r["card_code"] in ("C-SG-00016", "C-SG-00018")]
                nuh["created"] = int(np.mean(before)) if before else date(2005, 1, 3).toordinal()
        self.code_of = {r["rid"]: r["card_code"] for r in recs}

    # ------------------------------------------------------------------ tables
    def make_pos(self) -> pd.DataFrame:
        L = self.lines.sort_values(["date", "po_key"]).reset_index(drop=True)
        it = self.items
        po_keys = L["po_key"].drop_duplicates().to_numpy()
        gaps = self.rng.integers(1, 4, len(po_keys))
        ids = 600000 + np.cumsum(gaps)
        idmap = dict(zip(po_keys, ids))
        L["po_id"] = ["PO-%06d" % idmap[k] for k in L["po_key"]]
        L["line_no"] = L.groupby("po_key").cumcount()
        rc = {r["rid"]: r["recorded_country"] for r in self.records}
        pos = pd.DataFrame({
            "po_id": L["po_id"],
            "line_no": L["line_no"],
            "date": [ord_to_iso(o) for o in L["date"]],
            "month": L["month"],
            "record_card_code": L["rid"].map(self.code_of),
            "golden_id": [self.cust[g]["golden_id"] for g in L["gi"]],
            "true_country": L["country"],
            "recorded_country": L["rid"].map(rc),
            "entity": L["entity"],
            "item_code": it["item_code"].to_numpy()[L["item_rec"].to_numpy()],
            "true_product": L["product"],
            "recorded_product": it["recorded_product"].to_numpy()[L["item_rec"].to_numpy()],
            "units": L["units"].astype(int),
            "sgd": L["sgd"].round(2),
        })
        self.L_sorted = L
        self.pos = pos
        return pos

    def make_customers_tables(self):
        P = self.P
        recs = []
        for r in sorted(self.records, key=lambda r: r["card_code"]):
            g = self.cust[r["gi"]]
            recs.append(dict(card_code=r["card_code"], card_name=r["card_name"], entity=r["entity"],
                             recorded_country=r["recorded_country"], lic_trad_num=r.get("lic_trad_num", ""),
                             street=r.get("street", ""), zip_code=r.get("zip_code", ""), phone1=r.get("phone1", ""),
                             email=r.get("email", ""), segment=g["segment"], created_at=ord_to_iso(r["created"]),
                             has_transactions=bool(r["has_transactions"]), golden_id=g["golden_id"],
                             true_country=g["country"], perturbation=r["perturbation"]))
        self.cr = pd.DataFrame(recs)
        pos = self.pos
        first = pos.groupby("golden_id")["month"].min()
        last = pos.groupby("golden_id")["month"].max()
        c_owners = set(pos.loc[pos["true_product"] == "C", "golden_id"])
        gold = []
        for g in self.cust:
            gid = g["golden_id"]
            fp = first.get(gid, "")
            churn = ""
            if g.get("churn_t") is not None:
                churn = self.months[g["churn_t"]] if g["churn_t"] < self.T else ""
            if g.get("contract_lost"):
                churn = g["contract_end"]
            planted = ";".join(p for p in g["plant"] if p not in ("generic_dup",))
            gold.append(dict(golden_id=gid, canonical_name=g["name"], country=g["country"], segment=g["segment"],
                             size_tier=g["tier"], first_po_month=fp, churn_month=churn,
                             installed_c=bool(gid in c_owners or g["buys"].get("C", False) and g["base"]["C"] > 0),
                             planted=planted, contract_end=g.get("contract_end", ""),
                             last_po_month=last.get(gid, "")))
        self.gold = pd.DataFrame(gold).sort_values("golden_id").reset_index(drop=True)

    def make_items_table(self) -> pd.DataFrame:
        it = self.items
        return it[["item_code", "item_name", "recorded_product", "true_product", "category", "true_category",
                   "entity", "unit_price_sgd", "uom", "item_group", "analyser", "created_at"]].copy()

    def make_dup_truth(self) -> pd.DataFrame:
        P = self.P
        cr = self.cr
        tune = set(P["duplicates"]["matcher_split"]["tune"])
        rows = []
        for gid, g in cr.groupby("golden_id"):
            if len(g) < 2:
                continue
            recs = g.sort_values("card_code").to_dict("records")
            for a in range(len(recs)):
                for b in range(a + 1, len(recs)):
                    ra, rb = recs[a], recs[b]
                    pa, pb = ra["perturbation"], rb["perturbation"]
                    if pa and pb:
                        pert = ";".join(dict.fromkeys(pa.split(";") + pb.split(";")))
                    else:
                        pert = pb or pa
                    rows.append(dict(card_code_a=ra["card_code"], card_code_b=rb["card_code"], golden_id=gid,
                                     country_a=ra["recorded_country"], country_b=rb["recorded_country"],
                                     perturbation=pert,
                                     split="tune" if ra["true_country"] in tune else "holdout"))
        self.dup = pd.DataFrame(rows, columns=["card_code_a", "card_code_b", "golden_id", "country_a", "country_b",
                                               "perturbation", "split"])
        return self.dup

    # ------------------------------------------------------------------ streams
    def make_prs(self):
        P, rng = self.P, self.rng
        sp = P["streams"]
        L = self.L_sorted
        it = self.items
        share = L["product"].map(sp["pr_share_of_po_lines"]).to_numpy()
        sel = L[rng.random(len(L)) < share]
        lead = rng.integers(sp["pr_lead_days"][0], sp["pr_lead_days"][1] + 1, len(sel))
        conv = pd.DataFrame({
            "created": sel["date"].to_numpy() - lead,
            "gi": sel["gi"].to_numpy(), "rid": sel["rid"].to_numpy(), "entity": sel["entity"].to_numpy(),
            "item": sel["item_rec"].to_numpy(), "product": sel["product"].to_numpy(),
            "units": sel["units"].to_numpy(), "sgd": sel["sgd"].to_numpy(), "status": "converted",
            "po_id": sel["po_id"].to_numpy(), "blocked_by": "",
        })
        conv["country"] = [self.cust[g]["country"] for g in conv["gi"]]
        # lost PRs (MM conversion low and falling)
        lost_rows = []
        for c in COUNTRIES:
            cc = conv[conv["country"] == c]
            ratio = sp["pr_lost_ratio"][c]
            t_idx = np.array([self.mi.get(month_of(min(max(o, self.d_first), self.d_last)), 0) for o in cc["created"]])
            g = (sp["mm_lost_ratio_growth"] if (c == "MM" and self.signal) else 0.0)
            lam = ratio * np.exp(g * (t_idx - self.t_ref) / 12)
            k = rng.poisson(lam)
            tmpl = cc.loc[cc.index.repeat(k)].copy()
            if len(tmpl):
                f = rng.uniform(0.5, 1.5, len(tmpl))
                tmpl["created"] = np.clip(tmpl["created"].to_numpy() + rng.integers(-45, 46, len(tmpl)),
                                          self.d_first, self.d_last)
                tmpl["units"] = np.maximum(1, np.round(tmpl["units"].to_numpy() * f)).astype(int)
                tmpl["sgd"] = np.round(tmpl["sgd"].to_numpy() * tmpl["units"].to_numpy()
                                       / np.maximum(cc.loc[cc.index.repeat(k), "units"].to_numpy(), 1), 2)
                tmpl["status"] = "lost"
                tmpl["po_id"] = ""
                lost_rows.append(tmpl)
        lost = pd.concat(lost_rows, ignore_index=True) if lost_rows else conv.iloc[:0]
        # open pipeline (recent, not yet converted)
        allpr = pd.concat([conv, lost], ignore_index=True)
        open_rows = []
        a0, a1 = date(2026, 8, 20).toordinal(), date(2026, 10, 25).toordinal()
        for c in COUNTRIES:
            cc = allpr[(allpr["country"] == c) & (allpr["created"] >= self.mo("2026-03"))]
            per_month = len(allpr[allpr["country"] == c]) / self.T
            n = int(rng.poisson(sp["open_pr_months"] * per_month))
            if n and len(cc):
                t = cc.sample(n=n, replace=True, random_state=int(rng.integers(0, 2 ** 31))).copy()
                t["created"] = rng.integers(a0, a1 + 1, n)
                t["status"] = "open"
                t["po_id"] = ""
                open_rows.append(t)
        openp = pd.concat(open_rows, ignore_index=True) if open_rows else conv.iloc[:0]
        # blocked by pending MDM requests (stuck demand): pinned + extra
        blocked = []
        pi = P["pinned"]["pr_item"]
        for pr in P["pinned"]["prs"]:
            gi, rid = self.pr_cust[pr["pr_id"]]
            d, hm = pr["created_at"][:10], pr["created_at"][11:16]
            blocked.append(dict(pr_id=pr["pr_id"], created=date.fromisoformat(d).toordinal(),
                                minutes=int(hm[:2]) * 60 + int(hm[3:]), gi=gi, rid=rid, entity=pi["entity"],
                                item=-1, item_name=pi["item_name"], product=pi["product"],
                                units=int(round(pr["sgd"] / pi["unit_price_sgd"])), sgd=float(pr["sgd"]),
                                status="blocked", po_id="", blocked_by=pi["blocked_by"], country=pr["country"],
                                customer_name=pr["customer_name"]))
        req_pool = [f"REQ-{k}" for k in range(1031, 1050) if k not in (1042,)]
        lo, hi = P["streams"]["blocked_extra_sgd"]
        for k in range(P["streams"]["blocked_extra_count"]):
            c = COUNTRIES[k % len(COUNTRIES)]
            req = req_pool[k % len(req_pool)]
            sgd = float(np.round(rng.uniform(lo, hi), -2))
            created = int(rng.integers(date(2026, 10, 1).toordinal(), date(2026, 10, 24).toordinal()))
            if k % 2 == 0:  # waiting on a new item
                cands = [i for i, r in enumerate(self.cust) if r["country"] == c and r.get("base", {}).get("A", 0) > 0]
                gi = int(rng.choice(cands))
                nm = NEW_ITEM_NAMES[k // 2 % len(NEW_ITEM_NAMES)]
                price = float(np.round(rng.uniform(90, 600), 0))
                blocked.append(dict(created=created, minutes=int(rng.integers(510, 1080)), gi=gi,
                                    rid=self.cust[gi]["canon_rid"], entity="SPD", item=-1, item_name=nm, product="A",
                                    units=max(1, int(sgd // price)), sgd=float(np.round(max(1, int(sgd // price)) * price, 2)),
                                    status="blocked", po_id="", blocked_by=req, country=c, customer_name=None))
            else:  # waiting on a new customer record (prospect)
                stem = PROSPECT_STEMS[c][k // 2 % len(PROSPECT_STEMS[c])]
                cname = {"SG": f"{stem} Medical Clinic", "MY": f"Klinik {stem}", "TH": f"{stem} Hospital",
                         "VN": f"Phòng khám Đa khoa {stem}", "MM": f"{stem} Hospital"}[c]
                bi, bw = self.b_items if k % 4 == 1 else self.grp_items["routine"]
                item = int(bi[rng.choice(len(bi), p=bw)])
                price = float(it.at[item, "unit_price_sgd"])
                units = max(1, int(sgd // price))
                blocked.append(dict(created=created, minutes=int(rng.integers(510, 1080)), gi=-1, rid=-1,
                                    entity=it.at[item, "entity"], item=item, item_name=it.at[item, "item_name"],
                                    product=it.at[item, "true_product"], units=units,
                                    sgd=float(np.round(units * price, 2)), status="blocked", po_id="",
                                    blocked_by=req, country=c, customer_name=cname))
        blk = pd.DataFrame(blocked)
        prs = pd.concat([conv, lost, openp], ignore_index=True)
        prs = prs[prs["created"] >= self.d_first].reset_index(drop=True)  # streams start with the PO history
        prs["minutes"] = rng.integers(510, 1080, len(prs))
        prs["customer_name"] = None
        prs["pr_id"] = ""
        prs = pd.concat([prs, blk], ignore_index=True).sort_values(["created", "minutes"]).reset_index(drop=True)
        # ids: chronological, with the pinned PR-5521 / PR-5527 landing in sequence. PR ids have 4 digits, so
        # if the history holds more than ~5,400 PRs before the pinned ones, thin converted/lost PRs uniformly.
        pinned_ids = {p["pr_id"] for p in P["pinned"]["prs"]}
        cap = int(sp["max_prs_before_pinned"])
        pin_o = min(date.fromisoformat(p["created_at"][:10]).toordinal() for p in P["pinned"]["prs"])
        before = prs.index[(prs["created"] < pin_o) & prs["status"].isin(["converted", "lost"])]
        n_before = int((prs["created"] < pin_o).sum())
        if n_before > cap:
            drop = rng.choice(before, size=n_before - cap, replace=False)
            prs = prs.drop(drop).reset_index(drop=True)
        is_pin = prs["pr_id"].isin(pinned_ids)
        first_pin_pos = int(np.nonzero(is_pin.to_numpy())[0].min())
        start = 5521 - int((~is_pin.to_numpy()[:first_pin_pos]).sum())
        assert start >= 1, "too many PRs for 4-digit ids"
        nxt, ids = start, []
        for v in prs["pr_id"]:
            # Pinned rows keep their id; every other row ("" or NaN for the extra blocked PRs) gets the next one.
            # (NaN is truthy, so a bare `if v:` left the 10 extra blocked PRs without an id.)
            if isinstance(v, str) and v:
                ids.append(v)
                continue
            while nxt in (5521, 5527):
                nxt += 1
            ids.append(f"PR-{nxt:04d}")
            nxt += 1
        assert nxt <= 9999, "PR id overflow"
        prs["pr_id"] = ids
        names = []
        for gi, cn in zip(prs["gi"], prs["customer_name"]):
            names.append(cn if isinstance(cn, str) and cn else (self.cust[gi]["name"] if gi >= 0 else ""))
        out = pd.DataFrame({
            "pr_id": prs["pr_id"],
            "created_at": [ts(o, m) for o, m in zip(prs["created"], prs["minutes"])],
            "customer_name": names,
            "record_card_code": [self.code_of.get(r, "") if r >= 0 else "" for r in prs["rid"]],
            "golden_id": [self.cust[g]["golden_id"] if g >= 0 else "" for g in prs["gi"]],
            "country": prs["country"],
            "entity": prs["entity"],
            "item_code": [it.at[i, "item_code"] if i >= 0 else "" for i in prs["item"].astype(int)],
            "item_name": [it.at[i, "item_name"] if i >= 0 else n for i, n in zip(prs["item"].astype(int),
                                                                                  prs.get("item_name", pd.Series([""] * len(prs))).fillna(""))],
            "product": prs["product"],
            "units": prs["units"].astype(int),
            "sgd": prs["sgd"].astype(float).round(2),
            "status": prs["status"],
            "blocked_by_request_id": prs["blocked_by"].fillna(""),
            "converted_po_id": prs["po_id"].fillna(""),
        })
        self.prs_int = prs
        self.prs = out
        return out

    def make_enquiries(self):
        P, rng = self.P, self.rng
        sp = P["streams"]
        prs = self.prs_int
        rows = []
        ch = list(sp["enquiry_channels"])
        chp = np.array([sp["enquiry_channels"][k] for k in ch])
        linked = prs[(prs["status"] != "blocked") & (rng.random(len(prs)) < sp["enquiry_to_pr_p"])]
        names = self.prs.set_index("pr_id")["customer_name"]
        for _, r in linked.iterrows():
            rows.append(dict(o=int(r["created"]) - int(rng.integers(3, 26)), gi=int(r["gi"]),
                             name=names[r["pr_id"]], country=r["country"], product=r["product"],
                             pr=r["pr_id"]))
        # unlinked enquiries: leading indicator of next month's demand
        by_c = defaultdict(list)
        for i, r in enumerate(self.cust):
            if r.get("base") and sum(r["base"].values()) > 0:
                by_c[r["country"]].append(i)
        split = sp["enquiry_product_split"]
        for c in COUNTRIES:
            cands = by_c[c]
            w = np.array([sum(self.cust[i]["base"].values()) ** 0.5 for i in cands])
            w = w / w.sum()
            extra = sp["enquiry_trend_extra"][c] if self.signal else 0.0
            for t in range(self.T):
                tn = min(t + 1, self.T - 1)
                lvl = sp["enquiries_per_month"][c] * np.exp(extra * (t - self.t_ref) / 12)
                for p in PRODUCTS:
                    s = (self.seasA[c][tn] if p == "A" else self.wd[c][tn]) * self.trend[c][p][tn]
                    n = int(rng.poisson(lvl * split[p] * s * (1 - sp["enquiry_to_pr_p"] * 0.3)))
                    if n == 0:
                        continue
                    days = self.pick_days(c, t, n)
                    prospect = rng.random(n) < sp["prospect_share"]
                    who = rng.choice(cands, size=n, p=w)
                    for k in range(n):
                        if prospect[k]:
                            stem = PROSPECT_STEMS[c][int(rng.integers(0, len(PROSPECT_STEMS[c])))]
                            rows.append(dict(o=int(days[k]), gi=-1, name=f"{stem} {str(rng.choice(['Clinic', 'Medical Lab', 'Health Centre', 'Hospital']))}",
                                             country=c, product=p, pr=""))
                        else:
                            rows.append(dict(o=int(days[k]), gi=int(who[k]), name=self.cust[int(who[k])]["name"],
                                             country=c, product=p, pr=""))
        e = pd.DataFrame(rows)
        e = e[(e["o"] >= self.d_first) & (e["o"] <= self.today)].copy()
        e["minutes"] = rng.integers(480, 1140, len(e))
        e = e.sort_values(["o", "minutes"]).reset_index(drop=True)
        self.enq = pd.DataFrame({
            "enquiry_id": [f"ENQ-{k + 1:05d}" for k in range(len(e))],
            "received_at": [ts(o, m) for o, m in zip(e["o"], e["minutes"])],
            "golden_id": [self.cust[g]["golden_id"] if g >= 0 else "" for g in e["gi"]],
            "customer_name": e["name"],
            "country": e["country"],
            "product": e["product"],
            "channel": rng.choice(ch, size=len(e), p=chp),
            "converted_pr_id": e["pr"],
        })
        return self.enq

    def make_followups(self):
        P, rng = self.P, self.rng
        sp = P["streams"]
        hdr = self.pos.drop_duplicates("po_id")[["po_id", "date", "golden_id", "true_country"]]
        sel = hdr[rng.random(len(hdr)) < sp["followup_share_of_pos"]].copy()
        o = np.array([date.fromisoformat(d).toordinal() for d in sel["date"]]) + rng.integers(3, 41, len(sel))
        sel["o"] = np.minimum(o, self.today - 1)
        sel["minutes"] = rng.integers(480, 1140, len(sel))
        sel = sel.sort_values(["o", "minutes"])
        topics = list(sp["followup_topics"])
        tp = np.array([sp["followup_topics"][k] for k in topics])
        self.fup = pd.DataFrame({
            "followup_id": [f"FUP-{k + 1:05d}" for k in range(len(sel))],
            "received_at": [ts(a, b) for a, b in zip(sel["o"], sel["minutes"])],
            "po_id": sel["po_id"].to_numpy(),
            "golden_id": sel["golden_id"].to_numpy(),
            "country": sel["true_country"].to_numpy(),
            "topic": rng.choice(topics, size=len(sel), p=tp),
        })
        return self.fup

    def make_mdm_hist(self):
        P, rng = self.P, self.rng
        mh = P["mdm_history"]
        months = month_range(mh["months"][0], mh["months"][1])
        cw = np.array([P["countries"][c]["value_sgd"] for c in COUNTRIES], float)
        cw /= cw.sum()
        lo_, hi_ = self.mo(months[0]), self.mo(add_months(months[-1], 1)) - 1
        # records created inside the window are linked to the customer requests that created them
        linked = [r for r in self.records if lo_ <= r["created"] <= hi_ and r["rid"] != self.nuh_rid]
        link_by_month = defaultdict(list)
        for r in linked:
            link_by_month[month_of(r["created"])].append(r)
        seq = {"C": defaultdict(lambda: 50001), "V": defaultdict(lambda: 101), "CC": defaultdict(lambda: 41)}
        iseq = {"A": 961, "B": 961, "C": 961}

        def lnorm(med_sig, n=1):
            med, sig = med_sig
            return rng.lognormal(np.log(med), sig, n)

        prs = self.prs_int
        conv_prs = prs[prs["status"] == "converted"]
        rows = []
        for m in months:
            m0 = self.mo(m)
            m1 = self.mo(add_months(m, 1)) - 1
            bdays = [o for o in range(m0, m1 + 1) if date.fromordinal(o).weekday() < 5]
            links = list(link_by_month.get(m, []))
            for dom, k in mh["per_month"].items():
                n = int(rng.poisson(k))
                if dom == "customer":
                    n = max(n, len(links))
                for j in range(n):
                    link = links.pop() if (dom == "customer" and links) else None
                    country = link["recorded_country"] if link else str(rng.choice(COUNTRIES, p=cw))
                    steps = mh["steps"][dom] + int(rng.random() < mh["extra_step_p"][dom])
                    bounces = 0
                    if rng.random() < mh["bounce_p"]:
                        bounces = 1 + int(rng.random() < mh["second_bounce_p"])
                    notice = float(lnorm(mh["notice_days"])[0])
                    bounce_d = float(lnorm(mh["bounce_days"], bounces).sum()) if bounces else 0.0
                    appr = float(lnorm(mh["step_days"], steps).sum())
                    mdm = float(lnorm(mh["mdm_days"])[0])
                    cycle = notice + bounce_d + appr + mdm
                    status = "created"
                    if not link:
                        u = rng.random()
                        status = "rejected" if u < mh["reject_p"] else ("cancelled" if u < mh["reject_p"] + mh["cancel_p"] else "created")
                    if link:
                        created_o = link["created"]
                        cmin = int(rng.integers(600, 1080))
                        sub_f = created_o + cmin / 1440 - cycle
                        sub_o = int(np.floor(sub_f))
                        sub_o = next_business_day(sub_o)
                        smin = int(rng.integers(540, 1080))
                    else:
                        sub_o = int(rng.choice(bdays))
                        smin = int(rng.integers(510, 1110))
                        end = sub_o + smin / 1440 + cycle
                        created_o = next_business_day(int(np.floor(end)))
                        cmin = int(rng.integers(600, 1080)) if created_o != int(np.floor(end)) else int((end % 1) * 1440)
                        cmin = min(max(cmin, 540), 1110)
                    cyc = (created_o + cmin / 1440) - (sub_o + smin / 1440)
                    if cyc <= 0.2:
                        cyc = 0.5
                    scale = cyc / cycle
                    entity = (link["entity"] if link else
                              (P["product_entity"][str(rng.choice(PRODUCTS, p=[0.5, 0.3, 0.2]))] if dom == "item"
                               else str(rng.choice(["SPD", "QTS", "QTG"], p=[0.45, 0.25, 0.30]))))
                    sap = ""
                    was_dup = False
                    if status == "created":
                        if dom == "customer":
                            if link:
                                sap = link["card_code"]
                                was_dup = not link["canonical"]
                            else:
                                sap = f"C-{country}-{seq['C'][country]:05d}"
                                seq["C"][country] += 1
                                was_dup = bool(rng.random() < mh["duplicate_p"])
                        elif dom == "extend":
                            cands = [r for r in self.records if r["recorded_country"] == country and r["created"] < sub_o]
                            sap = cands[int(rng.integers(0, len(cands)))]["card_code"] if cands else ""
                        elif dom == "item":
                            p = {"SPD": "A", "QTG": "B", "QTS": "C"}[entity]
                            sap = f"I-{p}-{iseq[p]:06d}"
                            iseq[p] += 1
                        elif dom == "vendor":
                            sap = f"V-{country}-{seq['V'][country]:05d}"
                            seq["V"][country] += 1
                        else:
                            sap = f"CC-{country}-{seq['CC'][country]:04d}"
                            seq["CC"][country] += 1
                    blocked = ""
                    if status == "created" and dom in ("customer", "item"):
                        if link and link["canonical"]:
                            cand = conv_prs[(conv_prs["rid"] == link["rid"]) & (conv_prs["created"] < created_o)]
                            if len(cand):
                                blocked = ";".join(self.prs.loc[cand.index[:2], "pr_id"])
                        elif rng.random() < mh["blocked_pr_p"]:
                            cand = conv_prs[(conv_prs["country"] == country) & (conv_prs["created"] >= sub_o)
                                            & (conv_prs["created"] <= created_o)]
                            if len(cand):
                                pick = cand.sample(n=min(len(cand), int(rng.integers(1, 3))),
                                                   random_state=int(rng.integers(0, 2 ** 31)))
                                blocked = ";".join(self.prs.loc[pick.index, "pr_id"])
                    role = str(rng.choice(mh["requestor_roles"][dom]))
                    ok = status == "created"
                    rows.append(dict(o=sub_o, smin=smin, domain=dom, entity=entity, country=country,
                                     requestor_role=role,
                                     created_in_sap_at=ts(created_o, cmin) if ok else "",
                                     status=status, bounces=bounces,
                                     cycle_days=round(cyc, 2) if ok else None,
                                     notice_days=round(notice * scale, 2) if ok else None,
                                     bounce_days=round(bounce_d * scale, 2) if ok else None,
                                     approval_days=round(appr * scale, 2) if ok else None,
                                     mdm_days=round(mdm * scale, 2) if ok else None,
                                     approval_steps=steps, sap_code=sap, was_duplicate=was_dup,
                                     blocked_pr_ids=blocked))
        h = pd.DataFrame(rows)
        if len(h) > 990:  # ids must stay below the app's REQ-1001+ (drop surplus unlinked requests)
            keep = {r["card_code"] for r in linked}
            unl = h.index[~h["sap_code"].isin(keep)]
            h = h.drop(rng.choice(unl, size=len(h) - 990, replace=False))
        h = h.sort_values(["o", "smin"]).reset_index(drop=True)
        h.insert(0, "request_id", [f"REQ-{k + 1:04d}" for k in range(len(h))])
        h.insert(5, "submitted_at", [ts(o, m) for o, m in zip(h["o"], h["smin"])])
        h = h.drop(columns=["o", "smin"])
        cols = ["request_id", "domain", "entity", "country", "requestor_role", "submitted_at", "created_in_sap_at",
                "status", "bounces", "cycle_days", "sap_code", "was_duplicate", "blocked_pr_ids",
                "approval_steps", "notice_days", "bounce_days", "approval_days", "mdm_days"]
        self.hist = h[cols]
        return self.hist

    # ------------------------------------------------------------------ run + report
    def run(self):
        self.build_calendar()
        self.build_factors()
        self.build_items()
        self.build_customers()
        self.build_demand()
        self.build_records()
        self.route()
        self.plant_misattribution()
        self.plant_miscategorisation()
        self.build_names()
        self.add_pinned_customers()
        self.finalize_records()
        self.assign_codes()
        self.make_pos()
        self.make_customers_tables()
        self.make_dup_truth()
        self.rng = self.rng_s  # streams draw from their own generator
        self.make_prs()
        self.make_enquiries()
        self.make_followups()
        self.make_mdm_hist()

    def summarize(self) -> dict:
        pos, win = self.pos, self.win
        cur, pri = set(win["current"]), set(win["prior"])
        S = {}
        dd = pos[pos["month"].isin(cur)].groupby(["true_country", "true_product"])["sgd"].sum().unstack()
        dp = pos[pos["month"].isin(pri)].groupby(["true_country", "true_product"])["sgd"].sum().unstack()
        dd, dp = dd.reindex(index=COUNTRIES, columns=PRODUCTS).fillna(0), dp.reindex(index=COUNTRIES, columns=PRODUCTS).fillna(0)
        S["value_12m_dedup"] = {c: {p: round(float(dd.at[c, p])) for p in PRODUCTS} for c in COUNTRIES}
        S["yoy_dedup"] = {c: {p: round(float(dd.at[c, p] / dp.at[c, p] - 1), 4) if dp.at[c, p] else None
                              for p in PRODUCTS} for c in COUNTRIES}
        S["country_12m_dedup"] = {c: round(float(dd.loc[c].sum())) for c in COUNTRIES}
        S["country_yoy_dedup"] = {c: round(float(dd.loc[c].sum() / dp.loc[c].sum() - 1), 4) for c in COUNTRIES}
        S["group_12m"] = round(float(dd.values.sum()))
        S["group_yoy"] = round(float(dd.values.sum() / dp.values.sum() - 1), 4)
        rr = pos[pos["month"].isin(cur)].groupby(["recorded_country", "recorded_product"])["sgd"].sum().unstack()
        rr = rr.reindex(index=COUNTRIES, columns=PRODUCTS).fillna(0)
        S["country_12m_raw"] = {c: round(float(rr.loc[c].sum())) for c in COUNTRIES}
        S["raw_minus_dedup_pct"] = {c: round(float(rr.loc[c].sum() / dd.loc[c].sum() - 1), 4) for c in COUNTRIES}
        S["product_12m_dedup"] = {p: round(float(dd[p].sum())) for p in PRODUCTS}
        S["A_to_C"] = round(float(dd["A"].sum() / dd["C"].sum()), 2)
        mis = pos[pos["month"].isin(cur) & (pos["true_country"] != pos["recorded_country"])]
        S["misattribution_share_12m"] = {c: round(float(mis.loc[mis["true_country"] == c, "sgd"].sum()
                                                        / dd.loc[c].sum()), 4) for c in COUNTRIES}
        S["misattribution_sgd_12m"] = round(float(mis["sgd"].sum()))
        mc = pos[pos["month"].isin(cur) & (pos["true_product"] != pos["recorded_product"])]
        S["miscategorised_sgd_12m"] = round(float(mc["sgd"].sum()))
        S["miscategorised_share_of_A_12m"] = round(float(mc["sgd"].sum() / dd["A"].sum()), 4)
        S["miscategorised_share_of_A_by_country"] = {c: round(float(mc.loc[mc["true_country"] == c, "sgd"].sum()
                                                                    / dd.at[c, "A"]), 4) for c in COUNTRIES}
        cr = self.cr
        n_rec, n_gold = len(cr), cr["golden_id"].nunique()
        S["customer_records"] = n_rec
        S["golden_customers"] = n_gold
        S["duplicate_records"] = n_rec - n_gold
        S["duplicate_rate"] = round((n_rec - n_gold) / n_rec, 4)
        S["dup_pairs"] = {"tune": int((self.dup["split"] == "tune").sum()),
                          "holdout": int((self.dup["split"] == "holdout").sum())}
        S["items"] = len(self.items)
        S["rows"] = {"pos_lines": len(pos), "pos": int(pos["po_id"].nunique()), "prs": len(self.prs),
                     "enquiries": len(self.enq), "followups": len(self.fup), "mdm_requests_hist": len(self.hist)}
        # heroes
        heroes = {}
        for i, r in enumerate(self.cust):
            if r.get("hero"):
                g = r["golden_id"]
                pc = pos[pos["golden_id"] == g]
                v1 = pc.loc[pc["month"].isin(cur), "sgd"].sum()
                v0 = pc.loc[pc["month"].isin(pri), "sgd"].sum()
                ctry = pos[(pos["true_country"] == r["country"]) & pos["month"].isin(cur)].groupby("golden_id")["sgd"].sum()
                rank = int((ctry > v1).sum()) + 1
                heroes[r["country"]] = {"golden_id": g, "name": r["name"], "yoy": round(float(v1 / v0 - 1), 4),
                                        "rank_12m": rank, "sgd_12m": round(float(v1))}
        S["heroes"] = heroes
        blk = self.prs[self.prs["status"] == "blocked"]
        S["stuck_demand_sgd"] = round(float(blk["sgd"].sum()))
        S["stuck_demand_prs"] = len(blk)
        h = self.hist[self.hist["status"] == "created"]
        S["mdm_median_cycle_days"] = round(float(h["cycle_days"].median()), 1)
        S["mdm_median_cycle_days_by_domain"] = {d: round(float(g["cycle_days"].median()), 1)
                                                for d, g in h.groupby("domain")}
        S["mdm_bounce_rate"] = round(float((self.hist["bounces"] > 0).mean()), 3)
        self.stats = S
        return S

    # ------------------------------------------------------------------ planted-pattern assertions
    SCHEMA_COLS = {
        "customers_records": ["card_code", "card_name", "entity", "recorded_country", "lic_trad_num", "street",
                              "zip_code", "phone1", "email", "segment", "created_at", "has_transactions",
                              "golden_id", "true_country", "perturbation"],
        "golden_customers": ["golden_id", "canonical_name", "country", "segment", "size_tier", "first_po_month",
                             "churn_month", "installed_c", "planted"],
        "items": ["item_code", "item_name", "recorded_product", "true_product", "category", "true_category",
                  "entity", "unit_price_sgd", "uom"],
        "pos": ["po_id", "line_no", "date", "month", "record_card_code", "golden_id", "true_country",
                "recorded_country", "entity", "item_code", "true_product", "recorded_product", "units", "sgd"],
        "prs": ["pr_id", "created_at", "customer_name", "record_card_code", "golden_id", "country", "entity",
                "item_code", "item_name", "product", "units", "sgd", "status", "blocked_by_request_id",
                "converted_po_id"],
        "enquiries": ["enquiry_id", "received_at", "golden_id", "customer_name", "country", "product", "channel",
                      "converted_pr_id"],
        "followups": ["followup_id", "received_at", "po_id", "golden_id", "country", "topic"],
        "mdm_requests_hist": ["request_id", "domain", "entity", "country", "requestor_role", "submitted_at",
                              "created_in_sap_at", "status", "bounces", "cycle_days", "sap_code", "was_duplicate",
                              "blocked_pr_ids"],
        "dup_truth": ["card_code_a", "card_code_b", "golden_id", "country_a", "country_b", "perturbation", "split"],
    }

    def check_plants(self) -> list[dict]:
        """Data-level assertions from final model §5.6 (forecast and matcher assertions are checked by the
        backtest and matcher scripts, on models; listed here as 'deferred')."""
        P, pos, cr, S = self.P, self.pos, self.cr, self.stats
        cur, pri = set(self.win["current"]), set(self.win["prior"])
        res = []

        def chk(name, value, target, ok, scenario_only=None):
            if scenario_only and self.scenario not in scenario_only:
                return
            res.append(dict(name=name, value=value, target=target, ok=bool(ok)))

        sig = ("base", "halfdengue")
        tables = {"customers_records": self.cr, "golden_customers": self.gold, "items": self.make_items_table(),
                  "pos": self.pos, "prs": self.prs, "enquiries": self.enq, "followups": self.fup,
                  "mdm_requests_hist": self.hist, "dup_truth": self.dup}
        missing = {t: [c for c in cols if c not in tables[t].columns] for t, cols in self.SCHEMA_COLS.items()}
        chk("SCHEMA.md columns present", {t: m for t, m in missing.items() if m} or "all", "all",
            not any(missing.values()))
        # 1. hero MY
        h = next(r for r in self.cust if r.get("hero") == "MY")
        recs = cr[cr["golden_id"] == h["golden_id"]]
        months = {cc: pos.loc[pos["record_card_code"] == cc, "month"] for cc in recs["card_code"]}
        roles = {self.code_of[r["rid"]]: r.get("role") for r in self.records if r["gi"] == self.cust.index(h)}
        lost = [cc for cc, rl in roles.items() if rl == "hero_lost"][0]
        new = [cc for cc, rl in roles.items() if rl == "hero_new"][0]
        flat = [cc for cc, rl in roles.items() if rl == "hero_flat"][0]
        ents = sorted(recs["entity"])
        chk("hero MY: 3 records = 2 SPD + 1 QTS", ents, ["QTS", "SPD", "SPD"], ents == ["QTS", "SPD", "SPD"])
        chk("hero MY: record 1 has no PO after Mar 2026", months[lost].max(), "<= 2026-03",
            months[lost].max() <= "2026-03")
        chk("hero MY: record 2 first PO in Apr 2026", months[new].min(), "2026-04", months[new].min() == "2026-04",
            sig)
        fv = pos[pos["record_card_code"] == flat]
        fy = fv.loc[fv["month"].isin(cur), "sgd"].sum() / max(fv.loc[fv["month"].isin(pri), "sgd"].sum(), 1) - 1
        chk("hero MY: record 3 flat (|YoY| <= 15%)", round(fy, 3), "[-0.15, 0.15]", abs(fy) <= 0.15)
        hy = S["heroes"]["MY"]
        chk("hero MY: merged YoY in [-40%, -30%]", hy["yoy"], "[-0.40, -0.30]", -0.40 <= hy["yoy"] <= -0.30, sig)
        chk("hero MY: merged top-3 MY account (12M)", hy["rank_12m"], "<= 3", hy["rank_12m"] <= 3, sig)
        for c, hh in S["heroes"].items():
            if c != "MY":
                chk(f"hero {c}: merged YoY in [-40%, -22%]", hh["yoy"], "[-0.40, -0.22]",
                    -0.40 <= hh["yoy"] <= -0.22, sig)
        # 2. misattribution
        for c, v in S["misattribution_share_12m"].items():
            if c in P["plants"]["misattribution"]["target_share"]:
                chk(f"misattribution {c}: 3-8% of 12M value", v, "[0.03, 0.08]", 0.03 <= v <= 0.08)
        first_mis = pos.loc[pos["true_country"] != pos["recorded_country"], "month"].min()
        chk("misattribution starts Jan 2026", first_mis, "2026-01", first_mis == "2026-01")
        tot_raw = pos.groupby("recorded_country")["sgd"].sum().sum()
        chk("raw and de-duplicated group totals identical", round(tot_raw - pos["sgd"].sum(), 2), 0.0,
            abs(tot_raw - pos["sgd"].sum()) < 0.01)
        # 3. false cross-sell TH
        x = next(r for r in self.cust if "false_crosssell_th" in r["plant"])
        xp = pos[pos["golden_id"] == x["golden_id"]]
        by_rec = xp.groupby("record_card_code")["true_product"].apply(lambda s: "".join(sorted(set(s))))
        chk("false cross-sell TH: records look A-only + C-only, merged gap is B",
            sorted(by_rec.tolist()), ["A", "C"], sorted(by_rec.tolist()) == ["A", "C"])
        # 5. duplicates
        chk("duplicate rate ~6% of customer records", S["duplicate_rate"], "[0.05, 0.07]",
            0.05 <= S["duplicate_rate"] <= 0.07)
        # 6. stuck demand + pinned PRs
        chk("stuck demand S$150-450k", S["stuck_demand_sgd"], "[150000, 450000]",
            150000 <= S["stuck_demand_sgd"] <= 450000)
        pp = self.prs.set_index("pr_id")
        ok = all(pp.at[p["pr_id"], "sgd"] == p["sgd"] and pp.at[p["pr_id"], "customer_name"] == p["customer_name"]
                 and pp.at[p["pr_id"], "status"] == "blocked"
                 and pp.at[p["pr_id"], "blocked_by_request_id"] == P["pinned"]["pr_item"]["blocked_by"]
                 and pp.at[p["pr_id"], "item_name"] == P["pinned"]["pr_item"]["item_name"]
                 for p in P["pinned"]["prs"])
        chk("pinned PR-5521 / PR-5527 exact (blocked by REQ-1042)", ok, True, ok)
        demo_items = set(P["pinned"]["reserved_item_names"]) & set(self.items["item_name"])
        chk("demo new items absent from item master", sorted(demo_items), [], not demo_items)
        # 7. value mix
        chk("value mix A ~3x C (12M)", S["A_to_C"], "[2.5, 3.6]", 2.5 <= S["A_to_C"] <= 3.6, ("base",))
        # 8. realism
        sg_d = pos[(pos["true_country"] == "SG") & pos["item_code"].isin(
            self.items.loc[self.items["item_group"] == "dengue", "item_code"])]
        s24 = sg_d.loc[sg_d["month"].between("2024-05", "2024-10"), "units"].sum()
        s25 = sg_d.loc[sg_d["month"].between("2025-05", "2025-10"), "units"].sum()
        chk("dengue: SG May-Oct 2024 test units well above 2025", round(s25 / s24 - 1, 3), "<= -0.20",
            s25 / s24 - 1 <= -0.20, sig)
        sgm = sg_d.groupby(sg_d["month"].str[5:7])["units"].sum()
        peak = sgm.idxmax()
        chk("dengue: SG peak month inside May-Oct", peak, "05..10", "05" <= peak <= "10", sig)

        def mon_units(c, m):
            return pos.loc[(pos["true_country"] == c) & (pos["month"] == m) & pos["true_product"].isin(["A", "B"]),
                           "units"].sum()

        for c, m, a, b, lab in [("VN", "2026-02", "2026-01", "2026-03", "Tet"),
                                ("TH", "2026-04", "2026-03", "2026-05", "Songkran"),
                                ("MM", "2026-04", "2026-03", "2026-05", "Thingyan"),
                                ("SG", "2026-02", "2026-01", "2026-03", "CNY")]:
            v, ref = mon_units(c, m), (mon_units(c, a) + mon_units(c, b)) / 2
            chk(f"holiday dip: {c} {lab} month below neighbours", round(v / ref - 1, 3), "< 0", v < ref, sig)
        cdf = pos[pos["true_product"] == "C"].copy()
        cdf["m"] = cdf["month"].str[5:7]
        for c, fy_end in [("SG", "03"), ("MM", "03"), ("MY", "12"), ("VN", "12"), ("TH", "09")]:
            byq = cdf[cdf["true_country"] == c].groupby("m")["sgd"].sum()
            e = int(fy_end)
            q = [f"{(e - k - 1) % 12 + 1:02d}" for k in range(3)]
            share = byq.reindex(q).fillna(0).sum() / byq.sum()
            chk(f"fiscal flush: {c} instruments, FY-end quarter share > 25%", round(share, 3), "> 0.25",
                share > 0.25, sig)
        churn = [r for r in self.cust if r.get("contract_lost")]
        okc = all(pos[(pos["golden_id"] == r["golden_id"]) & (pos["true_product"] == "A")
                      & (pos["month"] >= r["contract_end"])].empty for r in churn)
        chk("MY reagent-rental churn at contract expiry (A stops)", [r["golden_id"] for r in churn], "2 hospitals",
            okc and len(churn) == P["plants"]["my_contracts"]["wave1_lost"], sig)
        # 9. NUH
        nuh = P["pinned"]["nuh"]
        row = cr[cr["card_code"] == nuh["card_code"]]
        exact = (len(row) == 1 and row.iloc[0]["card_name"] == nuh["card_name"]
                 and row.iloc[0]["lic_trad_num"] == nuh["lic_trad_num"] and row.iloc[0]["street"] == nuh["street"]
                 and row.iloc[0]["zip_code"] == nuh["zip_code"] and row.iloc[0]["phone1"] == nuh["phone1"]
                 and row.iloc[0]["entity"] == nuh["entity"] and not bool(row.iloc[0]["has_transactions"]))
        chk("NUH C-SG-00017 master record exact, 0 transactions", exact and (pos["record_card_code"] == nuh["card_code"]).sum() == 0,
            True, exact and (pos["record_card_code"] == nuh["card_code"]).sum() == 0)
        thieves = cr[(cr["recorded_country"] == "SG") & (cr["card_code"] != nuh["card_code"])
                     & cr["card_name"].str.contains(r"(?i)\b(?:national|natl|university|univ)\b")]
        chk("no other SG record can steal the 'Natl Univ Hosp' match", len(thieves), 0, len(thieves) == 0)
        chk("MDM history ids stay below the app REQ-1001+", len(self.hist), "< 1000", len(self.hist) < 1000)
        for name in ("forecast: ETS beats rolling-12 on A in >=3/5 and B in >=2/5",
                     "stress (a) |advantage| <= 2 pts; (b) advantage persists",
                     "matcher held-out P and R in [0.80, 0.97]"):
            res.append(dict(name=name, value="deferred", target="checked on models by the backtest/matcher scripts",
                            ok=None))
        self.checks = res
        return res

    def plants_json(self) -> dict:
        P, S = self.P, self.stats
        pos, cr = self.pos, self.cr
        cur = set(self.win["current"])
        recs_by_g = cr.groupby("golden_id")
        out = {"scenario": self.scenario, "seed": self.seed, "isSynthetic": True}

        def recs(gid):
            g = recs_by_g.get_group(gid)
            res = []
            for _, r in g.iterrows():
                p = pos[pos["record_card_code"] == r["card_code"]]
                res.append(dict(card_code=r["card_code"], card_name=r["card_name"], entity=r["entity"],
                                recorded_country=r["recorded_country"], created_at=r["created_at"],
                                perturbation=r["perturbation"], first_po_month=p["month"].min() if len(p) else "",
                                last_po_month=p["month"].max() if len(p) else "",
                                sgd_12m=round(float(p.loc[p["month"].isin(cur), "sgd"].sum()))))
            return res

        out["hero"] = {c: dict(S["heroes"][c], switch=P["plants"]["hero"][c]["switch"],
                               records=recs(S["heroes"][c]["golden_id"])) for c in S["heroes"]}
        out["misattribution"] = {}
        for c, lst in self.mis.items():
            hosp = []
            ctot = pos[(pos["true_country"] == c) & pos["month"].isin(cur)]["sgd"].sum()
            for m in lst:
                g = self.cust[m["gi"]]
                moved = pos[(pos["golden_id"] == g["golden_id"]) & (pos["recorded_country"] != pos["true_country"])
                            & pos["month"].isin(cur)]["sgd"].sum()
                hosp.append(dict(golden_id=g["golden_id"], name=g["name"], sg_record=self.code_of[m["rid"]],
                                 true_record=self.code_of[g["canon_rid"]], entities_moved=m["entities"],
                                 share_of_lines_moved=round(m["q"], 3), sgd_moved_12m=round(float(moved)),
                                 share_of_country_12m=round(float(moved / ctot), 4), records=recs(g["golden_id"])))
            out["misattribution"][c] = dict(start=P["plants"]["misattribution"]["start"],
                                            share_of_country_12m=S["misattribution_share_12m"][c],
                                            named_example=hosp[0], hospitals=hosp)
        mc = []
        it = self.items
        for m in P["plants"]["miscategorisation"]["items"]:
            dup = it.iloc[self.item_idx[m["dup_name"]]]
            src = it.iloc[self.item_idx[m["true_item"]]]
            p = pos[(pos["item_code"] == dup["item_code"]) & pos["month"].isin(cur)]
            mc.append(dict(true_item_code=src["item_code"], dup_item_code=dup["item_code"], dup_name=m["dup_name"],
                           true_item_name=m["true_item"], created=m["created"], countries=m["countries"],
                           units_12m=int(p["units"].sum()), sgd_12m=round(float(p["sgd"].sum()))))
        out["miscategorisation"] = mc

        def by_plant(tag):
            return [dict(golden_id=r["golden_id"], name=r["name"], country=r["country"], segment=r["segment"])
                    for r in self.cust if tag in r["plant"]]

        g = by_plant("false_crosssell_th")
        out["th_false_crosssell"] = [dict(x, records=recs(x["golden_id"])) for x in g]
        g = by_plant("romanisation_mm")
        out["mm_romanisation"] = [dict(x, records=recs(x["golden_id"])) for x in g]
        out["vn_xsell_gap"] = by_plant("xsell_gap_vn")
        out["my_expanders"] = by_plant("expander_my")
        out["my_contract_churn"] = [dict(x, contract_end=self.cust[[r["golden_id"] for r in self.cust].index(x["golden_id"])]["contract_end"])
                                    for x in by_plant("contract_churn_my")]
        out["my_contracts_q1_2027"] = [dict(x, contract_end=self.cust[[r["golden_id"] for r in self.cust].index(x["golden_id"])]["contract_end"])
                                       for x in by_plant("contract_q1_2027_my")]
        out["near_miss_pairs"] = [[dict(golden_id=self.cust[a]["golden_id"], name=self.cust[a]["name"]),
                                   dict(golden_id=self.cust[b]["golden_id"], name=self.cust[b]["name"])]
                                  for a, b in self.near_miss]
        out["generic_churners"] = by_plant("churner")
        out["new_customers"] = by_plant("new_customer")
        out["nuh"] = dict(P["pinned"]["nuh"], has_transactions=False,
                          po_lines=int((pos["record_card_code"] == P["pinned"]["nuh"]["card_code"]).sum()))
        out["pinned_prs"] = self.prs[self.prs["pr_id"].isin([p["pr_id"] for p in P["pinned"]["prs"]])].to_dict("records")
        out["stuck_demand"] = dict(sgd=S["stuck_demand_sgd"], prs=S["stuck_demand_prs"])
        out["pull_through_placements"] = len(self.uplift_log)
        return out

    def write(self, out_dir: Path):
        out_dir.mkdir(parents=True, exist_ok=True)
        write_csv(self.cr, out_dir / "customers_records.csv")
        write_csv(self.gold, out_dir / "golden_customers.csv")
        write_csv(self.make_items_table(), out_dir / "items.csv")
        write_csv(self.pos, out_dir / "pos.csv")
        write_csv(self.prs, out_dir / "prs.csv")
        write_csv(self.enq, out_dir / "enquiries.csv")
        write_csv(self.fup, out_dir / "followups.csv")
        h = self.hist.copy()
        write_csv(h, out_dir / "mdm_requests_hist.csv")
        write_csv(self.dup, out_dir / "dup_truth.csv")
        write_json(self.plants_json(), out_dir / "plants.json")
        write_json({"scenario": self.scenario, "seed": self.seed, "signal": self.signal,
                    "dengue_scale": self.dengue_scale, "generator": "analytics/generate.py",
                    "params": "analytics/params.yaml", "history": [self.months[0], self.months[-1]],
                    "window": [self.win["current"][0], self.win["current"][-1]],
                    "summary": self.stats, "assertions": getattr(self, "checks", [])}, out_dir / "manifest.json")


def print_summary(S: dict, scenario: str, seed: int, secs: float):
    p = print
    p(f"\n=== Tesseract synthetic data · scenario={scenario} seed={seed} · {secs:.1f}s ===")
    p("12M PO value Oct 2025–Sep 2026, de-duplicated view (S$k) and YoY vs Oct 2024–Sep 2025:")
    p(f"{'':4}" + "".join(f"{x:>18}" for x in ["A", "B", "C", "Total"]))
    for c in COUNTRIES:
        v, y = S["value_12m_dedup"][c], S["yoy_dedup"][c]
        cells = [f"{v[q] / 1e3:9.0f} ({(y[q] or 0) * 100:+5.1f}%)" for q in PRODUCTS]
        p(f"{c:4}" + "".join(f"{x:>18}" for x in cells)
          + f"{S['country_12m_dedup'][c] / 1e3:9.0f} ({S['country_yoy_dedup'][c] * 100:+5.1f}%)")
    pt = S["product_12m_dedup"]
    p(f"Group S${S['group_12m'] / 1e6:.2f}M ({S['group_yoy'] * 100:+.1f}% YoY) · A S${pt['A'] / 1e6:.1f}M "
      f"B S${pt['B'] / 1e6:.1f}M C S${pt['C'] / 1e6:.1f}M · A:C = {S['A_to_C']}")
    p("Raw (recorded) minus dedup country value: "
      + ", ".join(f"{c} {S['raw_minus_dedup_pct'][c] * 100:+.1f}%" for c in COUNTRIES))
    p("Misattribution share of country 12M value: "
      + ", ".join(f"{c} {v * 100:.1f}%" for c, v in S["misattribution_share_12m"].items() if v)
      + f" (S${S['misattribution_sgd_12m'] / 1e3:.0f}k)")
    p(f"Miscategorised A→B: S${S['miscategorised_sgd_12m'] / 1e3:.0f}k = {S['miscategorised_share_of_A_12m'] * 100:.1f}% of A; "
      + ", ".join(f"{c} {v * 100:.1f}%" for c, v in S["miscategorised_share_of_A_by_country"].items() if v))
    p(f"Customers: {S['customer_records']} records, {S['golden_customers']} golden, {S['duplicate_records']} duplicates "
      f"= {S['duplicate_rate'] * 100:.1f}% · dup pairs tune {S['dup_pairs']['tune']} / holdout {S['dup_pairs']['holdout']} "
      f"· items {S['items']}")
    p("Heroes (merged YoY, rank in country 12M): "
      + "; ".join(f"{c} {h['name']} {h['yoy'] * 100:+.0f}% #{h['rank_12m']}" for c, h in S["heroes"].items()))
    p(f"Stuck demand S${S['stuck_demand_sgd'] / 1e3:.0f}k over {S['stuck_demand_prs']} PRs · MDM median cycle "
      f"{S['mdm_median_cycle_days']} d {S['mdm_median_cycle_days_by_domain']} · bounce rate {S['mdm_bounce_rate']:.0%}")
    p("Rows: " + ", ".join(f"{k} {v}" for k, v in S["rows"].items()))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", type=int, default=None, help="random seed (default: the scenario's seed in params.yaml)")
    ap.add_argument("--scenario", default="base", choices=["base", "nosignal", "halfdengue"])
    ap.add_argument("--out", default=None, help="output directory (default analytics/out/<scenario>)")
    ap.add_argument("--params", default=None, help="params.yaml path")
    a = ap.parse_args(argv)
    P = load_params(a.params) if a.params else load_params()
    seed = a.seed if a.seed is not None else P["scenarios"][a.scenario]["seed"]
    out = Path(a.out) if a.out else scenario_dir(a.scenario)
    if not out.is_absolute():
        out = (Path.cwd() / out).resolve()
    t0 = time.time()
    g = Generator(P, a.scenario, seed)
    g.run()
    S = g.summarize()
    checks = g.check_plants()
    g.write(out)
    print_summary(S, a.scenario, seed, time.time() - t0)
    n_fail = 0
    print("Planted-pattern assertions (final model §5.6):")
    for ck in checks:
        flag = "defer" if ck["ok"] is None else ("PASS " if ck["ok"] else "FAIL ")
        n_fail += ck["ok"] is False
        print(f"  [{flag}] {ck['name']}: {ck['value']} (target {ck['target']})")
    if n_fail:
        print(f"WARNING: {n_fail} assertion(s) failed")
    print(f"Wrote {out.relative_to(REPO) if out.is_relative_to(REPO) else out}")
    return g


if __name__ == "__main__":
    main()
