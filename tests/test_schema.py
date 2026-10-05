"""Schema tests: the results-JSON shape agreed with the dashboard, checked
against a fake results dict (no simulation)."""

import pytest

from uk_cgt_reform.comparison import (
    APPROACHES,
    DEFAULT_APPROACH,
    ELASTICITY_CASES,
    INCOME_SHIFTING,
    READY_RECKONER,
    READY_RECKONER_ELASTICITIES,
    approaches_block,
    benchmarks_block,
    centax_1920_block,
    ready_reckoner_block,
    static_equalisation_block,
)
from uk_cgt_reform.impacts import REGION_NAMES, fiscal_year_label, schedule_split
from uk_cgt_reform.reform import (
    YEARS,
    centax_1920_rules,
    elasticity_convention,
    reform_schedules,
)
from uk_cgt_reform.simulations import CANDIDATE, DATASETS, DEFAULT_DATASET_KEY

YEAR_LABELS = [fiscal_year_label(y) for y in range(2026, 2031)]

TOP_LEVEL_KEYS = {
    "metadata",
    "calibration",
    "validation",
    "budget",
    "income_change_groups",
    "sensitivity",
    "benchmarks",
    "schedule_split",
    "approaches",
    "approach_results",
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
        ready_reckoner=ready_reckoner_block(
            model_m,
            {
                row_id: {
                    e_id: {y: 10.0 * scale for y in by_year} for e_id, by_year in cells.items()
                }
                for row_id, cells in model_m.items()
            },
        ),
    )


def fake_schedule_split(scale: float = 1.0) -> dict:
    """The ``schedule_split`` block, built through the real builder."""
    steps = [
        ("main_rates", "Main rates at 20% / 40% / 45%"),
        ("residential", "Residential property gains at the same rates"),
        ("badr_withdrawn", "Business Asset Disposal Relief withdrawn"),
    ]
    base = 17.2e9 * scale
    revenues = {
        "static": {
            "main_rates": base + 9e9,
            "residential": base + 11e9,
            "badr_withdrawn": base + 14e9,
        },
        "central": {
            "main_rates": base + 3e9,
            "residential": base + 3.5e9,
            "badr_withdrawn": base + 4e9,
        },
        "unadjusted": {
            "main_rates": base + 1e9,
            "residential": base + 1.2e9,
            "badr_withdrawn": base + 1.5e9,
        },
    }
    return {
        "year": "2026-27",
        "elasticities": {"static": 0.0, "central": 1.0, "unadjusted": 1.5},
        "reform_fingerprints": {case: {step: "0" * 12 for step, _ in steps} for case in revenues},
        "steps": schedule_split(base, steps, revenues),
    }


def fake_results(spec=CANDIDATE, scale: float = 1.0) -> dict:
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
            "dataset_columns": spec.columns,
            "datasets": [s.to_metadata() for s in DATASETS.values()],
            "default_dataset_key": DEFAULT_DATASET_KEY,
            "calibrated": False,
            "reform_period_start": "2026-01-01",
            "elasticity": 1.0,
            "elasticity_parameter": "gov.simulation.capital_gains_responses.elasticity",
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
            "badr_claimants": 0.0,
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
                "income_shifting_offset_bn": 0.4 * scale,
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
            {
                "id": case_id,
                "name": name,
                "e_retention": e,
                **elasticity_convention(e),
                "revenue_2026_bn": 1.0,
                "income_shifting_offset_2026_bn": 0.1 * e,
            }
            for case_id, name, e in ELASTICITY_CASES
        ],
        "benchmarks": fake_benchmarks(scale),
        "schedule_split": fake_schedule_split(scale),
        "approaches": approaches_block(),
        "approach_results": {
            "cgt_only": {
                "central_id": "centax_unadjusted",
                "elasticity": 1.5,
                "reform_fingerprint": "0" * 12,
                "budget": [
                    {
                        "year": label,
                        "baseline_cgt_bn": 17.2 * scale,
                        "reform_cgt_bn": 18.5 * scale,
                        "cgt_change_bn": 1.3 * scale,
                        "total_tax_change_bn": 1.3 * scale,
                        "gov_balance_change_bn": 1.3 * scale,
                        "income_shifting_offset_bn": 0.6 * scale,
                        "cgt_change_from_entrants_bn": 0.01 * scale,
                    }
                    for label in labels
                ],
                "income_change_groups": {
                    label: {
                        "quintile": [
                            {"group": g, "avg_change_gbp": -1.0, "relative_change_pct": -0.1}
                            for g in ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"]
                        ],
                        "household_type": [
                            {
                                "group": "Pensioner",
                                "avg_change_gbp": -1.0,
                                "relative_change_pct": 0.0,
                            }
                        ],
                        "region": [
                            {"group": "London", "avg_change_gbp": -1.0, "relative_change_pct": 0.0}
                        ],
                    }
                    for label in YEAR_LABELS
                },
            }
        },
    }


def test_top_level_keys():
    assert set(fake_results()) == TOP_LEVEL_KEYS


