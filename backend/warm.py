"""One-off: fill the Volume with what a request needs, so no request ever
touches Hugging Face or builds a dataset.

    modal run backend/warm.py            # every registered dataset
    modal run backend/warm.py --dataset microcosm_uk_2024_25_979

For each dataset: verify the pinned source's sha256, materialise the
per-year files with ``pe.uk.ensure_datasets`` (the wrapper's own code, as
the pipeline does), run and persist the five baseline simulations, then
write ``manifest.json`` (versions, projection fingerprint, exempt amounts,
entrant ceilings, baseline rates) which the gateway and ``run_reform`` read
instead of importing the engine. Idempotent: existing files are reused.
Needs the ``huggingface`` secret (``HUGGING_FACE_TOKEN``) for the private
data repos.
"""

import json
from pathlib import Path

import modal
from common import (
    DATA_ROOT,
    DATASETS_ROOT,
    HF_SECRET_NAME,
    MANIFEST_PATH,
    WARM_APP_NAME,
    engine_image,
    volume,
)

app = modal.App(WARM_APP_NAME)


@app.function(
    image=engine_image,
    volumes={DATA_ROOT: volume},
    secrets=[modal.Secret.from_name(HF_SECRET_NAME)],
    cpu=4.0,
    memory=32768,
    timeout=3600,
)
def warm(dataset_keys: list[str]) -> dict:
    import os

    # The engine reads HUGGING_FACE_TOKEN; accept HF_TOKEN too, and refuse an
    # empty or missing value here rather than as a 401 deep inside the download.
    token = os.environ.get("HUGGING_FACE_TOKEN") or os.environ.get("HF_TOKEN") or ""
    if not token.strip():
        raise RuntimeError(
            f"The Modal secret {HF_SECRET_NAME!r} must define HUGGING_FACE_TOKEN (or HF_TOKEN) "
            "with a non-empty Hugging Face token that can read the private PolicyEngine data "
            'repos. Recreate it: modal secret create huggingface HUGGING_FACE_TOKEN="$HF_TOKEN" --force'
        )
    os.environ["HUGGING_FACE_TOKEN"] = token
    os.environ["HF_TOKEN"] = token

    from uk_cgt_reform.explore import engine_context, manifest_payload
    from uk_cgt_reform.pipeline import dataset_folder
    from uk_cgt_reform.reform import YEARS
    from uk_cgt_reform.simulations import DATASETS, ensure_uk_datasets, run_simulation

    context = engine_context()
    print(f"engine projection {context['projection_fingerprint']}")
    for key in dataset_keys:
        spec = DATASETS[key]
        folder = dataset_folder(spec, context["projection_fingerprint"], Path(DATASETS_ROOT))
        print(f"[{key}] per-year datasets in {folder}")
        datasets = ensure_uk_datasets(spec, YEARS, folder)
        for year in YEARS:
            sim_id = f"{folder.name}_baseline_{year}"
            print(f"[{key}] baseline {year} ({sim_id})")
            run_simulation(datasets[year], sim_id=sim_id)
        volume.commit()
    manifest = manifest_payload(context)
    manifest["datasets"] = {key: DATASETS[key].to_metadata() for key in dataset_keys}
    Path(MANIFEST_PATH).write_text(json.dumps(manifest, indent=2))
    volume.commit()
    print(f"wrote {MANIFEST_PATH}")
    return manifest


@app.local_entrypoint()
def main(dataset: str = "all"):
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
    from uk_cgt_reform.simulations import DATASETS

    keys = list(DATASETS) if dataset == "all" else [dataset]
    unknown = [key for key in keys if key not in DATASETS]
    if unknown:
        raise SystemExit(f"unknown dataset(s) {unknown}; known: {sorted(DATASETS)}")
    manifest = warm.remote(keys)
    print(json.dumps({k: v for k, v in manifest.items() if k != "datasets"}, indent=2))
