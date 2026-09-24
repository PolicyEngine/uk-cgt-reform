"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Everything runs on the standard policyengine.py stack: per-year datasets
from ``pe.uk.ensure_datasets``, one ``policyengine.Simulation`` per
(dataset, scenario, year), with distributional outputs grouped by weighted
income quantile, household type and region. The pipeline asserts that the
behavioural CGT elasticity actually fires (the static e=0 and central
e=-0.7 reform runs must differ materially) before writing any results.

The same reform runs on every registered dataset (``simulations.DATASETS``:
the incumbent Enhanced FRS 2024-25 and the staged Microcosm UK national-line
candidate built on microcosm#979) on the same engine and the same projection, and the per-dataset
results are written side by side. Simulations run directly on each file
as published, with no local reweighting and no edited inputs: calibration
and imputation belong upstream in the dataset producer, not in an analysis
repo. What differs between the datasets is disclosed in the validation
block (taxpayer counts, gains totals, the schedule components and the
entrants by uprating) rather than adjusted away.

Each dataset's results also carry a ``benchmarks`` block (issue #7): the
static reform by year beside JRF's estimate, a static re-score at CenTax's
2019/20 rules beside its Tables 3 and 8, and HMRC's ready-reckoner rows
scored at the central and the official elasticity (``comparison.py``).
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .comparison import (
    READY_RECKONER,
    READY_RECKONER_ELASTICITIES,
    SENSITIVITY_CASES,
    benchmarks_block,
    centax_1920_block,
    dataset_comparison,
    price_factors,
    ready_reckoner_block,
    static_equalisation_block,
)
from .impacts import (
    budget_impact,
    cgt_revenue,
    cgt_uplift,
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
    centax_1920_reforms,
    centax_1920_rules,
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


def simulation_stem(spec: DatasetSpec, fingerprint: str) -> str:
    """The id prefix one dataset's per-year files and cached simulations
    share: dataset key, source digest and projection fingerprint, so a
    re-pinned file or a moved projection cannot reuse what an earlier run
    materialised (program review C1)."""
    return f"{spec.key}_{spec.digest}_{fingerprint}"


def dataset_folder(spec: DatasetSpec, fingerprint: str, root: Path = DATASET_FOLDER) -> Path:
    """Where ``pe.uk.ensure_datasets`` materialises and reuses one dataset's
    per-year files. The wrapper reuses any ``<stem>_year_<year>.h5`` it finds
    in the folder it is given, so the folder carries the same key. The rate
    explorer (locally and on Modal) resolves the same folder, so both share
    the baselines."""
    return root / simulation_stem(spec, fingerprint)


def burnham_case(elasticity: float) -> str:
    """The case name in a Burnham simulation id: ``burnham_e07`` for the
    central case (the name the cached outputs carry), otherwise the
    elasticity's magnitude to two decimals without the point."""
    if elasticity == ELASTICITY:
        return "burnham_e07"
    return f"burnham_e{abs(elasticity):.2f}".replace(".", "")


def burnham_sim_id(sim_stem: str, elasticity: float, digest: str, year: int) -> str:
    """A Burnham simulation id: the dataset stem, the case, the reform's own
    fingerprint (which tells cases of equal magnitude apart) and the year."""
    return f"{sim_stem}_{burnham_case(elasticity)}_{digest}_{year}"


def counterfactual_sim_id(sim_stem: str, role: str, digest: str, year: int) -> str:
    """A simulation id for one side (``baseline`` or ``reform``) of the
    CenTax 2019/20-rules counterfactual."""
    return f"{sim_stem}_centax1920_{role}_{digest}_{year}"


def score_ready_reckoner(spec: DatasetSpec, folder: Path, fingerprint: str) -> dict:
    """Score HMRC's ready-reckoner rows on one dataset through the rate
    explorer's code path (the explorer's scope, the cached baselines, the
    reform in memory), at each elasticity in ``READY_RECKONER_ELASTICITIES``
    and in each model year the lag names. Returns ``{row id: {elasticity id:
    {model year: change in government balance, £m}}}``."""
    from .explore import engine_context, run_year, validate_request

    context = engine_context()
    if context["projection_fingerprint"] != fingerprint:
        raise RuntimeError(
            f"Explorer projection {context['projection_fingerprint']} differs from the "
            f"pipeline's {fingerprint}; refusing to mix them."
        )
    scores = {}
    for row in READY_RECKONER["rows"]:
        scores[row["id"]] = {}
        for elasticity_id, elasticity in READY_RECKONER_ELASTICITIES.items():
            request = validate_request(
                {"dataset": spec.key, "rates": row["rates"], "elasticity": elasticity}
            )
            scores[row["id"]][elasticity_id] = {}
            for lag in READY_RECKONER["lag"]:
                year = int(lag["model_year"][:4])
                budget = run_year(request, year, folder, context)["budget"]
                scores[row["id"]][elasticity_id][lag["model_year"]] = (
                    1000 * budget["gov_balance_change_bn"]
                )
    return scores


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
    sim_stem = simulation_stem(spec, fingerprint)
    folder = dataset_folder(spec, fingerprint)

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
            sim_id=burnham_sim_id(sim_stem, ELASTICITY, central_digest, year),
        )

    # ── Step 2b: the static reform in every year, for the static benchmarks
    # (the 2026 run is also the sensitivity table's static case) ──────────
    print(f"Step 2b {tag}: Static reform (e=0), every year...")
    static_reform = burnham_reform(0.0)
    static_digest = reform_fingerprint(static_reform)
    static_policy = make_policy(static_reform, burnham_case(0.0))
    static_sims = {
        year: run_simulation(
            datasets[year],
            policy=static_policy,
            sim_id=burnham_sim_id(sim_stem, 0.0, static_digest, year),
        )
        for year in YEARS
    }

    # ── Step 3: elasticity sensitivity (2026), which doubles as the check
    # that the behavioural response fires through policyengine.py ─────────
    print(f"Step 3 {tag}: Elasticity sensitivity (2026)...")
    base_cgt_2026 = cgt_revenue(baseline_sims[2026])

    def run_case(e: float):
        if e == ELASTICITY:
            return reform_sims[2026]
        if e == 0.0:
            return static_sims[2026]
        reform = burnham_reform(e)
        return run_simulation(
            datasets[2026],
            policy=make_policy(reform, burnham_case(e)),
            sim_id=burnham_sim_id(sim_stem, e, reform_fingerprint(reform), 2026),
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

    # ── Step 3b: CenTax's rates-only reform at its 2019/20 rules, static ──
    print(f"Step 3b {tag}: Equalisation at CenTax's 2019/20 rules (2026, static)...")
    cf_sims, cf_digests = {}, {}
    for role, reform in zip(("baseline", "reform"), centax_1920_reforms(), strict=True):
        cf_digests[role] = reform_fingerprint(reform)
        cf_sims[role] = run_simulation(
            datasets[2026],
            policy=make_policy(reform, f"centax1920_{role}"),
            sim_id=counterfactual_sim_id(sim_stem, role, cf_digests[role], 2026),
        )
    uplift = cgt_uplift(cf_sims["baseline"], cf_sims["reform"])
    current_law_cgt_bn = base_cgt_2026 / 1e9
    national = uplift["national"]
    assert national["baseline_cgt_bn"] < current_law_cgt_bn, (
        f"2019/20 rules raised more CGT ({national['baseline_cgt_bn']:.2f}bn) than current "
        f"law ({current_law_cgt_bn:.2f}bn) on {spec.key}; the counterfactual did not apply."
    )
    assert national["uplift_pct"] > 0, f"Equalising at 2019/20 rules raised nothing on {spec.key}."
    print(
        f"    £{national['baseline_cgt_bn']:.1f}bn -> £{national['reform_cgt_bn']:.1f}bn "
        f"({national['uplift_pct']:+.0f}%; CenTax +139%)"
    )
    centax_1920 = centax_1920_block(current_law_cgt_bn, uplift, centax_1920_rules(), cf_digests)

    # ── Step 3c: HMRC's ready-reckoner rows through the explorer's path ───
    print(f"Step 3c {tag}: Ready-reckoner rows (2026-27 and 2027-28 liabilities)...")
    ready_reckoner = ready_reckoner_block(score_ready_reckoner(spec, folder, fingerprint))
    for row in ready_reckoner["rows"]:
        print(f"    {row['label']}: {row['model_m']}")

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
    static_budget = budget_impact(baseline_sims, static_sims, YEARS, aea, ceilings)

    # ── Step 6: distributional impacts (income quantiles, household type,
    # region), all years ──────────────────────────────────────────────────
    print(f"Step 6 {tag}: Distributional impacts...")
    groups = {
        fiscal_year_label(y): income_change_groups(baseline_sims[y], reform_sims[y]) for y in YEARS
    }

    # ── Step 7: benchmarks against other institutions' estimates ─────────
    factors = price_factors(audit["sensitivity_not_applied"]["cpi"]["by_year"], YEARS[0], YEARS)
    benchmarks = benchmarks_block(
        static_equalisation=static_equalisation_block(static_budget, factors, static_digest),
        centax_2019_20_rules=centax_1920,
        ready_reckoner=ready_reckoner,
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
        "benchmarks": benchmarks,
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
    write_uprating_audit(baselines, output_dir / AUDIT_PATH.name, aea=aea, ceilings=ceilings)

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
