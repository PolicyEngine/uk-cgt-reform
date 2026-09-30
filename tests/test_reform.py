"""Pure-logic tests for the reform spec, the relief's treatment and the
behavioural convention (no PolicyEngine needed)."""

import pytest

from uk_cgt_reform.reform import (
    BADR_CURRENT_LAW,
    BADR_LIFETIME_LIMIT_PARAMETER,
    BADR_LIFETIME_LIMITS,
    BADR_RATE_PARAMETER,
    BADR_WITHDRAWN,
    CARRIED_INTEREST_SCHEDULE,
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
    SCHEDULE_STEPS,
    SCHEDULES,
    BadrPolicy,
    centax_1920_reforms,
    centax_1920_rules,
    cgt_rate_reform,
    elasticity_assignment,
    elasticity_convention,
    equalisation_reform,
    rate_reform_schedules,
    reform_fingerprint,
    reform_schedules,
    retention_response,
    schedule_step_reforms,
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


# --- the schedules and the relief ---------------------------------------------


def test_equalisation_moves_residential_withdraws_the_relief_and_leaves_carried_interest():
    reform = equalisation_reform()
    assert SCHEDULES == ("residential_property",)
    for band, rate in INCOME_TAX_RATES.items():
        assert reform[f"gov.hmrc.cgt.residential_property.{band}"] == {PERIOD: rate}
    # Withdrawn: the lifetime limit goes to zero, so qualifying gains take
    # the reformed main rates.
    assert reform[BADR_LIFETIME_LIMIT_PARAMETER] == {PERIOD: 0}
    assert BADR_RATE_PARAMETER not in reform
    # Carried interest has been taxed as income since April 2026.
    assert not any(CARRIED_INTEREST_SCHEDULE in key for key in reform)
    assert reform_schedules() == {
        "residential_property": INCOME_TAX_RATES,
        "badr": {"withdrawn": True, "rate": None, "lifetime_limit": None},
    }


def test_badr_policy_writes_only_what_differs_from_current_law():
    assert BADR_CURRENT_LAW.is_current_law
    assert BADR_CURRENT_LAW.parameters() == {}
    assert BADR_CURRENT_LAW.to_dict() == {
        "withdrawn": False,
        "rate": 0.18,
        "lifetime_limit": 1_000_000,
    }
    assert BADR_WITHDRAWN.parameters() == {BADR_LIFETIME_LIMIT_PARAMETER: {PERIOD: 0}}
    assert not BADR_WITHDRAWN.is_current_law
    assert BadrPolicy(rate=0.23).parameters() == {BADR_RATE_PARAMETER: {PERIOD: 0.23}}
    assert BadrPolicy(lifetime_limit=500_000).parameters() == {
        BADR_LIFETIME_LIMIT_PARAMETER: {PERIOD: 500_000}
    }
    assert BADR_LIFETIME_LIMITS == (500_000, 1_000_000, 10_000_000)


def test_keeping_the_relief_changes_only_the_relief():
    kept = equalisation_reform(badr=BADR_CURRENT_LAW)
    withdrawn = equalisation_reform()
    assert set(withdrawn) - set(kept) == {BADR_LIFETIME_LIMIT_PARAMETER}
    assert {k: v for k, v in withdrawn.items() if k in kept} == kept


def test_reform_fingerprint_tracks_the_definition():
    central = reform_fingerprint(equalisation_reform())
    assert len(central) == 12
    # The definition the committed results were produced with; a change to
    # the rates, schedules, relief or elasticity moves it and must land with
    # regenerated results.
    assert central == "0dd9416217c3"
    assert central == reform_fingerprint(equalisation_reform(ELASTICITY))
    assert central != reform_fingerprint(equalisation_reform(0.0))


def test_equalisation_fingerprints_are_pinned_to_the_cached_simulation_ids():
    # data/policyengine_datasets/<dataset>/*_equalise_r100_<digest>_<year>.h5
    # and the static and lower-case outputs carry these digests; a change
    # here would silently orphan every cached output.
    assert reform_fingerprint(equalisation_reform()) == "0dd9416217c3"
    assert reform_fingerprint(equalisation_reform(0.0)) == "4251e7185edd"
    assert reform_fingerprint(equalisation_reform(0.5)) == "7c1bb7e76aa7"


def test_elasticity_override():
    reform = equalisation_reform(elasticity=2.0)
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: 2.0}


