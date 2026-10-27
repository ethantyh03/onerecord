"""Business case (final model §6, implemented exactly) -> src/data/impact.json.

Every number in impact.json is a {value, unit, formula, source, display} object, so a judge can trace any figure on
/impact or the slides back to its arithmetic and its source. Three columns are kept apart and never summed:
  hard        = capacity released, hours x S$50 (the ONLY thing payback counts)          §6.2-6.3
  soft        = calendar days returned to requestors / customers                          §6.4
  opportunity = illustrative S$ from the synthetic data (stuck demand, drop-off, cross-sell) §6.5

Inputs (§6.1) come from:
  - analytics/params.yaml (request mix A12, bounce rate and duplicate rate A13): the same file the generator uses
  - the research log docs/research/2026-10-23-business-case-facts.md (loaded cost, licence prices, day rates,
    grants, benchmarks), quoted by section
  - the team-estimate register A19-A26 (final model §6.1), each with its arithmetic

Run:  PYTHONIOENCODING=utf-8 python analytics/business_case.py
"""
from __future__ import annotations

import datetime as dt
import math
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import SRC_DATA, load_params, read_json, read_table, write_json  # noqa: E402

RESEARCH = "research log (docs/research/2026-10-23-business-case-facts.md)"
FM = "final model §6"
VOLUMES = [40, 80, 120]
BASE_VOLUME = 80

# The final model's published figures (§6.2, §6.3, §6.6, §6.7). business_case.py must reproduce them; any
# difference is written to impact.json `checks` and printed, never silently absorbed.
PUBLISHED = {
    "hoursPerYear": {40: 1115, 80: 1751, 120: 2386},
    "netSgdPerYear": {40: 49779, 80: 81543, 120: 113307},
    "duplicatesStoppedPerYear": {40: 9, 80: 18, 120: 26},
    "paybackMonths": {40: 9.6, 80: 5.9, 120: 4.2},
    "paybackWorkflowOnlyMonths": {40: 18.6, 80: 8.3, 120: 5.4},
    "threeYearNetSgdK": {40: 109, 80: 205, 120: 300},
    "phase1OneOffSgd": 39900,
    "phase1RunSgd": 5985,
    "fteBase": 0.94,
    "phase2PaybackYearsProcess80": 19,
    "phase2PaybackYearsPayg80": 7,
    "phase2PaybackYearsProcess120": 4.7,
    "requestDaysReturned80": 640,
    "processShare": 0.43,
    "edgeGrantSgdK": 16,
}


# ---------------------------------------------------------------- helpers
def fmt_sgd(x: float) -> str:
    if x is None or (isinstance(x, float) and not math.isfinite(x)):
        return "—"
    a = abs(x)
    sign = "−" if x < 0 else ""
    if a >= 1e6:
        return f"{sign}S${a / 1e6:.2f}M"
    if a >= 1e4:
        return f"{sign}S${a / 1e3:.0f}k"
    return f"{sign}S${a:,.0f}"


def num(value, unit: str, formula: str, source: str, display: str | None = None, digits: int = 2) -> dict:
    """One traceable number. value None = not finite (e.g. 'never pays back'); display says so."""
    if value is not None and isinstance(value, float):
        value = round(value, digits) if math.isfinite(value) else None
    if display is None:
        if value is None:
            display = "—"
        elif unit == "SGD":
            display = fmt_sgd(value)
        elif unit in ("fraction",):
            display = f"{value * 100:.0f}%"
        else:
            display = f"{value:,}" if isinstance(value, int) else f"{value:,.{digits}f}".rstrip("0").rstrip(".")
            display = f"{display} {unit}"
    return {"value": value, "unit": unit, "formula": formula, "source": source, "display": display}


def months_disp(m: float | None) -> str:
    return "never pays back" if m is None or not math.isfinite(m) else f"{m:.1f} months"


def years_disp(y: float | None) -> str:
    return "never pays back" if y is None or not math.isfinite(y) else f"~{y:.1f} years"


# ---------------------------------------------------------------- §6.1 inputs
def build_inputs(P: dict) -> dict:
    mh = P["mdm_history"]
    per_month = mh["per_month"]
    total = int(sum(per_month.values()))
    customers = int(per_month["customer"] + per_month["extend"])
    i = {
        "hourlyRateSgd": 50.0,
        "requestsPerMonth": float(total),
        "customerRequestsPerMonth": float(customers),
        "customerShare": customers / total,
        "bounceRate": float(mh["bounce_p"]),
        "duplicateRate": float(mh["duplicate_p"]),
        "reworkHoursPerBounce": 1.0,
        "forwardingChasingHours": 0.50,
        "manualKeyingHours": 0.35,
        "duplicateReworkHours": 4.0,
        "duplicateInterceptRate": 0.70,
        "countryAnalysts": 5,
        "analystHoursSavedPerMonth": 8.0,
        "leanTeamPeople": 2, "leanTeamWeeks": 6, "leanTeamHoursPerWeek": 40,
        "contractorDays": 15, "contractorDayRateSgd": 650.0,
        "mdmConfigHours": 48,
        "onboardingPeople": 150, "onboardingHours": 0.5,
        "runCostRate": 0.15,
        "sapPartnerDays": 15, "sapPartnerDayRateSgd": 1500.0,
        "processLicenceUsdPerMonth": 150.0, "premiumMakerUsdPerMonth": 15.0,
        "paygUsdPerRun": 0.60,
        "phase2MaintenanceRate": 0.15,
        "dtwLoadHoursPerRequest": 0.15,
        "leakRate": 0.10,
        "fxSgdPerUsd": 1.33,
        "baselineMedianDays": 14.0,
        "amyDays": 18.0,
        "targetBusinessDays": 4.0,
        "targetCalendarDays": 6.0,
        "hoursPerFte": 1872.0,
        "edgeRate": 0.50, "edgeDigitalSubCapSgd": 30000.0,
    }
    assert total == 80 and customers == 35, "params.yaml request mix no longer matches A12 (80/month, 35 customers)"
    return i


