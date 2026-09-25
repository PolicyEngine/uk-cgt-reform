"""Budgetary, validation, distributional and sensitivity impacts.

Distributional outputs group the change in household net income by
weighted baseline-income quantile (quintiles and quartiles), by household
type, and by region. Aggregates are computed from the simulations' output
datasets with native microdf weighted operations
(``MicroSeries.sum/mean/median/count`` and weighted ``groupby``); there is
no manual weight arithmetic anywhere.

Entrants by uprating
--------------------
The annual exempt amount is frozen at £3,000 while the engine uprates
gains with GDP per capita, so a person whose base-year gains sit at or
below the exempt amount can cross it in a later year and become a CGT
taxpayer with a few hundred pounds of taxable gain. The validation and
budget blocks report that group separately: ``entrants`` are persons whose
pre-response gains in the analysis year exceed the year's exempt amount
but not the base-year exempt amount times the cumulative gains factor
(so they were not taxpayers in the base year). Nothing is removed or
edited; the decomposition lets a reader net them out.
"""

from __future__ import annotations

import numpy as np

from .reform import elasticity_convention

AEA = 3_000  # annual exempt amount, unchanged by the reform

# The engine's Region enum names (policyengine_uk Region), as the ``region``
# household variable reports them, mapped to display names. Every UK
# dataset carries ``region``; the output-area codes only the Enhanced FRS
# carries are no longer used.
REGION_NAMES = {
    "NORTH_EAST": "North East",
    "NORTH_WEST": "North West",
    "YORKSHIRE": "Yorkshire and the Humber",
    "EAST_MIDLANDS": "East Midlands",
    "WEST_MIDLANDS": "West Midlands",
    "EAST_OF_ENGLAND": "East of England",
    "LONDON": "London",
    "SOUTH_EAST": "South East",
    "SOUTH_WEST": "South West",
    "WALES": "Wales",
    "SCOTLAND": "Scotland",
    "NORTHERN_IRELAND": "Northern Ireland",
}

QUANTILE_LABELS = {
    4: ["Lowest 25%", "25–50%", "50–75%", "Highest 25%"],
    5: ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"],
}


def fiscal_year_label(year: int) -> str:
    return f"{year}-{str(year + 1)[2:]}"


def _person(sim):
    return sim.output_dataset.data.person


def _household(sim):
    return sim.output_dataset.data.household


def entrant_mask(pre_response_gains, exempt_amount: float, ceiling: float) -> np.ndarray:
    """Persons taxable in the analysis year only because uprating carried
    base-year gains at or below the exempt amount past it.

    ``ceiling`` is the base-year exempt amount times the cumulative gains
    factor for the year; ``exempt_amount`` is the year's own exempt amount.
    A relative tolerance absorbs float32 rounding of the uprated inputs.
    """
    gains = np.asarray(pre_response_gains, dtype=float)
    return (gains > exempt_amount) & (gains <= ceiling * (1 + 1e-6))


def entrants_by_uprating(baseline, exempt_amount: float, ceiling: float) -> dict:
    """Weighted count, gains and baseline CGT of the entrants (microdf)."""
    person = _person(baseline)
    mask = entrant_mask(person["capital_gains_before_response"].values, exempt_amount, ceiling)
    gains = person["capital_gains"][mask]
    return {
        "exempt_amount_gbp": float(exempt_amount),
        "ceiling_gbp": float(ceiling),
        "count": float(gains.count()),
        "gains_bn": float(gains.sum()) / 1e9,
        "cgt_bn": float(person["capital_gains_tax"][mask].sum()) / 1e9,
    }