def test_equalisation_reform_is_the_generic_builder():
    assert equalisation_reform(0.5) == cgt_rate_reform(
        INCOME_TAX_RATES, 0.5, schedules=SCHEDULES, badr=BADR_WITHDRAWN
    )


def test_schedule_steps_build_up_to_the_reform():
    steps = schedule_step_reforms(ELASTICITY)
    assert [step for step, _, _ in steps] == [s for s, _, _, _ in SCHEDULE_STEPS]
    assert [step for step, _, _ in steps] == ["main_rates", "residential", "badr_withdrawn"]
    main, residential, withdrawn = (reform for _, _, reform in steps)
    assert withdrawn == equalisation_reform(ELASTICITY)
    assert residential == equalisation_reform(ELASTICITY, badr=BADR_CURRENT_LAW)
    assert not any("residential_property" in key or "badr" in key for key in main)
    assert [reform_fingerprint(r) for r in (main, residential, withdrawn)] == [
        "b6104c1f31ec",
        "a35352e11262",
        "0dd9416217c3",
    ]


def test_explorer_reform_reaches_main_residential_and_the_relief():
    rates = {"basic_rate": 0.18, "higher_rate": 0.30, "additional_rate": 0.30}
    reform = cgt_rate_reform(rates)
    assert RATE_BANDS == ("basic_rate", "higher_rate", "additional_rate")
    assert EXPLORER_SCHEDULES == SCHEDULES
    assert EXPLORER_SCOPE == "main_residential_and_badr"
    for band, rate in rates.items():
        assert reform[f"gov.hmrc.cgt.{band}"] == {PERIOD: rate}
        assert reform[f"gov.hmrc.cgt.residential_property.{band}"] == {PERIOD: rate}
    # At current law the relief adds nothing to the dict.
    assert not any("carried_interest" in key or "badr" in key for key in reform)
    assert reform[ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert MTR_ELASTICITY_PARAMETER not in reform
    assert rate_reform_schedules(rates) == {
        "residential_property": rates,
        "badr": BADR_CURRENT_LAW.to_dict(),
    }
    kept_at_23 = cgt_rate_reform(rates, badr=BadrPolicy(rate=0.23))
    assert kept_at_23[BADR_RATE_PARAMETER] == {PERIOD: 0.23}


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
    for schedule in (*SCHEDULES, CARRIED_INTEREST_SCHEDULE):
        for band, rate in zip(RATE_BANDS, (0.18, 0.28, 0.28), strict=True):
            assert baseline[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
        for band, rate in INCOME_TAX_RATES.items():
            # CenTax's rates-only reform charges every asset, carried
            # interest included, at income tax rates (2019/20 world).
            assert reform[f"gov.hmrc.cgt.{schedule}.{band}"] == {PERIOD: rate}
    assert baseline[EXEMPT_AMOUNT_PARAMETER] == {PERIOD: 12_000}
    assert baseline[ELASTICITY_PARAMETER] == {PERIOD: 0.0}
    assert baseline[BADR_RATE_PARAMETER] == {PERIOD: 0.10}
    assert baseline[BADR_LIFETIME_LIMIT_PARAMETER] == {PERIOD: 1_000_000}
    assert reform[BADR_LIFETIME_LIMIT_PARAMETER] == {PERIOD: 0}
    assert reform_fingerprint(baseline) == "ba8930723c88"
    assert reform_fingerprint(reform) == "2d0382e29869"
    rules = centax_1920_rules()
    assert rules["reform"]["badr"] == BADR_WITHDRAWN.to_dict()
    assert set(rules["reform"]) >= {"residential_property", "carried_interest"}
