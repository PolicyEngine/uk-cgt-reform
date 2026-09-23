"""Schema tests: the results-JSON shape agreed with the dashboard, checked
against a fake results dict (no simulation)."""

from uk_equalising_cgt.comparison import (
    EXTERNAL_ESTIMATES,
    SENSITIVITY_CASES,
    VALIDATION_METRICS,
    comparison_rows,
    dataset_comparison,
)
from uk_equalising_cgt.impacts import fiscal_year_label
from uk_equalising_cgt.reform import YEARS, reform_schedules
from uk_equalising_cgt.simulations import DATASETS, DEFAULT_DATASET_KEY, INCUMBENT

YEAR_LABELS = [fiscal_year_label(y) for y in range(2026, 2031)]

TOP_LEVEL_KEYS = {
    "metadata",
    "calibration",
    "validation",
    "budget",
    "income_change_groups",
    "sensitivity",
    "comparison",
}


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
            {"name": name, "e_mtr": e, "revenue_2026_bn": 1.0}
            for name, e in SENSITIVITY_CASES.items()
        ],
        "comparison": comparison_rows(2.3, 2.5, 13.5),
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
    assert set(side_by_side["sensitivity"][0]) == {"name", "e_mtr", *keys}
    assert set(side_by_side["top_quintile"]) == keys
    assert set(side_by_side["region"]) == keys


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
    assert [r["e_mtr"] for r in rows] == [0.0, -0.35, -0.7]


def test_comparison_rows_include_model_and_externals():
    rows = comparison_rows(2.3, 2.5, 13.5)
    assert len(rows) == 3 + len(EXTERNAL_ESTIMATES)
    assert all(
        set(r) == {"source", "reform_modelled", "behavioural_assumption", "revenue_bn_per_year"}
        for r in rows
    )
    external = {r["source"]: r["revenue_bn_per_year"] for r in rows}
    assert external["CenTax central (Advani, Lonsdale & Summers 2024)"] == 14.0
    assert external["CenTax worst-case (elasticity upper bound)"] == 9.7
    assert external["Advani & Summers (GDP-uprated)"] == 16.7
    assert external["HMRC ready reckoner (+10pp higher rates, yr 3)"] == -2.0
