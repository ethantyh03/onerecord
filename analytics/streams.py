"""Demand streams vs internal MDM work per country -> src/data/streams.json, plus the sample inbox -> inbox.json.

Streams (A6, final model §5.1/§5.4), each on its own axis and never summed together:
  - POs        = confirmed orders = demand (counted; S$ on merged customers, so it equals the matrix country total)
  - PRs        = accepted quotes / stated intent = pipeline (S$, not counted as volume)
  - enquiries  = price / stock / spec questions = leading indicator (counts)
  - follow-ups = messages about an existing PO = excluded from demand (count kept for reference only)
  - MDM setups = internal master-data work (counts), NOT demand; linked to demand only through stuck demand
                 (a PR blocked by a pending MDM request, which the app shows live from its store)

The inbox is 25 hand-written fictional messages for the Inbound sorting screen. They were written for this file
(not copied from analytics/triage/testset.json or devset.json) and reuse customer and item names from the synthetic
data so the screen ties back to Regional Pulse. `humanLabel` is our hand label; the app classifies live.

Usage:  python analytics/streams.py [--scenario base] [--out-dir src/data]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from common import COUNTRIES, SRC_DATA, add_months, load_all, load_params, month_range, windows, write_json

SERIES_START = "2024-10"
SERIES_END = "2026-09"


def window_block(params: dict) -> dict:
    t = params["time"]
    return {
        "label": "Oct 2025 – Sep 2026",
        "start": t["window_start"], "end": t["window_end"],
        "priorStart": t["prior_start"], "priorEnd": t["prior_end"],
        "momentumStart": t["momentum_start"], "momentumEnd": t["momentum_end"],
        "historyStart": t["history_start"], "historyEnd": t["history_end"],
        "forecastStart": add_months(t["window_end"], 1), "forecastEnd": add_months(t["window_end"], 3),
    }


def yoy(cur: float, prior: float) -> float | None:
    return None if not prior else round(cur / prior - 1, 4)


def build_streams(scenario: str = "base") -> dict:
    params = load_params()
    W = windows(params)
    d = load_all(scenario)
    pos, prs, enq, fup, mdm = d["pos"], d["prs"], d["enquiries"], d["followups"], d["mdm_requests_hist"]
    months = month_range(SERIES_START, SERIES_END)
    cur, prior = set(W["current"]), set(W["prior"])

    prs = prs.assign(month=prs.created_at.str[:7])
    enq = enq.assign(month=enq.received_at.str[:7])
    fup = fup.assign(month=fup.received_at.str[:7])
    mdm = mdm.assign(month=mdm.submitted_at.str[:7])
    mdm_first = mdm.month.min() if len(mdm) else None

    def monthly(df: pd.DataFrame, country_col: str, value: str | None) -> pd.DataFrame:
        g = df.groupby(["month", country_col])
        s = g[value].sum() if value else g.size()
        return s.unstack(country_col).reindex(index=months, columns=COUNTRIES).fillna(0.0)

    po_m = monthly(pos, "true_country", "sgd")          # merged-customer view (true country)
    pr_m = monthly(prs, "country", "sgd")
    enq_m = monthly(enq, "country", None)
    mdm_m = monthly(mdm, "country", None)

    countries = []
    for c in COUNTRIES:
        pc = prs[prs.country == c]
        pw = pc[pc.month.isin(cur)]
        resolved = pw[pw.status.isin(["converted", "lost"])]
        conv = float((resolved.status == "converted").mean()) if len(resolved) else 0.0
        open_ = pc[pc.status == "open"]                  # blocked PRs are excluded: the app adds them live
        e_cur = int((enq.country.eq(c) & enq.month.isin(cur)).sum())
        e_pri = int((enq.country.eq(c) & enq.month.isin(prior)).sum())
        series = [{
            "month": m,
            "enquiries": int(enq_m.loc[m, c]),
            "prSgd": int(round(pr_m.loc[m, c])),
            "poSgd": int(round(po_m.loc[m, c])),
            "mdmRequests": int(mdm_m.loc[m, c]),
        } for m in months]
        countries.append({
            "country": c,
            "enquiries12m": e_cur,
            "enquiriesPrior12m": e_pri,
            "enquiryYoy": yoy(e_cur, e_pri),
            "prSgd12m": int(round(pw.sgd.sum())),
            "prPipelineOpenSgd": int(round(open_.sgd.sum())),
            "prOpenCount": int(len(open_)),
            "poSgd12m": int(round(pos.loc[pos.true_country.eq(c) & pos.month.isin(cur), "sgd"].sum())),
            "mdmRequests12m": int((mdm.country.eq(c) & mdm.month.isin(cur)).sum()),
            "prToPoConversion": round(conv, 4),
            "series": series,
            # extra (not in the TS contract): excluded stream and conversion detail, for the report
            "followups12m": int((fup.country.eq(c) & fup.month.isin(cur)).sum()),
            "prResolved12m": int(len(resolved)),
            "prBlockedInCsv": int((pc.status == "blocked").sum()),
        })

    return {
        "isMock": False,
        "scenario": scenario,
        "window": window_block(params),
        "legend": ("Orders, open requests and enquiries are customer demand; MDM setups are our internal work, "
                   "connected only where a setup blocks an order."),
        "definitions": {
            "po": "Purchase order: a confirmed customer order. This is volume, counted on merged customers.",
            "pr": "Purchase request: quote accepted or stated intent to buy, no PO yet. Pipeline, not counted as volume.",
            "enquiry": "Price, stock or spec question with no commitment. A leading indicator (count).",
            "followup": "Message about an existing PO: delivery, invoice, return or credit note. Excluded from demand.",
            "mdm": "Internal master-data setup request (customer, item, vendor, cost centre). Our work, not demand; own axis.",
        },
        "stuckDemandNote": ("prPipelineOpenSgd counts open PRs only. PRs blocked by a pending MDM request are stuck "
                            "demand, shown live from the app's store with their count and days blocked."),
        "conversionNote": ("prToPoConversion = PRs raised Oct 2025–Sep 2026 that became a PO ÷ those that became a PO "
                           "or were lost (still-open PRs excluded)."),
        "mdmHistoryNote": (f"MDM setup history starts {mdm_first}; earlier months show 0 because no history was "
                           f"generated, not because there were no requests." if mdm_first and mdm_first > SERIES_START
                           else "MDM setup history covers the full series."),
        "countries": countries,
    }


# ---------------------------------------------------------------- inbox (hand-written, fictional)
def _addr(local: str, company: str) -> str:
    slug = "".join(ch for ch in company.lower() if ch.isalnum())[:24]
    return f"{local}@{slug}.example"


INBOX = [
    # (country, company, sender local part, subject, body, receivedAt, humanLabel); ids are assigned by time
    ("SG", "Jalan Kayu Vale General Hospital", "purchasing",
     "Purchase Order PO-681204 – chemistry reagents, Nov replenishment",
     "Dear Lives team,\n\nPlease find attached our Purchase Order PO-681204:\n- Glucose GOD-PAP Reagent 4x100mL (I-A-000851) x 60 kits\n"
     "- ALT/GPT Reagent 4x50mL (I-A-000856) x 24 kits\n- Haematology Diluent 20L (I-A-000865) x 30\n\n"
     "Deliver to Central Lab receiving bay, B1, by 7 Nov. Kindly acknowledge.\n\nThanks,\nNur Aisyah\nProcurement Executive",
     "2026-10-26T09:12:00+08:00", "po"),
    ("MY", "Sunway Medical Centre", "procurement",
     "Quotation SPD-MY-26-1188 accepted – Dengue IgG/IgM Combo 30T",
     "Dear Ms Siti,\n\nWe accept quotation SPD-MY-26-1188 for 243 kits of Dengue IgG/IgM Combo 30T (S$48,600). "
     "Our PO will follow as soon as your team confirms the item code is in your system.\n\nPlease advise the lead time.\n\n"
     "Regards,\nProcurement Unit, Sunway Medical Centre",
     "2026-10-26T10:05:00+08:00", "pr"),
    ("MM", "Thukha Yeik Specialist Hospital", "purchasing",
     "Price request – Dengue NS1 rapid and malaria RDT",
     "Dear Sir/Madam,\n\nCould you quote your best price for Dengue NS1 Ag Rapid Test 10T and Malaria Pf/Pan Ag Rapid Test 25T, "
     "around 100 kits each? Please also state delivery time to Yangon and how long the quotation is valid.\n\n"
     "Thank you,\nU Aung Ko Ko\nPurchasing",
     "2026-10-26T10:41:00+08:00", "enquiry"),
    ("MY", "Bandar Suria Specialist Hospital", "biomed",
     "PO-679561 – analyser delivered, still waiting for commissioning",
     "Hi,\n\nThe 5-Part Haematology Analyser under PO-679561 arrived on 18 Sep but your engineer has not come for "
     "installation and commissioning. Can update the date? Our old unit is due for decommissioning end of month.\n\n"
     "Thanks,\nBiomedical Engineering Unit",
     "2026-10-26T11:30:00+08:00", "followup"),
    ("MY", "Seri Mekar Women & Children Hospital", "faizal.procurement",
     "Account opening – Seri Mekar Women & Children Hospital (new customer)",
     "Dear Lives Group,\n\nWe are a new private hospital opening in Shah Alam in December. Please register us as a new "
     "customer so we can order reagents and consumables. Attached: SSM certificate, delivery address and billing "
     "contact.\n\nCompany: Seri Mekar Women & Children Hospital Sdn Bhd\nContact: Encik Faizal, Procurement\n\nThank you.",
     "2026-10-26T14:02:00+08:00", "mdm"),
    ("TH", "Mongkhon Sukkasem Hospital", "purchasing",
     "Purchase order 6910233 – NT-proBNP cartridges and HbA1c reagent",
     "Dear Khun Somchai,\n\nPlease process our purchase order no. 6910233 dated 26/10/2026:\n"
     "1) NT-proBNP Cartridge 25T – 30 kits\n2) HbA1c Reagent Kit 200T – 12 kits\n\n"
     "Delivery to Laboratory Department, 2nd floor, Building B.\n\nBest regards,\nPurchasing Unit",
     "2026-10-26T15:20:00+08:00", "po"),
    ("SG", "Kembangan Bay College of Life Sciences", "kelvin.goh",
     "Do you also supply cryovials and PCR plates?",
     "Hi there,\n\nOur research group only buys test kits from you at the moment. Do you also carry sterile 2mL cryovials "
     "and 96-well skirted PCR plates? If so, could you share the price per pack and current stock?\n\n"
     "Cheers,\nDr Kelvin Goh",
     "2026-10-26T16:48:00+08:00", "enquiry"),
    ("VN", "Bệnh viện Quốc tế Phú Ngân", "purchasing",
     "Purchase Order PN/2026/118 – Dengue Duo and Typhoid tests",
     "Dear Lives Vietnam,\n\nPhú Ngân International Hospital sends PO PN/2026/118:\n"
     "- Dengue Duo NS1 + IgG/IgM Rapid Test 10T x 150 kits\n- Typhoid IgM/IgG Rapid Test 25T x 40 kits\n\n"
     "Dengue cases are still high in HCMC, please deliver within this week.\n\nThanks & best regards,\nMs Trần Thu Hà – Purchasing",
     "2026-10-27T08:15:00+08:00", "po"),
    ("MY", "Penang General Hospital", "stores",
     "Re: Dengue combo kits – please proceed with 107 kits",
     "Hi,\n\nFollowing our call, please proceed with 107 kits of Dengue IgG/IgM Combo 30T as quoted (S$21,400). "
     "Our official LPO will be issued once the budget code is confirmed next week. Kindly reserve the stock.\n\n"
     "Regards,\nPharmacy & Stores",
     "2026-10-27T08:52:00+08:00", "pr"),
    ("VN", "Bệnh viện Quốc tế Sông Sen", "lab",
     "Re: PO-680714 – short expiry on Dengue NS1 kits",
     "Dear team,\n\nFor PO-680714 delivered on 2 Oct, the Dengue NS1 Ag Rapid Test 10T lot has only 4 months of shelf "
     "life left. Our policy requires at least 6 months. Can you exchange the lot?\n\nThank you.",
     "2026-10-27T09:26:00+08:00", "followup"),
    ("TH", "Sri Chaloem Hospital", "lab.head",
     "Confirm to purchase – Real-Time PCR System (quote QTS-TH-26-0412)",
     "Dear Khun Ploy,\n\nThe committee agreed to buy 1 unit of the Real-Time PCR System 96-Well per your quotation "
     "QTS-TH-26-0412, under the FY2027 budget. Procurement Division will issue the PO within 2 weeks. Please hold the price.\n\n"
     "Best regards,\nDr Wichai, Head of Laboratory",
     "2026-10-27T10:10:00+08:00", "pr"),
    ("MY", "Klinik Bukit Orkid", "rohani",
     "Ada stok RSV rapid test?",
     "Salam,\n\nAda stok RSV Ag Rapid Test 20T? Klinik kami nampak banyak kes RSV kanak-kanak bulan ini. "
     "What is the price per kit and how fast can you deliver to Seremban?\n\nTerima kasih,\nPuan Rohani",
     "2026-10-27T10:44:00+08:00", "enquiry"),
    ("TH", "Mongkhon Sukkasem Hospital", "finance",
     "Invoice INV-QTG-TH-26-03317 – quantity does not match delivery",
     "Dear Accounts,\n\nInvoice INV-QTG-TH-26-03317 charges 40 boxes of Nitrile Examination Gloves L but we received "
     "30 boxes only (GRN attached). Please issue a credit note for the 10 boxes.\n\nRegards,\nFinance Section",
     "2026-10-27T11:35:00+08:00", "followup"),
    ("TH", "Lives Group", "somchai.p",
     "Please create item: Hepatitis E IgM Rapid Test 20T (SPD)",
     "Hi MDM team,\n\nTwo hospitals in Bangkok want Hepatitis E IgM Rapid Test 20T, which is not in SAP yet. Please create "
     "the item under Product A, category IVD reagent. QA/RA will send the Thai FDA licence number. A customer PR is "
     "waiting on this code.\n\nThanks,\nSomchai (Sales, SPD Thailand)",
     "2026-10-27T13:05:00+08:00", "mdm"),
    ("SG", "Choa Chu Kang Park General Hospital", "procurement",
     "Approved PO 7700-41893 – CO2 incubators",
     "Hello QTS team,\n\nOur PO 7700-41893 for 2 units CO2 Incubator 170L (your quote QTS-SG-26-0877) has been approved "
     "by Finance. Please schedule delivery and installation with Mr Lim (Lab Operations) for the week of 16 Nov.\n\n"
     "Regards,\nProcurement Department",
     "2026-10-27T14:18:00+08:00", "po"),
    ("VN", "Bệnh viện Đa khoa Ngọc Thành", "materials",
     "Agree with quotation QTG-VN-26-233 – blood collection tubes",
     "Dear Lives team,\n\nNgọc Thành General Hospital agrees with quotation QTG-VN-26-233: Blood Collection Tube EDTA K2 "
     "4mL 100s x 400 boxes and SST 5mL 100s x 250 boxes. This is our first consumables order with QTG; the contract and "
     "PO will follow after the director signs.\n\nThank you,\nNguyễn Văn Bình, Materials Department",
     "2026-10-27T15:02:00+08:00", "pr"),
    ("TH", "Mali Medical Laboratory Co., Ltd.", "info",
     "Brochure and reagent menu – chemiluminescence analyser",
     "Hello,\n\nWe are planning the FY2027 equipment budget. Could you send the brochure, throughput and reagent menu for "
     "your chemiluminescence immunoassay analyser, with an indicative price? Is reagent rental possible?\n\n"
     "Regards,\nMali Medical Laboratory Co., Ltd.",
     "2026-10-27T15:40:00+08:00", "enquiry"),
    ("MM", "Phyo Soe Hospital", "accounts",
     "Payment advice for PO-679389",
     "Dear Sir,\n\nWe transferred payment for PO-679389 (3-Part Haematology Analyser) on 24 Oct. Remittance slip is "
     "attached; please send the official receipt.\n\nRegards,\nAccounts Department, Phyo Soe Hospital",
     "2026-10-27T16:25:00+08:00", "followup"),
    ("VN", "Bệnh viện Đa khoa Hồng Lạc", "admin",
     "Please update our tax code and billing address",
     "Dear Lives Vietnam,\n\nFrom 1 Nov our invoices must show the new tax code 0312845667 and billing address "
     "128 Nguyễn Trãi, Ward 3, District 5, HCMC. Please update our customer account and confirm.\n\n"
     "Our orders now come from two departments – please keep us as one account.\n\nThank you,\nAdministration Office",
     "2026-10-27T17:10:00+08:00", "mdm"),
    ("MM", "Sabe Mo Township Hospital", "store",
     "PO 26-0412 – urine strips and lyse reagent",
     "Dear Sir,\n\nKindly arrange supply against our PO 26-0412:\n- Urine Reagent Strips 10-Parameter 100s – 50 nos\n"
     "- Haematology 5-Part Diff Lyse Reagent 1L – 10 nos\n\nPayment by TT on delivery as agreed.\n\n"
     "Regards,\nDaw Khin Myo, Store In-charge",
     "2026-10-28T07:48:00+08:00", "po"),
    ("SG", "Tanjong Rhu Crest Medical Centre", "lab.director",
     "OK to go ahead – hs-Troponin I cartridges",
     "Hi Amy,\n\nOK to go ahead with 60 boxes of hs-Troponin I Cartridge 25T at the price in your email yesterday. "
     "Our buyer will send the PO number tomorrow. Can you block the stock for us?\n\nThanks,\nDr Melissa Tan, Lab Director",
     "2026-10-28T08:03:00+08:00", "pr"),
    ("VN", "Bệnh viện Thuận Phong", "procurement",
     "2027 consumables tender – price request",
     "Dear Lives Vietnam,\n\nThuận Phong Hospital is preparing its 2027 consumables tender. Please provide unit prices for "
     "Nitrile Examination Gloves M 100s, Disposable Lab Coat 50s and Sharps Container 5L 20s. Estimated annual use is "
     "about 3,000 boxes of gloves. Quotation deadline: 10 Nov.\n\nBest regards,\nMs Lê Thị Mai, Procurement",
     "2026-10-28T08:12:00+08:00", "enquiry"),
    ("SG", "Jalan Kayu Vale General Hospital", "labstore",
     "PO-679179 partial delivery – diluent still outstanding",
     "Hi,\n\nWe received the glucose and ALT reagents under PO-679179, but the Haematology Diluent 20L is still "
     "outstanding. When will the balance arrive? Our analysers are running low.\n\nThanks,\nLab Store",
     "2026-10-28T08:20:00+08:00", "followup"),
    ("SG", "Lives Group", "jason.lee",
     "Extend Tanjong Rhu Crest to QTG – please don't create a new record",
     "Hi Priya,\n\nTanjong Rhu Crest Medical Centre already buys SPD reagents and now wants QTG consumables (gloves, "
     "blood collection tubes). Please extend the existing customer C-SG-00033 to QTG instead of creating a new record – "
     "I noticed there is also a 'Tanjong Rhu Crest Med Ctr' in SAP.\n\nThanks,\nJason Lee, Key Account Manager",
     "2026-10-28T08:31:00+08:00", "mdm"),
    ("MY", "Hospital Ulu Cemerlang", "purchasing",
     "LPO PO-2026-10-4471 – rapid test kits",
     "Assalamualaikum and good morning,\n\nPlease find our LPO PO-2026-10-4471 for:\n- COVID-19/Influenza A/B Combo Ag "
     "Test 20T x 120 kits\n- Mycoplasma pneumoniae IgM Rapid Test 20T x 30 kits\n\nDelivery to Makmal Patologi, Level 3. "
     "Please send the DO with batch numbers.\n\nTerima kasih,\nUnit Perolehan",
     "2026-10-28T08:40:00+08:00", "po"),
]


def build_inbox() -> dict:
    msgs = []
    for i, (country, company, local, subject, body, received, label) in enumerate(sorted(INBOX, key=lambda m: m[5])):
        sender = f"{local}@livesgroup.example" if company == "Lives Group" else _addr(local, company)
        msgs.append({
            "id": f"MSG-{2001 + i}", "from": sender, "company": company, "country": country,
            "subject": subject, "body": body, "receivedAt": received, "humanLabel": label,
        })
    return {
        "isMock": False,
        "note": ("Fictional sample messages written for this screen, not taken from the blind triage test set. "
                 "humanLabel is our hand label for comparison; the app sorts each message live with transparent rules."),
        "messages": msgs,
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scenario", default="base")
    ap.add_argument("--out-dir", default=str(SRC_DATA))
    a = ap.parse_args(argv)
    out = Path(a.out_dir)
    s = build_streams(a.scenario)
    write_json(s, out / "streams.json")
    ib = build_inbox()
    write_json(ib, out / "inbox.json")
    for c in s["countries"]:
        print(f"{c['country']}: PO S${c['poSgd12m']:,} · PR S${c['prSgd12m']:,} (open S${c['prPipelineOpenSgd']:,}, "
              f"{c['prOpenCount']}) · enquiries {c['enquiries12m']:,} ({c['enquiryYoy']:+.1%}) · "
              f"PR→PO {c['prToPoConversion']:.0%} · MDM {c['mdmRequests12m']}")
    kinds = pd.Series([m["humanLabel"] for m in ib["messages"]]).value_counts().to_dict()
    print(f"inbox.json: {len(ib['messages'])} messages {kinds}")


if __name__ == "__main__":
    main()
