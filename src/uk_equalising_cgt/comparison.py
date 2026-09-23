"""Static data: other institutions' revenue estimates for CGT-income-tax
equalisation (not all model the identical package).

- CenTax (Advani, Lonsdale & Summers 2024): equalisation PLUS base broadening
  (death-uplift removal, rebasing on arrival / exit charge, investment
  allowance); retention-rate elasticity 1.0 (range 0.5-2.0); ~£14bn/yr
  central, £9.7bn worst-case.
- Advani & Summers (2020, CAGE): taxing gains at income tax rates, static:
  £16.7bn/yr.
- HMRC ready reckoner: +10pp on higher CGT rates only, implied very high
  elasticity (unpublished): -£2bn/yr by year 3 (loses revenue).
- OBR baseline: CGT receipts under current policy, £21.8bn (2025-26), from
  the March 2026 Economic and fiscal outlook, Table 3.7 (see
  ``uprating_audit.OBR_CGT_RECEIPTS_BN`` for the full 2025-26 to 2030-31
  path).
"""

from __future__ import annotations

# Sensitivity cases: each shop's elasticity converted to PolicyEngine's MTR
# convention at the reformed 40-45% top rates (e_mtr = e_retention * t/(1-t)).
SENSITIVITY_CASES = {
    "Static (Advani & Summers 2020 style)": 0.0,
    "CenTax lower (retention e=0.5)": -0.35,
    "CenTax central (retention e=1.0)": -0.7,
}

EXTERNAL_ESTIMATES = [
    {
        "source": "CenTax central (Advani, Lonsdale & Summers 2024)",
        "reform_modelled": "Equalisation + base broadening (death-uplift removal, exit charges, investment allowance)",
        "behavioural_assumption": "Retention-rate elasticity 1.0 (range 0.5-2.0)",
        "revenue_bn_per_year": 14.0,
    },
    {
        "source": "CenTax worst-case (elasticity upper bound)",
        "reform_modelled": "Equalisation + base broadening",
        "behavioural_assumption": "Retention-rate elasticity upper bound",
        "revenue_bn_per_year": 9.7,
    },
    {
        "source": "Advani & Summers (GDP-uprated)",
        "reform_modelled": "Taxing gains at income tax rates, static",
        "behavioural_assumption": "None (static)",
        "revenue_bn_per_year": 16.7,
    },
    {
        "source": "HMRC ready reckoner (+10pp higher rates, yr 3)",
        "reform_modelled": "+10pp on higher CGT rates only",
        "behavioural_assumption": "Implied very high elasticity (unpublished)",
        "revenue_bn_per_year": -2.0,
    },
    {
        "source": "OBR baseline (2025-26 CGT receipts, EFO March 2026 Table 3.7)",
        "reform_modelled": "CGT receipts under current policy (no reform)",
        "behavioural_assumption": "n/a",
        "revenue_bn_per_year": 21.8,
    },
]


def comparison_rows(
    revenue_2026_bn: float, five_year_avg_bn: float, static_2026_bn: float
) -> list[dict]:
    """This model's rows plus the external benchmarks."""
    return [
        {
            "source": "This model, 2026-27 (rate-only, e=-0.7)",
            "reform_modelled": "Rate equalisation only",
            "behavioural_assumption": "MTR elasticity -0.7 (from CenTax retention e=1.0, converted at reformed rates)",
            "revenue_bn_per_year": revenue_2026_bn,
        },
        {
            "source": "This model, 5-year average",
            "reform_modelled": "Rate equalisation only",
            "behavioural_assumption": "MTR elasticity -0.7",
            "revenue_bn_per_year": five_year_avg_bn,
        },
        {
            "source": "This model, static (e=0)",
            "reform_modelled": "Rate equalisation only",
            "behavioural_assumption": "None (static)",
            "revenue_bn_per_year": static_2026_bn,
        },
        *EXTERNAL_ESTIMATES,
    ]


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
                "name": row["name"],
                "e_mtr": row["e_mtr"],
                **{key: results[key]["sensitivity"][i]["revenue_2026_bn"] for key in keys},
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
    }
