"""The dataset registry: every input is pinned to a revision and a digest."""

import re

from uk_cgt_reform.simulations import (
    CANDIDATE,
    DATASETS,
    DEFAULT_DATASET_KEY,
    EXTRA_VARIABLES,
)


def test_registry_holds_the_microcosm_build_alone():
    assert set(DATASETS) == {CANDIDATE.key}
    assert DEFAULT_DATASET_KEY == CANDIDATE.key


def test_every_dataset_is_pinned():
    for spec in DATASETS.values():
        assert spec.uri.startswith("hf://")
        assert "@" in spec.uri, "URIs must carry an immutable revision"
        assert re.fullmatch(r"[0-9a-f]{64}", spec.sha256)
        assert spec.digest == spec.sha256[:12]
        assert spec.revision and "/" not in spec.revision


def test_stem_is_revision_free():
    assert {spec.stem for spec in DATASETS.values()} == {"microcosm_uk_2024_25"}


def test_base_year():
    assert {spec.base_year for spec in DATASETS.values()} == {2024}


def test_metadata_round_trip():
    metadata = CANDIDATE.to_metadata()
    assert metadata["key"] == CANDIDATE.key
    assert metadata["revision"] == "1b295f3750241f5f5f1bf92cdbe1d5b6a19a8922"
    assert metadata["digest"] == CANDIDATE.digest


def test_extra_variables_cover_the_schedules_and_region():
    assert {
        "capital_gains",
        "capital_gains_before_response",
        "capital_gains_tax",
        "capital_gains_residential_property",
        "capital_gains_badr",
        "capital_gains_carried_interest",
    } <= set(EXTRA_VARIABLES["person"])
    assert "region" in EXTRA_VARIABLES["household"]
