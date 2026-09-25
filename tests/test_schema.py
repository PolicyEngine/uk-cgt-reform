"""Schema tests: the results-JSON shape agreed with the dashboard, checked
against a fake results dict (no simulation)."""

import pytest

from uk_cgt_reform.comparison import (
    READY_RECKONER,
    READY_RECKONER_ELASTICITIES,
    SENSITIVITY_CASES,
    VALIDATION_METRICS,
    benchmarks_block,
    centax_1920_block,
    dataset_comparison,
    ready_reckoner_block,
    static_equalisation_block,
)
from uk_cgt_reform.impacts import REGION_NAMES, fiscal_year_label
from uk_cgt_reform.reform import (
    YEARS,
    centax_1920_rules,
    elasticity_convention,
    reform_schedules,
)
from uk_cgt_reform.simulations import DATASETS, DEFAULT_DATASET_KEY, INCUMBENT

YEAR_LABELS = [fiscal_year_label(y) for y in range(2026, 2031)]

TOP_LEVEL_KEYS = {
    "metadata",
    "calibration",
    "validation",
    "budget",
    "income_change_groups",
    "sensitivity",
    "benchmarks",
}


def fake_benchmarks(scale: float = 1.0) -> dict:
    """The ``benchmarks`` block, built through the real builders from fake
    model inputs so the fixture cannot drift from the pipeline."""
    labels = [fiscal_year_label(y) for y in YEARS]
    static_budget = [
        {
            "year": label,
            "baseline_cgt_bn": 17.2 * scale,
            "reform_cgt_bn": 31.2 * scale,
            "cgt_change_bn": 14.0 * scale,
            "total_tax_change_bn": 14.0 * scale,
            "gov_balance_change_bn": 14.0 * scale,
            "cgt_change_from_entrants_bn": 0.01 * scale,
        }
        for label in labels
    ]
    factors = {label: 1.02**i for i, label in enumerate(labels)}
    uplift = {
        "national": {
            "baseline_cgt_bn": 8.0 * scale,
            "reform_cgt_bn": 20.0 * scale,
            "change_bn": 12.0 * scale,
            "uplift_pct": 150.0,
        },
        "regions": [
            {
                "region": region,
                "baseline_cgt_bn": 1.0 * scale,
                "reform_cgt_bn": 2.5 * scale,
                "change_bn": 1.5 * scale,
                "uplift_pct": 150.0,
            }
            for region in REGION_NAMES.values()
        ],
        "unassigned_cgt_bn": {"baseline": 0.0, "reform": 0.0},
    }
    model_m = {
        row["id"]: {
            elasticity_id: {lag["model_year"]: -100.0 * scale for lag in READY_RECKONER["lag"]}
            for elasticity_id in READY_RECKONER_ELASTICITIES
        }
        for row in READY_RECKONER["rows"]
    }
    return benchmarks_block(
        static_equalisation=static_equalisation_block(
            static_budget, factors, "45576cc53935", "OBR EFO March 2026 (Table A.1)"
        ),
        centax_2019_20_rules=centax_1920_block(
            17.2 * scale,
            uplift,
            centax_1920_rules(),
            {"baseline": "a2eab6466ee5", "reform": "2367c58b5ba5"},
        ),
        ready_reckoner=ready_reckoner_block(model_m),
    )


