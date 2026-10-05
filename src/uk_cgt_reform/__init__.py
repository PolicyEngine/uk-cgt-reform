"""Reforms to UK capital gains tax rates.

The pipeline scores equalising CGT rates with income tax rates (basic
18->20%, higher 24->40%, additional 24->45%) from
2026-27, over fiscal years 2026-27 to 2030-31, via the policyengine.py
wrapper on every registered dataset (``simulations.DATASETS``, each as
published, with no local reweighting) and a behavioural response at
PolicyEngine's capital gains elasticity (-0.7 with respect to the marginal
tax rate), with CenTax's and the official retention-rate elasticities beside
it. The rate explorer (``explore``) scores any schedule of main rates through
the same code.
"""

from .reform import (
    ELASTICITY,
    INCOME_TAX_RATES,
    YEARS,
    equalisation_reform,
    mtr_response,
    retention_response,
)

__all__ = [
    "INCOME_TAX_RATES",
    "ELASTICITY",
    "YEARS",
    "equalisation_reform",
    "mtr_response",
    "retention_response",
    "run",
]


def __getattr__(name: str):
    # `run` pulls in the policyengine.py stack, which only the
    # [simulation] extra installs; import it lazily so the pure-logic tests
    # run without it.
    if name == "run":
        from .pipeline import run

        return run
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
