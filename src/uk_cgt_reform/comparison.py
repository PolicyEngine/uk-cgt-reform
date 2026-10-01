"""External benchmarks, and the registered datasets side by side.

Benchmarks (issue #7) are other institutions' published figures that match
what this repo scores, each stored with its source, scope, year and basis
so the dashboard can say how comparable it is:

- JRF (2026): static yield of equalising CGT with income tax rates, 2026-27
  and 2029-30, grouped HMRC statistics scaled to the OBR's March 2026
  receipts projection.
- CenTax (Advani, Lonsdale and Summers 2024), Table 3 and Table 8: the
  static uplift from equalising rates alone, nationally and by region, on
  2019/20 rules. The pipeline re-scores that reform on this repo's data at
  the same rules (``reform.centax_1920_reforms``).
- CenTax's package estimates (Tables 5 and 6, the August 2025 technical
  note, "Taxes at the top" 2026), which add an investment allowance and
  base broadening: context only, a different scope.
- HMRC's ready reckoner (June 2025): post-behavioural yields of +1/+5/+10pp
  on the higher rate and +1/+5pp on the lower rate, scored here at the
  central and the official elasticity.
- The official elasticity itself (OBR, January 2025): retention 3.6.

The two approaches to income shifting (``APPROACHES``) say which elasticity
cases the dashboard shows and whether the official case adds back the
income tax the OBR's method attributes to income no longer presented as
gains (``INCOME_SHIFTING``).
"""

from __future__ import annotations

from .impacts import REGION_NAMES
from .reform import (
    BADR_CURRENT_LAW,
    CENTAX_LOWER_ELASTICITY,
    CENTAX_UNADJUSTED_ELASTICITY,
    CENTAX_UPPER_ELASTICITY,
    ELASTICITY,
    INCOME_SHIFTING_SHARE,
    INCOME_SHIFTING_TAX_RATE,
    OFFICIAL_BADR_ELASTICITY,
    OFFICIAL_ELASTICITY,
    RATE_BANDS,
    BadrPolicy,
)
from .uprating_audit import CPI_INDEX, OBR_CGT_RECEIPTS_BN, OBR_CGT_RECEIPTS_SOURCE

# The behavioural cases, ``(id, label, retention-rate elasticity)``, each
# applied as stated (``reform.elasticity_assignment``): CenTax's central
# case, its value before CenTax's adjustments and its range, and the official
# HMRC/OBR assumption for the main rates. The approaches below pick five.
ELASTICITY_CASES = (
    ("static", "Static (no behavioural response)", 0.0),
    ("centax_lower", "CenTax lower (retention elasticity 0.5)", CENTAX_LOWER_ELASTICITY),
    ("centax_central", "CenTax central (retention elasticity 1.0)", ELASTICITY),
    (
        "centax_unadjusted",
        "CenTax before its adjustments (retention elasticity 1.5)",
        CENTAX_UNADJUSTED_ELASTICITY,
    ),
    ("centax_upper", "CenTax upper (retention elasticity 2.0)", CENTAX_UPPER_ELASTICITY),
    ("official", "HMRC/OBR official (retention elasticity 3.6)", OFFICIAL_ELASTICITY),
)
SENSITIVITY_CASES = {label: e for _, label, e in ELASTICITY_CASES}

OBR_JANUARY_2025 = {
    "source": (
        "OBR, Costing of changes to the main, BADR and IR rates of CGT "
        "(supplementary forecast information)"
    ),
    "published": "2025-01-22",
    "url": "https://obr.uk/docs/dlm_uploads/CGT-supplementary-release-Jan-2025.pdf",
}

#: The OBR's treatment of income no longer presented as gains, as applied
#: here: ``share`` of the behavioural fall in realised gains comes back as
#: income taxed at ``tax_rate`` (``impacts.income_shifting_offset``).
INCOME_SHIFTING = {
    **OBR_JANUARY_2025,
    "locator": "p. 3 and Table 1.1",
    "share": INCOME_SHIFTING_SHARE,
    "tax_rate": INCOME_SHIFTING_TAX_RATE,
    "share_note": (
        "The OBR's costing of the October 2024 rate rise assumes 12.5% of the "
        "behavioural response to the narrowing gap between income tax and CGT rates is "
        "income no longer presented as gains, which raises income tax receipts: HMRC "
        "assumes a quarter of the income tax response to a 1-point rise in marginal rates "
        "is avoidance, and half of that is income-to-gains shifting."
    ),
    "tax_rate_note": (
        "The OBR does not say which income it becomes or at what rate. 45% is the "
        "additional rate on earnings. Stacked on each person's other income, the rate on "
        "the shifted income averages 42.5% on the staged Microcosm UK build (2026-27, "
        "official elasticity), so 45% overstates the offset by about 6%. Dividends at the "
        "additional dividend rate (39.35%) would give about an eighth less, salary with "
        "employee and employer National Insurance about a fifth more."
    ),
    "obr_check": (
        "Applied to the OBR's own costing (£4.9bn of CGT lost to behaviour in 2029-30, on "
        "gains taxed at 22-24%), this gives about £1.2bn of income tax against the OBR's "
        "£1.5bn: it adds back somewhat less than the OBR did."
    ),
}

