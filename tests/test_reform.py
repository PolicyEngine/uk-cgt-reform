"""Pure-logic tests for the reform spec and the behavioural convention (no
PolicyEngine needed)."""

import pytest

from uk_cgt_reform.reform import (
    CENTAX_LOWER_ELASTICITY,
    CENTAX_UPPER_ELASTICITY,
    ELASTICITY,
    ELASTICITY_PARAMETER,
    EXEMPT_AMOUNT_PARAMETER,
    EXPLORER_SCHEDULES,
    EXPLORER_SCOPE,
    INCOME_TAX_RATES,
    MTR_ELASTICITY_PARAMETER,
    OFFICIAL_ELASTICITY,
    PERIOD,
    RATE_BANDS,
    SCHEDULES,
    centax_1920_reforms,
    cgt_rate_reform,
    elasticity_assignment,
    elasticity_convention,
    equalisation_reform,
    rate_reform_schedules,
    reform_fingerprint,
    reform_schedules,
    retention_response,
)


def test_income_tax_rates():
    assert INCOME_TAX_RATES == {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45}


def test_reform_dict_shape():
    reform = equalisation_reform()
    assert reform["gov.hmrc.cgt.basic_rate"] == {PERIOD: 0.20}
    assert reform["gov.hmrc.cgt.higher_rate"] == {PERIOD: 0.40}
    assert reform["gov.hmrc.cgt.additional_rate"] == {PERIOD: 0.45}
    # Every case is a retention-rate elasticity on the engine's retention
    # parameter; the marginal-tax-rate parameter stays at zero.
    assert ELASTICITY_PARAMETER == "gov.simulation.capital_gains_responses.elasticity"
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert MTR_ELASTICITY_PARAMETER not in reform


def test_behavioural_cases_are_centax_and_official_retention_elasticities():
    assert ELASTICITY == 1.0
    assert (CENTAX_LOWER_ELASTICITY, CENTAX_UPPER_ELASTICITY) == (0.5, 2.0)
    assert OFFICIAL_ELASTICITY == 3.6
    for e in (0.0, CENTAX_LOWER_ELASTICITY, ELASTICITY, CENTAX_UPPER_ELASTICITY, 3.6):
        assert elasticity_assignment(e) == {ELASTICITY_PARAMETER: e}
        assert elasticity_convention(e) == {
            "elasticity_parameter": ELASTICITY_PARAMETER,
            "applied_as": "retention",
            "applied_value": e,
        }


def test_retention_response_is_the_engines_form():
    # CenTax's central 1.0 for gains moving from 24% to 45%: realised gains
    # scale by 0.55 / 0.76 and the tax on them rises by about 36%.
    factor = retention_response(1.0, 0.24, 0.45)
    assert factor == pytest.approx(0.55 / 0.76)
    assert factor * 0.45 / 0.24 - 1 == pytest.approx(0.357, abs=1e-3)
    assert retention_response(0.0, 0.24, 0.45) == 1.0
    assert retention_response(3.6, 0.24, 0.34) == pytest.approx((0.66 / 0.76) ** 3.6)
    with pytest.raises(ValueError):
        retention_response(1.0, 0.24, 1.0)
    with pytest.raises(ValueError):
        retention_response(1.0, -0.1, 0.2)


def test_reform_fingerprint_tracks_the_definition():
    central = reform_fingerprint(equalisation_reform())
    assert len(central) == 12
    # The definition the committed results were produced with; a change to
    # the rates, schedules or elasticity moves it and must land with
    # regenerated results.
    assert central == "3747239bfd6d"
    assert central == reform_fingerprint(equalisation_reform(ELASTICITY))
    assert central != reform_fingerprint(equalisation_reform(0.0))


