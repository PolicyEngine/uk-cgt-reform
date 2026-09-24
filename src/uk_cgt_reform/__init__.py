"""Reforms to UK capital gains tax rates.

The pipeline scores equalising CGT rates with income tax rates (the
"Burnham" reform: basic 18->20%, higher 24->40%, additional 24->45%) from
2026-27, over fiscal years 2026-27 to 2030-31, via the policyengine.py
wrapper on every registered dataset (``simulations.DATASETS``, each as
published, with no local reweighting) and an Advani/CenTax-aligned
behavioural response. The rate explorer (``explore``) scores any schedule of
main rates through the same code.
"""

from .reform import BURNHAM_RATES, ELASTICITY, YEARS, burnham_reform, retention_to_mtr_elasticity

__all__ = [
    "BURNHAM_RATES",
    "ELASTICITY",
    "YEARS",
    "burnham_reform",
    "retention_to_mtr_elasticity",
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