def inputs_table(i: dict) -> list[dict]:
    """The §6.1 table, one row per input, each a traceable number."""
    rows = []

    def add(id_, label, n, tag, confidence="medium"):
        rows.append({"id": id_, "label": label, "tag": tag, "confidence": confidence, **n})

    add("rate", "Loaded cost, analyst / requestor / MDM", num(
        i["hourlyRateSgd"], "S$/hour",
        "(12 × S$5,869 MOM OWS 2025 median + 1.8 months AVC × S$5,694 + 17% CPF S$13,715 + SDL S$135) ≈ S$94.5k ÷ 1,872 h",
        f"{RESEARCH}: 'Working time and derived loaded hourly cost' + verifier check (derived, not published). "
        "All hours are valued at this rate; approver time is not counted.", "S$50/h"), "research")
    add("volume", "MDM requests per month (sensitivity 40 / 80 / 120)", num(
        int(i["requestsPerMonth"]), "requests/month",
        "customer 30 + extend 5 + item 30 + vendor 10 + cost centre 5 (params.yaml mdm_history.per_month)",
        "A12 (illustrative); analytics/params.yaml", "80 a month"), "assumption", "low")
    add("customers", "Customer requests (new + extend) per month", num(
        int(i["customerRequestsPerMonth"]), "requests/month", "customer 30 + extend 5",
        "A12; analytics/params.yaml", "35 of 80"), "assumption", "low")
    add("bounce", "Requests bounced at least once for missing information", num(
        i["bounceRate"], "fraction", "params.yaml mdm_history.bounce_p", "A13 (illustrative)", "40%"), "assumption", "low")
    add("dupRate", "New customer records that duplicate an existing one", num(
        i["duplicateRate"], "fraction", "params.yaml mdm_history.duplicate_p",
        "A13 (illustrative); the synthetic master data plants the same ≈6% (dedup.json)", "6%"), "assumption", "low")
    h = hours_saved_per_request(i)
    add("A19", "Hours saved per request", num(
        h, "hours/request",
        f"rework {i['bounceRate']:.0%} × {i['reworkHoursPerBounce']:.1f} h = {i['bounceRate'] * i['reworkHoursPerBounce']:.2f} "
        f"+ forwarding/chasing {i['forwardingChasingHours']:.2f} + manual keying vs import file {i['manualKeyingHours']:.2f}",
        "A19 (team estimate)", f"{h:.2f} h"), "team-estimate", "low")
    add("A20", "Duplicate rework avoided", num(
        i["duplicateReworkHours"], "hours/duplicate",
        f"{i['duplicateReworkHours']:.0f} h rework per duplicate customer; {i['duplicateInterceptRate']:.0%} intercepted at intake",
        f"A20 (team estimate); 1-10-100 heuristic, {RESEARCH}: 'Cost of poor data quality'",
        f"4 h each, {i['duplicateInterceptRate']:.0%} caught"), "team-estimate", "low")
    reg = regional_hours(i)
    add("A21", "Regional consolidation released", num(
        reg, "hours/month", f"{i['countryAnalysts']} country analysts × 1 day ({i['analystHoursSavedPerMonth']:.0f} h) a month",
        "A21 (team estimate)", f"{reg:.0f} h/month"), "team-estimate", "low")
    add("A22", "Phase-1 build, one-off", num(
        phase1_one_off(i), "SGD",
        "lean team 2 × 6 weeks × 40 h × S$50 = S$24,000 + contractor 15 days × S$650 = S$9,750 + MDM config 48 h × S$50 = "
        "S$2,400 + onboarding 150 people × 0.5 h × S$50 = S$3,750",
        f"A22; day rate = upper end of the research-derived S$450–650/day ({RESEARCH}: 'Day rates: Power Platform', low "
        "confidence)", "S$39,900"), "team-estimate", "low")
    add("run", "Phase-1 run cost", num(
        i["runCostRate"], "fraction of one-off per year", "15% × S$39,900 = S$5,985/yr",
        f"{RESEARCH}: 'Project cost: Power Platform engagement' (maintenance 15–25%/yr); we use the low end", "15%/yr"),
        "research", "low")
    add("A23", "Phase-2 SAP partner (Service Layer posting)", num(
        phase2_one_off(i), "SGD", "15 days × S$1,500/day",
        f"A23; derived from a US$150–350/h global proxy ({RESEARCH}: 'SAP B1 consulting day rates', low confidence)",
        "S$22,500"), "team-estimate", "low")
    add("licences", "Phase-2 licences", num(
        licences_sgd(i), "SGD/year",
        "(Process USD 150/month + 1 Premium maker USD 15/month) × 12 = USD 1,980 × 1.33",
        f"Microsoft list prices ({RESEARCH}: 'Power Automate Process' and 'Premium price', high confidence); "
        "before 9% GST (reclaimable if GST-registered)", "≈S$2,633/yr"), "research", "high")
    add("payg", "Phase-2 pay-as-you-go alternative", num(
        i["paygUsdPerRun"], "USD/run", "USD 0.60 per premium cloud-flow run (preview); cheaper than Process below 250 runs/month",
        f"{RESEARCH}: 'Pay-as-you-go meters' (high confidence; meter in preview)", "USD 0.60/run"), "research", "high")
    add("A24", "Leak rate on stuck demand", num(
        i["leakRate"], "fraction", "10% of blocked-PR value assumed lost for good",
        "A24 (team assumption, CFO lens). Opportunity column only, never in payback", "10%"), "assumption", "low")
    add("A25", "FX", num(i["fxSgdPerUsd"], "SGD per USD", "USD 1 = S$1.33",
                         f"{RESEARCH}: 'SGD pricing & GST' (range 1.30–1.35)", "S$1.33"), "research", "medium")
    add("A26", "Baseline median cycle time", num(
        i["baselineMedianDays"], "calendar days", "between the brief's '2–3 weeks' (S4) and Amy's 18 days (App C)",
        "A26 (assumption)", "14 calendar days"), "assumption", "medium")
    add("fte", "Productive hours per FTE-year", num(
        i["hoursPerFte"], "hours/year", "2,080 h − 11 public holidays (88 h) − 15 leave days (120 h)",
        f"{RESEARCH}: 'Working time and derived loaded hourly cost' (derived)", "1,872 h"), "research", "medium")
    return rows


