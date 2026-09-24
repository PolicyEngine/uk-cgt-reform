"""The rate explorer's gateway: a cheap, always-available FastAPI app.

- ``GET  /metadata``      what the Volume was warmed with plus the request options
- ``POST /submit``        validate; serve a cached result at once, else spawn a job
- ``GET  /status/{job}``  poll a spawned job

It never runs the engine. Cached results come from the ``modal.Dict`` first
and the Volume's ``explore_results/`` second (re-populating the Dict on a
Volume hit); everything else is spawned on ``uk-cgt-reform-workers``.
Proxy authentication is required: the dashboard's Next route holds the
token server-side (``CGT_EXPLORER_MODAL_KEY`` / ``CGT_EXPLORER_MODAL_SECRET``).

Deploy: ``modal deploy backend/modal_app.py`` (after the workers and the warm
run); the URL is ``https://<workspace>--uk-cgt-reform-fastapi-app.modal.run``.
"""

import time

import modal
from common import (
    DAILY_COMPUTE_BUDGET,
    DATA_ROOT,
    GATEWAY_APP_NAME,
    JOB_TTL_SECONDS,
    MAX_IN_FLIGHT,
    RESULTS_DIR,
    WORKERS_APP_NAME,
    gateway_image,
    jobs,
    read_manifest,
    results,
    usage,
    volume,
)

app = modal.App(GATEWAY_APP_NAME)


def build_web_app():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    from uk_cgt_reform.explore import (
        ExploreValidationError,
        ResultStore,
        api_options,
        cache_key,
        context_from_manifest,
        mark_cache_hit,
        validate_request,
    )

    web_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    no_store = {"Cache-Control": "no-store"}

    def error(detail: str, status: int):
        return JSONResponse({"detail": detail}, status_code=status, headers=no_store)

    def manifest_or_error():
        """The manifest and the request context built from it, or a 503 that
        names the fix: a missing manifest, or one written by an older warm
        step that lacks a field this code keys on, both mean re-run warm."""
        try:
            manifest = read_manifest()
            return (manifest, context_from_manifest(manifest)), None
        except FileNotFoundError as exc:
            return None, error(str(exc), 503)
        except ValueError as exc:
            return None, error(
                f"The Volume's manifest is stale ({exc}); re-run `modal run backend/warm.py` "
                "after deploying this code.",
                503,
            )

    @web_app.get("/metadata")
    def metadata():
        loaded, failure = manifest_or_error()
        if failure:
            return failure
        manifest, _ = loaded
        return JSONResponse({"manifest": manifest, "options": api_options()}, headers=no_store)

    @web_app.post("/submit")
    def submit(payload: dict):
        try:
            request = validate_request(payload)
        except ExploreValidationError as exc:
            return error(str(exc), 400)
        loaded, failure = manifest_or_error()
        if failure:
            return failure
        _, context = loaded
        key = cache_key(request, context)
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
        # Bound the work a stream of misses can start: join a job already
        # computing this schedule, and refuse when the in-flight cap is hit.
        # This is check-then-spawn under @modal.concurrent, so two requests
        # for one key that arrive within the same few milliseconds can both
        # spawn and the cap can overshoot by that window; run_reform's
        # max_containers=5 bounds the overshoot, and the second job finds the
        # first's result in the cache if it finishes later.
        now = time.time()
        in_flight = {}
        for job_key, entry in list(jobs.items()):
            if now - entry.get("submitted_at", 0) < JOB_TTL_SECONDS:
                in_flight[job_key] = entry
            else:
                jobs.pop(job_key, None)
        if key in in_flight:
            return JSONResponse(
                {"status": "queued", "job_id": in_flight[key]["job_id"], "cache_key": key},
                headers=no_store,
            )
        if len(in_flight) >= MAX_IN_FLIGHT:
            return error(
                f"The explorer is already computing {len(in_flight)} schedules; "
                "try again in a minute.",
                429,
            )
        # Daily budget: the spend cap that needs no billing access.
        today = time.strftime("%Y-%m-%d", time.gmtime(now))
        spawned_today = int(usage.get(today, 0))
        if spawned_today >= DAILY_COMPUTE_BUDGET:
            return error(
                "The explorer has reached its daily budget of new schedules; schedules "
                "already computed are still served. Try again tomorrow.",
                429,
            )
        run_reform = modal.Function.from_name(WORKERS_APP_NAME, "run_reform")
        call = run_reform.spawn(request.to_payload())
        jobs[key] = {"job_id": call.object_id, "submitted_at": now}
        usage[today] = spawned_today + 1
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
            name = type(exc).__name__
            # Validation messages are written for users; anything else may
            # carry paths or internals, so the detail stays in the logs.
            detail = (
                str(exc)
                if name == "ExploreValidationError"
                else f"The run failed ({name}); details are in the Modal logs for {WORKERS_APP_NAME}."
            )
            return JSONResponse({"status": "failed", "detail": detail}, headers=no_store)
        return JSONResponse({"status": "done", "result": result}, headers=no_store)

    return web_app


@app.function(image=gateway_image, volumes={DATA_ROOT: volume}, memory=512, timeout=120)
@modal.concurrent(max_inputs=20)
@modal.asgi_app(requires_proxy_auth=True)
def fastapi_app():
    return build_web_app()
