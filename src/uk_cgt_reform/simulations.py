"""Simulation construction on the standard policyengine.py stack.

All simulations are built through the ``policyengine`` package (the
policyengine.py wrapper), never by constructing
``policyengine_uk.Microsimulation`` objects directly:

- ``pe.uk.ensure_datasets`` materialises a published single-year dataset
  file, referenced as a pinned ``hf://owner/repo/path@revision`` URI, as
  one per-year dataset file per simulated year. The pipeline verifies the
  source file's sha256 against the digest recorded here before the wrapper
  builds anything, so a re-tagged or re-uploaded file cannot pass silently.
  Simulations run on those files unmodified: this repo does no local
  reweighting and no local editing of inputs, since calibration and
  imputation belong upstream in the dataset producer.
- ``policyengine.Simulation`` runs the model for one (dataset-year,
  policy) pair, with deterministic ids so policyengine.py's
  output-dataset cache (``<id>.h5`` beside the input dataset file) lets a
  re-run skip completed simulations. The ids carry the dataset key, its
  digest and the projection fingerprint, because the wrapper also keeps an
  in-process cache keyed by id alone.

Two datasets are registered (:data:`DATASETS`): the incumbent Enhanced FRS
2024-25 as published by policyengine-uk-data, and the staged Microcosm UK
2024-25 national-line candidate built on main plus microcosm#979, which
carries the capital gains asset-type breakdown that policyengine-uk 2.99.0
charges on separate schedules. Both are single engine-year files
(``time_period`` 2024) that the engine copies forward and uprates; see
``uprating_audit``.

Wrapper version (load-bearing): policyengine.py 5.0.3 onwards certifies
the UK bundle against a pinned policyengine-uk (2.90.2 in 6.0.0) and
refuses to import with any other version installed. The asset-type CGT
schedules need policyengine-uk 2.99.0 or later, so the pipeline pins the
wrapper to the 4.x series (4.22.3 is the last release), which warns on the
mismatch but runs against the installed engine.

CRITICAL — why reforms go through ``Policy.simulation_modifier`` and not a
plain reform dict: policyengine.py applies a plain-dict reform as
post-construction parameter updates on an unreformed
``policyengine_uk.Microsimulation`` and never registers the baseline
branch, so ``relative_capital_gains_mtr_change``'s
``get_branch("baseline")`` forks the REFORM simulation and the CGT
behavioural elasticity is silently zero (verified empirically: e=0 and
e=-0.7 produced identical revenue). The fix uses policyengine.py's own
first-class ``Policy.simulation_modifier`` hook to (a) register the
baseline branch — ``Microsimulation.clone()`` gives the baseline its own
unreformed parameter tree — and (b) apply the same parameter updates the
wrapper would. Each policyengine.py Simulation covers a single year, so
the shared-system neutralisation bug never bites. The pipeline still
asserts that static (e=0) and central (e=-0.7) runs differ before writing
results.
"""

from __future__ import annotations

import hashlib
import importlib
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

#: The variable policyengine.py reads to fetch the data-release manifest.
WRAPPER_TOKEN_VARIABLE = "HUGGING_FACE_TOKEN"


def import_wrapper(_import=None):
    """Import ``policyengine`` (the wrapper) the way this pipeline needs it.

    On first import policyengine.py 4.22.3 fetches the UK data-release
    manifest from Hugging Face when ``HUGGING_FACE_TOKEN`` is set. That
    manifest certifies the bundled populace-uk-2023 data for policyengine-uk
    2.89.2, not the 2.99.x this pipeline runs on (see the module docstring),
    and the import raises. Without the token the manifest is unavailable and
    the wrapper falls back to its bundled certification with basis
    ``unverified_data_release_manifest_unavailable`` and runs against the
    installed engine, which is how every committed result was produced. So
    the first import happens with the variable removed from the environment,
    and it is restored immediately after: downloads read it at call time.
    :func:`wrapper_certification` exposes the basis for results metadata.

    Observed 2026-09-23 (policyengine 4.22.3, policyengine-uk 2.99.1) with
    ``HUGGING_FACE_TOKEN`` set to a token that can read
    ``policyengine/populace-uk-private``, locally and in a Modal container::

        policyengine/tax_benefit_models/uk/model.py:333   uk_latest = PolicyEngineUKLatest()
        policyengine/tax_benefit_models/common/model_version.py:114
            certify_data_release_compatibility(...)
        policyengine/provenance/manifest.py:505
        ValueError: Data release manifest is not certified for the runtime
        model version 2.99.1 in country 'uk'.

    ``get_data_release_manifest`` reads the variable inside the function, so
    popping it around the import affects only that fetch. A token without
    access to the private data repo gets a 401 on the manifest, which is
    the lenient path, so the failure does not reproduce with such a token.
    """
    if "policyengine" in sys.modules:
        return sys.modules["policyengine"]
    do_import = _import or (lambda: importlib.import_module("policyengine"))
    token = os.environ.pop(WRAPPER_TOKEN_VARIABLE, None)
    try:
        return do_import()
    finally:
        if token is not None:
            os.environ[WRAPPER_TOKEN_VARIABLE] = token


