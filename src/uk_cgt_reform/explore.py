"""Live evaluation of a chosen CGT rate schedule: the dashboard's Rate explorer.

The Reform impacts tab scores one reform, equalisation with income tax, from
the committed results files. The explorer scores any schedule of main rates
a reader chooses, on the same pinned per-year datasets, the same engine and
projection, the same cached baseline simulations and the same impact code
(``impacts``). An explorer run of 20/40/45 therefore reproduces the tab's
figures: its scope (``reform.EXPLORER_SCOPE``) differs from the Burnham
reform only in parameters that are inert on both registered datasets.

Two runners share every function here. ``run_locally`` backs the
``uk-cgt-reform-explore`` command, which the dashboard's Next route also
shells out to when no backend is configured; the Modal workers in
``backend/`` call ``run_year`` for the five years in parallel and
``assemble_response`` once. Neither writes a simulation output file: reform
simulations run in memory (``run_simulation(..., persist=False)``) and only
the pre-built baselines are read from disk.

Every successful run is cached. The key (:func:`cache_key`) carries the
dataset key and digest, the projection fingerprint, the engine and wrapper
versions and the reform fingerprint, which digests the rates and the
elasticity. A later request for the same schedule on the same inputs is
served from the store; a change in any input cannot reuse a stale result.
:class:`ResultStore` is the durable layer, a directory of JSON files
(``data/explore_results/`` locally, the data Volume on Modal); the Modal
gateway keeps a ``modal.Dict`` in front of it.
"""

from __future__ import annotations

import datetime
import functools
import hashlib
import importlib.metadata
import json
import math
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

from .comparison import READY_RECKONER, SENSITIVITY_CASES
from .impacts import budget_impact, fiscal_year_label, income_change_groups
from .reform import (
    BURNHAM_RATES,
    ELASTICITY,
    EXPLORER_SCOPE,
    OFFICIAL_ELASTICITY,
    PERIOD,
    RATE_BANDS,
    YEARS,
    cgt_rate_reform,
    elasticity_assignment,
    elasticity_convention,
    rate_reform_schedules,
    reform_fingerprint,
)
from .simulations import (
    DATASETS,
    DEFAULT_DATASET_KEY,
    DatasetSpec,
    import_wrapper,
    make_policy,
    run_simulation,
    wrapper_certification,
)

#: Each rate must lie in this closed interval (a fraction, not a percentage).
RATE_BOUNDS = (0.0, 0.75)
#: Rates are rounded to this many decimals before anything is keyed on them.
RATE_DECIMALS = 4
#: Custom rates are whole percentage points: each rate must be a multiple of
#: this fraction. With the ordering rule (basic <= higher <= additional) this
#: bounds the number of distinct schedules a visitor can ask the backend to
#: compute to about 76,000 per dataset and elasticity.
RATE_STEP = 0.01

#: The behavioural assumptions a request may pick from: the pipeline's
#: sensitivity cases, keyed for the API by their marginal-tax-rate value.
#: ``applied_as`` says which engine convention carries each: the official
#: HMRC/OBR case is applied as a retention-rate elasticity of 3.6
#: (``reform.RETENTION_NATIVE``).
ELASTICITY_OPTIONS = tuple(
    {"id": option_id, "label": label, "e_mtr": e_mtr, **elasticity_convention(e_mtr)}
    for option_id, label, e_mtr in (
        ("static", "Static (no behavioural response)", 0.0),
        ("centax_lower", "CenTax lower (retention elasticity 0.5)", -0.35),
        ("centax_central", "CenTax central (retention elasticity 1.0)", -0.7),
        ("official", "HMRC/OBR official (retention elasticity 3.6)", OFFICIAL_ELASTICITY),
    )
)
DEFAULT_ELASTICITY = ELASTICITY
assert {o["e_mtr"] for o in ELASTICITY_OPTIONS} == set(SENSITIVITY_CASES.values())

#: Schedules a reader can start from. Rates are fractions.
PRESETS = (
    {
        "id": "current_law",
        "label": "Current law (18% / 24% / 24%)",
        "rates": {"basic_rate": 0.18, "higher_rate": 0.24, "additional_rate": 0.24},
    },
    {
        "id": "income_tax",
        "label": "Equalise with income tax (20% / 40% / 45%)",
        "rates": dict(BURNHAM_RATES),
    },
    {
        "id": "flat_30",
        "label": "30% above the basic rate band (18% / 30% / 30%)",
        "rates": {"basic_rate": 0.18, "higher_rate": 0.30, "additional_rate": 0.30},
    },
    {
        "id": "flat_35",
        "label": "35% above the basic rate band (18% / 35% / 35%)",
        "rates": {"basic_rate": 0.18, "higher_rate": 0.35, "additional_rate": 0.35},
    },
)

