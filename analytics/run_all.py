"""Run the whole Tesseract analytics pipeline end to end, in dependency order.

    PYTHONIOENCODING=utf-8 python analytics/run_all.py            # everything, incl. the triage eval (needs Node)
    PYTHONIOENCODING=utf-8 python analytics/run_all.py --no-triage
    PYTHONIOENCODING=utf-8 python analytics/run_all.py --from forecast   # resume from a step

Steps (each one is a separate script, run as a subprocess so a failure stops the run with its own traceback):
  1. generate    analytics/generate.py      base (seed 42), nosignal (seed 42, no seasonality/trend),
                                            halfdengue (seed 7, dengue x0.5)  -> analytics/out/<scenario>/*.csv
  2. resolve     analytics/resolve.py       entity resolution on all 3 scenarios -> matcher_eval.json, master.json
  3. growth      analytics/growth.py        matrix.json, bridge.json, dedup.json
  4. forecast    analytics/forecast.py      backtest.json, cleanxmethod.json (+ leak test; fails the run on a leak)
  5. stress      analytics/stress.py        stress.json ("our method doesn't invent signal")
  6. signals     analytics/signals.py       signals.json
  7. streams     analytics/streams.py       streams.json, inbox.json
  8. actions     analytics/actions.py       actions.json (reads signals, streams, backtest)
  9. business    analytics/business_case.py impact.json (final model §6)
 10. summary     analytics/build_summary.py summary.json + meta.json, then the consistency checks
 11. triage      npx tsx analytics/triage/eval_triage.ts -> triage_eval.json, then summary/meta rebuilt (skip: --no-triage)
 12. contract    npx tsc --noEmit, failing only on errors in src/data (skip: --no-tsc)

Idempotent: every step overwrites its outputs from the same seeds, so two runs give identical files apart from
`generatedAt` timestamps. Typical runtime ~1-2 min.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ANALYTICS = Path(__file__).resolve().parent
REPO = ANALYTICS.parent
PY = sys.executable


def py(script: str, *args: str) -> list[str]:
    return [PY, str(ANALYTICS / script), *args]


STEPS: list[tuple[str, list[list[str]]]] = [
    ("generate", [py("generate.py", "--scenario", s) for s in ("base", "nosignal", "halfdengue")]),
    ("resolve", [py("resolve.py", "--scenario", "all")]),
    ("growth", [py("growth.py")]),
    ("forecast", [py("forecast.py")]),
    ("stress", [py("stress.py")]),
    ("signals", [py("signals.py")]),
    ("streams", [py("streams.py")]),
    ("actions", [py("actions.py")]),
    ("business", [py("business_case.py")]),
    ("summary", [py("build_summary.py")]),
]
STEP_NAMES = [s for s, _ in STEPS] + ["triage"]


def run(cmd: list[str], quiet: bool) -> None:
    env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
    t0 = time.time()
    shown = " ".join(Path(c).name if i < 2 else c for i, c in enumerate(cmd))
    print(f"  $ {shown}", flush=True)
    r = subprocess.run(cmd, cwd=REPO, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode != 0:
        print(out)
        raise SystemExit(f"FAILED ({r.returncode}): {shown}")
    if not quiet:
        for line in out.strip().splitlines():
            print(f"    {line}")
    print(f"    ok in {time.time() - t0:.1f}s", flush=True)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--no-triage", action="store_true", help="skip the Node triage eval")
    ap.add_argument("--no-tsc", action="store_true", help="skip the src/data type-check against contract.ts")
    ap.add_argument("--from", dest="start", default="generate", choices=STEP_NAMES, help="resume from this step")
    ap.add_argument("--quiet", action="store_true", help="print only step names and timings")
    a = ap.parse_args(argv)

    t0 = time.time()
    started = False
    for name, cmds in STEPS:
        started = started or name == a.start
        if not started:
            continue
        print(f"[{name}]", flush=True)
        for cmd in cmds:
            run(cmd, a.quiet)

    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not a.no_triage:
        print("[triage]", flush=True)
        if npx is None:
            print("    npx not found: triage eval skipped (triage_eval.json left as is)")
        else:
            run([npx, "tsx", "analytics/triage/eval_triage.ts"], a.quiet)
            # the summary's sentences and consistency checks read triage_eval.json too: rebuild on the fresh file
            run(py("build_summary.py", "--reuse-robustness"), True)

    if not a.no_tsc and npx is not None:
        # every src/data/*.json must still type-check against src/data/contract.ts (errors elsewhere are other lanes')
        print("[contract] npx tsc --noEmit (src/data only)", flush=True)
        t1 = time.time()
        r = subprocess.run([npx, "tsc", "--noEmit"], cwd=REPO, capture_output=True, text=True, encoding="utf-8",
                           errors="replace")
        lines = [ln for ln in (r.stdout + r.stderr).splitlines() if "src/data" in ln.replace("\\", "/")]
        others = sum(1 for ln in (r.stdout + r.stderr).splitlines() if "error TS" in ln) - len(lines)
        if lines:
            print("\n".join(lines))
            raise SystemExit("FAILED: src/data JSON no longer matches src/data/contract.ts")
        print(f"    src/data: 0 type errors ({others} elsewhere, not ours) in {time.time() - t1:.0f}s")

    print(f"Pipeline finished in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
