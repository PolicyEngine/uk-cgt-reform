"""The benchmark aggregations on fake weighted tables (no simulation)."""

from types import SimpleNamespace

import microdf as mdf
import pytest

from uk_cgt_reform.comparison import (
    BASES,
    CENTAX_PACKAGE_CONTEXT,
    CENTAX_TABLE_3,
    EXTERNAL_ROW_KEYS,
    HMRC_TABLE_5,
    HMRC_TABLE_5_REGIONS,
    JRF_STATIC,
    READY_RECKONER,
    READY_RECKONER_ELASTICITIES,
    SENSITIVITY_CASES,
    UNITS,
    price_factors,
    ready_reckoner_block,
    regional_block,
)
from uk_cgt_reform.explore import ELASTICITY_OPTIONS
from uk_cgt_reform.impacts import (
    REGION_NAMES,
    UNASSIGNED_REGION,
    cgt_by_region,
    sensitivity,
)
from uk_cgt_reform.reform import ELASTICITY_PARAMETER


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


def test_regional_block_puts_each_side_on_its_own_twelve_region_total():
    model = cgt_by_region(fake_sim([100.0, 50.0, 10.0, 7.0]))
    block = regional_block(model, "2024-25")
    regions = {row["region"]: row for row in block["regions"]}
    assert list(regions) == list(REGION_NAMES.values())
    # London 300 and Wales 10 of 310 in the regions; the unassigned 21 is
    # reported, not shared out.
    assert regions["London"]["model_share_pct"] == pytest.approx(100 * 300 / 310)
    assert regions["Wales"]["model_share_pct"] == pytest.approx(100 * 10 / 310)
    assert block["unassigned_cgt_bn"] == pytest.approx(21 / 1e9)
    assert sum(r["hmrc_share_pct"] for r in block["regions"]) == pytest.approx(100.0)
    assert regions["London"]["hmrc_share_pct"] == pytest.approx(100 * 7_036 / 24_168)
    assert block["year"] == block["external"]["year"] == "2024-25"


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
    runs = {e: fake_sim([100.0 + e, 50.0, 10.0, 7.0]) for e in SENSITIVITY_CASES.values()}
    rows = sensitivity(0.0, SENSITIVITY_CASES, lambda e: runs[e], 2027)
    assert [set(row) for row in rows] == [
        {
            "name",
            "e_retention",
            "elasticity_parameter",
            "applied_as",
            "applied_value",
            "badr_elasticity",
            "year",
            "revenue_bn",
        }
    ] * len(SENSITIVITY_CASES)
    assert [row["elasticity_parameter"] for row in rows] == [ELASTICITY_PARAMETER] * len(rows)
    assert {row["applied_as"] for row in rows} == {"retention"}
    assert [row["applied_value"] for row in rows] == [0.0, 0.5, 1.0, 2.0, 3.6]
    # Only the official case gives gains qualifying for the relief their own
    # elasticity (1.4); CenTax's cases apply one elasticity to every gain.
    assert [row["badr_elasticity"] for row in rows] == [0.0, 0.5, 1.0, 2.0, 1.4]


# --- the external figures, pinned to their sources ----------------------------


EXTERNAL_ROWS = [*JRF_STATIC, CENTAX_TABLE_3, HMRC_TABLE_5, *CENTAX_PACKAGE_CONTEXT]


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
    # HMRC Table 5.1, 2024-25 (2026 release): tax liabilities, £m.
    assert [(r["region"], r["tax_m"]) for r in HMRC_TABLE_5_REGIONS] == [
        ("North East", 274),
        ("North West", 1_711),
        ("Yorkshire and the Humber", 1_385),
        ("East Midlands", 1_224),
        ("West Midlands", 1_136),
        ("East of England", 2_324),
        ("London", 7_036),
        ("South East", 5_150),
        ("South West", 2_059),
        ("Wales", 447),
        ("Scotland", 1_090),
        ("Northern Ireland", 332),
    ]
    assert sum(r["tax_m"] for r in HMRC_TABLE_5_REGIONS) == 24_168
    assert HMRC_TABLE_5["value"] == 24_169 and HMRC_TABLE_5["year"] == "2024-25"
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
        ready_reckoner_block({})


