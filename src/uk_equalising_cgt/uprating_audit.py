"""Audit of the capital-gains projection inherited from the model's uprating.

Issue #2, proposed work item 1: record the factors actually applied to the
capital gains base and to household weights in every analysis year, the
source vintage of each, and (when simulations are available) the resulting
baseline gains, taxpayer counts and CGT liability.

How the projection happens today
--------------------------------
``pe.uk.ensure_datasets`` builds ``policyengine_uk.Microsimulation`` on the
published single-year Enhanced FRS file (``time_period`` 2024, i.e. the
FRS 2024-25 observation), and the engine's
``extend_single_year_dataset`` copies that year forward to 2030 and calls
``apply_uprating``: for every ``index -> [variables]`` entry of the
engine's ``data/uprating_indices.yaml`` it multiplies each variable by
``1 + growth(index, year)`` year on year, starting from the base year.
This module reads the same YAML and the same growth parameters from the
*installed* engine, so the audit describes whatever version the pipeline
actually runs on, and records that version.

Nothing here changes a simulation. The audit is a description, the OBR
receipts table is carried unbridged (receipts are not gains, and lag them),
and the CPI series is reported only as the sensitivity the issue names.

The audit is dataset-independent (it describes the engine), except for the
``baseline_by_year`` block, which the pipeline fills per registered dataset,
and the ``datasets`` block, which records each dataset's pinned revision and
digest.
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
from collections.abc import Callable, Mapping
from pathlib import Path

# Variables whose projection the analysis depends on. The gains variables
# drive the CGT base; the household weight carries population growth.
AUDITED_VARIABLES = (
    "capital_gains",
    "capital_gains_before_response",
    "household_weight",
)

# The sensitivity index the issue asks to compare against. Reported, not
# applied.
CPI_INDEX = "gov.economic_assumptions.yoy_growth.obr.consumer_price_index"

# OBR Economic and fiscal outlook, March 2026, Table 3.7: CGT receipts
# (GBP bn, fiscal years). Receipts, not gains: cash lags the liability,
# which lags the realisation, so these cannot be applied to same-year
# gains without the timing bridge the issue asks for (work item 2).
OBR_CGT_RECEIPTS_BN = {
    "2025-26": 21.8,
    "2026-27": 20.8,
    "2027-28": 25.5,
    "2028-29": 28.9,
    "2029-30": 32.0,
    "2030-31": 34.9,
}
OBR_CGT_RECEIPTS_SOURCE = "OBR Economic and fiscal outlook, March 2026, Table 3.7"

GrowthLookup = Callable[[str, int], float]


def engine_version() -> str:
    return importlib.metadata.version("policyengine-uk")


def load_engine_uprating_indices() -> dict[str, list[str]]:
    """The installed engine's ``index -> [variables]`` uprating map."""
    import policyengine_uk
    import yaml

    path = Path(policyengine_uk.__file__).parent / "data" / "uprating_indices.yaml"
    with open(path) as f:
        return yaml.safe_load(f)


def engine_growth_lookup() -> tuple[GrowthLookup, Callable[[str], dict]]:
    """Growth-rate and metadata lookups against the installed engine's
    parameter tree, in the form ``apply_single_year_uprating`` uses."""
    from policyengine_uk.system import system

    parameters = system.parameters

    def growth(index: str, year: int) -> float:
        return float(parameters.get_child(index)(str(year)))

    def metadata(index: str) -> dict:
        return dict(getattr(parameters.get_child(index), "metadata", {}) or {})

    return growth, metadata


def index_for(variable: str, indices: Mapping[str, list[str]]) -> str | None:
    """The uprating index assigned to ``variable``, or None if it is held
    nominal (not uprated)."""
    matches = [index for index, variables in indices.items() if variable in variables]
    if len(matches) > 1:
        raise ValueError(f"{variable} is uprated by more than one index: {matches}")
    return matches[0] if matches else None


def cumulative_factors(
    index: str, growth: GrowthLookup, base_year: int, years: list[int]
) -> dict[int, dict[str, float]]:
    """Year-on-year and cumulative-from-base factors for ``index``.

    Mirrors the engine: year ``y`` is the previous year times
    ``1 + growth(index, y)``, for every year after the base year, so the
    cumulative factor at an analysis year is the product over
    ``base_year + 1 .. year``.
    """
    rows: dict[int, dict[str, float]] = {}
    cumulative = 1.0
    for year in range(base_year + 1, max(years) + 1):
        rate = growth(index, year)
        cumulative *= 1.0 + rate
        if year in years:
            rows[year] = {"yoy_growth": rate, "cumulative_factor": cumulative}
    return rows