def fake_results(spec=INCUMBENT, scale: float = 1.0) -> dict:
    """A results dict with the exact shape pipeline.run_dataset emits."""
    labels = [fiscal_year_label(y) for y in YEARS]
    entrants = {
        "exempt_amount_gbp": 3_000.0,
        "ceiling_gbp": 3_222.0,
        "count": 10_000.0 * scale,
        "gains_bn": 0.03 * scale,
        "cgt_bn": 0.005 * scale,
    }
    return {
        "metadata": {
            "generated": "2026-09-21",
            "policyengine_version": "4.22.3",
            "policyengine_uk_version": "2.99.1",
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
            "reform_period_start": "2026-01-01",
            "elasticity": -0.7,
            "elasticity_parameter": "gov.simulation.capital_gains_responses.mtr_elasticity",
            "reform": {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45},
            "reform_schedules": reform_schedules(),
            "reform_fingerprint": "def456",
            "years": list(YEARS),
            "exempt_amount_gbp": {label: 3_000.0 for label in labels},
            "entrant_ceiling_gbp": {label: 3_222.0 for label in labels},
            "projection": {"fingerprint": "abc123", "base_year": 2024},
        },
        # No local reweighting: calibration is upstream in the dataset producer.
        "calibration": {
            "targets": [],
            "ess_before": None,
            "ess_after": None,
            "note": f"No local reweighting; calibration is upstream in the dataset producer ({spec.producer}).",
        },
        "validation": {
            "cgt_taxpayers": 400_000.0 * scale,
            "total_gains_bn": 70.0 * scale,
            "mean_gain": 175_000.0,
            "median_gain": 30_000.0,
            "share_gains_over_1m_pct": 20.0,
            "share_gains_over_5m_pct": 0.0,
            "taxpayers_over_500k": 18_000.0,
            "gains_over_500k_bn": 44.0,
            "gains_over_5m_bn": 22.0,
            "largest_gain_m": 2.0,
            "baseline_cgt_revenue_bn": 17.2 * scale,
            "residential_property_gains_bn": 0.0,
            "badr_gains_bn": 0.0,
            "carried_interest_gains_bn": 0.0,
            "entrants_by_uprating": entrants,
            "cgt_taxpayers_excluding_entrants": 390_000.0 * scale,
            "total_gains_excluding_entrants_bn": 69.97 * scale,
        },
        "budget": [
            {
                "year": label,
                "baseline_cgt_bn": 17.2 * scale,
                "reform_cgt_bn": 19.5 * scale,
                "cgt_change_bn": 2.3 * scale,
                "total_tax_change_bn": 2.3 * scale,
                "gov_balance_change_bn": 2.3 * scale,
                "cgt_change_from_entrants_bn": 0.01 * scale,
            }
            for label in labels
        ],
        "income_change_groups": {
            label: {
                "quintile": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"]
                ],
                "quartile": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["Lowest 25%", "25–50%", "50–75%", "Highest 25%"]
                ],
                "household_type": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["With children", "Pensioner", "Working-age, no children"]
                ],
                "region": [{"group": "London", "avg_change_gbp": 0.0, "relative_change_pct": 0.0}],
            }
            for label in YEAR_LABELS
        },
        "sensitivity": [
            {"name": name, "e_mtr": e, **elasticity_convention(e), "revenue_2026_bn": 1.0}
            for name, e in SENSITIVITY_CASES.items()
        ],
        "benchmarks": fake_benchmarks(scale),
    }


def test_top_level_keys():
    assert set(fake_results()) == TOP_LEVEL_KEYS


def test_metadata_and_years():
    md = fake_results()["metadata"]
    assert md["years"] == [2026, 2027, 2028, 2029, 2030]
    assert md["elasticity"] == -0.7
    assert set(md["reform"]) == {"basic_rate", "higher_rate", "additional_rate"}
    assert set(md["reform_schedules"]) == {
        "residential_property",
        "carried_interest",
        "badr_lifetime_limit",
    }
    assert md["dataset_key"] in {d["key"] for d in md["datasets"]}
    assert md["default_dataset_key"] in DATASETS


def test_validation_reports_entrants_by_uprating():
    validation = fake_results()["validation"]
    assert set(validation["entrants_by_uprating"]) == {
        "exempt_amount_gbp",
        "ceiling_gbp",
        "count",
        "gains_bn",
        "cgt_bn",
    }
    assert validation["cgt_taxpayers_excluding_entrants"] <= validation["cgt_taxpayers"]


def test_dataset_comparison_lays_datasets_out_as_columns():
    results = {
        spec.key: fake_results(spec, scale=1.0 if spec.role == "incumbent" else 2.0)
        for spec in DATASETS.values()
    }
    side_by_side = dataset_comparison(results)
    keys = set(DATASETS)
    assert set(side_by_side["datasets"]) == keys
    assert side_by_side["first_year"] == "2026-27"
    assert [row["metric"] for row in side_by_side["validation"]] == [
        name for name, _ in VALIDATION_METRICS
    ]
    taxpayers = next(r for r in side_by_side["validation"] if r["metric"] == "cgt_taxpayers")
    assert taxpayers["microcosm_uk_2024_25_979"] == 2 * taxpayers["enhanced_frs_2024_25"]
    entrants = next(
        r for r in side_by_side["validation"] if r["metric"] == "entrants_by_uprating.count"
    )
    assert entrants["enhanced_frs_2024_25"] == 10_000.0
    assert set(side_by_side["budget"][0]) == {"year", *keys}
    assert set(side_by_side["five_year_total_bn"]) == keys
    assert set(side_by_side["sensitivity"][0]) == {
        "name",
        "e_mtr",
        "elasticity_parameter",
        "applied_as",
        "applied_value",
        *keys,
    }
    assert side_by_side["sensitivity"][-1]["applied_as"] == "retention"
    assert set(side_by_side["top_quintile"]) == keys
    assert set(side_by_side["region"]) == keys
    bench = side_by_side["benchmarks"]
    assert [row["year"] for row in bench["static_equalisation"]] == YEAR_LABELS
    assert bench["static_equalisation"][0]["jrf_bn"] == 13.0
    assert bench["static_equalisation"][3]["jrf_bn"] == 17.0
    assert bench["static_equalisation"][1]["jrf_bn"] is None
    assert set(bench["static_equalisation"][0]) == {"year", "jrf_bn", *keys}
    assert bench["centax_2019_20_rules"]["centax_uplift_pct"] == 139.0
    assert set(bench["centax_2019_20_rules"]) == {"centax_uplift_pct", *keys}


