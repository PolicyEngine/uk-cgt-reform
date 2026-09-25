"""Pure-logic tests for the reform spec and elasticity conversion (no
PolicyEngine needed)."""

import numpy as np
import pytest

from uk_cgt_reform.reform import (
    BURNHAM_RATES,
    ELASTICITY,
    ELASTICITY_PARAMETER,
    EXEMPT_AMOUNT_PARAMETER,
    EXPLORER_SCHEDULES,
    EXPLORER_SCOPE,
    OFFICIAL_ELASTICITY,
    OFFICIAL_RETENTION_ELASTICITY,
    PERIOD,
    RATE_BANDS,
    RETENTION_ELASTICITY_PARAMETER,
    SCHEDULES,
    burnham_reform,
    centax_1920_reforms,
    cgt_rate_reform,
    elasticity_assignment,
    rate_reform_schedules,
    reform_fingerprint,
    reform_schedules,
    retention_to_mtr_elasticity,
)


def test_burnham_rates_equal_income_tax_rates():
    assert BURNHAM_RATES == {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45}


def test_reform_dict_shape():
    reform = burnham_reform()
    assert reform["gov.hmrc.cgt.basic_rate"] == {PERIOD: 0.20}
    assert reform["gov.hmrc.cgt.higher_rate"] == {PERIOD: 0.40}
    assert reform["gov.hmrc.cgt.additional_rate"] == {PERIOD: 0.45}
    # The engine's ``elasticity`` parameter is the retention-rate convention;
    # the MTR value goes to ``mtr_elasticity`` and the other must stay unset.
    assert ELASTICITY_PARAMETER.endswith(".mtr_elasticity")
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert RETENTION_ELASTICITY_PARAMETER not in reform


def test_reform_fingerprint_tracks_the_definition():
    central = reform_fingerprint(burnham_reform())
    assert len(central) == 12
    # The definition the committed results were produced with; a change to
    # the rates, schedules or elasticity parameter moves it and must land
    # with regenerated results.
    assert central == "d33c3951fbea"
    assert central == reform_fingerprint(burnham_reform(ELASTICITY))
    assert central != reform_fingerprint(burnham_reform(0.0))


def test_reform_reaches_every_schedule():
    # policyengine-uk 2.99.0 charges residential property, carried interest
    # and BADR gains on their own schedules; equalisation must set them too.
    reform = burnham_reform()
    for schedule in SCHEDULES:
        for band, rate in BURNHAM_RATES.items():
            assert reform[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
    assert reform["gov.hmrc.cgt.badr.lifetime_limit"] == {PERIOD: 0}
    assert set(SCHEDULES) == {"residential_property", "carried_interest"}
    assert reform_schedules()["residential_property"] == BURNHAM_RATES
    assert reform_schedules()["badr_lifetime_limit"] == 0


def test_elasticity_override():
    reform = burnham_reform(elasticity=-1.4)
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: -1.4}


def test_retention_to_mtr_conversion_at_reformed_top_rates():
    # Advani/CenTax central retention e=1.0 at the reformed 40-45% rates is
    # an MTR elasticity of ~ -0.67 to -0.82, bracketing the -0.7 central case.
    lo = retention_to_mtr_elasticity(1.0, 0.40)
    hi = retention_to_mtr_elasticity(1.0, 0.45)
    assert np.isclose(lo, -2 / 3)
    assert np.isclose(hi, -0.45 / 0.55)
    assert hi < ELASTICITY < lo


def test_retention_to_mtr_is_negative_and_scales():
    assert retention_to_mtr_elasticity(0.0, 0.4) == 0.0
    assert retention_to_mtr_elasticity(2.0, 0.4) == pytest.approx(
        2 * retention_to_mtr_elasticity(1.0, 0.4)
    )


def test_retention_to_mtr_rejects_invalid_rates():
    with pytest.raises(ValueError):
        retention_to_mtr_elasticity(1.0, 1.0)
    with pytest.raises(ValueError):
        retention_to_mtr_elasticity(1.0, -0.1)


def test_burnham_fingerprints_are_pinned_to_the_cached_simulation_ids():
    # data/policyengine_datasets/<dataset>/*_burnham_e07_d33c3951fbea_<year>.h5
    # and the e=0 / e=-0.35 sensitivity outputs carry these digests; a change
    # here would silently orphan every cached output.
    assert reform_fingerprint(burnham_reform()) == "d33c3951fbea"
    assert reform_fingerprint(burnham_reform(0.0)) == "45576cc53935"
    assert reform_fingerprint(burnham_reform(-0.35)) == "885c3d31e932"


def test_burnham_reform_is_the_generic_builder_with_every_schedule():
    assert burnham_reform(-0.35) == cgt_rate_reform(
        BURNHAM_RATES, -0.35, schedules=SCHEDULES, badr_lifetime_limit=0
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
    assert RETENTION_ELASTICITY_PARAMETER not in reform
    assert rate_reform_schedules(rates) == {"residential_property": rates}


def test_cgt_rate_reform_requires_every_band():
    with pytest.raises(ValueError, match="missing"):
        cgt_rate_reform({"basic_rate": 0.18, "higher_rate": 0.3})


def test_official_elasticity_is_the_central_conversion_scaled():
    # -0.7 is CenTax's retention 1.0 at t = 7/17; the official 3.6 scales it.
    assert OFFICIAL_RETENTION_ELASTICITY == 3.6
    assert OFFICIAL_ELASTICITY == pytest.approx(3.6 * ELASTICITY)
    assert retention_to_mtr_elasticity(1.0, 7 / 17) == pytest.approx(ELASTICITY)
    assert (
        retention_to_mtr_elasticity(3.6, 0.45)
        < OFFICIAL_ELASTICITY
        < retention_to_mtr_elasticity(3.6, 0.40)
    )


def test_elasticity_assignment_routes_the_official_case_to_retention():
    assert elasticity_assignment(ELASTICITY) == {ELASTICITY_PARAMETER: ELASTICITY}
    assert elasticity_assignment(0.0) == {ELASTICITY_PARAMETER: 0.0}
    assert elasticity_assignment(OFFICIAL_ELASTICITY) == {RETENTION_ELASTICITY_PARAMETER: 3.6}
    official = burnham_reform(OFFICIAL_ELASTICITY)
    assert official[RETENTION_ELASTICITY_PARAMETER] == {PERIOD: 3.6}
    assert ELASTICITY_PARAMETER not in official


def test_centax_counterfactual_pair_is_pinned():
    baseline, reform = centax_1920_reforms()
    for band, rate in zip(RATE_BANDS, (0.10, 0.20, 0.20), strict=True):
        assert baseline[f"gov.hmrc.cgt.{band}"] == {PERIOD: rate}
    for schedule in SCHEDULES:
        for band, rate in zip(RATE_BANDS, (0.18, 0.28, 0.28), strict=True):
            assert baseline[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
    assert baseline[EXEMPT_AMOUNT_PARAMETER] == {PERIOD: 12_000}
    assert baseline[ELASTICITY_PARAMETER] == {PERIOD: 0.0}
    assert reform == {**burnham_reform(0.0), EXEMPT_AMOUNT_PARAMETER: {PERIOD: 12_000}}
    assert baseline["gov.hmrc.cgt.badr.rate"] == {PERIOD: 0.10}
    assert baseline["gov.hmrc.cgt.badr.lifetime_limit"] == {PERIOD: 1_000_000}
    assert reform_fingerprint(baseline) == "a2eab6466ee5"
    assert reform_fingerprint(reform) == "2367c58b5ba5"