def validation_stats(baseline, exempt_amount: float = AEA, ceiling: float | None = None) -> dict:
    """Baseline CGT statistics (published weights) vs HMRC/Advani.

    All statistics are weighted microdf operations over the person table.
    A "CGT taxpayer" is a person with gains above the year's exempt amount.
    With ``ceiling`` the entrants-by-uprating block is added.
    """
    person = _person(baseline)
    gains = person["capital_gains"]
    payer_gains = gains[gains > exempt_amount]
    total = float(payer_gains.sum())
    stats = {
        "cgt_taxpayers": float(payer_gains.count()),
        "total_gains_bn": total / 1e9,
        "mean_gain": float(payer_gains.mean()),
        "median_gain": float(payer_gains.median()),
        "share_gains_over_1m_pct": float(100 * payer_gains[payer_gains >= 1e6].sum() / total),
        "share_gains_over_5m_pct": float(100 * payer_gains[payer_gains >= 5e6].sum() / total),
        # Top of the HMRC size-of-gain distribution (Table 2.1a), where the
        # published dataset calibrates tightly and the reform's revenue lives.
        "taxpayers_over_500k": float(payer_gains[payer_gains >= 5e5].count()),
        "gains_over_500k_bn": float(payer_gains[payer_gains >= 5e5].sum() / 1e9),
        "gains_over_5m_bn": float(payer_gains[payer_gains >= 5e6].sum() / 1e9),
        "largest_gain_m": float(payer_gains.max() / 1e6),
        "baseline_cgt_revenue_bn": float(person["capital_gains_tax"].sum() / 1e9),
        # Schedule components (pre-response inputs; zero where the dataset
        # does not carry them).
        "residential_property_gains_bn": float(
            person["capital_gains_residential_property"].sum() / 1e9
        ),
        "badr_gains_bn": float(person["capital_gains_badr"].sum() / 1e9),
        "carried_interest_gains_bn": float(person["capital_gains_carried_interest"].sum() / 1e9),
    }
    if ceiling is not None:
        entrants = entrants_by_uprating(baseline, exempt_amount, ceiling)
        stats["entrants_by_uprating"] = entrants
        stats["cgt_taxpayers_excluding_entrants"] = stats["cgt_taxpayers"] - entrants["count"]
        stats["total_gains_excluding_entrants_bn"] = stats["total_gains_bn"] - entrants["gains_bn"]
    return stats


def cgt_revenue(sim) -> float:
    """Weighted total capital gains tax revenue for a simulation."""
    return float(_person(sim)["capital_gains_tax"].sum())


def _aligned(base, ref):
    base_person, ref_person = _person(base), _person(ref)
    if not np.array_equal(base_person["person_id"].values, ref_person["person_id"].values):
        raise ValueError("Baseline and reform person tables are not aligned row for row.")
    return base_person, ref_person


def budget_impact(
    baseline_sims: dict,
    reform_sims: dict,
    years: list[int],
    exempt_amounts: dict[int, float] | None = None,
    ceilings: dict[int, float] | None = None,
) -> list[dict]:
    """Change in government revenue (positive = revenue raised), overall
    and for CGT specifically. Weighted sums via microdf. With
    ``exempt_amounts`` and ``ceilings`` the CGT change is also reported for
    the entrants by uprating alone."""
    rows = []
    for year in years:
        base, ref = baseline_sims[year], reform_sims[year]
        base_cgt, ref_cgt = cgt_revenue(base), cgt_revenue(ref)
        base_hh, ref_hh = _household(base), _household(ref)
        row = {
            "year": fiscal_year_label(year),
            "baseline_cgt_bn": base_cgt / 1e9,
            "reform_cgt_bn": ref_cgt / 1e9,
            "cgt_change_bn": (ref_cgt - base_cgt) / 1e9,
            "total_tax_change_bn": float(
                (ref_hh["gov_tax"].sum() - base_hh["gov_tax"].sum()) / 1e9
            ),
            "gov_balance_change_bn": float(
                (ref_hh["gov_balance"].sum() - base_hh["gov_balance"].sum()) / 1e9
            ),
        }
        if exempt_amounts is not None and ceilings is not None:
            base_person, ref_person = _aligned(base, ref)
            mask = entrant_mask(
                base_person["capital_gains_before_response"].values,
                exempt_amounts[year],
                ceilings[year],
            )
            row["cgt_change_from_entrants_bn"] = float(
                (
                    ref_person["capital_gains_tax"][mask].sum()
                    - base_person["capital_gains_tax"][mask].sum()
                )
                / 1e9
            )
        rows.append(row)
    return rows


def _group_rows(gain, base_income, labels, order) -> list[dict]:
    """Weighted average and relative net-income change per group."""
    avg = gain.groupby(labels).mean()
    total = gain.groupby(labels).sum()
    income = base_income.groupby(labels).sum()
    return [
        {
            "group": str(group),
            "avg_change_gbp": float(avg.get(group, 0.0)),
            "relative_change_pct": float(100 * total.get(group, 0.0) / income.get(group)),
        }
        for group in order
        if group in set(labels)
    ]