def test_budget_rows_use_fiscal_year_labels():
    results = fake_results()
    assert [r["year"] for r in results["budget"]] == [
        "2026-27",
        "2027-28",
        "2028-29",
        "2029-30",
        "2030-31",
    ]
    assert set(results["budget"][0]) == {
        "year",
        "baseline_cgt_bn",
        "reform_cgt_bn",
        "cgt_change_bn",
        "total_tax_change_bn",
        "gov_balance_change_bn",
        "cgt_change_from_entrants_bn",
    }


def test_income_change_groups_keyed_by_fiscal_year():
    groups = fake_results()["income_change_groups"]
    assert set(groups) == {"2026-27", "2027-28", "2028-29", "2029-30", "2030-31"}
    year = groups["2026-27"]
    assert set(year) == {"quintile", "quartile", "household_type", "region"}
    assert set(year["quintile"][0]) == {
        "group",
        "avg_change_gbp",
        "relative_change_pct",
    }


def test_calibration_block_is_explicitly_empty():
    cal = fake_results()["calibration"]
    assert set(cal) == {"targets", "ess_before", "ess_after", "note"}
    assert cal["targets"] == []
    assert cal["ess_before"] is None and cal["ess_after"] is None
    assert "upstream" in cal["note"]


def test_sensitivity_cases():
    rows = fake_results()["sensitivity"]
    assert [r["e_mtr"] for r in rows] == [0.0, -0.35, -0.7, -2.52]
    assert rows[0]["name"] == "Static (no behavioural response)"
    # Every row says how its case reached the engine: the official one is
    # keyed by its MTR value but applied as a retention-rate elasticity.
    assert [(r["applied_as"], r["applied_value"]) for r in rows] == [
        ("mtr", 0.0),
        ("mtr", -0.35),
        ("mtr", -0.7),
        ("retention", 3.6),
    ]
    assert rows[-1]["elasticity_parameter"].endswith(".capital_gains_responses.elasticity")


def test_benchmarks_block_shape():
    bench = fake_results()["benchmarks"]
    assert set(bench) == {
        "elasticities",
        "static_equalisation",
        "centax_2019_20_rules",
        "centax_package_context",
        "ready_reckoner",
    }
    assert bench["elasticities"]["official"]["applied_as"] == "retention"
    assert bench["elasticities"]["official"]["e_retention"] == 3.6
    static = bench["static_equalisation"]
    assert [row["year"] for row in static["by_year"]] == YEAR_LABELS
    first = static["by_year"][0]
    assert first["static_uplift_pct"] == pytest.approx(100 * 14.0 / 17.2)
    assert first["uplift_on_obr_receipts_real_bn"] == pytest.approx(20.8 * 14.0 / 17.2)
    assert static["by_year"][3]["static_cgt_change_real_bn"] == pytest.approx(14.0 / 1.02**3)
    centax = bench["centax_2019_20_rules"]
    assert [row["region"] for row in centax["regions"]] == list(REGION_NAMES.values())
    london = next(row for row in centax["regions"] if row["region"] == "London")
    assert london["centax_uplift_pct"] == 123
    assert london["baseline_share_pct"] == pytest.approx(100 / 12)
    assert centax["external"]["value"] == 139.0
    rows = bench["ready_reckoner"]["rows"]
    assert [row["id"] for row in rows] == [row["id"] for row in READY_RECKONER["rows"]]
    assert set(rows[0]["model_m"]) == set(READY_RECKONER_ELASTICITIES)
    assert set(rows[0]["model_m"]["official"]) == {"2026-27", "2027-28"}