# ---------------------------------------------------------------- §6.2-6.3 arithmetic (mirrors src/components/story/business-case.ts)
def hours_saved_per_request(i):
    return i["bounceRate"] * i["reworkHoursPerBounce"] + i["forwardingChasingHours"] + i["manualKeyingHours"]


def duplicates_stopped_per_month(v, i):
    return v * i["customerShare"] * i["duplicateRate"] * i["duplicateInterceptRate"]


def workflow_hours_per_month(v, i):
    return v * hours_saved_per_request(i) + duplicates_stopped_per_month(v, i) * i["duplicateReworkHours"]


def regional_hours(i):
    return i["countryAnalysts"] * i["analystHoursSavedPerMonth"]


def phase1_parts(i):
    return {
        "leanTeam": i["leanTeamPeople"] * i["leanTeamWeeks"] * i["leanTeamHoursPerWeek"] * i["hourlyRateSgd"],
        "contractor": i["contractorDays"] * i["contractorDayRateSgd"],
        "mdmConfig": i["mdmConfigHours"] * i["hourlyRateSgd"],
        "onboarding": i["onboardingPeople"] * i["onboardingHours"] * i["hourlyRateSgd"],
    }


def phase1_one_off(i):
    return sum(phase1_parts(i).values())


def phase1_run(i):
    return phase1_one_off(i) * i["runCostRate"]


def phase2_one_off(i):
    return i["sapPartnerDays"] * i["sapPartnerDayRateSgd"]


def licences_sgd(i):
    return (i["processLicenceUsdPerMonth"] + i["premiumMakerUsdPerMonth"]) * 12 * i["fxSgdPerUsd"]


def payback_months(one_off, net_per_year):
    return one_off / (net_per_year / 12) if net_per_year > 0 else math.inf


def hard_case(v: int, i: dict) -> dict:
    wf = workflow_hours_per_month(v, i)
    reg = regional_hours(i)
    hpy = (wf + reg) * 12
    gross = hpy * i["hourlyRateSgd"]
    run = phase1_run(i)
    net = gross - run
    one = phase1_one_off(i)
    wf_net = wf * 12 * i["hourlyRateSgd"] - run
    dup = duplicates_stopped_per_month(v, i) * 12
    return dict(v=v, hpr=hours_saved_per_request(i), wf=wf, reg=reg, hpy=hpy, fte=hpy / i["hoursPerFte"], gross=gross,
                run=run, net=net, dup=dup, one=one, pb=payback_months(one, net), pb_wf=payback_months(one, wf_net),
                wf_net=wf_net, net3=net * 3 - one, days=v * (i["baselineMedianDays"] - i["targetCalendarDays"]))


def phase2_case(v: int, i: dict) -> dict:
    hours = v * i["dtwLoadHoursPerRequest"]
    saving = hours * 12 * i["hourlyRateSgd"]
    lic = licences_sgd(i)
    maint = phase2_one_off(i) * i["phase2MaintenanceRate"]
    payg = v * 12 * i["paygUsdPerRun"] * i["fxSgdPerUsd"]
    net_p = saving - lic - maint
    net_g = saving - payg - maint
    yrs = lambda n: phase2_one_off(i) / n if n > 0 else math.inf  # noqa: E731
    return dict(v=v, hours=hours, saving=saving, lic=lic, maint=maint, payg=payg, net_p=net_p, net_g=net_g,
                yrs_p=yrs(net_p), yrs_g=yrs(net_g))


