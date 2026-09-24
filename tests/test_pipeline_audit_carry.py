"""An audit-only rewrite keeps measured baselines produced under the same
projection fingerprint and drops them when the projection has moved."""

import json

from uk_cgt_reform.pipeline import _carried_baselines


def test_carried_baselines_require_the_same_fingerprint(tmp_path):
    path = tmp_path / "audit.json"
    assert _carried_baselines(path, "abc") is None

    path.write_text(
        json.dumps(
            {
                "projection_fingerprint": "abc",
                "baseline_by_year": {"ds": {"2026": {"gains_bn": 1.0}}},
                "entrant_ceiling_gbp": {"2026": 3222.0},
            }
        )
    )
    carried = _carried_baselines(path, "abc")
    assert carried["baseline_by_year"] == {"ds": {"2026": {"gains_bn": 1.0}}}
    assert carried["entrant_ceiling_gbp"] == {"2026": 3222.0}
    assert _carried_baselines(path, "moved") is None

    path.write_text(json.dumps({"projection_fingerprint": "abc", "baseline_by_year": {}}))
    assert _carried_baselines(path, "abc") is None
