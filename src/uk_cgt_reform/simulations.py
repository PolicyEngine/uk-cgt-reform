"""Simulation construction on the standard policyengine.py stack.

All simulations are built through the ``policyengine`` package (the
policyengine.py wrapper), never by constructing
``policyengine_uk.Microsimulation`` objects directly:

- ``pe.uk.ensure_datasets`` materialises the published single-year
  dataset as one per-year dataset file per simulated year. The dataset is
  the release policyengine.py 6.10.1 bundles and certifies for its pinned
  policyengine-uk (2.132.6): it is requested by its logical name, the
  wrapper verifies the file's sha256 against the bundle, and the pipeline
  checks that digest against the one recorded here as well, so a re-tagged
  or re-uploaded file cannot pass silently. Simulations run on those files
  unmodified: this repo does no local reweighting and no local editing of
  inputs, since calibration and imputation belong upstream in the dataset
  producer.
- ``policyengine.Simulation`` runs the model for one (dataset-year,
  policy) pair, with deterministic ids so policyengine.py's
  output-dataset cache (``<id>.h5`` beside the input dataset file) lets a
  re-run skip completed simulations. The ids carry the dataset key, its
  digest and the projection fingerprint, because the wrapper also keeps an
  in-process cache keyed by id alone.

One dataset is registered (:data:`DATASETS`): the published Microcosm UK
2024-25 national release, which carries the capital gains asset-type and
relief breakdown that policyengine-uk 2.99.0 charges on separate schedules.
It is a single engine-year file (``time_period`` 2024)
that the engine copies forward and uprates; see ``uprating_audit``.

Versions: the pipeline runs on policyengine.py 6.10.1, which pins
policyengine-uk 2.132.6 and policyengine-core 3.33.3, the versions the
Microcosm UK 2024-25 release was built with and is certified for. 2.132.6
already charges the residential-property schedule, carries
``capital_gains_badr`` and the four
``gov.simulation.capital_gains_responses`` settings this repo sets.

Reforms go through ``Policy.simulation_modifier`` rather than a plain
reform dict, so every case applies its parameter updates the same way (to
the reform simulation's own parameter tree, after construction) and the
simulation ids stay those of the cached outputs. policyengine-uk measures
the CGT behavioural response against ``simulation.baseline``, which it
builds as an unreformed clone; the modifier also registers that baseline
as the ``baseline`` branch. Each policyengine.py Simulation covers a single
year. The pipeline asserts that static (e=0) and central (e=1.0) runs
differ before writing results.
"""

from __future__ import annotations

import hashlib
import importlib
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path


def import_wrapper():
    """Import ``policyengine`` (the wrapper).

    With ``HUGGING_FACE_TOKEN`` set the wrapper checks its bundled
    certification against the data release manifest on Hugging Face (basis
    ``exact_build_model_version``); without it, it uses the bundled
    certification (``built_with_model_package``). Both certify the pinned
    policyengine-uk for the Microcosm UK 2024-25 release;
    :func:`wrapper_certification` records which basis a run used.
    """
    return importlib.import_module("policyengine")


