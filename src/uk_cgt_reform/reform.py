"""Reform specification and elasticity-convention helpers.

The "Burnham" reform — debated in the Labour leadership contest, associated
with Andy Burnham and backed by allies including Louise Haigh and Wes
Streeting — equalises CGT rates with income tax rates from 2026-27:

| Band       | Baseline CGT rate | Reformed rate (= income tax) |
|------------|-------------------|------------------------------|
| Basic      | 18%               | 20%                          |
| Higher     | 24%               | 40%                          |
| Additional | 24%               | 45%                          |

The annual exempt amount is unchanged at £3,000.

Schedules (policyengine-uk 2.99.0+): the engine charges residential
property gains, carried interest and gains qualifying for Business Asset
Disposal Relief on their own schedules when a dataset reports them, and a
reform that touches only ``gov.hmrc.cgt.{basic,higher,additional}_rate``
no longer reaches them. Equalising CGT with income tax means every gain,
whatever the asset, so the reform sets the residential property and
carried interest schedules to the same income tax rates and withdraws the
BADR lifetime limit (relief gains fall to the main schedule), the recipe
the engine's changelog gives for "tax every gain at income tax rates". On
a dataset without those columns the extra parameters are inert, so the
incumbent's results are unchanged by them.

Behavioural response — aligned with Arun Advani (CenTax). policyengine-uk
now carries two conventions: ``gov.simulation.capital_gains_responses.
elasticity`` is the elasticity of realisations with respect to the RETENTION
RATE (1 - t, positive, CenTax's own convention) and ``...mtr_elasticity`` the
elasticity with respect to the MARGINAL TAX RATE itself (negative); the two
may not both be set. This pipeline keeps the MTR convention it has always
reported (default 0 = static) and sets ``mtr_elasticity``.
Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of 1.0 with respect to the retention
rate (1 - t), sensitivity range 0.5-2.0, anchored on Agersnap & Zidar (2021)
and Lavecchia & Tazhitdinova (2024). Converting conventions
(``e_mtr = e_retention * t / (1 - t)``), Advani's central 1.0 at the reformed
40-45% top rates is an MTR elasticity of ~= -0.67 to -0.82. We use -0.7 as
the central case — also the value PolicyEngine used in its Autumn Budget 2024
CGT analysis.

Caveats: Advani's elasticity assumes accompanying base broadening
(death-uplift removal, exit charges) which we do not model, so behavioural
loss may be UNDERSTATED for a rate-only reform; and it is a medium-term
elasticity abstracting from short-run forestalling.
"""

from __future__ import annotations

import hashlib
import json
import math

YEARS = [2026, 2027, 2028, 2029, 2030]  # fiscal years 2026-27 .. 2030-31
# policyengine.py reform dicts take a single effective date per value and
# apply it open-endedly (equivalent to the old "2026-01-01.2035-12-31"
# range over the 2026-2030 window simulated here).
PERIOD = "2026-01-01"
# w.r.t. MTR, converted from CenTax's central retention elasticity of 1.0 at the
# reformed 40-45% rates. That conversion is exact only marginally: applied across
# the whole 24%->40% jump it is more responsive than CenTax's own convention
# (which implies ~-0.5 for a change this size). Matches PolicyEngine's own
# Autumn Budget 2024 CGT house assumption.
ELASTICITY = -0.7
# The engine parameter that carries it: the marginal-tax-rate convention.
# ``gov.simulation.capital_gains_responses.elasticity`` is the retention-rate
# convention (positive) and must stay at its default of zero.
ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.mtr_elasticity"
RETENTION_ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.elasticity"