#: Context fields a cache key needs. ``engine_context`` provides them from
#: the installed engine; the Modal manifest records the versions and the
#: projection so the gateway can key a lookup without importing the engine,
#: and ``code_fingerprint`` always comes from the code that is running.
CONTEXT_KEYS = (
    "projection_fingerprint",
    "policyengine_uk_version",
    "policyengine_version",
    "policyengine_core_version",
    "code_fingerprint",
)

#: Source files whose logic shapes a result. Their digest is part of every
#: cache key, so a change to the impact code cannot serve a stale result.
CODE_FINGERPRINT_FILES = (
    "reform.py",
    "impacts.py",
    "explore.py",
    "simulations.py",
    "pipeline.py",
    "uprating_audit.py",
)


@functools.lru_cache(maxsize=1)
def code_fingerprint() -> str:
    """Short digest of this package's result-shaping source files."""
    here = Path(__file__).resolve().parent
    digest = hashlib.sha256()
    for name in CODE_FINGERPRINT_FILES:
        digest.update(name.encode())
        digest.update((here / name).read_bytes())
    return digest.hexdigest()[:12]


#: Directory name of the local result cache under ``data/``.
LOCAL_RESULT_DIR_NAME = "explore_results"

_KEY_PATTERN = re.compile(r"[A-Za-z0-9._-]+")


class ExploreValidationError(ValueError):
    """A request the explorer refuses; the message is safe to show a user."""


@dataclass(frozen=True)
class ExploreRequest:
    """A validated request: one dataset, one rate schedule, one elasticity."""

    dataset_key: str
    rates: dict
    elasticity: float

    @property
    def spec(self) -> DatasetSpec:
        return DATASETS[self.dataset_key]

    def reform(self) -> dict:
        return cgt_rate_reform(self.rates, self.elasticity)

    @property
    def fingerprint(self) -> str:
        return reform_fingerprint(self.reform())

    def to_payload(self) -> dict:
        return {
            "dataset": self.dataset_key,
            "rates": dict(self.rates),
            "elasticity": self.elasticity,
        }


def _as_rate(value, band: str) -> float:
    lo, hi = RATE_BOUNDS
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ExploreValidationError(
            f"{band} must be a number between {lo} and {hi} (a fraction: 0.3 for 30%)."
        )
    rate = float(value)
    if not math.isfinite(rate) or not lo <= rate <= hi:
        raise ExploreValidationError(f"{band} must be between {lo} and {hi}; got {value}.")
    steps = rate / RATE_STEP
    if abs(steps - round(steps)) > 1e-6:
        raise ExploreValidationError(
            f"{band} must be a whole percentage point (a multiple of {RATE_STEP}); got {value}."
        )
    return round(round(steps) * RATE_STEP, RATE_DECIMALS)


def _as_elasticity(value) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ExploreValidationError("elasticity must be a number.")
    for option in ELASTICITY_OPTIONS:
        if math.isclose(option["e_mtr"], float(value), abs_tol=1e-9):
            return option["e_mtr"]
    allowed = ", ".join(str(o["e_mtr"]) for o in ELASTICITY_OPTIONS)
    raise ExploreValidationError(f"elasticity must be one of {allowed}; got {value}.")


def validate_request(payload) -> ExploreRequest:
    """Check a request body and normalise it.

    ``payload`` is ``{"dataset": key, "rates": {band: fraction}, "elasticity": e}``;
    ``dataset`` defaults to the dashboard's default dataset and ``elasticity``
    to the central case. Every band must be present, within
    :data:`RATE_BOUNDS`, a whole percentage point (:data:`RATE_STEP`), and
    ordered basic <= higher <= additional: the engine splits gains above the
    basic rate band only so that a reform can charge an additional rate on
    top, and a basic rate above the higher rate is not a schedule anyone
    proposes. The ordering and the step keep the space of computable
    schedules bounded.
    """
    if not isinstance(payload, dict):
        raise ExploreValidationError("The request body must be a JSON object.")
    dataset_key = payload.get("dataset", DEFAULT_DATASET_KEY)
    if dataset_key not in DATASETS:
        raise ExploreValidationError(
            f"Unknown dataset {dataset_key!r}; known datasets: {', '.join(sorted(DATASETS))}."
        )
    raw = payload.get("rates")
    if not isinstance(raw, dict):
        raise ExploreValidationError(
            "rates must be an object with basic_rate, higher_rate and additional_rate."
        )
    rates = {}
    for band in RATE_BANDS:
        if band not in raw:
            raise ExploreValidationError(f"rates is missing {band}.")
        rates[band] = _as_rate(raw[band], band)
    if rates["additional_rate"] + 1e-9 < rates["higher_rate"]:
        raise ExploreValidationError(
            "The additional rate must be at least the higher rate; set them equal for a "
            "single rate above the basic rate band, as in current law."
        )
    if rates["basic_rate"] > rates["higher_rate"] + 1e-9:
        raise ExploreValidationError("The basic rate may not exceed the higher rate.")
    elasticity = _as_elasticity(payload.get("elasticity", DEFAULT_ELASTICITY))
    return ExploreRequest(dataset_key=dataset_key, rates=rates, elasticity=elasticity)


