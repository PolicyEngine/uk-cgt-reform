"""The pipeline records the resolution of each case's realisation response
(simulations.response_assumption, from the settings the engine reads) and
refuses to write results when it differs from the case this repo sets."""

import sys
import types
import warnings

import pytest

from uk_cgt_reform import pipeline
from uk_cgt_reform.reform import (
    ELASTICITY_PARAMETER,
    MTR_ELASTICITY_PARAMETER,
    OFFICIAL_BADR_ELASTICITY,
    OFFICIAL_ELASTICITY,
    equalisation_reform,
)


def resolved(convention, elasticity, mtr=0.0, auto=False, warnings=(), badr=None, separate=False):
    return {
        "period": "2026",
        "convention": convention,
        "elasticity": elasticity,
        "badr_elasticity": elasticity if badr is None else badr,
        "mtr_elasticity": mtr,
        "separate_badr_elasticity": separate,
        "sources": {},
        "mtr_auto_resolved": auto,
        "warnings": list(warnings),
    }


def test_static_and_central_set_the_retention_elasticity_explicitly():
    # Every case sets the retention elasticity itself, the static case too,
    # so a change to the engine's default (1.0 from policyengine-uk 2.134.0)
    # cannot move a case.
    assert equalisation_reform(0.0)[ELASTICITY_PARAMETER] == {"2026-01-01": 0.0}
    assert equalisation_reform(1.0)[ELASTICITY_PARAMETER] == {"2026-01-01": 1.0}
    for e in (0.0, 1.0):
        assert MTR_ELASTICITY_PARAMETER not in equalisation_reform(e)


@pytest.mark.parametrize(
    ("elasticity", "assumption"),
    [
        (1.0, resolved("retention", 1.0)),
        (0.0, resolved("static", 0.0)),
        (
            OFFICIAL_ELASTICITY,
            resolved(
                "retention", OFFICIAL_ELASTICITY, badr=OFFICIAL_BADR_ELASTICITY, separate=True
            ),
        ),
    ],
)
def test_matching_assumption_is_returned(monkeypatch, elasticity, assumption):
    monkeypatch.setattr(pipeline, "response_assumption", lambda reform, year: assumption)
    assert pipeline.checked_assumption({}, elasticity, 2026) == assumption


@pytest.mark.parametrize(
    "assumption",
    [
        resolved("static", 0.0),
        resolved("retention", 0.5),
        resolved("mtr", 0.0, mtr=-0.7, auto=True, warnings=["auto-resolved"]),
    ],
)
def test_a_mismatch_refuses_to_write(monkeypatch, assumption):
    monkeypatch.setattr(pipeline, "response_assumption", lambda reform, year: assumption)
    with pytest.raises(RuntimeError):
        pipeline.checked_assumption({}, 1.0, 2026)


@pytest.mark.parametrize(
    ("elasticity", "assumption"),
    [
        # A single-elasticity case whose engine relief settings moved.
        (1.0, resolved("retention", 1.0, badr=1.4)),
        (1.0, resolved("retention", 1.0, separate=True)),
        # The official case without its own relief elasticity.
        (OFFICIAL_ELASTICITY, resolved("retention", OFFICIAL_ELASTICITY)),
        (
            OFFICIAL_ELASTICITY,
            resolved("retention", OFFICIAL_ELASTICITY, badr=1.0, separate=True),
        ),
    ],
)
def test_relief_settings_that_differ_refuse_to_write(monkeypatch, elasticity, assumption):
    monkeypatch.setattr(pipeline, "response_assumption", lambda reform, year: assumption)
    with pytest.raises(RuntimeError):
        pipeline.checked_assumption({}, elasticity, 2026)


def test_run_restores_the_warning_filters(monkeypatch, tmp_path):
    class CapitalGainsResponseWarning(UserWarning):
        pass

    stub = types.ModuleType("policyengine_uk.utils.capital_gains")
    stub.CapitalGainsResponseWarning = CapitalGainsResponseWarning
    monkeypatch.setitem(sys.modules, "policyengine_uk.utils.capital_gains", stub)

    def body(output_dir):
        # Inside the run the engine's response warning is an error.
        with pytest.raises(CapitalGainsResponseWarning):
            warnings.warn("fell back", CapitalGainsResponseWarning, stacklevel=1)
        return {}

    monkeypatch.setattr(pipeline, "_run", body)
    before = list(warnings.filters)
    assert pipeline.run(tmp_path) == {}
    assert warnings.filters == before