#: Two ways to put CenTax's and the official elasticities on the same footing
#: with respect to income shifting. ``case_ids`` are the five cases each
#: shows, ``central_id`` its central case, and ``offset_case_ids`` the cases
#: that add ``INCOME_SHIFTING``'s income tax to the change in CGT.
APPROACHES = {
    "total_revenue": {
        "id": "total_revenue",
        "label": "Net of income shifting",
        "description": (
            "Total revenue: CenTax's published elasticities, which already allow for "
            "income no longer presented as gains, and the official elasticity with the "
            "OBR's income tax on that income added back."
        ),
        "case_ids": ["static", "centax_lower", "centax_central", "centax_upper", "official"],
        "central_id": "centax_central",
        "offset_case_ids": ["official"],
    },
    "cgt_only": {
        "id": "cgt_only",
        "label": "Gross of income shifting",
        "description": (
            "CGT only: every gain not realised counts as lost revenue, with CenTax's "
            "elasticity before its adjustments and the official elasticity with no income "
            "tax added back."
        ),
        "case_ids": ["static", "centax_lower", "centax_unadjusted", "centax_upper", "official"],
        "central_id": "centax_unadjusted",
        "offset_case_ids": [],
    },
}
DEFAULT_APPROACH = "total_revenue"


def approaches_block() -> dict:
    """The results file's ``approaches`` block: both approaches, the cases
    they draw on and the income-shifting assumption."""
    return {
        "default": DEFAULT_APPROACH,
        "approaches": [dict(approach) for approach in APPROACHES.values()],
        "cases": [
            {"id": case_id, "label": label, "e_retention": e}
            for case_id, label, e in ELASTICITY_CASES
        ],
        "income_shifting": dict(INCOME_SHIFTING),
    }


#: Every external figure carries exactly these keys.
EXTERNAL_ROW_KEYS = (
    "id",
    "source",
    "published",
    "url",
    "locator",
    "scope",
    "comparable",
    "year",
    "basis",
    "price_basis",
    "value",
    "unit",
    "details",
    "note",
)
BASES = ("static", "post_behavioural")
UNITS = ("gbp_bn", "gbp_m", "pct")


def _external(**fields) -> dict:
    missing = [key for key in EXTERNAL_ROW_KEYS if key not in fields]
    extra = [key for key in fields if key not in EXTERNAL_ROW_KEYS]
    if missing or extra:
        raise ValueError(f"external row: missing {missing}, unexpected {extra}")
    if fields["basis"] not in BASES or fields["unit"] not in UNITS:
        raise ValueError(f"external row {fields['id']}: bad basis or unit")
    return {key: fields[key] for key in EXTERNAL_ROW_KEYS}


EQUALISATION_SCOPE = (
    "Equalising CGT rates with income tax rates (20/40/45, gains stacked on "
    "income) for every kind of gain, with no other change"
)

JRF_SOURCE = (
    "Joseph Rowntree Foundation, Rebuilding living standards and economic security "
    "(Belfield, Tims, Hamdan, Ladouch and Percival)"
)
JRF_URL = (
    "https://www.jrf.org.uk/income-savings-and-debt/"
    "rebuilding-living-standards-and-economic-security"
)
JRF_METHOD = (
    "HMRC CGT statistics by income band applied to the OBR March 2026 CGT "
    "projection, adjusted for carried interest and BADR; grouped data, no "
    "behavioural response"
)
JRF_STATIC = [
    _external(
        id="jrf_2026_static_2026_27",
        source=JRF_SOURCE,
        published="2026-06-29",
        url=JRF_URL,
        locator="Methodology, tax modelling",
        scope=EQUALISATION_SCOPE,
        comparable=True,
        year="2026-27",
        basis="static",
        price_basis="2026/27 prices",
        value=13.0,
        unit="gbp_bn",
        details={"method": JRF_METHOD},
        note="About £13bn.",
    ),
    _external(
        id="jrf_2026_static_2029_30",
        source=JRF_SOURCE,
        published="2026-06-29",
        url=JRF_URL,
        locator="Methodology, tax modelling",
        scope=EQUALISATION_SCOPE,
        comparable=True,
        year="2029-30",
        basis="static",
        price_basis="2026/27 prices",
        value=17.0,
        unit="gbp_bn",
        details={"method": JRF_METHOD},
        note="About £17bn.",
    ),
]