# ---------------------------------------------------------------- sections
def hard_section(i: dict) -> dict:
    rows = []
    for v in VOLUMES:
        c = hard_case(v, i)
        dpm = duplicates_stopped_per_month(v, i)
        rows.append({
            "requestsPerMonth": v,
            "isBase": v == BASE_VOLUME,
            "hoursSavedPerRequest": num(c["hpr"], "hours/request", "A19: 0.40 + 0.50 + 0.35", "A19"),
            "duplicatesStoppedPerYear": num(
                c["dup"], "duplicates/year",
                f"{v} requests × 35/80 customers × 6% duplicates × 70% intercepted × 12 = {c['dup']:.1f}",
                "A12, A13, A20", f"≈{round(c['dup'])} a year", 1),
            "workflowHoursPerMonth": num(
                c["wf"], "hours/month",
                f"{v} × {c['hpr']:.2f} h + {dpm:.2f} duplicates stopped × 4 h = {c['wf']:.1f} h",
                "A19, A20", f"{c['wf']:.1f} h/month", 1),
            "regionalHoursPerMonth": num(c["reg"], "hours/month", "5 analysts × 8 h", "A21", "40 h/month", 1),
            "hoursPerYear": num(c["hpy"], "hours/year", f"({c['wf']:.1f} + {c['reg']:.0f}) × 12",
                                "A19–A21", f"{c['hpy']:,.0f} h/year", 0),
            "fte": num(c["fte"], "FTE", f"{c['hpy']:,.0f} h ÷ 1,872 h", f"{RESEARCH} (1,872 h/FTE)",
                       f"≈{c['fte']:.2f} FTE"),
            "grossSgdPerYear": num(round(c["gross"]), "SGD", f"{c['hpy']:,.1f} h × S$50", "hours × loaded rate",
                                   f"S${c['gross']:,.0f}"),
            "runCostSgdPerYear": num(round(c["run"]), "SGD", "15% × S$39,900", "A22 run cost", f"S${c['run']:,.0f}"),
            "netSgdPerYear": num(round(c["net"]), "SGD", f"S${c['gross']:,.0f} − S${c['run']:,.0f}",
                                 "hard benefit after run cost", f"S${c['net']:,.0f}"),
        })
    return {
        "title": "Hard benefit: capacity released (hours × S$50)",
        "note": "Capacity released, not cash saved: no headcount cut is assumed; the hours go back to customer work. "
                "Approver time (S$85–110/h) is not counted.",
        "rows": rows,
    }


def cost_section(i: dict) -> dict:
    p = phase1_parts(i)
    one, run = phase1_one_off(i), phase1_run(i)
    p2, lic, maint = phase2_one_off(i), licences_sgd(i), phase2_one_off(i) * i["phase2MaintenanceRate"]
    return {
        "title": "Cost (no new licences for the workflow (phase 1): standard connectors, SharePoint, Teams Approvals, SAP import files)",
        "phase1": {
            "label": "Phase 1 (pilot → rollout)",
            "oneOff": num(one, "SGD", "S$24,000 + S$9,750 + S$2,400 + S$3,750", "A22", "S$39,900", 0),
            "components": [
                {"label": "Lean team (2 people × 6 weeks)", **num(p["leanTeam"], "SGD", "2 × 6 × 40 h × S$50", "A22", "S$24,000", 0)},
                {"label": "Data-science / Power Platform contractor", **num(p["contractor"], "SGD", "15 days × S$650", "A22 (low confidence)", "S$9,750", 0)},
                {"label": "MDM team configuration", **num(p["mdmConfig"], "SGD", "48 h × S$50", "A22", "S$2,400", 0)},
                {"label": "Onboarding", **num(p["onboarding"], "SGD", "150 people × 0.5 h × S$50", "A22", "S$3,750", 0)},
            ],
            "runPerYear": num(run, "SGD/year", "15% × S$39,900", "A22", "S$5,985/yr", 0),
            "cashCost": num(p["contractor"], "SGD", "contractor only; the rest is internal time",
                            "final model §6.8 (pilot)", "≈S$9,750 cash", 0),
            "newLicences": num(0, "SGD", "standard connectors, SharePoint, Teams Approvals, DTW import files",
                               f"{RESEARCH}: 'Power Automate rights included in M365', 'Approvals connector = standard'",
                               "S$0"),
        },
        "phase2": {
            "label": "Phase 2 (only after the pilot proves the KPI)",
            "oneOff": num(p2, "SGD", "15 days × S$1,500", "A23 (low confidence)", "S$22,500", 0),
            "licencesPerYear": num(lic, "SGD/year", "USD 1,980 × 1.33", "Microsoft list price (research log)", "≤S$2,633/yr", 0),
            "maintenancePerYear": num(maint, "SGD/year", "15% × S$22,500", "research log (maintenance 15–25%)", "S$3,375/yr", 0),
        },
    }


def payback_section(i: dict) -> dict:
    rows = []
    for v in VOLUMES:
        c = hard_case(v, i)
        rows.append({
            "requestsPerMonth": v,
            "isBase": v == BASE_VOLUME,
            "paybackMonths": num(c["pb"], "months", f"S$39,900 ÷ (S${c['net']:,.0f} ÷ 12)",
                                 "phase-1 one-off ÷ monthly net hard benefit", months_disp(c["pb"]), 1),
            "paybackWorkflowOnlyMonths": num(
                c["pb_wf"], "months", f"S$39,900 ÷ ((S${c['wf'] * 12 * 50:,.0f} − S$5,985) ÷ 12)",
                "same, counting workflow hours only (no regional consolidation A21)", months_disp(c["pb_wf"]), 1),
            "threeYearNetSgd": num(round(c["net3"]), "SGD", f"3 × S${c['net']:,.0f} − S$39,900", "hard benefit only",
                                   fmt_sgd(c["net3"])),
        })
    edge_third = i["contractorDays"] * i["contractorDayRateSgd"] + phase2_one_off(i)
    edge = min(edge_third * i["edgeRate"], i["edgeDigitalSubCapSgd"])
    return {
        "title": "Payback (hard hours only)",
        "rows": rows,
        "upside": [
            {"label": "EDGE grant (not in the base case)", **num(
                edge, "SGD", f"50% × (S$9,750 contractor + S$22,500 SAP partner) = S${edge_third * 0.5:,.0f}, under the S$30k digital sub-cap",
                f"Enterprise Singapore EDGE, from 30 Sep 2026 ({RESEARCH}: 'Grants: EDG/PSG have been replaced by EDGE'). "
                "Applies only if Lives qualifies as an SME on the turnover test (≤S$100m). PSG is closed; not cited.",
                f"≈{fmt_sgd(edge)}")},
            {"label": "EIS 400% tax deduction (not in the base case)", **num(
                50000, "SGD", "400% deduction on up to S$50,000 of qualifying AI spend per YA, YA2027–2028",
                f"Budget 2026 ({RESEARCH}: 'Grants and tax: 2026 AI adoption schemes'); IRAS definition pending",
                "up to S$50k qualifying spend")},
            {"label": "Approver time (not counted)", **num(
                None, "S$/hour", "approvers at S$85–110/h spend less time chasing; excluded to stay conservative",
                f"{RESEARCH}: derived loaded cost, GM ≈ S$110/h", "not counted")},
        ],
    }


