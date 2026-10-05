"""Pure-logic tests for the reform spec, the relief's treatment and the
behavioural convention (no PolicyEngine needed)."""

import pytest

from uk_cgt_reform.reform import (
    BADR_CURRENT_LAW,
    BADR_ELASTICITY_PARAMETER,
    BADR_LIFETIME_LIMIT_PARAMETER,
    BADR_LIFETIME_LIMITS,
    BADR_RATE_PARAMETER,
    BADR_WITHDRAWN,
    CARRIED_INTEREST_SCHEDULE,
    CENTAX_CENTRAL_ELASTICITY,
    CENTAX_LOWER_ELASTICITY,
    CENTAX_UPPER_ELASTICITY,
    ELASTICITY,
    ELASTICITY_PARAMETER,
    EXEMPT_AMOUNT_PARAMETER,
    EXPLORER_SCHEDULES,
    EXPLORER_SCOPE,
    INCOME_TAX_RATES,
    MTR_ELASTICITY_PARAMETER,
    MTR_FLOOR,
    OFFICIAL_ELASTICITY,
    PERIOD,
    POLICYENGINE_ELASTICITY,
    POLICYENGINE_ELASTICITY_URL,
    RATE_BANDS,
    SCHEDULE_STEPS,
    SCHEDULES,
    SEPARATE_BADR_ELASTICITY_PARAMETER,
    BadrPolicy,
    centax_1920_reforms,
    centax_1920_rules,
    cgt_rate_reform,
    elasticity_assignment,
    elasticity_convention,
    elasticity_form,
    equalisation_reform,
    equivalent_retention_elasticity,
    mtr_response,
    point_retention_elasticity,
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
    # The central case is PolicyEngine's elasticity against the marginal tax
    # rate, on the engine's marginal-tax-rate parameter; the retention-rate
    # parameter stays at zero.
    assert MTR_ELASTICITY_PARAMETER == "gov.simulation.capital_gains_responses.mtr_elasticity"
    assert reform[MTR_ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert ELASTICITY_PARAMETER not in reform


def test_the_central_case_is_policyengines_elasticity_against_the_marginal_rate():
    assert ELASTICITY == POLICYENGINE_ELASTICITY == -0.7
    assert POLICYENGINE_ELASTICITY_URL == (
        "https://www.policyengine.org/uk/research/behavioural-responses"
    )
    assert elasticity_form(ELASTICITY) == "mtr"
    assert elasticity_assignment(ELASTICITY) == {MTR_ELASTICITY_PARAMETER: -0.7}
    # One elasticity for every gain: the switch for gains qualifying for the
    # relief stays off.
    assert elasticity_convention(ELASTICITY) == {
        "elasticity_parameter": MTR_ELASTICITY_PARAMETER,
        "applied_as": "mtr",
        "applied_value": -0.7,
        "badr_elasticity": -0.7,
    }


def test_centax_and_official_cases_are_retention_elasticities():
    assert CENTAX_CENTRAL_ELASTICITY == 1.0
    assert (CENTAX_LOWER_ELASTICITY, CENTAX_UPPER_ELASTICITY) == (0.5, 2.0)
    assert OFFICIAL_ELASTICITY == 3.6
    # The static case and CenTax's: one elasticity for every gain, the
    # engine's default; the static case keeps the retention parameter at zero,
    # as before.
    for e in (
        0.0,
        CENTAX_LOWER_ELASTICITY,
        CENTAX_CENTRAL_ELASTICITY,
        CENTAX_UPPER_ELASTICITY,
    ):
        assert elasticity_form(e) == "retention"
        assert elasticity_assignment(e) == {ELASTICITY_PARAMETER: e}
        assert elasticity_convention(e) == {
            "elasticity_parameter": ELASTICITY_PARAMETER,
            "applied_as": "retention",
            "applied_value": e,
            "badr_elasticity": e,
        }
    # The official case: 3.6 for main-rate gains, 1.4 for gains qualifying
    # for the relief (OBR, January 2025), through the engine's switch.
    assert elasticity_form(OFFICIAL_ELASTICITY) == "retention"
    assert elasticity_assignment(OFFICIAL_ELASTICITY) == {
        ELASTICITY_PARAMETER: 3.6,
        SEPARATE_BADR_ELASTICITY_PARAMETER: True,
        BADR_ELASTICITY_PARAMETER: 1.4,
    }
    assert elasticity_convention(OFFICIAL_ELASTICITY)["badr_elasticity"] == 1.4
    reform = equalisation_reform(OFFICIAL_ELASTICITY)
    assert reform[SEPARATE_BADR_ELASTICITY_PARAMETER] == {PERIOD: True}
    assert reform[BADR_ELASTICITY_PARAMETER] == {PERIOD: 1.4}
    assert SEPARATE_BADR_ELASTICITY_PARAMETER not in equalisation_reform(ELASTICITY)


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


def test_mtr_response_is_the_engines_form():
    # PolicyEngine's -0.7 for gains moving from 24% to 45%: realised gains
    # scale by (45 / 24) ** -0.7 and the tax on them rises by about 21%.
    factor = mtr_response(-0.7, 0.24, 0.45)
    assert factor == pytest.approx((0.45 / 0.24) ** -0.7)
    assert factor * 0.45 / 0.24 - 1 == pytest.approx(0.2075, abs=1e-3)
    assert mtr_response(0.0, 0.24, 0.45) == 1.0
    # The engine floors each rate at 0.1% before taking logs, so a cut from
    # 24% to nothing multiplies realised gains by about 46.
    assert MTR_FLOOR == 0.001
    assert mtr_response(-0.7, 0.24, 0.0) == pytest.approx(240**0.7)
    assert mtr_response(-0.7, 0.24, 0.0) == pytest.approx(46.36, abs=0.01)
    with pytest.raises(ValueError):
        mtr_response(-0.7, 0.24, 1.0)


def test_the_marginal_rate_elasticity_as_a_retention_elasticity():
    # At one rate, e against the rate is -e * (1 - t) / t against the
    # retention rate: -0.7 equals CenTax's 1.0 only at t = 7/17.
    assert point_retention_elasticity(-0.7, 7 / 17) == pytest.approx(1.0)
    assert point_retention_elasticity(-0.7, 0.24) == pytest.approx(2.2167, abs=1e-4)
    assert point_retention_elasticity(-0.7, 0.45) == pytest.approx(0.8556, abs=1e-4)
    # Across a discrete change, the retention elasticity that moves realised
    # gains by the same factor: for this reform's changes, about 1.4, 1.5 and
    # 3.0.
    assert equivalent_retention_elasticity(-0.7, 0.24, 0.45) == pytest.approx(1.3606, abs=1e-4)
    assert equivalent_retention_elasticity(-0.7, 0.24, 0.40) == pytest.approx(1.5127, abs=1e-4)
    assert equivalent_retention_elasticity(-0.7, 0.18, 0.20) == pytest.approx(2.9868, abs=1e-4)
    for t0, t1 in ((0.24, 0.45), (0.24, 0.40), (0.18, 0.20), (0.24, 0.34), (0.24, 0.10)):
        e = equivalent_retention_elasticity(-0.7, t0, t1)
        assert retention_response(e, t0, t1) == pytest.approx(mtr_response(-0.7, t0, t1))
    assert equivalent_retention_elasticity(-0.7, 0.3, 0.3) == pytest.approx(
        point_retention_elasticity(-0.7, 0.3)
    )
    with pytest.raises(ValueError):
        point_retention_elasticity(-0.7, 0.0)


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
    assert central == "d408eb990ba5"
    assert central == reform_fingerprint(equalisation_reform(ELASTICITY))
    assert central != reform_fingerprint(equalisation_reform(0.0))


def test_equalisation_fingerprints_are_pinned_to_the_cached_simulation_ids():
    # data/policyengine_datasets/<dataset>/*_equalise_m070_<digest>_<year>.h5
    # and the static, CenTax and official outputs carry these digests; a
    # change here would silently orphan every cached output. The retention
    # cases keep the digests they had when CenTax's 1.0 was the central case.
    assert reform_fingerprint(equalisation_reform()) == "d408eb990ba5"
    assert reform_fingerprint(equalisation_reform(0.0)) == "4251e7185edd"
    assert reform_fingerprint(equalisation_reform(0.5)) == "7c1bb7e76aa7"
    assert reform_fingerprint(equalisation_reform(CENTAX_CENTRAL_ELASTICITY)) == "0dd9416217c3"


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
        "092db47bdd64",
        "7e316b10c179",
        "d408eb990ba5",
    ]
    # At CenTax's central case the steps keep the digests they had when it
    # was the central case.
    assert [reform_fingerprint(r) for _, _, r in schedule_step_reforms(1.0)] == [
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
    assert reform[MTR_ELASTICITY_PARAMETER] == {PERIOD: ELASTICITY}
    assert ELASTICITY_PARAMETER not in reform
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
