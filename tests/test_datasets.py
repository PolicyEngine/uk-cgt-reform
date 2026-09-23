"""The dataset registry: every input is pinned to a revision and a digest."""

import re

from uk_equalising_cgt.simulations import (
    CANDIDATE,
    DATASETS,
    DEFAULT_DATASET_KEY,
    EXTRA_VARIABLES,
    INCUMBENT,
)


def test_registry_has_one_incumbent_and_one_candidate():
    assert set(DATASETS) == {INCUMBENT.key, CANDIDATE.key}
    assert INCUMBENT.role == "incumbent" and CANDIDATE.role == "candidate"
    assert DEFAULT_DATASET_KEY in DATASETS


def test_every_dataset_is_pinned():
    for spec in DATASETS.values():
        assert spec.uri.startswith("hf://")
        assert "@" in spec.uri, "URIs must carry an immutable revision"
        assert re.fullmatch(r"[0-9a-f]{64}", spec.sha256)
        assert spec.digest == spec.sha256[:12]
        assert spec.revision and "/" not in spec.revision


def test_stems_are_distinct_and_revision_free():
    stems = {spec.stem for spec in DATASETS.values()}
    assert stems == {"enhanced_frs_2024_25", "microcosm_uk_2024_25"}


def test_shared_base_year():
    assert {spec.base_year for spec in DATASETS.values()} == {2024}


def test_metadata_round_trip():
    metadata = CANDIDATE.to_metadata()
    assert metadata["key"] == CANDIDATE.key
    assert metadata["revision"] == "f6df65b1e98675ad305bcacf7ede3e0d34b57063"
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