CENTAX_2024_SOURCE = (
    "CenTax, Reforming Capital Gains Tax: revenue and distributional effects "
    "(Advani, Lonsdale and Summers)"
)
CENTAX_2024_URL = (
    "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf"
)
CENTAX_RATES_ONLY_SCOPE = (
    "Equalisation with income tax rates (20/40/45, gains stacked on income), one rate "
    "for all assets: BADR, Investors' Relief and the separate residential and "
    "carried-interest rates abolished; principal private residence relief kept"
)
CENTAX_1920_RULES_NOTE = (
    "2019/20 rules and data: main rates 10/20, residential and carried interest "
    "18/28, BADR 10%, exempt amount £12,000; resident individuals; CGT and income tax "
    "counted together"
)
CENTAX_PACKAGE_SCOPE = (
    "Package: equalisation plus a rate-of-return investment allowance, removal of the "
    "death uplift, and rebasing on arrival with a deemed disposal on departure"
)

CENTAX_TABLE_3 = _external(
    id="centax_2024_table3_rates_only_static",
    source=CENTAX_2024_SOURCE,
    published="2024-10",
    url=f"{CENTAX_2024_URL}#page=29",
    locator="Table 3, p.28",
    scope=CENTAX_RATES_ONLY_SCOPE,
    comparable=True,
    year="2019-20",
    basis="static",
    price_basis="nominal, 2019/20",
    value=139.0,
    unit="pct",
    details={"change_bn": 15.2, "baseline_bn": 10.9},
    note=CENTAX_1920_RULES_NOTE,
)

# Table 8 ("Equalisation (no allowance)", 2020 tax year): baseline CGT and
# the static uplift by taxpayers' region of residence.
CENTAX_TABLE_8_REGIONS = [
    {"region": "London", "baseline_bn": 3.0, "uplift_pct": 123},
    {"region": "South East", "baseline_bn": 2.4, "uplift_pct": 139},
    {"region": "East of England", "baseline_bn": 1.1, "uplift_pct": 137},
    {"region": "North West", "baseline_bn": 0.9, "uplift_pct": 146},
    {"region": "South West", "baseline_bn": 0.8, "uplift_pct": 144},
    {"region": "West Midlands", "baseline_bn": 0.6, "uplift_pct": 151},
    {"region": "Yorkshire and the Humber", "baseline_bn": 0.6, "uplift_pct": 152},
    {"region": "East Midlands", "baseline_bn": 0.6, "uplift_pct": 151},
    {"region": "Scotland", "baseline_bn": 0.5, "uplift_pct": 160},
    {"region": "Wales", "baseline_bn": 0.2, "uplift_pct": 148},
    {"region": "North East", "baseline_bn": 0.2, "uplift_pct": 163},
    {"region": "Northern Ireland", "baseline_bn": 0.2, "uplift_pct": 154},
]
assert {row["region"] for row in CENTAX_TABLE_8_REGIONS} == set(REGION_NAMES.values())

CENTAX_TABLE_8 = _external(
    id="centax_2024_table8_regions_static",
    source=CENTAX_2024_SOURCE,
    published="2024-10",
    url=f"{CENTAX_2024_URL}#page=47",
    locator="Table 8, p.46",
    scope=CENTAX_RATES_ONLY_SCOPE,
    comparable=True,
    year="2019-20",
    basis="static",
    price_basis="nominal, 2019/20",
    value=None,
    unit="pct",
    details={"regions": CENTAX_TABLE_8_REGIONS},
    note=(
        f"{CENTAX_1920_RULES_NOTE}. Regions are taxpayers' regions of residence; "
        "the rows sum to £11.1bn against the national £10.9bn (rounding)."
    ),
)

