"""Backwards-compatible shim: prefer `python -m uk_cgt_reform` or the
`uk-cgt-reform-build` console script."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from uk_cgt_reform.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