def api_options() -> dict:
    """What a client needs to build a request: bounds, options, presets,
    datasets. No engine import."""
    return {
        "rate_bands": list(RATE_BANDS),
        "rate_bounds": list(RATE_BOUNDS),
        "rate_decimals": RATE_DECIMALS,
        "rate_step": RATE_STEP,
        "elasticity_options": [dict(o) for o in ELASTICITY_OPTIONS],
        "default_elasticity": DEFAULT_ELASTICITY,
        # The default option's parameter; each option names its own.
        "elasticity_parameter": elasticity_convention(DEFAULT_ELASTICITY)["elasticity_parameter"],
        "presets": [{**p, "rates": dict(p["rates"])} for p in PRESETS],
        "ready_reckoner": json.loads(json.dumps(READY_RECKONER)),
        "scope": EXPLORER_SCOPE,
        "years": list(YEARS),
        "reform_period_start": PERIOD,
        "datasets": [spec.to_metadata() for spec in DATASETS.values()],
        "default_dataset_key": DEFAULT_DATASET_KEY,
    }


def baseline_rates(year: int = YEARS[0]) -> dict:
    """The installed engine's main CGT rates on 6 April of ``year``."""
    from policyengine_uk.system import system

    cgt = system.parameters.gov.hmrc.cgt
    date = f"{year}-04-06"
    return {band: round(float(getattr(cgt, band)(date)), RATE_DECIMALS) for band in RATE_BANDS}


@functools.lru_cache(maxsize=1)
def engine_context() -> dict:
    """Everything about the installed engine a run needs, computed once per
    process: the projection audit and its fingerprint, the exempt amounts
    and entrant ceilings, the baseline rates and the package versions."""
    from .pipeline import entrant_ceilings, exempt_amounts, shared_base_year
    from .uprating_audit import engine_audit, projection_fingerprint

    specs = list(DATASETS.values())
    base_year = shared_base_year(specs)
    audit = engine_audit(base_year, YEARS)
    aea = exempt_amounts(sorted({base_year, *YEARS}))
    return {
        "base_year": base_year,
        "audit": audit,
        "projection_fingerprint": projection_fingerprint(audit),
        "exempt_amounts": aea,
        "entrant_ceilings": entrant_ceilings(audit, aea[base_year], YEARS),
        "baseline_rates": baseline_rates(),
        "policyengine_version": importlib.metadata.version("policyengine"),
        "policyengine_uk_version": importlib.metadata.version("policyengine-uk"),
        "policyengine_core_version": importlib.metadata.version("policyengine-core"),
        "code_fingerprint": code_fingerprint(),
        "wrapper_certification": wrapper_certification(),
    }


#: Context fields ``manifest_payload`` records and ``context_from_manifest``
#: restores, so a Modal container can assemble a response without the engine.
MANIFEST_FIELDS = (
    "base_year",
    "projection_fingerprint",
    "policyengine_version",
    "policyengine_uk_version",
    "policyengine_core_version",
    "baseline_rates",
    "wrapper_certification",
)


def manifest_payload(context: dict) -> dict:
    """A JSON-safe record of the engine context (year keys as strings) for
    ``backend/warm.py`` to write beside the warmed datasets."""
    return {
        **{field: context[field] for field in MANIFEST_FIELDS},
        "exempt_amounts": {str(y): v for y, v in context["exempt_amounts"].items()},
        "entrant_ceilings": {str(y): v for y, v in context["entrant_ceilings"].items()},
        "years": list(YEARS),
        "warmed_at": datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds"),
    }


