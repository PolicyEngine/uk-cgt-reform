"""Per-year datasets and cached simulations live in a folder keyed by dataset
key, source digest and projection fingerprint (program review C1): a
re-pinned file or a moved projection lands in a new folder instead of
reusing the per-year files an earlier run materialised."""

from dataclasses import replace

from uk_cgt_reform.pipeline import DATASET_FOLDER, dataset_folder, simulation_stem
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
