"""The rate explorer's gateway: a cheap, always-available FastAPI app.

- ``GET  /metadata``      what the Volume was warmed with plus the request options
- ``POST /submit``        validate; serve a cached result at once, else spawn a job
- ``GET  /status/{job}``  poll a spawned job

It never runs the engine. Cached results come from the ``modal.Dict`` first
and the Volume's ``explore_results/`` second (re-populating the Dict on a
Volume hit); everything else is spawned on ``uk-equalising-cgt-workers``.
Proxy authentication is required: the dashboard's Next route holds the
token server-side (``CGT_EXPLORER_MODAL_KEY`` / ``CGT_EXPLORER_MODAL_SECRET``).

Deploy: ``modal deploy backend/modal_app.py`` (after the workers and the warm
run); the URL is ``https://<workspace>--uk-equalising-cgt-fastapi-app.modal.run``.
"""

import modal
from common import (
    DATA_ROOT,
    GATEWAY_APP_NAME,
    RESULTS_DIR,
    WORKERS_APP_NAME,
    gateway_image,
    read_manifest,
    results,
    volume,
)

app = modal.App(GATEWAY_APP_NAME)


def build_web_app():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    from uk_equalising_cgt.explore import (
        ExploreValidationError,
        ResultStore,
        api_options,
        cache_key,
        mark_cache_hit,
        validate_request,
    )

    web_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    no_store = {"Cache-Control": "no-store"}

    def error(detail: str, status: int):
        return JSONResponse({"detail": detail}, status_code=status, headers=no_store)

    def manifest_or_error():
        try:
            return read_manifest(), None
        except FileNotFoundError as exc:
            return None, error(str(exc), 503)

    @web_app.get("/metadata")
    def metadata():
        manifest, failure = manifest_or_error()
        if failure:
            return failure
        return JSONResponse({"manifest": manifest, "options": api_options()}, headers=no_store)

    @web_app.post("/submit")
    def submit(payload: dict):
        try:
            request = validate_request(payload)
        except ExploreValidationError as exc:
            return error(str(exc), 400)
        manifest, failure = manifest_or_error()
        if failure:
            return failure
        key = cache_key(request, manifest)
        cached = results.get(key)
        if cached is None:
            cached = ResultStore(RESULTS_DIR).get(key)
            if cached is not None:
                results[key] = cached
        if cached is not None:
            return JSONResponse(
                {"status": "done", "result": mark_cache_hit(cached), "cache_key": key},
                headers=no_store,
            )
        run_reform = modal.Function.from_name(WORKERS_APP_NAME, "run_reform")
        call = run_reform.spawn(request.to_payload())
        return JSONResponse(
            {"status": "queued", "job_id": call.object_id, "cache_key": key}, headers=no_store
        )

    @web_app.get("/status/{job_id}")
    def status(job_id: str):
        try:
            call = modal.FunctionCall.from_id(job_id)
            result = call.get(timeout=0)
        except TimeoutError:
            return JSONResponse({"status": "running"}, headers=no_store)
        except Exception as exc:  # the job raised: report, never cache
            return JSONResponse(
                {"status": "failed", "detail": f"{type(exc).__name__}: {exc}"}, headers=no_store
            )
        return JSONResponse({"status": "done", "result": result}, headers=no_store)

    return web_app


@app.function(image=gateway_image, volumes={DATA_ROOT: volume}, memory=512, timeout=120)
@modal.concurrent(max_inputs=20)
@modal.asgi_app(requires_proxy_auth=True)
def fastapi_app():
    return build_web_app()