CENTAX_PACKAGE_CONTEXT = [
    _external(
        id="centax_2024_rates_only_post_behavioural_derived",
        source=f"PolicyEngine derivation from {CENTAX_2024_SOURCE}",
        published="2024-10",
        url=f"{CENTAX_2024_URL}#page=39",
        locator="Tables 3 and 4, pp.28 and 38",
        scope=CENTAX_RATES_ONLY_SCOPE,
        comparable=False,
        year="2019-20",
        basis="post_behavioural",
        price_basis="nominal, 2019/20",
        value=8.2,
        unit="gbp_bn",
        details={"share_of_static_pct": 54, "retention_elasticity": 1.0},
        note=(
            "Not a CenTax figure. CenTax adds the death-uplift (£1.3bn) and exit-charge "
            "(£4.3bn) components without a behavioural response; subtracting them from the "
            "no-allowance package (£13.8bn, Table 4) leaves about £8.2bn for rates alone. "
            "CenTax expects a rates-only reform to face a higher elasticity than its package."
        ),
    ),
    _external(
        id="centax_2024_table5_package",
        source=CENTAX_2024_SOURCE,
        published="2024-10",
        url=f"{CENTAX_2024_URL}#page=40",
        locator="Table 5, p.39",
        scope=CENTAX_PACKAGE_SCOPE,
        comparable=False,
        year="2025-26",
        basis="post_behavioural",
        price_basis="nominal, scaled to the OBR's 2025/26 CGT forecast",
        value=14.3,
        unit="gbp_bn",
        details={"uplift_pct": 88, "retention_elasticity": 1.0},
        note="The headline £14bn: a medium-term effect on the 2025/26 base.",
    ),
    _external(
        id="centax_2024_table6_package_range",
        source=CENTAX_2024_SOURCE,
        published="2024-10",
        url=f"{CENTAX_2024_URL}#page=41",
        locator="Table 6, p.40",
        scope=CENTAX_PACKAGE_SCOPE,
        comparable=False,
        year="2025-26",
        basis="post_behavioural",
        price_basis="nominal, scaled to the OBR's 2025/26 CGT forecast",
        value=None,
        unit="gbp_bn",
        details={
            "by_retention_elasticity": [
                {"retention_elasticity": 0.5, "value": 19.0, "uplift_pct": 117},
                {"retention_elasticity": 1.0, "value": 14.3, "uplift_pct": 88},
                {"retention_elasticity": 1.5, "value": 9.7, "uplift_pct": 59},
                {"retention_elasticity": 2.0, "value": 5.0, "uplift_pct": 31},
            ]
        },
        note="The package's yield across CenTax's elasticity range.",
    ),
    _external(
        id="centax_2025_technical_note_package",
        source="CenTax, Technical note: equalising tax rates across different types of income",
        published="2025-08",
        url="https://centax.org.uk/wp-content/uploads/2025/09/TaxRateEqualisation-TechnicalNote.pdf",
        locator="Table 1, p.7",
        scope=f"{CENTAX_PACKAGE_SCOPE}; baseline after the October 2024 rate rises",
        comparable=False,
        year="2026-27",
        basis="post_behavioural",
        price_basis="nominal",
        value=11.3,
        unit="gbp_bn",
        details={"with_carried_interest_bn": 11.8},
        note="The package on the post-Autumn-Budget-2024 baseline.",
    ),
    _external(
        id="centax_2026_taxes_at_the_top_package",
        source="CenTax, Taxes at the top: understanding what high earners pay (Advani, Hughson and Summers)",
        published="2026-09-23",
        url="https://centax.org.uk/taxes-at-the-top-understanding-what-high-earners-pay/",
        locator="Section 3.1",
        scope=f"{CENTAX_PACKAGE_SCOPE}; baseline after the October 2024 rate rises",
        comparable=False,
        year="2029-30",
        basis="post_behavioural",
        price_basis="nominal, scaled to the OBR's March 2026 CGT baseline",
        value=19.7,
        unit="gbp_bn",
        details={"uplift_pct": 62, "previous_uplift_pct": 88},
        note="Uplift 62%, down from 88% in the 2024 report; no elasticity value stated.",
    ),
]

OFFICIAL_ELASTICITY_SOURCE = {
    **OBR_JANUARY_2025,
    "locator": "Para 1.9 and Table 1.1",
    "retention_elasticity": OFFICIAL_ELASTICITY,
    "note": (
        "Retention-rate elasticity 3.6 for the main rates (HMRC's 1998-2018 estimate is 4.0) "
        "and 1.4 for BADR."
    ),
}

# The elasticity cases the ready-reckoner rows are scored at: each
# approach's central case and the official one. "official" is each row's own
# official assumption (``official_elasticity``): 3.6 for the main-rate rows
# and 1.4 for the BADR rows (OBR, January 2025, para 1.9).
READY_RECKONER_ELASTICITIES = {
    "centax_central": ELASTICITY,
    "centax_unadjusted": CENTAX_UNADJUSTED_ELASTICITY,
    "official": OFFICIAL_ELASTICITY,
}


def _rates(basic: float, higher: float, additional: float) -> dict:
    return dict(zip(RATE_BANDS, (basic, higher, additional), strict=True))


_CURRENT_RATES = _rates(0.18, 0.24, 0.24)


