"""Names and resources shared by the rate explorer's Modal apps.

Three apps share one image, one Volume and one Dict:

- ``workers.py`` (``uk-cgt-reform-workers``): ``run_year`` scores one
  (dataset, year) per container; ``run_reform`` fans the five years out,
  assembles the result and caches it.
- ``warm.py`` (``uk-cgt-reform-warm``): a one-off ``modal run`` that
  materialises the per-year datasets and baseline outputs into the Volume
  and writes ``manifest.json``.
- ``modal_app.py`` (``uk-cgt-reform``): the always-cheap gateway
  (FastAPI, proxy-authenticated) that serves cached results itself and
  spawns ``run_reform`` otherwise.

Only ``modal`` is imported at module level; the pipeline package is
installed into the image from ``src/`` and imported inside functions.
"""

from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parents[1]

WORKERS_APP_NAME = "uk-cgt-reform-workers"
WARM_APP_NAME = "uk-cgt-reform-warm"
GATEWAY_APP_NAME = "uk-cgt-reform"
VOLUME_NAME = "uk-cgt-reform-data"
RESULTS_DICT_NAME = "uk-cgt-reform-results"
HF_SECRET_NAME = "huggingface"  # must define HUGGING_FACE_TOKEN

# Layout of the Volume: the same folder names the pipeline uses locally
# under data/, so the explorer resolves identical simulation ids.
DATA_ROOT = "/data"
DATASETS_ROOT = f"{DATA_ROOT}/policyengine_datasets"
RESULTS_DIR = f"{DATA_ROOT}/explore_results"
MANIFEST_PATH = f"{DATA_ROOT}/manifest.json"

PYTHON_VERSION = "3.13"
SOURCE_IGNORE = ["**/__pycache__/**", "**/*.pyc"]

JOBS_DICT_NAME = "uk-cgt-reform-jobs"
#: Uncached schedules computing at once, across every visitor. Each fans out
#: five 4-CPU containers, so this bounds the queue, not only concurrency.
MAX_IN_FLIGHT = 3
#: A job entry older than this is treated as dead (run_reform times out at 1500 s).
JOB_TTL_SECONDS = 1800
USAGE_DICT_NAME = "uk-cgt-reform-usage"
#: Uncached schedules the gateway will start per UTC day, across every
#: visitor: a spend cap that needs no Modal billing access. At the measured
#: cost of about $0.10 per schedule this is about $25 a day at most.
DAILY_COMPUTE_BUDGET = 250

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True)
results = modal.Dict.from_name(RESULTS_DICT_NAME, create_if_missing=True)
# cache key -> {"job_id", "submitted_at"} for schedules being computed, so a
# second request for the same schedule joins the running job instead of
# starting another, and the number in flight stays bounded.
jobs = modal.Dict.from_name(JOBS_DICT_NAME, create_if_missing=True)
# UTC date -> number of schedules spawned that day (cached hits never count).
usage = modal.Dict.from_name(USAGE_DICT_NAME, create_if_missing=True)

# The engine image: the pinned runtime plus the pipeline package.
engine_image = (
    modal.Image.debian_slim(python_version=PYTHON_VERSION)
    .pip_install_from_requirements(str(ROOT / "backend" / "requirements.txt"))
    .add_local_dir(
        str(ROOT / "src" / "uk_cgt_reform"),
        "/root/uk_cgt_reform",
        ignore=SOURCE_IGNORE,
    )
    # Modal ships the entrypoint file on its own; this shared module must be
    # added explicitly or the container's import of it fails.
    .add_local_python_source("common")
)

# The gateway image: no engine. ``uk_cgt_reform.explore`` imports numpy
# at module level (through ``impacts``) and nothing heavier.
gateway_image = (
    modal.Image.debian_slim(python_version=PYTHON_VERSION)
    .pip_install("fastapi==0.141.1", "numpy==2.5.3")
    .add_local_dir(
        str(ROOT / "src" / "uk_cgt_reform"),
        "/root/uk_cgt_reform",
        ignore=SOURCE_IGNORE,
    )
    .add_local_python_source("common")
)


def read_manifest() -> dict:
    """The manifest ``warm.py`` wrote, after refreshing the Volume view."""
    import json

    volume.reload()
    path = Path(MANIFEST_PATH)
    if not path.exists():
        raise FileNotFoundError(
            f"{MANIFEST_PATH} is missing: run `modal run backend/warm.py` before serving."
        )
    return json.loads(path.read_text())
