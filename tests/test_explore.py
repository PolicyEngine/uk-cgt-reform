"""Pure-logic tests for the rate explorer: request validation, cache keys,
the result store and the response shape (no simulation, no engine)."""

import json

import pytest
from test_schema import fake_results

from uk_cgt_reform.comparison import READY_RECKONER, SENSITIVITY_CASES
from uk_cgt_reform.explore import (
    CONTEXT_KEYS,
    ELASTICITY_OPTIONS,
    PRESETS,
    RATE_BOUNDS,
    ExploreValidationError,
    ResultStore,
    api_options,
    assemble_response,
    cache_key,
    mark_cache_hit,
    validate_request,
)
from uk_cgt_reform.impacts import fiscal_year_label
from uk_cgt_reform.reform import (
    BURNHAM_RATES,
    ELASTICITY,
    ELASTICITY_PARAMETER,
    EXPLORER_SCOPE,
    OFFICIAL_ELASTICITY,
    RETENTION_ELASTICITY_PARAMETER,
    YEARS,
    burnham_reform,
    reform_fingerprint,
)
from uk_cgt_reform.simulations import CANDIDATE, DATASETS, DEFAULT_DATASET_KEY, INCUMBENT

FLAT_30 = {"basic_rate": 0.18, "higher_rate": 0.30, "additional_rate": 0.30}


def context(**overrides):
    base = {
        "base_year": 2024,
        "projection_fingerprint": "1b0cd0dff144",
        "policyengine_uk_version": "2.99.1",
        "policyengine_version": "4.22.3",
        "policyengine_core_version": "3.32.6",
        "code_fingerprint": "c0dec0dec0de",
        "exempt_amounts": {y: 3_000.0 for y in (2024, *YEARS)},
        "entrant_ceilings": {y: 3_222.0 for y in YEARS},
        "baseline_rates": {"basic_rate": 0.18, "higher_rate": 0.24, "additional_rate": 0.24},
        "wrapper_certification": {
            "compatibility_basis": "unverified_data_release_manifest_unavailable",
            "certified_for_model_version": "2.99.1",
            "data_build_id": "populace-uk-2023-dd68c73-4aa4b14-20260619T023711Z",
            "built_with_model_version": "2.89.2",
        },
    }
    return {**base, **overrides}


def year_rows(scale=1.0):
    fake = fake_results(CANDIDATE, scale=scale)
    return [
        {
            "year": row["year"],
            "budget": row,
            "income_change_groups": fake["income_change_groups"][row["year"]],
            "seconds": 6.0,
        }
        for row in fake["budget"]
    ]


# --- validation ---------------------------------------------------------------


def test_validate_request_normalises_a_good_request():
    req = validate_request({"dataset": CANDIDATE.key, "rates": FLAT_30, "elasticity": -0.7})
    assert req.dataset_key == CANDIDATE.key
    assert req.rates == FLAT_30
    assert req.elasticity == -0.7
    assert req.spec is CANDIDATE
    assert req.to_payload() == {"dataset": CANDIDATE.key, "rates": FLAT_30, "elasticity": -0.7}


def test_validate_request_defaults_dataset_and_elasticity():
    req = validate_request({"rates": FLAT_30})
    assert req.dataset_key == DEFAULT_DATASET_KEY
    assert req.elasticity == ELASTICITY


def test_validate_request_rounds_rates():
    req = validate_request({"rates": {**FLAT_30, "higher_rate": 0.3000000001}})
    assert req.rates["higher_rate"] == 0.3