def test_ready_reckoner_elasticities():
    # Central (1.0), a retention-rate elasticity of 3.0 and the official case
    # (3.6). The central and official cases are keyed by the rate explorer's
    # ids for the same elasticity; 3.0 is not an explorer option.
    assert READY_RECKONER_ELASTICITIES == {
        "centax_central": 1.0,
        "elasticity_3": 3.0,
        "official": 3.6,
    }
    options = {o["id"]: o["e_retention"] for o in ELASTICITY_OPTIONS}
    assert options["centax_central"] == READY_RECKONER_ELASTICITIES["centax_central"]
    assert options["official"] == READY_RECKONER_ELASTICITIES["official"]
    assert "elasticity_3" not in options


def test_ready_reckoner_block_lists_every_elasticity():
    scores = {
        row["id"]: {
            eid: {lag["model_year"]: 0.0 for lag in READY_RECKONER["lag"]}
            for eid in READY_RECKONER_ELASTICITIES
        }
        for row in READY_RECKONER["rows"]
    }
    block = ready_reckoner_block(scores)
    assert block["elasticity_ids"] == ["centax_central", "elasticity_3", "official"]
    assert block["elasticities"] == READY_RECKONER_ELASTICITIES
    assert all(set(row["model_m"]) == set(READY_RECKONER_ELASTICITIES) for row in block["rows"])


def test_jrf_years_outside_the_window_are_scored_for_the_comparison_only():
    from uk_cgt_reform.comparison import jrf_comparison_years, static_equalisation_block
    from uk_cgt_reform.reform import YEARS

    assert jrf_comparison_years(YEARS) == [2026]
    row = {
        "year": "2026-27",
        "baseline_cgt_bn": 29.0,
        "cgt_change_bn": 26.0,
        "gov_balance_change_bn": 26.0,
    }
    window_row = {**row, "year": "2027-28"}
    block = static_equalisation_block(
        [window_row], {"2026-27": 1.0, "2027-28": 1.02}, "0" * 12, "OBR", [row]
    )
    assert [r["year"] for r in block["by_year"]] == ["2027-28"]
    [extra] = block["comparison_by_year"]
    assert extra["year"] == "2026-27"
    assert extra["static_cgt_change_real_bn"] == pytest.approx(26.0)
    assert extra["uplift_on_obr_receipts_real_bn"] == pytest.approx(20.8 * 26.0 / 29.0)


def test_split_point_stacks_increments_to_the_total():
    from uk_cgt_reform.impacts import split_point

    point = split_point(
        10e9,
        1.2,
        ["main_rates", "residential", "badr_withdrawn"],
        {"main_rates": 15e9, "residential": 14e9, "badr_withdrawn": 16e9},
    )
    assert point["main_rates_bn"] == pytest.approx(5.0)
    assert point["residential_bn"] == pytest.approx(-1.0)
    assert point["badr_withdrawn_bn"] == pytest.approx(2.0)
    assert point["total_bn"] == pytest.approx(6.0)
    parts = point["main_rates_bn"] + point["residential_bn"] + point["badr_withdrawn_bn"]
    assert parts == pytest.approx(point["total_bn"])


def test_package_model_rows_name_published_centax_figures():
    from uk_cgt_reform.comparison import PACKAGE_MODEL_RUNS, package_model_block

    ids = {row["id"] for row in CENTAX_PACKAGE_CONTEXT}
    assert all(source in ids for source, _ in PACKAGE_MODEL_RUNS.values())
    # CenTax's central elasticity in every year.
    assert all(runs == (1.0,) for _, runs in PACKAGE_MODEL_RUNS.values())
    block = package_model_block(
        [
            {
                "year": "2025-26",
                "elasticity": 1.0,
                "cgt_change_bn": 9.0,
                "source_id": "centax_2024_table6_package_range",
            }
        ]
    )
    assert block["rows"][0]["cgt_change_bn"] == 9.0 and "CGT revenue" in block["measure"]
    with pytest.raises(ValueError):
        package_model_block(
            [{"year": "x", "elasticity": 1.0, "cgt_change_bn": 0, "source_id": "nope"}]
        )
