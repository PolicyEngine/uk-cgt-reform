"""Unit tests for the distributional grouping (microdf-native ranks)."""

import numpy as np
from microdf import MicroSeries

from uk_cgt_reform.impacts import QUANTILE_LABELS, REGION_NAMES, entrant_mask

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
    for n, rank in ((5, income.quintile_rank()), (4, income.quartile_rank())):
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
    assert len(QUANTILE_LABELS[5]) == 5
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