@pytest.mark.parametrize(
    "payload, message",
    [
        ({"dataset": "nope", "rates": FLAT_30}, "Unknown dataset"),
        ({"rates": {"basic_rate": 0.18, "higher_rate": 0.3}}, "missing additional_rate"),
        ({"rates": {**FLAT_30, "basic_rate": -0.01}}, "between"),
        ({"rates": {**FLAT_30, "additional_rate": 0.76}}, "between"),
        ({"rates": {**FLAT_30, "additional_rate": 0.29}}, "additional rate must be at least"),
        (
            {"rates": {**FLAT_30, "basic_rate": 0.31, "additional_rate": 0.31}},
            "basic rate may not exceed",
        ),
        ({"rates": {**FLAT_30, "higher_rate": 0.305}}, "whole percentage point"),
        ({"rates": {**FLAT_30, "basic_rate": "18"}}, "must be a number"),
        ({"rates": {**FLAT_30, "basic_rate": True}}, "must be a number"),
        ({"rates": FLAT_30, "elasticity": -0.5}, "elasticity must be one of"),
        ({"rates": "18/30/30"}, "rates must be an object"),
        ("not a dict", "JSON object"),
    ],
)
def test_validate_request_rejects(payload, message):
    with pytest.raises(ExploreValidationError, match=message):
        validate_request(payload)


def test_rate_bounds_and_elasticity_options():
    assert RATE_BOUNDS == (0.0, 0.75)
    assert [o["e_mtr"] for o in ELASTICITY_OPTIONS] == list(SENSITIVITY_CASES.values())
    assert [o["id"] for o in ELASTICITY_OPTIONS] == [
        "static",
        "centax_lower",
        "centax_central",
        "official",
    ]
    official = ELASTICITY_OPTIONS[-1]
    assert official["applied_as"] == "retention"
    assert official["applied_value"] == 3.6
    assert all(o["applied_as"] == "mtr" for o in ELASTICITY_OPTIONS[:-1])


def test_official_elasticity_applies_the_retention_parameter():
    req = validate_request({"rates": FLAT_30, "elasticity": -2.52})
    assert req.elasticity == OFFICIAL_ELASTICITY
    reform = req.reform()
    assert reform[RETENTION_ELASTICITY_PARAMETER] == {"2026-01-01": 3.6}
    assert ELASTICITY_PARAMETER not in reform
    central = validate_request({"rates": FLAT_30}).reform()
    assert RETENTION_ELASTICITY_PARAMETER not in central
    result = assemble_response(req, context(), year_rows())
    assert result["metadata"]["elasticity_applied"] == {RETENTION_ELASTICITY_PARAMETER: 3.6}


def test_ready_reckoner_rows_are_valid_requests_and_not_presets():
    preset_rates = [p["rates"] for p in PRESETS]
    for row in READY_RECKONER["rows"]:
        req = validate_request({"rates": row["rates"], "elasticity": OFFICIAL_ELASTICITY})
        assert req.rates == row["rates"]
        assert row["rates"] not in preset_rates


def test_presets_are_valid_requests():
    for preset in PRESETS:
        req = validate_request({"rates": preset["rates"]})
        assert req.rates == preset["rates"]
    by_id = {p["id"]: p for p in PRESETS}
    assert by_id["income_tax"]["rates"] == BURNHAM_RATES
    assert by_id["current_law"]["rates"] == {
        "basic_rate": 0.18,
        "higher_rate": 0.24,
        "additional_rate": 0.24,
    }


def test_api_options_carry_what_a_client_needs():
    options = api_options()
    assert options["scope"] == EXPLORER_SCOPE
    assert options["rate_step"] == 0.01
    assert options["years"] == list(YEARS)
    assert {d["key"] for d in options["datasets"]} == set(DATASETS)
    assert options["default_dataset_key"] == DEFAULT_DATASET_KEY
    assert [p["id"] for p in options["presets"]] == [p["id"] for p in PRESETS]
    assert [r["id"] for r in options["ready_reckoner"]["rows"]] == [
        r["id"] for r in READY_RECKONER["rows"]
    ]
    assert options["ready_reckoner"]["lag"] == READY_RECKONER["lag"]


# --- the reform an explorer request builds -----------------------------------


def test_explorer_reform_at_income_tax_rates_matches_burnham_on_the_rates():
    req = validate_request({"rates": BURNHAM_RATES})
    reform = req.reform()
    burnham = burnham_reform()
    for key in (
        "gov.hmrc.cgt.basic_rate",
        "gov.hmrc.cgt.higher_rate",
        "gov.hmrc.cgt.additional_rate",
        "gov.hmrc.cgt.residential_property.higher_rate",
    ):
        assert reform[key] == burnham[key]
    # Scope differs only in the carried interest schedule and the BADR
    # limit, both inert on the registered datasets.
    assert set(burnham) - set(reform) == {
        "gov.hmrc.cgt.carried_interest.basic_rate",
        "gov.hmrc.cgt.carried_interest.higher_rate",
        "gov.hmrc.cgt.carried_interest.additional_rate",
        "gov.hmrc.cgt.badr.lifetime_limit",
    }
    assert req.fingerprint != reform_fingerprint(burnham)