def income_change_groups(baseline, reformed) -> dict:
    """Change in household net income by weighted baseline-income quantile
    (quintiles and quartiles), by household type, and by region."""
    base_hh, ref_hh = _household(baseline), _household(reformed)
    gain = ref_hh["household_net_income"] - base_hh["household_net_income"]
    base_income = base_hh["household_net_income"]

    result = {}
    for n, key, rank in (
        (5, "quintile", base_income.quintile_rank()),
        (4, "quartile", base_income.quartile_rank()),
    ):
        labels = np.array(QUANTILE_LABELS[n], dtype=object)[rank.values.astype(int) - 1]
        result[key] = _group_rows(gain, base_income, labels, QUANTILE_LABELS[n])

    # Household type from the members of each household: any child ->
    # "With children"; otherwise all adults at State Pension age ->
    # "Pensioner"; otherwise working-age without children.
    import pandas as pd

    person = _person(baseline)
    members = pd.DataFrame(
        {
            "household_id": person["household_id"].values,
            "is_child": person["is_child"].values.astype(bool),
            "working_age_adult": (
                person["is_adult"].values.astype(bool) & ~person["is_SP_age"].values.astype(bool)
            ),
        }
    ).groupby("household_id")
    has_children = members["is_child"].any()
    has_working_age_adult = members["working_age_adult"].any()
    hh_ids = base_hh["household_id"].values
    child = has_children.reindex(hh_ids).fillna(False).values
    pensioner = ~has_working_age_adult.reindex(hh_ids).fillna(False).values & ~child
    type_order = ["With children", "Pensioner", "Working-age, no children"]
    type_labels = np.where(child, type_order[0], np.where(pensioner, type_order[1], type_order[2]))
    result["household_type"] = _group_rows(gain, base_income, type_labels, type_order)

    region_labels = np.array(
        [REGION_NAMES.get(str(name), "") for name in base_hh["region"].values], dtype=object
    )
    keep = region_labels != ""
    result["region"] = _group_rows(
        gain[keep], base_income[keep], region_labels[keep], list(REGION_NAMES.values())
    )
    return result


UNASSIGNED_REGION = "Unassigned"


def cgt_by_region(sim) -> dict[str, float]:
    """Weighted CGT by the region of each person's household, £, keyed by
    the display names in :data:`REGION_NAMES` in their order, then
    :data:`UNASSIGNED_REGION` for households whose region is not one of
    them."""
    import pandas as pd

    household = _household(sim)
    region_of = pd.Series(
        [REGION_NAMES.get(str(name), UNASSIGNED_REGION) for name in household["region"].values],
        index=household["household_id"].values,
    )
    person = _person(sim)
    labels = region_of.reindex(person["household_id"].values).fillna(UNASSIGNED_REGION).values
    totals = person["capital_gains_tax"].groupby(labels).sum()
    order = [*REGION_NAMES.values(), UNASSIGNED_REGION]
    return {region: float(totals.get(region, 0.0)) for region in order}


def cgt_uplift(baseline, reformed) -> dict:
    """The change in CGT from ``baseline`` to ``reformed``, nationally and by
    region, with each as a percentage of its baseline CGT."""
    base, ref = cgt_by_region(baseline), cgt_by_region(reformed)

    def entry(b: float, r: float) -> dict:
        return {
            "baseline_cgt_bn": b / 1e9,
            "reform_cgt_bn": r / 1e9,
            "change_bn": (r - b) / 1e9,
            "uplift_pct": 100 * (r - b) / b if b else None,
        }

    return {
        "national": entry(sum(base.values()), sum(ref.values())),
        "regions": [
            {"region": region, **entry(base[region], ref[region])}
            for region in REGION_NAMES.values()
        ],
        "unassigned_cgt_bn": {
            "baseline": base[UNASSIGNED_REGION] / 1e9,
            "reform": ref[UNASSIGNED_REGION] / 1e9,
        },
    }


def sensitivity(baseline_cgt: float, cases: dict[str, float], run_case) -> list[dict]:
    """Re-run the 2026 reform under each institution's elasticity assumption.

    ``run_case(elasticity)`` must return the completed reform simulation
    for 2026 with that elasticity. Each case is keyed by its MTR value
    (``e_mtr``); the row also says which engine parameter carried it and in
    which convention (``reform.elasticity_convention``).
    """
    rows = []
    for name, e in cases.items():
        sim = run_case(e)
        rows.append(
            {
                "name": name,
                "e_mtr": e,
                **elasticity_convention(e),
                "revenue_2026_bn": (cgt_revenue(sim) - baseline_cgt) / 1e9,
            }
        )
    return rows