def soft_section(i: dict) -> dict:
    c = hard_case(BASE_VOLUME, i)
    return {
        "title": "Soft benefit (not in payback)",
        "requestDaysReturnedPerMonth": num(
            c["days"], "request-days/month", "80 requests × (14 − ~6 calendar days)",
            "A12, A26; target ≤4 business days ≈ 6 calendar days", f"≈{c['days']:,.0f} request-days a month", 0),
        "cycleTime": {
            "amy": num(i["amyDays"], "calendar days", "App C: Amy's item", "Brief, App C", "18 days"),
            "baselineMedian": num(i["baselineMedianDays"], "calendar days", "A26", "A26", "14 days"),
            "target": num(i["targetBusinessDays"], "business days", "parallel stage 1 + 2-business-day SLA + import file",
                          "final model §6.7 (median target)", "≤4 business days"),
            "benchmark": num(3.0, "calendar days", "APQC median time to set up a supplier (3,047 organisations)",
                             f"{RESEARCH}: APQC Open Standards Benchmarking (system setup only)", "3.0 days"),
        },
        "note": "Customers can be invoiced sooner; this is timing, not new revenue.",
    }


def opportunity_section(i: dict, scenario: str = "base") -> dict:
    sig = read_json(SRC_DATA / "signals.json")
    prs = read_table("prs", scenario)
    hist = read_table("mdm_requests_hist", scenario)
    window = hist[hist["submitted_at"].str[:7].between("2025-10", "2026-09")]
    ids = sorted({x for s in window["blocked_pr_ids"] for x in str(s).split(";") if x})
    blocked_hist = prs[prs["pr_id"].isin(ids)]
    hist_sgd = float(blocked_hist["sgd"].sum())
    with_block = window[window["blocked_pr_ids"].astype(str) != ""]
    avg_days = float(pd.to_numeric(with_block["cycle_days"], errors="coerce").mean())
    now = prs[prs["status"] == "blocked"]
    da = sig["totals"]["dropOffAddressableSgd"]
    xa = sig["totals"]["crossSellAddressableSgd"]
    sr = sig["assumptions"]["dropOffSaveRate"]
    cr = sig["assumptions"]["crossSellConversion"]
    return {
        "title": "Opportunity (illustrative, synthetic data; its own column, never summed into payback or into one revenue number)",
        "stuckDemandNow": {
            "label": "Stuck demand now",
            **num(None, "SGD", "Σ value of open PRs whose blockedByRequestId points to a pending MDM request",
                  "live from the demo store (the Pulse tile and /mdm); drops when Priya creates the record", "live tile"),
            "live": True,
            "syntheticHistoryCheck": num(round(float(now["sgd"].sum())), "SGD",
                                         f"{len(now)} PRs blocked on 28 Oct 2026 in analytics/out/base/prs.csv",
                                         "synthetic generator (final model §5.6 #6 target S$150–450k)"),
        },
        "blockedDuringWindow": {
            "label": "PRs blocked by an MDM setup during Oct 2025 – Sep 2026",
            **num(round(hist_sgd), "SGD",
                  f"Σ value of the {len(blocked_hist)} PRs referenced by the {len(with_block)} setup requests in the window "
                  f"that had an order waiting (avg {avg_days:.1f} calendar days blocked)",
                  "synthetic MDM history (mdm_requests_hist.csv × prs.csv)"),
            "avgDaysBlocked": num(avg_days, "calendar days", "mean cycle time of those setup requests", "synthetic MDM history", digits=1),
        },
        "revenueAtRiskPerYear": {
            "label": "Revenue at risk per year (leak on blocked PRs)",
            **num(round(hist_sgd * i["leakRate"]), "SGD", f"{fmt_sgd(hist_sgd)} blocked in the window × 10% leak (A24)",
                  "A24 (team assumption) on synthetic history", f"≈{fmt_sgd(hist_sgd * i['leakRate'])} a year"),
            "note": "Stuck demand is mostly delayed revenue, not lost revenue; only the 10% leak is counted as at risk.",
        },
        "dropOff": {
            "label": "Drop-off accounts: last-12-month value at risk",
            **num(da, "SGD", f"Σ trailing-12M value of the {len(sig['dropOff'])} flagged accounts (signals.json)",
                  "signals.json (synthetic)", f"{fmt_sgd(da)} at risk, before save rate"),
            "assumedRate": num(sr, "fraction", "assumed save rate", "team assumption (signals.json)", f"{sr:.0%} save rate"),
            "expectedIfRateHolds": num(round(da * sr), "SGD", f"{fmt_sgd(da)} × {sr:.0%}", "illustrative", fmt_sgd(da * sr)),
        },
        "crossSell": {
            "label": "Cross-sell: yearly gap to similar customers",
            **num(xa, "SGD", f"Σ peer-gap value of the {len(sig['crossSell'])} flagged customers (signals.json)",
                  "signals.json (synthetic)", f"{fmt_sgd(xa)} addressable, before conversion"),
            "assumedRate": num(cr, "fraction", "assumed conversion", "team assumption (signals.json)", f"{cr:.0%} conversion"),
            "expectedIfRateHolds": num(round(xa * cr), "SGD", f"{fmt_sgd(xa)} × {cr:.0%}", "illustrative", fmt_sgd(xa * cr)),
        },
        "rule": "These figures are never added to each other, to the hard benefit or to payback.",
    }


