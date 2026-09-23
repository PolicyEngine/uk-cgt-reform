"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Everything runs on the standard policyengine.py stack: per-year datasets
from ``pe.uk.ensure_datasets``, one ``policyengine.Simulation`` per
(dataset, scenario, year), with distributional outputs grouped by weighted
income quantile, household type and region. The pipeline asserts that the
behavioural CGT elasticity actually fires (the static e=0 and central
e=-0.7 reform runs must differ materially) before writing any results.

The same reform runs on every registered dataset (``simulations.DATASETS``:
the incumbent Enhanced FRS 2024-25 and the staged Microcosm UK v20
candidate) on the same engine and the same projection, and the per-dataset
results are written side by side. Simulations run directly on each file
as published, with no local reweighting and no edited inputs: calibration
and imputation belong upstream in the dataset producer, not in an analysis
repo. What differs between the datasets is disclosed in the validation
block (taxpayer counts, gains totals, the schedule components and the
entrants by uprating) rather than adjusted away.
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .comparison import SENSITIVITY_CASES, comparison_rows, dataset_comparison
from .impacts import (
    budget_impact,
    cgt_revenue,
    fiscal_year_label,
    income_change_groups,
    sensitivity,
    validation_stats,
)
from .reform import (
    BURNHAM_RATES,
    ELASTICITY,
    ELASTICITY_PARAMETER,
    PERIOD,
    YEARS,
    burnham_reform,
    reform_fingerprint,
    reform_schedules,
)
from .simulations import (
    DATASETS,
    DEFAULT_DATASET_KEY,
    DatasetSpec,
    ensure_uk_datasets,
    make_policy,
    run_simulation,
)
from .uprating_audit import baseline_by_year, engine_audit, projection_fingerprint, write_audit

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
# The dashboard's primary file: the default dataset's results.
OUTPUT_PATH = DATA_DIR / "cgt_equalisation_results.json"
COMPARISON_PATH = DATA_DIR / "dataset_comparison.json"
AUDIT_PATH = DATA_DIR / "cgt_uprating_audit.json"
DATASET_FOLDER = DATA_DIR / "policyengine_datasets"


def results_path(spec: DatasetSpec, data_dir: Path = DATA_DIR) -> Path:
    return data_dir / f"cgt_equalisation_results_{spec.key}.json"


def shared_base_year(specs: list[DatasetSpec]) -> int:
    years = {spec.base_year for spec in specs}
    if len(years) != 1:
        raise ValueError(f"Datasets have different base years: {sorted(years)}")
    return years.pop()


def exempt_amounts(years: list[int]) -> dict[int, float]:
    """The engine's annual exempt amount in each year (£3,000 throughout)."""
    from policyengine_uk.system import system

    parameter = system.parameters.gov.hmrc.cgt.annual_exempt_amount
    return {year: float(parameter(str(year))) for year in years}


def entrant_ceilings(audit: dict, base_exempt_amount: float, years: list[int]) -> dict[int, float]:
    """Base-year exempt amount carried forward by the gains uprating: the
    highest pre-response gain a base-year non-taxpayer can reach."""
    by_year = audit["variables"].get("capital_gains_before_response", {}).get("by_year", {})
    return {
        year: base_exempt_amount * by_year.get(str(year), {}).get("cumulative_factor", 1.0)
        for year in years
    }


def _carried_baselines(path: Path, fingerprint: str) -> dict | None:
    """The previous audit's populated baseline block, if the file at
    ``path`` exists and was written under ``fingerprint``."""
    if not path.exists():
        return None
    try:
        previous = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    if previous.get("projection_fingerprint") != fingerprint:
        return None
    if not previous.get("baseline_by_year"):
        return None
    return {k: previous[k] for k in ("baseline_by_year", "entrant_ceiling_gbp") if k in previous}


def write_uprating_audit(
    baselines: dict[str, dict] | None = None,
    path: Path = AUDIT_PATH,
    *,
    aea: dict[int, float] | None = None,
    ceilings: dict[int, float] | None = None,
) -> dict:
    """Write the uprating audit (issue #2, item 1). With ``baselines``
    (``{dataset_key: {year: baseline simulation}}``) the per-year baseline
    block is filled per dataset; without them it is left empty and says so."""
    specs = list(DATASETS.values())
    audit = engine_audit(shared_base_year(specs), YEARS)
    audit["projection_fingerprint"] = projection_fingerprint(audit)
    audit["datasets"] = {spec.key: spec.to_metadata() for spec in specs}
    if ceilings:
        audit["entrant_ceiling_gbp"] = {str(year): value for year, value in ceilings.items()}
    if baselines:
        audit["baseline_by_year"] = {
            key: baseline_by_year(sims, aea, ceilings) for key, sims in baselines.items()
        }
    elif _carried_baselines(path, audit["projection_fingerprint"]):
        carried = _carried_baselines(path, audit["projection_fingerprint"])
        audit["baseline_by_year"] = carried["baseline_by_year"]
        if "entrant_ceiling_gbp" in carried and not ceilings:
            audit["entrant_ceiling_gbp"] = carried["entrant_ceiling_gbp"]
        audit["baseline_by_year_note"] = (
            "Carried forward from the previous audit at this path, which was "
            "produced under the same projection fingerprint; an audit-only "
            "rewrite refreshes the factor table without discarding measured "
            "baselines."
        )
    else:
        audit["baseline_by_year"] = {}
        audit["baseline_by_year_note"] = (
            "Not populated: written with --audit-only, no simulations run. "
            "A full pipeline run fills this block per dataset from the baseline simulations."
        )
    write_audit(audit, path)
    print(f"    wrote {path} (projection {audit['projection_fingerprint']})")
    return audit


