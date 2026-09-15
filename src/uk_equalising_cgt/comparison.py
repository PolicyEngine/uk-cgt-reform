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