def context_from_manifest(manifest: dict) -> dict:
    """The context :func:`assemble_response` and :func:`cache_key` need,
    from a manifest plus the fingerprint of the code that is running (never
    the manifest's: a code change must miss the cache without a re-warm)."""
    missing = [field for field in MANIFEST_FIELDS if field not in manifest]
    if missing:
        raise ValueError(f"manifest is missing {missing}")
    return {
        **{field: manifest[field] for field in MANIFEST_FIELDS},
        "exempt_amounts": {int(y): float(v) for y, v in manifest["exempt_amounts"].items()},
        "entrant_ceilings": {int(y): float(v) for y, v in manifest["entrant_ceilings"].items()},
        "code_fingerprint": code_fingerprint(),
    }


def cache_key(req: ExploreRequest, context: dict) -> str:
    """The result-cache key: dataset key and digest, projection fingerprint,
    engine, wrapper and core versions, this package's code fingerprint,
    reform fingerprint. Safe as a file name."""
    missing = [key for key in CONTEXT_KEYS if key not in context]
    if missing:
        raise ValueError(f"context is missing {missing}")
    parts = (
        req.dataset_key,
        req.spec.digest,
        context["projection_fingerprint"],
        context["policyengine_uk_version"],
        context["policyengine_version"],
        context["policyengine_core_version"],
        context["code_fingerprint"],
        req.fingerprint,
    )
    key = "__".join(str(part) for part in parts)
    if not _KEY_PATTERN.fullmatch(key):
        raise ValueError(f"cache key {key!r} is not file-name safe")
    return key


class ResultStore:
    """Durable result cache: one ``<key>.json`` per completed run in a
    directory. Writes are atomic (temporary file, then rename)."""

    def __init__(self, directory: str | Path):
        self.directory = Path(directory)

    def path(self, key: str) -> Path:
        return self.directory / f"{key}.json"

    def get(self, key: str) -> dict | None:
        path = self.path(key)
        if not path.exists():
            return None
        return json.loads(path.read_text())

    def put(self, key: str, result: dict) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.path(key)
        tmp = path.parent / (path.name + ".tmp")
        tmp.write_text(json.dumps(result, indent=2))
        os.replace(tmp, path)
        return path

    def keys(self) -> list[str]:
        if not self.directory.exists():
            return []
        return sorted(path.name[: -len(".json")] for path in self.directory.glob("*.json"))


def dataset_metadata(spec: DatasetSpec) -> dict:
    """The per-dataset metadata fields the pipeline's results carry."""
    return {
        "dataset": spec.uri,
        "dataset_key": spec.key,
        "dataset_label": spec.label,
        "dataset_short_label": spec.short_label,
        "dataset_role": spec.role,
        "dataset_sha256": spec.sha256,
        "dataset_producer": spec.producer,
        "dataset_observation": spec.observation,
        "dataset_notes": spec.notes,
    }


def per_year_dataset(spec: DatasetSpec, year: int, folder: Path):
    """Load the per-year dataset file the pipeline (or ``backend/warm.py``)
    materialised for ``spec`` in ``folder``."""
    import_wrapper()
    from policyengine.tax_benefit_models.uk.datasets import PolicyEngineUKDataset

    path = Path(folder) / f"{spec.stem}_year_{year}.h5"
    if not path.exists():
        raise FileNotFoundError(
            f"Per-year dataset {path} is missing; run uk-cgt-reform-build (locally) or "
            "backend/warm.py (Modal) first."
        )
    return PolicyEngineUKDataset(
        name=f"{spec.stem}-year-{year}",
        description=f"UK Dataset for year {year} based on {spec.stem}",
        filepath=str(path),
        year=int(year),
    )


def run_year(req: ExploreRequest, year: int, folder: Path, context: dict | None = None) -> dict:
    """Score one (dataset, year): the cached baseline against an in-memory
    reform run. Returns the year's budget row and distributional groups in
    the pipeline's shapes, plus the seconds it took."""
    context = context or engine_context()
    folder = Path(folder)
    sim_stem = folder.name
    baseline_id = f"{sim_stem}_baseline_{year}"
    # Baselines are built and persisted once (the pipeline locally,
    # backend/warm.py on Modal); a request never recomputes one, because a
    # worker's write would not be committed to the Volume.
    if not (folder / f"{baseline_id}.h5").exists():
        raise FileNotFoundError(
            f"Baseline output {folder / (baseline_id + '.h5')} is missing; run "
            "uk-cgt-reform-build (locally) or backend/warm.py (Modal) first."
        )
    started = time.perf_counter()
    dataset = per_year_dataset(req.spec, year, folder)
    baseline = run_simulation(dataset, sim_id=baseline_id)
    reform = run_simulation(
        dataset,
        policy=make_policy(req.reform(), f"explore_{req.fingerprint}"),
        sim_id=f"{sim_stem}_explore_{req.fingerprint}_{year}",
        persist=False,
    )
    budget = budget_impact(
        {year: baseline},
        {year: reform},
        [year],
        context["exempt_amounts"],
        context["entrant_ceilings"],
    )[0]
    groups = income_change_groups(baseline, reform)
    return {
        "year": fiscal_year_label(year),
        "budget": budget,
        "income_change_groups": groups,
        "seconds": round(time.perf_counter() - started, 2),
    }


