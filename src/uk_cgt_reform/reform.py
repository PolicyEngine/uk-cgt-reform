"""Reform specification and elasticity-convention helpers.

The equalisation reform charges capital gains at income tax rates from
2026-27. Wes Streeting proposed the rate change in May 2026, alongside
closing loopholes and an exemption for genuine entrepreneurs; CenTax
(Advani, Lonsdale and Summers 2024) costs it inside a wider package that
also reforms the CGT base. This module models the rate change:

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

Behavioural response, in CenTax's convention. Advani, Lonsdale and Summers
(CenTax, October 2024, *Reforming Capital Gains Tax*) estimate how realised
gains respond to the retention rate, the share 1 - t of a marginal pound of
gain the taxpayer keeps: a central medium-term elasticity of 1.0, with a
range of 0.5 to 2.0, anchored on Agersnap and Zidar (2021) and Lavecchia and
Tazhitdinova (2024). The HMRC/OBR assumption is stated in the same
convention: 3.6 for the main rates and 1.4 for BADR (OBR, January 2025, para
1.9). policyengine-uk's ``gov.simulation.capital_gains_responses.elasticity``
applies an elasticity in exactly that form: realised gains scale by
((1 - t1) / (1 - t0)) ** e, with t each person's marginal rate on gains
before and after the reform. Every case here sets that parameter and leaves
the engine's marginal-tax-rate parameter (``...mtr_elasticity``) at zero.

The pipeline once converted CenTax's 1.0 into a marginal-tax-rate elasticity
of -0.7 at the reformed 40-45% rates. The conversion holds only for small
changes: across the reform's jumps -0.7 behaves like a retention elasticity
of about 1.4 (24% to 45%), 1.5 (24% to 40%) and 3.0 (18% to 20%), so it
understated the yield CenTax's own assumption implies.

Caveats: CenTax's elasticity belongs to a package that also removes the
uplift at death and charges gains on departure, closing two ways of
deferring or avoiding the tax, which this repo does not model. CenTax
expect a larger response to a rate rise on the current base, and advise
against equalising rates without the base reforms (*Taxes at the top*,
September 2026, p.17); the upper end of the range and the official case
show how much of the yield rests on the assumption. The elasticity is
medium-term and abstracts from short-run forestalling.
"""

from __future__ import annotations

import hashlib
import json

YEARS = [2026, 2027, 2028, 2029, 2030]  # fiscal years 2026-27 .. 2030-31
# policyengine.py reform dicts take a single effective date per value and
# apply it open-endedly (equivalent to the old "2026-01-01.2035-12-31"
# range over the 2026-2030 window simulated here).
PERIOD = "2026-01-01"
# Elasticities of realised gains with respect to the retention rate (1 - t),
# the convention CenTax and the OBR state them in. CenTax's central case and
# its range (Advani, Lonsdale and Summers 2024, Table 6):
ELASTICITY = 1.0
CENTAX_LOWER_ELASTICITY = 0.5
CENTAX_UPPER_ELASTICITY = 2.0
# The official HMRC/OBR assumption for the main CGT rates (OBR, "Costing of
# changes to the main, BADR and IR rates of CGT", January 2025, para 1.9).
OFFICIAL_ELASTICITY = 3.6
# The engine parameter that carries every case: the retention-rate form,
# realised gains scaled by ((1 - t1) / (1 - t0)) ** e. The engine's
# marginal-tax-rate parameter stays at its default of zero; the two may not
# both be set.
ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.elasticity"
MTR_ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.mtr_elasticity"