def _row(row_id, label, rates, hmrc_m, *, badr=BADR_CURRENT_LAW, official=OFFICIAL_ELASTICITY):
    return {
        "id": row_id,
        "label": label,
        "rates": rates,
        "badr": badr.to_dict(),
        "official_elasticity": official,
        "hmrc_m": hmrc_m,
    }


READY_RECKONER = {
    "source": "HMRC, Direct effects of illustrative tax changes (ready reckoner), June 2025",
    "published": "2025-06-24",
    "url": (
        "https://assets.publishing.service.gov.uk/media/68552862b46781eacfd71d71/"
        "June_2025_TRR_ODS__1_.ods"
    ),
    "sha256": "1201953391d6201d1df8df4d60288c9094b43e0679ebf285e82ad3c912d476c1",
    "locator": "Capital gains tax rows; notes 13 and 14",
    "basis": "post_behavioural",
    "unit": "gbp_m",
    "measure": (
        "Exchequer receipts in £m (positive = yield), including income tax and SDLT "
        "effects, for a change from April 2026 on the OBR's March 2025 forecast"
    ),
    "note": (
        "The higher-rate rows move the higher and additional rates together, for main "
        "and residential gains (note 13); rows are non-linear and must not be scaled "
        "(note 14). The BADR rows raise the relief's rate from its 18% in 2026-27. HMRC "
        "deferred the 2026 edition on 6 July 2026 pending a review of key assumptions, "
        "so these rows are provisional."
    ),
    "hmrc_years": ["2026-27", "2027-28", "2028-29"],
    # Receipts lag liabilities by about a year: this repo's liabilities in
    # a year are compared with HMRC's receipts in the next.
    "lag": [
        {"model_year": "2026-27", "hmrc_year": "2027-28"},
        {"model_year": "2027-28", "hmrc_year": "2028-29"},
    ],
    "rows": [
        _row(
            "higher_plus_1",
            "Higher rate +1pp (18% / 25% / 25%)",
            _rates(0.18, 0.25, 0.25),
            {"2026-27": -15, "2027-28": 80, "2028-29": -30},
        ),
        _row(
            "higher_plus_5",
            "Higher rate +5pp (18% / 29% / 29%)",
            _rates(0.18, 0.29, 0.29),
            {"2026-27": -170, "2027-28": -235, "2028-29": -870},
        ),
        _row(
            "higher_plus_10",
            "Higher rate +10pp (18% / 34% / 34%)",
            _rates(0.18, 0.34, 0.34),
            {"2026-27": -540, "2027-28": -2060, "2028-29": -3565},
        ),
        _row(
            "lower_plus_1",
            "Lower rate +1pp (19% / 24% / 24%)",
            _rates(0.19, 0.24, 0.24),
            {"2026-27": -5, "2027-28": 10, "2028-29": 5},
        ),
        _row(
            "lower_plus_5",
            "Lower rate +5pp (23% / 24% / 24%)",
            _rates(0.23, 0.24, 0.24),
            {"2026-27": -40, "2027-28": 20, "2028-29": -10},
        ),
        _row(
            "badr_plus_1",
            "Business Asset Disposal Relief rate +1pp (19%)",
            _CURRENT_RATES,
            {"2026-27": 10, "2027-28": 135, "2028-29": 180},
            badr=BadrPolicy(rate=0.19),
            official=OFFICIAL_BADR_ELASTICITY,
        ),
        _row(
            "badr_plus_5",
            "Business Asset Disposal Relief rate +5pp (23%)",
            _CURRENT_RATES,
            {"2026-27": 40, "2027-28": 635, "2028-29": 840},
            badr=BadrPolicy(rate=0.23),
            official=OFFICIAL_BADR_ELASTICITY,
        ),
    ],
    "excluded": [
        {
            "hmrc_label": "Lower rate +10pp (28% / 24% / 24%)",
            "hmrc_m": {"2026-27": -130, "2027-28": -55, "2028-29": -135},
            "reason": "A lower rate above the higher rate breaks the explorer's ordering rule.",
        },
        {
            "hmrc_label": "Annual exempt amount +£500 (individuals; £250 for trusts)",
            "hmrc_m": {"2026-27": 0, "2027-28": -35, "2028-29": -30},
            "reason": "The explorer changes rates and the relief, not the exempt amount.",
        },
    ],
}


def price_factors(cpi_by_year: dict[str, dict], base_year: int, years: list[int]) -> dict:
    """Factors that express each year's nominal £ in ``base_year`` prices:
    the ratio of the OBR CPI path's cumulative factors (the audit's
    ``sensitivity_not_applied.cpi.by_year``), keyed by fiscal-year label."""
    from .impacts import fiscal_year_label

    base = cpi_by_year[str(base_year)]["cumulative_factor"]
    return {
        fiscal_year_label(year): cpi_by_year[str(year)]["cumulative_factor"] / base
        for year in years
    }


