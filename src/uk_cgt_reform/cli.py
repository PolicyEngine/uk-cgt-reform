"""Command-line entry point for the results pipeline (the equalisation
reform on the registered dataset).

Exposes a :func:`main` callable that ``[project.scripts]`` registers as
``uk-cgt-reform-build`` and that ``__main__.py`` invokes for
``python -m uk_cgt_reform``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .pipeline import DATA_DIR, run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="uk-cgt-reform-build",
        description=(
            "Generate dashboard-ready results for equalising CGT rates with "
            "income tax rates, 2026-27 to 2030-31, on the registered dataset."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DATA_DIR,
        help=(
            "Directory for the results JSON files (default: data/): the dashboard's "
            "cgt_equalisation_results.json and the uprating audit."
        ),
    )
    parser.add_argument(
        "--audit-only",
        action="store_true",
        help=(
            "Write only the uprating audit (data/cgt_uprating_audit.json) from the "
            "installed engine's parameters; runs no simulations, so the per-year "
            "baseline block is left empty."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.audit_only:
        from .pipeline import write_uprating_audit

        write_uprating_audit()
        return 0
    run(output_dir=args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
