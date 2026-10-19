"""The pipeline records policyengine-uk's own resolution of each case's
realisation response (capital_gains_response_assumption, 2.134.0+) and
refuses to write results when it differs from the case this repo sets."""

import pytest

from uk_cgt_reform import pipeline
from uk_cgt_reform.reform import ELASTICITY_PARAMETER, MTR_ELASTICITY_PARAMETER, equalisation_reform


def resolved(convention, elasticity, mtr=0.0, auto=False, warnings=()):
    return {
        "period": "2026",
        "convention": convention,
        "elasticity": elasticity,
        "badr_elasticity": elasticity,
        "mtr_elasticity": mtr,
        "separate_badr_elasticity": False,
        "sources": {},
        "mtr_auto_resolved": auto,
        "warnings": list(warnings),
    }


def test_static_and_central_set_the_retention_elasticity_explicitly():
    # The engine's default is now 1.0, so the static case must say 0 itself.
    assert equalisation_reform(0.0)[ELASTICITY_PARAMETER] == {"2026-01-01": 0.0}
    assert equalisation_reform(1.0)[ELASTICITY_PARAMETER] == {"2026-01-01": 1.0}
    for e in (0.0, 1.0):
        assert MTR_ELASTICITY_PARAMETER not in equalisation_reform(e)


@pytest.mark.parametrize(
    ("elasticity", "assumption"),
    [(1.0, resolved("retention", 1.0)), (0.0, resolved("static", 0.0))],
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