def phase2_section(i: dict) -> dict:
    rows = []
    for v in VOLUMES:
        c = phase2_case(v, i)
        rows.append({
            "requestsPerMonth": v,
            "isBase": v == BASE_VOLUME,
            "hoursSavedPerMonth": num(c["hours"], "hours/month", f"{v} × 0.15 h (the DTW load step only)", "final model §6.6", digits=1),
            "savingSgdPerYear": num(round(c["saving"]), "SGD", f"{c['hours']:.1f} h × 12 × S$50", "hours × loaded rate"),
            "netWithProcessSgdPerYear": num(round(c["net_p"]), "SGD",
                                            f"S${c['saving']:,.0f} − S${c['lic']:,.0f} licences − S${c['maint']:,.0f} maintenance",
                                            "Process licence route"),
            "paybackYearsProcess": num(c["yrs_p"], "years", f"S$22,500 ÷ S${c['net_p']:,.0f}", "Process licence route",
                                       years_disp(c["yrs_p"]), 1),
            "paygSgdPerYear": num(round(c["payg"]), "SGD", f"{v} × 12 runs × USD 0.60 × 1.33", "pay-as-you-go (preview)"),
            "netWithPaygSgdPerYear": num(round(c["net_g"]), "SGD",
                                         f"S${c['saving']:,.0f} − S${c['payg']:,.0f} PAYG − S${c['maint']:,.0f} maintenance",
                                         "pay-as-you-go route"),
            "paybackYearsPayg": num(c["yrs_g"], "years", f"S$22,500 ÷ S${c['net_g']:,.0f}", "pay-as-you-go route",
                                    years_disp(c["yrs_g"]), 1),
        })
    base = phase2_case(BASE_VOLUME, i)
    return {
        "title": "Why automatic SAP posting (Service Layer) is not in v1",
        "rows": rows,
        "conclusion": (f"At 80 requests a month automatic posting saves only the DTW load step, ≈{base['hours']:.0f} h a month "
                       f"(S${base['saving']:,.0f} a year). After licences and maintenance it nets ≈S${base['net_p']:,.0f} a year, "
                       f"so the S$22,500 build pays back in {years_disp(base['yrs_p'])} ({years_disp(base['yrs_g'])} on "
                       "pay-as-you-go). Phase 2 is justified by speed (same-day posting) or scale, not hours: we decide after the pilot."),
    }


WATERFALL = [
    ("notice", "Waiting for MDM to notice the email", 2, 0, "Form goes straight into routing", "tooling"),
    ("bounce", "Bounce for the missing QA/RA field + travel delay", 5, 0, "Completeness gate + IVD rule", "tooling"),
    ("sequential", "Sequential hand-offs (3 approvers × ~3 days)", 9, 3,
     "Parallel stage 1 + 2-business-day SLA + reminders", "process"),
    ("keying", "MDM queue + manual keying", 2, 1, "DTW file from the approved request", "tooling"),
]


def waterfall_section() -> dict:
    slices = []
    for id_, label, b, a, fix, kind in WATERFALL:
        slices.append({"id": id_, "label": label, "kind": kind, "fix": fix,
                       "beforeDays": num(b, "calendar days", "App C breakdown", "final model §6.7 (our reading of App C)"),
                       "afterDays": num(a, "calendar days", "target", "final model §6.7"),
                       "savedDays": num(b - a, "calendar days", f"{b} − {a}", "final model §6.7")})
    before = sum(w[2] for w in WATERFALL)
    after = sum(w[3] for w in WATERFALL)
    proc = sum(w[2] - w[3] for w in WATERFALL if w[5] == "process")
    saved = before - after
    return {
        "title": "Where Amy's 18 days go, and what fixes them",
        "slices": slices,
        "totals": {
            "beforeDays": num(before, "calendar days", " + ".join(str(w[2]) for w in WATERFALL), "App C", f"{before} days"),
            "afterDays": num(after, "calendar days", " + ".join(str(w[3]) for w in WATERFALL), "final model §6.7",
                             f"~{after} calendar days (≈3 business days)"),
            "savedDays": num(saved, "calendar days", f"{before} − {after}", "final model §6.7", f"{saved} days"),
            "processSavedDays": num(proc, "calendar days", "sequential 9 → 3", "process change only (no software)",
                                    f"≈{proc} days"),
            "processShare": num(proc / saved, "fraction", f"{proc} ÷ {saved}", "final model §6.7",
                                f"≈{proc / saved:.0%} of the saving needs no new software", 3),
        },
    }


def kpi_section() -> dict:
    return {
        "pilot": {
            "weeks": 6,
            "scope": "SG + MY · Customer + Item domains · SPD + QTS",
            "cash": "Phase-1 cash cost ≈ the contractor (S$9,750); the rest is internal time",
            "summary": "6-week pilot in SG + MY on the Customer and Item domains for SPD and QTS; rerun the analytics on "
                       "SAP B1 extracts in week 1.",
        },
        "kpis": [
            {"kpi": "Requests through OneRecord", "target": "≥90% by week 6 (month 2 at rollout)", "baseline": "0% (email)"},
            {"kpi": "Median setup time", "target": "≤ 4 business days", "baseline": "median 14 days (Amy's took 18) (A26)"},
            {"kpi": "Bounce rate (sent back for missing info)", "target": "<15%", "baseline": "40% (A13)"},
            {"kpi": "Duplicates intercepted at intake", "target": "count, reported weekly", "baseline": "not measured"},
            {"kpi": "Stuck demand (S$ of orders waiting on a setup)", "target": "falling trend", "baseline": "live tile"},
        ],
        "killScale": {
            "kill": "At week 6, if the median is above 6 business days or adoption is below 70%: fix or stop.",
            "scale": "If the KPIs are met: TH / VN / MM, then the Vendor and Cost-centre domains.",
        },
        "adoption": [
            "One front door: the MDM mailbox auto-replies with the form link after 4 weeks",
            "One-click approvals inside Teams",
            "Visible status ends chasing",
            "A champion per entity and country",
            "30-minute onboarding",
            "A weekly SLA scoreboard",
        ],
    }