def static_equalisation_block(
    static_budget: list[dict],
    factors: dict[str, float],
    reform_fingerprint: str,
    price_index_source: str,
) -> dict:
    """The static equalisation reform by year beside JRF's static estimate.

    JRF scales the OBR's CGT receipts by a static uplift, so each year also
    carries this repo's uplift applied to the same OBR receipts, in 2026-27
    prices; that line isolates the uplift from the dataset's baseline level.
    """
    rows = []
    for row in static_budget:
        year = row["year"]
        factor = factors[year]
        uplift = row["cgt_change_bn"] / row["baseline_cgt_bn"]
        obr = OBR_CGT_RECEIPTS_BN.get(year)
        rows.append(
            {
                "year": year,
                "baseline_cgt_bn": row["baseline_cgt_bn"],
                "static_cgt_change_bn": row["cgt_change_bn"],
                "static_gov_balance_change_bn": row["gov_balance_change_bn"],
                "static_uplift_pct": 100 * uplift,
                "price_factor": factor,
                "static_cgt_change_real_bn": row["cgt_change_bn"] / factor,
                "obr_receipts_bn": obr,
                "uplift_on_obr_receipts_real_bn": None if obr is None else obr * uplift / factor,
            }
        )
    return {
        "reform_fingerprint": reform_fingerprint,
        "price_basis": "2026-27 prices",
        "price_index": CPI_INDEX,
        "price_index_source": price_index_source,
        "obr_receipts_source": OBR_CGT_RECEIPTS_SOURCE,
        "by_year": rows,
        "external": [dict(row) for row in JRF_STATIC],
    }


def centax_1920_block(
    current_law_cgt_bn: float, uplift: dict, rules: dict, fingerprints: dict[str, str]
) -> dict:
    """This repo's static uplift at 2019/20 rules beside CenTax Tables 3 and 8.
    ``uplift`` is :func:`impacts.cgt_uplift` of the counterfactual pair."""
    centax = {row["region"]: row for row in CENTAX_TABLE_8_REGIONS}
    centax_total = sum(row["baseline_bn"] for row in CENTAX_TABLE_8_REGIONS)
    model_total = sum(row["baseline_cgt_bn"] for row in uplift["regions"])
    regions = []
    for row in uplift["regions"]:
        ref = centax[row["region"]]
        regions.append(
            {
                **row,
                "baseline_share_pct": 100 * row["baseline_cgt_bn"] / model_total,
                "centax_baseline_bn": ref["baseline_bn"],
                "centax_baseline_share_pct": 100 * ref["baseline_bn"] / centax_total,
                "centax_uplift_pct": ref["uplift_pct"],
            }
        )
    return {
        "year": "2026-27",
        "rules": rules,
        "reform_fingerprints": dict(fingerprints),
        "national": {"current_law_cgt_bn": current_law_cgt_bn, **uplift["national"]},
        "unassigned_cgt_bn": dict(uplift["unassigned_cgt_bn"]),
        "regions": regions,
        "external": dict(CENTAX_TABLE_3),
        "external_regions": {k: v for k, v in CENTAX_TABLE_8.items() if k != "details"},
    }


def ready_reckoner_block(
    model_m: dict[str, dict[str, dict[str, float]]],
    offset_m: dict[str, dict[str, dict[str, float]]],
) -> dict:
    """HMRC's rows beside this repo's scores. ``model_m`` maps row id to
    elasticity id to model year to the change in government balance, £m;
    ``offset_m`` the same to the income-shifting offset, £m, which the
    approaches add to the official case or not."""
    missing = [
        row["id"]
        for row in READY_RECKONER["rows"]
        if row["id"] not in model_m or row["id"] not in offset_m
    ]
    if missing:
        raise ValueError(f"ready-reckoner rows not scored: {missing}")
    return {
        **{key: value for key, value in READY_RECKONER.items() if key != "rows"},
        "elasticity_ids": list(READY_RECKONER_ELASTICITIES),
        "model_measure": (
            "Change in government balance, £m, on this repo's liabilities in the model "
            "year, with each row's rates and relief (the main and residential rates move "
            "together; the BADR rows move the relief's rate) and the official case at the "
            "row's own elasticity (3.6 for the main rates, 1.4 for BADR)"
        ),
        "rows": [
            {
                **row,
                "model_m": model_m[row["id"]],
                "income_shifting_offset_m": offset_m[row["id"]],
            }
            for row in READY_RECKONER["rows"]
        ],
    }