# Reviewed source vintages for indices whose engine metadata does not name
# a versioned release. The engine's ``ons.population`` series carries only
# "ONS Population Projections" and the ONS homepage; its values were set by
# policyengine-uk PR #1305 (commit b9efbaf8, 2025-08-08) from the OBR's
# long-term economic determinants published with the March 2025 EFO, which
# adopt the ONS 2022-based national population projections. The March 2026
# EFO refresh (policyengine-uk PR #1514) did not revise the series. The
# ``values_of_record`` are the rates the audit was reviewed against; the
# audit reports whether the installed engine still carries them, so an
# engine bump that moves the population path is visible rather than silent.
REVIEWED_VINTAGES: dict[str, dict] = {
    "gov.economic_assumptions.yoy_growth.ons.population": {
        "publisher": "Office for Budget Responsibility",
        "release": (
            "Long-term economic determinants - March 2025 Economic and fiscal "
            "outlook (xlsx, published 19 June 2025), population growth row"
        ),
        "href": (
            "https://obr.uk/download/long-term-economic-determinants-march-2025-"
            "economic-and-fiscal-outlook/"
        ),
        "basis": "ONS 2022-based national population projections as adopted by the OBR",
        "engine_provenance": {
            "repository": "PolicyEngine/policyengine-uk",
            "parameter": "gov.economic_assumptions.yoy_growth.ons.population",
            "pull_request": 1305,
            "commit": "b9efbaf8",
            "note": (
                "Engine metadata cites 'ONS Population Projections' with an "
                "unversioned href; the March 2026 EFO refresh (PR #1514) left "
                "this series unchanged."
            ),
        },
        "values_of_record": {
            "2025": 0.0072,
            "2026": 0.0038,
            "2027": 0.0037,
            "2028": 0.0040,
            "2029": 0.0044,
            "2030": 0.0045,
        },
        "workbook_reread": (
            "not re-read for this audit: the OBR download endpoint refuses "
            "non-browser requests; values of record are the engine series as "
            "committed in PR #1305"
        ),
    }
}


def reviewed_vintage(index: str, growth: GrowthLookup) -> dict | None:
    """The reviewed vintage for ``index`` with a check of the installed
    engine against the values of record, or None if the engine's own
    reference is already versioned."""
    vintage = REVIEWED_VINTAGES.get(index)
    if vintage is None:
        return None
    drift = {}
    for year, expected in vintage["values_of_record"].items():
        observed = growth(index, int(year))
        if abs(observed - expected) > 1e-9:
            drift[year] = {"engine": observed, "of_record": expected}
    return {
        **{k: v for k, v in vintage.items() if k != "values_of_record"},
        "values_of_record": dict(vintage["values_of_record"]),
        "engine_matches_values_of_record": not drift,
        "drift": drift,
    }


def _reference(metadata: dict) -> dict:
    refs = metadata.get("reference") or []
    return {
        "label": metadata.get("label"),
        "reference": [
            {"title": r.get("title"), "href": r.get("href")} if isinstance(r, dict) else r
            for r in refs
        ],
    }


def audit_uprating(
    *,
    indices: Mapping[str, list[str]],
    growth: GrowthLookup,
    metadata: Callable[[str], dict],
    base_year: int,
    years: list[int],
    variables: tuple[str, ...] = AUDITED_VARIABLES,
    version: str | None = None,
) -> dict:
    """The factor table: which index each audited variable follows, the
    year-on-year rate and cumulative factor in every analysis year, and
    the parameter's stated source (the vintage)."""
    table = {}
    for variable in variables:
        index = index_for(variable, indices)
        if index is None:
            table[variable] = {"index": None, "note": "held nominal (no uprating index)"}
            continue
        vintage = reviewed_vintage(index, growth)
        table[variable] = {
            "index": index,
            **_reference(metadata(index)),
            **({"reviewed_vintage": vintage} if vintage else {}),
            "by_year": {
                str(y): row
                for y, row in cumulative_factors(index, growth, base_year, years).items()
            },
        }
    cpi = {
        "index": CPI_INDEX,
        "applied_to": [],
        **_reference(metadata(CPI_INDEX)),
        "by_year": {
            str(y): row
            for y, row in cumulative_factors(CPI_INDEX, growth, base_year, years).items()
        },
    }
    return {
        "policyengine_uk_version": version or engine_version(),
        "base_year": base_year,
        "base_year_note": (
            "Engine period of the published single-year Enhanced FRS 2024-25 file "
            "(time_period 2024); the observation is the FRS 2024-25 survey year. "
            "Uprating runs year on year from the base year; the base year itself "
            "is not uprated."
        ),
        "years": list(years),
        "variables": table,
        "sensitivity_not_applied": {"cpi": cpi},
        "obr_cgt_receipts_bn": {
            "source": OBR_CGT_RECEIPTS_SOURCE,
            "basis": "cash receipts by fiscal year; unbridged to gains (see issue #2, item 2)",
            "values": dict(OBR_CGT_RECEIPTS_BN),
        },
    }


def projection_fingerprint(audit: dict) -> str:
    """Short digest of the projection actually applied: engine version, base
    year and every audited factor. Folded into simulation ids so a change
    in the projection cannot reuse cached simulation outputs."""
    payload = {
        "policyengine_uk_version": audit["policyengine_uk_version"],
        "base_year": audit["base_year"],
        "variables": {
            v: {"index": row.get("index"), "by_year": row.get("by_year", {})}
            for v, row in audit["variables"].items()
        },
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return digest[:12]


def engine_audit(base_year: int, years: list[int]) -> dict:
    """The audit against the installed engine."""
    growth, metadata = engine_growth_lookup()
    return audit_uprating(
        indices=load_engine_uprating_indices(),
        growth=growth,
        metadata=metadata,
        base_year=base_year,
        years=years,
    )


def baseline_by_year(
    baseline_sims: Mapping[int, object],
    exempt_amounts: Mapping[int, float] | None = None,
    ceilings: Mapping[int, float] | None = None,
) -> dict[str, dict]:
    """Per-year baseline gains, taxpayer counts and CGT liability from the
    simulations' output datasets (native microdf, published weights). With
    ``exempt_amounts`` and ``ceilings`` each year also reports the entrants
    by uprating (see ``impacts``)."""
    from .impacts import AEA, validation_stats

    return {
        str(year): validation_stats(
            sim,
            (exempt_amounts or {}).get(year, AEA),
            (ceilings or {}).get(year),
        )
        for year, sim in sorted(baseline_sims.items())
    }


def write_audit(audit: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(audit, indent=2) + "\n")