def test_metadata_and_years():
    md = fake_results()["metadata"]
    assert md["years"] == [2026, 2027, 2028, 2029, 2030]
    assert md["elasticity"] == 1.0
    assert set(md["reform"]) == {"basic_rate", "higher_rate", "additional_rate"}
    # Carried interest has been taxed as income since April 2026: the reform
    # moves the residential schedule and withdraws the relief.
    assert set(md["reform_schedules"]) == {"residential_property", "badr"}
    assert md["reform_schedules"]["badr"]["withdrawn"] is True
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
        "income_shifting_offset_bn",
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
    assert [r["e_retention"] for r in rows] == [0.0, 0.5, 1.0, 1.5, 2.0, 3.6]
    assert [r["id"] for r in rows] == [case_id for case_id, _, _ in ELASTICITY_CASES]
    assert rows[0]["name"] == "Static (no behavioural response)"
    # Every row says how its case reached the engine: a retention-rate
    # elasticity, applied as stated.
    assert [(r["applied_as"], r["applied_value"]) for r in rows] == [
        ("retention", 0.0),
        ("retention", 0.5),
        ("retention", 1.0),
        ("retention", 1.5),
        ("retention", 2.0),
        ("retention", 3.6),
    ]
    assert all(
        r["elasticity_parameter"].endswith(".capital_gains_responses.elasticity") for r in rows
    )


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
    assert bench["elasticities"]["central"]["applied_as"] == "retention"
    assert bench["elasticities"]["central"]["e_retention"] == 1.0
    assert bench["elasticities"]["unadjusted"]["e_retention"] == 1.5
    assert bench["elasticities"]["centax_range"] == {"lower": 0.5, "upper": 2.0}
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
    assert set(rows[0]["model_m"]) == {"centax_central", "centax_unadjusted", "official"}
    assert set(rows[0]["model_m"]["official"]) == {"2026-27", "2027-28"}
    assert set(rows[0]["income_shifting_offset_m"]) == set(READY_RECKONER_ELASTICITIES)
    assert set(rows[0]["income_shifting_offset_m"]["official"]) == {"2026-27", "2027-28"}


def test_schedule_split_builds_the_yield_up_step_by_step():
    split = fake_results()["schedule_split"]
    assert split["year"] == "2026-27"
    assert split["elasticities"] == {"static": 0.0, "central": 1.0, "unadjusted": 1.5}
    steps = split["steps"]
    assert [row["step"] for row in steps] == ["main_rates", "residential", "badr_withdrawn"]
    # Cumulative changes from current law, and each step's own increment.
    assert [row["static_cgt_change_bn"] for row in steps] == pytest.approx([9.0, 11.0, 14.0])
    assert [row["static_increment_bn"] for row in steps] == pytest.approx([9.0, 2.0, 3.0])
    assert [row["central_increment_bn"] for row in steps] == pytest.approx([3.0, 0.5, 0.5])
    assert sum(row["central_increment_bn"] for row in steps) == pytest.approx(
        steps[-1]["central_cgt_change_bn"]
    )


def test_two_approaches_to_income_shifting():
    block = fake_results()["approaches"]
    assert block["default"] == DEFAULT_APPROACH == "total_revenue"
    assert [a["id"] for a in block["approaches"]] == ["total_revenue", "cgt_only"]
    case_ids = [case_id for case_id, _, _ in ELASTICITY_CASES]
    assert [c["id"] for c in block["cases"]] == case_ids
    for approach in APPROACHES.values():
        # Five cases each, every one a known case, the central among them.
        assert len(approach["case_ids"]) == 5
        assert set(approach["case_ids"]) <= set(case_ids)
        assert approach["central_id"] in approach["case_ids"]
        assert set(approach["offset_case_ids"]) <= set(approach["case_ids"])
    # Net of income shifting: CenTax's central case as published, and the
    # cases measured on the CGT base (CenTax's bounds and the official case)
    # plus the OBR's income tax and National Insurance. Gross: CenTax before
    # its adjustments, no offset.
    net, gross = APPROACHES["total_revenue"], APPROACHES["cgt_only"]
    assert net["central_id"] == "centax_central"
    assert net["offset_case_ids"] == ["centax_lower", "centax_upper", "official"]
    assert gross["central_id"] == "centax_unadjusted" and gross["offset_case_ids"] == []
    # The CenTax cases that never carry an offset: CenTax's elasticities are
    # either net already (1.0) or counted as CGT only (1.5).
    assert "centax_central" not in net["offset_case_ids"]
    shifting = block["income_shifting"]
    assert shifting["share"] == 0.125
    assert shifting["tax_rate"] == pytest.approx(0.62 / 1.15)
    assert shifting == INCOME_SHIFTING
    assert shifting["url"].startswith("https://obr.uk/")


def test_approach_results_hold_the_gross_central_case():
    results = fake_results()
    gross = results["approach_results"]["cgt_only"]
    assert gross["central_id"] == APPROACHES["cgt_only"]["central_id"]
    assert gross["elasticity"] == 1.5
    assert [row["year"] for row in gross["budget"]] == [row["year"] for row in results["budget"]]
    assert set(gross["income_change_groups"]) == set(results["income_change_groups"])