# Reformed CGT rates, equal to the income tax rates for each band.
INCOME_TAX_RATES = {
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
# Business Asset Disposal Relief (then Entrepreneurs' Relief) charged 10% in
# 2019/20; CenTax's baseline applies the £1m lifetime limit of March 2020.
# Investors' Relief has no engine parameter. Neither registered dataset
# records BADR or Investors' Relief gains, so both settings are inert here.
CENTAX_1920_BADR_RATE = 0.10
CENTAX_1920_BADR_LIFETIME_LIMIT = 1_000_000


def elasticity_assignment(elasticity: float) -> dict[str, float]:
    """The engine parameter (and value) that carries a behavioural case: the
    retention-rate elasticity, applied as stated."""
    return {ELASTICITY_PARAMETER: elasticity}


def elasticity_convention(elasticity: float) -> dict:
    """How a behavioural case is applied: the engine parameter it sets, the
    convention and the value the engine receives. Every output that reports
    a case carries these."""
    [(parameter, value)] = elasticity_assignment(elasticity).items()
    return {
        "elasticity_parameter": parameter,
        "applied_as": "retention",
        "applied_value": value,
    }


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


def equalisation_reform(elasticity: float = ELASTICITY) -> dict:
    """The equalisation reform as a PolicyEngine parametric reform dict: every
    schedule takes the income tax rates and the BADR lifetime limit goes to
    zero. The dict is the one the cached simulation ids were minted from, so
    its fingerprint is pinned in the tests."""
    return cgt_rate_reform(
        INCOME_TAX_RATES,
        elasticity,
        schedules=SCHEDULES,
        badr_lifetime_limit=BADR_LIFETIME_LIMIT,
    )


def centax_1920_reforms() -> tuple[dict, dict]:
    """The static counterfactual pair for the CenTax rates-only benchmark:
    2019/20 rules (main 10/20, residential and carried interest 18/28, BADR
    at 10% with a £1m lifetime limit, a £12,000 exempt amount) and the same
    rules with every schedule at income tax rates and the BADR lifetime limit
    at zero. Both at e = 0, so each is exact against the current-law baseline
    and their difference is the uplift from equalising at 2019/20 rules."""
    exempt = {EXEMPT_AMOUNT_PARAMETER: {PERIOD: CENTAX_1920_EXEMPT_AMOUNT}}
    baseline = cgt_rate_reform(CENTAX_1920_MAIN_RATES, 0.0, schedules=())
    for schedule in SCHEDULES:
        for band in RATE_BANDS:
            baseline[f"gov.hmrc.cgt.{schedule}.{band}"] = {PERIOD: CENTAX_1920_SCHEDULE_RATES[band]}
    baseline["gov.hmrc.cgt.badr.rate"] = {PERIOD: CENTAX_1920_BADR_RATE}
    baseline["gov.hmrc.cgt.badr.lifetime_limit"] = {PERIOD: CENTAX_1920_BADR_LIFETIME_LIMIT}
    return {**baseline, **exempt}, {**equalisation_reform(0.0), **exempt}


def centax_1920_rules() -> dict:
    """The counterfactual's rules, for the results metadata."""
    return {
        "baseline": {
            "main": dict(CENTAX_1920_MAIN_RATES),
            **{schedule: dict(CENTAX_1920_SCHEDULE_RATES) for schedule in SCHEDULES},
            "badr": {
                "rate": CENTAX_1920_BADR_RATE,
                "lifetime_limit": CENTAX_1920_BADR_LIFETIME_LIMIT,
            },
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "reform": {
            "main": dict(INCOME_TAX_RATES),
            **{schedule: dict(INCOME_TAX_RATES) for schedule in SCHEDULES},
            "badr_lifetime_limit": BADR_LIFETIME_LIMIT,
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "elasticity": 0.0,
        "not_modelled": (
            "Investors' Relief, which CenTax's Table 3 also abolishes, has no engine "
            "parameter. Neither registered dataset records BADR or Investors' Relief "
            "gains, so the BADR settings and the missing Investors' Relief are inert here."
        ),
    }


def reform_fingerprint(reform: dict) -> str:
    """Short digest of a reform dict, folded into simulation ids so a change
    in the reform definition cannot reuse cached simulation outputs."""
    payload = json.dumps(reform, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:12]


def reform_schedules() -> dict:
    """The schedule part of the equalisation reform, for the results metadata."""
    return {
        **{schedule: dict(INCOME_TAX_RATES) for schedule in SCHEDULES},
        "badr_lifetime_limit": BADR_LIFETIME_LIMIT,
    }


def rate_reform_schedules(rates: dict, schedules: tuple[str, ...] = EXPLORER_SCHEDULES) -> dict:
    """The schedule part of a rate reform built by :func:`cgt_rate_reform`
    with no BADR change, for the explorer's results metadata."""
    return {schedule: {band: rates[band] for band in RATE_BANDS} for schedule in schedules}


def retention_response(e_retention: float, t0: float, t1: float) -> float:
    """The factor by which realised gains scale when a marginal rate on gains
    moves from ``t0`` to ``t1``, at a retention-rate elasticity: the form
    the engine applies, ((1 - t1) / (1 - t0)) ** e."""
    for rate in (t0, t1):
        if not 0.0 <= rate < 1.0:
            raise ValueError(f"tax rate {rate} outside [0, 1)")
    return ((1.0 - t1) / (1.0 - t0)) ** e_retention