def elasticities_block() -> dict:
    """The central and the official behavioural assumptions, CenTax's range,
    and how the engine applies each: every case is a retention-rate
    elasticity, realised gains scaled by ((1 - t1) / (1 - t0)) ** e."""
    return {
        "central": {
            "id": "centax_central",
            "e_retention": ELASTICITY,
            "applied_as": "retention",
            "source": CENTAX_2024_SOURCE,
            "url": f"{CENTAX_2024_URL}#page=38",
        },
        "unadjusted": {
            "id": "centax_unadjusted",
            "e_retention": CENTAX_UNADJUSTED_ELASTICITY,
            "applied_as": "retention",
            "source": CENTAX_2024_SOURCE,
            "url": f"{CENTAX_2024_URL}#page=37",
        },
        "centax_range": {
            "lower": CENTAX_LOWER_ELASTICITY,
            "upper": CENTAX_UPPER_ELASTICITY,
        },
        "official": {
            "id": "official",
            "e_retention": OFFICIAL_ELASTICITY,
            "applied_as": "retention",
            **OFFICIAL_ELASTICITY_SOURCE,
        },
        "form": "realised gains × ((1 − t₁) / (1 − t₀))^e, t the marginal rate on gains",
    }


def benchmarks_block(
    *, static_equalisation: dict, centax_2019_20_rules: dict, ready_reckoner: dict
) -> dict:
    """The results file's ``benchmarks`` block."""
    return {
        "elasticities": elasticities_block(),
        "static_equalisation": static_equalisation,
        "centax_2019_20_rules": centax_2019_20_rules,
        "centax_package_context": [dict(row) for row in CENTAX_PACKAGE_CONTEXT],
        "ready_reckoner": ready_reckoner,
    }


# ---------------------------------------------------------------------------
# Side-by-side comparison of the registered datasets
# ---------------------------------------------------------------------------

# Validation metrics shown side by side, in display order. Dotted names
# read nested blocks.
VALIDATION_METRICS = [
    ("cgt_taxpayers", "CGT taxpayers (gains above the exempt amount)"),
    ("entrants_by_uprating.count", "of which entrants by uprating"),
    ("cgt_taxpayers_excluding_entrants", "CGT taxpayers excluding entrants"),
    ("total_gains_bn", "Taxable gains, £bn"),
    ("entrants_by_uprating.gains_bn", "of which held by entrants, £bn"),
    ("total_gains_excluding_entrants_bn", "Taxable gains excluding entrants, £bn"),
    ("mean_gain", "Mean gain per taxpayer, £"),
    ("median_gain", "Median gain per taxpayer, £"),
    ("share_gains_over_1m_pct", "Share of gains from gains of £1m or more, %"),
    ("share_gains_over_5m_pct", "Share of gains from gains of £5m or more, %"),
    ("taxpayers_over_500k", "Taxpayers with gains over £500k"),
    ("gains_over_500k_bn", "Gains held by taxpayers with gains over £500k, £bn"),
    ("gains_over_5m_bn", "Gains in the £5m-and-over band, £bn"),
    ("largest_gain_m", "Largest single gain, £m"),
    ("baseline_cgt_revenue_bn", "Baseline CGT liability, £bn"),
    ("entrants_by_uprating.cgt_bn", "of which paid by entrants, £bn"),
    ("residential_property_gains_bn", "Residential property gains (own schedule), £bn"),
    ("badr_gains_bn", "BADR gains (own schedule), £bn"),
    ("badr_claimants", "People with gains qualifying for BADR"),
    ("carried_interest_gains_bn", "Carried interest gains (own schedule), £bn"),
]

DATASET_METADATA_FIELDS = (
    "dataset",
    "dataset_key",
    "dataset_label",
    "dataset_short_label",
    "dataset_role",
    "dataset_sha256",
    "dataset_producer",
    "dataset_observation",
    "dataset_notes",
    "policyengine_version",
    "policyengine_uk_version",
    "generated",
)


