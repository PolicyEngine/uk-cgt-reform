"""Unit tests for the distributional grouping (microdf-native ranks)."""

import numpy as np
import pytest
from microdf import MicroSeries

from uk_cgt_reform.impacts import (
    AFFECTED_LOSS_THRESHOLD_GBP,
    QUANTILE_LABELS,
    REGION_NAMES,
    _group_rows,
    entrant_mask,
)

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
    for n, rank in ((10, income.decile_rank()), (4, income.quartile_rank())):
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
    assert len(QUANTILE_LABELS[4]) == 4
    assert len(QUANTILE_LABELS[10]) == 10
    assert QUANTILE_LABELS[10][0] == "Lowest 10%"
    assert QUANTILE_LABELS[10][-1] == "Highest 10%"
    assert len(REGION_NAMES) == 12  # 9 English regions + Wales, Scotland, NI


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


def test_share_affected_is_weighted_and_counts_only_losses_beyond_the_threshold():
    # Group "a": a loss of £5 (weight 1), no change (weight 3).
    # Group "b": a £0.50 loss, float noise below the threshold (weight 2), a
    # gain (weight 1), and a £10 loss (weight 7).
    gain = MicroSeries(
        np.array([-5.0, 0.0, -0.5, 4.0, -10.0]), weights=np.array([1.0, 3.0, 2.0, 1.0, 7.0])
    )
    income = MicroSeries(np.full(5, 1_000.0), weights=gain.weights.values)
    labels = np.array(["a", "a", "b", "b", "b"], dtype=object)
    rows = {row["group"]: row for row in _group_rows(gain, income, labels, ["a", "b"])}
    assert AFFECTED_LOSS_THRESHOLD_GBP == 1.0
    assert rows["a"]["share_affected_pct"] == pytest.approx(100 * 1 / 4)
    assert rows["b"]["share_affected_pct"] == pytest.approx(100 * 7 / 10)
    # The averages it sits beside use the same weights.
    assert rows["a"]["avg_change_gbp"] == pytest.approx(-5 / 4)
    assert rows["b"]["avg_change_gbp"] == pytest.approx((-1.0 + 4.0 - 70.0) / 10)


def test_share_affected_excludes_a_loss_of_exactly_the_threshold():
    gain = MicroSeries(np.array([-1.0, -1.01]), weights=np.ones(2))
    income = MicroSeries(np.full(2, 1_000.0), weights=np.ones(2))
    labels = np.array(["a", "a"], dtype=object)
    (row,) = _group_rows(gain, income, labels, ["a"])
    assert row["share_affected_pct"] == pytest.approx(50.0)


def test_share_affected_keeps_weights_under_a_row_mask():
    # The region rows pass masked series (households without a region dropped).
    gain = MicroSeries(np.array([-5.0, -5.0, 0.0]), weights=np.array([9.0, 1.0, 3.0]))
    income = MicroSeries(np.full(3, 1_000.0), weights=gain.weights.values)
    keep = np.array([False, True, True])
    labels = np.array(["x", "x", "x"], dtype=object)
    (row,) = _group_rows(gain[keep], income[keep], labels[keep], ["x"])
    assert row["share_affected_pct"] == pytest.approx(100 * 1 / 4)


def test_share_affected_is_zero_when_nobody_loses():
    gain = MicroSeries(np.array([0.0, 2.0, -0.2]), weights=np.ones(3))
    income = MicroSeries(np.full(3, 1_000.0), weights=np.ones(3))
    labels = np.array(["a", "a", "a"], dtype=object)
    (row,) = _group_rows(gain, income, labels, ["a"])
    assert row["share_affected_pct"] == 0.0