# The official HMRC/OBR assumption for the main CGT rates: a retention-rate
# elasticity of 3.6 (OBR, "Costing of changes to the main, BADR and IR rates
# of CGT", January 2025, para 1.9). Its MTR-convention key is 3.6 times the
# central case, the same conversion that takes CenTax's 1.0 to -0.7.
OFFICIAL_RETENTION_ELASTICITY = 3.6
OFFICIAL_ELASTICITY = -2.52
# Cases the engine applies in the retention-rate convention, keyed by their
# MTR-convention value. The engine's MTR form scales realised gains by
# (t1 / t0) ** e, so at -2.52 every rate rise would lose revenue, the lower
# rate included; the retention form, ((1 - t1) / (1 - t0)) ** 3.6, is the
# convention the OBR states the assumption in.
RETENTION_NATIVE = {OFFICIAL_ELASTICITY: OFFICIAL_RETENTION_ELASTICITY}

# Reformed CGT rates, equal to the income tax rates for each band.
BURNHAM_RATES = {
    "basic_rate": 0.20,  # from 18%
    "higher_rate": 0.40,  # from 24%
    "additional_rate": 0.45,  # from 24%
}

# Schedules the engine charges separately (policyengine-uk 2.99.0+). Each
# takes the same income tax rates as the main schedule.
SCHEDULES = ("residential_property", "carried_interest")

# Business Asset Disposal Relief: the lifetime limit goes to zero, so
# qualifying gains are charged on the main schedule at the reformed rates.
BADR_LIFETIME_LIMIT = 0


# The three rate bands every CGT schedule carries, in the engine's order.
RATE_BANDS = ("basic_rate", "higher_rate", "additional_rate")

# The rate explorer's scope. A chosen schedule reaches the main rates and the
# residential property schedule, which the law aligned with the main rates
# from April 2025; carried interest (32% flat) and Business Asset Disposal
# Relief (lifetime limit and its own rate) stay at current law, because no
# registered dataset records those gains and any treatment would be inert
# today. Widening the scope once the data supports it is a repo issue.
EXPLORER_SCHEDULES = ("residential_property",)
EXPLORER_SCOPE = "main_and_residential"

EXEMPT_AMOUNT_PARAMETER = "gov.hmrc.cgt.annual_exempt_amount"

# The rules CenTax's rates-only estimate starts from (Advani, Lonsdale and
# Summers 2024, Table 3: 2019/20). Applied to this repo's data as a static
# counterfactual, so the percentage uplift is comparable with theirs.
CENTAX_1920_MAIN_RATES = {"basic_rate": 0.10, "higher_rate": 0.20, "additional_rate": 0.20}
CENTAX_1920_SCHEDULE_RATES = {"basic_rate": 0.18, "higher_rate": 0.28, "additional_rate": 0.28}
CENTAX_1920_EXEMPT_AMOUNT = 12_000


def elasticity_assignment(elasticity: float) -> dict[str, float]:
    """The engine parameter (and value) that carries a behavioural case: the
    MTR convention, or the retention convention for :data:`RETENTION_NATIVE`
    cases. The two may not both be nonzero."""
    for key, retention in RETENTION_NATIVE.items():
        if math.isclose(elasticity, key, abs_tol=1e-9):
            return {RETENTION_ELASTICITY_PARAMETER: retention}
    return {ELASTICITY_PARAMETER: elasticity}


def cgt_rate_reform(
    rates: dict,
    elasticity: float = ELASTICITY,
    *,
    schedules: tuple[str, ...] = EXPLORER_SCHEDULES,
    badr_lifetime_limit: float | None = None,
) -> dict:
    """A CGT rate schedule as a PolicyEngine parametric reform dict.

    ``rates`` maps every band in :data:`RATE_BANDS` to its reformed rate. The
    main schedule and each schedule in ``schedules`` take those rates; the
    BADR lifetime limit is set only when ``badr_lifetime_limit`` is given.
    The behavioural elasticity goes to the parameter
    :func:`elasticity_assignment` names (:data:`ELASTICITY_PARAMETER`
    unless the case is retention-native).
    """
    missing = [band for band in RATE_BANDS if band not in rates]
    if missing:
        raise ValueError(f"rates must name every band in {RATE_BANDS}; missing {missing}")
    reform = {f"gov.hmrc.cgt.{band}": {PERIOD: rates[band]} for band in RATE_BANDS}
    for schedule in schedules:
        for band in RATE_BANDS:
            reform[f"gov.hmrc.cgt.{schedule}.{band}"] = {PERIOD: rates[band]}
    if badr_lifetime_limit is not None:
        reform["gov.hmrc.cgt.badr.lifetime_limit"] = {PERIOD: badr_lifetime_limit}
    for parameter, value in elasticity_assignment(elasticity).items():
        reform[parameter] = {PERIOD: value}
    return reform