def assemble_response(
    req: ExploreRequest,
    context: dict,
    year_rows: list[dict],
    *,
    computed_at: str | None = None,
) -> dict:
    """The explorer's result: metadata, five budget rows and the
    distributional groups keyed by fiscal year, in the pipeline's shapes."""
    labels = [fiscal_year_label(year) for year in YEARS]
    rows = {row["year"]: row for row in year_rows}
    missing = [label for label in labels if label not in rows]
    if missing or len(year_rows) != len(labels):
        raise ValueError(f"year rows must cover exactly {labels}; missing {missing}")
    ordered = [rows[label] for label in labels]
    budget = [row["budget"] for row in ordered]
    generated = computed_at or datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    aea = context["exempt_amounts"]
    ceilings = context["entrant_ceilings"]
    per_year_seconds = {row["year"]: row.get("seconds") for row in ordered}
    return {
        "metadata": {
            "generated": generated,
            "policyengine_version": context["policyengine_version"],
            "policyengine_uk_version": context["policyengine_uk_version"],
            "wrapper_certification": dict(context["wrapper_certification"]),
            **dataset_metadata(req.spec),
            "reform_period_start": PERIOD,
            "elasticity": req.elasticity,
            "elasticity_parameter": elasticity_convention(req.elasticity)["elasticity_parameter"],
            "elasticity_applied": elasticity_assignment(req.elasticity),
            "reform": dict(req.rates),
            "reform_scope": EXPLORER_SCOPE,
            "reform_schedules": rate_reform_schedules(req.rates),
            "reform_dict": req.reform(),
            "reform_fingerprint": req.fingerprint,
            "baseline_rates": dict(context["baseline_rates"]),
            "years": list(YEARS),
            "exempt_amount_gbp": {fiscal_year_label(y): aea[y] for y in YEARS},
            "entrant_ceiling_gbp": {fiscal_year_label(y): ceilings[y] for y in YEARS},
            "projection": {
                "fingerprint": context["projection_fingerprint"],
                "base_year": context["base_year"],
            },
            "timing": {
                "per_year_seconds": per_year_seconds,
                "total_seconds": round(sum(s for s in per_year_seconds.values() if s), 2),
            },
            "cache": {"hit": False, "key": cache_key(req, context), "computed_at": generated},
        },
        "budget": budget,
        "income_change_groups": {row["year"]: row["income_change_groups"] for row in ordered},
        "five_year_total_bn": sum(row["gov_balance_change_bn"] for row in budget),
    }


def mark_cache_hit(result: dict) -> dict:
    """A copy of a stored result flagged as served from the cache."""
    copy = json.loads(json.dumps(result))
    cache = copy.setdefault("metadata", {}).setdefault("cache", {})
    cache["hit"] = True
    return copy


def run_locally(
    req: ExploreRequest,
    *,
    data_folder: str | Path | None = None,
    store: ResultStore | None = None,
    use_cache: bool = True,
    log=None,
) -> dict:
    """Score a request on this machine: five years in sequence against the
    per-year files under ``data_folder`` (default: the pipeline's
    ``data/policyengine_datasets``), served from and written to ``store``
    (default: ``data/explore_results``)."""
    from .pipeline import DATA_DIR, DATASET_FOLDER, dataset_folder

    context = engine_context()
    store = store or ResultStore(DATA_DIR / LOCAL_RESULT_DIR_NAME)
    key = cache_key(req, context)
    if use_cache:
        cached = store.get(key)
        if cached is not None:
            return mark_cache_hit(cached)
    folder = dataset_folder(
        req.spec,
        context["projection_fingerprint"],
        Path(data_folder) if data_folder else DATASET_FOLDER,
    )
    rows = []
    for year in YEARS:
        if log:
            log(f"    {fiscal_year_label(year)}...")
        rows.append(run_year(req, year, folder, context))
        if log:
            log(f"    {rows[-1]['year']}: {rows[-1]['seconds']}s")
    result = assemble_response(req, context, rows)
    store.put(key, result)
    return result