def _metric(validation: dict, name: str):
    value = validation
    for part in name.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def dataset_comparison(results: dict[str, dict]) -> dict:
    """The registered datasets' results side by side, keyed by dataset.

    ``results`` maps dataset key to the results dict ``pipeline.run_dataset``
    emits. Every block below carries one entry per dataset key so the
    dashboard can lay them out as columns.
    """
    keys = list(results)
    if not keys:
        raise ValueError("dataset_comparison needs at least one dataset's results")
    first = results[keys[0]]
    years = [row["year"] for row in first["budget"]]
    first_year = years[0]
    projection = first["metadata"].get("projection", {})
    return {
        "generated": first["metadata"]["generated"],
        "first_year": first_year,
        "years": years,
        "projection_fingerprint": projection.get("fingerprint"),
        "datasets": {
            key: {field: results[key]["metadata"].get(field) for field in DATASET_METADATA_FIELDS}
            for key in keys
        },
        "validation": [
            {
                "metric": name,
                "label": label,
                **{key: _metric(results[key]["validation"], name) for key in keys},
            }
            for name, label in VALIDATION_METRICS
        ],
        "budget": [
            {"year": year, **{key: results[key]["budget"][i] for key in keys}}
            for i, year in enumerate(years)
        ],
        "five_year_total_bn": {
            key: sum(row["gov_balance_change_bn"] for row in results[key]["budget"]) for key in keys
        },
        "sensitivity": [
            {
                "id": row["id"],
                "name": row["name"],
                "e_retention": row["e_retention"],
                "elasticity_parameter": row["elasticity_parameter"],
                "applied_as": row["applied_as"],
                "applied_value": row["applied_value"],
                **{key: results[key]["sensitivity"][i]["revenue_2026_bn"] for key in keys},
                "income_shifting_offset_2026_bn": {
                    key: results[key]["sensitivity"][i]["income_shifting_offset_2026_bn"]
                    for key in keys
                },
            }
            for i, row in enumerate(first["sensitivity"])
        ],
        "top_quintile": {
            key: results[key]["income_change_groups"][first_year]["quintile"][-1] for key in keys
        },
        "household_type": {
            key: results[key]["income_change_groups"][first_year]["household_type"] for key in keys
        },
        "region": {key: results[key]["income_change_groups"][first_year]["region"] for key in keys},
        "schedule_split": {key: results[key]["schedule_split"] for key in keys},
        "benchmarks": _benchmarks_side_by_side(results, keys),
        "approaches": first["approaches"],
        # The central case of each approach whose central runs are not the
        # top-level ones (``APPROACHES[...]["central_id"]`` other than CenTax's
        # published central), in the same shapes as the blocks above.
        "approach_results": {
            approach: _central_side_by_side(
                {key: results[key]["approach_results"][approach] for key in keys}, first_year
            )
            for approach in first["approach_results"]
        },
    }


def _central_side_by_side(central: dict[str, dict], first_year: str) -> dict:
    """One approach's central runs per dataset, shaped like the top-level
    comparison blocks they replace."""
    keys = list(central)
    years = [row["year"] for row in central[keys[0]]["budget"]]
    return {
        "budget": [
            {"year": year, **{key: central[key]["budget"][i] for key in keys}}
            for i, year in enumerate(years)
        ],
        "five_year_total_bn": {
            key: sum(row["gov_balance_change_bn"] for row in central[key]["budget"]) for key in keys
        },
        "top_quintile": {
            key: central[key]["income_change_groups"][first_year]["quintile"][-1] for key in keys
        },
        "household_type": {
            key: central[key]["income_change_groups"][first_year]["household_type"] for key in keys
        },
        "region": {key: central[key]["income_change_groups"][first_year]["region"] for key in keys},
    }


def _benchmarks_side_by_side(results: dict[str, dict], keys: list[str]) -> dict:
    """The like-for-like benchmark figures per dataset: the static yield by
    year beside JRF, and the 2019/20-rules uplift beside CenTax's."""
    first = results[keys[0]]["benchmarks"]
    jrf = {row["year"]: row for row in first["static_equalisation"]["external"]}
    static_rows = {
        key: {
            row["year"]: row for row in results[key]["benchmarks"]["static_equalisation"]["by_year"]
        }
        for key in keys
    }
    fields = (
        "static_cgt_change_bn",
        "static_uplift_pct",
        "static_cgt_change_real_bn",
        "uplift_on_obr_receipts_real_bn",
    )
    return {
        "static_equalisation": [
            {
                "year": row["year"],
                "jrf_bn": jrf[row["year"]]["value"] if row["year"] in jrf else None,
                **{key: {f: static_rows[key][row["year"]][f] for f in fields} for key in keys},
            }
            for row in first["static_equalisation"]["by_year"]
        ],
        "centax_2019_20_rules": {
            "centax_uplift_pct": first["centax_2019_20_rules"]["external"]["value"],
            **{
                key: results[key]["benchmarks"]["centax_2019_20_rules"]["national"]["uplift_pct"]
                for key in keys
            },
        },
        "external": {
            "jrf": [dict(row) for row in JRF_STATIC],
            "centax_table_3": dict(CENTAX_TABLE_3),
        },
    }
