"""Modal workers for the rate explorer.

``run_year`` scores one (dataset, year) in its own container against the
Volume's per-year dataset and cached baseline; ``run_reform`` fans the five
years out in parallel, assembles the response with the pipeline's own code
and writes it to both cache layers (the ``modal.Dict`` and the Volume's
``explore_results/``) before returning. Workers scale to zero: no
``min_containers`` or ``keep_warm`` anywhere.

Deploy order: ``modal deploy backend/workers.py`` → ``modal run
backend/warm.py`` → ``modal deploy backend/modal_app.py``.
"""

import modal
from common import (
    DATA_ROOT,
    DATASETS_ROOT,
    RESULTS_DIR,
    WORKERS_APP_NAME,
    engine_image,
    jobs,
    read_manifest,
    results,
    volume,
)

app = modal.App(WORKERS_APP_NAME)


@app.function(
    image=engine_image,
    volumes={DATA_ROOT: volume},
    cpu=4.0,
    memory=16384,
    timeout=900,
    max_containers=10,
)
def run_year(dataset_key: str, year: int, rates: dict, elasticity: float) -> dict:
    """One (dataset, year): cached baseline versus an in-memory reform run."""
    from uk_equalising_cgt.explore import engine_context, validate_request
    from uk_equalising_cgt.explore import run_year as score_year
    from uk_equalising_cgt.pipeline import simulation_folder

    request = validate_request({"dataset": dataset_key, "rates": rates, "elasticity": elasticity})
    context = engine_context()
    manifest = read_manifest()
    if manifest["projection_fingerprint"] != context["projection_fingerprint"]:
        raise RuntimeError(
            "The Volume was warmed under projection "
            f"{manifest['projection_fingerprint']} but the installed engine applies "
            f"{context['projection_fingerprint']}: re-run `modal run backend/warm.py`."
        )
    folder = simulation_folder(request.spec, context["projection_fingerprint"], DATASETS_ROOT)
    return score_year(request, year, folder, context)


@app.function(
    image=engine_image,
    volumes={DATA_ROOT: volume},
    cpu=1.0,
    memory=2048,
    timeout=1500,
    max_containers=5,
)
def run_reform(payload: dict) -> dict:
    """Score a request for every year and cache the result."""
    from uk_equalising_cgt.explore import (
        ResultStore,
        assemble_response,
        cache_key,
        context_from_manifest,
        mark_cache_hit,
        validate_request,
    )
    from uk_equalising_cgt.reform import YEARS

    request = validate_request(payload)
    manifest = read_manifest()
    context = context_from_manifest(manifest)
    key = cache_key(request, context)
    store = ResultStore(RESULTS_DIR)

    try:
        cached = results.get(key)
        if cached is None:
            cached = store.get(key)
            if cached is not None:
                results[key] = cached
        if cached is not None:
            return mark_cache_hit(cached)

        rows = list(
            run_year.starmap(
                [(request.dataset_key, year, request.rates, request.elasticity) for year in YEARS]
            )
        )
        result = assemble_response(request, context, rows)
        store.put(key, result)
        volume.commit()
        results[key] = result
        return result
    finally:
        # Whatever happened, this schedule is no longer in flight.
        jobs.pop(key, None)
