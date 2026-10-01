"""The benchmark aggregations on fake weighted tables (no simulation)."""

from types import SimpleNamespace

import microdf as mdf
import pytest

from uk_cgt_reform.comparison import (
    BASES,
    CENTAX_PACKAGE_CONTEXT,
    CENTAX_TABLE_3,
    CENTAX_TABLE_8,
    CENTAX_TABLE_8_REGIONS,
    ELASTICITY_CASES,
    EXTERNAL_ROW_KEYS,
    JRF_STATIC,
    READY_RECKONER,
    UNITS,
    price_factors,
    ready_reckoner_block,
)
from uk_cgt_reform.impacts import (
    REGION_NAMES,
    UNASSIGNED_REGION,
    cgt_by_region,
    cgt_uplift,
    gains_response,
    income_shifting_offset,
    sensitivity,
)
from uk_cgt_reform.reform import (
    ELASTICITY_PARAMETER,
    INCOME_SHIFTING_SHARE,
    INCOME_SHIFTING_TAX_RATE,
    MTR_ELASTICITY_PARAMETER,
)


def fake_sim(cgt: list[float], gains_after: list[float] | None = None) -> SimpleNamespace:
    """Three households (London, Wales, an unassigned region) and four
    people; person weights 2, 2, 1, 3. Pre-response gains are 1000, 500,
    100 and 0; ``gains_after`` defaults to no response."""
    gains_before = [1000.0, 500.0, 100.0, 0.0]
    person = mdf.MicroDataFrame(
        {
            "person_id": [1, 2, 3, 4],
            "household_id": [10, 10, 20, 30],
            "capital_gains_tax": cgt,
            "capital_gains_before_response": gains_before,
            "capital_gains": gains_before if gains_after is None else gains_after,
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


def test_sensitivity_rows_record_how_each_case_was_applied():
    runs = {e: fake_sim([100.0 + e, 50.0, 10.0, 7.0]) for _, _, e in ELASTICITY_CASES}
    rows = sensitivity(0.0, ELASTICITY_CASES, lambda e: runs[e])
    assert [set(row) for row in rows] == [
        {
            "id",
            "name",
            "elasticity",
            "elasticity_parameter",
            "applied_as",
            "applied_value",
            "badr_elasticity",
            "revenue_2026_bn",
            "income_shifting_offset_2026_bn",
        }
    ] * len(ELASTICITY_CASES)
    assert [row["id"] for row in rows] == [case_id for case_id, _, _ in ELASTICITY_CASES]
    # PolicyEngine's case on the engine's marginal-tax-rate parameter, the
    # rest on its retention-rate parameter, each value applied as stated.
    by_id = {row["id"]: row for row in rows}
    assert by_id["policyengine"]["elasticity_parameter"] == MTR_ELASTICITY_PARAMETER
    assert by_id["policyengine"]["applied_as"] == "mtr"
    others = [row for row in rows if row["id"] != "policyengine"]
    assert [row["elasticity_parameter"] for row in others] == [ELASTICITY_PARAMETER] * len(others)
    assert {row["applied_as"] for row in others} == {"retention"}
    assert [row["applied_value"] for row in rows] == [0.0, -0.7, 0.5, 1.0, 1.5, 2.0, 3.6]
    assert [row["elasticity"] for row in rows] == [row["applied_value"] for row in rows]
    # Only the official case gives gains qualifying for the relief their own
    # elasticity (1.4); every other case applies one elasticity to every gain.
    assert [row["badr_elasticity"] for row in rows] == [0.0, -0.7, 0.5, 1.0, 1.5, 2.0, 1.4]
    # No response in these fakes, so nothing to add back.
    assert {row["income_shifting_offset_2026_bn"] for row in rows} == {0.0}


def test_income_shifting_offset_taxes_a_share_of_the_fall_in_gains():
    # Gains fall from 1000/500/100/0 to 600/400/100/0: weighted fall
    # 2*400 + 2*100 = 1000.
    reformed = fake_sim([0.0] * 4, gains_after=[600.0, 400.0, 100.0, 0.0])
    assert gains_response(reformed) == pytest.approx(1000.0)
    assert income_shifting_offset(reformed) == pytest.approx(1000.0 * 0.125 * 0.45)
    assert (INCOME_SHIFTING_SHARE, INCOME_SHIFTING_TAX_RATE) == (0.125, 0.45)
    # A cut that raises realisations takes income tax away instead.
    cut = fake_sim([0.0] * 4, gains_after=[1100.0, 500.0, 100.0, 0.0])
    assert income_shifting_offset(cut) == pytest.approx(-200.0 * 0.125 * 0.45)
    # A static run has no response and so no offset.
    assert income_shifting_offset(fake_sim([0.0] * 4)) == 0.0


# --- the external figures, pinned to their sources ----------------------------


EXTERNAL_ROWS = [*JRF_STATIC, CENTAX_TABLE_3, CENTAX_TABLE_8, *CENTAX_PACKAGE_CONTEXT]


@pytest.mark.parametrize("row", EXTERNAL_ROWS, ids=lambda row: row["id"])
def test_external_rows_share_one_shape(row):
    assert tuple(row) == EXTERNAL_ROW_KEYS
    assert row["basis"] in BASES
    assert row["unit"] in UNITS
    assert row["url"].startswith("https://")


def test_external_figures_are_pinned():
    assert [(r["year"], r["value"], r["basis"]) for r in JRF_STATIC] == [
        ("2026-27", 13.0, "static"),
        ("2029-30", 17.0, "static"),
    ]
    assert CENTAX_TABLE_3["value"] == 139.0
    assert CENTAX_TABLE_3["details"] == {"change_bn": 15.2, "baseline_bn": 10.9}
    assert [(r["region"], r["baseline_bn"], r["uplift_pct"]) for r in CENTAX_TABLE_8_REGIONS] == [
        ("London", 3.0, 123),
        ("South East", 2.4, 139),
        ("East of England", 1.1, 137),
        ("North West", 0.9, 146),
        ("South West", 0.8, 144),
        ("West Midlands", 0.6, 151),
        ("Yorkshire and the Humber", 0.6, 152),
        ("East Midlands", 0.6, 151),
        ("Scotland", 0.5, 160),
        ("Wales", 0.2, 148),
        ("North East", 0.2, 163),
        ("Northern Ireland", 0.2, 154),
    ]
    assert {r["region"] for r in CENTAX_TABLE_8_REGIONS} == set(REGION_NAMES.values())
    context = {r["id"]: r for r in CENTAX_PACKAGE_CONTEXT}
    assert not any(r["comparable"] for r in CENTAX_PACKAGE_CONTEXT)
    assert context["centax_2024_rates_only_post_behavioural_derived"]["value"] == 8.2
    assert context["centax_2024_table5_package"]["value"] == 14.3
    assert [
        (r["retention_elasticity"], r["value"])
        for r in context["centax_2024_table6_package_range"]["details"]["by_retention_elasticity"]
    ] == [(0.5, 19.0), (1.0, 14.3), (1.5, 9.7), (2.0, 5.0)]
    assert context["centax_2025_technical_note_package"]["value"] == 11.3
    assert context["centax_2025_technical_note_package"]["details"] == {
        "with_carried_interest_bn": 11.8
    }
    assert context["centax_2026_taxes_at_the_top_package"]["value"] == 19.7


def test_ready_reckoner_rows_are_pinned():
    # HMRC, Direct effects of illustrative tax changes, June 2025 (the ODS
    # at READY_RECKONER["url"], sha256 in READY_RECKONER["sha256"]).
    rows = {row["id"]: row for row in READY_RECKONER["rows"]}
    assert {rid: tuple(row["rates"].values()) for rid, row in rows.items()} == {
        "higher_plus_1": (0.18, 0.25, 0.25),
        "higher_plus_5": (0.18, 0.29, 0.29),
        "higher_plus_10": (0.18, 0.34, 0.34),
        "lower_plus_1": (0.19, 0.24, 0.24),
        "lower_plus_5": (0.23, 0.24, 0.24),
        "badr_plus_1": (0.18, 0.24, 0.24),
        "badr_plus_5": (0.18, 0.24, 0.24),
    }
    assert {rid: tuple(row["hmrc_m"].values()) for rid, row in rows.items()} == {
        "higher_plus_1": (-15, 80, -30),
        "higher_plus_5": (-170, -235, -870),
        "higher_plus_10": (-540, -2060, -3565),
        "lower_plus_1": (-5, 10, 5),
        "lower_plus_5": (-40, 20, -10),
        "badr_plus_1": (10, 135, 180),
        "badr_plus_5": (40, 635, 840),
    }
    # The BADR rows move the relief's rate from 18%; the rest keep the relief
    # at current law. The official case is the same in every row (3.6 for
    # main-rate gains, 1.4 for gains qualifying for the relief).
    assert {rid: row["badr"]["rate"] for rid, row in rows.items() if "badr" in rid} == {
        "badr_plus_1": 0.19,
        "badr_plus_5": 0.23,
    }
    assert not any("official_elasticity" in row for row in rows.values())
    assert all(
        row["badr"] == {"withdrawn": False, "rate": 0.18, "lifetime_limit": 1_000_000}
        for rid, row in rows.items()
        if "badr" not in rid
    )
    assert READY_RECKONER["lag"] == [
        {"model_year": "2026-27", "hmrc_year": "2027-28"},
        {"model_year": "2027-28", "hmrc_year": "2028-29"},
    ]
    assert [row["hmrc_label"] for row in READY_RECKONER["excluded"]] == [
        "Lower rate +10pp (28% / 24% / 24%)",
        "Annual exempt amount +£500 (individuals; £250 for trusts)",
    ]


def test_ready_reckoner_block_refuses_unscored_rows():
    with pytest.raises(ValueError, match="not scored"):
        ready_reckoner_block({}, {})
