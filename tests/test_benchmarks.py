"""The benchmark aggregations on fake weighted tables (no simulation)."""

from types import SimpleNamespace

import microdf as mdf
import pytest

from uk_cgt_reform.comparison import price_factors
from uk_cgt_reform.impacts import REGION_NAMES, UNASSIGNED_REGION, cgt_by_region, cgt_uplift


def fake_sim(cgt: list[float]) -> SimpleNamespace:
    """Three households (London, Wales, an unassigned region) and four
    people; person weights 2, 2, 1, 3."""
    person = mdf.MicroDataFrame(
        {
            "person_id": [1, 2, 3, 4],
            "household_id": [10, 10, 20, 30],
            "capital_gains_tax": cgt,
        },
        weights=[2.0, 2.0, 1.0, 3.0],
    )
    household = mdf.MicroDataFrame(
        {"household_id": [10, 20, 30], "region": ["LONDON", "WALES", "UNKNOWN"]},
        weights=[2.0, 1.0, 3.0],
    )
    return SimpleNamespace(
        output_dataset=SimpleNamespace(data=SimpleNamespace(person=person, household=household))
    )


def test_cgt_by_region_sums_weighted_person_cgt_by_household_region():
    totals = cgt_by_region(fake_sim([100.0, 50.0, 10.0, 7.0]))
    assert list(totals) == [*REGION_NAMES.values(), UNASSIGNED_REGION]
    assert totals["London"] == pytest.approx(2 * 100 + 2 * 50)
    assert totals["Wales"] == pytest.approx(10.0)
    assert totals[UNASSIGNED_REGION] == pytest.approx(21.0)
    assert totals["Scotland"] == 0.0


def test_cgt_uplift_reports_national_and_regional_changes():
    uplift = cgt_uplift(fake_sim([100.0, 50.0, 10.0, 7.0]), fake_sim([200.0, 100.0, 15.0, 7.0]))
    national = uplift["national"]
    assert national["baseline_cgt_bn"] == pytest.approx(331 / 1e9)
    assert national["change_bn"] == pytest.approx(305 / 1e9)
    assert national["uplift_pct"] == pytest.approx(100 * 305 / 331)
    regions = {row["region"]: row for row in uplift["regions"]}
    assert list(regions) == list(REGION_NAMES.values())
    assert regions["London"]["uplift_pct"] == pytest.approx(100.0)
    assert regions["Wales"]["uplift_pct"] == pytest.approx(50.0)
    assert regions["Scotland"]["uplift_pct"] is None
    assert uplift["unassigned_cgt_bn"] == {"baseline": 21 / 1e9, "reform": 21 / 1e9}
    total = sum(row["baseline_cgt_bn"] for row in uplift["regions"])
    assert total + uplift["unassigned_cgt_bn"]["baseline"] == pytest.approx(
        national["baseline_cgt_bn"]
    )


def test_price_factors_express_each_year_in_the_first_years_prices():
    cpi = {
        str(year): {"cumulative_factor": 1.05 * 1.02 ** (year - 2026)}
        for year in (2026, 2027, 2028, 2029, 2030)
    }
    factors = price_factors(cpi, 2026, [2026, 2027, 2028, 2029, 2030])
    assert list(factors) == ["2026-27", "2027-28", "2028-29", "2029-30", "2030-31"]
    assert factors["2026-27"] == pytest.approx(1.0)
    assert factors["2029-30"] == pytest.approx(1.02**3)