def wrapper_certification() -> dict:
    """How the wrapper certified the installed engine against its bundled
    data release (``compatibility_basis`` is the field to read)."""
    pe = import_wrapper()
    certification = pe.uk.model.data_certification
    return {
        "compatibility_basis": certification.compatibility_basis,
        "certified_for_model_version": certification.certified_for_model_version,
        "data_build_id": certification.data_build_id,
        "built_with_model_version": certification.built_with_model_version,
    }


@dataclass(frozen=True)
class DatasetSpec:
    """One pinned input dataset.

    ``uri`` names the file at an immutable revision (a tag or commit after
    ``@``); ``sha256`` is the digest of that file, checked on download.
    """

    key: str
    label: str
    short_label: str
    role: str
    uri: str
    sha256: str
    base_year: int
    producer: str
    observation: str
    notes: str = ""

    @property
    def digest(self) -> str:
        return self.sha256[:12]

    @property
    def stem(self) -> str:
        """The wrapper's logical name: the file stem without the revision."""
        return Path(self.uri.rsplit("@", 1)[0]).stem

    @property
    def revision(self) -> str:
        return self.uri.rsplit("@", 1)[1]

    def to_metadata(self) -> dict:
        return {**asdict(self), "digest": self.digest, "revision": self.revision}


INCUMBENT = DatasetSpec(
    key="enhanced_frs_2024_25",
    label="Enhanced FRS 2024-25 (policyengine-uk-data 1.57.3)",
    short_label="Enhanced FRS 2024-25",
    role="incumbent",
    uri="hf://policyengine/policyengine-uk-data/enhanced_frs_2024_25.h5@1.57.3",
    sha256="ef34c1ae28219367981fbc3c1144f58ea1f8a77554165fe02ff395b04c5ffea5",
    base_year=2024,
    producer=(
        "policyengine-uk-data 1.57.3, Hugging Face model repo "
        "policyengine/policyengine-uk-data at tag 1.57.3 (commit 25af520a, 2026-09-04)"
    ),
    observation=(
        "FRS 2024-25 households; capital gains imputed onto survey households and "
        "household weights calibrated to HMRC CGT aggregates and size-of-gain bands"
    ),
    notes=(
        "Carries capital_gains only: no asset-type breakdown, so the engine charges "
        "every gain on the main CGT schedule."
    ),
)

CANDIDATE = DatasetSpec(
    key="microcosm_uk_2024_25_979",
    label="Microcosm UK 2024-25, national line on microcosm#979 (staged candidate)",
    short_label="Microcosm UK #979",
    role="candidate",
    uri=(
        "hf://policyengine/populace-uk-private/staged/"
        "uk-frs-calibration-attempt-20260923T134002Z-c1be1c9f/"
        "microcosm_uk_2024_25.h5@f6df65b1e98675ad305bcacf7ede3e0d34b57063"
    ),
    sha256="c5f107ab6eaf74d05c1e17ecd65a4f6876666c4554bd004f76102099aa6de821",
    base_year=2024,
    producer=(
        "microcosm build uk-frs-calibration-attempt-20260923T134002Z-c1be1c9f "
        "(tools/build_uk_rowwise_candidate.py --release-role national on code "
        "e01c6846, main 0f00021c plus PolicyEngine/microcosm#979), staged 2026-09-23 "
        "in the Hugging Face dataset repo policyengine/populace-uk-private (commit "
        "f6df65b1); a staging candidate whose seven calibration-seam gates passed, "
        "not a certified release"
    ),
    observation=(
        "FRS 2024-25 spine; capital gains amounts redrawn from HMRC Table 3 (size of gain "
        "by taxable income, 2024-25) with asset types from HMRC Tables 7 and 8, the "
        "sub-exempt remainder drawn from the Advani-Summers within-band distribution "
        "restricted to (0, exempt amount] and the clone incidence anchored to the "
        "redrawn liable mass (microcosm#970); household weights calibrated to HMRC CGT "
        "totals, age, region and size bands for 2024-25"
    ),
    notes=(
        "Carries capital_gains and capital_gains_residential_property (the residential "
        "schedule); no BADR or carried-interest columns. Sub-exempt gainers hold gains "
        "strictly inside (0, GBP 3,000) rather than at the cap, and the build's "
        "projection fence bounds the stock of them that uprating carries over the "
        "frozen exempt amount by 2030 (68.5k against HMRC's 73k in the GBP 3,000 to "
        "5,999 band)."
    ),
)