def run_dataset(
    spec: DatasetSpec,
    audit: dict,
    fingerprint: str,
    aea: dict[int, float],
    ceilings: dict[int, float],
) -> tuple[dict, dict]:
    """Run every scenario on one dataset. Returns the results dict and the
    baseline simulations (for the audit)."""
    tag = f"[{spec.key}]"
    # Per-year files and cached outputs live in a folder keyed by the
    # dataset digest and the projection: the wrapper reuses whatever it
    # finds there, so a dataset or engine change must land elsewhere.
    sim_stem = f"{spec.key}_{spec.digest}_{fingerprint}"
    folder = DATASET_FOLDER / sim_stem

    # ── Step 1: per-year datasets, as published upstream ─────────────────
    print(f"Step 1 {tag}: Ensuring {spec.uri} datasets for {YEARS}...")
    datasets = ensure_uk_datasets(spec, YEARS, folder)

    # ── Step 2: baseline and reformed simulations, one per year ───────────
    print(f"Step 2 {tag}: Running baseline and reformed simulations...")
    central_reform = burnham_reform(ELASTICITY)
    central_digest = reform_fingerprint(central_reform)
    reform_policy = make_policy(central_reform, "burnham_e07")
    baseline_sims, reform_sims = {}, {}
    for year in YEARS:
        print(f"    {fiscal_year_label(year)}...")
        baseline_sims[year] = run_simulation(datasets[year], sim_id=f"{sim_stem}_baseline_{year}")
        # Reform ids carry the reform's own digest: a change to the reform
        # definition (rates, schedules, elasticity parameter) must not reuse
        # a cached output.
        reform_sims[year] = run_simulation(
            datasets[year],
            policy=reform_policy,
            sim_id=f"{sim_stem}_burnham_e07_{central_digest}_{year}",
        )

    # ── Step 3: elasticity sensitivity (2026), which doubles as the check
    # that the behavioural response fires through policyengine.py ─────────
    print(f"Step 3 {tag}: Elasticity sensitivity (2026)...")
    base_cgt_2026 = cgt_revenue(baseline_sims[2026])

    def run_case(e: float):
        if e == ELASTICITY:
            return reform_sims[2026]
        case = f"burnham_e{abs(e):.2f}".replace(".", "")
        reform = burnham_reform(e)
        return run_simulation(
            datasets[2026],
            policy=make_policy(reform, case),
            sim_id=f"{sim_stem}_{case}_{reform_fingerprint(reform)}_2026",
        )

    sens = sensitivity(base_cgt_2026, SENSITIVITY_CASES, run_case)
    for row in sens:
        print(f"    {row['name']} (e={row['e_mtr']}): {row['revenue_2026_bn']:+.1f}bn")
    static_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == 0.0)
    central_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == ELASTICITY)
    assert static_2026 - central_2026 > 1.0, (
        f"Behavioural CGT elasticity did not fire through policyengine.py on {spec.key}: "
        f"static (e=0) yield {static_2026:.2f}bn vs central (e={ELASTICITY}) "
        f"{central_2026:.2f}bn. Refusing to write results."
    )

    # ── Step 4: baseline validation (native microdf, published weights) ──
    print(f"Step 4 {tag}: Validating the published baseline against HMRC/Advani...")
    validation = validation_stats(baseline_sims[2026], aea[2026], ceilings[2026])
    entrants = validation["entrants_by_uprating"]
    print(
        f"    {validation['cgt_taxpayers'] / 1e6:,.2f}m CGT taxpayers "
        f"({entrants['count'] / 1e6:,.2f}m entrants by uprating), "
        f"£{validation['total_gains_bn']:.1f}bn gains, baseline CGT revenue "
        f"£{validation['baseline_cgt_revenue_bn']:.1f}bn"
    )

    # ── Step 5: budgetary impact ──────────────────────────────────────────
    print(f"Step 5 {tag}: Budgetary impact 2026-27 to 2030-31...")
    budget = budget_impact(baseline_sims, reform_sims, YEARS, aea, ceilings)
    for row in budget:
        print(
            f"    {row['year']}: gov balance {row['gov_balance_change_bn']:+.2f}bn "
            f"(entrants {row['cgt_change_from_entrants_bn']:+.2f}bn)"
        )
    five_year_total = sum(r["gov_balance_change_bn"] for r in budget)
    print(f"    Five-year total budgetary impact: £{five_year_total:.1f}bn")

    # ── Step 6: distributional impacts (income quantiles, household type,
    # region), all years ──────────────────────────────────────────────────
    print(f"Step 6 {tag}: Distributional impacts...")
    groups = {
        fiscal_year_label(y): income_change_groups(baseline_sims[y], reform_sims[y]) for y in YEARS
    }

    # ── Step 7: comparison with other institutions ────────────────────────
    comparison = comparison_rows(
        revenue_2026_bn=budget[0]["gov_balance_change_bn"],
        five_year_avg_bn=five_year_total / len(YEARS),
        static_2026_bn=static_2026,
    )

    output = {
        "metadata": {
            "generated": datetime.date.today().isoformat(),
            "policyengine_version": importlib.metadata.version("policyengine"),
            "policyengine_uk_version": importlib.metadata.version("policyengine-uk"),
            "dataset": spec.uri,
            "dataset_key": spec.key,
            "dataset_label": spec.label,
            "dataset_short_label": spec.short_label,
            "dataset_role": spec.role,
            "dataset_sha256": spec.sha256,
            "dataset_producer": spec.producer,
            "dataset_observation": spec.observation,
            "dataset_notes": spec.notes,
            "datasets": [s.to_metadata() for s in DATASETS.values()],
            "default_dataset_key": DEFAULT_DATASET_KEY,
            "calibrated": False,
            "reform_period_start": PERIOD,
            "elasticity": ELASTICITY,
            "elasticity_parameter": ELASTICITY_PARAMETER,
            "reform": dict(BURNHAM_RATES),
            "reform_schedules": reform_schedules(),
            "reform_fingerprint": central_digest,
            "years": list(YEARS),
            "exempt_amount_gbp": {fiscal_year_label(y): aea[y] for y in YEARS},
            "entrant_ceiling_gbp": {fiscal_year_label(y): ceilings[y] for y in YEARS},
            "projection": {
                "fingerprint": fingerprint,
                "base_year": spec.base_year,
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
            "note": (
                "No local reweighting; calibration is upstream in the dataset producer "
                f"({spec.producer})."
            ),
        },
        "validation": validation,
        "budget": budget,
        "income_change_groups": groups,
        "sensitivity": sens,
        "comparison": comparison,
    }
    return output, baseline_sims


def run(output_dir: Path = DATA_DIR, dataset_keys: list[str] | None = None) -> dict[str, dict]:
    """Run the pipeline end-to-end on the selected datasets (default: all)
    and write the per-dataset results, the side-by-side comparison and the
    uprating audit."""
    keys = list(dataset_keys or DATASETS)
    unknown = [key for key in keys if key not in DATASETS]
    if unknown:
        raise ValueError(f"Unknown dataset keys {unknown}; known: {sorted(DATASETS)}")
    specs = [DATASETS[key] for key in keys]
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 0: the projection the engine will apply, before anything runs
    print("Step 0: Auditing the engine's uprating of gains and weights...")
    base_year = shared_base_year(specs)
    audit = engine_audit(base_year, YEARS)
    fingerprint = projection_fingerprint(audit)
    aea = exempt_amounts(sorted({base_year, *YEARS}))
    ceilings = entrant_ceilings(audit, aea[base_year], YEARS)
    print(f"    projection {fingerprint}; entrant ceilings {ceilings}")

    results: dict[str, dict] = {}
    baselines: dict[str, dict] = {}
    for spec in specs:
        results[spec.key], baselines[spec.key] = run_dataset(
            spec, audit, fingerprint, aea, ceilings
        )
        path = results_path(spec, output_dir)
        path.write_text(json.dumps(results[spec.key], indent=2))
        print(f"    wrote {path}")

    # ── Step 8: the uprating audit with the per-year baselines filled in ──
    print("Step 8: Writing the uprating audit...")
    write_uprating_audit(baselines, aea=aea, ceilings=ceilings)

    # ── Step 9: the dashboard's primary file and the side-by-side ─────────
    print("Step 9: Writing the dashboard results and the dataset comparison...")
    if DEFAULT_DATASET_KEY in results:
        primary = output_dir / OUTPUT_PATH.name
        primary.write_text(json.dumps(results[DEFAULT_DATASET_KEY], indent=2))
        print(f"    wrote {primary} ({DEFAULT_DATASET_KEY})")
    else:
        print(f"    default dataset {DEFAULT_DATASET_KEY} not run; primary results file untouched")
    if set(results) == set(DATASETS):
        comparison_path = output_dir / COMPARISON_PATH.name
        comparison_path.write_text(json.dumps(dataset_comparison(results), indent=2))
        print(f"    wrote {comparison_path}")
    else:
        print("    not every registered dataset ran; comparison file untouched")
    print("Done.")
    return results