def test_reform_reaches_every_schedule():
    # policyengine-uk 2.99.0 charges residential property, carried interest
    # and BADR gains on their own schedules; equalisation must set them too.
    reform = equalisation_reform()
    for schedule in SCHEDULES:
        for band, rate in INCOME_TAX_RATES.items():
            assert reform[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
    assert reform["gov.hmrc.cgt.badr.lifetime_limit"] == {PERIOD: 0}
    assert set(SCHEDULES) == {"residential_property", "carried_interest"}
    assert reform_schedules()["residential_property"] == INCOME_TAX_RATES
    assert reform_schedules()["badr_lifetime_limit"] == 0


def test_elasticity_override():
    reform = equalisation_reform(elasticity=2.0)
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: 2.0}


def test_equalisation_fingerprints_are_pinned_to_the_cached_simulation_ids():
    # data/policyengine_datasets/<dataset>/*_equalise_r100_<digest>_<year>.h5
    # and the static and lower-case outputs carry these digests; a change
    # here would silently orphan every cached output.
    assert reform_fingerprint(equalisation_reform()) == "3747239bfd6d"
    assert reform_fingerprint(equalisation_reform(0.0)) == "4279d953e1f2"
    assert reform_fingerprint(equalisation_reform(0.5)) == "caed5a84baa3"


def test_equalisation_reform_is_the_generic_builder_with_every_schedule():
    assert equalisation_reform(0.5) == cgt_rate_reform(
        INCOME_TAX_RATES, 0.5, schedules=SCHEDULES, badr_lifetime_limit=0
    )


def test_explorer_reform_reaches_main_and_residential_only():
    rates = {"basic_rate": 0.18, "higher_rate": 0.30, "additional_rate": 0.30}
    reform = cgt_rate_reform(rates)
    assert RATE_BANDS == ("basic_rate", "higher_rate", "additional_rate")
    assert EXPLORER_SCHEDULES == ("residential_property",)
    assert EXPLORER_SCOPE == "main_and_residential"
    for band, rate in rates.items():
        assert reform[f"gov.hmrc.cgt.{band}"] == {PERIOD: rate}
        assert reform[f"gov.hmrc.cgt.residential_property.{band}"] == {PERIOD: rate}
    assert not any("carried_interest" in key or "badr" in key for key in reform)
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert MTR_ELASTICITY_PARAMETER not in reform
    assert rate_reform_schedules(rates) == {"residential_property": rates}


def test_cgt_rate_reform_requires_every_band():
    with pytest.raises(ValueError, match="missing"):
        cgt_rate_reform({"basic_rate": 0.18, "higher_rate": 0.3})


def test_official_case_uses_the_same_parameter():
    official = equalisation_reform(OFFICIAL_ELASTICITY)
    assert official[ELASTICITY_PARAMETER] == {PERIOD: 3.6}
    assert MTR_ELASTICITY_PARAMETER not in official


def test_centax_counterfactual_pair_is_pinned():
    baseline, reform = centax_1920_reforms()
    for band, rate in zip(RATE_BANDS, (0.10, 0.20, 0.20), strict=True):
        assert baseline[f"gov.hmrc.cgt.{band}"] == {PERIOD: rate}
    for schedule in SCHEDULES:
        for band, rate in zip(RATE_BANDS, (0.18, 0.28, 0.28), strict=True):
            assert baseline[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
    assert baseline[EXEMPT_AMOUNT_PARAMETER] == {PERIOD: 12_000}
    assert baseline[ELASTICITY_PARAMETER] == {PERIOD: 0.0}
    assert reform == {**equalisation_reform(0.0), EXEMPT_AMOUNT_PARAMETER: {PERIOD: 12_000}}
    assert baseline["gov.hmrc.cgt.badr.rate"] == {PERIOD: 0.10}
    assert baseline["gov.hmrc.cgt.badr.lifetime_limit"] == {PERIOD: 1_000_000}
    assert reform_fingerprint(baseline) == "ba8930723c88"
    assert reform_fingerprint(reform) == "2d0382e29869"