ALTERNATIVES = [
    # option, one-off, incomplete, duplicates, approvals, mdm-without-IT, analytics, verdict, chosen
    ("Status quo + better email template + shared tracker", "~S$0", "partly", "no", "no", "yes", "no",
     "Doesn't fix noticing or chasing", False),
    ("SAP B1 approval procedures", "S$0", "no", "no", "na", "na", "no",
     "Built-in approvals are document-centric: no structured intake, no duplicate check, no Teams routing and no parallel SLA for master-data requests", False),
    ("Teams Approvals templates only", "~S$0", "partly", "no", "yes", "yes", "no",
     "A good zero-build first step; no duplicate check, no SAP-ready output", False),
    ("Forms / Power Apps + SharePoint + Power Automate only", "~S$30k", "yes", "partly", "yes", "yes", "no",
     "Fixes the workflow (exact-match duplicates only), but the regional numbers stay dirty", False),
    ("Buy an MDM suite / B1 add-on", "High (enterprise pricing; not verified) + IT", "yes", "yes", "yes", "partly", "partly",
     "Over-sized for ~80 requests a month", False),
    ("OneRecord (M365 workflow + small DS layer + DTW)", "~S$40k, no new licences for the workflow (phase 1)", "yes", "yes", "yes", "yes", "yes",
     "Chosen: fuzzy + tax-ID duplicate check, parallel approvals with SLA, stuck demand, de-duplicated forecast", True),
]


def alternatives_section() -> dict:
    cols = ["stopsIncomplete", "stopsDuplicates", "fastVisibleApprovals", "mdmChangesWithoutIt", "regionalAnalytics"]
    rows = []
    for o, cost, *marks, verdict, chosen in ALTERNATIVES:
        rows.append({"option": o, "oneOff": cost, **dict(zip(cols, marks)), "verdict": verdict, "chosen": chosen})
    return {
        "title": "Why this, not…",
        "columns": {"stopsIncomplete": "Stops incomplete", "stopsDuplicates": "Stops duplicates",
                    "fastVisibleApprovals": "Fast + visible approvals", "mdmChangesWithoutIt": "MDM changes it without IT",
                    "regionalAnalytics": "Regional analytics"},
        "rows": rows,
        "sources": {
            "SAP B1 approval procedures": f"{RESEARCH}: verified top fact (SAP Learning, 'Implementing the approval processes')",
            "OneRecord": "phase-1 one-off S$39,900 (this file, costs.phase1)",
        },
    }


def synthetic_history_check(scenario: str = "base") -> dict:
    """The synthetic as-is MDM history is generated FROM A12/A13/A26, so this checks consistency, not truth."""
    h = read_table("mdm_requests_hist", scenario)
    created = h[h["status"] == "created"]
    months = h["submitted_at"].str[:7].nunique()
    return {
        "note": "Consistency check only: the synthetic MDM history was generated from these assumptions, so it is not evidence for them.",
        "requestsPerMonth": num(len(h) / months, "requests/month", f"{len(h)} requests ÷ {months} months", "mdm_requests_hist.csv", digits=1),
        "medianCycleDays": num(float(created["cycle_days"].median()), "calendar days", "median of created requests",
                               "mdm_requests_hist.csv", digits=1),
        "bounceRate": num(float((h["bounces"] > 0).mean()), "fraction", "share with ≥1 bounce", "mdm_requests_hist.csv", digits=3),
        "duplicateShareOfCustomerRequests": num(
            float(h.loc[h["domain"] == "customer", "was_duplicate"].mean()), "fraction",
            "share of customer requests flagged as duplicates", "mdm_requests_hist.csv", digits=3),
    }