def burnham_reform(elasticity: float = ELASTICITY) -> dict:
    """The Burnham reform as a PolicyEngine parametric reform dict: every
    schedule takes the income tax rates and the BADR lifetime limit goes to
    zero. The dict is the one the cached simulation ids were minted from, so
    its fingerprint is pinned in the tests."""
    return cgt_rate_reform(
        BURNHAM_RATES,
        elasticity,
        schedules=SCHEDULES,
        badr_lifetime_limit=BADR_LIFETIME_LIMIT,
    )


def centax_1920_reforms() -> tuple[dict, dict]:
    """The static counterfactual pair for the CenTax rates-only benchmark:
    2019/20 rules (main 10/20, residential and carried interest 18/28, a
    £12,000 exempt amount) and the same rules with every schedule at income
    tax rates and the BADR lifetime limit at zero. Both at e = 0, so each is
    exact against the current-law baseline and their difference is the
    uplift from equalising at 2019/20 rules."""
    exempt = {EXEMPT_AMOUNT_PARAMETER: {PERIOD: CENTAX_1920_EXEMPT_AMOUNT}}
    baseline = cgt_rate_reform(CENTAX_1920_MAIN_RATES, 0.0, schedules=())
    for schedule in SCHEDULES:
        for band in RATE_BANDS:
            baseline[f"gov.hmrc.cgt.{schedule}.{band}"] = {PERIOD: CENTAX_1920_SCHEDULE_RATES[band]}
    return {**baseline, **exempt}, {**burnham_reform(0.0), **exempt}


def centax_1920_rules() -> dict:
    """The counterfactual's rules, for the results metadata."""
    return {
        "baseline": {
            "main": dict(CENTAX_1920_MAIN_RATES),
            **{schedule: dict(CENTAX_1920_SCHEDULE_RATES) for schedule in SCHEDULES},
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "reform": {
            "main": dict(BURNHAM_RATES),
            **{schedule: dict(BURNHAM_RATES) for schedule in SCHEDULES},
            "badr_lifetime_limit": BADR_LIFETIME_LIMIT,
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "elasticity": 0.0,
    }


def reform_fingerprint(reform: dict) -> str:
    """Short digest of a reform dict, folded into simulation ids so a change
    in the reform definition cannot reuse cached simulation outputs."""
    payload = json.dumps(reform, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:12]


def reform_schedules() -> dict:
    """The schedule part of the Burnham reform, for the results metadata."""
    return {
        **{schedule: dict(BURNHAM_RATES) for schedule in SCHEDULES},
        "badr_lifetime_limit": BADR_LIFETIME_LIMIT,
    }


def rate_reform_schedules(rates: dict, schedules: tuple[str, ...] = EXPLORER_SCHEDULES) -> dict:
    """The schedule part of a rate reform built by :func:`cgt_rate_reform`
    with no BADR change, for the explorer's results metadata."""
    return {schedule: {band: rates[band] for band in RATE_BANDS} for schedule in schedules}


def retention_to_mtr_elasticity(e_retention: float, tax_rate: float) -> float:
    """Convert a retention-rate elasticity (Advani/CenTax convention) to
    PolicyEngine's marginal-tax-rate convention.

    ``e_mtr = -e_retention * t / (1 - t)``: a positive elasticity of gains
    with respect to the retention rate (1 - t) is a NEGATIVE elasticity with
    respect to the tax rate t itself.
    """
    if not 0.0 <= tax_rate < 1.0:
        raise ValueError(f"tax rate {tax_rate} outside [0, 1)")
    return -e_retention * tax_rate / (1.0 - tax_rate)
