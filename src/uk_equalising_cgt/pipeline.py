"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Everything runs on the standard policyengine.py stack: per-year certified
datasets from ``pe.uk.ensure_datasets``, one ``policyengine.Simulation``
per (scenario, year), with distributional outputs grouped by weighted
income quantile, household type and region. The pipeline asserts that the behavioural CGT elasticity actually
fires (the static e=0 and central e=-0.7 reform runs must differ
materially) before writing any results.

Simulations run directly on the Enhanced FRS dataset as published by
policyengine-uk-data, with no local reweighting: all calibration and
weighting belongs upstream in policyengine-uk-data, not in an analysis
repo. The published dataset calibrates to HMRC's CGT aggregates and
size-of-gain distribution; the modelled taxpayer count still runs above
HMRC's, so breadth reads as a modest upper bound (see the dashboard
methodology and benchmarks tabs).
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .comparison import SENSITIVITY_CASES, comparison_rows
from .impacts import (
    budget_impact,
    cgt_revenue,
    fiscal_year_label,
    income_change_groups,
    sensitivity,
    validation_stats,
)
from .reform import BURNHAM_RATES, ELASTICITY, PERIOD, YEARS, burnham_reform
from .simulations import BASE_YEAR, DATASET, ensure_uk_datasets, make_policy, run_simulation
from .uprating_audit import baseline_by_year, engine_audit, projection_fingerprint, write_audit

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = REPO_ROOT / "data" / "cgt_equalisation_results.json"
AUDIT_PATH = REPO_ROOT / "data" / "cgt_uprating_audit.json"
DATASET_FOLDER = REPO_ROOT / "data" / "policyengine_datasets"

# Simulation ids double as output-cache filenames (`<id>.h5` beside the
# per-year dataset files), so they must be keyed by dataset vintage AND by
# the projection actually applied — otherwise a dataset upgrade, or a
# change in the engine's uprating, silently reuses stale cached outputs.
DATASET_STEM = Path(DATASET.rsplit("@", 1)[0]).stem


def write_uprating_audit(baseline_sims: dict | None = None, path: Path = AUDIT_PATH) -> dict:
    """Write the uprating audit (issue #2, item 1). With ``baseline_sims``
    the per-year baseline block is filled from the simulations; without
    them it is left empty and says so."""
    audit = engine_audit(BASE_YEAR, YEARS)
    audit["projection_fingerprint"] = projection_fingerprint(audit)
    if baseline_sims:
        audit["baseline_by_year"] = baseline_by_year(baseline_sims)
    else:
        audit["baseline_by_year"] = {}
        audit["baseline_by_year_note"] = (
            "Not populated: written with --audit-only, no simulations run. "
            "A full pipeline run fills this block from the baseline simulations."
        )
    write_audit(audit, path)
    print(f"    wrote {path} (projection {audit['projection_fingerprint']})")
    return audit