def wrapper_certification() -> dict:
    """How the wrapper certified the installed engine against its bundled
    data release (``compatibility_basis`` is the field to read), and the
    release bundle it certified."""
    pe = import_wrapper()
    certification = pe.uk.model.data_certification
    bundle = pe.uk.model.release_bundle
    return {
        "compatibility_basis": certification.compatibility_basis,
        "certified_for_model_version": certification.certified_for_model_version,
        "data_build_id": certification.data_build_id,
        "built_with_model_version": certification.built_with_model_version,
        "bundle_id": bundle.get("bundle_id"),
        "certified_data_artifact_sha256": bundle.get("certified_data_artifact_sha256"),
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
    columns: str = ""

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


#: The published release. The URI names the file on the dataset repo's main
#: branch at the commit that published it; the release's own immutable cut
#: (the tag in ``producer``) holds the same file, digest included.
CANDIDATE = DatasetSpec(
    key="microcosm_uk_2024_25",
    label="Microcosm UK 2024-25, national release published 19 October 2026",
    short_label="Microcosm UK 2024-25",
    role="release",
    uri=(
        "hf://policyengine/populace-uk-private/"
        "microcosm_uk_2024_25.h5@52f48aa177944b7d07c3f25403f1fddbcd1a74af"
    ),
    sha256="810ba980005a8b907cb51464279fa5e0125464b7af9a4871b7f6744c30951ece",
    base_year=2024,
    producer=(
        "Microcosm UK release microcosm-uk-2024-25-national, cut "
        "microcosm-uk-2024-25-national-20261019T083323Z-6cba5d71 (build "
        "uk-frs-calibration-attempt-20261019T083323Z-6cba5d71 on microcosm 810315ac, the "
        "head of PolicyEngine/microcosm#1316, merged later that day, with "
        "policyengine-uk 2.132.6), published "
        "2026-10-19 on the main branch of the Hugging Face dataset repo "
        "policyengine/populace-uk-private (commit 52f48aa1); a certified release: "
        "its 39 spine, 7 calibration-seam and 19 release-cut gates passed"
    ),
    observation=(
        "FRS 2024-25 spine; capital gains amounts drawn from HMRC Table 3 (size of gain "
        "by taxable income, 2024-25) with asset types from HMRC Tables 7 and 8, gains "
        "qualifying for Business Asset Disposal Relief and Investors' Relief imputed from "
        "HMRC Table 4, and the sub-exempt remainder drawn from the Advani-Summers "
        "within-band distribution; household weights calibrated to 1,215 targets, among "
        "them HMRC's CGT totals, size bands, gains by taxable income band (Table 3), age, "
        "region, the BADR bands (Table 4) and residential property gains"
    ),
    notes=(
        "The build's projection fence bounds the gainers that uprating carries over the "
        "frozen exempt amount by 2030 at 7.0k, against HMRC's 73k taxpayers with gains of "
        "£3,000 to £5,999 in 2024-25 (Table 2.1a); this repo's uprating audit counts "
        "7.1k on policyengine-uk 2.132.6."
    ),
    columns=(
        "It carries capital_gains, capital_gains_residential_property (the residential "
        "schedule) and capital_gains_badr (gains qualifying for Business Asset Disposal "
        "Relief or Investors' Relief), and no carried-interest column."
    ),
)

DATASETS: dict[str, DatasetSpec] = {spec.key: spec for spec in (CANDIDATE,)}

#: The dataset every result is computed on.
DEFAULT_DATASET_KEY = CANDIDATE.key


# Variables needed beyond policyengine.py's bundled UK defaults. The
# schedule components are inputs of policyengine-uk 2.99.0+ (zero where a
# dataset does not carry them); ``region`` is the engine's own enum, present
# in every UK dataset.
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


def bundle_check(spec: DatasetSpec) -> dict:
    """The wrapper's bundle entry for ``spec``, checked against the registry:
    the bundle must certify the same file (same sha256) this repo pins."""
    pe = import_wrapper()
    manifest = pe.uk.model.release_manifest
    entry = manifest.datasets.get(spec.key)
    if entry is None:
        raise RuntimeError(
            f"policyengine.py {manifest.policyengine_version} bundles no dataset named "
            f"{spec.key}; known: {sorted(manifest.datasets)}."
        )
    if entry.sha256 != spec.sha256:
        raise RuntimeError(
            f"policyengine.py's bundle certifies {spec.key} with sha256 {entry.sha256}, "
            f"but this repo pins {spec.sha256}. Refusing to simulate on another file."
        )
    return {"revision": entry.revision, "sha256": entry.sha256}


def _seed_from_hub(spec: DatasetSpec, destination: Path) -> None:
    """Place the pinned file (``spec.uri``, at its commit) where the wrapper
    looks for it, from the Hugging Face cache or a download through
    ``huggingface_hub`` (which reads the stored or environment token). The
    wrapper then finds a file with the bundle's digest and does not
    download it again."""
    from huggingface_hub import hf_hub_download

    repo_path, revision = spec.uri.removeprefix("hf://").rsplit("@", 1)
    owner, repo, filename = repo_path.split("/", 2)
    cached = hf_hub_download(
        repo_id=f"{owner}/{repo}",
        filename=filename,
        revision=revision,
        repo_type="dataset",
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".partial")
    shutil.copyfile(cached, partial)
    partial.replace(destination)


def materialise_source(spec: DatasetSpec, data_folder: str | Path) -> Path:
    """Materialise the pinned source file in ``data_folder`` through the
    wrapper's bundle (which verifies the bundle's sha256) and verify its
    digest against the registry as well."""
    import_wrapper()
    from policyengine.provenance.dataset_materialization import materialize_dataset

    bundle_check(spec)
    destination = Path(data_folder) / Path(spec.uri.rsplit("@", 1)[0]).name
    if not destination.exists() or sha256_file(destination) != spec.sha256:
        _seed_from_hub(spec, destination)
    source = materialize_dataset("uk", spec.key, data_dir=Path(data_folder))
    path = Path(source.path)
    digest = sha256_file(path)
    if digest != spec.sha256:
        raise RuntimeError(
            f"Dataset {spec.key} at {path} has sha256 {digest}, expected "
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

    materialise_source(spec, data_folder)
    datasets = pe.uk.ensure_datasets(
        datasets=[spec.key],
        years=list(years),
        data_folder=str(data_folder),
    )
    return {ds.year: ds for ds in datasets.values()}


def make_policy(reform: dict, name: str):
    """Wrap a ``{parameter_path: {start_date: value}}`` reform dict in a
    policyengine.py ``Policy`` whose ``simulation_modifier`` registers the
    unreformed baseline as the ``baseline`` branch and applies the parameter
    updates to the reform simulation (see the module docstring)."""
    import_wrapper()
    from policyengine.core.policy import Policy
    from policyengine_core.periods import period

    def modifier(sim):
        # The unreformed baseline policyengine-uk measures the CGT
        # behavioural response against, registered as a branch too.
        sim.branches["baseline"] = sim.baseline
        for path, dates in reform.items():
            parameter = sim.tax_benefit_system.parameters.get_child(path)
            for start, value in dates.items():
                parameter.update(value=value, start=period(start))
        return sim

    return Policy(name=name, simulation_modifier=modifier)


_RESPONSE_SYSTEM = None

#: The response settings under ``gov.simulation.capital_gains_responses``.
RESPONSE_SETTINGS = "gov.simulation.capital_gains_responses"
RESPONSE_SETTING_NAMES = (
    "elasticity",
    "mtr_elasticity",
    "separate_badr_elasticity",
    "badr_elasticity",
)


def resolve_response(settings: dict, current_law: dict, year: int) -> dict:
    """The realisation response that ``settings`` (each of
    :data:`RESPONSE_SETTING_NAMES` in force in ``year``) select, against
    ``current_law`` (the same settings unreformed), in the shape of
    policyengine-uk's ``CapitalGainsResponseAssumption.to_dict()``.

    policyengine-uk 2.132.6 applies the response in ``realisation_factors``:
    main-rate gains scale by the retention-rate change to the power
    ``elasticity``, gains qualifying for Business Asset Disposal Relief by
    ``badr_elasticity`` when ``separate_badr_elasticity`` is true and by
    ``elasticity`` otherwise, and a nonzero ``mtr_elasticity`` selects the
    marginal-rate convention instead, raising if a retention-rate elasticity
    in force is also nonzero. This resolves the same settings the same way.
    It has no defaults to auto-resolve (2.132.6 raises instead), so
    ``mtr_auto_resolved`` is always false and ``warnings`` empty.
    """
    main = float(settings["elasticity"])
    mtr = float(settings["mtr_elasticity"])
    separate = bool(settings["separate_badr_elasticity"])
    badr = float(settings["badr_elasticity"]) if separate else main
    changed = {
        name: float(settings[name]) != float(current_law[name]) for name in RESPONSE_SETTING_NAMES
    }

    def source(name: str) -> str:
        return "override" if changed[name] else "default"

    sources = {
        "elasticity": source("elasticity"),
        "badr_elasticity": (
            "override"
            if changed["separate_badr_elasticity"] or changed["badr_elasticity"]
            else "default"
        )
        if separate
        else source("elasticity"),
        "mtr_elasticity": source("mtr_elasticity"),
        "separate_badr_elasticity": source("separate_badr_elasticity"),
    }
    if mtr != 0 and (main != 0 or badr != 0):
        raise ValueError(
            f"{RESPONSE_SETTINGS}: a retention-rate elasticity ({main:g}, BADR {badr:g}) "
            f"and mtr_elasticity ({mtr:g}) cannot both be nonzero in {year}."
        )
    if mtr != 0:
        convention = "mtr"
    elif main == 0 and badr == 0:
        convention = "static"
    else:
        convention = "retention"
    return {
        "period": str(int(year)),
        "convention": convention,
        "elasticity": 0.0 if mtr != 0 else main,
        "badr_elasticity": 0.0 if mtr != 0 else badr,
        "mtr_elasticity": mtr,
        "separate_badr_elasticity": separate,
        "sources": sources,
        "mtr_auto_resolved": False,
        "warnings": [],
    }


def _settings(system, year: int) -> dict:
    from policyengine_core.periods import period

    node = system.parameters.get_child(RESPONSE_SETTINGS)
    instant = period(str(int(year))).start
    return {name: node.children[name](instant) for name in RESPONSE_SETTING_NAMES}


def response_assumption(reform: dict, year: int) -> dict:
    """The realisation response policyengine-uk applies under ``reform`` in
    ``year``: the convention (``retention``, ``mtr`` or ``static``), the
    elasticities in force and whether each is current law or set by the
    reform.

    It is resolved on a clone of the engine's tax-benefit system with the
    reform's parameter updates applied exactly as :func:`make_policy`'s
    modifier applies them, so it does not depend on a simulation having run
    (a cached one never builds its microsimulation). The pinned
    policyengine-uk (2.132.6) has no report of its own
    (``capital_gains_response_assumption`` arrives in 2.134.0), so it is
    resolved by :func:`resolve_response` from the settings the engine reads.
    Raises where the engine would, on settings that conflict.
    """
    global _RESPONSE_SYSTEM
    import_wrapper()
    from policyengine_core.periods import period
    from policyengine_uk import CountryTaxBenefitSystem

    if _RESPONSE_SYSTEM is None:
        _RESPONSE_SYSTEM = CountryTaxBenefitSystem()
    system = _RESPONSE_SYSTEM.clone()
    for path, dates in reform.items():
        parameter = system.parameters.get_child(path)
        for start, value in dates.items():
            parameter.update(value=value, start=period(start))
    return resolve_response(_settings(system, year), _settings(_RESPONSE_SYSTEM, year), year)


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
