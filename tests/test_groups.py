"""Unit tests for the distributional grouping (microdf-native ranks)."""

import numpy as np
from microdf import MicroSeries

from uk_cgt_reform.impacts import QUANTILE_LABELS, REGION_NAMES, entrant_mask, income_change_groups

# policyengine_uk's Region enum names, which every UK dataset's ``region``
# household variable reports.
ENGINE_REGIONS = {
    "NORTH_EAST",
    "NORTH_WEST",
    "YORKSHIRE",
    "EAST_MIDLANDS",
    "WEST_MIDLANDS",
    "EAST_OF_ENGLAND",
    "LONDON",
    "SOUTH_EAST",
    "SOUTH_WEST",
    "WALES",
    "SCOTLAND",
    "NORTHERN_IRELAND",
}


def test_microdf_quantile_ranks_split_weight_evenly():
    income = MicroSeries(np.arange(100, dtype=float), weights=np.ones(100))
    for n, rank in (
        (10, income.decile_rank()),
        (5, income.quintile_rank()),
        (4, income.quartile_rank()),
    ):
        labels = np.array(QUANTILE_LABELS[n], dtype=object)[rank.values.astype(int) - 1]
        values, counts = np.unique(labels, return_counts=True)
        assert set(values) == set(QUANTILE_LABELS[n])
        assert (counts == 100 // n).all()


def test_microdf_ranks_are_weighted():
    # A heavy high-income household fills the upper groups, leaving the
    # light low-income households ranked in the bottom quartile.
    income = MicroSeries(np.array([1.0, 2.0, 3.0, 4.0]), weights=np.array([1.0, 1.0, 1.0, 75.0]))
    rank = income.quartile_rank().values.astype(int)
    assert (rank[:3] == 1).all()
    assert rank[-1] == 4


def test_quantile_labels_are_ordered_and_complete():
    assert len(QUANTILE_LABELS[10]) == 10
    assert len(QUANTILE_LABELS[4]) == 4
    assert len(QUANTILE_LABELS[5]) == 5
    assert len(REGION_NAMES) == 12  # 9 English regions + Wales, Scotland, NI


def test_distribution_uses_baseline_deciles_and_oldest_household_member():
    """Keep households in their baseline groups after reform; align ages by ID."""
    from types import SimpleNamespace

    weights = np.ones(10)

    def series(values):
        return MicroSeries(values, weights=weights)

    household = {
        "household_id": series(np.arange(10)),
        "household_net_income": series(np.arange(1, 11) * 1000.0),
        "region": series(["LONDON"] * 10),
    }
    # Person records deliberately run in reverse household order.
    person = {
        "household_id": series(np.arange(9, -1, -1)),
        "age": series([80, 75, 74, 65, 64, 55, 54, 45, 44, 34]),
        "is_child": series([False] * 10),
        "is_adult": series([True] * 10),
        "is_SP_age": series([True] * 4 + [False] * 6),
    }

    def simulation(hh):
        return SimpleNamespace(
            output_dataset=SimpleNamespace(data=SimpleNamespace(household=hh, person=person))
        )

    # Reverse the post-reform income order: the groups must remain baseline groups.
    reform_hh = {**household, "household_net_income": series(np.arange(10, 0, -1) * 1000.0)}
    groups = income_change_groups(simulation(household), simulation(reform_hh))
    assert len(groups["decile"]) == 10
    assert groups["decile"][0]["avg_change_gbp"] == 9000
    assert groups["decile"][-1]["avg_change_gbp"] == -9000
    by_age = {row["group"]: row for row in groups["age"]}
    assert by_age["Under 35"]["avg_change_gbp"] == 9000
    assert by_age["35–44"]["avg_change_gbp"] == 7000
    assert by_age["75+"]["avg_change_gbp"] == -8000


def test_region_names_are_keyed_by_the_engine_enum():
    assert set(REGION_NAMES) == ENGINE_REGIONS
    assert REGION_NAMES["YORKSHIRE"] == "Yorkshire and the Humber"


def test_entrant_mask_selects_base_year_non_taxpayers_who_crossed():
    # Exempt amount 3,000 in every year; gains uprated by 7.4% from the base
    # year, so the ceiling a base-year non-taxpayer can reach is 3,222.
    gains = np.array([0.0, 2_999.0, 3_000.0, 3_000.5, 3_222.0, 3_223.0, 50_000.0])
    mask = entrant_mask(gains, exempt_amount=3_000.0, ceiling=3_000.0 * 1.074)
    assert mask.tolist() == [False, False, False, True, True, False, False]


def test_entrant_mask_tolerates_float32_rounding_at_the_ceiling():
    ceiling = 3_000.0 * 1.074
    gains = np.array([ceiling * (1 + 5e-7)], dtype=np.float32)
    assert entrant_mask(gains, 3_000.0, ceiling).all()


def test_age_groups_count_households_once_and_keep_survey_weights():
    from types import SimpleNamespace

    def hh_series(values):
        return MicroSeries(values, weights=[1.0, 3.0])

    household = {
        "household_id": hh_series([40, 20]),
        "household_net_income": hh_series([1000.0, 3000.0]),
        "region": hh_series(["LONDON", "LONDON"]),
    }
    person = {
        key: MicroSeries(values, weights=[1.0, 1.0, 3.0])
        for key, values in {
            "household_id": [40, 40, 20],
            "age": [20, 55, 60],
            "is_child": [False, False, False],
            "is_adult": [True, True, True],
            "is_SP_age": [False, False, False],
        }.items()
    }

    def simulation(hh):
        return SimpleNamespace(
            output_dataset=SimpleNamespace(data=SimpleNamespace(household=hh, person=person))
        )

    reform = {**household, "household_net_income": hh_series([900.0, 2400.0])}
    age = income_change_groups(simulation(household), simulation(reform))["age"]
    assert age == [{"group": "55–64", "avg_change_gbp": -475.0, "relative_change_pct": -19.0}]
