"""Per-year datasets and cached simulations live in a folder keyed by dataset
key, source digest and projection fingerprint (program review C1): a
re-pinned file or a moved projection lands in a new folder instead of
reusing the per-year files an earlier run materialised."""

from dataclasses import replace

from uk_cgt_reform.pipeline import (
    DATASET_FOLDER,
    burnham_sim_id,
    counterfactual_sim_id,
    dataset_folder,
    simulation_stem,
)
from uk_cgt_reform.reform import OFFICIAL_ELASTICITY, burnham_reform, reform_fingerprint
from uk_cgt_reform.simulations import CANDIDATE, INCUMBENT

FINGERPRINT = "1b0cd0dff144"


def test_folder_moves_when_the_projection_fingerprint_moves():
    before = dataset_folder(CANDIDATE, FINGERPRINT)
    after = dataset_folder(CANDIDATE, "cd902bb73930")
    assert before != after
    assert before.parent == after.parent == DATASET_FOLDER
    assert before.name == f"{CANDIDATE.key}_{CANDIDATE.digest}_{FINGERPRINT}"


def test_folder_moves_when_the_dataset_is_re_pinned():
    re_pinned = replace(CANDIDATE, sha256="f" * 64)
    assert dataset_folder(re_pinned, FINGERPRINT) != dataset_folder(CANDIDATE, FINGERPRINT)


def test_datasets_never_share_a_folder_and_simulation_ids_carry_the_key():
    assert dataset_folder(INCUMBENT, FINGERPRINT) != dataset_folder(CANDIDATE, FINGERPRINT)
    stem = simulation_stem(CANDIDATE, FINGERPRINT)
    assert stem.startswith(CANDIDATE.key)
    assert CANDIDATE.digest in stem
    assert stem.endswith(FINGERPRINT)
    assert dataset_folder(CANDIDATE, FINGERPRINT).name == stem


def test_burnham_ids_match_the_cached_outputs():
    # The names the committed results' cached .h5 files carry: a change here
    # would silently re-run every scenario.
    stem = "STEM"
    assert burnham_sim_id(stem, -0.7, "d33c3951fbea", 2026) == "STEM_burnham_e07_d33c3951fbea_2026"
    assert burnham_sim_id(stem, 0.0, "45576cc53935", 2030) == "STEM_burnham_e000_45576cc53935_2030"
    assert burnham_sim_id(stem, -0.35, "885c3d31e932", 2026) == (
        "STEM_burnham_e035_885c3d31e932_2026"
    )
    official = reform_fingerprint(burnham_reform(OFFICIAL_ELASTICITY))
    assert burnham_sim_id(stem, OFFICIAL_ELASTICITY, official, 2026) == (
        f"STEM_burnham_e252_{official}_2026"
    )


def test_counterfactual_ids_name_their_side():
    assert counterfactual_sim_id("STEM", "baseline", "710d8df0d472", 2026) == (
        "STEM_centax1920_baseline_710d8df0d472_2026"
    )