# --- cache key ----------------------------------------------------------------


def test_cache_key_tracks_every_input_and_nothing_else():
    req = validate_request({"dataset": CANDIDATE.key, "rates": FLAT_30})
    key = cache_key(req, context())
    assert key.startswith(
        f"{CANDIDATE.key}__{CANDIDATE.digest}__1b0cd0dff144__2.99.1__4.22.3__3.32.6__c0dec0dec0de__"
    )
    assert key.endswith(req.fingerprint)
    # Changes that must miss.
    assert cache_key(req, context(projection_fingerprint="other")) != key
    assert cache_key(req, context(policyengine_uk_version="2.99.2")) != key
    assert cache_key(req, context(policyengine_version="4.23.0")) != key
    assert cache_key(req, context(policyengine_core_version="3.33.0")) != key
    assert cache_key(req, context(code_fingerprint="deadbeef0000")) != key
    other_rates = validate_request(
        {"dataset": CANDIDATE.key, "rates": {**FLAT_30, "higher_rate": 0.29}}
    )
    assert cache_key(other_rates, context()) != key
    other_e = validate_request({"dataset": CANDIDATE.key, "rates": FLAT_30, "elasticity": 0.0})
    assert cache_key(other_e, context()) != key
    other_dataset = validate_request({"dataset": INCUMBENT.key, "rates": FLAT_30})
    assert cache_key(other_dataset, context()) != key
    # Changes that must hit: the same request again, and context fields the
    # key does not track.
    again = validate_request({"dataset": CANDIDATE.key, "rates": dict(FLAT_30), "elasticity": -0.7})
    assert cache_key(again, context(base_year=2023)) == key


def test_cache_key_needs_the_context_fields():
    req = validate_request({"rates": FLAT_30})
    with pytest.raises(ValueError, match="missing"):
        cache_key(req, {k: "x" for k in CONTEXT_KEYS[:-1]})


# --- result store -------------------------------------------------------------


def test_result_store_round_trips_and_is_atomic(tmp_path):
    store = ResultStore(tmp_path / "explore_results")
    assert store.get("missing") is None
    assert store.keys() == []
    path = store.put("a__b", {"x": 1})
    assert path == tmp_path / "explore_results" / "a__b.json"
    assert store.get("a__b") == {"x": 1}
    assert store.keys() == ["a__b"]
    assert not list(path.parent.glob("*.tmp"))
    store.put("a__b", {"x": 2})
    assert store.get("a__b") == {"x": 2}


# --- response shape -----------------------------------------------------------


def test_assemble_response_has_the_pipeline_shapes():
    req = validate_request({"dataset": CANDIDATE.key, "rates": FLAT_30})
    ctx = context()
    result = assemble_response(req, ctx, year_rows(), computed_at="2026-09-23T10:00:00+00:00")
    md = result["metadata"]
    labels = [fiscal_year_label(y) for y in YEARS]
    assert set(result) == {"metadata", "budget", "income_change_groups", "five_year_total_bn"}
    assert [row["year"] for row in result["budget"]] == labels
    assert list(result["income_change_groups"]) == labels
    assert set(result["income_change_groups"][labels[0]]) == {
        "quintile",
        "quartile",
        "household_type",
        "region",
    }
    assert result["five_year_total_bn"] == pytest.approx(5 * 2.3)
    assert md["dataset_key"] == CANDIDATE.key
    assert md["dataset_sha256"] == CANDIDATE.sha256
    assert md["reform"] == FLAT_30
    assert md["reform_scope"] == EXPLORER_SCOPE
    assert md["reform_schedules"] == {"residential_property": FLAT_30}
    assert md["reform_dict"] == req.reform()
    assert md["reform_fingerprint"] == req.fingerprint
    assert md["baseline_rates"] == ctx["baseline_rates"]
    assert md["wrapper_certification"]["compatibility_basis"] == (
        "unverified_data_release_manifest_unavailable"
    )
    assert md["elasticity"] == -0.7
    assert md["years"] == list(YEARS)
    assert list(md["exempt_amount_gbp"]) == labels
    assert md["projection"] == {"fingerprint": "1b0cd0dff144", "base_year": 2024}
    assert md["timing"]["total_seconds"] == pytest.approx(30.0)
    assert md["cache"] == {
        "hit": False,
        "key": cache_key(req, ctx),
        "computed_at": "2026-09-23T10:00:00+00:00",
    }
    json.dumps(result)  # serialisable as is


