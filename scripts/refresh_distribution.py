"""Add decile and age outputs without changing any committed fiscal estimates.

Run with ``uv run python scripts/refresh_distribution.py``. Each year runs in
a separate process to release simulation memory. Existing group results and
CGT totals must reproduce before any result file is written.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

from uk_cgt_reform.impacts import cgt_revenue, fiscal_year_label, income_change_groups
from uk_cgt_reform.pipeline import (
    DATA_DIR,
    REPO_ROOT,
    dataset_folder,
    equalisation_sim_id,
    simulation_stem,
)
from uk_cgt_reform.reform import equalisation_reform, reform_fingerprint
from uk_cgt_reform.simulations import DATASETS, ensure_uk_datasets, make_policy, run_simulation
from uk_cgt_reform.uprating_audit import engine_audit, projection_fingerprint

RESULTS = DATA_DIR / "cgt_equalisation_results.json"


def refresh_year(data: dict, year: int) -> dict:
    metadata = data["metadata"]
    spec = DATASETS[metadata["dataset_key"]]
    for package, field in (
        ("policyengine", "policyengine_version"),
        ("policyengine-uk", "policyengine_uk_version"),
    ):
        if importlib.metadata.version(package) != metadata[field]:
            raise ValueError(f"Install the committed {package} version {metadata[field]} first.")
    if spec.sha256 != metadata["dataset_sha256"]:
        raise ValueError("Dataset differs from the committed results.")
    fingerprint = projection_fingerprint(engine_audit(spec.base_year, metadata["years"]))
    if fingerprint != metadata["projection"]["fingerprint"]:
        raise ValueError("Projection differs from the committed results.")
    reform = equalisation_reform(metadata["elasticity"])
    digest = reform_fingerprint(reform)
    if digest != metadata["reform_fingerprint"]:
        raise ValueError("Reform differs from the committed results.")
    dataset = ensure_uk_datasets(spec, [year], dataset_folder(spec, fingerprint))[year]
    stem = simulation_stem(spec, fingerprint)
    baseline = run_simulation(dataset, sim_id=f"{stem}_baseline_{year}")
    reformed = run_simulation(
        dataset,
        policy=make_policy(reform, "Refresh distribution"),
        sim_id=equalisation_sim_id(stem, metadata["elasticity"], digest, year),
    )
    label = fiscal_year_label(year)
    budget = next(row for row in data["budget"] if row["year"] == label)
    for sim, key in ((baseline, "baseline_cgt_bn"), (reformed, "reform_cgt_bn")):
        np.testing.assert_allclose(cgt_revenue(sim) / 1e9, budget[key], rtol=1e-7, atol=1e-7)
    groups = income_change_groups(baseline, reformed)
    for key, rows in data["income_change_groups"][label].items():
        for previous, current in zip(rows, groups[key], strict=True):
            assert previous["group"] == current["group"]
            for metric in ("avg_change_gbp", "relative_change_pct"):
                np.testing.assert_allclose(previous[metric], current[metric], rtol=1e-7, atol=1e-5)
    print(f"Verified {label}: existing groups and revenue reproduced.", flush=True)
    return {key: groups[key] for key in ("decile", "age")}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = json.loads(RESULTS.read_text())
    if args.year is not None:
        if args.output is None:
            parser.error("--year requires --output")
        args.output.write_text(json.dumps(refresh_year(data, args.year)))
        return
    with tempfile.TemporaryDirectory(prefix="cgt-distribution-") as tmp:
        for year in data["metadata"]["years"]:
            path = Path(tmp) / f"{year}.json"
            subprocess.run(
                [sys.executable, __file__, "--year", str(year), "--output", str(path)], check=True
            )
            data["income_change_groups"][fiscal_year_label(year)].update(
                json.loads(path.read_text())
            )
    payload = json.dumps(data, indent=2)
    RESULTS.write_text(payload)
    (REPO_ROOT / "dashboard/public/data" / RESULTS.name).write_text(payload)
    print("Added decile and age groups. All existing output values are unchanged.")


if __name__ == "__main__":
    main()