def run(output_path: Path = OUTPUT_PATH) -> dict:
    """Run the pipeline end-to-end and write the results JSON."""
    # ── Step 0: the projection the engine will apply, before anything runs
    print("Step 0: Auditing the engine's uprating of gains and weights...")
    audit = engine_audit(BASE_YEAR, YEARS)
    fingerprint = projection_fingerprint(audit)
    sim_stem = f"{DATASET_STEM}_{fingerprint}"

    # ── Step 1: certified per-year datasets, as published upstream ───────
    print(f"Step 1: Ensuring {DATASET} datasets for {YEARS}...")
    datasets = ensure_uk_datasets(YEARS, DATASET_FOLDER)

    # ── Step 2: baseline and reformed simulations, one per year ───────────
    print("Step 2: Running baseline and reformed simulations...")
    reform_policy = make_policy(burnham_reform(ELASTICITY), "burnham_e07")
    baseline_sims, reform_sims = {}, {}
    for year in YEARS:
        print(f"    {fiscal_year_label(year)}...")
        baseline_sims[year] = run_simulation(datasets[year], sim_id=f"{sim_stem}_baseline_{year}")
        reform_sims[year] = run_simulation(
            datasets[year], policy=reform_policy, sim_id=f"{sim_stem}_burnham_e07_{year}"
        )

    # ── Step 3: elasticity sensitivity (2026), which doubles as the check
    # that the behavioural response fires through policyengine.py ─────────
    print("Step 3: Elasticity sensitivity (2026)...")
    base_cgt_2026 = cgt_revenue(baseline_sims[2026])

    def run_case(e: float):
        if e == ELASTICITY:
            return reform_sims[2026]
        tag = f"burnham_e{abs(e):.2f}".replace(".", "")
        return run_simulation(
            datasets[2026],
            policy=make_policy(burnham_reform(e), tag),
            sim_id=f"{sim_stem}_{tag}_2026",
        )

    sens = sensitivity(base_cgt_2026, SENSITIVITY_CASES, run_case)
    for row in sens:
        print(f"    {row['name']} (e={row['e_mtr']}): {row['revenue_2026_bn']:+.1f}bn")
    static_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == 0.0)
    central_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == ELASTICITY)
    assert static_2026 - central_2026 > 1.0, (
        "Behavioural CGT elasticity did not fire through policyengine.py: "
        f"static (e=0) yield {static_2026:.2f}bn vs central (e={ELASTICITY}) "
        f"{central_2026:.2f}bn. Refusing to write results."
    )

    # ── Step 4: baseline validation (native microdf, published weights) ──
    print("Step 4: Validating the published baseline against HMRC/Advani...")
    validation = validation_stats(baseline_sims[2026])
    print(
        f"    {validation['cgt_taxpayers'] / 1e6:,.2f}m CGT taxpayers, "
        f"£{validation['total_gains_bn']:.1f}bn gains, baseline CGT revenue "
        f"£{validation['baseline_cgt_revenue_bn']:.1f}bn"
    )

    # ── Step 5: budgetary impact ──────────────────────────────────────────
    print("Step 5: Budgetary impact 2026-27 to 2030-31...")
    budget = budget_impact(baseline_sims, reform_sims, YEARS)
    for row in budget:
        print(f"    {row['year']}: gov balance {row['gov_balance_change_bn']:+.2f}bn")
    five_year_total = sum(r["gov_balance_change_bn"] for r in budget)
    print(f"    Five-year total budgetary impact: £{five_year_total:.1f}bn")

    # ── Step 6: distributional impacts (income quantiles, household type,
    # region), all years ──────────────────────────────────────────────────
    print("Step 6: Distributional impacts...")
    groups = {
        fiscal_year_label(y): income_change_groups(baseline_sims[y], reform_sims[y]) for y in YEARS
    }

    # ── Step 7: comparison with other institutions ────────────────────────
    comparison = comparison_rows(
        revenue_2026_bn=budget[0]["gov_balance_change_bn"],
        five_year_avg_bn=five_year_total / len(YEARS),
        static_2026_bn=static_2026,
    )

    # ── Step 8: the uprating audit with the per-year baseline filled in ──
    print("Step 8: Writing the uprating audit...")
    audit = write_uprating_audit(baseline_sims)

    # ── Step 9: write the results JSON ────────────────────────────────────
    print("Step 9: Writing results JSON...")
    output = {
        "metadata": {
            "generated": datetime.date.today().isoformat(),
            "policyengine_version": importlib.metadata.version("policyengine"),
            "policyengine_uk_version": importlib.metadata.version("policyengine-uk"),
            "dataset": DATASET,
            "calibrated": False,
            "reform_period_start": PERIOD,
            "elasticity": ELASTICITY,
            "reform": dict(BURNHAM_RATES),
            "years": list(YEARS),
            "projection": {
                "fingerprint": fingerprint,
                "base_year": BASE_YEAR,
                "indices": {
                    variable: row.get("index") for variable, row in audit["variables"].items()
                },
                "cumulative_factors": {
                    variable: {
                        year: row["cumulative_factor"]
                        for year, row in entry.get("by_year", {}).items()
                    }
                    for variable, entry in audit["variables"].items()
                },
                "audit": str(AUDIT_PATH.relative_to(REPO_ROOT)),
            },
        },
        "calibration": {
            "targets": [],
            "ess_before": None,
            "ess_after": None,
            "note": ("No local reweighting; calibration is upstream in policyengine-uk-data."),
        },
        "validation": validation,
        "budget": budget,
        "income_change_groups": groups,
        "sensitivity": sens,
        "comparison": comparison,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2))
    print(f"    wrote {output_path}")
    print("Done.")
    return output