def test_assemble_response_accepts_rows_in_any_order_but_needs_every_year():
    req = validate_request({"rates": FLAT_30})
    rows = year_rows()
    result = assemble_response(req, context(), list(reversed(rows)))
    assert [row["year"] for row in result["budget"]] == [fiscal_year_label(y) for y in YEARS]
    with pytest.raises(ValueError, match="missing"):
        assemble_response(req, context(), rows[:-1])


def test_mark_cache_hit_flags_a_copy():
    req = validate_request({"rates": FLAT_30})
    result = assemble_response(req, context(), year_rows())
    hit = mark_cache_hit(result)
    assert hit["metadata"]["cache"]["hit"] is True
    assert hit["metadata"]["cache"]["key"] == result["metadata"]["cache"]["key"]
    assert result["metadata"]["cache"]["hit"] is False
    assert hit["budget"] == result["budget"]


# --- manifest round trip (Modal containers assemble without the engine) ------


def test_manifest_round_trips_the_context_fields():
    from uk_cgt_reform.explore import (
        MANIFEST_FIELDS,
        code_fingerprint,
        context_from_manifest,
        manifest_payload,
    )

    # The manifest never carries the code fingerprint; the running code does.
    ctx = context(code_fingerprint=code_fingerprint())
    manifest = manifest_payload(ctx)
    assert "code_fingerprint" not in manifest
    json.dumps(manifest)  # JSON-safe: year keys are strings
    assert set(manifest) == {
        *MANIFEST_FIELDS,
        "exempt_amounts",
        "entrant_ceilings",
        "years",
        "warmed_at",
    }
    assert manifest["years"] == list(YEARS)
    restored = context_from_manifest(json.loads(json.dumps(manifest)))
    for field in MANIFEST_FIELDS:
        assert restored[field] == ctx[field]
    assert restored["exempt_amounts"] == ctx["exempt_amounts"]
    assert restored["entrant_ceilings"] == ctx["entrant_ceilings"]
    # A manifest keys the cache exactly as the live context does.
    req = validate_request({"rates": FLAT_30})
    assert restored["code_fingerprint"] == code_fingerprint()
    assert cache_key(req, restored) == cache_key(req, ctx)
    # And assembles the same response (apart from the generation time).
    a = assemble_response(req, ctx, year_rows(), computed_at="t")
    b = assemble_response(req, restored, year_rows(), computed_at="t")
    assert a == b
    with pytest.raises(ValueError, match="missing"):
        context_from_manifest({"base_year": 2024})


# --- code fingerprint and baseline guard --------------------------------------


def test_code_fingerprint_is_a_stable_short_hex_digest():
    from uk_cgt_reform.explore import CODE_FINGERPRINT_FILES, code_fingerprint

    assert "impacts.py" in CODE_FINGERPRINT_FILES and "explore.py" in CODE_FINGERPRINT_FILES
    first = code_fingerprint()
    assert len(first) == 12 and int(first, 16) >= 0
    assert code_fingerprint() == first


def test_run_year_refuses_to_recompute_a_missing_baseline(tmp_path):
    from uk_cgt_reform.explore import run_year

    req = validate_request({"dataset": CANDIDATE.key, "rates": FLAT_30})
    with pytest.raises(FileNotFoundError, match="Baseline output"):
        run_year(req, 2026, tmp_path, context())
