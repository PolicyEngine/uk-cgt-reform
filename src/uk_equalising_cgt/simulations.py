"""Simulation construction on the standard policyengine.py stack.

All simulations are built through the ``policyengine`` package (the
policyengine.py wrapper), never by constructing
``policyengine_uk.Microsimulation`` objects directly:

- ``pe.uk.ensure_datasets`` materialises the published Enhanced FRS 2024-25
  dataset, referenced directly as an ``hf://`` URI (the policyengine.py
  4.20.0 release manifest only certifies ``enhanced_frs_2023_24``, so the
  newer dataset is pulled from the policyengine-uk-data Hugging Face repo
  at its latest revision; a private-repo token is read from
  ``HUGGING_FACE_TOKEN``), as one per-year dataset file per simulated
  year.
  Simulations run on those files unmodified: this repo does no local
  reweighting, since calibration belongs upstream in
  policyengine-uk-data.
- ``policyengine.Simulation`` runs the model for one (dataset-year,
  policy) pair, with deterministic ids so policyengine.py's
  output-dataset cache (``<id>.h5`` beside the input dataset file) lets a
  re-run skip completed simulations.

CRITICAL — why reforms go through ``Policy.simulation_modifier`` and not a
plain reform dict: policyengine.py 4.20.0 applies a plain-dict reform as
post-construction parameter updates on an unreformed
``policyengine_uk.Microsimulation`` and never registers the baseline
branch, so ``relative_capital_gains_mtr_change``'s
``get_branch("baseline")`` forks the REFORM simulation and the CGT
behavioural elasticity is silently zero (verified empirically: e=0 and
e=-0.7 produced identical revenue). The fix uses policyengine.py's own
first-class ``Policy.simulation_modifier`` hook to (a) register the
baseline branch — ``Microsimulation.clone()`` gives the baseline its own
unreformed parameter tree — and (b) apply the same parameter updates the
wrapper would. The old multi-year "restore the neutralised response
variable" workaround is gone: each policyengine.py Simulation covers a
single year, so the shared-system neutralisation bug never bites.
The pipeline still asserts that static (e=0) and central (e=-0.7) runs
differ before writing results.
"""

from __future__ import annotations

from pathlib import Path

DATASET = "hf://policyengine/policyengine-uk-data/enhanced_frs_2024_25.h5"
# Engine period of the published single-year file (``time_period`` 2024, the
# FRS 2024-25 observation). The engine copies this year forward and uprates
# it year on year; see ``uprating_audit`` for the factors applied.
BASE_YEAR = 2024

# Variables needed beyond policyengine.py's bundled UK defaults.
EXTRA_VARIABLES = {
    "person": ["capital_gains", "capital_gains_tax"],
    "household": ["gov_tax", "gov_balance"],
}


def ensure_uk_datasets(years: list[int], data_folder: str | Path) -> dict[int, object]:
    """Materialise (or load) the published Enhanced FRS dataset for each year.

    Returns a mapping ``{year: PolicyEngineUKDataset}``.
    """
    import policyengine as pe

    datasets = pe.uk.ensure_datasets(
        datasets=[DATASET],
        years=list(years),
        data_folder=str(data_folder),
    )
    return {ds.year: ds for ds in datasets.values()}


def make_policy(reform: dict, name: str):
    """Wrap a ``{parameter_path: {start_date: value}}`` reform dict in a
    policyengine.py ``Policy`` whose ``simulation_modifier`` registers the
    baseline branch (required for the CGT elasticity — see module
    docstring) before applying the parameter updates."""
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


def run_simulation(dataset, policy=None, sim_id: str | None = None):
    """Build and run (with output-dataset caching) a policyengine.py
    Simulation. ``policy`` is a ``Policy`` from :func:`make_policy` (or
    None for the baseline)."""
    import policyengine as pe

    sim = pe.Simulation(
        **({"id": sim_id} if sim_id else {}),
        dataset=dataset,
        tax_benefit_model_version=pe.uk.model,
        policy=policy,
        extra_variables=EXTRA_VARIABLES,
    )
    sim.ensure()
    return sim