# ---------------------------------------------------------------- checks against the final model's figures
def checks(i: dict) -> list[dict]:
    out = []

    def chk(name, expected, computed, tol):
        ok = computed is not None and math.isfinite(computed) and abs(computed - expected) <= tol
        out.append({"name": name, "expected": expected, "computed": round(computed, 3) if computed is not None and math.isfinite(computed) else None,
                    "tolerance": tol, "ok": bool(ok)})

    for v in VOLUMES:
        c = hard_case(v, i)
        chk(f"hours/yr at {v}", PUBLISHED["hoursPerYear"][v], c["hpy"], 0.5)
        chk(f"net S$/yr at {v}", PUBLISHED["netSgdPerYear"][v], c["net"], 0.5)
        chk(f"duplicates stopped/yr at {v}", PUBLISHED["duplicatesStoppedPerYear"][v], c["dup"], 0.5)
        chk(f"payback months at {v}", PUBLISHED["paybackMonths"][v], c["pb"], 0.05)
        chk(f"payback (workflow only) at {v}", PUBLISHED["paybackWorkflowOnlyMonths"][v], c["pb_wf"], 0.05)
        chk(f"3-year net S$k at {v}", PUBLISHED["threeYearNetSgdK"][v], c["net3"] / 1000, 0.5)
    chk("phase-1 one-off", PUBLISHED["phase1OneOffSgd"], phase1_one_off(i), 0.5)
    chk("phase-1 run/yr", PUBLISHED["phase1RunSgd"], phase1_run(i), 0.5)
    chk("FTE at 80", PUBLISHED["fteBase"], hard_case(80, i)["fte"], 0.005)
    chk("phase-2 payback yrs (Process) at 80", PUBLISHED["phase2PaybackYearsProcess80"], phase2_case(80, i)["yrs_p"], 0.5)
    chk("phase-2 payback yrs (PAYG) at 80", PUBLISHED["phase2PaybackYearsPayg80"], phase2_case(80, i)["yrs_g"], 0.5)
    chk("phase-2 payback yrs (Process) at 120", PUBLISHED["phase2PaybackYearsProcess120"], phase2_case(120, i)["yrs_p"], 0.05)
    chk("request-days returned at 80", PUBLISHED["requestDaysReturned80"], hard_case(80, i)["days"], 0.5)
    proc = sum(w[2] - w[3] for w in WATERFALL if w[5] == "process") / sum(w[2] - w[3] for w in WATERFALL)
    chk("process-only share of the 14 days saved", PUBLISHED["processShare"], proc, 0.005)
    edge = min((i["contractorDays"] * i["contractorDayRateSgd"] + phase2_one_off(i)) * i["edgeRate"], i["edgeDigitalSubCapSgd"])
    chk("EDGE grant S$k", PUBLISHED["edgeGrantSgdK"], edge / 1000, 0.5)
    return out


# ---------------------------------------------------------------- build
def build_impact(scenario: str = "base") -> dict:
    P = load_params()
    i = build_inputs(P)
    base = hard_case(BASE_VOLUME, i)
    ck = checks(i)
    return {
        "isMock": False,
        "generatedAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds"),
        "generator": "analytics/business_case.py",
        "spec": "final model §6 (team design notes, 28 Oct 2026)",
        "synthetic": True,
        "conventions": ("Every number is {value, unit, formula, source, display}. value null = not finite (e.g. never pays "
                        "back). Hard, soft and opportunity are separate columns: payback counts hard hours only."),
        "baseVolume": BASE_VOLUME,
        "volumes": VOLUMES,
        "headline": {
            "paybackMonths": num(base["pb"], "months", f"S$39,900 ÷ (S${base['net']:,.0f} ÷ 12)", "this file, payback.rows[80]",
                                 f"{base['pb']:.1f} months", 1),
            "phase1OneOffSgd": num(base["one"], "SGD", "A22", "this file, costs.phase1", "S$39.9k", 0),
            "hoursPerYear": num(base["hpy"], "hours/year", "(105.9 + 40) × 12", "this file, hardBenefit.rows[80]",
                                f"{base['hpy']:,.0f} h a year (≈{base['fte']:.2f} FTE)", 0),
            "netSgdPerYear": num(round(base["net"]), "SGD", "gross − run", "this file, hardBenefit.rows[80]", f"S${base['net']:,.0f}"),
            "threeYearNetSgd": num(round(base["net3"]), "SGD", "3 × net − one-off", "this file", fmt_sgd(base["net3"])),
            "newLicences": "none for the workflow (phase 1)",
            "sentence": (f"Phase 1 costs about S${base['one'] / 1000:.1f}k, with no new licences for the workflow (phase 1), and releases ~{base['hpy']:,.0f} hours "
                         f"a year (≈{base['fte']:.2f} FTE), paying back in about {base['pb']:.1f} months at 80 requests a month."),
        },
        "inputs": inputs_table(i),
        "hardBenefit": hard_section(i),
        "costs": cost_section(i),
        "payback": payback_section(i),
        "soft": soft_section(i),
        "opportunity": opportunity_section(i, scenario),
        "phase2Case": phase2_section(i),
        "waterfall": waterfall_section(),
        "adoption": kpi_section(),
        "alternatives": alternatives_section(),
        "syntheticHistoryCheck": synthetic_history_check(scenario),
        "checks": ck,
        "checksPassed": all(c["ok"] for c in ck),
    }


def main() -> None:
    imp = build_impact("base")
    write_json(imp, SRC_DATA / "impact.json")
    h = imp["headline"]
    print(f"impact.json: payback {h['paybackMonths']['display']} on {h['phase1OneOffSgd']['display']}; "
          f"{h['hoursPerYear']['display']}; net {h['netSgdPerYear']['display']}/yr; 3-yr {h['threeYearNetSgd']['display']}")
    for r in imp["payback"]["rows"]:
        print(f"  {r['requestsPerMonth']:>3}/mo  payback {r['paybackMonths']['display']:<14} workflow-only "
              f"{r['paybackWorkflowOnlyMonths']['display']:<14} 3-yr {r['threeYearNetSgd']['display']}")
    for r in imp["phase2Case"]["rows"]:
        print(f"  phase 2 at {r['requestsPerMonth']:>3}/mo: Process {r['paybackYearsProcess']['display']}, "
              f"PAYG {r['paybackYearsPayg']['display']}")
    o = imp["opportunity"]
    print(f"  opportunity: blocked in window {o['blockedDuringWindow']['display']} -> at risk {o['revenueAtRiskPerYear']['display']}; "
          f"drop-off {o['dropOff']['display']}; cross-sell {o['crossSell']['display']}")
    bad = [c for c in imp["checks"] if not c["ok"]]
    print(f"  checks vs final model §6: {len(imp['checks']) - len(bad)}/{len(imp['checks'])} match")
    for c in bad:
        print(f"    MISMATCH {c['name']}: expected {c['expected']} computed {c['computed']}")
    if bad:
        raise SystemExit("business case no longer reproduces the final model §6 figures")


if __name__ == "__main__":
    main()
