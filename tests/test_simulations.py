"""The simulation layer's own logic: the bundle check that ties the pinned
dataset to policyengine.py's certified release, and the resolution of the
realisation response from the settings the pinned engine reads."""

import types

import pytest

from uk_cgt_reform import simulations
from uk_cgt_reform.simulations import CANDIDATE, bundle_check, resolve_response

CURRENT_LAW = {
    "elasticity": 0.0,
    "mtr_elasticity": 0.0,
    "separate_badr_elasticity": False,
    "badr_elasticity": 1.4,
}


def settings(**overrides):
    return {**CURRENT_LAW, **overrides}


def test_a_retention_elasticity_resolves_to_the_retention_convention():
    resolved = resolve_response(settings(elasticity=1.0), CURRENT_LAW, 2026)
    assert resolved == {
        "period": "2026",
        "convention": "retention",
        "elasticity": 1.0,
        "badr_elasticity": 1.0,
        "mtr_elasticity": 0.0,
        "separate_badr_elasticity": False,
        "sources": {
            "elasticity": "override",
            "badr_elasticity": "override",
            "mtr_elasticity": "default",
            "separate_badr_elasticity": "default",
        },
        "mtr_auto_resolved": False,
        "warnings": [],
    }


def test_zero_elasticities_are_static():
    resolved = resolve_response(settings(), CURRENT_LAW, 2027)
    assert resolved["convention"] == "static"
    assert resolved["period"] == "2027"
    assert resolved["sources"]["elasticity"] == "default"


def test_the_separate_relief_elasticity_applies_only_when_switched_on():
    official = settings(elasticity=3.6, separate_badr_elasticity=True)
    resolved = resolve_response(official, CURRENT_LAW, 2026)
    assert resolved["elasticity"] == 3.6
    assert resolved["badr_elasticity"] == 1.4
    assert resolved["separate_badr_elasticity"] is True
    assert resolved["sources"]["badr_elasticity"] == "override"


def test_the_mtr_convention_and_a_conflict():
    mtr = resolve_response(settings(mtr_elasticity=-0.7), CURRENT_LAW, 2026)
    assert mtr["convention"] == "mtr"
    assert mtr["elasticity"] == 0.0 and mtr["mtr_elasticity"] == -0.7
    with pytest.raises(ValueError):
        resolve_response(settings(elasticity=1.0, mtr_elasticity=-0.7), CURRENT_LAW, 2026)


def _wrapper(sha256):
    entry = types.SimpleNamespace(sha256=sha256, revision="tag")
    manifest = types.SimpleNamespace(datasets={CANDIDATE.key: entry}, policyengine_version="6.10.1")
    return types.SimpleNamespace(
        uk=types.SimpleNamespace(model=types.SimpleNamespace(release_manifest=manifest))
    )


def test_bundle_check_accepts_the_pinned_digest(monkeypatch):
    monkeypatch.setattr(simulations, "import_wrapper", lambda: _wrapper(CANDIDATE.sha256))
    assert bundle_check(CANDIDATE) == {"revision": "tag", "sha256": CANDIDATE.sha256}


def test_bundle_check_refuses_another_file(monkeypatch):
    monkeypatch.setattr(simulations, "import_wrapper", lambda: _wrapper("0" * 64))
    with pytest.raises(RuntimeError):
        bundle_check(CANDIDATE)
