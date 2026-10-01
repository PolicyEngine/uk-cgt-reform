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
no longer reaches them. The reform sets the residential property schedule
to the same income tax rates and withdraws Business Asset Disposal Relief
(the lifetime limit goes to zero, so qualifying gains fall to the main
schedule), as CenTax's rates-only estimate does; :class:`BadrPolicy` keeps
the relief instead, at a rate and limit, for the Rate explorer and the
split of the yield by schedule. Carried interest has been taxed as income
since 6 April 2026 and is left where it is. On a dataset without those
columns the extra parameters are inert.

Behavioural response: PolicyEngine's elasticity. The central case is the
capital gains elasticity PolicyEngine has used by default since November
2024, -0.7: the elasticity of realised gains with respect to the marginal
tax rate on them, so a 10% rise in the rate (24% to 26.4%, say) lowers
realised gains by about 7% ("How PolicyEngine UK models behavioural
responses", :data:`POLICYENGINE_ELASTICITY_URL`). With no UK estimates to
draw on, it rests on US evidence: Dowd and McClelland (2019) estimate -0.79
from US federal and state tax returns for 1999-2008, and Auten and
Clotfelter (1982) -0.37 for a permanent change in the rate and -1.05 for a
transitory one. PolicyEngine took a slightly smaller response than the US
overall estimate, judging UK gains less responsive: the US has more tax-advantaged
investment vehicles, more generous treatment of real estate, a more active
trading culture and scope to move investments between state tax
jurisdictions. policyengine-uk applies it through
``gov.simulation.capital_gains_responses.mtr_elasticity``: realised gains
scale by (t1 / t0) ** e, with t each person's marginal rate on gains before
and after the reform, each floored at 0.1%.

The other cases are stated against the retention rate, the share 1 - t of a
marginal pound of gain the taxpayer keeps. Advani, Lonsdale and Summers
(CenTax, October 2024, *Reforming Capital Gains Tax*) use a central
medium-term elasticity of 1.0, with a range of 0.5 to 2.0, anchored on
Agersnap and Zidar (2021) and Lavecchia and Tazhitdinova (2024); the HMRC/OBR
assumption is 3.6 for the main rates and 1.4 for BADR (OBR, January 2025,
para 1.9). They set ``gov.simulation.capital_gains_responses.elasticity``,
which scales realised gains by ((1 - t1) / (1 - t0)) ** e. A case sets one
of the two parameters and leaves the other at zero: a negative value is an
elasticity against the marginal rate, zero or a positive value one against
the retention rate (:func:`elasticity_form`).

The two forms agree only near one rate. At a rate t, an elasticity e against
the rate equals a retention elasticity of -e * (1 - t) / t
(:func:`point_retention_elasticity`): -0.7 is 1.0 at t = 7/17 (about 41%),
2.2 at today's 24% and 0.86 at 45%. Across a discrete change, the
equivalent is the retention elasticity that moves realised gains by the same
factor (:func:`equivalent_retention_elasticity`): over this reform's changes
-0.7 behaves like 1.4 (24% to 45%), 1.5 (24% to 40%) and 3.0 (18% to 20%).
The tax on a gain then scales with t ** (1 + e), so at -0.7 a higher rate
always raises more, with diminishing returns, where a retention elasticity e
has a revenue-maximising rate of 1 / (1 + e): 50% at CenTax's 1.0 and 22% at
the official 3.6. Towards a zero rate the marginal-rate form makes
realisations grow without bound; the engine's floor stops a cut from 24% to
0% at about 46 times the gains.

Caveats: the evidence behind -0.7 is from the US, and the step to the UK is
a judgement. CenTax's elasticity belongs to a package that also removes the
uplift at death and charges gains on departure, closing two ways of
deferring or avoiding the tax, which this repo does not model. CenTax
expect a larger response to a rate rise on the current base, and advise
against equalising rates without the base reforms (*Taxes at the top*,
September 2026, p.17); the upper end of CenTax's range and the official case
show how much of the yield rests on the assumption. Every case is
medium-term and abstracts from short-run forestalling.

Income shifting: CenTax net it into their elasticity (1.5 lowered to 1.0),
while the OBR's 3.6 is gross of it and its costing adds income tax back
(``INCOME_SHIFTING_SHARE``). ``comparison.APPROACHES`` puts the comparison
cases on one footing either way: gross of income shifting (CenTax's 1.5,
nothing added back) or net of it (CenTax as published, the official case
plus the income tax). PolicyEngine's -0.7 makes no allowance for it, so
every gain not realised counts as lost CGT, and it is applied that way under
both approaches. The README and the dashboard's Methodology tab set out
both.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass

YEARS = [2026, 2027, 2028, 2029, 2030]  # fiscal years 2026-27 .. 2030-31
# policyengine.py reform dicts take a single effective date per value and
# apply it open-endedly (equivalent to the old "2026-01-01.2035-12-31"
# range over the 2026-2030 window simulated here).
PERIOD = "2026-01-01"
# PolicyEngine's default capital gains elasticity (November 2024): realised
# gains with respect to the marginal tax rate on them. The central case.
POLICYENGINE_ELASTICITY = -0.7
POLICYENGINE_ELASTICITY_URL = "https://www.policyengine.org/uk/research/behavioural-responses"
ELASTICITY = POLICYENGINE_ELASTICITY
# Elasticities of realised gains with respect to the retention rate (1 - t),
# the convention CenTax and the OBR state them in. CenTax's central case and
# its range (Advani, Lonsdale and Summers 2024, Table 6):
CENTAX_CENTRAL_ELASTICITY = 1.0
CENTAX_LOWER_ELASTICITY = 0.5
CENTAX_UPPER_ELASTICITY = 2.0
# CenTax's starting point before their two downward adjustments (Advani,
# Lonsdale and Summers 2024, p. 36): Agersnap and Zidar's five-year
# elasticity with controls, about 1.5. CenTax lower it to 1.0 because their
# package abolishes the uplift at death, and because equalisation brings
# income that was presented as gains back into income tax, which estimates
# measured on the CGT base alone count as lost. CenTax do not say how the
# 0.5 splits between the two. A rates-only reform keeps the uplift at death,
# so the CGT-only approach (``APPROACHES`` in ``comparison``) compares with
# the value before both adjustments. CenTax's 0.5 and 2.0 are not adjusted.
CENTAX_UNADJUSTED_ELASTICITY = 1.5
# The OBR's treatment of income shifting (January 2025, p. 3 and Table 1.1):
# 12.5% of the behavioural response to the narrowing gap between income tax
# and CGT rates is income no longer presented as gains, taxed as income.
INCOME_SHIFTING_SHARE = 0.125
# The rate that income is taxed at, which the OBR does not state: 45%, the
# additional rate on earnings. Two-thirds of the shifted income comes from
# people with gains of £1m or more, all of it at 45%; stacked on each
# person's other income, the rate on the whole averages 42.5% on the staged
# Microcosm build (2026-27, official elasticity), so 45% overstates the
# offset by about 6%. Dividends at the additional dividend rate (39.35%)
# would give about an eighth less; salary with employee and employer
# National Insurance (about 54% of the employer's cost) about a fifth more.
INCOME_SHIFTING_TAX_RATE = 0.45
# The official HMRC/OBR assumption for the main CGT rates (OBR, "Costing of
# changes to the main, BADR and IR rates of CGT", January 2025, para 1.9).
OFFICIAL_ELASTICITY = 3.6
# The official assumption for Business Asset Disposal Relief (same source),
# applied to HMRC's ready-reckoner rows that move the relief's rate.
OFFICIAL_BADR_ELASTICITY = 1.4
# The engine's two parameters, which may not both be set: the retention-rate
# form, realised gains scaled by ((1 - t1) / (1 - t0)) ** e, carries CenTax's
# and the official cases; the marginal-tax-rate form, (t1 / t0) ** e,
# carries PolicyEngine's.
ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.elasticity"
MTR_ELASTICITY_PARAMETER = "gov.simulation.capital_gains_responses.mtr_elasticity"
# The engine floors each marginal rate at 0.1% before taking its log in the
# marginal-tax-rate form (``relative_capital_gains_mtr_change``).
MTR_FLOOR = 0.001

# Reformed CGT rates, equal to the income tax rates for each band.
INCOME_TAX_RATES = {
    "basic_rate": 0.20,  # from 18%
    "higher_rate": 0.40,  # from 24%
    "additional_rate": 0.45,  # from 24%
}

# Schedules the engine charges separately (policyengine-uk 2.99.0+) that the
# reform moves with the main rates. Residential property gains have been
# charged at the main rates since 30 October 2024 and take the reformed rates
# too. Carried interest is not among them: it has been taxed as income since
# 6 April 2026 (the engine keeps a 32% CGT stand-in), so equalising CGT with
# income tax leaves it where it is.
SCHEDULES = ("residential_property",)
CARRIED_INTEREST_SCHEDULE = "carried_interest"

# The three rate bands every CGT schedule carries, in the engine's order.
RATE_BANDS = ("basic_rate", "higher_rate", "additional_rate")

# Business Asset Disposal Relief (and Investors' Relief, which the engine's
# capital_gains_badr input merges with it). Current law from 6 April 2026: a
# rate of 18% on qualifying gains up to a £1m lifetime limit, which the engine
# applies to each year's gains (Finance Act 2025 s. 8; TCGA 1992 s. 169N).
BADR_RATE_PARAMETER = "gov.hmrc.cgt.badr.rate"
BADR_LIFETIME_LIMIT_PARAMETER = "gov.hmrc.cgt.badr.lifetime_limit"
BADR_CURRENT_RATE = 0.18
BADR_CURRENT_LIFETIME_LIMIT = 1_000_000
#: Lifetime limits a reader can keep the relief at: half the current limit,
#: the current £1m, and the £10m that applied until 11 March 2020.
BADR_LIFETIME_LIMITS = (500_000, 1_000_000, 10_000_000)


@dataclass(frozen=True)
class BadrPolicy:
    """Business Asset Disposal Relief under a reform.

    Kept, it charges qualifying gains at ``rate`` up to ``lifetime_limit``;
    withdrawn, qualifying gains fall onto the main schedule at the reformed
    main rates (the engine's lifetime limit goes to zero).
    """

    withdrawn: bool = False
    rate: float = BADR_CURRENT_RATE
    lifetime_limit: int = BADR_CURRENT_LIFETIME_LIMIT

    @property
    def is_current_law(self) -> bool:
        return (
            not self.withdrawn
            and self.rate == BADR_CURRENT_RATE
            and self.lifetime_limit == BADR_CURRENT_LIFETIME_LIMIT
        )

    def parameters(self) -> dict:
        """The reform-dict entries this treatment needs: none at current law,
        so a schedule that leaves the relief alone keys exactly as before."""
        if self.withdrawn:
            return {BADR_LIFETIME_LIMIT_PARAMETER: {PERIOD: 0}}
        entries = {}
        if self.rate != BADR_CURRENT_RATE:
            entries[BADR_RATE_PARAMETER] = {PERIOD: self.rate}
        if self.lifetime_limit != BADR_CURRENT_LIFETIME_LIMIT:
            entries[BADR_LIFETIME_LIMIT_PARAMETER] = {PERIOD: self.lifetime_limit}
        return entries

    def to_dict(self) -> dict:
        """The treatment for results metadata and API payloads."""
        if self.withdrawn:
            return {"withdrawn": True, "rate": None, "lifetime_limit": None}
        return {"withdrawn": False, "rate": self.rate, "lifetime_limit": self.lifetime_limit}


BADR_CURRENT_LAW = BadrPolicy()
BADR_WITHDRAWN = BadrPolicy(withdrawn=True)

# The rate explorer's scope: a chosen schedule reaches the main rates, the
# residential property schedule and Business Asset Disposal Relief (kept at
# a rate and lifetime limit, or withdrawn). With the same rates, relief and
# elasticity it builds exactly the equalisation reform's dict.
EXPLORER_SCHEDULES = SCHEDULES
EXPLORER_SCOPE = "main_residential_and_badr"

EXEMPT_AMOUNT_PARAMETER = "gov.hmrc.cgt.annual_exempt_amount"

# The rules CenTax's rates-only estimate starts from (Advani, Lonsdale and
# Summers 2024, Table 3: 2019/20). Applied to this repo's data as a static
# counterfactual, so the percentage uplift is comparable with theirs.
CENTAX_1920_MAIN_RATES = {"basic_rate": 0.10, "higher_rate": 0.20, "additional_rate": 0.20}
CENTAX_1920_SCHEDULE_RATES = {"basic_rate": 0.18, "higher_rate": 0.28, "additional_rate": 0.28}
CENTAX_1920_EXEMPT_AMOUNT = 12_000
# Business Asset Disposal Relief (then Entrepreneurs' Relief) charged 10% in
# 2019/20; CenTax's baseline applies the £1m lifetime limit of March 2020.
# Investors' Relief gains sit in the engine's BADR input and follow it.
CENTAX_1920_BADR_RATE = 0.10
CENTAX_1920_BADR_LIFETIME_LIMIT = 1_000_000


def elasticity_form(elasticity: float) -> str:
    """The convention a behavioural case is stated in: ``"mtr"`` for a
    negative value, an elasticity of realised gains with respect to the
    marginal tax rate (PolicyEngine's); ``"retention"`` for zero or a positive
    value, one with respect to the retention rate 1 - t (CenTax's and the
    official). The sign settles it: realisations fall as the rate rises and
    rise with the share kept."""
    return "mtr" if elasticity < 0 else "retention"


def elasticity_assignment(elasticity: float) -> dict[str, float]:
    """The engine parameter (and value) that carries a behavioural case,
    applied as stated in its own convention (:func:`elasticity_form`)."""
    if elasticity_form(elasticity) == "mtr":
        return {MTR_ELASTICITY_PARAMETER: elasticity}
    return {ELASTICITY_PARAMETER: elasticity}


def elasticity_convention(elasticity: float) -> dict:
    """How a behavioural case is applied: the engine parameter it sets, the
    convention and the value the engine receives. Every output that reports
    a case carries these."""
    [(parameter, value)] = elasticity_assignment(elasticity).items()
    return {
        "elasticity_parameter": parameter,
        "applied_as": elasticity_form(elasticity),
        "applied_value": value,
    }


def cgt_rate_reform(
    rates: dict,
    elasticity: float = ELASTICITY,
    *,
    schedules: tuple[str, ...] = EXPLORER_SCHEDULES,
    badr: BadrPolicy = BADR_CURRENT_LAW,
) -> dict:
    """A CGT rate schedule as a PolicyEngine parametric reform dict.

    ``rates`` maps every band in :data:`RATE_BANDS` to its reformed rate. The
    main schedule and each schedule in ``schedules`` take those rates;
    ``badr`` sets Business Asset Disposal Relief (no entries at current law).
    The behavioural elasticity goes to the parameter of its convention
    (:func:`elasticity_assignment`).
    """
    missing = [band for band in RATE_BANDS if band not in rates]
    if missing:
        raise ValueError(f"rates must name every band in {RATE_BANDS}; missing {missing}")
    reform = {f"gov.hmrc.cgt.{band}": {PERIOD: rates[band]} for band in RATE_BANDS}
    for schedule in schedules:
        for band in RATE_BANDS:
            reform[f"gov.hmrc.cgt.{schedule}.{band}"] = {PERIOD: rates[band]}
    reform.update(badr.parameters())
    for parameter, value in elasticity_assignment(elasticity).items():
        reform[parameter] = {PERIOD: value}
    return reform


def equalisation_reform(
    elasticity: float = ELASTICITY, *, badr: BadrPolicy = BADR_WITHDRAWN
) -> dict:
    """The equalisation reform as a PolicyEngine parametric reform dict: the
    main and residential property schedules take the income tax rates and
    Business Asset Disposal Relief is withdrawn (``badr`` keeps it instead).
    The dict is the one the cached simulation ids were minted from, so its
    fingerprint is pinned in the tests."""
    return cgt_rate_reform(INCOME_TAX_RATES, elasticity, schedules=SCHEDULES, badr=badr)


#: The equalisation reform built up schedule by schedule, for the split of
#: its yield: the main rates alone, then the residential property schedule
#: (equalisation with the relief kept), then the relief withdrawn.
SCHEDULE_STEPS = (
    ("main_rates", "Main rates at 20% / 40% / 45%", (), BADR_CURRENT_LAW),
    ("residential", "Residential property gains at the same rates", SCHEDULES, BADR_CURRENT_LAW),
    ("badr_withdrawn", "Business Asset Disposal Relief withdrawn", SCHEDULES, BADR_WITHDRAWN),
)


def schedule_step_reforms(elasticity: float) -> list[tuple[str, str, dict]]:
    """``(step id, label, reform dict)`` for each step of
    :data:`SCHEDULE_STEPS`; the last is the equalisation reform itself."""
    return [
        (step, label, cgt_rate_reform(INCOME_TAX_RATES, elasticity, schedules=schedules, badr=badr))
        for step, label, schedules, badr in SCHEDULE_STEPS
    ]


def centax_1920_reforms() -> tuple[dict, dict]:
    """The static counterfactual pair for the CenTax rates-only benchmark:
    2019/20 rules (main 10/20, residential and carried interest 18/28, BADR
    at 10% with a £1m lifetime limit, a £12,000 exempt amount) and the same
    rules with every schedule, carried interest included, at income tax
    rates and the relief withdrawn, as CenTax's Table 3 has it. Both at
    e = 0, so each is exact against the current-law baseline and their
    difference is the uplift from equalising at 2019/20 rules."""
    exempt = {EXEMPT_AMOUNT_PARAMETER: {PERIOD: CENTAX_1920_EXEMPT_AMOUNT}}
    baseline = cgt_rate_reform(CENTAX_1920_MAIN_RATES, 0.0, schedules=())
    for schedule in (*SCHEDULES, CARRIED_INTEREST_SCHEDULE):
        for band in RATE_BANDS:
            baseline[f"gov.hmrc.cgt.{schedule}.{band}"] = {PERIOD: CENTAX_1920_SCHEDULE_RATES[band]}
    baseline[BADR_RATE_PARAMETER] = {PERIOD: CENTAX_1920_BADR_RATE}
    baseline[BADR_LIFETIME_LIMIT_PARAMETER] = {PERIOD: CENTAX_1920_BADR_LIFETIME_LIMIT}
    carried = {
        f"gov.hmrc.cgt.{CARRIED_INTEREST_SCHEDULE}.{band}": {PERIOD: INCOME_TAX_RATES[band]}
        for band in RATE_BANDS
    }
    return {**baseline, **exempt}, {**equalisation_reform(0.0), **carried, **exempt}


def centax_1920_rules() -> dict:
    """The counterfactual's rules, for the results metadata."""
    schedules = (*SCHEDULES, CARRIED_INTEREST_SCHEDULE)
    return {
        "baseline": {
            "main": dict(CENTAX_1920_MAIN_RATES),
            **{schedule: dict(CENTAX_1920_SCHEDULE_RATES) for schedule in schedules},
            "badr": {
                "rate": CENTAX_1920_BADR_RATE,
                "lifetime_limit": CENTAX_1920_BADR_LIFETIME_LIMIT,
            },
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "reform": {
            "main": dict(INCOME_TAX_RATES),
            **{schedule: dict(INCOME_TAX_RATES) for schedule in schedules},
            "badr": BADR_WITHDRAWN.to_dict(),
            "annual_exempt_amount": CENTAX_1920_EXEMPT_AMOUNT,
        },
        "elasticity": 0.0,
        "not_modelled": (
            "Investors' Relief, which CenTax's Table 3 also abolishes, shares the engine's "
            "BADR input (capital_gains_badr): it is charged at the BADR rate within the BADR "
            "lifetime limit and withdrawn with it; its own £10m limit is not modelled. On a "
            "dataset without BADR gains the relief settings are inert."
        ),
    }


def reform_fingerprint(reform: dict) -> str:
    """Short digest of a reform dict, folded into simulation ids so a change
    in the reform definition cannot reuse cached simulation outputs."""
    payload = json.dumps(reform, sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:12]


def rate_reform_schedules(
    rates: dict,
    badr: BadrPolicy = BADR_CURRENT_LAW,
    schedules: tuple[str, ...] = EXPLORER_SCHEDULES,
) -> dict:
    """The schedule part of a rate reform built by :func:`cgt_rate_reform`,
    for the results metadata: each moved schedule's rates and the relief."""
    return {
        **{schedule: {band: rates[band] for band in RATE_BANDS} for schedule in schedules},
        "badr": badr.to_dict(),
    }


def reform_schedules() -> dict:
    """The schedule part of the equalisation reform, for the results metadata."""
    return rate_reform_schedules(INCOME_TAX_RATES, BADR_WITHDRAWN, SCHEDULES)


def _check_rates(*rates: float, low_open: bool = False) -> None:
    for rate in rates:
        if not (0.0 < rate < 1.0 if low_open else 0.0 <= rate < 1.0):
            raise ValueError(f"tax rate {rate} outside {'(0, 1)' if low_open else '[0, 1)'}")


def retention_response(e_retention: float, t0: float, t1: float) -> float:
    """The factor by which realised gains scale when a marginal rate on gains
    moves from ``t0`` to ``t1``, at a retention-rate elasticity: the form
    the engine applies, ((1 - t1) / (1 - t0)) ** e."""
    _check_rates(t0, t1)
    return ((1.0 - t1) / (1.0 - t0)) ** e_retention


def mtr_response(e_mtr: float, t0: float, t1: float) -> float:
    """The same factor at an elasticity with respect to the marginal tax rate
    itself: the form the engine applies, (t1 / t0) ** e, with each rate
    floored at :data:`MTR_FLOOR`."""
    _check_rates(t0, t1)
    return (max(t1, MTR_FLOOR) / max(t0, MTR_FLOOR)) ** e_mtr


def point_retention_elasticity(e_mtr: float, t: float) -> float:
    """The retention-rate elasticity that an elasticity ``e_mtr`` with
    respect to the marginal rate equals at the rate ``t``:
    d ln G / d ln(1 - t) = -e_mtr * (1 - t) / t. It holds only for small
    changes around ``t``."""
    _check_rates(t, low_open=True)
    return -e_mtr * (1.0 - t) / t


def equivalent_retention_elasticity(e_mtr: float, t0: float, t1: float) -> float:
    """The retention-rate elasticity that moves realised gains by the same
    factor as ``e_mtr`` over the change from ``t0`` to ``t1``:
    e_mtr * ln(t1 / t0) / ln((1 - t1) / (1 - t0)). Equal rates give the
    point value."""
    _check_rates(t0, t1, low_open=True)
    if math.isclose(t0, t1):
        return point_retention_elasticity(e_mtr, t0)
    return e_mtr * math.log(t1 / t0) / math.log((1.0 - t1) / (1.0 - t0))
