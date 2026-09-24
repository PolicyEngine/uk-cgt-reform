"""Pure-function tests for the uprating audit (no engine required)."""

from __future__ import annotations

import pytest

from uk_cgt_reform.uprating_audit import (
    CPI_INDEX,
    OBR_CGT_RECEIPTS_BN,
    audit_uprating,
    cumulative_factors,
    index_for,
    projection_fingerprint,
)

GDP = "gov.economic_assumptions.yoy_growth.obr.per_capita.gdp"
POP = "gov.economic_assumptions.yoy_growth.ons.population"

INDICES = {
    GDP: ["capital_gains", "capital_gains_before_response"],
    POP: ["household_weight"],
    CPI_INDEX: ["some_benefit"],
}

RATES = {
    GDP: {2025: 0.04, 2026: 0.03, 2027: 0.02, 2028: 0.02, 2029: 0.02, 2030: 0.02},
    POP: {2025: 0.01, 2026: 0.01, 2027: 0.01, 2028: 0.01, 2029: 0.01, 2030: 0.01},
    CPI_INDEX: {y: 0.02 for y in range(2025, 2031)},
}


def growth(index: str, year: int) -> float:
    return RATES[index][year]


def metadata(index: str) -> dict:
    return {"label": index.rsplit(".", 1)[-1], "reference": [{"title": "test", "href": "x"}]}


def test_index_for_reads_the_engine_map():
    assert index_for("capital_gains", INDICES) == GDP
    assert index_for("household_weight", INDICES) == POP
    assert index_for("never_uprated", INDICES) is None


def test_index_for_refuses_a_variable_on_two_indices():
    with pytest.raises(ValueError):
        index_for("capital_gains", {GDP: ["capital_gains"], POP: ["capital_gains"]})


def test_cumulative_factor_is_the_product_from_the_year_after_base():
    rows = cumulative_factors(GDP, growth, base_year=2024, years=[2026, 2027])
    assert rows[2026]["yoy_growth"] == 0.03
    assert rows[2026]["cumulative_factor"] == pytest.approx(1.04 * 1.03)
    assert rows[2027]["cumulative_factor"] == pytest.approx(1.04 * 1.03 * 1.02)
    assert 2025 not in rows  # only analysis years are reported


def test_audit_carries_index_vintage_and_factors_per_variable():
    audit = audit_uprating(
        indices=INDICES,
        growth=growth,
        metadata=metadata,
        base_year=2024,
        years=[2026, 2030],
        version="0.0.0-test",
    )
    gains = audit["variables"]["capital_gains"]
    assert gains["index"] == GDP
    assert gains["reference"][0]["title"] == "test"
    assert gains["by_year"]["2030"]["cumulative_factor"] == pytest.approx(1.04 * 1.03 * 1.02**4)
    weight = audit["variables"]["household_weight"]
    assert weight["by_year"]["2026"]["cumulative_factor"] == pytest.approx(1.01**2)
    cpi = audit["sensitivity_not_applied"]["cpi"]
    assert cpi["index"] == CPI_INDEX and cpi["applied_to"] == []
    assert audit["obr_cgt_receipts_bn"]["values"] == OBR_CGT_RECEIPTS_BN
    assert audit["policyengine_uk_version"] == "0.0.0-test"


def test_fingerprint_moves_with_the_factors_and_the_version():
    kwargs = dict(indices=INDICES, growth=growth, metadata=metadata, base_year=2024, years=[2026])
    a = projection_fingerprint(audit_uprating(version="1", **kwargs))
    b = projection_fingerprint(audit_uprating(version="2", **kwargs))
    assert a != b and len(a) == 12

    def faster(index: str, year: int) -> float:
        return RATES[index][year] + (0.01 if index == GDP else 0.0)

    c = projection_fingerprint(
        audit_uprating(
            indices=INDICES,
            growth=faster,
            metadata=metadata,
            base_year=2024,
            years=[2026],
            version="1",
        )
    )
    assert c != a


def test_reviewed_vintage_names_the_release_and_checks_the_engine_against_it():
    from uk_cgt_reform.uprating_audit import REVIEWED_VINTAGES, reviewed_vintage

    of_record = REVIEWED_VINTAGES[POP]["values_of_record"]

    def matching(index: str, year: int) -> float:
        return of_record[str(year)]

    vintage = reviewed_vintage(POP, matching)
    assert vintage["publisher"] == "Office for Budget Responsibility"
    assert "March 2025" in vintage["release"]
    assert vintage["engine_provenance"]["pull_request"] == 1305
    assert vintage["engine_matches_values_of_record"] is True
    assert vintage["drift"] == {}

    def drifted(index: str, year: int) -> float:
        return of_record[str(year)] + (0.001 if year == 2027 else 0.0)

    vintage = reviewed_vintage(POP, drifted)
    assert vintage["engine_matches_values_of_record"] is False
    assert set(vintage["drift"]) == {"2027"}
    assert vintage["drift"]["2027"]["of_record"] == of_record["2027"]

    assert reviewed_vintage(GDP, matching) is None


def test_audit_row_carries_the_reviewed_vintage_only_where_one_is_declared():
    audit = audit_uprating(
        indices=INDICES,
        growth=growth,
        metadata=metadata,
        base_year=2024,
        years=[2026, 2030],
        version="test",
    )
    weights = audit["variables"]["household_weight"]
    assert weights["reviewed_vintage"]["engine_provenance"]["commit"] == "b9efbaf8"
    # The synthetic 1% path is not the path of record, and the audit says so.
    assert weights["reviewed_vintage"]["engine_matches_values_of_record"] is False
    assert "reviewed_vintage" not in audit["variables"]["capital_gains"]
    # The fingerprint keys on the factors alone, so the vintage block cannot
    # move simulation ids.
    stripped = {
        **audit,
        "variables": {
            v: {k: val for k, val in row.items() if k != "reviewed_vintage"}
            for v, row in audit["variables"].items()
        },
    }
    assert projection_fingerprint(stripped) == projection_fingerprint(audit)