DATASETS: dict[str, DatasetSpec] = {spec.key: spec for spec in (INCUMBENT, CANDIDATE)}

#: The dataset whose results the dashboard shows first. The candidate is the
#: default because it is the dataset this comparison exists to evaluate and
#: the only one carrying the asset-type schedules the reform charges; the
#: 21 September 2026 hesitation (the sub-exempt entrants artefact) was removed
#: upstream by microcosm#970. The candidate is re-pinned when
#: PolicyEngine/microcosm#979 lands on main, replacing this PR-head build with
#: one from main, and again when a certified national release exists; the
#: production default is confirmed when the branch merges.
DEFAULT_DATASET_KEY = CANDIDATE.key

#: Kept for callers that still import the single-dataset constants.
DATASET = INCUMBENT.uri
BASE_YEAR = INCUMBENT.base_year

# Variables needed beyond policyengine.py's bundled UK defaults. The
# schedule components are inputs of policyengine-uk 2.99.0+ (zero where a
# dataset does not carry them); ``region`` is the engine's own enum, present
# in every UK dataset, and replaces the output-area code passthrough that
# only the incumbent file carries.
EXTRA_VARIABLES = {
    "person": [
        "capital_gains",
        "capital_gains_before_response",
        "capital_gains_tax",
        "capital_gains_residential_property",
        "capital_gains_badr",
        "capital_gains_carried_interest",
    ],
    "household": ["gov_tax", "gov_balance", "region"],
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def materialise_source(spec: DatasetSpec) -> Path:
    """Download (or reuse from the Hugging Face cache) the pinned source file
    and verify its digest against the registry."""
    import_wrapper()
    from policyengine.provenance.dataset_sources import materialize_dataset_source

    path = Path(materialize_dataset_source(spec.uri))
    digest = sha256_file(path)
    if digest != spec.sha256:
        raise RuntimeError(
            f"Dataset {spec.key} at {spec.uri} has sha256 {digest}, expected "
            f"{spec.sha256}. Refusing to simulate on an unverified file."
        )
    return path


def ensure_uk_datasets(
    spec: DatasetSpec, years: list[int], data_folder: str | Path
) -> dict[int, object]:
    """Materialise (or load) the per-year datasets the engine derives from
    ``spec``'s single-year file. Returns ``{year: PolicyEngineUKDataset}``.

    ``data_folder`` must be specific to the dataset digest and the engine's
    projection: the wrapper reuses any per-year file it finds there.
    """
    pe = import_wrapper()

    materialise_source(spec)
    datasets = pe.uk.ensure_datasets(
        datasets=[spec.uri],
        years=list(years),
        data_folder=str(data_folder),
    )
    return {ds.year: ds for ds in datasets.values()}


def make_policy(reform: dict, name: str):
    """Wrap a ``{parameter_path: {start_date: value}}`` reform dict in a
    policyengine.py ``Policy`` whose ``simulation_modifier`` registers the
    baseline branch (required for the CGT elasticity — see module
    docstring) before applying the parameter updates."""
    import_wrapper()
    from policyengine.core.policy import Policy
    from policyengine_core.periods import period

    def modifier(sim):
        # Register the baseline branch so the CGT behavioural response can
        # measure the unreformed MTR (policyengine-uk's
        # relative_capital_gains_mtr_change reads branches["baseline"]).
        sim.branches["baseline"] = sim.baseline
        for path, dates in reform.items():
            parameter = sim.tax_benefit_system.parameters.get_child(path)
            for start, value in dates.items():
                parameter.update(value=value, start=period(start))
        return sim

    return Policy(name=name, simulation_modifier=modifier)


def run_simulation(dataset, policy=None, sim_id: str | None = None, *, persist: bool = True):
    """Build and run a policyengine.py Simulation. ``policy`` is a ``Policy``
    from :func:`make_policy` (or None for the baseline).

    With ``persist`` (the pipeline) the wrapper's output-dataset cache is
    used: a completed ``<id>.h5`` beside the input file is loaded instead of
    re-run, and a fresh run is written there. With ``persist=False`` (the
    rate explorer's reform runs) the simulation runs in memory and nothing
    is written.
    """
    pe = import_wrapper()

    sim = pe.Simulation(
        **({"id": sim_id} if sim_id else {}),
        dataset=dataset,
        tax_benefit_model_version=pe.uk.model,
        policy=policy,
        extra_variables=EXTRA_VARIABLES,
    )
    if persist:
        sim.ensure()
    else:
        sim.run()
    return sim
